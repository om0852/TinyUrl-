import { NextResponse } from 'next/server';
import { sql, initializeDatabase } from '@/lib/postgres';
import { getPortalClient } from '@/lib/portalAuth';

export async function GET(request: Request) {
  try {
    await initializeDatabase();

    // The client comes from the signed portal cookie, never from the URL
    const client = await getPortalClient(request);
    if (!client) {
      return NextResponse.json({ success: false, error: 'Please sign in to the portal.' }, { status: 401 });
    }

    const assignedLinkIds = client.assigned_link_ids;
    const assignedCampaignIds = client.assigned_campaign_ids;

    // Campaigns and links only from the client's own workspace. Matching links by UTM campaign
    // name or by domain used to pull in other workspaces' links that happened to share a name.
    let scopedCampaigns: Record<string, unknown>[] = [];
    if (assignedCampaignIds.length > 0) {
      scopedCampaigns = (await sql.query(
        `SELECT id, name, description, tags, target_clicks, created_at
         FROM campaigns
         WHERE id = ANY($1::text[]) AND workspace_id = $2`,
        [assignedCampaignIds, client.workspace_id]
      ).catch(() => [])) as Record<string, unknown>[];
    }

    let scopedLinks: Record<string, unknown>[] = [];
    if (assignedLinkIds.length > 0 || assignedCampaignIds.length > 0) {
      scopedLinks = (await sql.query(
        `SELECT id, short_code, custom_slug, destination_url, title, status, clicks_count, created_at, updated_at, campaign_id, utm_campaign
         FROM links
         WHERE workspace_id = $1 AND (id = ANY($2::text[]) OR campaign_id = ANY($3::text[]))
         ORDER BY created_at DESC`,
        [client.workspace_id, assignedLinkIds, assignedCampaignIds]
      ).catch(() => [])) as Record<string, unknown>[];
    }

    const linkIds = scopedLinks.map(l => String(l.id));

    // Click details only when the agency allowed analytics for this client
    let scopedClicks: Record<string, unknown>[] = [];
    if (client.can_view_analytics && linkIds.length > 0) {
      scopedClicks = (await sql.query(
        `SELECT id, link_id, short_code, timestamp, ip_hash, country, city, device, os, browser, referrer, language
         FROM click_events
         WHERE link_id = ANY($1::text[])
         ORDER BY timestamp DESC
         LIMIT 200`,
        [linkIds]
      ).catch(() => [])) as Record<string, unknown>[];
    }

    const totalClicks = scopedLinks.reduce((acc, l) => acc + (Number(l.clicks_count) || 0), 0);
    const uniqueVisitors = new Set(scopedClicks.map(c => c.ip_hash || c.id));

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
        total_assigned_campaigns: scopedCampaigns.length,
        total_clicks: totalClicks,
        // From the most recent 200 clicks; never more than the total
        unique_clicks: Math.min(totalClicks, uniqueVisitors.size),
        quota_used: scopedLinks.length,
        quota_max: client.max_links_quota || 10
      }
    });
  } catch (error) {
    console.error('Error fetching client portal resources:', error);
    return NextResponse.json({ success: false, error: 'Could not load your links. Please try again.' }, { status: 500 });
  }
}
