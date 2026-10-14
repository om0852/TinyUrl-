/**
 * Helper to manage custom domains programmatically via Vercel REST API
 * Automatically registers domains, verifies DNS ownership, and provisions automated Let's Encrypt SSL.
 */

const VERCEL_AUTH_TOKEN = process.env.VERCEL_AUTH_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

function getTeamParam(): string {
  return VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(VERCEL_TEAM_ID)}` : '';
}

export function isVercelConfigured(): boolean {
  return !!(VERCEL_AUTH_TOKEN && VERCEL_PROJECT_ID);
}

export interface VercelDomainResponse {
  success: boolean;
  name?: string;
  verified?: boolean;
  error?: string;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
}

/**
 * Programmatically adds a custom domain to your Vercel Project
 */
export async function addDomainToVercel(hostname: string): Promise<VercelDomainResponse> {
  if (!isVercelConfigured()) {
    return { success: false, error: 'Vercel API credentials not configured.' };
  }

  const cleanHost = hostname.trim().toLowerCase();
  const url = `https://api.vercel.com/v10/projects/${encodeURIComponent(VERCEL_PROJECT_ID!)}/domains${getTeamParam()}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: cleanHost })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // If domain is already added to this project, treat as success
      if (data?.error?.code === 'domain_already_in_use' || data?.error?.message?.includes('already')) {
        return { success: true, name: cleanHost, verified: data?.verified ?? false };
      }
      return { 
        success: false, 
        error: data?.error?.message || `Vercel error ${res.status}: Failed to register domain.` 
      };
    }

    return {
      success: true,
      name: data.name || cleanHost,
      verified: !!data.verified,
      verification: data.verification
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error communicating with Vercel API';
    return { success: false, error: msg };
  }
}

/**
 * Triggers Vercel's Edge DNS verification for a domain
 */
export async function verifyDomainOnVercel(hostname: string): Promise<{ success: boolean; verified: boolean; error?: string }> {
  if (!isVercelConfigured()) {
    return { success: false, verified: false, error: 'Vercel API credentials not configured.' };
  }

  const cleanHost = hostname.trim().toLowerCase();
  const url = `https://api.vercel.com/v9/projects/${encodeURIComponent(VERCEL_PROJECT_ID!)}/domains/${encodeURIComponent(cleanHost)}/verify${getTeamParam()}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_AUTH_TOKEN}`
      }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { 
        success: false, 
        verified: false, 
        error: data?.error?.message || `Vercel verification failed with status ${res.status}` 
      };
    }

    return {
      success: true,
      verified: !!data.verified
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error verifying domain with Vercel';
    return { success: false, verified: false, error: msg };
  }
}

/**
 * Removes a domain from your Vercel Project when deleted by user
 */
export async function removeDomainFromVercel(hostname: string): Promise<boolean> {
  if (!isVercelConfigured()) {
    return false;
  }

  const cleanHost = hostname.trim().toLowerCase();
  const url = `https://api.vercel.com/v9/projects/${encodeURIComponent(VERCEL_PROJECT_ID!)}/domains/${encodeURIComponent(cleanHost)}${getTeamParam()}`;

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${VERCEL_AUTH_TOKEN}`
      }
    });

    return res.ok;
  } catch {
    return false;
  }
}
