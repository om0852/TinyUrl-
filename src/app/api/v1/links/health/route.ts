import { NextResponse } from 'next/server';
import { sql, initializeDatabase } from '@/lib/postgres';
import { safeFetch } from '@/lib/safeFetch';
import { verifyWorkspacePermission } from '@/lib/serverAuth';

interface HealthCheckResult {
  link_id: string;
  short_code: string;
  custom_slug?: string;
  destination_url: string;
  status: 'active' | 'broken';
  status_code: number;
  reason: string;
  latency_ms: number;
}

async function probeUrl(targetUrl: string): Promise<{ statusCode: number; reason: string; latencyMs: number; isHealthy: boolean }> {
  const startTime = Date.now();
  let cleanUrl = targetUrl.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    let res: Response;
    try {
      res = await safeFetch(cleanUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TinyUrlHealthBot/2.0; +https://tinyurl.dev/bot)'
        },
        signal: controller.signal,
        redirect: 'follow'
      });
    } catch (headErr) {
      // Some web servers reject HEAD requests; fallback to GET
      res = await safeFetch(cleanUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TinyUrlHealthBot/2.0; +https://tinyurl.dev/bot)'
        },
        signal: controller.signal,
        redirect: 'follow'
      });
    }

    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;
    const statusCode = res.status;

    if (statusCode >= 200 && statusCode < 400) {
      return {
        statusCode,
        reason: 'Healthy destination endpoint',
        latencyMs,
        isHealthy: true
      };
    }

    if (statusCode === 404) {
      return {
        statusCode,
        reason: 'HTTP 404 (Page Not Found / Dead Link)',
        latencyMs,
        isHealthy: false
      };
    }

    if (statusCode === 410) {
      return {
        statusCode,
        reason: 'HTTP 410 (Resource Permanently Gone)',
        latencyMs,
        isHealthy: false
      };
    }

    if (statusCode === 401 || statusCode === 403) {
      return {
        statusCode,
        reason: `HTTP ${statusCode} (Access Denied / Paywalled)`,
        latencyMs,
        isHealthy: false
      };
    }

    if (statusCode >= 500) {
      return {
        statusCode,
        reason: `HTTP ${statusCode} (Destination Server Outage / Gateway Error)`,
        latencyMs,
        isHealthy: false
      };
    }

    return {
      statusCode,
      reason: `HTTP ${statusCode} Response`,
      latencyMs,
      isHealthy: statusCode < 400
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err?.name === 'AbortError' || String(err).includes('abort');
    const isDns = String(err).includes('ENOTFOUND') || String(err).includes('EAI_AGAIN');

    const statusCode = isTimeout ? 504 : isDns ? 502 : 500;
    const reason = isTimeout
      ? 'Connection timed out (>4000ms)'
      : isDns
        ? 'DNS Resolution Failure (Domain unreachable)'
        : 'Host Connection Refused / SSL Handshake Error';

    return {
      statusCode,
      reason,
      latencyMs,
      isHealthy: false
    };
  }
}

export async function GET(request: Request) {
  try {
    await initializeDatabase();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id') || request.headers.get('x-workspace-id');

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'Query parameter "workspace_id" is required.' }, { status: 400 });
    }

    const authResult = await verifyWorkspacePermission(request, 'analytics:read', {
      workspaceId: workspaceId.trim()
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const rows = await sql.query(
      `SELECT id, short_code, custom_slug, title, destination_url, status, broken_code, broken_reason, last_health_check, clicks_count
       FROM links
       WHERE workspace_id = $1
       ORDER BY (CASE WHEN status = 'broken' THEN 0 ELSE 1 END), clicks_count DESC`,
      [workspaceId]
    );

    const linksList = Array.isArray(rows) ? rows : [];
    const brokenLinks = linksList.filter((l: any) => l.status === 'broken' || (l.broken_code && l.broken_code >= 400));

    return NextResponse.json({
      success: true,
      total_links: linksList.length,
      healthy_count: linksList.length - brokenLinks.length,
      broken_count: brokenLinks.length,
      broken_links: brokenLinks.map((l: any) => ({
        id: l.id,
        short_code: l.short_code,
        custom_slug: l.custom_slug,
        title: l.title,
        destination_url: l.destination_url,
        broken_code: l.broken_code,
        broken_reason: l.broken_reason,
        last_health_check: l.last_health_check,
        clicks_count: l.clicks_count
      }))
    });
  } catch (error) {
    console.error('Error fetching broken links summary:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await initializeDatabase();
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // empty
    }

    const workspaceId = body.workspace_id || request.headers.get('x-workspace-id');
    const linkId = body.link_id;

    if (!workspaceId && !linkId) {
      return NextResponse.json(
        { success: false, error: 'Either "workspace_id" or "link_id" is required to run health checks.' },
        { status: 400 }
      );
    }

    const authResult = await verifyWorkspacePermission(request, 'links:edit', {
      workspaceId: workspaceId ? String(workspaceId).trim() : undefined,
      linkId: linkId ? String(linkId).trim() : undefined
    });
    if (!authResult.success) {
      return authResult.response;
    }

    let linksToProbe: any[] = [];
    if (linkId) {
      linksToProbe = await sql.query(
        `SELECT id, short_code, custom_slug, destination_url, status, workspace_id FROM links WHERE id = $1 LIMIT 1`,
        [linkId]
      );
    } else {
      linksToProbe = await sql.query(
        `SELECT id, short_code, custom_slug, destination_url, status, workspace_id FROM links WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [workspaceId]
      );
    }

    if (!linksToProbe || linksToProbe.length === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        broken_count: 0,
        results: []
      });
    }

    const results: HealthCheckResult[] = [];

    // Probe sequentially or in parallel batches
    for (const link of linksToProbe) {
      const probe = await probeUrl(link.destination_url);
      const newStatus = probe.isHealthy ? 'active' : 'broken';
      const brokenCode = probe.isHealthy ? null : probe.statusCode;
      const brokenReason = probe.isHealthy ? null : probe.reason;

      // Update link record in database
      await sql.query(
        // Only toggles active <-> broken; disabled, expired and flagged links keep their status
        `UPDATE links
         SET status = CASE WHEN status IN ('active', 'broken') OR status IS NULL THEN $1 ELSE status END,
             broken_code = $2,
             broken_reason = $3,
             last_health_check = NOW()
         WHERE id = $4`,
        [newStatus, brokenCode, brokenReason, link.id]
      );

      results.push({
        link_id: link.id,
        short_code: link.short_code,
        custom_slug: link.custom_slug,
        destination_url: link.destination_url,
        status: newStatus,
        status_code: probe.statusCode,
        reason: probe.reason,
        latency_ms: probe.latencyMs
      });
    }

    const brokenList = results.filter(r => r.status === 'broken');

    return NextResponse.json({
      success: true,
      checked: results.length,
      healthy_count: results.length - brokenList.length,
      broken_count: brokenList.length,
      broken_links: brokenList,
      results
    });
  } catch (error) {
    console.error('Error executing link health checks:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error during health check.' },
      { status: 500 }
    );
  }
}
