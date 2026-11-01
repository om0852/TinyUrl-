import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { verifyWorkspacePermission } from '@/lib/serverAuth';
import { linkCache } from '@/lib/cache';
import { evictCustomDomainCache } from '@/lib/linkCacheEviction';

async function evictLink(l: { short_code: string; custom_slug?: string | null; domain_id?: string | null; workspace_id?: string | null }) {
  for (const code of [l.short_code, l.custom_slug]) if (code) await linkCache.delete(`link_${code.toLowerCase()}`);
  await evictCustomDomainCache(l, [l.short_code, l.custom_slug]);
}

export async function POST(request: Request) {
  try {
    let body: { link_id?: string; short_code?: string; workspace_id?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Malformed JSON payload.' }, { status: 400 });
    }

    const { link_id, short_code, workspace_id } = body;

    if (!link_id && !short_code && !workspace_id) {
      return NextResponse.json(
        { success: false, error: 'Provide link_id, short_code, or workspace_id to reset analytics.' },
        { status: 400 }
      );
    }

    // RBAC: Requires settings:manage or links:delete permission
    const authResult = await verifyWorkspacePermission(request, 'settings:manage', {
      workspaceId: workspace_id || undefined,
      linkId: link_id || short_code || undefined
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const wsId = authResult.context.workspaceId;

    if (link_id || short_code) {
      // One link, found inside the authorised workspace. The id and the short code used to be
      // matched separately, so passing your own link_id with another workspace's short_code
      // wiped that other link's stats.
      const target = (await sql.query(
        `SELECT id, short_code, custom_slug, domain_id, workspace_id FROM links
         WHERE workspace_id = $2 AND (id = $1 OR LOWER(short_code) = LOWER($1) OR LOWER(custom_slug) = LOWER($1))
         ORDER BY (id = $1) DESC LIMIT 1`,
        [link_id || short_code, wsId]
      )) as unknown as { id: string; short_code: string; custom_slug?: string | null; domain_id?: string | null; workspace_id?: string | null }[];
      const link = target?.[0];
      if (!link) {
        return NextResponse.json({ success: false, error: 'Link not found.' }, { status: 404 });
      }

      await sql.query(
        `DELETE FROM click_events WHERE link_id = $1 OR (link_id IS NULL AND LOWER(short_code) = LOWER($2))`,
        [link.id, link.short_code]
      );
      await sql.query(`UPDATE links SET clicks_count = 0, updated_at = NOW() WHERE id = $1 AND workspace_id = $2`, [link.id, wsId]);
      await evictLink(link);

      return NextResponse.json({ success: true, message: 'Link analytics reset.' });
    }

    if (workspace_id) {
      const wsLinks = (await sql.query(
        `SELECT id, short_code, custom_slug, domain_id, workspace_id FROM links WHERE workspace_id = $1`,
        [wsId]
      )) as unknown as { id: string; short_code: string; custom_slug?: string | null; domain_id?: string | null; workspace_id?: string | null }[];
      await sql.query(
        `DELETE FROM click_events
         WHERE link_id IN (SELECT id FROM links WHERE workspace_id = $1)
            OR (link_id IS NULL AND LOWER(short_code) IN (SELECT LOWER(short_code) FROM links WHERE workspace_id = $1))`,
        [wsId]
      );
      await sql.query(`UPDATE links SET clicks_count = 0, updated_at = NOW() WHERE workspace_id = $1`, [wsId]);
      // Cached copies carry the old count (a link at its click limit would stay blocked)
      for (const l of wsLinks || []) await evictLink(l);

      return NextResponse.json({ success: true, message: 'Workspace analytics reset.' });
    }

    return NextResponse.json({ success: false, error: 'No matching target for reset.' }, { status: 400 });
  } catch (error) {
    console.error('Reset stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset analytics.' },
      { status: 500 }
    );
  }
}
