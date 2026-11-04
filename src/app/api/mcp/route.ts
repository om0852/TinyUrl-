import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { registerTools, isReadOnlyTool } from '../../../../mcp/tools.mjs';
import { TinyUrlClient } from '../../../../cli/client.mjs';
import { sql } from '@/lib/postgres';
import { rateLimit } from '@/lib/rateLimit';
import { getTrustedEdgeClientIp } from '@/lib/geo';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 1024 * 1024;
// Per minute. The IP limit runs before the key is checked, so guessing keys is slow too.
const IP_LIMIT = 120;
const KEY_LIMIT = 60;

function rpcError(status: number, message: string, headers?: Record<string, string>) {
  return Response.json(
    { jsonrpc: '2.0', error: { code: -32001, message }, id: null },
    { status, headers: { ...(status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}), ...headers } }
  );
}

let auditReady: Promise<unknown> | null = null;

/** Every tool call that can change data, so you can see what an assistant did with a key */
async function auditToolCall(entry: { workspaceId: string; keyId: string; name: string; args: unknown; isError: boolean }) {
  if (!auditReady) {
    auditReady = sql.query(`
      CREATE TABLE IF NOT EXISTS mcp_audit_log (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        workspace_id VARCHAR(64),
        api_key_id VARCHAR(64),
        tool VARCHAR(64),
        args JSONB,
        is_error BOOLEAN
      )
    `).catch(err => {
      auditReady = null;
      throw err;
    });
  }
  await auditReady;
  // Never keep secrets from the arguments (link passwords)
  const args = entry.args && typeof entry.args === 'object'
    ? Object.fromEntries(Object.entries(entry.args as Record<string, unknown>).filter(([k]) => !/password|secret|token/i.test(k)))
    : {};
  const json = JSON.stringify(args);
  await sql.query(
    `INSERT INTO mcp_audit_log (workspace_id, api_key_id, tool, args, is_error) VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [entry.workspaceId, entry.keyId, entry.name, json.length > 4000 ? JSON.stringify({ truncated: true }) : json, entry.isError]
  );
}

/**
 * Hosted MCP server (Streamable HTTP, stateless). The same tools as `npm run mcp`, minus the ones
 * API keys can't use; every tool call goes through the public REST API with the caller's own
 * workspace API key, so it can do exactly what that key's scopes allow and nothing more.
 */
async function handlePost(request: Request): Promise<Response> {
  const ip = getTrustedEdgeClientIp(name => request.headers.get(name))
    || request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || 'unknown';
  const byIp = await rateLimit(`mcp:ip:${ip}`, IP_LIMIT, 60);
  if (!byIp.ok) return rpcError(429, 'Too many requests. Slow down and retry shortly.', { 'Retry-After': String(byIp.retryAfter) });

  const auth = request.headers.get('authorization') || '';
  const apiKey = (request.headers.get('x-api-key') || (auth.startsWith('Bearer ') ? auth.slice(7) : '')).trim();
  if (!apiKey) {
    return rpcError(401, 'Missing API key. Send it as Authorization: Bearer sk_live_...');
  }

  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY_BYTES) return rpcError(413, 'Request body too large.');
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return rpcError(413, 'Request body too large.');
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const whoami = await fetch(`${origin}/api/v1/api-keys?whoami=1`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
    cache: 'no-store'
  }).then(r => r.json()).catch(() => null) as { success?: boolean; key?: { id?: string; workspace_id?: string } } | null;
  if (!whoami?.success || !whoami.key?.workspace_id) {
    return rpcError(401, 'Invalid or revoked API key.');
  }
  const { id: keyId = '', workspace_id: workspaceId } = whoami.key;

  const byKey = await rateLimit(`mcp:key:${keyId || workspaceId}`, KEY_LIMIT, 60);
  if (!byKey.ok) return rpcError(429, 'This API key is sending too many requests. Retry shortly.', { 'Retry-After': String(byKey.retryAfter) });

  const server = new McpServer({ name: 'tinyurl', version: '2.1.0' });
  registerTools(server, new TinyUrlClient({ apiUrl: origin, apiKey, workspaceId }), {
    hosted: true,
    onToolCall: ({ name, args, isError }: { name: string; args: unknown; isError: boolean }) =>
      isReadOnlyTool(name) ? undefined : auditToolCall({ workspaceId, keyId, name, args, isError })
  });

  // Stateless: a fresh server per request and plain JSON replies, so it fits a serverless function
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(new Request(request.url, { method: 'POST', headers: request.headers, body: raw }), { parsedBody: body });
}

// No sessions or server-sent streams in stateless mode: GET would only hold a function open
function methodNotAllowed() {
  return rpcError(405, 'Method not allowed. Send JSON-RPC requests with POST.', { Allow: 'POST' });
}

export { handlePost as POST, methodNotAllowed as GET, methodNotAllowed as DELETE };
