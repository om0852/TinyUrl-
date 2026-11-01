import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { after } from 'next/server';
import crypto from 'crypto';
import { verifyLinkPassword } from '@/lib/security';
import { linkCache } from '@/lib/cache';
import { extractGeoFromHeaders, getTrustedEdgeClientIp } from '@/lib/geo';

export async function POST(request: Request) {
  try {
    let body: { code?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Malformed JSON payload.' }, { status: 400 });
    }

    const { code, password } = body;
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: 'Short link code is required.' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ success: false, error: 'Password is required.' }, { status: 400 });
    }

    const cleanCode = code.trim().toLowerCase();
    const rows = await sql.query(
      `SELECT id, short_code, destination_url, password_hash, rules, status, expires_at, max_clicks, clicks_count, utm_source, utm_medium, utm_campaign 
       FROM links 
       WHERE LOWER(short_code) = $1 OR LOWER(custom_slug) = $1 LIMIT 1`,
      [cleanCode]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Link not found.' }, { status: 404 });
    }

    const link = rows[0];

    // Status guards
    if (link.status === 'disabled') {
      return NextResponse.json({ success: false, error: 'This link has been disabled.' }, { status: 403 });
    }
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: 'This link has expired.' }, { status: 410 });
    }
    if (link.max_clicks && link.clicks_count >= link.max_clicks) {
      return NextResponse.json({ success: false, error: 'This link has reached its maximum click limit.' }, { status: 410 });
    }

    // 10 wrong guesses per link and visitor IP, then a 15 minute pause
    const guessIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const guessKey = `unlock_fail_${link.id}_${guessIp}`;
    const fails = Number(await linkCache.get<number>(guessKey).catch(() => 0)) || 0;
    if (fails >= 10) {
      return NextResponse.json({ success: false, error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
    }

    // Server-side password verification
    if (verifyLinkPassword(password, link.password_hash)) {
      await linkCache.delete(guessKey).catch(() => {});
      const dest = link.destination_url;
      const rules = typeof link.rules === 'string' ? JSON.parse(link.rules) : (link.rules || []);

      // Count the visit, like a direct redirect does. Password links never recorded clicks, so
      // their analytics stayed empty and a click limit was never reached.
      const ua = (request.headers.get('user-agent') || '').slice(0, 500);
      const ip = getTrustedEdgeClientIp(name => request.headers.get(name)) || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
      const geo = extractGeoFromHeaders(name => request.headers.get(name));
      const isMobile = /mobile|iphone|ipod|android/i.test(ua);
      const device = /tablet|ipad/i.test(ua) ? 'tablet' : isMobile ? 'mobile' : 'desktop';
      after(async () => {
        await sql.query(
          `INSERT INTO click_events (id, link_id, short_code, timestamp, ip_hash, country, country_code, city, region, device, user_agent, referrer, utm_source, utm_medium, utm_campaign, destination_url, is_bot, is_unique)
           VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, false,
                   NOT EXISTS (SELECT 1 FROM click_events WHERE link_id = $2 AND ip_hash = $4))`,
          [
            `clk_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            link.id,
            link.short_code,
            crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16),
            geo.countryName || 'Unknown',
            geo.countryCode || 'Unknown',
            geo.city || 'Unknown',
            geo.regionName || geo.regionCode || null,
            device,
            ua,
            (request.headers.get('referer') || 'Direct / None').slice(0, 255),
            link.utm_source || null,
            link.utm_medium || null,
            link.utm_campaign || null,
            dest
          ]
        ).catch((err: unknown) => console.warn('Unlock click insert failed:', err));
        await sql.query(`UPDATE links SET clicks_count = clicks_count + 1 WHERE id = $1`, [link.id]).catch(() => {});
      });

      return NextResponse.json({
        success: true,
        destination_url: dest,
        rules
      });
    }

    await linkCache.set(guessKey, fails + 1, 15 * 60).catch(() => {});
    return NextResponse.json({ success: false, error: 'Incorrect password. Access denied.' }, { status: 401 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server verification error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
