'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

// Developer documentation for API keys and webhooks. Everything here describes what the routes
// under src/app/api/v1 actually do; update it alongside them.

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface Param {
  name: string;
  type: string;
  required?: boolean;
  desc: string;
}

interface EndpointDoc {
  id: string;
  method: Method;
  path: string;
  title: string;
  scope: string;
  desc: string;
  params?: Param[];
  paramsIn?: 'query' | 'body';
  body?: Record<string, unknown>;
  query?: string;
  response: string;
  notes?: string[];
}

const LINK_EXAMPLE = `{
    "id": "link_8f2c1a9b4d",
    "workspace_id": "ws_…",
    "short_code": "spring",
    "domain_id": "dom_primary",
    "destination_url": "https://example.com/sale?utm_source=newsletter",
    "title": "Spring sale",
    "tags": ["api"],
    "status": "active",
    "clicks_count": 0,
    "redirect_type": "direct",
    "http_status_code": 301,
    "created_at": "2026-11-02T10:15:00.000Z"
  }`;

const ENDPOINT_DOCS: EndpointDoc[] = [
  {
    id: 'shorten',
    method: 'POST',
    path: '/api/v1/shorten',
    title: 'Create a link',
    scope: 'links:create',
    desc: 'Creates one short link. Fires the link.created webhook.',
    paramsIn: 'body',
    params: [
      { name: 'workspace_id', type: 'string', required: true, desc: 'Workspace the link belongs to (the key’s own workspace).' },
      { name: 'destination_url', type: 'string', required: true, desc: 'http or https URL to redirect to.' },
      { name: 'custom_slug', type: 'string', desc: '3–64 characters: letters, numbers, - and _. Without it a 6-character code is generated.' },
      { name: 'title', type: 'string', desc: 'Up to 255 characters.' },
      { name: 'tags', type: 'string[]', desc: 'Up to 10 tags.' },
      { name: 'domain_id', type: 'string', desc: 'A verified domain in the workspace. Defaults to the platform domain.' },
      { name: 'campaign_id', type: 'string', desc: 'A campaign in the workspace.' },
      { name: 'utm_source, utm_medium, utm_campaign, utm_term, utm_content', type: 'string', desc: 'Added to the destination URL as UTM tags. Up to 128 characters each.' },
      { name: 'redirect_type', type: '"direct" | "splash" | "frame"', desc: 'Default direct. A password forces splash.' },
      { name: 'http_status_code', type: '301 | 302 | 307 | 308', desc: 'Status for direct redirects. Default 301.' },
      { name: 'password', type: 'string', desc: 'Visitors must enter it before redirecting.' },
      { name: 'expires_at', type: 'ISO 8601 date', desc: 'The link stops redirecting after this time.' },
      { name: 'max_clicks', type: 'number', desc: 'The link stops redirecting after this many clicks.' },
      { name: 'og_title, og_description, og_image_url', type: 'string', desc: 'Social preview overrides.' },
      { name: 'notes', type: 'string', desc: 'Internal note, up to 1,000 characters.' },
    ],
    body: { workspace_id: '{WORKSPACE_ID}', destination_url: 'https://example.com/sale', custom_slug: 'spring', title: 'Spring sale', utm_source: 'newsletter' },
    response: `// 201 Created
{
  "success": true,
  "message": "Short URL created successfully.",
  "data": ${LINK_EXAMPLE}
}`,
    notes: ['409 if the slug is taken, 422 if the URL or slug is invalid.'],
  },
  {
    id: 'bulk',
    method: 'POST',
    path: '/api/v1/links/bulk',
    title: 'Create links in bulk',
    scope: 'links:create',
    desc: 'Up to 1,000 links in one request. Rows that fail are listed in errors; the rest are still created.',
    paramsIn: 'body',
    params: [
      { name: 'workspace_id', type: 'string', required: true, desc: 'Workspace the links belong to.' },
      { name: 'items', type: 'object[]', required: true, desc: 'Each item takes destination_url (required), custom_slug, title, tags (max 8), utm_source, utm_medium, utm_campaign and campaign_id.' },
      { name: 'batch_name', type: 'string', desc: 'Name for this import in Bulk history.' },
    ],
    body: { workspace_id: '{WORKSPACE_ID}', batch_name: 'November import', items: [{ destination_url: 'https://example.com/a' }, { destination_url: 'https://example.com/b', custom_slug: 'promo-b' }] },
    response: `// 200 OK
{
  "success": true,
  "job_id": "bulk_…",
  "batch_name": "November import",
  "total": 2,
  "imported": 2,
  "failed": 0,
  "errors": [],
  "links": [ … ]
}`,
    notes: ['413 for more than 1,000 items.', 'Bulk-created links do not fire link.created.'],
  },
  {
    id: 'list',
    method: 'GET',
    path: '/api/v1/links',
    title: 'List links',
    scope: 'export:data',
    desc: 'Links in the workspace, newest first. Keys with links:read or analytics:read also work.',
    paramsIn: 'query',
    params: [
      { name: 'workspace_id', type: 'string', required: true, desc: 'Workspace to list.' },
      { name: 'all', type: '1', desc: 'Return up to 10,000 links instead of 100.' },
    ],
    query: 'workspace_id={WORKSPACE_ID}',
    response: `// 200 OK
{
  "success": true,
  "total": 1,
  "links": [ ${LINK_EXAMPLE.replace(/\n {2}/g, '\n    ')} ]
}`,
    notes: ['Password-protected links show password_hash as "PROTECTED".'],
  },
  {
    id: 'update',
    method: 'PATCH',
    path: '/api/v1/links',
    title: 'Update a link',
    scope: 'links:edit',
    desc: 'Changes the fields you send and leaves the rest alone.',
    paramsIn: 'body',
    params: [
      { name: 'id', type: 'string', required: true, desc: 'The link’s id. short_code or custom_slug also identify it.' },
      { name: 'workspace_id', type: 'string', required: true, desc: 'The link’s workspace.' },
      { name: 'destination_url, title, tags, status', type: '…', desc: 'status is active, disabled or expired.' },
      { name: 'custom_slug', type: 'string', desc: 'Renames the link (send it with id).' },
      { name: 'campaign_id', type: 'string | null', desc: 'null removes the campaign.' },
      { name: 'password', type: 'string', desc: 'An empty string removes the password.' },
      { name: 'expires_at, max_clicks', type: 'date | number | null', desc: 'Empty or null removes the limit.' },
      { name: 'redirect_type, http_status_code, utm_*, og_*, notes', type: '…', desc: 'Same rules as when creating.' },
    ],
    body: { workspace_id: '{WORKSPACE_ID}', id: 'link_8f2c1a9b4d', destination_url: 'https://example.com/new-page' },
    response: `// 200 OK
{
  "success": true,
  "message": "Link updated successfully.",
  "link": { … }
}`,
    notes: ['404 if the link is not in the workspace, 409 if a new slug is taken.'],
  },
  {
    id: 'delete',
    method: 'DELETE',
    path: '/api/v1/links',
    title: 'Delete a link',
    scope: 'links:delete',
    desc: 'Deletes the link. Its short URL stops working right away.',
    paramsIn: 'query',
    params: [
      { name: 'id', type: 'string', required: true, desc: 'The link’s id (or code= with the short code).' },
      { name: 'workspace_id', type: 'string', required: true, desc: 'The link’s workspace.' },
    ],
    query: 'workspace_id={WORKSPACE_ID}&id=link_8f2c1a9b4d',
    response: `// 200 OK
{
  "success": true,
  "message": "Link deleted.",
  "deleted": { "id": "link_8f2c1a9b4d", "short_code": "spring" }
}`,
  },
  {
    id: 'analytics',
    method: 'GET',
    path: '/api/v1/analytics',
    title: 'Get analytics',
    scope: 'analytics:read',
    desc: 'Click totals and breakdowns for the workspace, or for one link with code.',
    paramsIn: 'query',
    params: [
      { name: 'workspace_id', type: 'string', required: true, desc: 'Workspace to report on.' },
      { name: 'code', type: 'string', desc: 'A short code or slug, for one link only.' },
    ],
    query: 'workspace_id={WORKSPACE_ID}',
    response: `// 200 OK
{
  "success": true,
  "metrics": {
    "total_clicks": 1284,
    "unique_visitors": 640,
    "repeat_rate": "18.2%",
    "top_countries": [{ "name": "India", "clicks": 512 }],
    "devices": { "mobile": "71%", "desktop": "27%", "tablet": "2%" },
    "browsers": [ … ],
    "utm_breakdown": { "sources": [ … ], "campaigns": [ … ] },
    "hourly_activity": [ … 24 values … ]
  },
  "recent_clicks": [ … up to 5,000 … ]
}`,
    notes: ['Bot clicks are excluded. There is no date filter; filter recent_clicks by timestamp.'],
  },
  {
    id: 'health',
    method: 'POST',
    path: '/api/v1/links/health',
    title: 'Check link health',
    scope: 'links:edit',
    desc: 'Requests each destination and marks unreachable links as broken. GET (analytics:read) returns the last results without checking again.',
    paramsIn: 'body',
    params: [
      { name: 'workspace_id', type: 'string', required: true, desc: 'Checks up to 50 links in the workspace.' },
      { name: 'link_id', type: 'string', desc: 'Check only this link.' },
    ],
    body: { workspace_id: '{WORKSPACE_ID}' },
    response: `// 200 OK
{
  "success": true,
  "checked": 12,
  "healthy_count": 11,
  "broken_count": 1,
  "broken_links": [ … ]
}`,
  },
  {
    id: 'audit',
    method: 'POST',
    path: '/api/v1/security/audit',
    title: 'Run a security scan',
    scope: 'links:edit',
    desc: 'Scans up to 100 destinations, updates risk scores and flags, and fires link.flagged for newly flagged links.',
    paramsIn: 'body',
    params: [
      { name: 'workspace_id', type: 'string', required: true, desc: 'Workspace to scan (newest 100 links).' },
      { name: 'link_ids', type: 'string[]', desc: 'Scan only these links.' },
    ],
    body: { workspace_id: '{WORKSPACE_ID}' },
    response: `// 200 OK
{
  "success": true,
  "scanned_count": 42,
  "threats_detected": 1,
  "unreachable_count": 2,
  "results": [{ "link_id": "…", "risk_score": 80, "is_threat": true, "threat_flags": ["…"] }]
}`,
  },
  {
    id: 'campaigns',
    method: 'GET',
    path: '/api/v1/campaigns',
    title: 'List campaigns',
    scope: 'analytics:read',
    desc: 'Campaigns in the workspace. POST with campaigns:create to create one.',
    paramsIn: 'query',
    params: [{ name: 'workspace_id', type: 'string', required: true, desc: 'Workspace to list.' }],
    query: 'workspace_id={WORKSPACE_ID}',
    response: `// 200 OK
{
  "success": true,
  "campaigns": [ … ]
}`,
  },
  {
    id: 'whoami',
    method: 'GET',
    path: '/api/v1/api-keys',
    title: 'Check a key',
    scope: 'any',
    desc: 'Returns the key’s name, workspace and scopes. Handy for testing a key.',
    paramsIn: 'query',
    params: [{ name: 'whoami', type: '1', required: true, desc: 'Required.' }],
    query: 'whoami=1',
    response: `// 200 OK
{
  "success": true,
  "key": {
    "id": "key_…",
    "name": "Zapier",
    "workspace_id": "ws_…",
    "permissions": ["links:create", "analytics:read"]
  }
}`,
  },
];

const SCOPES: [string, string][] = [
  ['links:create', 'Create links, single or bulk'],
  ['links:edit', 'Update links, run health checks and security scans'],
  ['links:delete', 'Delete links'],
  ['links:read', 'List links (same as export:data)'],
  ['links:write', 'All of links:create, links:edit and links:delete'],
  ['export:data', 'List links and import history'],
  ['analytics:read', 'Analytics, campaigns and link health results'],
  ['campaigns:create', 'Create campaigns'],
];

const ERRORS: [string, string][] = [
  ['400', 'Missing or malformed field, or malformed JSON'],
  ['401', 'Missing, invalid or revoked API key'],
  ['403', 'The key lacks the scope, or the item is in another workspace'],
  ['404', 'The link or item doesn’t exist in this workspace'],
  ['409', 'The slug is already taken'],
  ['413', 'Too many items (bulk is capped at 1,000)'],
  ['422', 'A value failed validation (URL, slug, domain, campaign…)'],
  ['500', 'Something went wrong on our side; retry reads, check before retrying creates'],
];

const WEBHOOK_EVENT_DOCS: { id: string; when: string; payload: string }[] = [
  {
    id: 'link.created',
    when: 'A link is created in the dashboard or with POST /api/v1/shorten. Bulk imports don’t send it.',
    payload: `{
  "event": "link.created",
  "timestamp": "2026-11-02T10:15:00.000Z",
  "data": {
    "id": "link_8f2c1a9b4d",
    "short_code": "spring",
    "custom_slug": "spring",
    "destination_url": "https://example.com/sale",
    "title": "Spring sale",
    "workspace_id": "ws_…",
    "created_at": "2026-11-02T10:15:00.000Z"
  }
}`,
  },
  {
    id: 'link.clicked',
    when: 'A visitor opens a short link in a browser. Sent from the visitor’s browser, so it can arrive a moment after the redirect.',
    payload: `{
  "event": "link.clicked",
  "timestamp": "2026-11-02T10:16:04.000Z",
  "data": {
    "link_id": "link_8f2c1a9b4d",
    "short_code": "spring",
    "destination_url": "https://example.com/sale",
    "click": {
      "country": "India",
      "city": "Pune",
      "device": "mobile",
      "os": "Android",
      "browser": "Chrome",
      "referrer": "instagram.com",
      "is_unique": true
    }
  }
}`,
  },
  {
    id: 'link.flagged',
    when: 'A security scan flags links that weren’t flagged before. data is a list, one entry per link.',
    payload: `{
  "event": "link.flagged",
  "timestamp": "2026-11-02T11:00:00.000Z",
  "data": [
    {
      "id": "link_8f2c1a9b4d",
      "short_code": "spring",
      "destination_url": "https://suspicious.example",
      "risk_score": 80,
      "reasons": ["Domain on a phishing list"],
      "workspace_id": "ws_…"
    }
  ]
}`,
  },
];

const VERIFY_NODE = `import crypto from 'node:crypto';

// Express: use express.raw({ type: 'application/json' }) so req.body is the raw bytes
app.post('/hooks/tinyurl', (req, res) => {
  const expected = crypto
    .createHmac('sha256', process.env.TINYURL_WEBHOOK_SECRET) // whsec_…
    .update(req.body)
    .digest('hex');
  const received = req.get('X-Signature-SHA256') || '';
  const ok = received.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!ok) return res.status(401).end();

  const event = JSON.parse(req.body);
  res.status(200).end(); // reply fast, then do the work
  handle(event);
});`;

const VERIFY_PYTHON = `import hmac, hashlib, os
from flask import Flask, request, abort

app = Flask(__name__)

@app.post("/hooks/tinyurl")
def tinyurl_hook():
    secret = os.environ["TINYURL_WEBHOOK_SECRET"].encode()  # whsec_…
    expected = hmac.new(secret, request.get_data(), hashlib.sha256).hexdigest()
    received = request.headers.get("X-Signature-SHA256", "")
    if not hmac.compare_digest(received, expected):
        abort(401)
    event = request.get_json()
    # handle(event)
    return "", 200`;

const SECTIONS: { group: string; items: { id: string; label: string; method?: Method }[] }[] = [
  { group: 'Getting started', items: [{ id: 'auth', label: 'Authentication' }, { id: 'scopes', label: 'Scopes' }, { id: 'errors', label: 'Errors and limits' }] },
  { group: 'Endpoints', items: ENDPOINT_DOCS.map(e => ({ id: e.id, label: e.title, method: e.method })) },
  { group: 'Webhooks', items: [{ id: 'wh-events', label: 'Events and payloads' }, { id: 'wh-verify', label: 'Verifying signatures' }, { id: 'wh-delivery', label: 'Delivery' }] },
];

const METHOD_STYLE: Record<Method, string> = {
  GET: 'bg-emerald-50 text-emerald-700',
  POST: 'bg-primary-fixed text-primary-ink',
  PATCH: 'bg-amber-50 text-amber-700',
  DELETE: 'bg-error-container text-error',
};

const MethodBadge: React.FC<{ method: Method }> = ({ method }) => (
  <span className={`inline-flex items-center justify-center min-w-[46px] h-[20px] px-1.5 rounded text-[10px] font-mono font-semibold ${METHOD_STYLE[method]}`}>{method}</span>
);

const CodeBlock: React.FC<{ code: string; id: string; label?: string; copied: string | null; onCopy: (text: string, id: string) => void }> = ({ code, id, label, copied, onCopy }) => (
  <div className="rounded-md border-[0.5px] border-outline-variant overflow-hidden min-w-0">
    <div className="flex items-center justify-between px-3 h-[30px] bg-surface-container-low border-b-[0.5px] border-outline-variant">
      <span className="text-[11px] text-outline">{label}</span>
      <button type="button" onClick={() => onCopy(code, id)} aria-label="Copy code" title="Copy" className="p-1 rounded text-on-surface-variant hover:text-on-surface cursor-pointer">
        {copied === id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
    <pre className="p-3 text-[11px] font-mono text-on-surface overflow-x-auto leading-relaxed bg-surface-container-lowest">{code}</pre>
  </div>
);

const Table: React.FC<{ head: string[]; rows: React.ReactNode[][] }> = ({ head, rows }) => (
  <div className="rounded-md border-[0.5px] border-outline-variant overflow-x-auto">
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="bg-surface-container-low text-on-surface-variant">
          {head.map(h => <th key={h} className="py-2 px-3 font-medium whitespace-nowrap">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t-[0.5px] border-outline-variant align-top">
            {r.map((c, j) => (
              <td
                key={j}
                className={`py-2 px-3 ${j === 0
                  ? 'font-mono text-on-surface min-w-[120px] max-w-[220px] break-words'
                  : j === r.length - 1 ? 'text-on-surface-variant min-w-[220px]' : 'text-on-surface-variant'}`}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

interface ApiReferenceProps {
  origin: string;
  workspaceId: string;
}

export const ApiReference: React.FC<ApiReferenceProps> = ({ origin, workspaceId }) => {
  const [section, setSection] = useState('auth');
  const [verifyLang, setVerifyLang] = useState<'node' | 'python'>('node');
  const [copied, setCopied] = useState<string | null>(null);

  const fill = (text: string) => text.replaceAll('{WORKSPACE_ID}', workspaceId || 'YOUR_WORKSPACE_ID');

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const curlFor = (e: EndpointDoc) => {
    const url = `${origin}${e.path}${e.query ? `?${fill(e.query)}` : ''}`;
    const lines = [`curl -X ${e.method} "${url}" \\`, `  -H "Authorization: Bearer YOUR_API_KEY"${e.body ? ' \\' : ''}`];
    if (e.body) {
      lines.push(`  -H "Content-Type: application/json" \\`);
      lines.push(`  -d '${fill(JSON.stringify(e.body, null, 2)).replace(/'/g, "'\\''")}'`);
    }
    return lines.join('\n');
  };

  const segmented = (active: boolean) => `h-[26px] px-3 rounded-[4px] whitespace-nowrap transition-colors cursor-pointer ${active ? 'bg-surface-container-lowest text-on-surface font-medium shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`;
  const h2 = 'text-[14px] font-semibold text-on-surface';
  const p = 'text-xs text-on-surface-variant leading-relaxed';
  const inlineCode = 'px-1 py-px rounded bg-surface-container text-[11px] font-mono text-on-surface';

  const endpoint = ENDPOINT_DOCS.find(e => e.id === section);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-[15px] items-start">
      {/* Section menu */}
      <nav aria-label="Documentation" className="rounded-xl border-[0.5px] border-outline-variant p-2 lg:sticky lg:top-4">
        {/* Phones: one dropdown instead of the long list */}
        <select
          value={section}
          onChange={e => setSection(e.target.value)}
          aria-label="Section"
          className="lg:hidden w-full h-[34px] px-2 bg-surface-container-low rounded-md text-xs text-on-surface border-[0.5px] border-outline-variant"
        >
          {SECTIONS.map(g => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map(it => <option key={it.id} value={it.id}>{it.method ? `${it.method} ` : ''}{it.label}</option>)}
            </optgroup>
          ))}
        </select>
        <div className="hidden lg:flex flex-col gap-3">
          {SECTIONS.map(g => (
            <div key={g.group}>
              <div className="px-2 pb-1 text-[11px] font-medium text-outline">{g.group}</div>
              {g.items.map(it => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setSection(it.id)}
                  aria-current={section === it.id ? 'page' : undefined}
                  className={`w-full flex items-center gap-2 px-2 h-[30px] rounded-md text-xs text-left cursor-pointer transition-colors ${section === it.id ? 'bg-surface-container text-on-surface font-medium' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'}`}
                >
                  {it.method && <span className="w-[38px] shrink-0 text-[10px] font-mono text-outline">{it.method}</span>}
                  <span className="truncate">{it.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>

      <div className="rounded-xl border-[0.5px] border-outline-variant p-[15px] sm:p-5 flex flex-col gap-4 min-w-0">
        {section === 'auth' && (
          <>
            <h2 className={h2}>Authentication</h2>
            <p className={p}>
              Create a key in <b className="text-on-surface font-medium">API keys</b> and send it with every request. Keys start with <code className={inlineCode}>sk_live_</code> and are shown once.
              Keep them on your server, never in browser or app code.
            </p>
            <CodeBlock copied={copied} onCopy={copy} id="auth-h" label="Headers" code={`Authorization: Bearer sk_live_…\n# or\nx-api-key: sk_live_…`} />
            <p className={p}>
              Every request also names the workspace with <code className={inlineCode}>workspace_id</code>: in the query string for GET and DELETE, in the JSON body otherwise.
              A key only works in the workspace it was created in. Your workspace ID:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 h-[34px] px-3 flex items-center rounded-md bg-surface-container-low border-[0.5px] border-outline-variant text-xs font-mono text-on-surface overflow-x-auto whitespace-nowrap">{workspaceId || '—'}</code>
              <button type="button" onClick={() => copy(workspaceId, 'ws')} disabled={!workspaceId} className="h-[34px] px-3 rounded-md border-[0.5px] border-outline-variant text-xs hover:bg-surface-container cursor-pointer inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50">
                {copied === 'ws' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                Copy
              </button>
            </div>
            <p className={p}>Check that a key works:</p>
            <CodeBlock copied={copied} onCopy={copy} id="auth-test" label="cURL" code={`curl "${origin}/api/v1/api-keys?whoami=1" \\\n  -H "Authorization: Bearer YOUR_API_KEY"`} />
            <p className={p}>All responses are JSON with a <code className={inlineCode}>success</code> field. Base URL: <code className={inlineCode}>{origin}/api/v1</code></p>
          </>
        )}

        {section === 'scopes' && (
          <>
            <h2 className={h2}>Scopes</h2>
            <p className={p}>Each key gets scopes when it’s created. A request without the needed scope gets a 403. You can only grant scopes your own role has. Keys can’t manage domains, members, webhooks or other keys.</p>
            <Table head={['Scope', 'Allows']} rows={SCOPES.map(([s, d]) => [s, d])} />
          </>
        )}

        {section === 'errors' && (
          <>
            <h2 className={h2}>Errors and limits</h2>
            <p className={p}>Errors use standard HTTP status codes and the same body:</p>
            <CodeBlock copied={copied} onCopy={copy} id="err" label="Error body" code={`{\n  "success": false,\n  "error": "Forbidden: API key does not have \\"links:delete\\" permission."\n}`} />
            <Table head={['Status', 'Meaning']} rows={ERRORS.map(([s, d]) => [s, d])} />
            <h3 className="text-xs font-semibold text-on-surface mt-1">Limits</h3>
            <ul className={`${p} list-disc pl-4 space-y-1`}>
              <li>Bulk create: 1,000 links per request.</li>
              <li>List links: 100 per request, or 10,000 with <code className={inlineCode}>all=1</code>. There’s no paging yet.</li>
              <li>Security scan: 100 links per request. Health check: 50.</li>
              <li>There’s no request rate limit today, but keep to a few requests per second and back off on 5xx errors.</li>
            </ul>
          </>
        )}

        {endpoint && (
          <>
            <div className="flex flex-col gap-2">
              <h2 className={h2}>{endpoint.title}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <MethodBadge method={endpoint.method} />
                <code className="text-xs font-mono text-on-surface break-all">{endpoint.path}</code>
                <span className="px-2 py-px rounded-full bg-surface-container text-[11px] text-on-surface-variant">Scope: <span className="font-mono">{endpoint.scope}</span></span>
              </div>
              <p className={p}>{endpoint.desc}</p>
            </div>

            {endpoint.params && (
              <>
                <h3 className="text-xs font-semibold text-on-surface">{endpoint.paramsIn === 'query' ? 'Query parameters' : 'Body fields'}</h3>
                <Table
                  head={['Name', 'Type', 'Description']}
                  rows={endpoint.params.map(pr => [
                    <span key="n">{pr.name}{pr.required && <span className="ml-1.5 text-[10px] font-sans text-error">required</span>}</span>,
                    <span key="t" className="font-mono text-[11px] break-words">{pr.type}</span>,
                    pr.desc,
                  ])}
                />
              </>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <CodeBlock copied={copied} onCopy={copy} id={`req-${endpoint.id}`} label="Request" code={curlFor(endpoint)} />
              <CodeBlock copied={copied} onCopy={copy} id={`res-${endpoint.id}`} label="Response" code={endpoint.response} />
            </div>

            {endpoint.notes && (
              <ul className={`${p} list-disc pl-4 space-y-1`}>
                {endpoint.notes.map(n => <li key={n}>{n}</li>)}
              </ul>
            )}
          </>
        )}

        {section === 'wh-events' && (
          <>
            <h2 className={h2}>Events and payloads</h2>
            <p className={p}>
              Add an endpoint in <b className="text-on-surface font-medium">Webhooks</b> and choose its events. Each event is a POST with a JSON body containing <code className={inlineCode}>event</code>, <code className={inlineCode}>timestamp</code> and <code className={inlineCode}>data</code>.
            </p>
            {WEBHOOK_EVENT_DOCS.map(ev => (
              <div key={ev.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono font-semibold text-on-surface">{ev.id}</code>
                </div>
                <p className={p}>{ev.when}</p>
                <CodeBlock copied={copied} onCopy={copy} id={`wh-${ev.id}`} label="Payload" code={ev.payload} />
              </div>
            ))}
          </>
        )}

        {section === 'wh-verify' && (
          <>
            <h2 className={h2}>Verifying signatures</h2>
            <p className={p}>
              Every delivery is signed with the endpoint’s secret (<code className={inlineCode}>whsec_…</code>, shown in Webhooks).
              <code className={inlineCode}>X-Signature-SHA256</code> is the hex HMAC-SHA256 of the raw request body. <code className={inlineCode}>X-Hub-Signature-256</code> carries the same value as <code className={inlineCode}>sha256=&lt;hex&gt;</code>.
              Compute it over the exact bytes you received, before parsing the JSON, and reject requests that don’t match.
            </p>
            <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs self-start" role="tablist" aria-label="Language">
              {([['node', 'Node.js'], ['python', 'Python']] as const).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={verifyLang === id} onClick={() => setVerifyLang(id)} className={segmented(verifyLang === id)}>{label}</button>
              ))}
            </div>
            <CodeBlock copied={copied} onCopy={copy} id={`verify-${verifyLang}`} label={verifyLang === 'node' ? 'Node.js (Express)' : 'Python (Flask)'} code={verifyLang === 'node' ? VERIFY_NODE : VERIFY_PYTHON} />
          </>
        )}

        {section === 'wh-delivery' && (
          <>
            <h2 className={h2}>Delivery</h2>
            <Table
              head={['Header', 'Value']}
              rows={[
                ['Content-Type', 'application/json'],
                ['User-Agent', 'TinyUrl-Webhooks/1.0'],
                ['X-Event', 'The event name, e.g. link.clicked'],
                ['X-Signature-SHA256', 'HMAC-SHA256 of the body, hex'],
                ['X-Hub-Signature-256', 'sha256=<same hex>'],
              ]}
            />
            <ul className={`${p} list-disc pl-4 space-y-1`}>
              <li>Reply with any 2xx within 4 seconds. Do slow work after replying.</li>
              <li>Deliveries are sent once and aren’t retried, so log what you receive. Redirects aren’t followed.</li>
              <li>Endpoints must be public http(s) URLs; private and local addresses are refused.</li>
              <li>Paused endpoints receive nothing until resumed.</li>
              <li>Use the send button on an endpoint for a signed test delivery (<code className={inlineCode}>&quot;test&quot;: true</code> in the body).</li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
};
