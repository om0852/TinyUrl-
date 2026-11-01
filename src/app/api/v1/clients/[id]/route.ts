import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql, initializeDatabase } from '@/lib/postgres';
import { verifyWorkspacePermission } from '@/lib/serverAuth';

function hashPassword(password: string): string {
  const salt = 'client_portal_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 210000, 64, 'sha512').toString('hex');
}

// Only links and campaigns that belong to the client's workspace can be assigned
async function ownedIds(table: 'links' | 'campaigns', ids: unknown, workspaceId: string): Promise<string[]> {
  const list = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string' && !!x) : [];
  if (list.length === 0) return [];
  const rows = (await sql.query(`SELECT id FROM ${table} WHERE id = ANY($1::text[]) AND workspace_id = $2`, [list, workspaceId]).catch(() => [])) as { id: string }[];
  const owned = new Set(rows.map(r => r.id));
  return list.filter(id => owned.has(id));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase();
    const { id } = await params;

    const rows = await sql.query(`SELECT * FROM client_portals WHERE id = $1 LIMIT 1`, [id]);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Client account not found.' }, { status: 404 });
    }

    const r = rows[0];

    // RBAC: Requires clients:manage permission
    const authResult = await verifyWorkspacePermission(request, 'clients:manage', {
      workspaceId: r.workspace_id
    });
    if (!authResult.success) {
      return authResult.response;
    }
    const client = {
      id: r.id,
      workspace_id: r.workspace_id,
      name: r.name,
      email: r.email,
      company_name: r.company_name,
      status: r.status,
      custom_domain: r.custom_domain,
      brand_logo_url: r.brand_logo_url,
      brand_color: r.brand_color,
      can_view_analytics: r.can_view_analytics,
      can_edit_destination_url: r.can_edit_destination_url,
      can_create_links: r.can_create_links,
      max_links_quota: r.max_links_quota,
      assigned_link_ids: typeof r.assigned_link_ids === 'string' ? JSON.parse(r.assigned_link_ids) : (r.assigned_link_ids || []),
      assigned_campaign_ids: typeof r.assigned_campaign_ids === 'string' ? JSON.parse(r.assigned_campaign_ids) : (r.assigned_campaign_ids || []),
      assigned_channel: r.assigned_channel,
      total_logins: r.total_logins,
      last_login_at: r.last_login_at,
      created_at: r.created_at,
      updated_at: r.updated_at
    };

    return NextResponse.json({ success: true, client });
  } catch (error) {
    console.error('Error fetching client by id:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase();
    const { id } = await params;
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Malformed JSON payload.' }, { status: 400 });
    }

    const rows = await sql.query(`SELECT * FROM client_portals WHERE id = $1 LIMIT 1`, [id]);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Client account not found.' }, { status: 404 });
    }

    const existing = rows[0];

    // RBAC: Requires clients:manage permission
    const authResult = await verifyWorkspacePermission(request, 'clients:manage', {
      workspaceId: existing.workspace_id
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const updatedName = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : existing.name;
    const updatedCompany = typeof body.company_name === 'string' && body.company_name.trim() ? body.company_name.trim() : existing.company_name;
    // Portal routes only admit 'active'; anything else is treated as suspended
    const updatedStatus = body.status === 'active' || body.status === 'suspended' ? body.status : existing.status;
    const updatedDomain = body.custom_domain !== undefined ? body.custom_domain : existing.custom_domain;
    const updatedLogo = body.brand_logo_url !== undefined ? body.brand_logo_url : existing.brand_logo_url;
    const updatedColor = body.brand_color !== undefined ? body.brand_color : existing.brand_color;
    const updatedCanAnalytics = body.can_view_analytics !== undefined ? Boolean(body.can_view_analytics) : existing.can_view_analytics;
    const updatedCanEditDest = body.can_edit_destination_url !== undefined ? Boolean(body.can_edit_destination_url) : existing.can_edit_destination_url;
    const updatedCanCreate = body.can_create_links !== undefined ? Boolean(body.can_create_links) : existing.can_create_links;
    const quotaNum = Number(body.max_links_quota);
    const updatedQuota = body.max_links_quota !== undefined && Number.isFinite(quotaNum) && quotaNum >= 0 ? Math.floor(quotaNum) : existing.max_links_quota;
    
    let updatedAssignedLinks: string;
    if (body.assigned_link_ids !== undefined) {
      updatedAssignedLinks = JSON.stringify(await ownedIds('links', body.assigned_link_ids, existing.workspace_id));
    } else {
      updatedAssignedLinks = typeof existing.assigned_link_ids === 'string'
        ? existing.assigned_link_ids
        : JSON.stringify(existing.assigned_link_ids || []);
    }

    let updatedAssignedCampaigns: string;
    if (body.assigned_campaign_ids !== undefined) {
      updatedAssignedCampaigns = JSON.stringify(await ownedIds('campaigns', body.assigned_campaign_ids, existing.workspace_id));
    } else {
      updatedAssignedCampaigns = typeof existing.assigned_campaign_ids === 'string'
        ? existing.assigned_campaign_ids
        : JSON.stringify(existing.assigned_campaign_ids || []);
    }

    const updatedChannel = body.assigned_channel !== undefined ? body.assigned_channel : existing.assigned_channel;

    let updatedPassHash = existing.password_hash;
    if (body.password && typeof body.password === 'string' && body.password.trim()) {
      updatedPassHash = hashPassword(body.password.trim());
    }


    await sql.query(
      `UPDATE client_portals SET
        name = $1,
        company_name = $2,
        status = $3,
        custom_domain = $4,
        brand_logo_url = $5,
        brand_color = $6,
        can_view_analytics = $7,
        can_edit_destination_url = $8,
        can_create_links = $9,
        max_links_quota = $10,
        assigned_link_ids = $11::jsonb,
        assigned_campaign_ids = $12::jsonb,
        assigned_channel = $13,
        password_hash = $14,
        updated_at = NOW()
       WHERE id = $15`,
      [
        updatedName,
        updatedCompany,
        updatedStatus,
        updatedDomain || null,
        updatedLogo || null,
        updatedColor,
        updatedCanAnalytics,
        updatedCanEditDest,
        updatedCanCreate,
        updatedQuota,
        updatedAssignedLinks,
        updatedAssignedCampaigns,
        updatedChannel || null,
        updatedPassHash,
        id
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Client portal account updated successfully.'
    });
  } catch (error) {
    console.error('Error updating client portal:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase();
    const { id } = await params;

    const rows = await sql.query(`SELECT workspace_id FROM client_portals WHERE id = $1 LIMIT 1`, [id]);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Client account not found.' }, { status: 404 });
    }

    // RBAC: Requires clients:manage permission
    const authResult = await verifyWorkspacePermission(request, 'clients:manage', {
      workspaceId: rows[0].workspace_id
    });
    if (!authResult.success) {
      return authResult.response;
    }

    await sql.query(`DELETE FROM client_portals WHERE id = $1`, [id]);

    return NextResponse.json({
      success: true,
      message: 'Client portal account revoked successfully.'
    });
  } catch (error) {
    console.error('Error deleting client portal:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
