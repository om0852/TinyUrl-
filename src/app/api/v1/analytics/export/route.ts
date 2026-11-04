import { sql } from '@/lib/postgres';
import { verifyWorkspacePermission } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 100_000;

const csvField = (value: unknown) => {
  let text = value === null || value === undefined ? '' : String(value);
  // Spreadsheet formula injection: a visitor-supplied referrer like "=HYPERLINK(...)" must stay text
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

/**
 * Every non-bot click in the range as CSV (the dashboard used to export only the rows it had
 * loaded, at most 5000). Same filters as /api/v1/analytics/summary; capped at 100,000 rows.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = (searchParams.get('workspace_id') || '').trim();
  if (!workspaceId) return new Response('workspace_id is required', { status: 400 });
  const auth = await verifyWorkspacePermission(request, 'export:data', { workspaceId });
  if (!auth.success) return auth.response;

  const now = Date.now();
  const toRaw = Date.parse(searchParams.get('to') || '');
  const fromRaw = Date.parse(searchParams.get('from') || '');
  const to = new Date(Number.isNaN(toRaw) ? now : toRaw);
  const from = new Date(Number.isNaN(fromRaw) ? now - 30 * 86400 * 1000 : fromRaw);
  const linkId = (searchParams.get('link_id') || '').trim() || null;
  const campaignId = (searchParams.get('campaign_id') || '').trim() || null;

  const rows = (await sql.query(
    `SELECT c.timestamp, c.short_code, l.destination_url, c.referrer, c.country, c.region, c.city,
            c.device, c.os, c.browser, c.language, c.utm_source, c.utm_medium, c.utm_campaign
     FROM click_events c
     JOIN links l ON (c.link_id = l.id OR (c.link_id IS NULL AND LOWER(c.short_code) = LOWER(l.short_code)))
     WHERE l.workspace_id = $1
       AND ($2::text IS NULL OR l.id = $2)
       AND ($3::text IS NULL OR l.campaign_id = $3)
       AND c.timestamp >= $4 AND c.timestamp < $5
       AND NOT COALESCE(c.is_bot, false)
     ORDER BY c.timestamp DESC
     LIMIT ${MAX_ROWS}`,
    [workspaceId, linkId, campaignId, from.toISOString(), to.toISOString()]
  ).catch(() => null)) as Record<string, unknown>[] | null;
  if (!rows) return new Response('Export failed, try again.', { status: 500 });

  const header = ['Timestamp (UTC)', 'Short code', 'Destination URL', 'Referrer', 'Country', 'Region', 'City', 'Device', 'OS', 'Browser', 'Language', 'UTM source', 'UTM medium', 'UTM campaign'];
  const lines = [header.map(csvField).join(',')];
  for (const r of rows) {
    lines.push([
      r.timestamp ? new Date(String(r.timestamp)).toISOString() : '',
      r.short_code, r.destination_url, r.referrer || 'Direct', r.country, r.region, r.city,
      r.device, r.os, r.browser, r.language, r.utm_source, r.utm_medium, r.utm_campaign
    ].map(csvField).join(','));
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clicks-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
      'X-Row-Count': String(rows.length),
      'X-Row-Limit-Reached': rows.length >= MAX_ROWS ? '1' : '0'
    }
  });
}
