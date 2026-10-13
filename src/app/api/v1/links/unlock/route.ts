import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export async function POST(request: Request) {
  try {
    let body: { code?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Malformed JSON payload.' }, { status: 400 });
    }

    const { code, password } = body;
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: 'Short link code is required.' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ success: false, error: 'Password is required.' }, { status: 400 });
    }

    const cleanCode = code.trim().toLowerCase();
    const rows = await sql.query(
      `SELECT id, short_code, destination_url, password_hash, rules, status, expires_at, max_clicks, clicks_count 
       FROM links 
       WHERE LOWER(short_code) = $1 LIMIT 1`,
      [cleanCode]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Link not found.' }, { status: 404 });
    }

    const link = rows[0];

    // Status guards
    if (link.status === 'disabled') {
      return NextResponse.json({ success: false, error: 'This link has been disabled.' }, { status: 403 });
    }
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: 'This link has expired.' }, { status: 410 });
    }
    if (link.max_clicks && link.clicks_count >= link.max_clicks) {
      return NextResponse.json({ success: false, error: 'This link has reached its maximum click limit.' }, { status: 410 });
    }

    // Server-side password verification
    if (!link.password_hash || link.password_hash === password.trim()) {
      let dest = link.destination_url;
      const rules = typeof link.rules === 'string' ? JSON.parse(link.rules) : (link.rules || []);

      return NextResponse.json({
        success: true,
        destination_url: dest,
        rules
      });
    }

    return NextResponse.json({ success: false, error: 'Incorrect password. Access denied.' }, { status: 401 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server verification error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
