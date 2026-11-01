import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { Campaign } from '@/lib/types';
import { verifyWorkspacePermission } from '@/lib/serverAuth';

interface RawCampaignRow {
  id: string;
  workspace_id?: string | null;
  name: string;
  description?: string | null;
  tags?: string[] | string | null;
  target_clicks?: number | string | null;
  created_at?: string | null;
  links_count?: number | string | null;
  clicks_count?: number | string | null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id') || request.headers.get('x-workspace-id');

    if (!workspaceId) {
      return NextResponse.json({
        success: true,
        campaigns: []
      });
    }

    // Campaign names, link counts and click totals are workspace data: members only
    const authResult = await verifyWorkspacePermission(request, 'analytics:read', {
      workspaceId: workspaceId.trim()
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const rows = (await sql.query(`
      SELECT 
        c.*,
        COUNT(DISTINCT l.id)::int as links_count,
        COALESCE(SUM(l.clicks_count), 0)::int as clicks_count
      FROM campaigns c
      LEFT JOIN links l ON (l.campaign_id = c.id)
      WHERE c.workspace_id = $1
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `, [workspaceId.trim()])) as unknown as RawCampaignRow[];

    const formatted: (Campaign & { links_count?: number; clicks_count?: number })[] = (rows || []).map(r => ({
      id: r.id,
      workspace_id: r.workspace_id || workspaceId,
      name: r.name,
      description: r.description || '',
      tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (Array.isArray(r.tags) ? r.tags : []),
      target_clicks: Number(r.target_clicks) || 10000,
      created_at: r.created_at || new Date().toISOString(),
      links_count: Number(r.links_count) || 0,
      clicks_count: Number(r.clicks_count) || 0
    }));

    return NextResponse.json({
      success: true,
      total: formatted.length,
      campaigns: formatted
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg, campaigns: [] }, { status: 500 });
  }
}

async function handleSaveCampaign(request: Request) {
  try {
    const body = await request.json();
    const { id, workspace_id, name, description, tags, target_clicks } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Campaign name is required.' }, { status: 400 });
    }

    let cleanWsId = (workspace_id && typeof workspace_id === 'string' && workspace_id.trim()) 
      ? workspace_id.trim() 
      : (request.headers.get('x-workspace-id') || '').trim();

    // An existing campaign is always checked against the workspace it actually belongs to.
    // Trusting the workspace_id in the body let a member of workspace A overwrite a campaign
    // in workspace B by sending B's campaign id.
    if (id) {
      const existing = (await sql.query(
        `SELECT workspace_id FROM campaigns WHERE id = $1 LIMIT 1`,
        [id]
      )) as { workspace_id?: string }[];
      if (existing?.[0]?.workspace_id) {
        cleanWsId = existing[0].workspace_id;
      }
    }

    if (!cleanWsId) {
      cleanWsId = 'ws_default';
    }

    // RBAC: Requires campaigns:create permission (owner, admin, editor)
    const authResult = await verifyWorkspacePermission(request, 'campaigns:create', {
      workspaceId: cleanWsId,
      campaignId: id || undefined
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const campaignId = id || `cmp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cleanTags = Array.isArray(tags) ? tags : ['sponsor', 'active'];
    const cleanTarget = Number(target_clicks) || 10000;

    const rows = (await sql.query(`
      INSERT INTO campaigns (id, workspace_id, name, description, tags, target_clicks, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        tags = EXCLUDED.tags,
        target_clicks = EXCLUDED.target_clicks
      RETURNING *
    `, [
      campaignId,
      cleanWsId,
      name.trim(),
      description ? description.trim() : '',
      JSON.stringify(cleanTags),
      cleanTarget
    ])) as unknown as RawCampaignRow[];

    const saved = rows && rows.length > 0 ? rows[0] : null;

    return NextResponse.json({
      success: true,
      message: id ? 'Campaign updated successfully.' : 'Campaign created successfully.',
      campaign: saved ? {
        id: saved.id,
        workspace_id: saved.workspace_id,
        name: saved.name,
        description: saved.description || '',
        tags: typeof saved.tags === 'string' ? JSON.parse(saved.tags) : (Array.isArray(saved.tags) ? saved.tags : cleanTags),
        target_clicks: Number(saved.target_clicks) || cleanTarget,
        created_at: saved.created_at || new Date().toISOString()
      } : null
    }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleSaveCampaign(request);
}

export async function PATCH(request: Request) {
  return handleSaveCampaign(request);
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
      } catch {}
    }

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Campaign ID is required.' }, { status: 400 });
    }

    const cleanId = id.trim();

    const owner = (await sql.query(`SELECT workspace_id FROM campaigns WHERE id = $1 LIMIT 1`, [cleanId])) as { workspace_id?: string }[];
    if (!owner?.[0]) {
      return NextResponse.json({ success: false, error: 'Campaign not found.' }, { status: 404 });
    }

    // RBAC: Requires campaigns:delete permission (owner, admin only) in the campaign's own workspace
    const authResult = await verifyWorkspacePermission(request, 'campaigns:delete', {
      workspaceId: owner[0].workspace_id || undefined,
      campaignId: cleanId
    });
    if (!authResult.success) {
      return authResult.response;
    }

    // Links keep working; they just stop pointing at a campaign that no longer exists
    await sql.query(`UPDATE links SET campaign_id = NULL WHERE campaign_id = $1`, [cleanId]);
    await sql.query(`DELETE FROM campaigns WHERE id = $1`, [cleanId]);

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully.'
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

