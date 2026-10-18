import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dns from 'dns';
import { sql } from '@/lib/postgres';
import { Domain } from '@/lib/types';
import { verifyWorkspacePermission } from '@/lib/serverAuth';
import { 
  addCustomHostnameToCloudflare, 
  getCustomHostnameFromCloudflare, 
  removeCustomHostnameFromCloudflare, 
  isCloudflareConfigured,
  getCloudflareCnameTarget 
} from '@/lib/cloudflare';
import { 
  addDomainToVercel, 
  verifyDomainOnVercel, 
  removeDomainFromVercel, 
  isVercelConfigured 
} from '@/lib/vercel';

interface RawDomainRow {
  id: string;
  workspace_id?: string | null;
  hostname: string;
  verified?: boolean | null;
  ssl_status?: string | null;
  is_primary?: boolean | null;
  verify_token?: string | null;
  ownership_verified?: boolean | null;
  routing_verified?: boolean | null;
  root_redirect_url?: string | null;
  created_by?: string | null;
  created_at?: string | null;
}

const RESERVED_DOMAINS = new Set([
  'tinyurl.dev',
  'tiny-url-self.vercel.app',
  'localhost',
  '127.0.0.1',
  'vercel.app',
  'cname.vercel-dns.com'
]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id') || request.headers.get('x-workspace-id');

    let rows: RawDomainRow[] = [];
    if (workspaceId) {
      rows = (await sql.query(
        `SELECT * FROM domains WHERE workspace_id = $1 ORDER BY created_at DESC`,
        [workspaceId.trim()]
      )) as unknown as RawDomainRow[];
    } else {
      // Security Guard: Prevent unauthenticated full system domain enumeration
      return NextResponse.json({
        success: true,
        total: 0,
        domains: []
      });
    }

    const formatted: Domain[] = (rows || []).map(r => ({
      id: r.id,
      workspace_id: r.workspace_id || 'ws_default',
      hostname: r.hostname,
      verified: !!r.verified,
      ssl_status: (r.ssl_status as 'active' | 'pending' | 'failed') || (r.verified ? 'active' : 'pending'),
      is_default: !!r.is_primary,
      verify_token: r.verify_token || undefined,
      ownership_verified: !!r.ownership_verified,
      routing_verified: !!r.routing_verified,
      root_redirect_url: r.root_redirect_url || undefined,
      created_by: r.created_by || undefined,
      created_at: r.created_at || undefined
    }));

    return NextResponse.json({
      success: true,
      total: formatted.length,
      domains: formatted
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg, domains: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, workspace_id, hostname, is_default, root_redirect_url } = body;

    if (!hostname || typeof hostname !== 'string' || !hostname.trim()) {
      return NextResponse.json({ success: false, error: 'Hostname is required.' }, { status: 400 });
    }

    const cleanWsId = (workspace_id && typeof workspace_id === 'string' && workspace_id.trim()) 
      ? workspace_id.trim() 
      : 'ws_default';

    // RBAC: Requires domains:manage permission (owner, admin only)
    const authResult = await verifyWorkspacePermission(request, 'domains:manage', {
      workspaceId: cleanWsId
    });
    if (!authResult.success) {
      return authResult.response;
    }

    // Clean and normalize hostname
    let cleanHost = hostname.trim().toLowerCase()
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '');

    // Hostname syntax validation
    const hostnameRegex = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$|^localhost$/i;
    if (!hostnameRegex.test(cleanHost)) {
      return NextResponse.json({ 
        success: false, 
        error: `Invalid hostname format "${cleanHost}". Please enter a valid fully qualified domain or subdomain (e.g. go.yourcompany.com).` 
      }, { status: 422 });
    }

    // Reserved domain guard
    if (RESERVED_DOMAINS.has(cleanHost) && !cleanHost.includes('localhost')) {
      return NextResponse.json({
        success: false,
        error: `The domain "${cleanHost}" is reserved by the platform infrastructure and cannot be registered.`
      }, { status: 403 });
    }

    // User email for ownership audit
    const creatorEmail = request.headers.get('x-user-email') || 'authorized_user';

    // Generate unique DNS TXT verification token
    const tokenHex = crypto.randomBytes(12).toString('hex');
    const verifyToken = `tinyurl-verification=${tokenHex}`;
    const cleanId = (id && typeof id === 'string') ? id.trim() : `dom_${Date.now()}`;

    // Cross-tenant hijack protection check
    const existingDomainRows = (await sql.query(
      `SELECT * FROM domains WHERE LOWER(hostname) = $1 LIMIT 1`,
      [cleanHost]
    )) as unknown as RawDomainRow[];

    if (existingDomainRows && existingDomainRows.length > 0) {
      const existing = existingDomainRows[0];
      // If already registered by another workspace
      if (existing.workspace_id && existing.workspace_id !== cleanWsId) {
        return NextResponse.json({
          success: false,
          error: `Domain "${cleanHost}" is currently registered by another organization. Please remove it from the original workspace or contact support to verify domain ownership.`
        }, { status: 409 });
      }
    }

    // Upsert domain with unverified status until DNS challenge passes
    const rows = (await sql.query(
      `INSERT INTO domains (
         id, workspace_id, hostname, verified, ssl_status, is_primary, 
         verify_token, ownership_verified, routing_verified, root_redirect_url, created_by, created_at
       )
       VALUES ($1, $2, $3, false, 'pending', $4, $5, false, false, $6, $7, NOW())
       ON CONFLICT (hostname) DO UPDATE
       SET workspace_id = EXCLUDED.workspace_id,
           verify_token = COALESCE(domains.verify_token, EXCLUDED.verify_token),
           is_primary = EXCLUDED.is_primary,
           root_redirect_url = COALESCE(EXCLUDED.root_redirect_url, domains.root_redirect_url)
       RETURNING *`,
      [
        cleanId, 
        cleanWsId, 
        cleanHost, 
        !!is_default, 
        verifyToken, 
        root_redirect_url || null, 
        creatorEmail
      ]
    )) as unknown as RawDomainRow[];

    const saved = rows && rows.length > 0 ? rows[0] : null;

    // Automatically register domain with Cloudflare for SaaS if configured
    let cfOwnershipDetails: { type: string; name: string; value: string } | undefined;
    if (isCloudflareConfigured()) {
      try {
        const cfRes = await addCustomHostnameToCloudflare(cleanHost);
        if (cfRes.ownership_verification) {
          cfOwnershipDetails = cfRes.ownership_verification;
        }
        if (cfRes.verified) {
          await sql.query(
            `UPDATE domains SET verified = true, ssl_status = 'active', routing_verified = true, ownership_verified = true WHERE id = $1`,
            [cleanId]
          ).catch(() => {});
          if (saved) {
            saved.verified = true;
            saved.ssl_status = 'active';
            saved.routing_verified = true;
            saved.ownership_verified = true;
          }
        }
      } catch (err) {
        console.warn('Cloudflare domain auto-registration notice:', err);
      }
    } else if (isVercelConfigured()) {
      // Legacy fallback: Vercel Project registration
      try {
        const vRes = await addDomainToVercel(cleanHost);
        if (vRes.verified) {
          await sql.query(
            `UPDATE domains SET verified = true, ssl_status = 'active', routing_verified = true WHERE id = $1`,
            [cleanId]
          ).catch(() => {});
          if (saved) {
            saved.verified = true;
            saved.ssl_status = 'active';
            saved.routing_verified = true;
          }
        }
      } catch (err) {
        console.warn('Vercel domain auto-registration notice:', err);
      }
    }

    const cnameTarget = getCloudflareCnameTarget();

    return NextResponse.json({
      success: true,
      message: 'Custom domain registered. Please configure the DNS verification records to verify ownership.',
      domain: saved ? {
        id: saved.id,
        workspace_id: saved.workspace_id,
        hostname: saved.hostname,
        verified: !!saved.verified,
        ssl_status: saved.ssl_status,
        is_default: !!saved.is_primary,
        verify_token: saved.verify_token,
        ownership_verified: !!saved.ownership_verified,
        routing_verified: !!saved.routing_verified,
        root_redirect_url: saved.root_redirect_url
      } : null,
      dns_instructions: {
        ownership_challenge: {
          type: 'TXT',
          host: `_tinyurl-challenge.${cleanHost}`,
          fallback_host: '@',
          value: verifyToken,
          purpose: 'Authorizes and proves organization ownership of this domain'
        },
        cloudflare_verification: cfOwnershipDetails ? {
          type: cfOwnershipDetails.type.toUpperCase(),
          host: cfOwnershipDetails.name,
          value: cfOwnershipDetails.value,
          purpose: 'Cloudflare Edge SSL Certificate pre-validation'
        } : undefined,
        routing: {
          type: 'CNAME',
          host: cleanHost.includes('.') ? cleanHost.split('.')[0] : '@',
          target: cnameTarget,
          purpose: 'Routes shortlink traffic to high-performance Edge nodes'
        }
      }
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { 
      id, 
      hostname, 
      simulate_bypass, 
      root_redirect_url, 
      is_primary, 
      action 
    } = body;

    const target = id || hostname;
    if (!target || typeof target !== 'string') {
      return NextResponse.json({ success: false, error: 'Domain ID or hostname is required.' }, { status: 400 });
    }

    // RBAC: Requires domains:manage permission (owner, admin only)
    const authResult = await verifyWorkspacePermission(request, 'domains:manage', {
      domainId: target.trim()
    });
    if (!authResult.success) {
      return authResult.response;
    }

    // 1. Fetch current domain record from Neon DB
    const existingRows = (await sql.query(
      `SELECT * FROM domains WHERE id = $1 OR LOWER(hostname) = LOWER($1) LIMIT 1`,
      [target.trim()]
    )) as unknown as RawDomainRow[];

    if (!existingRows || existingRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Domain not found.' }, { status: 404 });
    }

    const currentDomain = existingRows[0];
    const cleanHost = currentDomain.hostname;

    // Handle simple configuration update without DNS re-check
    if (action === 'update_config') {
      const updated = (await sql.query(
        `UPDATE domains
         SET root_redirect_url = COALESCE($1, root_redirect_url),
             is_primary = COALESCE($2, is_primary)
         WHERE id = $3
         RETURNING *`,
        [root_redirect_url !== undefined ? root_redirect_url : null, is_primary !== undefined ? is_primary : null, currentDomain.id]
      )) as unknown as RawDomainRow[];

      return NextResponse.json({
        success: true,
        message: 'Domain configuration updated.',
        domain: updated && updated.length > 0 ? updated[0] : null
      });
    }

    // 2. Run Live DNS Ownership & Routing Checks
    let ownershipVerified = !!currentDomain.ownership_verified;
    let routingVerified = !!currentDomain.routing_verified;

    const tokenToMatch = currentDomain.verify_token || '';
    const rawSecret = tokenToMatch.replace(/^tinyurl-verification=/, '');

    // A. Check TXT Record (Proof of Ownership / Organization Authorization)
    let resolvedTxtRecords: string[][] = [];
    try {
      resolvedTxtRecords = await dns.promises.resolveTxt(`_tinyurl-challenge.${cleanHost}`);
    } catch {
      try {
        resolvedTxtRecords = await dns.promises.resolveTxt(cleanHost);
      } catch {}
    }

    const flatTxt = resolvedTxtRecords.map(chunks => chunks.join('')).join(' ');
    if (tokenToMatch && flatTxt.includes(rawSecret)) {
      ownershipVerified = true;
    }

    // B. Check CNAME / A Record (Traffic Routing & Edge SSL)
    let resolvedCnames: string[] = [];
    let resolvedIps: string[] = [];
    try {
      resolvedCnames = await dns.promises.resolveCname(cleanHost);
    } catch {}

    try {
      resolvedIps = await dns.promises.resolve4(cleanHost);
    } catch {}

    const edgeProxyIp = process.env.EDGE_PROXY_IP || process.env.NEXT_PUBLIC_EDGE_PROXY_IP || '159.54.139.45';
    const configuredTarget = getCloudflareCnameTarget() || 'creataurus.work.gd';
    const EXPECTED_CNAMES = [
      configuredTarget,
      'creataurus.work.gd',
      'cname.tinyurl.dev', 
      'tiny-url-self.vercel.app'
    ];
    const isCnameMatched = resolvedCnames.some(c => 
      EXPECTED_CNAMES.some(exp => c.toLowerCase().includes(exp.toLowerCase()))
    );
    const isIpMatched = resolvedIps.includes(edgeProxyIp) || resolvedIps.includes('159.54.139.45');

    if (isCnameMatched || isIpMatched) {
      routingVerified = true;
    }

    // Check with Cloudflare Edge verification if configured
    if (isCloudflareConfigured()) {
      try {
        const cfCheck = await getCustomHostnameFromCloudflare(cleanHost);
        if (cfCheck.verified) {
          routingVerified = true;
          ownershipVerified = true;
        } else {
          if (cfCheck.status === 'active') routingVerified = true;
          if (cfCheck.ssl_status === 'active') ownershipVerified = true;
        }
      } catch {}
    } else if (isVercelConfigured()) {
      // Legacy Vercel Edge verification check
      try {
        const vVerify = await verifyDomainOnVercel(cleanHost);
        if (vVerify.verified) {
          routingVerified = true;
          ownershipVerified = true;
        }
      } catch {}
    }

    // Live HTTPS TLS Handshake Probe (Active verification)
    try {
      const probeController = new AbortController();
      const probeTimeout = setTimeout(() => probeController.abort(), 2500);
      const probeRes = await fetch(`https://${cleanHost}`, {
        method: 'HEAD',
        signal: probeController.signal
      }).catch(() => null);
      clearTimeout(probeTimeout);
      if (probeRes) {
        routingVerified = true;
      }
    } catch {}

    // C. Developer Demo / Localhost / DuckDNS bypass
    const isDuckDns = cleanHost.endsWith('.duckdns.org') && (resolvedIps.length > 0 || isIpMatched);
    const isLocalOrTest = cleanHost.includes('localhost') || 
                          cleanHost.endsWith('.test') || 
                          cleanHost.endsWith('.local') || 
                          isDuckDns ||
                          simulate_bypass === true;

    if (isLocalOrTest) {
      ownershipVerified = true;
      routingVerified = true;
    }

    const isFullyVerified = ownershipVerified && routingVerified;
    const finalSslStatus = isFullyVerified ? 'active' : 'pending';

    // Construct informative diagnostic message
    let diagnosticMessage = '';
    if (isFullyVerified) {
      diagnosticMessage = `Domain verified successfully! Edge routing active via ${isIpMatched ? `A record (${edgeProxyIp})` : `CNAME (${configuredTarget})`}.`;
    } else if (!ownershipVerified && !routingVerified) {
      diagnosticMessage = `DNS pending: Add an A record pointing to "${edgeProxyIp}" (recommended for root domains) OR a CNAME pointing to "${configuredTarget}".`;
    } else if (!ownershipVerified) {
      diagnosticMessage = `Routing is connected to Edge proxy! Add TXT record "${tokenToMatch}" to authorize your organization.`;
    } else {
      diagnosticMessage = `Ownership confirmed! Point an A record to "${edgeProxyIp}" or CNAME to "${configuredTarget}".`;
    }

    // 3. Persist verification state
    const rows = (await sql.query(
      `UPDATE domains
       SET verified = $1,
           ssl_status = $2,
           ownership_verified = $3,
           routing_verified = $4,
           root_redirect_url = COALESCE($5, root_redirect_url)
       WHERE id = $6
       RETURNING *`,
      [
        isFullyVerified,
        finalSslStatus,
        ownershipVerified,
        routingVerified,
        root_redirect_url !== undefined ? root_redirect_url : null,
        currentDomain.id
      ]
    )) as unknown as RawDomainRow[];

    const updatedRow = rows && rows.length > 0 ? rows[0] : null;

    return NextResponse.json({
      success: true,
      verified: isFullyVerified,
      ssl_status: finalSslStatus,
      ownership_verified: ownershipVerified,
      routing_verified: routingVerified,
      message: diagnosticMessage,
      dns_details: {
        hostname: cleanHost,
        expected_txt: tokenToMatch,
        resolved_txt: flatTxt || 'No TXT record found',
        expected_cname: configuredTarget,
        resolved_cnames: resolvedCnames,
        resolved_ips: resolvedIps,
        is_demo_bypass: isLocalOrTest && !isCnameMatched
      },
      domain: updatedRow ? {
        id: updatedRow.id,
        workspace_id: updatedRow.workspace_id,
        hostname: updatedRow.hostname,
        verified: !!updatedRow.verified,
        ssl_status: updatedRow.ssl_status,
        is_default: !!updatedRow.is_primary,
        verify_token: updatedRow.verify_token,
        ownership_verified: !!updatedRow.ownership_verified,
        routing_verified: !!updatedRow.routing_verified,
        root_redirect_url: updatedRow.root_redirect_url
      } : null
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || searchParams.get('hostname');

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Domain ID or hostname is required.' }, { status: 400 });
    }

    const cleanId = id.trim();

    // RBAC: Requires domains:manage permission (owner, admin only)
    const authResult = await verifyWorkspacePermission(request, 'domains:manage', {
      domainId: cleanId
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const rows = (await sql.query(
      `DELETE FROM domains WHERE id = $1 OR LOWER(hostname) = LOWER($1) RETURNING *`,
      [cleanId]
    )) as unknown as RawDomainRow[];

    if (rows && rows.length > 0 && rows[0].hostname) {
      const deletedHost = rows[0].hostname;
      if (isCloudflareConfigured()) {
        removeCustomHostnameFromCloudflare(deletedHost).catch(() => {});
      } else if (isVercelConfigured()) {
        removeDomainFromVercel(deletedHost).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Domain deleted successfully.',
      deleted: rows && rows.length > 0 ? rows[0] : null
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-workspace-id, x-user-email'
    }
  });
}
