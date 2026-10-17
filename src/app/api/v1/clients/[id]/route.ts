import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql, initializeDatabase } from '@/lib/postgres';

function hashPassword(password: string): string {
  const salt = 'client_portal_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
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

    const updatedName = body.name !== undefined ? body.name.trim() : existing.name;
    const updatedCompany = body.company_name !== undefined ? body.company_name.trim() : existing.company_name;
    const updatedStatus = body.status !== undefined ? body.status : existing.status;
    const updatedDomain = body.custom_domain !== undefined ? body.custom_domain : existing.custom_domain;
    const updatedLogo = body.brand_logo_url !== undefined ? body.brand_logo_url : existing.brand_logo_url;
    const updatedColor = body.brand_color !== undefined ? body.brand_color : existing.brand_color;
    const updatedCanAnalytics = body.can_view_analytics !== undefined ? Boolean(body.can_view_analytics) : existing.can_view_analytics;
    const updatedCanEditDest = body.can_edit_destination_url !== undefined ? Boolean(body.can_edit_destination_url) : existing.can_edit_destination_url;
    const updatedCanCreate = body.can_create_links !== undefined ? Boolean(body.can_create_links) : existing.can_create_links;
    const updatedQuota = body.max_links_quota !== undefined ? Number(body.max_links_quota) : existing.max_links_quota;
    
    let updatedAssignedLinks: string;
    if (body.assigned_link_ids !== undefined) {
      updatedAssignedLinks = JSON.stringify(Array.isArray(body.assigned_link_ids) ? body.assigned_link_ids : []);
    } else {
      updatedAssignedLinks = typeof existing.assigned_link_ids === 'string'
        ? existing.assigned_link_ids
        : JSON.stringify(existing.assigned_link_ids || []);
    }

    let updatedAssignedCampaigns: string;
    if (body.assigned_campaign_ids !== undefined) {
      updatedAssignedCampaigns = JSON.stringify(Array.isArray(body.assigned_campaign_ids) ? body.assigned_campaign_ids : []);
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

    // Sync any assigned full link objects into PostgreSQL links table
    if (Array.isArray(body.assigned_links) && body.assigned_links.length > 0) {
      for (const lnk of body.assigned_links) {
        if (lnk && lnk.id && lnk.short_code && lnk.destination_url) {
          await sql.query(
            `INSERT INTO links (
              id, workspace_id, domain_id, short_code, custom_slug, destination_url, title, status, clicks_count,
              tags, rules, campaign_id, redirect_type, http_status_code, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
            ON CONFLICT (short_code) DO UPDATE SET
              destination_url = EXCLUDED.destination_url,
              title = COALESCE(EXCLUDED.title, links.title),
              campaign_id = COALESCE(EXCLUDED.campaign_id, links.campaign_id)`,
            [
              lnk.id,
              lnk.workspace_id || existing.workspace_id,
              lnk.domain_id || 'dom_platform',
              lnk.short_code,
              lnk.custom_slug || lnk.short_code,
              lnk.destination_url,
              lnk.title || `Short Link ${lnk.short_code}`,
              lnk.status || 'active',
              lnk.clicks_count || 0,
              JSON.stringify(lnk.tags || []),
              JSON.stringify(lnk.rules || []),
              lnk.campaign_id || null,
              lnk.redirect_type || 'direct',
              lnk.http_status_code || 301,
              lnk.created_at || new Date().toISOString()
            ]
          ).catch(err => console.warn('Sync assigned link to DB failed on update:', err));
        }
      }
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

    const res = await sql.query(`DELETE FROM client_portals WHERE id = $1 RETURNING id`, [id]);
    if (!res || res.length === 0) {
      return NextResponse.json({ success: false, error: 'Client account not found.' }, { status: 404 });
    }

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
