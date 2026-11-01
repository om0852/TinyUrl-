import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';
import { isSafeOutboundUrl } from '@/lib/security';
import { verifyWorkspacePermission } from '@/lib/serverAuth';
import { evictCustomDomainCache } from '@/lib/linkCacheEviction';

interface AuditLinkRow {
  id: string;
  workspace_id?: string | null;
  domain_id?: string | null;
  short_code: string;
  custom_slug?: string | null;
  destination_url: string;
  is_flagged?: boolean | null;
  risk_score?: number | string | null;
  status?: string | null;
}

export interface SecurityAuditResult {
  link_id: string;
  short_code: string;
  destination_url: string;
  target_host: string;
  status_code: number;
  http_status: string;
  latency_ms: number;
  ssl_valid: boolean;
  ssl_status: string;
  /** Destination answered with a non-error status */
  reachable: boolean;
  /** Phishing pattern or blocked (private network) destination; these links get flagged */
  is_threat: boolean;
  /** Kept for older clients: same as !is_threat */
  is_safe: boolean;
  risk_score: number;
  threat_flags: string[];
  /** Link status after the scan */
  status: string;
}

const MAX_LINKS_PER_SCAN = 100;
const PROBE_TIMEOUT_MS = 4000;

const SUSPICIOUS_PATTERNS = [
  /phish/i,
  /account[-_.]?verif/i,
  /secure[-_.]?login/i,
  /update[-_.]?banking/i,
  /free[-_.]?crypto/i,
  /metamask[-_.]?claim/i,
  /bit\.ly\/quarantine/i
];

// Many sites reject HEAD or bot user agents (405/403/501) while serving browsers normally,
// so those answers are retried with GET before the destination counts as unhealthy.
async function probe(url: string): Promise<{ status: number; statusText: string; latency: number; error?: string }> {
  const started = Date.now();
  const attempt = async (method: 'HEAD' | 'GET') => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8'
        },
        signal: controller.signal,
        redirect: 'manual'
      });
      // Only the status line matters; don't download the page
      res.body?.cancel().catch(() => {});
      return res;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    let res = await attempt('HEAD');
    if ([400, 403, 405, 501].includes(res.status)) res = await attempt('GET');
    return { status: res.status, statusText: res.statusText, latency: Math.max(1, Date.now() - started) };
  } catch (err: unknown) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      status: aborted ? 504 : 502,
      statusText: aborted ? 'Timeout' : 'Unreachable',
      latency: Math.max(1, Date.now() - started),
      error: aborted ? 'Timed out' : 'Could not connect'
    };
  }
}

// Tells the workspace's webhooks (subscribed to link.flagged or security.alert) about links this
// scan newly flagged. Signed the same way as the test ping in /api/v1/webhooks/test.
async function notifyFlagged(wsId: string, flagged: SecurityAuditResult[]) {
  if (flagged.length === 0) return;
  const hooks = (await sql.query(
    `SELECT url, secret, events FROM webhooks WHERE workspace_id = $1 AND is_active IS NOT FALSE`,
    [wsId]
  ).catch(() => [])) as unknown as { url: string; secret?: string | null; events?: string | string[] | null }[];
  await Promise.allSettled((hooks || []).map(async (hook) => {
    let events: string[] = [];
    try { events = typeof hook.events === 'string' ? JSON.parse(hook.events) : (hook.events || []); } catch {}
    const event = events.includes('link.flagged') ? 'link.flagged' : events.includes('security.alert') ? 'security.alert' : null;
    if (!event || !isSafeOutboundUrl(hook.url).safe) return;
    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: flagged.map(r => ({
        id: r.link_id,
        short_code: r.short_code,
        destination_url: r.destination_url,
        risk_score: r.risk_score,
        reasons: r.threat_flags,
        workspace_id: wsId
      }))
    });
    const signature = crypto.createHmac('sha256', hook.secret || '').update(body).digest('hex');
    await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TinyUrl-Webhooks/1.0',
        'X-Signature-SHA256': signature,
        'X-Hub-Signature-256': `sha256=${signature}`,
        'X-Event': event,
        'X-TinyUrl-Delivery': `del_${crypto.randomUUID()}`
      },
      body,
      signal: AbortSignal.timeout(4000)
    });
  }));
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { workspace_id, link_ids } = body as { workspace_id?: string; link_ids?: unknown };

    // A scan rewrites risk scores and flags, so it always needs a workspace and links:edit
    // (scans without a workspace used to run unauthenticated across every workspace)
    const targetWs = (workspace_id || request.headers.get('x-workspace-id') || '').trim();
    if (!targetWs) {
      return NextResponse.json({ success: false, error: 'workspace_id is required.' }, { status: 400 });
    }
    const authResult = await verifyWorkspacePermission(request, 'links:edit', { workspaceId: targetWs });
    if (!authResult.success) return authResult.response;
    const wsId = authResult.context.workspaceId;

    const ids = Array.isArray(link_ids)
      ? link_ids.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, MAX_LINKS_PER_SCAN)
      : [];
    const columns = 'id, workspace_id, domain_id, short_code, custom_slug, destination_url, is_flagged, risk_score, status';
    const links = (ids.length > 0
      ? await sql.query(`SELECT ${columns} FROM links WHERE workspace_id = $1 AND id = ANY($2::text[])`, [wsId, ids])
      : await sql.query(`SELECT ${columns} FROM links WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT ${MAX_LINKS_PER_SCAN}`, [wsId])
    ) as unknown as AuditLinkRow[];

    if (!links || links.length === 0) {
      return NextResponse.json({ success: true, scanned_count: 0, threats_detected: 0, unreachable_count: 0, results: [] });
    }

    const results: SecurityAuditResult[] = await Promise.all(
      links.map(async (l) => {
        let host = 'invalid-url';
        try { host = new URL(l.destination_url).hostname; } catch {}

        const isHttps = /^https:\/\//i.test(l.destination_url);
        const threatFlags: string[] = [];
        for (const pattern of SUSPICIOUS_PATTERNS) {
          if (pattern.test(l.destination_url)) threatFlags.push(`Suspicious keyword pattern: ${pattern.source}`);
        }

        let statusCode: number;
        let httpStatus: string;
        let latencyMs = 0;
        const safeOutbound = isSafeOutboundUrl(l.destination_url);
        if (!safeOutbound.safe) {
          threatFlags.push(`Blocked destination: ${safeOutbound.reason}`);
          statusCode = 403;
          httpStatus = '403 Blocked (private network)';
        } else {
          const result = await probe(l.destination_url);
          statusCode = result.status;
          httpStatus = `${result.status} ${result.statusText || ''}`.trim();
          latencyMs = result.latency;
        }

        const isThreat = threatFlags.length > 0;
        const reachable = statusCode < 400;

        let riskScore = 0;
        if (isThreat) riskScore += 60;
        if (!isHttps) riskScore += 20;
        if (!reachable) riskScore += 20;
        riskScore = Math.min(100, riskScore);

        // Only threats flag a link. An unreachable destination is reported, not quarantined:
        // flagged links show a warning page instead of redirecting, and HEAD checks fail on
        // plenty of healthy sites. Paused, disabled and expired links keep their status.
        const prevStatus = l.status || 'active';
        const nextStatus = isThreat
          ? 'flagged'
          : prevStatus === 'flagged' ? 'active' : prevStatus;

        try {
          await sql.query(
            `UPDATE links SET risk_score = $1, is_flagged = $2, status = $3, updated_at = NOW()
             WHERE id = $4 AND workspace_id = $5`,
            [riskScore, isThreat, nextStatus, l.id, wsId]
          );
          const codes = [l.short_code, l.custom_slug];
          for (const code of codes) if (code) await linkCache.delete(`link_${code.toLowerCase()}`);
          await evictCustomDomainCache(l, codes);
        } catch (dbErr) {
          console.warn('DB update failed for audit row:', dbErr);
        }

        return {
          link_id: l.id,
          short_code: l.short_code,
          destination_url: l.destination_url,
          target_host: host,
          status_code: statusCode,
          http_status: httpStatus,
          latency_ms: latencyMs,
          ssl_valid: isHttps,
          ssl_status: isHttps ? 'HTTPS' : 'HTTP',
          reachable,
          is_threat: isThreat,
          is_safe: !isThreat,
          risk_score: riskScore,
          threat_flags: threatFlags,
          status: nextStatus
        };
      })
    );

    const prevFlagged = new Set(links.filter(l => l.is_flagged || l.status === 'flagged').map(l => l.id));
    await notifyFlagged(wsId, results.filter(r => r.is_threat && !prevFlagged.has(r.link_id)));

    return NextResponse.json({
      success: true,
      scanned_count: results.length,
      threats_detected: results.filter(r => r.is_threat).length,
      unreachable_count: results.filter(r => !r.reachable && !r.is_threat).length,
      results
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Security audit service error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-workspace-id, x-user-email'
    }
  });
}
