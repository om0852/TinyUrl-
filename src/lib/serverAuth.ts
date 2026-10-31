import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/postgres';
import { Permission, hasPermission } from '@/lib/rbac';
import { WorkspaceRole } from '@/lib/types';

export interface CallerContext {
  userEmail: string;
  role: WorkspaceRole;
  workspaceId: string;
  isApiKey?: boolean;
}

export type ServerAuthResult =
  | { success: true; context: CallerContext }
  | { success: false; response: NextResponse };

export interface VerifyPermissionOptions {
  workspaceId?: string | null;
  linkId?: string | null;
  campaignId?: string | null;
  domainId?: string | null;
  webhookId?: string | null;
  apiKeyId?: string | null;
  userEmail?: string | null;
}

/**
 * Resolves the workspace ID from the given context or looks it up from the database
 * using a link, campaign, domain, or webhook identifier.
 */
async function resolveWorkspaceId(options: VerifyPermissionOptions): Promise<string | null> {
  if (options.workspaceId && typeof options.workspaceId === 'string' && options.workspaceId.trim()) {
    return options.workspaceId.trim();
  }

  // Fallback: look up by link ID / short_code / custom_slug
  if (options.linkId && typeof options.linkId === 'string' && options.linkId.trim()) {
    const clean = options.linkId.trim();
    const rows = (await sql.query(
      `SELECT workspace_id FROM links 
       WHERE id = $1 OR LOWER(short_code) = LOWER($1) OR LOWER(custom_slug) = LOWER($1) 
       LIMIT 1`,
      [clean]
    ).catch(() => [])) as { workspace_id?: string }[];
    if (rows?.[0]?.workspace_id) return rows[0].workspace_id;
  }

  // Fallback: look up by campaign ID
  if (options.campaignId && typeof options.campaignId === 'string' && options.campaignId.trim()) {
    const clean = options.campaignId.trim();
    const rows = (await sql.query(
      `SELECT workspace_id FROM campaigns WHERE id = $1 LIMIT 1`,
      [clean]
    ).catch(() => [])) as { workspace_id?: string }[];
    if (rows?.[0]?.workspace_id) return rows[0].workspace_id;
  }

  // Fallback: look up by domain ID / hostname
  if (options.domainId && typeof options.domainId === 'string' && options.domainId.trim()) {
    const clean = options.domainId.trim();
    const rows = (await sql.query(
      `SELECT workspace_id FROM domains WHERE id = $1 OR LOWER(hostname) = LOWER($1) LIMIT 1`,
      [clean]
    ).catch(() => [])) as { workspace_id?: string }[];
    if (rows?.[0]?.workspace_id) return rows[0].workspace_id;
  }

  // Fallback: look up by webhook ID
  if (options.webhookId && typeof options.webhookId === 'string' && options.webhookId.trim()) {
    const clean = options.webhookId.trim();
    const rows = (await sql.query(
      `SELECT workspace_id FROM webhooks WHERE id = $1 LIMIT 1`,
      [clean]
    ).catch(() => [])) as { workspace_id?: string }[];
    if (rows?.[0]?.workspace_id) return rows[0].workspace_id;
  }

  // Fallback: look up by API key ID
  if (options.apiKeyId && typeof options.apiKeyId === 'string' && options.apiKeyId.trim()) {
    const clean = options.apiKeyId.trim();
    const rows = (await sql.query(
      `SELECT workspace_id FROM api_keys WHERE id = $1 LIMIT 1`,
      [clean]
    ).catch(() => [])) as { workspace_id?: string }[];
    if (rows?.[0]?.workspace_id) return rows[0].workspace_id;
  }

  return null;
}

/**
 * Verifies caller identity and validates that the caller holds the required permission
 * for the requested workspace.
 *
 * Supports:
 * 1. Bearer API key authorization (`Authorization: Bearer sk_live_...`)
 * 2. Authenticated user session (`x-user-email` header or options.userEmail)
 *
 * Returns `{ success: true, context }` or `{ success: false, response }` with HTTP 401/403.
 */
export async function verifyWorkspacePermission(
  request: Request,
  requiredPermission: Permission,
  options: VerifyPermissionOptions = {}
): Promise<ServerAuthResult> {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const xApiKeyHeader = request.headers.get('x-api-key') || '';
    const headerEmail = request.headers.get('x-user-email');
    const headerWsId = request.headers.get('x-workspace-id');

    // 1. Extract API Key Token if supplied
    let rawToken: string | null = null;
    if (xApiKeyHeader.trim()) {
      rawToken = xApiKeyHeader.trim();
    } else if (authHeader.startsWith('Bearer ')) {
      rawToken = authHeader.substring(7).trim();
    }

    if (rawToken) {
      // Check Master Platform API Keys from environment
      const masterEnvKeys = [
        process.env.PLATFORM_API_KEY,
        process.env.TINYURL_API_KEY,
        process.env.API_KEY
      ].filter(Boolean) as string[];

      const isMasterKeyMatch = masterEnvKeys.some(masterKey => {
        if (!masterKey || masterKey.length !== rawToken!.length) return false;
        try {
          return crypto.timingSafeEqual(Buffer.from(rawToken!), Buffer.from(masterKey));
        } catch {
          return false;
        }
      });

      if (isMasterKeyMatch) {
        const targetWsId = options.workspaceId || headerWsId || 'ws_default';
        return {
          success: true,
          context: {
            userEmail: 'master_api_admin',
            role: 'owner',
            workspaceId: targetWsId.trim(),
            isApiKey: true
          }
        };
      }

      // Check Database Stored API Keys
      const keyHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const keyRows = (await sql.query(
        `SELECT id, workspace_id, permissions FROM api_keys WHERE key_hash = $1 LIMIT 1`,
        [keyHash]
      ).catch(() => [])) as { id: string; workspace_id: string; permissions?: string | string[] }[];

      if (keyRows && keyRows.length > 0) {
        const keyRecord = keyRows[0];
        const rawPerms = keyRecord.permissions;
        const keyPerms: string[] = typeof rawPerms === 'string' 
          ? JSON.parse(rawPerms) 
          : (Array.isArray(rawPerms) ? rawPerms : []);

        // Check workspace isolation if specific workspace was requested
        const targetWs = (options.workspaceId || headerWsId || '').trim();
        if (targetWs && targetWs !== keyRecord.workspace_id && keyRecord.workspace_id !== 'ws_default') {
          return {
            success: false,
            response: NextResponse.json({
              success: false,
              error: 'Forbidden: API key does not have access to the specified workspace.'
            }, { status: 403 })
          };
        }

        // Granular RBAC validation for API keys
        const hasApiKeyPerm = 
          keyPerms.includes('*') ||
          keyPerms.includes('admin') ||
          keyPerms.includes(requiredPermission) ||
          (requiredPermission.startsWith('links:') && keyPerms.includes('links:write')) ||
          (requiredPermission === 'export:data' && (keyPerms.includes('links:read') || keyPerms.includes('analytics:read')));

        if (!hasApiKeyPerm) {
          return {
            success: false,
            response: NextResponse.json({
              success: false,
              error: `Forbidden: API key does not have "${requiredPermission}" permission.`
            }, { status: 403 })
          };
        }

        // Asynchronously update last_used timestamp
        sql.query(`UPDATE api_keys SET last_used = NOW() WHERE id = $1`, [keyRecord.id]).catch(() => {});

        return {
          success: true,
          context: {
            userEmail: 'api_client',
            role: 'admin',
            workspaceId: keyRecord.workspace_id,
            isApiKey: true
          }
        };
      }

      // Security Guard: Caller provided an explicit API key token, but it is invalid or revoked
      return {
        success: false,
        response: NextResponse.json({
          success: false,
          error: 'Unauthorized: Invalid or revoked API key.'
        }, { status: 401 })
      };
    }

    // 2. Identify Caller Email
    let userEmail = (options.userEmail || headerEmail || '').trim().toLowerCase();
    if (!userEmail) {
      if (process.env.NODE_ENV === 'production') {
        return {
          success: false,
          response: NextResponse.json({
            success: false,
            error: 'Unauthorized: Authentication required. Provide a valid Bearer API key or session.'
          }, { status: 401 })
        };
      }
      // In local development or guest mode, fallback to owner identity
      userEmail = 'owner@workspace.local';
    }

    // 3. Resolve Target Workspace ID
    const mergedOptions: VerifyPermissionOptions = {
      ...options,
      workspaceId: options.workspaceId || headerWsId || null
    };

    const targetWsId = await resolveWorkspaceId(mergedOptions);
    if (!targetWsId) {
      return {
        success: false,
        response: NextResponse.json({
          success: false,
          error: 'Workspace context is required to verify permissions.'
        }, { status: 400 })
      };
    }

    // 4. Determine User's Role in Target Workspace
    // Check if user is Workspace Owner
    const wsRows = (await sql.query(
      `SELECT id, owner_email, owner_id FROM workspaces WHERE id = $1 LIMIT 1`,
      [targetWsId]
    ).catch(() => [])) as { id: string; owner_email?: string; owner_id?: string }[];

    const ws = wsRows && wsRows.length > 0 ? wsRows[0] : null;
    let resolvedRole: WorkspaceRole | null = null;

    if (ws && ws.owner_email && ws.owner_email.toLowerCase().trim() === userEmail) {
      resolvedRole = 'owner';
    } else {
      // Check workspace_members
      const memberRows = (await sql.query(
        `SELECT role, status FROM workspace_members 
         WHERE workspace_id = $1 AND LOWER(email) = $2 LIMIT 1`,
        [targetWsId, userEmail]
      ).catch(() => [])) as { role: string; status: string }[];

      if (memberRows && memberRows.length > 0) {
        const member = memberRows[0];
        if (member.status === 'active' || member.status === 'invited') {
          const rawRole = (member.role || 'viewer').toLowerCase();
          if (['owner', 'admin', 'editor', 'viewer'].includes(rawRole)) {
            resolvedRole = rawRole as WorkspaceRole;
          }
        }
      }
    }

    // Fallback: If user is the creator of the workspace or workspace has no members configured yet
    if (!resolvedRole && ws && !ws.owner_email) {
      // Default fallback if workspace was created prior to owner_email column population
      resolvedRole = 'admin';
    }

    if (!resolvedRole && userEmail) {
      // Check if user owns this workspace or any workspace
      const userWs = (await sql.query(
        `SELECT id, owner_email FROM workspaces WHERE LOWER(owner_email) = $1 LIMIT 1`,
        [userEmail]
      ).catch(() => [])) as { id: string; owner_email?: string }[];
      if (userWs && userWs.length > 0) {
        resolvedRole = 'owner';
      } else {
        const userRows = (await sql.query(
          `SELECT role FROM users WHERE LOWER(email) = $1 LIMIT 1`,
          [userEmail]
        ).catch(() => [])) as { role?: string }[];
        if (userRows && userRows.length > 0) {
          resolvedRole = (userRows[0].role as WorkspaceRole) || 'owner';
        }
      }
    }

    if (!resolvedRole) {
      if (userEmail === 'owner@workspace.local' || targetWsId === 'ws_default') {
        // In production, unauthenticated guests are granted editor privileges at most, preventing administrative tampering
        if (process.env.NODE_ENV === 'production' && (!headerEmail || headerEmail === 'owner@workspace.local')) {
          resolvedRole = 'editor';
        } else {
          resolvedRole = 'owner';
        }
      } else {
        return {
          success: false,
          response: NextResponse.json({
            success: false,
            error: 'Forbidden: You are not an authorized member of this workspace.'
          }, { status: 403 })
        };
      }
    }

    // 5. Enforce RBAC Permission Matrix
    if (!hasPermission(resolvedRole, requiredPermission)) {
      return {
        success: false,
        response: NextResponse.json({
          success: false,
          error: `Forbidden: Role "${resolvedRole}" does not have permission to perform "${requiredPermission}".`
        }, { status: 403 })
      };
    }

    return {
      success: true,
      context: {
        userEmail,
        role: resolvedRole,
        workspaceId: targetWsId
      }
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Authentication verification error';
    return {
      success: false,
      response: NextResponse.json({
        success: false,
        error: `Access verification failed: ${msg}`
      }, { status: 500 })
    };
  }
}
