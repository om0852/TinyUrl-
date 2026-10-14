import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/postgres';
import { ApiKey } from '@/lib/types';

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
    const workspaceId = searchParams.get('workspace_id');

    let rows: RawApiKeyRow[] = [];
    if (workspaceId) {
      rows = (await sql.query(
        `SELECT id, workspace_id, name, key_prefix, permissions, created_at, last_used
         FROM api_keys
         WHERE workspace_id = $1
         ORDER BY created_at DESC`,
        [workspaceId.trim()]
      )) as unknown as RawApiKeyRow[];
    } else {
      rows = (await sql.query(
        `SELECT id, workspace_id, name, key_prefix, permissions, created_at, last_used
         FROM api_keys
         ORDER BY created_at DESC LIMIT 50`
      )) as unknown as RawApiKeyRow[];
    }

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

import { verifyWorkspacePermission } from '@/lib/serverAuth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, workspace_id, permissions } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ success: false, error: 'Key name is required.' }, { status: 400 });
    }

    const wsId = workspace_id || 'ws_default';

    // RBAC: Requires api_keys:manage permission (owner, admin only)
    const authResult = await verifyWorkspacePermission(request, 'api_keys:manage', {
      workspaceId: wsId
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const secretRandom = crypto.randomBytes(24).toString('hex');
    const fullKey = `sk_live_${secretRandom}`;
    const keyPrefix = fullKey.substring(0, 15);
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
    const keyId = `key_${crypto.randomUUID()}`;
    const perms = Array.isArray(permissions) ? permissions : ['links:read', 'links:write', 'analytics:read'];

    await sql.query(
      `INSERT INTO api_keys (id, workspace_id, name, key_prefix, key_hash, permissions, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [keyId, wsId, name.trim(), keyPrefix, keyHash, JSON.stringify(perms)]
    );

    const newKey: ApiKey = {
      id: keyId,
      workspace_id: wsId,
      name: name.trim(),
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
      `DELETE FROM api_keys WHERE id = $1 RETURNING *`,
      [cleanId]
    )) as unknown as RawApiKeyRow[];

    return NextResponse.json({
      success: true,
      message: 'API Key revoked successfully.',
      deleted: rows && rows.length > 0 ? rows[0] : null
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

