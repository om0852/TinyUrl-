import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { verifyWorkspacePermission } from '@/lib/serverAuth';
import { PORTAL_COOKIE, createPortalToken, portalCookieOptions } from '@/lib/session';

// "Preview portal" for agency staff: opens a client's dashboard as that client, for one hour.
// Requires clients:manage in the client's own workspace (the preview link used to be a plain
// ?client_id= URL that anyone holding it could open).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = (searchParams.get('client_id') || '').trim();
  if (!clientId) {
    return NextResponse.json({ success: false, error: 'client_id is required.' }, { status: 400 });
  }

  const rows = (await sql.query(
    `SELECT id, workspace_id FROM client_portals WHERE id = $1 LIMIT 1`,
    [clientId]
  ).catch(() => [])) as { id: string; workspace_id: string }[];
  if (!rows?.[0]) {
    return NextResponse.json({ success: false, error: 'Client not found.' }, { status: 404 });
  }

  const auth = await verifyWorkspacePermission(request, 'clients:manage', { workspaceId: rows[0].workspace_id });
  if (!auth.success) return auth.response;

  const res = NextResponse.redirect(new URL('/portal/dashboard', request.url));
  res.cookies.set(PORTAL_COOKIE, createPortalToken(rows[0].id, 60 * 60), portalCookieOptions(60 * 60));
  return res;
}
