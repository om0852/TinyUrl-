import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/postgres';
import { Webhook } from '@/lib/types';
import { verifyWorkspacePermission } from '@/lib/serverAuth';
import { isSafeOutboundUrl } from '@/lib/security';

const WEBHOOK_EVENTS = ['link.created', 'link.clicked', 'link.flagged', 'security.alert'];

interface RawWebhookRow {
  id: string;
  workspace_id?: string | null;
  url: string;
  events?: string[] | string | null;
  is_active?: boolean | null;
  secret?: string | null;
  created_at?: string | null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id') || request.headers.get('x-workspace-id');

    if (!workspaceId) {
      return NextResponse.json({
        success: true,
        total: 0,
        webhooks: []
      });
    }

    const authResult = await verifyWorkspacePermission(request, 'api_keys:manage', {
      workspaceId: workspaceId.trim()
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const rows = (await sql.query(
      `SELECT * FROM webhooks WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [workspaceId.trim()]
    )) as unknown as RawWebhookRow[];

    const formatted: Webhook[] = (rows || []).map(r => ({
      id: r.id,
      workspace_id: r.workspace_id || 'ws_default',
      url: r.url,
      events: typeof r.events === 'string'
        ? JSON.parse(r.events)
        : (Array.isArray(r.events) ? r.events : ['click']),
      secret: r.secret || '••••••••',
      active: r.is_active !== false,
      created_at: r.created_at || new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      total: formatted.length,
      webhooks: formatted
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg, webhooks: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, events, workspace_id } = body;

    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
      return NextResponse.json({ success: false, error: 'Valid webhook URL (HTTP/HTTPS) is required.' }, { status: 400 });
    }

    const safeUrlCheck = isSafeOutboundUrl(url.trim());
    if (!safeUrlCheck.safe) {
      return NextResponse.json({
        success: false,
        error: `Security Error: Prohibited webhook target URL. ${safeUrlCheck.reason}`
      }, { status: 422 });
    }

    if (!workspace_id || typeof workspace_id !== 'string') {
      return NextResponse.json({ success: false, error: 'workspace_id is required.' }, { status: 400 });
    }

    // RBAC: Requires api_keys:manage permission (owner, admin only)
    const authResult = await verifyWorkspacePermission(request, 'api_keys:manage', {
      workspaceId: workspace_id.trim()
    });
    if (!authResult.success) {
      return authResult.response;
    }
    const wsId = authResult.context.workspaceId;

    const webhookId = `wh_${crypto.randomUUID()}`;
    const evList = (Array.isArray(events) ? events.map(String) : ['link.created', 'link.clicked']).filter(e => WEBHOOK_EVENTS.includes(e));
    if (evList.length === 0) {
      return NextResponse.json({ success: false, error: `Choose at least one event: ${WEBHOOK_EVENTS.join(', ')}.` }, { status: 400 });
    }
    const secret = `whsec_${crypto.randomBytes(16).toString('hex')}`;

    const rows = (await sql.query(
      `INSERT INTO webhooks (id, workspace_id, url, events, is_active, secret, created_at)
       VALUES ($1, $2, $3, $4, true, $5, NOW())
       RETURNING *`,
      [webhookId, wsId, url.trim(), JSON.stringify(evList), secret]
    )) as unknown as RawWebhookRow[];

    const created = rows && rows.length > 0 ? rows[0] : null;

    return NextResponse.json({
      success: true,
      message: 'Webhook registered successfully.',
      webhook: created ? {
        id: created.id,
        workspace_id: wsId,
        url: created.url,
        events: evList,
        secret: secret,
        active: true,
        created_at: created.created_at || new Date().toISOString()
      } : null,
      secret
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, is_active } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Webhook ID is required.' }, { status: 400 });
    }

    const cleanId = id.trim();

    // RBAC: Requires api_keys:manage permission (owner, admin only)
    const authResult = await verifyWorkspacePermission(request, 'api_keys:manage', {
      webhookId: cleanId
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const active = is_active !== undefined ? !!is_active : true;

    const rows = (await sql.query(
      `UPDATE webhooks SET is_active = $1 WHERE id = $2 AND workspace_id = $3 RETURNING id, url, events, is_active, created_at`,
      [active, cleanId, authResult.context.workspaceId]
    )) as unknown as RawWebhookRow[];
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Webhook not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook updated successfully.',
      webhook: rows[0]
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Webhook ID is required.' }, { status: 400 });
    }

    const cleanId = id.trim();

    // RBAC: Requires api_keys:manage permission (owner, admin only)
    const authResult = await verifyWorkspacePermission(request, 'api_keys:manage', {
      webhookId: cleanId
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const rows = (await sql.query(
      `DELETE FROM webhooks WHERE id = $1 AND workspace_id = $2 RETURNING id, url`,
      [cleanId, authResult.context.workspaceId]
    )) as unknown as RawWebhookRow[];
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Webhook not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully.',
      deleted: rows[0]
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-workspace-id, x-user-email'
    }
  });
}

