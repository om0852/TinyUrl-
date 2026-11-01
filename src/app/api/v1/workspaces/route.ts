import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { Workspace } from '@/lib/types';
import { getSessionEmail } from '@/lib/session';
import { linkCache } from '@/lib/cache';
import { verifyWorkspacePermission } from '@/lib/serverAuth';

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
    // Only list the signed-in user's own workspaces in production; the email query/header is
    // client-controlled and would otherwise reveal any account's workspaces.
    const sessionEmail = getSessionEmail(request);
    const requestedEmail = searchParams.get('email') || request.headers.get('x-user-email');
    const email = process.env.NODE_ENV === 'production' ? sessionEmail : (sessionEmail || requestedEmail);

    let rows: RawWorkspaceRow[] = [];
    if (id) {
      const auth = await verifyWorkspacePermission(request, 'analytics:read', { workspaceId: id.trim() });
      if (!auth.success) return auth.response;
      rows = (await sql.query(
        `SELECT id, name, slug, plan, created_at FROM workspaces WHERE id = $1 LIMIT 1`,
        [id.trim()]
      )) as unknown as RawWorkspaceRow[];
    } else if (email) {
      const cleanEmail = email.trim().toLowerCase();
      // Workspaces where user is the owner, or an active collaborator
      rows = (await sql.query(
        `SELECT DISTINCT
           w.id,
           w.name,
           w.slug,
           w.plan,
           CASE
             WHEN LOWER(COALESCE(w.owner_email, '')) = $1 THEN 'owner'
             ELSE COALESCE(wm.role, w.role, 'editor')
           END as role,
           w.owner_email,
           w.created_at
         FROM workspaces w
         LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND LOWER(wm.email) = $1 AND wm.status = 'active'
         WHERE LOWER(COALESCE(w.owner_email, '')) = $1
            OR LOWER(wm.email) = $1
            OR w.id IN (SELECT workspace_id FROM workspace_members WHERE LOWER(email) = $1 AND status = 'active')
         ORDER BY w.created_at DESC`,
        [cleanEmail]
      )) as unknown as RawWorkspaceRow[];
    } else {
      // Security Guard: Prevent unauthenticated full system enumeration
      return NextResponse.json({
        success: true,
        total: 0,
        workspaces: []
      });
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
    const { id, name, slug, plan, owner_email, owner_id, owner_name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ success: false, error: 'Workspace name is required.' }, { status: 400 });
    }

    const cleanId = (id && typeof id === 'string') ? id.trim() : `ws_${Date.now()}`;
    const cleanSlug = (slug && typeof slug === 'string')
      ? slug.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')
      : name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    const cleanPlan = plan || 'pro';
    const sessionEmail = getSessionEmail(request);
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && !sessionEmail) {
      return NextResponse.json({ success: false, error: 'Sign in to create a workspace.' }, { status: 401 });
    }
    const cleanOwnerEmail = sessionEmail
      || (!isProduction && owner_email && typeof owner_email === 'string' ? owner_email.trim().toLowerCase() : null);
    const cleanOwnerId = (owner_id && typeof owner_id === 'string') ? owner_id.trim() : null;
    const cleanOwnerName = (owner_name && typeof owner_name === 'string') ? owner_name.trim() : 'Workspace Owner';

    // Anti-Hijacking Guard: If modifying an existing workspace, require settings:manage permission
    const existingWs = (await sql.query(`SELECT id, owner_email FROM workspaces WHERE id = $1 LIMIT 1`, [cleanId]).catch(() => [])) as { id: string }[];
    if (existingWs && existingWs.length > 0) {
      const authResult = await verifyWorkspacePermission(request, 'settings:manage', {
        workspaceId: cleanId
      });
      if (!authResult.success) {
        return authResult.response;
      }
    } else {
      // A deleted workspace's id can't be claimed again while anything still points at it
      const leftovers = (await sql.query(
        `SELECT 1 FROM links WHERE workspace_id = $1
         UNION ALL SELECT 1 FROM workspace_members WHERE workspace_id = $1
         UNION ALL SELECT 1 FROM domains WHERE workspace_id = $1
         LIMIT 1`,
        [cleanId]
      ).catch(() => [])) as unknown[];
      if (leftovers.length > 0) {
        return NextResponse.json({ success: false, error: 'That workspace id is not available.' }, { status: 409 });
      }
    }

    const rows = (await sql.query(
      `INSERT INTO workspaces (id, name, slug, plan, role, owner_email, owner_id, created_at)
       VALUES ($1, $2, $3, $4, 'owner', $5, $6, NOW())
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, plan = EXCLUDED.plan, owner_email = COALESCE(EXCLUDED.owner_email, workspaces.owner_email), owner_id = COALESCE(EXCLUDED.owner_id, workspaces.owner_id)
       RETURNING *`,
      [cleanId, name.trim(), cleanSlug, cleanPlan, cleanOwnerEmail, cleanOwnerId]
    )) as unknown as RawWorkspaceRow[];

    // Ensure the owner is automatically inserted into workspace_members as an active owner
    if (cleanOwnerEmail) {
      const memberId = `tm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await sql.query(`
        INSERT INTO workspace_members (id, workspace_id, user_id, name, email, role, status, created_at)
        VALUES ($1, $2, $3, $4, $5, 'owner', 'active', NOW())
        ON CONFLICT (workspace_id, email) DO UPDATE SET
          role = 'owner',
          status = 'active',
          name = EXCLUDED.name,
          user_id = COALESCE(EXCLUDED.user_id, workspace_members.user_id)
      `, [memberId, cleanId, cleanOwnerId, cleanOwnerName, cleanOwnerEmail]).catch(() => {});
    }

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

    const cleanId = id.trim();

    // RBAC: Requires settings:manage permission (owner only)
    const authResult = await verifyWorkspacePermission(request, 'settings:manage', {
      workspaceId: cleanId
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const rows = (await sql.query(
      `DELETE FROM workspaces WHERE id = $1 RETURNING id, name, slug`,
      [cleanId]
    )) as unknown as RawWorkspaceRow[];

    const deletedLinks = (await sql.query(
      `DELETE FROM links WHERE workspace_id = $1 RETURNING short_code, custom_slug`,
      [cleanId]
    ).catch(() => [])) as unknown as { short_code: string; custom_slug?: string | null }[];
    const domainRows = (await sql.query(
      `DELETE FROM domains WHERE workspace_id = $1 RETURNING hostname`,
      [cleanId]
    ).catch(() => [])) as unknown as { hostname: string }[];
    for (const table of ['workspace_members', 'workspace_invitations', 'campaigns', 'api_keys', 'webhooks', 'client_portals', 'bulk_jobs']) {
      await sql.query(`DELETE FROM ${table} WHERE workspace_id = $1`, [cleanId]).catch(() => {});
    }
    // Deleted links must stop redirecting now, not when their cache entries expire
    for (const l of deletedLinks || []) {
      for (const code of [l.short_code, l.custom_slug]) {
        if (!code) continue;
        const c = code.toLowerCase();
        await linkCache.delete(`link_${c}`);
        for (const d of domainRows || []) if (d.hostname) await linkCache.delete(`link_${d.hostname.toLowerCase()}_${c}`);
      }
    }

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

    const cleanId = id.trim();

    // RBAC: Requires settings:manage permission (owner only)
    const authResult = await verifyWorkspacePermission(request, 'settings:manage', {
      workspaceId: cleanId
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const cleanSlug = slug
      ? slug.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')
      : name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');

    const rows = (await sql.query(
      `UPDATE workspaces
       SET name = $1, slug = $2, plan = COALESCE($3, plan)
       WHERE id = $4
       RETURNING *`,
      [name.trim(), cleanSlug, plan || null, cleanId]
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

