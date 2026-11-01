import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';
import { TrackApiRequest, TrackApiResponse } from '@/lib/types';
import { extractGeoFromHeaders, getTrustedEdgeClientIp } from '@/lib/geo';
import { dispatchWorkspaceWebhooks } from '@/lib/webhooks';
import { verifyClickToken } from '@/lib/session';
import { cleanHost, isPlatformHost } from '@/lib/domainHelper';

export async function POST(request: Request) {
  try {
    let body: Partial<TrackApiRequest>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json<TrackApiResponse>({
        success: false,
        error: 'Malformed JSON payload in request body.'
      }, { status: 400 });
    }

    const { link_id, click } = body;

    // Only the redirect page can issue this token, once per view of one link. Without it anyone
    // could post clicks for any link and inflate its count or burn through its click limit.
    const token = verifyClickToken((body as { track_token?: unknown }).track_token);
    if (!token || (link_id && link_id !== token.linkId)) {
      return NextResponse.json<TrackApiResponse>({ success: false, error: 'Invalid or missing click token.' }, { status: 401 });
    }
    if (!click || typeof click !== 'object') {
      return NextResponse.json<TrackApiResponse>({ success: false, error: 'Click details are required.' }, { status: 400 });
    }
    if (!(await linkCache.setNx(`trk_${token.nonce}`, true, 30 * 60))) {
      return NextResponse.json<TrackApiResponse>({ success: true, message: 'Click already recorded.' }, { status: 200 });
    }

    const id = token.linkId;
    const linkRow = (await sql.query(`SELECT short_code FROM links WHERE id = $1 LIMIT 1`, [id]).catch(() => [])) as { short_code?: string }[];
    if (!linkRow?.[0]) {
      return NextResponse.json<TrackApiResponse>({ success: false, error: 'Link not found.' }, { status: 404 });
    }
    const code = String(linkRow[0].short_code || '').toLowerCase();
    const isBotClick = !!click.is_bot;

    // Deduplication guard: ignore repeated beacons with the same click.id within 60 seconds using atomic Redis SETNX
    if (click && typeof click === 'object' && click.id) {
      const dedupKey = `tracked_clk_${click.id}`;
      const isNew = await linkCache.setNx(dedupKey, true, 60);
      if (!isNew) {
        return NextResponse.json<TrackApiResponse>({
          success: true,
          message: 'Click telemetry already recorded.'
        }, { status: 200 });
      }
    }

    // 1. Update PostgreSQL counters
    try {
      if (!isBotClick) {
        await sql.query(
          `UPDATE links SET clicks_count = COALESCE(clicks_count, 0) + 1, updated_at = NOW() WHERE id = $1`,
          [id]
        );
      }

      {
        const headerGeo = extractGeoFromHeaders(name => request.headers.get(name));

        const resolvedCode = (headerGeo.countryCode || click.country_code || '').trim().toUpperCase() || 'Unknown';
        const resolvedCountry = (headerGeo.countryName || click.country || (resolvedCode !== 'Unknown' ? resolvedCode : 'Unknown')).trim();
        // When the server resolved the country, take region/city from the same source only. The
        // browser's values are a timezone guess (e.g. any IST visitor -> Mumbai) and mixing them
        // produced impossible rows like a real US country with a guessed Indian city.
        const hasServerGeo = !!headerGeo.countryCode;
        const resolvedRegion = (hasServerGeo ? headerGeo.regionName : (click.region || '')).trim() || null;
        const resolvedCity = ((hasServerGeo ? headerGeo.city : click.city) || 'Direct').trim();

        // 1. Extract real client IP: verified edge proxy first, then standard proxy and CDN headers
        const trustedIp = getTrustedEdgeClientIp(name => request.headers.get(name));
        const forwarded = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const cfIp = request.headers.get('cf-connecting-ip');
        const clientIp = (trustedIp || cfIp || (forwarded ? forwarded.split(',')[0].trim() : '') || realIp || '127.0.0.1').trim();
        const userAgent = (request.headers.get('user-agent') || '').slice(0, 500);
        const language = (request.headers.get('accept-language')?.split(',')[0]?.split(';')[0]?.trim() || 'en-US').slice(0, 64);

        // 2. Generate deterministic visitor IP hash (SHA-256 of IP + UA or persistent visitor ID)
        const visitorToken = (click.visitor_id || click.ip_hash || clientIp).trim();
        const realVisitorIp = !!trustedIp || isPlatformHost(cleanHost(request.headers.get('x-forwarded-host') || request.headers.get('host') || ''));
        const deterministicIpHash = realVisitorIp
          ? crypto.createHash('sha256').update(clientIp).digest('hex').slice(0, 16)
          : crypto.createHash('sha256').update(`${clientIp}:${visitorToken}:${userAgent}`).digest('hex').substring(0, 32);

        // 3. Server-side Uniqueness Verification: Check if this visitor has ever visited this link before
        let isUniqueVisitor = true;
        try {
          const priorClicks = await sql.query(
            `SELECT 1 FROM click_events
             WHERE link_id = $1 AND ip_hash = $2
             LIMIT 1`,
            [id, deterministicIpHash]
          );
          if (priorClicks && priorClicks.length > 0) {
            isUniqueVisitor = false;
          }
        } catch {
          // If query fails, fallback to client-asserted uniqueness flag
          isUniqueVisitor = click.is_unique !== false;
        }

        // If client's local visited link history already marked it as not unique, respect that
        if (click.is_unique === false) {
          isUniqueVisitor = false;
        }

        const clickId = click.id || `clk_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`}`;

        try {
          await sql.query(
            `INSERT INTO click_events (
              id, link_id, short_code, ip_hash, country, country_code, region, city,
              device, os, browser, referrer, language, user_agent,
              utm_source, utm_medium, utm_campaign, utm_term, utm_content, destination_url,
              is_bot, is_unique, latency_ms
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8,
              $9, $10, $11, $12, $13, $14,
              $15, $16, $17, $18, $19, $20,
              $21, $22, $23
            )
            ON CONFLICT (id) DO NOTHING`,
            [
              clickId,
              id || null,
              code || null,
              deterministicIpHash,
              resolvedCountry,
              resolvedCode,
              resolvedRegion || null,
              resolvedCity,
              click.device || 'mobile',
              click.os || 'iOS',
              click.browser || 'Safari',
              click.referrer || 'Direct / Mobile',
              click.language || language,
              click.user_agent || userAgent,
              click.utm_source || null,
              click.utm_medium || null,
              click.utm_campaign || null,
              click.utm_term || null,
              click.utm_content || null,
              click.destination_url || null,
              !!click.is_bot,
              isUniqueVisitor,
              click.latency_ms || 20
            ]
          );
        } catch {
          // Backward compatibility fallback if region column migration is pending
          await sql.query(
            `INSERT INTO click_events (id, link_id, short_code, ip_hash, country, country_code, city, device, os, browser, referrer, is_bot, is_unique, latency_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (id) DO NOTHING`,
            [
              clickId,
              id || null,
              code || null,
              deterministicIpHash,
              resolvedCountry,
              resolvedCode,
              resolvedCity,
              click.device || 'mobile',
              click.os || 'iOS',
              click.browser || 'Safari',
              click.referrer || 'Direct / Mobile',
              !!click.is_bot,
              isUniqueVisitor,
              click.latency_ms || 20
            ]
          );
        }
      }
    } catch (dbErr) {
      console.warn('DB tracking warning:', dbErr);
    }


    // 3. Dispatch outbound webhooks asynchronously (non-blocking)
    (async () => {
      try {
        const linkRows = (await sql.query(
          `SELECT id, workspace_id, short_code, destination_url FROM links
           WHERE (id = $1 AND $1 != '') OR (LOWER(short_code) = $2 AND $2 != '') LIMIT 1`,
          [id || '', code || '']
        )) as Array<{ id: string; workspace_id?: string | null; short_code: string; destination_url: string }>;

        if (linkRows && linkRows.length > 0) {
          const l = linkRows[0];
          await dispatchWorkspaceWebhooks(l.workspace_id, {
            event: 'link.clicked',
            timestamp: new Date().toISOString(),
            data: {
              link_id: l.id,
              short_code: l.short_code,
              destination_url: l.destination_url,
              click: click || {}
            }
          });
        }
      } catch (whErr) {
        console.warn('Webhook dispatch error:', whErr);
      }
    })().catch(() => {});

    return NextResponse.json<TrackApiResponse>({
      success: true,
      message: 'Click telemetry recorded successfully.'
    }, { status: 200 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Tracking error.';
    return NextResponse.json<TrackApiResponse>({
      success: false,
      error: msg
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || '').trim().toLowerCase();

  if (!code) {
    return NextResponse.json({
      success: false,
      error: 'Query parameter "code" is required.'
    }, { status: 400 });
  }

  try {
    const rows = await sql.query(
      `SELECT clicks_count FROM links WHERE LOWER(short_code) = $1 LIMIT 1`,
      [code]
    );
    if (rows && rows.length > 0) {
      return NextResponse.json({
        success: true,
        clicks_count: Number(rows[0].clicks_count) || 0
      });
    }
  } catch {}

  return NextResponse.json({ success: true, clicks_count: 0 });
}
