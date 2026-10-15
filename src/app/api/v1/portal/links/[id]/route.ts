import { NextResponse } from 'next/server';
import { sql, initializeDatabase } from '@/lib/postgres';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase();
    const { id: linkId } = await params;
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Malformed JSON payload.' }, { status: 400 });
    }

    const { client_id, destination_url } = body;

    if (!client_id || typeof client_id !== 'string') {
      return NextResponse.json({ success: false, error: 'Field "client_id" is required.' }, { status: 400 });
    }
    if (!destination_url || typeof destination_url !== 'string' || !destination_url.trim()) {
      return NextResponse.json({ success: false, error: 'Field "destination_url" is required.' }, { status: 400 });
    }

    // 1. Fetch client account
    const clientRows = await sql.query(
      `SELECT * FROM client_portals WHERE id = $1 AND status = 'active' LIMIT 1`,
      [client_id]
    );

    if (!clientRows || clientRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Client account not found or suspended.' },
        { status: 404 }
      );
    }

    const client = clientRows[0];

    // 2. Permission check
    if (!client.can_edit_destination_url) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: Your client account is view-only and cannot edit destination URLs.' },
        { status: 403 }
      );
    }

    // 3. Scoping check: is this link assigned to this client?
    const assignedLinks: string[] = typeof client.assigned_link_ids === 'string'
      ? JSON.parse(client.assigned_link_ids)
      : (client.assigned_link_ids || []);
    const assignedCampaigns: string[] = typeof client.assigned_campaign_ids === 'string'
      ? JSON.parse(client.assigned_campaign_ids)
      : (client.assigned_campaign_ids || []);

    const linkRows = await sql.query(
      `SELECT id, campaign_id, destination_url FROM links WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [linkId, client.workspace_id]
    );

    if (!linkRows || linkRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Link not found in your assigned workspace.' }, { status: 404 });
    }

    const targetLink = linkRows[0];
    const isExplicitlyAssigned = assignedLinks.includes(linkId);
    const isCampaignAssigned = targetLink.campaign_id && assignedCampaigns.includes(targetLink.campaign_id);

    if (!isExplicitlyAssigned && !isCampaignAssigned) {
      return NextResponse.json(
        { success: false, error: 'Access denied: You do not have permission to modify this specific link.' },
        { status: 403 }
      );
    }

    // 4. Clean and normalize destination URL
    let cleanUrl = destination_url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    // 5. Update destination URL only
    await sql.query(
      `UPDATE links SET destination_url = $1, updated_at = NOW() WHERE id = $2`,
      [cleanUrl, linkId]
    );

    return NextResponse.json({
      success: true,
      message: 'Destination URL updated successfully by client.',
      destination_url: cleanUrl,
      link: {
        id: linkId,
        destination_url: cleanUrl
      }
    });
  } catch (error) {
    console.error('Error updating destination URL from portal:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
