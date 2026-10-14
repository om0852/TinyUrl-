import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';
import { TrackApiRequest, TrackApiResponse, Link } from '@/lib/types';
import { extractGeoFromHeaders } from '@/lib/geo';
import { dispatchWorkspaceWebhooks } from '@/lib/webhooks';

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

    const { link_id, short_code, click } = body;

    if (!link_id && !short_code) {
      return NextResponse.json<TrackApiResponse>({ 
        success: false, 
        error: 'Either "link_id" or "short_code" identifier is required.' 
      }, { status: 400 });
    }

    const code = (short_code || '').trim().toLowerCase();
    const id = (link_id || '').trim();

    // Deduplication guard: ignore repeated beacons with the same click.id within 60 seconds
    if (click && typeof click === 'object' && click.id) {
      const dedupKey = `tracked_clk_${click.id}`;
      if (linkCache.get(dedupKey)) {
        return NextResponse.json<TrackApiResponse>({ 
          success: true, 
          message: 'Click telemetry already recorded.' 
        }, { status: 200 });
      }
      linkCache.set(dedupKey, true, 60);
    }

    // 1. Update PostgreSQL counters
    try {
      if (id || code) {
        await sql.query(
          `UPDATE links SET clicks_count = COALESCE(clicks_count, 0) + 1, updated_at = NOW() 
           WHERE (id = $1 AND $1 != '') OR (LOWER(short_code) = $2 AND $2 != '')`,
          [id || '', code || '']
        );
      }

      if (click && typeof click === 'object') {
        const headerGeo = extractGeoFromHeaders(name => request.headers.get(name));

        const resolvedCode = (headerGeo.countryCode || click.country_code || '').trim().toUpperCase() || 'Unknown';
        const resolvedCountry = (headerGeo.countryName || click.country || (resolvedCode !== 'Unknown' ? resolvedCode : 'Unknown')).trim();
        const resolvedRegion = (headerGeo.regionName || click.region || '').trim() || null;
        const resolvedCity = (headerGeo.city || click.city || 'Direct').trim();

        const clickId = click.id || `clk_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`}`;

        try {
          await sql.query(
            `INSERT INTO click_events (id, link_id, short_code, ip_hash, country, country_code, region, city, device, os, browser, referrer, is_bot, is_unique, latency_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             ON CONFLICT (id) DO NOTHING`,
            [
              clickId,
              id || null,
              code || null,
              click.ip_hash || 'ip_anon',
              resolvedCountry,
              resolvedCode,
              resolvedRegion || null,
              resolvedCity,
              click.device || 'mobile',
              click.os || 'iOS',
              click.browser || 'Safari',
              click.referrer || 'Direct / Mobile',
              !!click.is_bot,
              click.is_unique ?? true,
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
              click.ip_hash || 'ip_anon',
              resolvedCountry,
              resolvedCode,
              resolvedCity,
              click.device || 'mobile',
              click.os || 'iOS',
              click.browser || 'Safari',
              click.referrer || 'Direct / Mobile',
              !!click.is_bot,
              click.is_unique ?? true,
              click.latency_ms || 20
            ]
          );
        }
      }
    } catch (dbErr) {
      console.warn('DB tracking warning:', dbErr);
    }

    // 2. Update Edge cache
    if (code) {
      const cached = linkCache.get<Link>(`link_${code}`);
      if (cached && typeof cached === 'object') {
        cached.clicks_count = (cached.clicks_count || 0) + 1;
        linkCache.set(`link_${code}`, cached, 180);
      }
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
