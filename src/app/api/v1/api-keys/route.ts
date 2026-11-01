import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/postgres';
import { ApiKey } from '@/lib/types';
import { verifyWorkspacePermission } from '@/lib/serverAuth';
import { hasPermission, Permission } from '@/lib/rbac';

// Scopes a key can carry. links:read / links:write are older aliases serverAuth still accepts
// (read = export:data, write = any links:* action). Wildcards like "*" or "admin" are not
// accepted: they let an admin mint a key with owner-only powers such as settings:manage.
const KEY_SCOPES: Record<string, Permission> = {
  'links:create': 'links:create',
  'links:edit': 'links:edit',
  'links:delete': 'links:delete',
  'links:read': 'export:data',
  // links:write also covers deleting (serverAuth treats it as every links:* action)
  'links:write': 'links:delete',
  'campaigns:create': 'campaigns:create',
  'analytics:read': 'analytics:read',
  'export:data': 'export:data'
};

interface RawApiKeyRow {
  id: string;
  workspace_id?: string | null;
  name: string;
  key_prefix: string;
  key_hash: string;
  permissions?: string[] | string | null;
  created_at?: string | null;
  last_used?: string | null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // ?whoami=1 with a Bearer key: the workspace and scopes of that key, so the CLI and MCP
    // server work without a configured workspace id (keys only work in their own workspace)
    if (searchParams.get('whoami') === '1') {
      const auth = request.headers.get('authorization') || '';
      const token = (request.headers.get('x-api-key') || (auth.startsWith('Bearer ') ? auth.slice(7) : '')).trim();
      if (!token) {
        return NextResponse.json({ success: false, error: 'Send an API key as Authorization: Bearer <key>.' }, { status: 401 });
      }
      const keyHash = crypto.createHash('sha256').update(token).digest('hex');
      const rows = (await sql.query(
        `SELECT id, name, workspace_id, permissions FROM api_keys WHERE key_hash = $1 LIMIT 1`,
        [keyHash]
      )) as unknown as RawApiKeyRow[];
      if (!rows || rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Invalid or revoked API key.' }, { status: 401 });
      }
      const k = rows[0];
      return NextResponse.json({
        success: true,
        key: {
          id: k.id,
          name: k.name,
          workspace_id: k.workspace_id,
          permissions: typeof k.permissions === 'string' ? JSON.parse(k.permissions) : (k.permissions || [])
        }
      });
    }

    const workspaceId = searchParams.get('workspace_id') || request.headers.get('x-workspace-id');

    if (!workspaceId) {
      return NextResponse.json({
        success: true,
        total: 0,
        keys: []
      });
    }

    const authResult = await verifyWorkspacePermission(request, 'api_keys:manage', {
      workspaceId: workspaceId.trim()
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const rows = (await sql.query(
      `SELECT id, workspace_id, name, key_prefix, permissions, created_at, last_used
       FROM api_keys
       WHERE workspace_id = $1
       ORDER BY created_at DESC`,
      [workspaceId.trim()]
    )) as unknown as RawApiKeyRow[];

    const formatted: ApiKey[] = (rows || []).map(r => ({
      id: r.id,
      workspace_id: r.workspace_id || 'ws_default',
      name: r.name,
      key_prefix: r.key_prefix,
      full_key: `${r.key_prefix}...••••••••`,
      created_at: r.created_at || new Date().toISOString(),
      last_used: r.last_used || undefined,
      permissions: typeof r.permissions === 'string'
        ? JSON.parse(r.permissions)
        : (Array.isArray(r.permissions) ? r.permissions : ['links:read', 'links:write'])
    }));

    return NextResponse.json({
      success: true,
      total: formatted.length,
      keys: formatted
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg, keys: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, workspace_id, permissions } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ success: false, error: 'Key name is required.' }, { status: 400 });
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

    const requested: string[] = Array.isArray(permissions) ? permissions.map(String) : ['links:read', 'links:write', 'analytics:read'];
    const unknown = requested.filter(p => !KEY_SCOPES[p]);
    if (unknown.length > 0) {
      return NextResponse.json({ success: false, error: `Unknown scope: ${unknown.join(', ')}. Allowed: ${Object.keys(KEY_SCOPES).join(', ')}.` }, { status: 400 });
    }
    // A key can't do more than the person creating it
    const beyondRole = requested.filter(p => !hasPermission(authResult.context.role, KEY_SCOPES[p]));
    if (beyondRole.length > 0) {
      return NextResponse.json({ success: false, error: `Your role can't grant: ${beyondRole.join(', ')}.` }, { status: 403 });
    }
    if (requested.length === 0) {
      return NextResponse.json({ success: false, error: 'Choose at least one scope.' }, { status: 400 });
    }

    const secretRandom = crypto.randomBytes(24).toString('hex');
    const fullKey = `sk_live_${secretRandom}`;
    const keyPrefix = fullKey.substring(0, 15);
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
    const keyId = `key_${crypto.randomUUID()}`;
    const perms = [...new Set(requested)];

    await sql.query(
      `INSERT INTO api_keys (id, workspace_id, name, key_prefix, key_hash, permissions, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [keyId, wsId, name.trim().slice(0, 100), keyPrefix, keyHash, JSON.stringify(perms)]
    );

    const newKey: ApiKey = {
      id: keyId,
      workspace_id: wsId,
      name: name.trim().slice(0, 100),
      key_prefix: keyPrefix,
      full_key: fullKey,
      created_at: new Date().toISOString(),
      permissions: perms
    };

    return NextResponse.json({
      success: true,
      message: 'API Key generated successfully.',
      key: newKey,
      full_key: fullKey
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

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Key ID is required.' }, { status: 400 });
    }

    const cleanId = id.trim();

    // RBAC: Requires api_keys:manage permission (owner, admin only)
    const authResult = await verifyWorkspacePermission(request, 'api_keys:manage', {
      apiKeyId: cleanId
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const rows = (await sql.query(
      `DELETE FROM api_keys WHERE id = $1 AND workspace_id = $2 RETURNING id, name, key_prefix`,
      [cleanId, authResult.context.workspaceId]
    )) as unknown as RawApiKeyRow[];
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'API key not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'API Key revoked successfully.',
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
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-workspace-id, x-user-email'
    }
  });
}

