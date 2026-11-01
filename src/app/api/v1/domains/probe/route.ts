import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { verifyWorkspacePermission } from '@/lib/serverAuth';
import { safeFetch } from '@/lib/safeFetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ success: false, error: 'Domain parameter is required' }, { status: 400 });
    }

    const cleanHost = domain.trim().toLowerCase()
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '');

    // Allow platform domains automatically
    if (
      cleanHost === 'localhost' ||
      cleanHost === '127.0.0.1' ||
      cleanHost.endsWith('.vercel.app') ||
      cleanHost === 'tinyurl.dev' ||
      cleanHost === 'creataurus.work.gd'
    ) {
      return NextResponse.json({
        success: true,
        domain: cleanHost,
        ssl_active: true,
        reachable: true,
        status: 'active',
        message: 'Platform domain active with verified SSL'
      });
    }

    // Only a domain registered in the caller's workspace can be probed, by someone who manages
    // domains there (this was an open, unauthenticated way to make the server fetch any host)
    const auth = await verifyWorkspacePermission(request, 'domains:manage', { domainId: cleanHost });
    if (!auth.success) return auth.response;
    const registered = (await sql.query(
      `SELECT 1 FROM domains WHERE LOWER(hostname) = $1 AND workspace_id = $2 LIMIT 1`,
      [cleanHost, auth.context.workspaceId]
    ).catch(() => [])) as unknown[];
    if (registered.length === 0) {
      return NextResponse.json({ success: false, error: 'Domain not found in this workspace.' }, { status: 404 });
    }

    // Perform live HTTPS TLS probe with 3.5s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    let sslActive = false;
    let reachable = false;
    let httpStatus = 0;
    let errorDetail = '';

    try {
      const probeRes = await safeFetch(`https://${cleanHost}`, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': 'TinyURL-Domain-HealthCheck/1.0' },
        cache: 'no-store'
      });
      clearTimeout(timeout);
      httpStatus = probeRes.status;
      sslActive = true;
      reachable = true;
    } catch (err: unknown) {
      clearTimeout(timeout);
      const errMsg = err instanceof Error ? err.message : String(err);
      errorDetail = errMsg;
      if (errMsg.toLowerCase().includes('abort') || errMsg.toLowerCase().includes('timeout')) {
        errorDetail = 'Connection timed out during SSL handshake. DNS or proxy may still be propagating.';
      } else if (errMsg.toLowerCase().includes('certificate') || errMsg.toLowerCase().includes('ssl')) {
        errorDetail = 'SSL certificate handshake failed. Certificate is still being issued.';
      }
    }

    return NextResponse.json({
      success: true,
      domain: cleanHost,
      ssl_active: sslActive,
      reachable: reachable,
      http_status: httpStatus || undefined,
      status: sslActive ? 'active' : 'pending',
      message: sslActive
        ? 'SSL certificate is active and Edge proxy is responding.'
        : `SSL pending: ${errorDetail || 'Domain has not completed SSL issuance.'}`
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Probe error';
    return NextResponse.json({ success: false, error: msg, ssl_active: false }, { status: 500 });
  }
}
