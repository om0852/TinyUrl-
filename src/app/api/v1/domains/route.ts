import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { Domain } from '@/lib/types';

interface RawDomainRow {
  id: string;
  workspace_id?: string | null;
  hostname: string;
  verified?: boolean | null;
  ssl_status?: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    let rows: RawDomainRow[] = [];
    if (workspaceId) {
      rows = (await sql.query(
        `SELECT * FROM domains WHERE workspace_id = $1 ORDER BY created_at DESC`,
        [workspaceId.trim()]
      )) as unknown as RawDomainRow[];
    } else {
      rows = (await sql.query(
        `SELECT * FROM domains ORDER BY created_at DESC LIMIT 50`
      )) as unknown as RawDomainRow[];
    }

    const formatted: Domain[] = (rows || []).map(r => ({
      id: r.id,
      workspace_id: r.workspace_id || 'ws_default',
      hostname: r.hostname,
      verified: !!r.verified,
      ssl_status: (r.ssl_status as 'active' | 'pending' | 'failed') || 'active',
      is_default: !!r.is_primary
    }));

    return NextResponse.json({
      success: true,
      total: formatted.length,
      domains: formatted
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg, domains: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, workspace_id, hostname, is_default } = body;

    if (!hostname || typeof hostname !== 'string') {
      return NextResponse.json({ success: false, error: 'Hostname is required.' }, { status: 400 });
    }

    const cleanHost = hostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const cleanId = (id && typeof id === 'string') ? id.trim() : `dom_${Date.now()}`;
    const cleanWsId = workspace_id || 'ws_default';

    const rows = (await sql.query(
      `INSERT INTO domains (id, workspace_id, hostname, verified, ssl_status, is_primary, created_at)
       VALUES ($1, $2, $3, false, 'pending', $4, NOW())
       ON CONFLICT (hostname) DO UPDATE
       SET workspace_id = EXCLUDED.workspace_id, is_primary = EXCLUDED.is_primary
       RETURNING *`,
      [cleanId, cleanWsId, cleanHost, !!is_default]
    )) as unknown as RawDomainRow[];

    return NextResponse.json({
      success: true,
      message: 'Custom domain registered.',
      domain: rows && rows.length > 0 ? rows[0] : null
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, hostname, verified, ssl_status } = body;

    const target = id || hostname;
    if (!target || typeof target !== 'string') {
      return NextResponse.json({ success: false, error: 'Domain ID or hostname is required.' }, { status: 400 });
    }

    const isVerified = verified !== undefined ? !!verified : true;
    const ssl = ssl_status || 'active';

    const rows = (await sql.query(
      `UPDATE domains
       SET verified = $1, ssl_status = $2
       WHERE id = $3 OR LOWER(hostname) = LOWER($3)
       RETURNING *`,
      [isVerified, ssl, target.trim()]
    )) as unknown as RawDomainRow[];

    return NextResponse.json({
      success: true,
      message: 'Domain verified successfully.',
      domain: rows && rows.length > 0 ? rows[0] : null
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || searchParams.get('hostname');

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Domain ID or hostname is required.' }, { status: 400 });
    }

    const rows = (await sql.query(
      `DELETE FROM domains WHERE id = $1 OR LOWER(hostname) = LOWER($1) RETURNING *`,
      [id.trim()]
    )) as unknown as RawDomainRow[];

    return NextResponse.json({
      success: true,
      message: 'Domain deleted successfully.',
      deleted: rows && rows.length > 0 ? rows[0] : null
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
