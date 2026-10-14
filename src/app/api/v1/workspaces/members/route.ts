import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/postgres';
import { TeamMember, WorkspaceInvitation, WorkspaceRole } from '@/lib/types';

interface RawMemberRow {
  id: string;
  workspace_id: string;
  user_id?: string | null;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at?: string | null;
}

interface RawInvitationRow {
  id: string;
  workspace_id: string;
  inviter_email?: string | null;
  name: string;
  email: string;
  role: string;
  token: string;
  status: string;
  expires_at?: string | null;
  created_at?: string | null;
}

function getBaseUrl(request: Request): string {
  const origin = request.headers.get('origin');
  if (origin) return origin;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`;
  return 'https://tiny-url-self.vercel.app';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id') || request.headers.get('x-workspace-id');

    if (!workspaceId) {
      return NextResponse.json({ success: true, members: [], invitations: [] });
    }

    const baseUrl = getBaseUrl(request);

    // 1. Fetch active members
    const memberRows = (await sql.query(`
      SELECT * FROM workspace_members
      WHERE workspace_id = $1
      ORDER BY created_at ASC
    `, [workspaceId.trim()])) as unknown as RawMemberRow[];

    // 2. Fetch pending invitations
    const inviteRows = (await sql.query(`
      SELECT * FROM workspace_invitations
      WHERE workspace_id = $1 AND status = 'pending' AND expires_at > NOW()
      ORDER BY created_at DESC
    `, [workspaceId.trim()])) as unknown as RawInvitationRow[];

    const formattedMembers: TeamMember[] = (memberRows || []).map(m => {
      const initials = (m.name || 'TM').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'TM';
      return {
        id: m.id,
        workspace_id: m.workspace_id,
        user_id: m.user_id || undefined,
        name: m.name,
        email: m.email,
        role: (m.role as WorkspaceRole) || 'editor',
        status: (m.status as 'active' | 'invited') || 'active',
        avatar: initials,
        created_at: m.created_at || new Date().toISOString()
      };
    });

    const formattedInvitations: WorkspaceInvitation[] = (inviteRows || []).map(inv => ({
      id: inv.id,
      workspace_id: inv.workspace_id,
      inviter_email: inv.inviter_email || undefined,
      name: inv.name,
      email: inv.email,
      role: (inv.role as WorkspaceRole) || 'editor',
      token: inv.token,
      status: (inv.status as 'pending' | 'accepted' | 'revoked' | 'expired') || 'pending',
      expires_at: inv.expires_at || undefined,
      created_at: inv.created_at || new Date().toISOString(),
      invite_url: `${baseUrl}/invite/${inv.token}`
    }));

    return NextResponse.json({
      success: true,
      members: formattedMembers,
      invitations: formattedInvitations
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg, members: [], invitations: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workspace_id, name, email, role, inviter_email } = body;

    if (!workspace_id || !name || !email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Fields "workspace_id", "name", and "email" are required.' 
      }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanRole: WorkspaceRole = ['admin', 'editor', 'viewer'].includes(role) ? role : 'editor';
    const baseUrl = getBaseUrl(request);

    // Generate secure 48-character hex token
    const token = crypto.randomBytes(24).toString('hex');
    const inviteId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const memberId = `tm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. Invalidate any prior pending invitations for this email in this workspace
    await sql.query(`
      UPDATE workspace_invitations 
      SET status = 'revoked'
      WHERE workspace_id = $1 AND LOWER(email) = $2 AND status = 'pending'
    `, [workspace_id.trim(), cleanEmail]).catch(() => {});

    // 2. Insert invitation record
    const inviteRows = (await sql.query(`
      INSERT INTO workspace_invitations (id, workspace_id, inviter_email, name, email, role, token, status, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW() + INTERVAL '7 days', NOW())
      RETURNING *
    `, [
      inviteId,
      workspace_id.trim(),
      inviter_email ? inviter_email.trim() : null,
      cleanName,
      cleanEmail,
      cleanRole,
      token
    ])) as unknown as RawInvitationRow[];

    // 3. Upsert member record in workspace_members with status 'invited'
    await sql.query(`
      INSERT INTO workspace_members (id, workspace_id, name, email, role, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'invited', NOW())
      ON CONFLICT (workspace_id, email) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        status = 'invited'
    `, [
      memberId,
      workspace_id.trim(),
      cleanName,
      cleanEmail,
      cleanRole
    ]).catch(() => {});

    const inviteUrl = `${baseUrl}/invite/${token}`;

    const createdInvite = inviteRows && inviteRows.length > 0 ? inviteRows[0] : null;

    return NextResponse.json({
      success: true,
      message: 'Invitation generated successfully.',
      invitation: {
        id: createdInvite?.id || inviteId,
        workspace_id,
        name: cleanName,
        email: cleanEmail,
        role: cleanRole,
        token,
        invite_url: inviteUrl,
        expires_at: createdInvite?.expires_at,
        created_at: createdInvite?.created_at
      }
    }, { status: 201 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const email = searchParams.get('email');
    const workspaceId = searchParams.get('workspace_id');

    if (!id && !email) {
      return NextResponse.json({ success: false, error: 'Member ID or Email is required.' }, { status: 400 });
    }

    if (id) {
      await sql.query(`DELETE FROM workspace_members WHERE id = $1`, [id.trim()]);
      await sql.query(`UPDATE workspace_invitations SET status = 'revoked' WHERE id = $1`, [id.trim()]);
    } else if (email && workspaceId) {
      await sql.query(`
        DELETE FROM workspace_members 
        WHERE LOWER(email) = LOWER($1) AND workspace_id = $2
      `, [email.trim(), workspaceId.trim()]);
      await sql.query(`
        UPDATE workspace_invitations 
        SET status = 'revoked' 
        WHERE LOWER(email) = LOWER($1) AND workspace_id = $2
      `, [email.trim(), workspaceId.trim()]);
    }

    return NextResponse.json({
      success: true,
      message: 'Team member or invitation removed successfully.'
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
