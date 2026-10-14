import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { Workspace } from '@/lib/types';

interface RawWorkspaceRow {
  id: string;
  name: string;
  slug: string;
  plan?: string | null;
  role?: string | null;
  created_at?: string | null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const email = searchParams.get('email');

    let rows: RawWorkspaceRow[] = [];
    if (id) {
      rows = (await sql.query(
        `SELECT * FROM workspaces WHERE id = $1 LIMIT 1`,
        [id.trim()]
      )) as unknown as RawWorkspaceRow[];
    } else if (email) {
      const cleanEmail = email.trim().toLowerCase();
      // Workspaces where user is an active member or has an accepted invitation
      rows = (await sql.query(
        `SELECT DISTINCT 
           w.id, 
           w.name, 
           w.slug, 
           w.plan, 
           COALESCE(wm.role, w.role, 'viewer') as role, 
           w.created_at
         FROM workspaces w
         LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND LOWER(wm.email) = $1
         WHERE LOWER(wm.email) = $1 
            OR w.id IN (SELECT workspace_id FROM workspace_members WHERE LOWER(email) = $1 AND status = 'active')
         ORDER BY w.created_at DESC`,
        [cleanEmail]
      )) as unknown as RawWorkspaceRow[];
    } else {
      rows = (await sql.query(
        `SELECT * FROM workspaces ORDER BY created_at DESC LIMIT 50`
      )) as unknown as RawWorkspaceRow[];
    }

    const formatted: Workspace[] = (rows || []).map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      plan: (r.plan as 'free' | 'pro' | 'enterprise') || 'pro',
      role: (r.role as 'owner' | 'admin' | 'editor' | 'viewer') || 'owner',
      created_at: r.created_at || new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      total: formatted.length,
      workspaces: formatted
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg, workspaces: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, slug, plan } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ success: false, error: 'Workspace name is required.' }, { status: 400 });
    }

    const cleanId = (id && typeof id === 'string') ? id.trim() : `ws_${Date.now()}`;
    const cleanSlug = (slug && typeof slug === 'string') 
      ? slug.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')
      : name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    const cleanPlan = plan || 'pro';

    const rows = (await sql.query(
      `INSERT INTO workspaces (id, name, slug, plan, role, created_at)
       VALUES ($1, $2, $3, $4, 'owner', NOW())
       ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name, plan = EXCLUDED.plan
       RETURNING *`,
      [cleanId, name.trim(), cleanSlug, cleanPlan]
    )) as unknown as RawWorkspaceRow[];

    const created = rows && rows.length > 0 ? rows[0] : null;

    return NextResponse.json({
      success: true,
      message: 'Workspace created successfully.',
      workspace: created
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Workspace ID is required.' }, { status: 400 });
    }

    const rows = (await sql.query(
      `DELETE FROM workspaces WHERE id = $1 RETURNING *`,
      [id.trim()]
    )) as unknown as RawWorkspaceRow[];

    return NextResponse.json({
      success: true,
      message: 'Workspace deleted successfully.',
      deleted: rows && rows.length > 0 ? rows[0] : null
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, name, slug, plan } = body;

    if (!id || !name) {
      return NextResponse.json({ success: false, error: 'Workspace ID and Name are required.' }, { status: 400 });
    }

    const cleanSlug = slug 
      ? slug.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')
      : name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');

    const rows = (await sql.query(
      `UPDATE workspaces 
       SET name = $1, slug = $2, plan = COALESCE($3, plan)
       WHERE id = $4 
       RETURNING *`,
      [name.trim(), cleanSlug, plan || null, id.trim()]
    )) as unknown as RawWorkspaceRow[];

    return NextResponse.json({
      success: true,
      message: 'Workspace updated successfully.',
      workspace: rows && rows.length > 0 ? rows[0] : null
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
