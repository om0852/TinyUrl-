import { sql } from '@/lib/postgres';

// Domain ids that are not rows in the domains table (the platform's own host)
export const BUILTIN_DOMAIN_IDS = new Set(['dom_primary', 'dom_platform', 'dom_default', 'dom_primary_default']);

export const SLUG_PATTERN = /^[a-zA-Z0-9_-]{3,64}$/;

/** http(s) URL with a host; anything else (javascript:, data:, garbage) is refused */
export function isWebUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
}

/**
 * A link may only point at a built-in domain or one of its own workspace's domains.
 * Otherwise anyone could publish a link on another workspace's custom domain.
 */
export async function domainAllowed(workspaceId: string, domainId: string): Promise<boolean> {
  if (BUILTIN_DOMAIN_IDS.has(domainId)) return true;
  const rows = (await sql.query(`SELECT 1 FROM domains WHERE id = $1 AND workspace_id = $2 LIMIT 1`, [domainId, workspaceId]).catch(() => [])) as unknown[];
  return rows.length > 0;
}

/** A link may only join a campaign from its own workspace */
export async function campaignAllowed(workspaceId: string, campaignId: string): Promise<boolean> {
  const rows = (await sql.query(`SELECT 1 FROM campaigns WHERE id = $1 AND workspace_id = $2 LIMIT 1`, [campaignId, workspaceId]).catch(() => [])) as unknown[];
  return rows.length > 0;
}

/** True when another link already uses this code as its short code or custom slug */
export async function slugTaken(code: string, exceptLinkId?: string): Promise<boolean> {
  const rows = (await sql.query(
    `SELECT 1 FROM links WHERE (LOWER(short_code) = LOWER($1) OR LOWER(custom_slug) = LOWER($1)) AND id <> $2 LIMIT 1`,
    [code, exceptLinkId || '']
  ).catch(() => [{}])) as unknown[];
  return rows.length > 0;
}
