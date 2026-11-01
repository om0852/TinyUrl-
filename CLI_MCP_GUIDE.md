# TinyURL Platform — CLI & MCP Server Guide

This documentation covers the architecture, security mechanisms, Command-Line Interface (CLI), and Model Context Protocol (MCP) server for the TinyURL platform.

---

## 1. Security & Authentication Architecture

The platform enforces multi-tenant Role-Based Access Control (RBAC) with secure API Key authentication across all route handlers.

### Key Authentication Methods

1. **Bearer Token Authorization**:
   ```http
   Authorization: Bearer sk_live_...
   ```
2. **Dedicated Header (`x-api-key`)**:
   ```http
   x-api-key: sk_live_...
   ```
3. **Workspace (`x-workspace-id`)**, optional with a workspace key:
   ```http
   x-workspace-id: ws_your_workspace_id
   ```
   A workspace key only works in the workspace it was created in. When no workspace is configured, the CLI and MCP server ask `GET /api/v1/api-keys?whoami=1` for the key's workspace.

### Two-Tier API Key Verification

- **Tier 1 — Master Platform Key (`PLATFORM_API_KEY`)**:
  - Defined in environment variables (`.env.local` / system env).
  - Validated using constant-time timing-safe comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
  - Grants administrative ownership authority across workspaces, ideal for server-to-server pipelines, CI/CD, and CLI/MCP admin tasks.
- **Tier 2 — Database Stored Scoped Keys (`api_keys` table)**:
  - Keys are generated with 192-bit cryptographic randomness (`sk_live_<random_bytes>`).
  - Stored strictly as irreversible SHA-256 hashes (`key_hash`). Only the key prefix (`sk_live_...`) is kept for identification.
  - Scoped to a specific `workspace_id`.
  - Permissions are strictly evaluated against the RBAC matrix (`links:create`, `links:edit`, `links:delete`, `analytics:read`, `campaigns:create`, `domains:manage`, `api_keys:manage`, etc.).
  - `last_used` timestamp is updated automatically on every authenticated request.
- **Strict Unauthorized Rejection**:
  - If a caller supplies an invalid, unrecognized, or revoked API key, the server immediately returns `HTTP 401 Unauthorized` without falling back to guest mode.

---

## 2. API Endpoints Inventory

| Method | Endpoint | Description | Required RBAC Permission |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/shorten` | Create shortened URL (slug, tags, UTM, password, expiration) | `links:create` |
| `GET` | `/api/v1/links` | List links for a workspace (`all=1` for more than 100) or retrieve by short code | `export:data` |
| `PATCH` | `/api/v1/links` | Update destination URL, slug, rules, status, tags | `links:edit` |
| `DELETE` | `/api/v1/links` | Delete a short link permanently | `links:delete` |
| `POST` | `/api/v1/links/bulk` | Bulk import up to 1,000 links | `links:create` |
| `GET` | `/api/v1/links/health` | Get broken links summary (404/500/timeouts) | `analytics:read` |
| `POST` | `/api/v1/links/health` | Trigger active destination URL health probes | `links:edit` |
| `POST` | `/api/v1/links/unlock` | Verify password for password-protected link | Public / Link Password |
| `GET` | `/api/v1/analytics` | Real-time clicks, unique visitors, geo, device stats | `analytics:read` |
| `POST` | `/api/v1/analytics/reset`| Reset clicks/analytics for a link or workspace | `settings:manage` |
| `GET` | `/api/v1/campaigns` | List marketing campaigns with aggregate clicks | `analytics:read` |
| `POST` | `/api/v1/campaigns` | Create or update marketing campaign | `campaigns:create` |
| `DELETE`| `/api/v1/campaigns` | Delete marketing campaign | `campaigns:delete` |
| `GET` | `/api/v1/domains` | List custom domains and verification status | `domains:manage` |
| `POST` | `/api/v1/domains` | Register custom domain with DNS challenge records | `domains:manage` |
| `PATCH`| `/api/v1/domains` | Verify domain DNS records (CNAME and TXT) | `domains:manage` |
| `GET` | `/api/v1/domains/probe` | Live TLS/SSL certificate probe | `domains:manage` |
| `DELETE`| `/api/v1/domains` | Remove custom domain | `domains:manage` |
| `GET` | `/api/v1/api-keys` | List workspace API keys | `api_keys:manage` |
| `POST` | `/api/v1/api-keys` | Generate new scoped API key | `api_keys:manage` |
| `DELETE`| `/api/v1/api-keys` | Revoke/delete an API key | `api_keys:manage` |
| `GET` | `/api/v1/webhooks` | List active webhook subscriptions | `api_keys:manage` |
| `POST` | `/api/v1/webhooks` | Create new webhook endpoint | `api_keys:manage` |
| `POST` | `/api/v1/webhooks/test`| Send test delivery ping | `api_keys:manage` |
| `DELETE`| `/api/v1/webhooks` | Delete a webhook | `api_keys:manage` |
| `GET` | `/api/v1/workspaces` | List workspaces or get by ID/email | Workspace Member |
| `POST` | `/api/v1/workspaces` | Create or update workspace | `settings:manage` |
| `POST` | `/api/v1/security/audit`| Scan links for malware, phishing & SSL validity | `links:edit` |
| `GET` | `/api/v1/cache/health` | Check in-memory LRU and Upstash Redis health | Public / Monitoring |

---

## 3. TinyURL Command-Line Interface (CLI)

The CLI provides complete control over the TinyURL platform from any terminal.

### Quick Start

Run using npm scripts:
```bash
npm run cli -- help
```
Or directly using Node.js:
```bash
node cli/bin.mjs help
```

### Configuration

The CLI automatically reads settings in this order:
1. Command line options (`--api-key`, `--api-url`, `--workspace`)
2. Environment variables (`TINYURL_API_KEY`, `TINYURL_API_URL`, `TINYURL_WORKSPACE_ID`)
3. Project `.env.local` (`PLATFORM_API_KEY`, `NEXT_PUBLIC_APP_URL`)
4. Local `.tinyurlrc.json`
5. Global `~/.tinyurlrc.json`

Check or update settings:
```bash
# View active configuration
npm run cli -- config show

# Set API Key
npm run cli -- config set apiKey sk_live_...

# Set Base URL
npm run cli -- config set apiUrl http://localhost:3000

# Optional: pin a workspace (defaults to the API key's own workspace)
npm run cli -- config set workspaceId ws_your_workspace_id
```

### CLI Commands Guide

#### 1. Shorten Links
```bash
# Basic shorten
npm run cli -- shorten https://example.com/very/long/url

# Shorten with custom slug and title
npm run cli -- shorten https://example.com --slug promo2026 --title "Spring Sale"

# Shorten with tags and UTM parameters
npm run cli -- shorten https://example.com --tags sale marketing --utm-source twitter --utm-campaign spring_boost

# Shorten with password protection and expiry
npm run cli -- shorten https://confidential.internal --password SecretPass123 --expires 2026-12-31T23:59:59Z

# Shorten with max clicks limit (auto-expires after 500 clicks)
npm run cli -- shorten https://example.com --max-clicks 500
```

#### 2. Manage Links
```bash
# List links in workspace
npm run cli -- links list

# List with limit and JSON output
npm run cli -- links list --limit 50 --json

# Inspect link details
npm run cli -- links get promo2026

# Update link destination
npm run cli -- links update promo2026 --url https://new-destination.com

# Delete link permanently
npm run cli -- links delete promo2026

# Check broken links and probe destination health live
npm run cli -- links health --probe

# Bulk import from JSON file
npm run cli -- links bulk ./links-import.json --batch-name "Q1 Migration"
```

#### 3. Analytics
```bash
# Get aggregate workspace analytics
npm run cli -- analytics

# Get analytics for a specific short link
npm run cli -- analytics promo2026

# Machine-readable JSON output
npm run cli -- analytics promo2026 --json
```

#### 4. Marketing Campaigns
```bash
# List campaigns
npm run cli -- campaigns list

# Create a campaign
npm run cli -- campaigns create "Black Friday 2026" --target 25000 --tags seasonal retail

# Delete a campaign
npm run cli -- campaigns delete cmp_12345
```

#### 5. Custom Branded Domains
```bash
# List custom domains
npm run cli -- domains list

# Register a custom domain and view required DNS records
npm run cli -- domains add go.mycompany.com

# Live TLS handshake probe
npm run cli -- domains probe go.mycompany.com
```

#### 6. API Keys & Webhooks
```bash
# List workspace API keys
npm run cli -- keys list

# Generate new API key
npm run cli -- keys create "Integration Bot" --permissions links:create export:data analytics:read

# Revoke API key
npm run cli -- keys revoke key_12345

# List webhooks
npm run cli -- webhooks list

# Register webhook endpoint
npm run cli -- webhooks create https://api.mycompany.com/webhook --events click link.created

# Dispatch test ping
npm run cli -- webhooks test whk_12345
```

#### 7. Security Audit & Cache Health
```bash
# Run threat intelligence, phishing, and malware scan on links
npm run cli -- audit

# Inspect L1 LRU memory cache and Upstash Redis roundtrip latency
npm run cli -- cache-health
```

---

## 4. Model Context Protocol (MCP) Server

The TinyURL MCP Server implements the official Model Context Protocol (MCP) standard, exposing 25 tools to any AI model running in Cursor, Claude Desktop, Antigravity IDE, Windsurf, or custom AI agents.

### Starting the MCP Server

Directly via Node.js:
```bash
node mcp/index.mjs
```
Via npm:
```bash
npm run mcp
```

### Configuration for AI Clients

#### Configuration in Cursor (`.cursor/mcp.json` or `~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "tinyurl": {
      "command": "node",
      "args": ["c:/Users/salun/OneDrive - smarttech/Desktop/D folder/url-shortner/mcp/index.mjs"],
      "env": {
        "TINYURL_API_URL": "http://localhost:3000",
        "TINYURL_API_KEY": "sk_live_your_workspace_key"
      }
    }
  }
}
```

#### Configuration in Claude Desktop (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "tinyurl": {
      "command": "node",
      "args": ["c:\\Users\\salun\\OneDrive - smarttech\\Desktop\\D folder\\url-shortner\\mcp\\index.mjs"],
      "env": {
        "TINYURL_API_URL": "http://localhost:3000",
        "TINYURL_API_KEY": "sk_live_your_workspace_key"
      }
    }
  }
}
```

### Complete MCP Tools Reference

1. **`shorten_url`**: Create shortened link with custom slug, tags, UTMs, password, and click limits.
2. **`list_links`**: List links in workspace with click counts and active status.
3. **`get_link_details`**: Retrieve full link data by code or slug.
4. **`update_link`**: Modify destination URL, slug, title, or status.
5. **`delete_link`**: Remove a link permanently.
6. **`bulk_shorten`**: Bulk create up to 1,000 links in a single request.
7. **`check_links_health`**: Detect dead links (404/500/timeouts) and optionally probe live endpoints.
8. **`get_analytics`**: Detailed traffic analysis: total clicks, unique visitors, devices, and top countries.
9. **`reset_analytics`**: Wipe click history for a link or entire workspace.
10. **`list_campaigns`**: List marketing campaigns and progress toward click goals.
11. **`create_campaign`**: Create a campaign with click target.
12. **`delete_campaign`**: Remove a marketing campaign.
13. **`list_domains`**: List custom domains and SSL verification status.
14. **`add_domain`**: Add branded domain and get DNS TXT/CNAME records.
15. **`verify_domain`**: Trigger DNS check for custom domain.
16. **`probe_domain`**: Test live HTTPS/TLS reachability for a domain.
17. **`delete_domain`**: Delete custom domain.
18. **`list_api_keys`**: List active API keys.
19. **`create_api_key`**: Generate scoped API key.
20. **`revoke_api_key`**: Revoke an API key.
21. **`list_webhooks`**: List event webhooks.
22. **`create_webhook`**: Subscribe a webhook URL to events.
23. **`test_webhook`**: Dispatch test ping to webhook.
24. **`run_security_audit`**: Threat intelligence malware and phishing risk scoring on links.
25. **`check_cache_health`**: Inspect L1/L2 Redis cache health and latency.
