'use client';

import React, { useState } from 'react';
import { Copy, Check, Bot, KeyRound, ShieldCheck } from 'lucide-react';
import { CodeBlock } from '@/components/ApiReference';

type Client = 'claude-code' | 'claude-desktop' | 'cursor' | 'vscode' | 'http';

const CLIENTS: { id: Client; label: string }[] = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'claude-desktop', label: 'Claude Desktop' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'vscode', label: 'VS Code' },
  { id: 'http', label: 'Other / HTTP' },
];

// Mirrors mcp/tools.mjs; the last column is the API key scope the tool needs. "dashboard only":
// keys can't carry that permission (see KEY_SCOPES in /api/v1/api-keys), so the tool answers 403
const TOOL_GROUPS: { group: string; tools: [string, string, string][] }[] = [
  {
    group: 'Links',
    tools: [
      ['shorten_url', 'Create a short link (slug, tags, UTM, password, expiry, click limit)', 'links:create'],
      ['bulk_shorten', 'Create many links at once', 'links:create'],
      ['list_links', 'List the workspace’s links with click counts', 'export:data'],
      ['get_link_details', 'Look up one link by code or slug', 'none'],
      ['update_link', 'Change destination, slug, title, tags or status', 'links:edit'],
      ['delete_link', 'Delete a link', 'links:delete'],
      ['check_links_health', 'Find broken destinations', 'analytics:read'],
    ],
  },
  {
    group: 'Analytics & campaigns',
    tools: [
      ['get_analytics', 'Clicks, visitors, locations, devices and referrers', 'analytics:read'],
      ['reset_analytics', 'Clear the clicks of a link or the workspace', 'dashboard only'],
      ['list_campaigns', 'List campaigns with their clicks', 'analytics:read'],
      ['create_campaign', 'Create or update a campaign', 'campaigns:create'],
      ['delete_campaign', 'Delete a campaign', 'dashboard only'],
    ],
  },
  {
    group: 'Domains, keys & webhooks',
    tools: [
      ['list_domains / add_domain / verify_domain / probe_domain / delete_domain', 'Manage custom domains', 'dashboard only'],
      ['list_api_keys / create_api_key / revoke_api_key', 'Manage API keys', 'dashboard only'],
      ['list_webhooks / create_webhook / test_webhook', 'Manage webhooks', 'dashboard only'],
      ['run_security_audit', 'Scan links for phishing, malware and SSL problems', 'links:edit'],
    ],
  },
];

export function McpSetup({ origin, copied, onCopy, onCreateKey }: {
  origin: string;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
  onCreateKey: () => void;
}) {
  const [client, setClient] = useState<Client>('claude-code');
  const [key, setKey] = useState('');

  const url = `${origin}/api/mcp`;
  const apiKey = key.trim() || 'sk_live_YOUR_KEY';

  const snippets: Record<Client, { label: string; code: string; note: React.ReactNode }> = {
    'claude-code': {
      label: 'Terminal',
      code: `claude mcp add --transport http tinyurl ${url} \\\n  --header "Authorization: Bearer ${apiKey}"`,
      note: <>Run it once, then ask Claude things like &ldquo;shorten this URL&rdquo; or &ldquo;which link got the most clicks this week?&rdquo;. Check with <span className="font-mono">claude mcp list</span>.</>,
    },
    'claude-desktop': {
      label: 'claude_desktop_config.json',
      code: JSON.stringify({
        mcpServers: {
          tinyurl: {
            command: 'npx',
            args: ['-y', 'mcp-remote', url, '--header', 'Authorization:${TINYURL_AUTH}'],
            env: { TINYURL_AUTH: `Bearer ${apiKey}` },
          },
        },
      }, null, 2),
      note: <>Settings → Developer → Edit Config, paste this into <span className="font-mono">mcpServers</span>, then restart Claude Desktop. Needs Node.js (for <span className="font-mono">npx</span>).</>,
    },
    cursor: {
      label: '~/.cursor/mcp.json',
      code: JSON.stringify({ mcpServers: { tinyurl: { url, headers: { Authorization: `Bearer ${apiKey}` } } } }, null, 2),
      note: <>Or Cursor Settings → MCP → Add new MCP server. TinyURL then shows up with its tools listed.</>,
    },
    vscode: {
      label: '.vscode/mcp.json',
      code: JSON.stringify({ servers: { tinyurl: { type: 'http', url, headers: { Authorization: `Bearer ${apiKey}` } } } }, null, 2),
      note: <>Copilot Chat in agent mode picks it up; start the server from the file&rsquo;s <span className="font-mono">Start</span> link.</>,
    },
    http: {
      label: 'curl',
      code: `curl ${url} \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -H "Accept: application/json, text/event-stream" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
      note: <>Streamable HTTP transport, stateless (no session id). Any MCP client that supports remote servers with a header works.</>,
    },
  };
  const snippet = snippets[client];

  const segmented = (active: boolean) => `h-[26px] px-3 rounded-[4px] whitespace-nowrap transition-colors cursor-pointer ${active ? 'bg-surface-container-lowest text-on-surface font-medium shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-[15px] items-start">
      <div className="lg:col-span-7 flex flex-col gap-[15px] min-w-0">
        {/* Server URL */}
        <div className="rounded-xl border-[0.5px] border-outline-variant p-[15px] flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="grid size-[36px] place-items-center rounded-md bg-primary-fixed text-primary-ink shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Connect an AI assistant</h2>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                TinyURL runs an MCP server, so Claude, Cursor and other assistants can create links, read analytics and manage your workspace for you.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 h-[34px] px-3 flex items-center rounded-md bg-surface-container-low border-[0.5px] border-outline-variant text-xs font-mono text-on-surface overflow-x-auto whitespace-nowrap">{url}</code>
            <button type="button" onClick={() => onCopy(url, 'mcp-url')} aria-label="Copy server URL" title="Copy" className="size-[34px] rounded-md border-[0.5px] border-outline-variant grid place-items-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container cursor-pointer shrink-0">
              {copied === 'mcp-url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Client setup */}
        <div className="rounded-xl border-[0.5px] border-outline-variant p-[15px] flex flex-col gap-3">
          <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs self-start max-w-full overflow-x-auto" role="tablist" aria-label="AI client">
            {CLIENTS.map(c => (
              <button key={c.id} type="button" role="tab" aria-selected={client === c.id} onClick={() => setClient(c.id)} className={segmented(client === c.id)}>
                {c.label}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-on-surface-variant">API key <span className="text-outline">(optional: fills it into the snippet; never leaves this page)</span></span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk_live_…"
              className="h-[34px] px-3 bg-surface-container-low rounded-md text-xs font-mono text-on-surface border-[0.5px] border-outline-variant outline-none focus:border-on-surface-variant"
            />
          </label>

          <CodeBlock code={snippet.code} id={`mcp-${client}`} label={snippet.label} copied={copied} onCopy={onCopy} />
          <p className="text-xs text-on-surface-variant">{snippet.note}</p>
        </div>

        {/* Tools */}
        <div className="rounded-xl border-[0.5px] border-outline-variant overflow-hidden">
          <div className="px-[15px] py-3 border-b-[0.5px] border-outline-variant">
            <h3 className="text-sm font-semibold">Tools the assistant gets</h3>
            <p className="mt-0.5 text-xs text-on-surface-variant">Right column: the scope the key needs. &ldquo;Dashboard only&rdquo; tools need owner access, which API keys never get.</p>
          </div>
          {TOOL_GROUPS.map(g => (
            <div key={g.group} className="border-b-[0.5px] border-outline-variant last:border-b-0">
              <div className="px-[15px] pt-3 pb-1 text-[11px] font-medium text-outline">{g.group}</div>
              {g.tools.map(([name, what, scope]) => (
                <div key={name} className="px-[15px] py-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="font-mono text-[11px] text-on-surface sm:w-[46%] break-words">{name}</span>
                  <span className="text-xs text-on-surface-variant flex-1">{what}</span>
                  <span className="font-mono text-[10px] text-outline shrink-0">{scope}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* How access works */}
      <div className="lg:col-span-5 flex flex-col gap-[15px]">
        <div className="rounded-xl border-[0.5px] border-outline-variant p-[15px] flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-on-surface-variant" />
            <h3 className="text-sm font-semibold">You need an API key</h3>
          </div>
          <p className="text-xs text-on-surface-variant">
            The assistant signs in with a workspace API key and can only do what that key&rsquo;s scopes allow. Give it a key with just the scopes it needs, for example only <span className="font-mono">analytics:read</span> for reporting.
          </p>
          <button type="button" onClick={onCreateKey} className="h-[34px] px-4 rounded-md bg-primary-container text-on-primary text-xs font-medium hover:bg-primary transition-colors cursor-pointer self-start">
            Create an API key
          </button>
        </div>
        <div className="rounded-xl border-[0.5px] border-outline-variant p-[15px] flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-on-surface-variant" />
            <h3 className="text-sm font-semibold">Good to know</h3>
          </div>
          <ul className="text-xs text-on-surface-variant list-disc pl-4 space-y-1.5">
            <li>The key works only in the workspace it was created in.</li>
            <li>To disconnect an assistant, revoke its key on the API keys tab.</li>
            <li>The assistant asks before running tools that change things, depending on your client&rsquo;s settings. Deleting links can&rsquo;t be undone.</li>
            <li>Running it locally instead: <span className="font-mono">npm run mcp</span> from the project (see CLI_MCP_GUIDE.md).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
