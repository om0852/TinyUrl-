import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

type Alert = { level: 'warning' | 'critical'; check: string; message: string };

// Per-bucket limits, as set where each limiter runs (middleware, auth, /api/mcp, unlock)
const LIMITS: [prefix: string, limit: number, label: string][] = [
  ['api:ip:', 300, 'visitors hit the API rate limit'],
  ['auth:ip:', 20, 'IPs hit the login limit (password guessing?)'],
  ['auth:email:', 10, 'accounts hit the login limit (password guessing?)'],
  ['mcp:ip:', 120, 'IPs hit the MCP limit'],
  ['mcp:key:', 60, 'API keys hit the MCP limit'],
];

function authorized(request: Request): boolean {
  const secret = process.env.ALERT_SECRET || '';
  const header = request.headers.get('authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!secret || !given) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Health checks for the scheduled monitor (.github/workflows/monitor.yml). Returns the problems of
 * the last hour; the monitor fails, and GitHub emails you, when the list is not empty.
 * Needs ALERT_SECRET in the environment; without it the endpoint doesn't exist (404).
 */
export async function GET(request: Request) {
  if (!process.env.ALERT_SECRET) return new NextResponse('Not found', { status: 404 });
  if (!authorized(request)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const alerts: Alert[] = [];
  const run = async (check: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      alerts.push({ level: 'warning', check, message: `Check failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  // 1. Click spike: last hour against the hourly average of the 7 days before it
  await run('click_spike', async () => {
    const rows = (await sql.query(`
      SELECT
        COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '1 hour' AND NOT COALESCE(is_bot, false))::int AS last_hour,
        COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '1 hour' AND COALESCE(is_bot, false))::int AS last_hour_bots,
        (COUNT(*) FILTER (WHERE timestamp < NOW() - INTERVAL '1 hour' AND NOT COALESCE(is_bot, false)) / 168.0)::float AS hourly_avg
      FROM click_events
      WHERE timestamp >= NOW() - INTERVAL '169 hours'
    `)) as { last_hour: number; last_hour_bots: number; hourly_avg: number }[];
    const r = rows?.[0];
    if (!r) return;
    const lastHour = Number(r.last_hour) || 0;
    const avg = Number(r.hourly_avg) || 0;
    if (lastHour >= Math.max(100, avg * 10)) {
      alerts.push({ level: 'warning', check: 'click_spike', message: `${lastHour} clicks in the last hour, about ${Math.round(lastHour / Math.max(avg, 1))}x the usual ${avg.toFixed(1)} an hour.` });
    }
    const bots = Number(r.last_hour_bots) || 0;
    if (bots >= 100 && bots > lastHour * 4) {
      alerts.push({ level: 'warning', check: 'bot_traffic', message: `${bots} bot clicks in the last hour against ${lastHour} real ones.` });
    }
  });

  // 2. One link taking a burst (scripted clicks, or a post going viral)
  await run('link_spike', async () => {
    const rows = (await sql.query(`
      SELECT short_code, COUNT(*)::int AS clicks
      FROM click_events
      WHERE timestamp >= NOW() - INTERVAL '1 hour' AND NOT COALESCE(is_bot, false)
      GROUP BY short_code ORDER BY clicks DESC LIMIT 1
    `)) as { short_code: string; clicks: number }[];
    const top = rows?.[0];
    if (top && Number(top.clicks) >= 200) {
      alerts.push({ level: 'warning', check: 'link_spike', message: `/${top.short_code} got ${top.clicks} clicks in the last hour.` });
    }
  });

  // 3. Rate limits being hit: abuse, brute force, or a limit set too low for real traffic
  await run('rate_limits', async () => {
    const rows = (await sql.query(`
      SELECT bucket, MAX(hits)::int AS hits
      FROM rate_limits
      WHERE window_start >= NOW() - INTERVAL '1 hour'
      GROUP BY bucket
    `).catch(() => [])) as { bucket: string; hits: number }[];
    for (const [prefix, limit, label] of LIMITS) {
      const over = (rows || []).filter(r => r.bucket.startsWith(prefix) && Number(r.hits) > limit).length;
      if (over > 0) {
        alerts.push({ level: prefix.startsWith('auth') ? 'critical' : 'warning', check: 'rate_limits', message: `${over} ${label} in the last hour.` });
      }
    }
  });

  // 4. MCP tool calls failing (a broken integration, or someone probing with a key)
  await run('mcp_errors', async () => {
    const rows = (await sql.query(`
      SELECT COUNT(*)::int AS errors FROM mcp_audit_log
      WHERE created_at >= NOW() - INTERVAL '1 hour' AND is_error
    `).catch(() => [])) as { errors: number }[];
    const errors = Number(rows?.[0]?.errors) || 0;
    if (errors >= 20) {
      alerts.push({ level: 'warning', check: 'mcp_errors', message: `${errors} MCP tool calls failed in the last hour.` });
    }
  });

  return NextResponse.json({ success: true, checked_at: new Date().toISOString(), ok: alerts.length === 0, alerts });
}
