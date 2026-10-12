import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { link_id, short_code, click } = body;

    if (!link_id && !short_code) {
      return NextResponse.json({ error: 'Missing link identifier' }, { status: 400 });
    }

    const code = (short_code || '').toLowerCase();
    const id = link_id || '';

    // 1. Update Neon PostgreSQL if available
    try {
      if (id) {
        await sql.query(
          `UPDATE links SET clicks_count = COALESCE(clicks_count, 0) + 1, updated_at = NOW() WHERE id = $1`,
          [id]
        );
      } else if (code) {
        await sql.query(
          `UPDATE links SET clicks_count = COALESCE(clicks_count, 0) + 1, updated_at = NOW() WHERE LOWER(short_code) = $1`,
          [code]
        );
      }

      if (click) {
        await sql.query(
          `INSERT INTO click_events (id, link_id, short_code, ip_hash, country, country_code, city, device, os, browser, referrer, is_bot, is_unique, latency_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            click.id || `clk_${Date.now()}`,
            id,
            code,
            click.ip_hash || 'ip_anon',
            click.country || 'United States',
            click.country_code || 'US',
            click.city || 'San Francisco',
            click.device || 'mobile',
            click.os || 'iOS',
            click.browser || 'Safari',
            click.referrer || 'Direct / None',
            !!click.is_bot,
            click.is_unique ?? true,
            click.latency_ms || 20
          ]
        );
      }
    } catch (dbErr) {
      // Non-blocking in case DB is offline or table is initializing
      console.warn('DB tracking warning:', dbErr);
    }

    // 2. Update edge cache
    if (code) {
      const cached = linkCache.get(`link_${code}`) as any;
      if (cached) {
        cached.clicks_count = (cached.clicks_count || 0) + 1;
        linkCache.set(`link_${code}`, cached, 180);
      }
    }

    return NextResponse.json({ success: true, message: 'Click tracked' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Tracking error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || '').toLowerCase();

  if (code) {
    try {
      const rows = await sql.query(
        `SELECT clicks_count FROM links WHERE LOWER(short_code) = $1 LIMIT 1`,
        [code]
      );
      if (rows && rows.length > 0) {
        return NextResponse.json({ success: true, clicks_count: rows[0].clicks_count });
      }
    } catch {}
  }

  return NextResponse.json({ success: true, clicks_count: 0 });
}
