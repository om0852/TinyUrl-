/**
 * Helper to manage custom domains via Cloudflare for SaaS (Custom Hostnames API)
 * 
 * Benefits over Vercel Project Domains:
 * 1. 100 Custom domains completely FREE with automated edge SSL (Let's Encrypt / Google Trust Services).
 * 2. No domain collisions (domain_already_in_use) across different accounts.
 * 3. Does not bind to or reconfigure your Next.js application deployments.
 * 4. Zero-trust token scoping (API token limited to Custom Hostnames: Edit).
 * 5. High-speed SSL handshake termination across 300+ global Cloudflare edge locations.
 */

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const CLOUDFLARE_CNAME_TARGET = process.env.CUSTOM_DOMAIN_CNAME_TARGET || 
                                process.env.NEXT_PUBLIC_CNAME_TARGET || 
                                process.env.CLOUDFLARE_CNAME_TARGET || 
                                'creataurus.work.gd';

export function isCloudflareConfigured(): boolean {
  return !!(CLOUDFLARE_API_TOKEN && CLOUDFLARE_ZONE_ID);
}

export function getCloudflareCnameTarget(): string {
  return CLOUDFLARE_CNAME_TARGET;
}

export interface CloudflareCustomHostname {
  id: string;
  hostname: string;
  status: 'pending' | 'active' | 'blocked' | 'error';
  ssl?: {
    status: 'pending_validation' | 'active' | 'initializing' | 'pending_issuance' | 'pending_deployment';
    method?: string;
    type?: string;
    validation_records?: Array<{
      txt_name?: string;
      txt_value?: string;
      http_url?: string;
      http_body?: string;
    }>;
  };
  ownership_verification?: {
    type: string;
    name: string;
    value: string;
  };
}

export interface CloudflareResponse {
  success: boolean;
  hostname?: string;
  id?: string;
  status?: string;
  ssl_status?: string;
  verified?: boolean;
  verification_errors?: string[];
  ownership_verification?: {
    type: string;
    name: string;
    value: string;
  };
  ssl_validation_records?: Array<{
    txt_name?: string;
    txt_value?: string;
  }>;
  error?: string;
}

/**
 * Register a custom hostname in Cloudflare for SaaS
 */
export async function addCustomHostnameToCloudflare(hostname: string): Promise<CloudflareResponse> {
  if (!isCloudflareConfigured()) {
    return { success: false, error: 'Cloudflare for SaaS credentials not configured.' };
  }

  const cleanHost = hostname.trim().toLowerCase();
  const url = `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        hostname: cleanHost,
        ssl: {
          method: 'http',
          type: 'dv',
          settings: {
            min_tls_version: '1.2',
            http2: 'on'
          }
        }
      })
    });

    const data = await res.json().catch(() => ({}));

    // If already exists on this zone, fetch existing custom hostname info
    if (!res.ok) {
      const isAlreadyExists = data?.errors?.some((e: { code: number; message: string }) => 
        e.code === 1406 || e.message?.toLowerCase().includes('already exists')
      );

      if (isAlreadyExists) {
        return await getCustomHostnameFromCloudflare(cleanHost);
      }

      const errMsg = data?.errors?.map((e: { message: string }) => e.message).join(', ') || `Cloudflare API error ${res.status}`;
      return { success: false, error: errMsg };
    }

    const result: CloudflareCustomHostname = data.result;
    const isVerified = result.status === 'active' && result.ssl?.status === 'active';

    return {
      success: true,
      hostname: result.hostname,
      id: result.id,
      status: result.status,
      ssl_status: result.ssl?.status,
      verified: isVerified,
      ownership_verification: result.ownership_verification,
      ssl_validation_records: result.ssl?.validation_records?.map(r => ({
        txt_name: r.txt_name,
        txt_value: r.txt_value
      }))
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error communicating with Cloudflare API';
    return { success: false, error: msg };
  }
}

/**
 * Query custom hostname details & live SSL verification status from Cloudflare
 */
export async function getCustomHostnameFromCloudflare(hostname: string, customHostnameId?: string): Promise<CloudflareResponse> {
  if (!isCloudflareConfigured()) {
    return { success: false, error: 'Cloudflare for SaaS credentials not configured.' };
  }

  const cleanHost = hostname.trim().toLowerCase();
  const url = customHostnameId
    ? `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames/${encodeURIComponent(customHostnameId)}`
    : `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames?hostname=${encodeURIComponent(cleanHost)}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.errors?.map((e: { message: string }) => e.message).join(', ') || `Cloudflare API error ${res.status}`;
      return { success: false, error: errMsg };
    }

    const result: CloudflareCustomHostname = Array.isArray(data.result) ? data.result[0] : data.result;
    if (!result) {
      return { success: false, error: 'Custom hostname not found in Cloudflare zone.' };
    }

    const isVerified = result.status === 'active' && result.ssl?.status === 'active';

    return {
      success: true,
      hostname: result.hostname,
      id: result.id,
      status: result.status,
      ssl_status: result.ssl?.status,
      verified: isVerified,
      verification_errors: data.result?.verification_errors,
      ownership_verification: result.ownership_verification,
      ssl_validation_records: result.ssl?.validation_records?.map(r => ({
        txt_name: r.txt_name,
        txt_value: r.txt_value
      }))
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error communicating with Cloudflare API';
    return { success: false, error: msg };
  }
}

/**
 * Remove a custom hostname from Cloudflare when deleted by user
 */
export async function removeCustomHostnameFromCloudflare(hostname: string, customHostnameId?: string): Promise<boolean> {
  if (!isCloudflareConfigured()) {
    return false;
  }

  const cleanHost = hostname.trim().toLowerCase();

  try {
    let targetId = customHostnameId;

    if (!targetId) {
      const info = await getCustomHostnameFromCloudflare(cleanHost);
      targetId = info.id;
    }

    if (!targetId) {
      return false;
    }

    const url = `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames/${encodeURIComponent(targetId)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
      }
    });

    return res.ok;
  } catch {
    return false;
  }
}
