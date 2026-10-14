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

    // 1. Fetch active members (filter status = 'active' so pending invitations are never duplicated)
    const memberRows = (await sql.query(`
      SELECT * FROM workspace_members
      WHERE workspace_id = $1 AND status = 'active'
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

    let emailSent = false;
    // Dispatch outbound email via Resend if API key is configured
    if (process.env.RESEND_API_KEY) {
      try {
        const mailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'TinyUrl <notifications@resend.dev>',
            to: [cleanEmail],
            subject: `You've been invited to collaborate on TinyUrl`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #0b0f19; color: #f1f5f9; border-radius: 16px; border: 1px solid #1e293b;">
                <div style="font-size: 20px; font-weight: 700; color: #6366f1; margin-bottom: 24px;">TinyUrl Workspace</div>
                <h1 style="font-size: 22px; font-weight: 700; margin-bottom: 12px; color: #ffffff;">Team Invitation</h1>
                <p style="font-size: 15px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px;">
                  Hello <strong style="color: #f1f5f9;">${cleanName}</strong>, you have been invited to join the workspace as a <span style="background: #312e81; color: #c7d2fe; padding: 2px 8px; border-radius: 4px; font-weight: 600; text-transform: uppercase; font-size: 12px;">${cleanRole}</span>.
                </p>
                <div style="margin: 32px 0;">
                  <a href="${inviteUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
                    Accept Invitation &amp; Join Workspace
                  </a>
                </div>
                <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
                  Or open this link directly in your browser:<br/>
                  <a href="${inviteUrl}" style="color: #818cf8; word-break: break-all;">${inviteUrl}</a>
                </p>
                <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #1e293b; font-size: 12px; color: #475569;">
                  This invitation link is valid for 7 days. If you were not expecting this, you can safely ignore this email.
                </div>
              </div>
            `
          }),
          signal: AbortSignal.timeout(5000)
        });
        if (mailRes.ok) {
          emailSent = true;
        }
      } catch (mailErr) {
        console.warn('[Invite] Outbound email dispatch error:', mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: emailSent 
        ? 'Invitation created and email sent successfully.' 
        : 'Invitation link generated successfully.',
      email_sent: emailSent,
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
      // Find email and workspace if it's an invitation or member
      const member = (await sql.query(`SELECT email, workspace_id FROM workspace_members WHERE id = $1`, [id.trim()]).catch(() => [])) as { email?: string; workspace_id?: string }[];
      const inv = (await sql.query(`SELECT email, workspace_id FROM workspace_invitations WHERE id = $1`, [id.trim()]).catch(() => [])) as { email?: string; workspace_id?: string }[];
      
      const targetEmail = member?.[0]?.email || inv?.[0]?.email;
      const targetWs = member?.[0]?.workspace_id || inv?.[0]?.workspace_id;

      await sql.query(`DELETE FROM workspace_members WHERE id = $1`, [id.trim()]).catch(() => {});
      await sql.query(`UPDATE workspace_invitations SET status = 'revoked' WHERE id = $1`, [id.trim()]).catch(() => {});
      await sql.query(`DELETE FROM workspace_invitations WHERE id = $1`, [id.trim()]).catch(() => {});
      
      if (targetEmail && targetWs) {
        await sql.query(`DELETE FROM workspace_members WHERE LOWER(email) = LOWER($1) AND workspace_id = $2`, [targetEmail, targetWs]).catch(() => {});
        await sql.query(`UPDATE workspace_invitations SET status = 'revoked' WHERE LOWER(email) = LOWER($1) AND workspace_id = $2`, [targetEmail, targetWs]).catch(() => {});
      }
    } else if (email && workspaceId) {
      await sql.query(`
        DELETE FROM workspace_members 
        WHERE LOWER(email) = LOWER($1) AND workspace_id = $2
      `, [email.trim(), workspaceId.trim()]).catch(() => {});
      await sql.query(`
        UPDATE workspace_invitations 
        SET status = 'revoked' 
        WHERE LOWER(email) = LOWER($1) AND workspace_id = $2
      `, [email.trim(), workspaceId.trim()]).catch(() => {});
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

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { workspace_id, member_id, role } = body;

    if (!workspace_id || !member_id || !role) {
      return NextResponse.json({ success: false, error: 'Fields workspace_id, member_id, and role are required.' }, { status: 400 });
    }

    const cleanRole: WorkspaceRole = ['admin', 'editor', 'viewer'].includes(role) ? role : 'editor';

    await sql.query(`
      UPDATE workspace_members
      SET role = $1
      WHERE (id = $2 OR LOWER(email) = LOWER($2)) AND workspace_id = $3
    `, [cleanRole, member_id.trim(), workspace_id.trim()]);

    await sql.query(`
      UPDATE workspace_invitations
      SET role = $1
      WHERE (id = $2 OR LOWER(email) = LOWER($2)) AND workspace_id = $3 AND status = 'pending'
    `, [cleanRole, member_id.trim(), workspace_id.trim()]).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Role updated successfully.'
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
