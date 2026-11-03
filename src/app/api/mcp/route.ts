import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { registerTools } from '../../../../mcp/tools.mjs';
import { TinyUrlClient } from '../../../../cli/client.mjs';

export const dynamic = 'force-dynamic';

function rpcError(status: number, message: string) {
  return Response.json(
    { jsonrpc: '2.0', error: { code: -32001, message }, id: null },
    { status, headers: status === 401 ? { 'WWW-Authenticate': 'Bearer' } : undefined }
  );
}

/**
 * Hosted MCP server (Streamable HTTP, stateless). Same tools as `npm run mcp`; every tool call
 * goes through the public REST API with the caller's own workspace API key, so it can do exactly
 * what that key's scopes allow and nothing more.
 */
async function handle(request: Request): Promise<Response> {
  const auth = request.headers.get('authorization') || '';
  const apiKey = (request.headers.get('x-api-key') || (auth.startsWith('Bearer ') ? auth.slice(7) : '')).trim();
  if (!apiKey) {
    return rpcError(401, 'Missing API key. Send it as Authorization: Bearer sk_live_...');
  }

  const origin = new URL(request.url).origin;
  const whoami = await fetch(`${origin}/api/v1/api-keys?whoami=1`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
    cache: 'no-store'
  }).then(r => r.json()).catch(() => null) as { success?: boolean; key?: { workspace_id?: string } } | null;
  if (!whoami?.success || !whoami.key?.workspace_id) {
    return rpcError(401, 'Invalid or revoked API key.');
  }

  const server = new McpServer({ name: 'tinyurl', version: '2.0.0' });
  registerTools(server, new TinyUrlClient({ apiUrl: origin, apiKey, workspaceId: whoami.key.workspace_id }));

  // Stateless: a fresh server per request and plain JSON replies, so it fits a serverless function
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export { handle as GET, handle as POST, handle as DELETE };
