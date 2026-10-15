import { Suspense } from 'react';
import { headers } from 'next/headers';
import { sql } from '@/lib/postgres';
import { Link, LinkRule } from '@/lib/types';
import { extractGeoFromHeaders, resolveSmartTargetUrl } from '@/lib/geo';
import { RedirectClient } from './RedirectClient';

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ target?: string; title?: string; id?: string }>;
}

export default async function RedirectPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const sParams = await searchParams;

  let initialTarget = sParams.target ? decodeURIComponent(sParams.target) : null;
  let initialLink: Link | null = null;

  if (code) {
    try {
      const cleanCode = code.trim().toLowerCase();
      const headersList = await headers();
      const rawHost = headersList.get('host') || '';
      const currentHost = rawHost.split(':')[0].toLowerCase();
      const isPlatformDomain = currentHost === 'localhost' || 
                               currentHost === '127.0.0.1' || 
                               currentHost.includes('vercel.app') || 
                               currentHost === 'tinyurl.dev';

      let rows: Array<{
        id: string;
        workspace_id?: string;
        domain_id?: string;
        short_code: string;
        custom_slug?: string;
        destination_url: string;
        title?: string;
        tags?: string[] | string;
        clicks_count?: number;
        status?: string;
        is_flagged?: boolean;
        risk_score?: number;
        created_by?: string;
        created_at?: string;
        rules?: LinkRule[] | string;
        password_hash?: string;
        expires_at?: string;
        max_clicks?: number;
      }> = [];

      if (!isPlatformDomain) {
        rows = (await sql.query(
          `SELECT l.* FROM links l
           LEFT JOIN domains d ON d.id = l.domain_id
           WHERE (LOWER(d.hostname) = $1 OR l.domain_id IS NULL)
             AND (LOWER(l.short_code) = $2 OR LOWER(l.custom_slug) = $2)
           ORDER BY CASE WHEN LOWER(d.hostname) = $1 THEN 0 ELSE 1 END
           LIMIT 1`,
          [currentHost, cleanCode]
        )) as unknown as typeof rows;
      } else {
        rows = (await sql.query(
          `SELECT * FROM links WHERE LOWER(short_code) = $1 OR LOWER(custom_slug) = $1 LIMIT 1`,
          [cleanCode]
        )) as unknown as typeof rows;
      }

      if (rows && rows.length > 0) {
        const row = rows[0];
        const isPasswordLocked = !!row.password_hash;
        const parsedRules: LinkRule[] = isPasswordLocked 
          ? [] 
          : (typeof row.rules === 'string' ? JSON.parse(row.rules) : (Array.isArray(row.rules) ? row.rules : []));

        initialLink = {
          id: row.id,
          workspace_id: row.workspace_id || '',
          short_code: row.short_code,
          custom_slug: row.custom_slug || row.short_code,
          domain_id: row.domain_id || 'dom_primary',
          destination_url: isPasswordLocked ? '' : row.destination_url,
          title: row.title || `Short Link /${row.short_code}`,
          tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (Array.isArray(row.tags) ? row.tags : []),
          clicks_count: Number(row.clicks_count) || 0,
          status: (row.status as 'active' | 'disabled' | 'expired' | 'flagged') || 'active',
          is_flagged: !!row.is_flagged,
          risk_score: Number(row.risk_score) || 0,
          created_by: row.created_by || 'Owner',
          created_at: row.created_at || new Date().toISOString(),
          rules: parsedRules,
          expires_at: row.expires_at || undefined,
          max_clicks: row.max_clicks ? Number(row.max_clicks) : undefined,
          password_hash: row.password_hash ? 'PROTECTED' : undefined,
          redirect_type: ((row as Record<string, unknown>).redirect_type as 'direct' | 'frame' | 'splash') || 'direct',
          http_status_code: ((row as Record<string, unknown>).http_status_code as 301 | 302 | 307 | 308) || 301,
          notes: (row as Record<string, unknown>).notes as string | undefined,
          shield_protection: Boolean((row as Record<string, unknown>).shield_protection),
          hide_referrer: Boolean((row as Record<string, unknown>).hide_referrer),
          channel: (row as Record<string, unknown>).channel as string | undefined
        };

        // Server-Side Location & Device Smart Routing evaluation
        if (!isPasswordLocked && parsedRules.length > 0) {
          try {
            const reqHeaders = await headers();
            const userAgent = reqHeaders.get('user-agent') || '';
            const geo = extractGeoFromHeaders(name => reqHeaders.get(name));

            const resolved = resolveSmartTargetUrl({
              rules: parsedRules,
              defaultUrl: row.destination_url,
              userAgent,
              geo
            });

            if (resolved) {
              initialTarget = resolved;
            }
          } catch {}
        }

        if (!initialTarget && !isPasswordLocked) {
          initialTarget = row.destination_url;
        }
      }
    } catch (err) {
      console.warn('Server redirect lookup error:', err);
    }
  }

  return (
    <Suspense fallback={null}>
      <RedirectClient 
        code={code} 
        initialTarget={initialTarget} 
        initialLink={initialLink} 
      />
    </Suspense>
  );
}
