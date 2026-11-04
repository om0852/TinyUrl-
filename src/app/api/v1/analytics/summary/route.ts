import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { verifyWorkspacePermission } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const MAX_RANGE_MS = 400 * 86400 * 1000;

/** IANA zone like "Asia/Kolkata"; anything else falls back to UTC */
function cleanTimeZone(raw: string | null): string {
  const tz = (raw || '').trim();
  if (!tz || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(tz)) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

function parseInstant(raw: string | null, fallback: number): Date {
  const t = raw ? Date.parse(raw) : NaN;
  return new Date(Number.isNaN(t) ? fallback : t);
}

/**
 * Dashboard analytics computed in the database over every click in the range, not over a sample
 * of recent rows. Bots are excluded from every figure. Days and hours are bucketed in the viewer's
 * time zone (?tz=), and the range is half-open: from <= timestamp < to.
 *
 * GET /api/v1/analytics/summary?workspace_id=&from=ISO&to=ISO&tz=Asia/Kolkata
 *   [&link_id=] [&campaign_id=] [&series=hour|day&series_from=ISO]
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = (searchParams.get('workspace_id') || '').trim();
  if (!workspaceId) {
    return NextResponse.json({ success: false, error: 'Query parameter "workspace_id" is required.' }, { status: 400 });
  }
  const auth = await verifyWorkspacePermission(request, 'analytics:read', { workspaceId });
  if (!auth.success) return auth.response;

  const now = Date.now();
  const to = parseInstant(searchParams.get('to'), now);
  let from = parseInstant(searchParams.get('from'), now - 30 * 86400 * 1000);
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) from = new Date(to.getTime() - MAX_RANGE_MS);
  if (from >= to) {
    return NextResponse.json({ success: false, error: '"from" must be before "to".' }, { status: 400 });
  }
  const tz = cleanTimeZone(searchParams.get('tz'));
  const linkId = (searchParams.get('link_id') || '').trim() || null;
  const campaignId = (searchParams.get('campaign_id') || '').trim() || null;
  const series = searchParams.get('series') === 'hour' ? 'hour' : 'day';
  const seriesFrom = new Date(Math.max(from.getTime(), parseInstant(searchParams.get('series_from'), from.getTime()).getTime()));

  try {
    const rows = (await sql.query(
      `WITH scoped AS (
         SELECT c.id, l.id AS lid, c.timestamp, c.ip_hash, c.referrer, c.device, c.os, c.country,
                c.city, c.short_code
         FROM click_events c
         JOIN links l ON (c.link_id = l.id OR (c.link_id IS NULL AND LOWER(c.short_code) = LOWER(l.short_code)))
         WHERE l.workspace_id = $1
           AND ($2::text IS NULL OR l.id = $2)
           AND ($3::text IS NULL OR l.campaign_id = $3)
           AND c.timestamp >= $4 AND c.timestamp < $5
           AND NOT COALESCE(c.is_bot, false)
       )
       SELECT
         (SELECT COUNT(*) FROM scoped)::int AS total_clicks,
         (SELECT COUNT(DISTINCT COALESCE(NULLIF(ip_hash, ''), id)) FROM scoped)::int AS unique_visitors,
         (SELECT COALESCE(json_agg(t), '[]') FROM (
            SELECT lid AS link_id, COUNT(*)::int AS clicks FROM scoped GROUP BY lid
          ) t) AS per_link,
         (SELECT COALESCE(json_agg(t), '[]') FROM (
            SELECT COALESCE(referrer, '') AS referrer, COUNT(*)::int AS clicks
            FROM scoped GROUP BY 1 ORDER BY clicks DESC LIMIT 300
          ) t) AS referrers,
         (SELECT COALESCE(json_agg(t), '[]') FROM (
            SELECT LOWER(COALESCE(device, '')) AS device, COUNT(*)::int AS clicks FROM scoped GROUP BY 1
          ) t) AS devices,
         (SELECT COALESCE(json_agg(t), '[]') FROM (
            SELECT COALESCE(NULLIF(os, ''), 'Unknown') AS os, COUNT(*)::int AS clicks
            FROM scoped GROUP BY 1 ORDER BY clicks DESC LIMIT 10
          ) t) AS operating_systems,
         (SELECT COALESCE(json_agg(t), '[]') FROM (
            SELECT COALESCE(NULLIF(country, ''), 'Unknown') AS country, COUNT(*)::int AS clicks
            FROM scoped GROUP BY 1 ORDER BY clicks DESC LIMIT 20
          ) t) AS countries,
         (SELECT COALESCE(json_agg(t), '[]') FROM (
            SELECT EXTRACT(HOUR FROM timestamp AT TIME ZONE $6)::int AS hour, COUNT(*)::int AS clicks
            FROM scoped GROUP BY 1
          ) t) AS hourly,
         (SELECT COALESCE(json_agg(t), '[]') FROM (
            SELECT CASE WHEN $7 = 'hour'
                     THEN to_char(date_trunc('hour', timestamp AT TIME ZONE $6), 'YYYY-MM-DD"T"HH24')
                     ELSE to_char(timestamp AT TIME ZONE $6, 'YYYY-MM-DD') END AS bucket,
                   COUNT(*)::int AS clicks
            FROM scoped WHERE timestamp >= $8 GROUP BY 1
          ) t) AS series,
         (SELECT COALESCE(json_agg(t), '[]') FROM (
            SELECT id, lid AS link_id, short_code, timestamp, country, city, device, os, referrer
            FROM scoped ORDER BY timestamp DESC LIMIT 8
          ) t) AS recent`,
      [workspaceId, linkId, campaignId, from.toISOString(), to.toISOString(), tz, series, seriesFrom.toISOString()]
    )) as Record<string, unknown>[];

    const r = rows?.[0] || {};
    return NextResponse.json({
      success: true,
      range: { from: from.toISOString(), to: to.toISOString(), tz },
      total_clicks: Number(r.total_clicks) || 0,
      unique_visitors: Number(r.unique_visitors) || 0,
      per_link: r.per_link || [],
      referrers: r.referrers || [],
      devices: r.devices || [],
      operating_systems: r.operating_systems || [],
      countries: r.countries || [],
      hourly: r.hourly || [],
      series: { unit: series, from: seriesFrom.toISOString(), buckets: r.series || [] },
      recent: r.recent || []
    });
  } catch (err) {
    console.error('Analytics summary error:', err);
    return NextResponse.json({ success: false, error: 'Analytics are unavailable right now.' }, { status: 500 });
  }
}
