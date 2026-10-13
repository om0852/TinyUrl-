import { Suspense } from 'react';
import { sql } from '@/lib/postgres';
import { Link, LinkRule } from '@/lib/types';
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
      const rows = (await sql.query(
        `SELECT * FROM links WHERE LOWER(short_code) = $1 LIMIT 1`,
        [cleanCode]
      )) as unknown as Array<{
        id: string;
        workspace_id?: string;
        short_code: string;
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
      }>;

      if (rows && rows.length > 0) {
        const row = rows[0];
        const isPasswordLocked = !!row.password_hash;
        initialLink = {
          id: row.id,
          workspace_id: row.workspace_id || '',
          short_code: row.short_code,
          custom_slug: row.short_code,
          domain_id: 'dom_primary',
          destination_url: isPasswordLocked ? '' : row.destination_url,
          title: row.title || `Short Link /${row.short_code}`,
          tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (Array.isArray(row.tags) ? row.tags : []),
          clicks_count: Number(row.clicks_count) || 0,
          status: (row.status as 'active' | 'disabled' | 'expired' | 'flagged') || 'active',
          is_flagged: !!row.is_flagged,
          risk_score: Number(row.risk_score) || 0,
          created_by: row.created_by || 'Owner',
          created_at: row.created_at || new Date().toISOString(),
          rules: isPasswordLocked ? [] : (typeof row.rules === 'string' ? JSON.parse(row.rules) : (Array.isArray(row.rules) ? row.rules : [])),
          expires_at: row.expires_at || undefined,
          max_clicks: row.max_clicks ? Number(row.max_clicks) : undefined,
          password_hash: row.password_hash ? 'PROTECTED' : undefined
        };

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
