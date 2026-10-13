import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { LinksApiResponse, Link } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspace_id') || request.headers.get('x-workspace-id');
  const code = searchParams.get('code');

  try {
    let rows: any[] = [];
    if (code && typeof code === 'string' && code.trim()) {
      rows = await sql.query(`
        SELECT * FROM links WHERE LOWER(short_code) = $1 LIMIT 1
      `, [code.trim().toLowerCase()]);
    } else if (workspaceId && typeof workspaceId === 'string' && workspaceId.trim()) {
      rows = await sql.query(`
        SELECT * FROM links WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100
      `, [workspaceId.trim()]);
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
      const formattedLinks: Link[] = rows.map((l: any) => {
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
          status: l.status || 'active',
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
