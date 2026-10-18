import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql, initializeDatabase } from '@/lib/postgres';

function hashPassword(password: string, iterations = 210000): string {
  const salt = 'client_portal_salt_2026';
  return crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
}

function verifyClientPassword(password: string, storedHash?: string): boolean {
  if (!storedHash) return false;
  try {
    const bufTarget = Buffer.from(storedHash, 'utf8');
    const hash210k = hashPassword(password, 210000);
    const buf210k = Buffer.from(hash210k, 'utf8');
    if (buf210k.length === bufTarget.length && crypto.timingSafeEqual(buf210k, bufTarget)) {
      return true;
    }
    const hash10k = hashPassword(password, 10000);
    const buf10k = Buffer.from(hash10k, 'utf8');
    if (buf10k.length === bufTarget.length && crypto.timingSafeEqual(buf10k, bufTarget)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
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

    const { email, password, client_id } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false, error: 'Field "email" is required.' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ success: false, error: 'Field "password" is required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const passHash = hashPassword(password.trim());

    let query = `SELECT * FROM client_portals WHERE LOWER(email) = $1 LIMIT 1`;
    let queryParams = [cleanEmail];

    if (client_id && typeof client_id === 'string') {
      query = `SELECT * FROM client_portals WHERE id = $1 AND LOWER(email) = $2 LIMIT 1`;
      queryParams = [client_id, cleanEmail];
    }

    const rows = await sql.query(query, queryParams);

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid client portal credentials.' },
        { status: 401 }
      );
    }

    const client = rows[0];

    // Check account status
    if (client.status === 'suspended') {
      return NextResponse.json(
        { success: false, error: 'This client portal has been suspended. Please contact your agency administrator.' },
        { status: 403 }
      );
    }

    // Verify password hash with timing-safe comparison
    if (!verifyClientPassword(password.trim(), client.password_hash)) {
      return NextResponse.json(
        { success: false, error: 'Incorrect client portal password.' },
        { status: 401 }
      );
    }

    // Increment total_logins and update last_login_at
    await sql.query(
      `UPDATE client_portals 
       SET total_logins = total_logins + 1, last_login_at = NOW(), updated_at = NOW() 
       WHERE id = $1`,
      [client.id]
    );

    const token = crypto.randomBytes(32).toString('hex');

    const clientProfile = {
      id: client.id,
      workspace_id: client.workspace_id,
      name: client.name,
      email: client.email,
      company_name: client.company_name,
      custom_domain: client.custom_domain,
      brand_logo_url: client.brand_logo_url,
      brand_color: client.brand_color,
      can_view_analytics: client.can_view_analytics,
      can_edit_destination_url: client.can_edit_destination_url,
      can_create_links: client.can_create_links,
      max_links_quota: client.max_links_quota,
      assigned_link_ids: typeof client.assigned_link_ids === 'string' ? JSON.parse(client.assigned_link_ids) : (client.assigned_link_ids || []),
      assigned_campaign_ids: typeof client.assigned_campaign_ids === 'string' ? JSON.parse(client.assigned_campaign_ids) : (client.assigned_campaign_ids || []),
      assigned_channel: client.assigned_channel,
      total_logins: (client.total_logins || 0) + 1,
      last_login_at: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: 'Client portal authenticated successfully.',
      token,
      client: clientProfile
    });
  } catch (error) {
    console.error('Client portal auth error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error.' },
      { status: 500 }
    );
  }
}
