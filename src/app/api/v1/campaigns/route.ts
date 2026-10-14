import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { Campaign } from '@/lib/types';

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, workspace_id, name, description, tags, target_clicks } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Campaign name is required.' }, { status: 400 });
    }

    if (!workspace_id || typeof workspace_id !== 'string') {
      return NextResponse.json({ success: false, error: 'Workspace ID is required.' }, { status: 400 });
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
      workspace_id.trim(),
      name.trim(),
      description ? description.trim() : '',
      JSON.stringify(cleanTags),
      cleanTarget
    ])) as unknown as RawCampaignRow[];

    const created = rows && rows.length > 0 ? rows[0] : null;

    return NextResponse.json({
      success: true,
      message: 'Campaign created successfully.',
      campaign: created ? {
        id: created.id,
        workspace_id: created.workspace_id,
        name: created.name,
        description: created.description || '',
        tags: typeof created.tags === 'string' ? JSON.parse(created.tags) : (Array.isArray(created.tags) ? created.tags : cleanTags),
        target_clicks: Number(created.target_clicks) || cleanTarget,
        created_at: created.created_at || new Date().toISOString()
      } : null
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
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

    await sql.query(`DELETE FROM campaigns WHERE id = $1`, [id.trim()]);

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully.'
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
