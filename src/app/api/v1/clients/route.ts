import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql, initializeDatabase } from '@/lib/postgres';
import { ClientPortalAccount, ClientPortalSummaryMetrics } from '@/lib/types';
import { generateId } from '@/lib/db';

function hashPassword(password: string): string {
  const salt = 'client_portal_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

export async function GET(request: Request) {
  try {
    await initializeDatabase();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: 'Query parameter "workspace_id" is required.' },
        { status: 400 }
      );
    }

    const rows = await sql.query(
      `SELECT * FROM client_portals WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [workspaceId]
    );

    const clients: ClientPortalAccount[] = (rows || []).map((r: any) => ({
      id: r.id,
      workspace_id: r.workspace_id,
      name: r.name,
      email: r.email,
      company_name: r.company_name,
      status: r.status || 'active',
      custom_domain: r.custom_domain || undefined,
      brand_logo_url: r.brand_logo_url || undefined,
      brand_color: r.brand_color || '#4f46e5',
      can_view_analytics: r.can_view_analytics !== false,
      can_edit_destination_url: Boolean(r.can_edit_destination_url),
      can_create_links: Boolean(r.can_create_links),
      max_links_quota: r.max_links_quota || 10,
      assigned_link_ids: typeof r.assigned_link_ids === 'string' ? JSON.parse(r.assigned_link_ids) : (r.assigned_link_ids || []),
      assigned_campaign_ids: typeof r.assigned_campaign_ids === 'string' ? JSON.parse(r.assigned_campaign_ids) : (r.assigned_campaign_ids || []),
      assigned_channel: r.assigned_channel || undefined,
      total_logins: r.total_logins || 0,
      last_login_at: r.last_login_at ? new Date(r.last_login_at).toISOString() : undefined,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
    }));

    // Compute Summary Metrics (matching Linko's Top Row)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const totalClients = clients.length;
    let activeThisMonth = 0;
    let totalLogins = 0;
    const domainCounts: Record<string, number> = {};

    clients.forEach(c => {
      totalLogins += c.total_logins || 0;
      if (c.last_login_at && new Date(c.last_login_at).getTime() >= startOfMonth) {
        activeThisMonth++;
      }
      if (c.custom_domain) {
        domainCounts[c.custom_domain] = (domainCounts[c.custom_domain] || 0) + 1;
      }
    });

    // Find most used custom domain
    let mostUsedDomain = 'portal.tinyurl.internal';
    let maxDomainCount = 0;
    Object.entries(domainCounts).forEach(([domain, count]) => {
      if (count > maxDomainCount) {
        maxDomainCount = count;
        mostUsedDomain = domain;
      }
    });

    const summary: ClientPortalSummaryMetrics = {
      total_clients: totalClients,
      active_this_month: activeThisMonth,
      total_logins: totalLogins,
      most_used_domain: mostUsedDomain,
      client_quota: {
        created: totalClients,
        limit: -1 // Unlimited on agency plans
      }
    };

    return NextResponse.json({
      success: true,
      clients,
      summary,
      metrics: summary
    });
  } catch (error) {
    console.error('Error fetching client portals:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await initializeDatabase();
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Malformed JSON payload.' }, { status: 400 });
    }

    const {
      workspace_id,
      name,
      email,
      company_name,
      password,
      custom_domain,
      brand_logo_url,
      brand_color,
      can_view_analytics = true,
      can_edit_destination_url = false,
      can_create_links = false,
      max_links_quota = 10,
      assigned_link_ids = [],
      assigned_campaign_ids = [],
      assigned_channel
    } = body;

    // Strict validation
    if (!workspace_id || typeof workspace_id !== 'string') {
      return NextResponse.json({ success: false, error: 'Field "workspace_id" is required.' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Field "name" is required.' }, { status: 400 });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'A valid "email" is required.' }, { status: 400 });
    }
    if (!company_name || typeof company_name !== 'string' || !company_name.trim()) {
      return NextResponse.json({ success: false, error: 'Field "company_name" is required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanCompany = company_name.trim();
    const passHash = password ? hashPassword(password.trim()) : hashPassword('client123');
    const clientId = generateId('cln');

    // Check if client with this email already exists in workspace
    const existing = await sql.query(
      `SELECT id FROM client_portals WHERE workspace_id = $1 AND LOWER(email) = $2 LIMIT 1`,
      [workspace_id, cleanEmail]
    );

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'A client portal account with this email already exists in this workspace.' },
        { status: 409 }
      );
    }

    const assignedLinksJson = JSON.stringify(Array.isArray(assigned_link_ids) ? assigned_link_ids : []);
    const assignedCampaignsJson = JSON.stringify(Array.isArray(assigned_campaign_ids) ? assigned_campaign_ids : []);

    // Sync any assigned full link objects into PostgreSQL links table to guarantee portal visibility
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
              lnk.workspace_id || workspace_id,
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
          ).catch(err => console.warn('Sync assigned link to DB failed:', err));
        }
      }
    }

    await sql.query(
      `INSERT INTO client_portals (
        id, workspace_id, name, email, company_name, password_hash, status,
        custom_domain, brand_logo_url, brand_color,
        can_view_analytics, can_edit_destination_url, can_create_links, max_links_quota,
        assigned_link_ids, assigned_campaign_ids, assigned_channel,
        total_logins, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'active',
        $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16,
        0, NOW(), NOW()
      )`,
      [
        clientId,
        workspace_id,
        cleanName,
        cleanEmail,
        cleanCompany,
        passHash,
        custom_domain || null,
        brand_logo_url || null,
        brand_color || '#4f46e5',
        can_view_analytics !== false,
        Boolean(can_edit_destination_url),
        Boolean(can_create_links),
        Number(max_links_quota) || 10,
        assignedLinksJson,
        assignedCampaignsJson,
        assigned_channel || null
      ]
    );

    const newClient: ClientPortalAccount = {
      id: clientId,
      workspace_id,
      name: cleanName,
      email: cleanEmail,
      company_name: cleanCompany,
      status: 'active',
      custom_domain: custom_domain || undefined,
      brand_logo_url: brand_logo_url || undefined,
      brand_color: brand_color || '#4f46e5',
      can_view_analytics: can_view_analytics !== false,
      can_edit_destination_url: Boolean(can_edit_destination_url),
      can_create_links: Boolean(can_create_links),
      max_links_quota: Number(max_links_quota) || 10,
      assigned_link_ids: Array.isArray(assigned_link_ids) ? assigned_link_ids : [],
      assigned_campaign_ids: Array.isArray(assigned_campaign_ids) ? assigned_campaign_ids : [],
      assigned_channel: assigned_channel || undefined,
      total_logins: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: 'Client portal account created successfully.',
      client: newClient
    });
  } catch (error) {
    console.error('Error creating client portal:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error.' },
      { status: 500 }
    );
  }
}
