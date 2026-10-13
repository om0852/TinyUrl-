import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';
import { LinksApiResponse, Link, LinkRule } from '@/lib/types';

interface RawLinkRow {
  id: string;
  workspace_id?: string | null;
  short_code: string;
  custom_slug?: string | null;
  domain_id?: string | null;
  destination_url: string;
  title?: string | null;
  tags?: string[] | string | null;
  clicks_count?: number | string | null;
  status?: string | null;
  is_flagged?: boolean | null;
  risk_score?: number | string | null;
  created_by?: string | null;
  created_at?: string | null;
  rules?: LinkRule[] | string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  expires_at?: string | null;
  max_clicks?: number | string | null;
  password_hash?: string | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspace_id') || request.headers.get('x-workspace-id');
  const code = searchParams.get('code');

  try {
    let rows: RawLinkRow[] = [];
    if (code && typeof code === 'string' && code.trim()) {
      rows = (await sql.query(`
        SELECT * FROM links WHERE LOWER(short_code) = $1 LIMIT 1
      `, [code.trim().toLowerCase()])) as unknown as RawLinkRow[];
    } else if (workspaceId && typeof workspaceId === 'string' && workspaceId.trim()) {
      rows = (await sql.query(`
        SELECT * FROM links WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100
      `, [workspaceId.trim()])) as unknown as RawLinkRow[];
    } else {
      // Strict multi-tenant isolation: Never expose links without workspace or code filter
      return NextResponse.json<LinksApiResponse>({
        success: true,
        source: 'scoped_workspace',
        total: 0,
        links: []
      });
    }

    if (Array.isArray(rows)) {
      const isPublicCodeQuery = !!code;
      const formattedLinks: Link[] = rows.map((l: RawLinkRow) => {
        const isPasswordLocked = isPublicCodeQuery && !!l.password_hash;
        return {
          id: l.id,
          workspace_id: l.workspace_id || '',
          short_code: l.short_code,
          custom_slug: l.custom_slug || l.short_code,
          domain_id: l.domain_id || 'dom_primary',
          destination_url: isPasswordLocked ? '' : l.destination_url,
          title: l.title || `Short Link /${l.short_code}`,
          tags: typeof l.tags === 'string' ? JSON.parse(l.tags) : (Array.isArray(l.tags) ? l.tags : []),
          clicks_count: Number(l.clicks_count) || 0,
          status: (l.status as 'active' | 'disabled' | 'expired' | 'flagged') || 'active',
          is_flagged: !!l.is_flagged,
          risk_score: Number(l.risk_score) || 0,
          created_by: l.created_by || 'Owner',
          created_at: l.created_at || new Date().toISOString(),
          rules: isPasswordLocked ? [] : (typeof l.rules === 'string' ? JSON.parse(l.rules) : (Array.isArray(l.rules) ? l.rules : [])),
          utm_source: l.utm_source || undefined,
          utm_medium: l.utm_medium || undefined,
          utm_campaign: l.utm_campaign || undefined,
          expires_at: l.expires_at || undefined,
          max_clicks: l.max_clicks ? Number(l.max_clicks) : undefined,
          password_hash: l.password_hash ? 'PROTECTED' : undefined
        };
      });

      return NextResponse.json<LinksApiResponse>({
        success: true,
        source: 'neon_postgresql',
        total: formattedLinks.length,
        links: formattedLinks
      });
    }
  } catch (err) {
    console.warn('Neon DB read error, links empty fallback:', err);
  }

  return NextResponse.json<LinksApiResponse>({
    success: true,
    source: 'empty_workspace',
    total: 0,
    links: []
  });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, rules, status, title } = body;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Link ID is required.' }, { status: 400 });
    }

    const rows = await sql.query(
      `UPDATE links 
       SET rules = COALESCE($1, rules),
           status = COALESCE($2, status),
           title = COALESCE($3, title),
           updated_at = NOW()
       WHERE id = $4 OR LOWER(short_code) = LOWER($4)
       RETURNING *`,
      [rules ? JSON.stringify(rules) : null, status || null, title || null, id.trim()]
    );

    if (rows && rows.length > 0) {
      const updatedRow = rows[0];
      if (updatedRow.short_code) {
        linkCache.delete(`link_${updatedRow.short_code.toLowerCase()}`);
      }
      if (updatedRow.custom_slug) {
        linkCache.delete(`link_${updatedRow.custom_slug.toLowerCase()}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Link updated successfully.',
      link: rows && rows.length > 0 ? rows[0] : null
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database update error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

