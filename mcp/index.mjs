#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { TinyUrlClient } from '../cli/client.mjs';
import { loadConfig } from '../cli/config.mjs';

// Initialize Client with multi-tier configuration
const config = loadConfig();
const client = new TinyUrlClient(config);

const server = new McpServer({
  name: 'tinyurl-mcp-server',
  version: '2.0.0'
});

// Helper for formatting MCP tool responses
function formatResponse(data) {
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      }
    ]
  };
}

function formatError(err) {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${err.message}${err.data ? '\n' + JSON.stringify(err.data, null, 2) : ''}`
      }
    ],
    isError: true
  };
}

// ==========================================
// 1. LINK SHORTENING & MANAGEMENT TOOLS
// ==========================================

server.tool(
  'shorten_url',
  'Create a high-performance shortened URL with optional custom slug, tags, password protection, and UTM parameters.',
  {
    destination_url: z.string().url().describe('The target destination URL to shorten (must include http:// or https://)'),
    custom_slug: z.string().optional().describe('Optional custom alias / slug (3-64 alphanumeric characters, hyphens or underscores)'),
    title: z.string().optional().describe('Descriptive title for the short link'),
    tags: z.array(z.string()).optional().describe('Tags for categorization (e.g. ["marketing", "social"])'),
    domain_id: z.string().optional().describe('Domain identifier or custom hostname to use'),
    utm_source: z.string().optional().describe('UTM Campaign Source (e.g. "twitter", "newsletter")'),
    utm_medium: z.string().optional().describe('UTM Medium (e.g. "cpc", "social")'),
    utm_campaign: z.string().optional().describe('UTM Campaign name'),
    password: z.string().optional().describe('Optional password to protect this link'),
    expires_at: z.string().optional().describe('Optional expiration timestamp in ISO format (e.g. 2026-12-31T23:59:59Z)'),
    max_clicks: z.number().int().positive().optional().describe('Maximum number of clicks before the link automatically deactivates')
  },
  async (args) => {
    try {
      const res = await client.shorten(args);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'list_links',
  'List links within the current workspace with click counters, tags, and status.',
  {
    workspace_id: z.string().optional().describe('Workspace ID (defaults to active workspace)')
  },
  async (args) => {
    try {
      const res = await client.listLinks({ workspaceId: args.workspace_id });
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'get_link_details',
  'Retrieve full details for a specific short link by its short code or slug.',
  {
    code: z.string().describe('Short code or custom slug to look up')
  },
  async ({ code }) => {
    try {
      const res = await client.getLink(code);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'update_link',
  'Update an existing link (destination URL, custom slug, title, active status, tags, etc.).',
  {
    id: z.string().describe('ID, short code, or custom slug of the link to update'),
    destination_url: z.string().url().optional().describe('New destination URL'),
    custom_slug: z.string().optional().describe('New custom slug'),
    title: z.string().optional().describe('New link title'),
    status: z.enum(['active', 'disabled']).optional().describe('Status of the link'),
    tags: z.array(z.string()).optional().describe('New array of tags')
  },
  async (args) => {
    try {
      const res = await client.updateLink(args);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'delete_link',
  'Permanently delete a short link.',
  {
    id: z.string().describe('Link ID or short code to delete')
  },
  async ({ id }) => {
    try {
      const res = await client.deleteLink(id);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'bulk_shorten',
  'Batch create up to 1,000 shortened links in a single operation.',
  {
    items: z.array(
      z.object({
        destination_url: z.string().url(),
        custom_slug: z.string().optional(),
        title: z.string().optional(),
        tags: z.array(z.string()).optional(),
        utm_source: z.string().optional(),
        utm_campaign: z.string().optional()
      })
    ).describe('Array of link objects to shorten'),
    batch_name: z.string().optional().describe('Optional name for the batch job')
  },
  async (args) => {
    try {
      const res = await client.bulkImport(args.items, args.batch_name);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'check_links_health',
  'Inspect broken links (404/500/timeouts) or trigger active destination health probes.',
  {
    probe_live: z.boolean().optional().describe('If true, actively sends HTTP probes to destination servers'),
    link_id: z.string().optional().describe('Specific link ID to test (optional)')
  },
  async (args) => {
    try {
      if (args.probe_live) {
        await client.probeLinkHealth({ linkId: args.link_id });
      }
      const res = await client.getLinkHealth();
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

// ==========================================
// 2. ANALYTICS TOOLS
// ==========================================

server.tool(
  'get_analytics',
  'Fetch click analytics, unique visitor counts, device breakdowns, and top countries for a short code or entire workspace.',
  {
    code: z.string().optional().describe('Short code or custom slug to get metrics for. Leave blank for workspace-wide aggregate.'),
    workspace_id: z.string().optional().describe('Workspace ID (defaults to active workspace)')
  },
  async (args) => {
    try {
      const res = await client.getAnalytics({ code: args.code, workspaceId: args.workspace_id });
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'reset_analytics',
  'Reset click counters and click history for a specific link or entire workspace (requires admin/settings permissions).',
  {
    short_code: z.string().optional().describe('Short code of the link to reset'),
    link_id: z.string().optional().describe('Link ID to reset'),
    workspace_id: z.string().optional().describe('Workspace ID to reset (if resetting all workspace links)')
  },
  async (args) => {
    try {
      const res = await client.resetAnalytics(args);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

// ==========================================
// 3. CAMPAIGNS & DOMAINS
// ==========================================

server.tool(
  'list_campaigns',
  'List marketing campaigns and their aggregate click performance.',
  {
    workspace_id: z.string().optional().describe('Workspace ID')
  },
  async (args) => {
    try {
      const res = await client.listCampaigns(args.workspace_id);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'create_campaign',
  'Create a new marketing campaign with a target click goal.',
  {
    name: z.string().describe('Campaign name'),
    description: z.string().optional().describe('Campaign description'),
    target_clicks: z.number().int().positive().optional().describe('Target clicks goal (default: 10,000)'),
    tags: z.array(z.string()).optional().describe('Tags associated with this campaign')
  },
  async (args) => {
    try {
      const res = await client.createCampaign(args);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'delete_campaign',
  'Delete a marketing campaign by its ID.',
  {
    id: z.string().describe('Campaign ID to delete')
  },
  async ({ id }) => {
    try {
      const res = await client.deleteCampaign(id);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'list_domains',
  'List custom domains configured in the workspace with their verification and SSL status.',
  {
    workspace_id: z.string().optional().describe('Workspace ID')
  },
  async (args) => {
    try {
      const res = await client.listDomains(args.workspace_id);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'add_domain',
  'Register a custom domain and get DNS configuration records (CNAME & TXT challenge).',
  {
    hostname: z.string().describe('Custom domain hostname (e.g. "go.example.com")')
  },
  async ({ hostname }) => {
    try {
      const res = await client.addDomain({ hostname });
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'verify_domain',
  'Trigger verification of custom domain DNS CNAME and TXT challenge records.',
  {
    hostname: z.string().describe('Domain hostname to verify')
  },
  async ({ hostname }) => {
    try {
      const res = await client.verifyDomain(hostname);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'probe_domain',
  'Perform live TLS certificate probe and edge proxy handshake test on a domain.',
  {
    domain: z.string().describe('Domain hostname to probe')
  },
  async ({ domain }) => {
    try {
      const res = await client.probeDomain(domain);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'delete_domain',
  'Remove a custom domain from the workspace.',
  {
    id: z.string().describe('Domain ID or hostname to delete')
  },
  async ({ id }) => {
    try {
      const res = await client.deleteDomain(id);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

// ==========================================
// 4. API KEYS & WEBHOOKS
// ==========================================

server.tool(
  'list_api_keys',
  'List active API keys in the workspace.',
  {
    workspace_id: z.string().optional().describe('Workspace ID')
  },
  async (args) => {
    try {
      const res = await client.listApiKeys(args.workspace_id);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'create_api_key',
  'Generate a new secure API Key with scoped permissions (links:read, links:write, analytics:read, etc.).',
  {
    name: z.string().describe('Descriptive name for the API key'),
    permissions: z.array(z.string()).optional().describe('List of permissions (e.g. ["links:read", "links:write"])')
  },
  async (args) => {
    try {
      const res = await client.createApiKey(args);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'revoke_api_key',
  'Revoke and delete an API key by ID.',
  {
    id: z.string().describe('API key ID to revoke')
  },
  async ({ id }) => {
    try {
      const res = await client.revokeApiKey(id);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'list_webhooks',
  'List configured webhooks.',
  {
    workspace_id: z.string().optional().describe('Workspace ID')
  },
  async (args) => {
    try {
      const res = await client.listWebhooks(args.workspace_id);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'create_webhook',
  'Register a new webhook URL for real-time events.',
  {
    url: z.string().url().describe('HTTPS endpoint URL to receive webhook payloads'),
    events: z.array(z.string()).optional().describe('Events to subscribe to (e.g. ["click", "link.created"])')
  },
  async (args) => {
    try {
      const res = await client.createWebhook(args);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'test_webhook',
  'Send a test ping delivery to verify a webhook endpoint.',
  {
    id: z.string().describe('Webhook ID to test')
  },
  async ({ id }) => {
    try {
      const res = await client.testWebhook(id);
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

// ==========================================
// 5. SECURITY AUDIT & CACHE HEALTH
// ==========================================

server.tool(
  'run_security_audit',
  'Audit short links against malware, phishing patterns, Google Safe Browsing, and SSL certificate validity.',
  {
    link_ids: z.array(z.string()).optional().describe('Optional list of link IDs to audit')
  },
  async (args) => {
    try {
      const res = await client.runSecurityAudit({ linkIds: args.link_ids });
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

server.tool(
  'check_cache_health',
  'Check the operational health and latency of the L1 in-memory LRU cache and L2 Upstash Redis cache.',
  {},
  async () => {
    try {
      const res = await client.getCacheHealth();
      return formatResponse(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

// Start the stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('TinyURL MCP Server running over stdio (JSON-RPC 2.0)');
}

main().catch((error) => {
  console.error('Fatal MCP server error:', error);
  process.exit(1);
});
