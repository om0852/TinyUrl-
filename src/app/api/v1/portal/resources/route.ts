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

    // 2. Fetch assigned campaigns info if any
    let scopedCampaigns: any[] = [];
    let campaignNames: string[] = [];
    if (assignedCampaignIds.length > 0) {
      try {
        scopedCampaigns = await sql.query(
          `SELECT id, name, description, tags, target_clicks, created_at
           FROM campaigns
           WHERE id = ANY($1::text[])`,
          [assignedCampaignIds]
        );
        campaignNames = scopedCampaigns.map(c => c.name).filter(Boolean);
      } catch (cErr) {
        console.warn('Failed to fetch assigned campaigns details:', cErr);
      }
    }

    // 3. Fetch scoped links: match explicitly assigned link IDs, assigned campaign IDs, or campaign UTM tags
    let scopedLinks: any[] = [];
    if (assignedLinkIds.length > 0 || assignedCampaignIds.length > 0) {
      const clauses: string[] = [];
      const values: any[] = [];

      if (assignedLinkIds.length > 0) {
        values.push(assignedLinkIds);
        clauses.push(`l.id = ANY($${values.length}::text[])`);
      }
      if (assignedCampaignIds.length > 0) {
        values.push(assignedCampaignIds);
        clauses.push(`l.campaign_id = ANY($${values.length}::text[])`);

        if (campaignNames.length > 0) {
          values.push(campaignNames);
          clauses.push(`LOWER(l.utm_campaign) = ANY(SELECT LOWER(unnest($${values.length}::text[])))`);
        }
      }

      // Also allow matching links from the client's workspace if explicitly attached or matching custom domain
      if (client.custom_domain && client.custom_domain !== 'localhost:3000') {
        values.push(client.custom_domain.toLowerCase());
        clauses.push(`LOWER(l.domain_id) = $${values.length}`);
      }

      const linkQuery = `
        SELECT l.id, l.short_code, l.custom_slug, l.destination_url, l.title, l.status, l.clicks_count, l.created_at, l.updated_at, l.campaign_id, l.utm_campaign
        FROM links l
        WHERE (${clauses.join(' OR ')})
        ORDER BY l.created_at DESC
      `;
      try {
        scopedLinks = await sql.query(linkQuery, values);
      } catch (qErr) {
        console.error('Error querying scoped links:', qErr);
        // Fallback: Query by IDs without complex clauses
        if (assignedLinkIds.length > 0) {
          scopedLinks = await sql.query(
            `SELECT id, short_code, custom_slug, destination_url, title, status, clicks_count, created_at, updated_at, campaign_id
             FROM links WHERE id = ANY($1::text[])`,
            [assignedLinkIds]
          ).catch(() => []);
        }
      }
    }

    const linkIds = scopedLinks.map(l => l.id);
    const shortCodes = scopedLinks.map(l => (l.short_code || '').toLowerCase());

    // 4. Fetch click events strictly for these links
    let scopedClicks: any[] = [];
    if (linkIds.length > 0) {
      scopedClicks = await sql.query(
        `SELECT id, link_id, short_code, timestamp, ip_hash, country, city, device, os, browser, referrer, language
         FROM click_events
         WHERE link_id = ANY($1::text[]) OR LOWER(short_code) = ANY($2::text[])
         ORDER BY timestamp DESC
         LIMIT 200`,
        [linkIds, shortCodes]
      ).catch(() => []);
    }

    // 5. Calculate client metrics
    const totalClicks = scopedLinks.reduce((acc, l) => acc + (Number(l.clicks_count) || 0), 0);
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
      campaigns: scopedCampaigns,
      clicks: scopedClicks,
      metrics: {
        total_assigned_links: scopedLinks.length,
        total_assigned_campaigns: assignedCampaignIds.length,
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
