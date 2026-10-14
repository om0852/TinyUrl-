import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/postgres';
import { User, Workspace } from '@/lib/types';

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const workspaceId = searchParams.get('workspace_id');
    const history = searchParams.get('history') === 'true';

    // 1. Fetch History for workspace or user
    if (history) {
      const rows = await sql.query(`
        SELECT 
          i.id,
          i.workspace_id,
          w.name as workspace_name,
          w.slug as workspace_slug,
          i.inviter_email,
          i.name,
          i.email,
          i.role,
          i.status,
          i.expires_at,
          i.created_at,
          i.accepted_at
        FROM workspace_invitations i
        LEFT JOIN workspaces w ON w.id = i.workspace_id
        WHERE ($1::text IS NOT NULL AND i.workspace_id = $1)
           OR ($2::text IS NOT NULL AND LOWER(i.email) = LOWER($2))
        ORDER BY i.created_at DESC
        LIMIT 50
      `, [workspaceId || null, email ? email.trim() : null]);

      return NextResponse.json({
        success: true,
        history: rows || []
      });
    }

    // 2. Fetch Incoming Invitations for a logged-in user
    if (email && !token) {
      const cleanEmail = email.trim().toLowerCase();
      const rows = await sql.query(`
        SELECT 
          i.id,
          i.workspace_id,
          w.name as workspace_name,
          w.slug as workspace_slug,
          w.plan as workspace_plan,
          i.inviter_email,
          i.name,
          i.email,
          i.role,
          i.token,
          i.status,
          i.expires_at,
          i.created_at
        FROM workspace_invitations i
        LEFT JOIN workspaces w ON w.id = i.workspace_id
        WHERE LOWER(i.email) = $1 AND i.status = 'pending' AND i.expires_at > NOW()
        ORDER BY i.created_at DESC
      `, [cleanEmail]);

      return NextResponse.json({
        success: true,
        incoming: rows || []
      });
    }

    // 3. Verify single token (for /invite/[token] page)
    if (!token || typeof token !== 'string' || !token.trim()) {
      return NextResponse.json({ success: false, error: 'Invitation token or email is required.' }, { status: 400 });
    }

    const rows = await sql.query(`
      SELECT 
        i.id,
        i.workspace_id,
        w.name as workspace_name,
        w.slug as workspace_slug,
        i.inviter_email,
        i.name,
        i.email,
        i.role,
        i.status,
        i.expires_at,
        i.created_at
      FROM workspace_invitations i
      LEFT JOIN workspaces w ON w.id = i.workspace_id
      WHERE i.token = $1
      LIMIT 1
    `, [token.trim()]);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid or non-existent invitation token.' 
      }, { status: 404 });
    }

    const inv = rows[0];

    if (inv.status === 'accepted') {
      return NextResponse.json({
        success: false,
        error: 'This invitation has already been accepted.',
        alreadyAccepted: true
      }, { status: 409 });
    }

    if (inv.status === 'revoked') {
      return NextResponse.json({
        success: false,
        error: 'This invitation has been revoked by the workspace administrator.'
      }, { status: 410 });
    }

    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      return NextResponse.json({
        success: false,
        error: 'This invitation link has expired. Please ask for a new invite.'
      }, { status: 410 });
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: inv.id,
        workspace_id: inv.workspace_id,
        workspace_name: inv.workspace_name || 'Collaborative Workspace',
        workspace_slug: inv.workspace_slug || 'workspace',
        inviter_email: inv.inviter_email || 'Workspace Admin',
        name: inv.name,
        email: inv.email,
        role: inv.role,
        expires_at: inv.expires_at,
        created_at: inv.created_at
      }
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, name, password, action, user_id } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ success: false, error: 'Invitation token is required.' }, { status: 400 });
    }

    // 1. Verify invitation token
    const inviteRows = await sql.query(`
      SELECT 
        i.*,
        w.name as workspace_name,
        w.slug as workspace_slug,
        w.plan as workspace_plan
      FROM workspace_invitations i
      LEFT JOIN workspaces w ON w.id = i.workspace_id
      WHERE i.token = $1
      LIMIT 1
    `, [token.trim()]);

    if (!inviteRows || inviteRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid invitation token.' }, { status: 404 });
    }

    const invite = inviteRows[0];

    const cleanEmail = invite.email.trim().toLowerCase();
    const cleanName = (name && typeof name === 'string' ? name.trim() : '') || invite.name || cleanEmail.split('@')[0];

    // Handle Decline Action
    if (action === 'decline') {
      await sql.query(`UPDATE workspace_invitations SET status = 'revoked' WHERE token = $1`, [token.trim()]);
      await sql.query(`
        DELETE FROM workspace_members 
        WHERE workspace_id = $1 AND LOWER(email) = $2 AND status = 'invited'
      `, [invite.workspace_id, cleanEmail]).catch(() => {});
      return NextResponse.json({ success: true, message: 'Invitation declined successfully.' });
    }

    if (invite.status === 'accepted') {
      return NextResponse.json({ success: false, error: 'This invitation was already accepted.' }, { status: 409 });
    }

    if (invite.status === 'revoked') {
      return NextResponse.json({ success: false, error: 'This invitation has been revoked.' }, { status: 410 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: 'This invitation has expired.' }, { status: 410 });
    }

    // 2. Check if user already exists
    let userRow: { id: string; name: string; email: string; role: string } | null = null;
    const existingUsers = await sql.query(`
      SELECT id, name, email, password_hash, salt, role 
      FROM users 
      WHERE LOWER(email) = $1 
      LIMIT 1
    `, [cleanEmail]);

    if (existingUsers && existingUsers.length > 0) {
      const existing = existingUsers[0];
      // If user is not already logged in, verify password
      if (!user_id && password && typeof password === 'string' && password.trim()) {
        const computedHash = hashPassword(password.trim(), existing.salt);
        const isMatch = crypto.timingSafeEqual(
          Buffer.from(computedHash, 'utf8'),
          Buffer.from(existing.password_hash, 'utf8')
        );
        if (!isMatch) {
          return NextResponse.json({ 
            success: false, 
            error: 'Account already exists for this email, but the password provided is incorrect.' 
          }, { status: 401 });
        }
      }
      userRow = {
        id: String(existing.id),
        name: String(existing.name || cleanName),
        email: String(existing.email || cleanEmail),
        role: String(existing.role || invite.role)
      };
    } else {
      // 3. New User Registration
      if (!password || password.length < 6) {
        return NextResponse.json({ 
          success: false, 
          error: 'Please choose a password with at least 6 characters to complete your account setup.' 
        }, { status: 422 });
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);
      const newUserId = `usr_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`}`;

      await sql.query(`
        INSERT INTO users (id, name, email, password_hash, salt, role)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [newUserId, cleanName, cleanEmail, passwordHash, salt, invite.role]);

      userRow = {
        id: newUserId,
        name: cleanName,
        email: cleanEmail,
        role: invite.role
      };
    }

    if (!userRow) {
      return NextResponse.json({ success: false, error: 'Failed to resolve user account.' }, { status: 500 });
    }

    // 4. Mark invitation as accepted
    await sql.query(`
      UPDATE workspace_invitations 
      SET status = 'accepted', accepted_at = NOW() 
      WHERE token = $1
    `, [token.trim()]);

    await sql.query(`
      UPDATE workspace_invitations 
      SET status = 'revoked'
      WHERE workspace_id = $1 AND LOWER(email) = $2 AND status = 'pending'
    `, [invite.workspace_id, cleanEmail]).catch(() => {});


    // 5. Upsert workspace_members with active status and linked user_id
    const memberId = `tm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await sql.query(`
      INSERT INTO workspace_members (id, workspace_id, user_id, name, email, role, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
      ON CONFLICT (workspace_id, email) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        status = 'active'
    `, [
      memberId,
      invite.workspace_id,
      userRow.id,
      cleanName,
      cleanEmail,
      invite.role
    ]);

    const initials = cleanName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'U';

    const user: User = {
      id: userRow.id,
      name: cleanName,
      email: cleanEmail,
      avatar: initials,
      role: (invite.role as 'owner' | 'admin' | 'editor' | 'viewer') || 'editor'
    };

    const workspace: Workspace = {
      id: invite.workspace_id,
      name: invite.workspace_name || 'Workspace',
      slug: invite.workspace_slug || 'workspace',
      role: (invite.role as 'owner' | 'admin' | 'editor' | 'viewer') || 'editor',
      plan: invite.workspace_plan || 'pro',
      created_at: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: `You have successfully joined ${workspace.name}!`,
      user,
      workspace
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
