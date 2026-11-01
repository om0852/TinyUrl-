import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';

/**
 * Custom domains cache links under link_<host>_<code> (see middleware), separate from the
 * platform key link_<code>. Clear those too, or rule/destination edits on custom domains keep
 * serving the old version until the cache entry expires.
 */
export async function evictCustomDomainCache(row: { domain_id?: string | null; workspace_id?: string | null }, codes: (string | null | undefined)[]) {
  const cleanCodes = codes.filter((c): c is string => !!c).map(c => c.toLowerCase());
  if (cleanCodes.length === 0) return;
  try {
    let hosts = (await sql.query(`SELECT hostname FROM domains WHERE id = $1 LIMIT 1`, [row.domain_id || ''])) as unknown as { hostname: string }[];
    if (!hosts?.length && row.workspace_id) {
      // Links without a specific domain can be served on any of the workspace's domains
      hosts = (await sql.query(`SELECT hostname FROM domains WHERE workspace_id = $1`, [row.workspace_id])) as unknown as { hostname: string }[];
    }
    for (const { hostname } of hosts || []) {
      const host = (hostname || '').toLowerCase().trim();
      if (!host) continue;
      for (const code of cleanCodes) await linkCache.delete(`link_${host}_${code}`);
    }
  } catch (err) {
    console.warn('Custom domain cache eviction failed:', err);
  }
}
