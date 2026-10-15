import { NextResponse } from 'next/server';
import { sql, initializeDatabase } from '@/lib/postgres';

export async function GET(request: Request) {
  try {
    await initializeDatabase();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'Query parameter "client_id" is required.' },
        { status: 400 }
      );
    }

    // 1. Fetch client account to check scoping & permissions
    const clientRows = await sql.query(
      `SELECT * FROM client_portals WHERE id = $1 AND status = 'active' LIMIT 1`,
      [clientId]
    );

    if (!clientRows || clientRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Client portal not found or inactive.' },
        { status: 404 }
      );
    }

    const client = clientRows[0];
    const assignedLinkIds: string[] = typeof client.assigned_link_ids === 'string'
      ? JSON.parse(client.assigned_link_ids)
      : (client.assigned_link_ids || []);
    const assignedCampaignIds: string[] = typeof client.assigned_campaign_ids === 'string'
      ? JSON.parse(client.assigned_campaign_ids)
      : (client.assigned_campaign_ids || []);

    // 2. Fetch only the scoped links
    let scopedLinks: any[] = [];
    if (assignedLinkIds.length > 0 || assignedCampaignIds.length > 0) {
      // Build safe parameter query
      const clauses: string[] = [];
      const values: any[] = [client.workspace_id];

      if (assignedLinkIds.length > 0) {
        values.push(assignedLinkIds);
        clauses.push(`id = ANY($${values.length})`);
      }
      if (assignedCampaignIds.length > 0) {
        values.push(assignedCampaignIds);
        clauses.push(`campaign_id = ANY($${values.length})`);
      }

      const linkQuery = `
        SELECT id, short_code, custom_slug, destination_url, title, status, clicks_count, created_at, updated_at, campaign_id
        FROM links
        WHERE workspace_id = $1 AND (${clauses.join(' OR ')})
        ORDER BY created_at DESC
      `;
      scopedLinks = await sql.query(linkQuery, values);
    }

    const linkIds = scopedLinks.map(l => l.id);
    const shortCodes = scopedLinks.map(l => (l.short_code || '').toLowerCase());

    // 3. Fetch click events strictly for these links
    let scopedClicks: any[] = [];
    if (linkIds.length > 0) {
      scopedClicks = await sql.query(
        `SELECT id, link_id, short_code, timestamp, ip_hash, country, city, device, os, browser, referrer, language
         FROM click_events
         WHERE link_id = ANY($1) OR LOWER(short_code) = ANY($2)
         ORDER BY timestamp DESC
         LIMIT 100`,
        [linkIds, shortCodes]
      );
    }

    // 4. Calculate client metrics
    const totalClicks = scopedLinks.reduce((acc, l) => acc + (l.clicks_count || 0), 0);
    const uniqueIps = new Set(scopedClicks.map(c => c.ip_hash || c.id));
    const uniqueClicks = Math.min(totalClicks, uniqueIps.size);

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        company_name: client.company_name,
        brand_color: client.brand_color,
        brand_logo_url: client.brand_logo_url,
        custom_domain: client.custom_domain,
        can_view_analytics: client.can_view_analytics,
        can_edit_destination_url: client.can_edit_destination_url,
        can_create_links: client.can_create_links
      },
      links: scopedLinks,
      clicks: scopedClicks,
      metrics: {
        total_assigned_links: scopedLinks.length,
        total_clicks: totalClicks,
        unique_clicks: uniqueClicks,
        quota_used: scopedLinks.length,
        quota_max: client.max_links_quota || 10
      }
    });
  } catch (error) {
    console.error('Error fetching client portal resources:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
