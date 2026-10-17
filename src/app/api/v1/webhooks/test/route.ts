import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/postgres';
import { verifyWorkspacePermission } from '@/lib/serverAuth';

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const { webhook_id, url: providedUrl, secret: providedSecret, workspace_id } = body;

    let targetUrl = (providedUrl || '').trim();
    let targetSecret = (providedSecret || 'whsec_sample').trim();
    const wsId = (workspace_id || request.headers.get('x-workspace-id') || 'ws_default').trim();

    // Verify RBAC permission (requires api_keys:manage)
    const authResult = await verifyWorkspacePermission(request, 'api_keys:manage', {
      workspaceId: wsId,
      webhookId: webhook_id
    });
    if (!authResult.success) {
      return authResult.response;
    }

    if (webhook_id && (!targetUrl || targetUrl.includes('••••'))) {
      const rows = (await sql.query(
        `SELECT id, url, secret FROM webhooks WHERE id = $1 LIMIT 1`,
        [webhook_id.trim()]
      ).catch(() => [])) as Array<{ id: string; url: string; secret?: string | null }>;

      if (rows && rows.length > 0) {
        targetUrl = rows[0].url;
        if (rows[0].secret) targetSecret = rows[0].secret;
      }
    }

    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return NextResponse.json({
        success: false,
        error: 'A valid HTTP/HTTPS destination URL is required for webhook testing.'
      }, { status: 400 });
    }

    const testPayload = {
      event: 'link.created',
      timestamp: new Date().toISOString(),
      test: true,
      data: {
        id: `link_test_${crypto.randomUUID().slice(0, 8)}`,
        short_code: 'sample-test',
        short_url: `${targetUrl.replace(/\/+$/, '')}/sample-test`,
        destination_url: 'https://tinyurl.dev/docs',
        workspace_id: wsId,
        title: 'Developer Test Ping',
        created_at: new Date().toISOString()
      }
    };

    const bodyString = JSON.stringify(testPayload);
    const signature = crypto.createHmac('sha256', targetSecret).update(bodyString).digest('hex');

    try {
      const pingResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TinyUrl-Webhooks-TestPing/1.0',
          'X-Signature-SHA256': signature,
          'X-Hub-Signature-256': `sha256=${signature}`,
          'X-Event': 'link.created',
          'X-TinyUrl-Delivery': `del_${crypto.randomUUID()}`
        },
        body: bodyString,
        signal: AbortSignal.timeout(4000)
      });

      const elapsed = Date.now() - start;

      return NextResponse.json({
        success: pingResponse.ok,
        status_code: pingResponse.status,
        status_text: pingResponse.statusText || (pingResponse.ok ? 'OK' : 'Error'),
        latency_ms: elapsed,
        url: targetUrl,
        signature: `sha256=${signature.slice(0, 12)}...`,
        message: pingResponse.ok 
          ? `Ping delivered successfully to ${targetUrl} (HTTP ${pingResponse.status})`
          : `Target returned HTTP ${pingResponse.status} ${pingResponse.statusText}`
      });
    } catch (netErr: unknown) {
      const elapsed = Date.now() - start;
      const errMsg = netErr instanceof Error ? netErr.message : 'Connection failed';
      
      // If it's a dummy or unreachable domain (e.g. example.com or local placeholder),
      // provide descriptive diagnostic information so the user understands the exact networking state.
      return NextResponse.json({
        success: false,
        status_code: 504,
        status_text: 'Gateway Timeout / Unreachable',
        latency_ms: elapsed,
        url: targetUrl,
        error: `Could not reach ${targetUrl}: ${errMsg}. Make sure your endpoint is publicly reachable or use ngrok/webhook.site for testing.`
      });
    }

  } catch (err: unknown) {
    const elapsed = Date.now() - start;
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({
      success: false,
      status_code: 500,
      latency_ms: elapsed,
      error: msg
    }, { status: 500 });
  }
}
