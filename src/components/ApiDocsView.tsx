'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';
import { SkeletonSettingsView } from '@/components/ui';
import { hasPermission, Permission } from '@/lib/rbac';
import { ApiKey, Webhook } from '@/lib/types';
import {
  Key,
  Trash2,
  Play,
  Copy,
  Check,
  Send,
  Eye,
  EyeOff,
  X,
  PlayCircle,
  PauseCircle,
  Webhook as WebhookIcon,
  Globe2,
  Clock
} from 'lucide-react';

type ApiTab = 'keys' | 'webhooks' | 'console' | 'reference';
type LangType = 'curl' | 'js' | 'python';
type Endpoint = 'shorten' | 'bulk' | 'links' | 'audit' | 'analytics';

// Scopes offered for new keys, with the permission each one needs (see /api/v1/api-keys)
const KEY_SCOPES: { id: string; label: string; needs: Permission }[] = [
  { id: 'links:create', label: 'Create links', needs: 'links:create' },
  { id: 'links:edit', label: 'Edit links', needs: 'links:edit' },
  { id: 'links:delete', label: 'Delete links', needs: 'links:delete' },
  { id: 'export:data', label: 'Read links and export', needs: 'export:data' },
  { id: 'analytics:read', label: 'Read analytics', needs: 'analytics:read' },
  { id: 'campaigns:create', label: 'Create campaigns', needs: 'campaigns:create' },
];

const WEBHOOK_EVENTS = [
  { id: 'link.created', label: 'Link created' },
  { id: 'link.clicked', label: 'Link clicked' },
  { id: 'link.flagged', label: 'Link flagged by a scan' },
];

const ENDPOINTS: { id: Endpoint; method: 'GET' | 'POST'; path: string; label: string; scope: string; desc: string }[] = [
  { id: 'shorten', method: 'POST', path: '/api/v1/shorten', label: 'Create link', scope: 'links:create', desc: 'One short link, with optional slug, title and UTM tags.' },
  { id: 'bulk', method: 'POST', path: '/api/v1/links/bulk', label: 'Bulk create', scope: 'links:create', desc: 'Up to 1,000 links in one request.' },
  { id: 'links', method: 'GET', path: '/api/v1/links', label: 'List links', scope: 'export:data', desc: 'Links in the workspace, newest first. Add all=1 for more than 100.' },
  { id: 'analytics', method: 'GET', path: '/api/v1/analytics', label: 'Analytics', scope: 'analytics:read', desc: 'Click totals, sources, countries and devices.' },
  { id: 'audit', method: 'POST', path: '/api/v1/security/audit', label: 'Security scan', scope: 'links:edit', desc: 'Scans destinations; flags phishing and private-network targets.' },
];

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

export const ApiDocsView: React.FC = () => {
  const {
    apiKeys,
    addApiKey,
    deleteApiKey,
    webhooks,
    addWebhook,
    deleteWebhook,
    toggleWebhook,
    currentWorkspace,
    currentUserRole,
    checkPermissionOrToast,
    refreshSettings,
    refreshLinks,
    isInitialLoading,
    isSettingsLoading
  } = useStore();
  const { showToast } = useToast();

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const [activeTab, setActiveTab] = useState<ApiTab>('keys');
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // Read after mount so server and browser render the same markup
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const wsId = currentWorkspace?.id || '';
  const canManage = hasPermission(currentUserRole, 'api_keys:manage');
  const offeredScopes = KEY_SCOPES.filter(s => hasPermission(currentUserRole, s.needs));

  // ── Keys ──
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['links:create', 'export:data', 'analytics:read']);
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKey | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim() || creatingKey) return;
    if (!checkPermissionOrToast('api_keys:manage', 'create API keys')) return;
    const scopes = selectedScopes.filter(id => offeredScopes.some(s => s.id === id));
    if (scopes.length === 0) {
      showToast('error', 'Choose at least one scope');
      return;
    }
    setCreatingKey(true);
    const created = await addApiKey(keyName.trim(), scopes);
    setCreatingKey(false);
    if (created) {
      setCreatedKey(created);
      setKeyName('');
    }
  };

  // ── Webhooks ──
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>(['link.created']);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim() || savingWebhook) return;
    if (!checkPermissionOrToast('api_keys:manage', 'add webhooks')) return;
    if (webhookEvents.length === 0) {
      showToast('error', 'Choose at least one event');
      return;
    }
    setSavingWebhook(true);
    const created = await addWebhook(webhookUrl.trim(), webhookEvents);
    setSavingWebhook(false);
    if (created) {
      setWebhookUrl('');
      showToast('success', 'Webhook added', 'Copy its signing secret from the list.');
    }
  };

  const handleTestWebhook = async (wh: Webhook) => {
    setTestingWebhookId(wh.id);
    try {
      const res = await fetch('/api/v1/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-workspace-id': wsId },
        body: JSON.stringify({ webhook_id: wh.id, workspace_id: wsId })
      });
      const data = await res.json().catch(() => null);
      if (data?.success) showToast('success', 'Test delivered', `HTTP ${data.status_code} · ${data.latency_ms} ms`);
      else showToast('error', 'Test failed', data?.error || data?.message || `HTTP ${data?.status_code || res.status}`);
    } catch {
      showToast('error', 'Test failed', 'Network error.');
    } finally {
      setTestingWebhookId(null);
    }
  };

  // ── Try it ──
  const [endpoint, setEndpoint] = useState<Endpoint>('shorten');
  const [lang, setLang] = useState<LangType>('curl');
  const [destination, setDestination] = useState('https://github.com/trending');
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [bulkUrls, setBulkUrls] = useState('https://docs.github.com\nhttps://www.githubstatus.com');
  const [response, setResponse] = useState<{ status: number; ms: number; body: unknown } | null>(null);
  const [running, setRunning] = useState(false);

  const spec = ENDPOINTS.find(e => e.id === endpoint)!;
  const requestBody = useMemo((): Record<string, unknown> | null => {
    if (endpoint === 'shorten') {
      return { workspace_id: wsId, destination_url: destination.trim(), ...(slug.trim() ? { custom_slug: slug.trim() } : {}), ...(title.trim() ? { title: title.trim() } : {}) };
    }
    if (endpoint === 'bulk') {
      return { workspace_id: wsId, batch_name: 'API test', items: bulkUrls.split('\n').map(u => u.trim()).filter(Boolean).map(u => ({ destination_url: u })) };
    }
    if (endpoint === 'audit') return { workspace_id: wsId };
    return null;
  }, [endpoint, wsId, destination, slug, title, bulkUrls]);
  const requestUrl = `${origin}${spec.path}${spec.method === 'GET' ? `?workspace_id=${encodeURIComponent(wsId)}` : ''}`;

  const snippet = useMemo(() => {
    const keyHint = 'YOUR_API_KEY';
    const json = requestBody ? JSON.stringify(requestBody, null, 2) : '';
    if (lang === 'curl') {
      return [
        `curl -X ${spec.method} "${requestUrl}" \\`,
        `  -H "Authorization: Bearer ${keyHint}"${requestBody ? ' \\' : ''}`,
        ...(requestBody ? [`  -H "Content-Type: application/json" \\`, `  -d '${json.replace(/'/g, "'\\''")}'`] : []),
      ].join('\n');
    }
    if (lang === 'js') {
      return `const res = await fetch('${requestUrl}', {
  method: '${spec.method}',
  headers: {
    Authorization: 'Bearer ${keyHint}'${requestBody ? `,\n    'Content-Type': 'application/json'` : ''}
  }${requestBody ? `,\n  body: JSON.stringify(${json.replace(/\n/g, '\n  ')})` : ''}
});
const data = await res.json();
console.log(data);`;
    }
    return `import requests

res = requests.${spec.method.toLowerCase()}(
    "${requestUrl}",
    headers={"Authorization": "Bearer ${keyHint}"}${requestBody ? `,\n    json=${json.replace(/\n/g, '\n    ').replace(/true/g, 'True').replace(/false/g, 'False')}` : ''}
)
print(res.status_code, res.json())`;
  }, [lang, spec, requestUrl, requestBody]);

  // Runs the request as the signed-in user (session cookie), not with an API key
  const runRequest = async () => {
    setRunning(true);
    setResponse(null);
    const started = Date.now();
    try {
      const res = await fetch(requestUrl, {
        method: spec.method,
        headers: { 'x-workspace-id': wsId, ...(requestBody ? { 'Content-Type': 'application/json' } : {}) },
        body: requestBody ? JSON.stringify(requestBody) : undefined
      });
      const body = await res.json().catch(() => ({ error: 'Response was not JSON.' }));
      setResponse({ status: res.status, ms: Date.now() - started, body });
      if (res.ok && (endpoint === 'shorten' || endpoint === 'bulk')) refreshLinks(true);
    } catch (err) {
      setResponse({ status: 0, ms: Date.now() - started, body: { error: err instanceof Error ? err.message : 'Network error.' } });
    } finally {
      setRunning(false);
    }
  };

  if ((isInitialLoading || isSettingsLoading) && apiKeys.length === 0 && webhooks.length === 0) {
    return <SkeletonSettingsView />;
  }

  const lastUsed = apiKeys.map(k => k.last_used).filter(Boolean).sort().pop();
  const iconBtn = 'size-[30px] rounded-md grid place-items-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50';
  const input = 'h-[34px] px-3 bg-surface-container-low rounded-md text-xs text-on-surface border-[0.5px] border-outline-variant outline-none focus:border-on-surface-variant';
  const primaryBtn = 'h-[34px] px-4 rounded-md bg-primary-container text-on-primary text-xs font-medium hover:bg-primary transition-colors cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5';
  const segmented = (active: boolean) => `h-[26px] px-3 rounded-[4px] whitespace-nowrap transition-colors cursor-pointer ${active ? 'bg-surface-container-lowest text-on-surface font-medium shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`;
  const checkbox = (checked: boolean, onChange: () => void, label: string, key: string) => (
    <label key={key} className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="w-3.5 h-3.5 accent-[var(--color-primary-strong)] cursor-pointer" />
      {label}
    </label>
  );

  return (
    <div className="flex flex-col w-full gap-[15px] pb-16 animate-fade-in text-on-surface">

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-[15px]">
        {[
          { icon: <Key className="w-5 h-5" />, value: String(apiKeys.length), label: 'API keys', hint: 'In this workspace' },
          { icon: <WebhookIcon className="w-5 h-5" />, value: String(webhooks.length), label: 'Webhooks', hint: `${webhooks.filter(w => w.active).length} active` },
          { icon: <Clock className="w-5 h-5" />, value: lastUsed ? fmtDate(lastUsed) : '—', label: 'Last key use', hint: lastUsed ? 'Most recent request' : 'Not used yet' },
          { icon: <Globe2 className="w-5 h-5" />, value: origin.replace(/^https?:\/\//, ''), label: 'Base URL', hint: '/api/v1', copyValue: `${origin}/api/v1` },
        ].map(card => (
          <div key={card.label} className="flex items-center gap-[10px] rounded-xl border-[0.5px] border-outline-variant p-[15px] min-w-0">
            <div className="grid size-[40px] place-items-center rounded-md bg-surface-container text-on-surface-variant shrink-0">{card.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-on-surface truncate" title={card.value}>{card.value}</div>
              <p className="text-xs text-outline truncate">{card.label} · {card.hint}</p>
            </div>
            {'copyValue' in card && card.copyValue && (
              <button type="button" onClick={() => copy(card.copyValue!, 'base')} title="Copy base URL" aria-label="Copy base URL" className={iconBtn}>
                {copied === 'base' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs self-start max-w-full overflow-x-auto" role="tablist" aria-label="Developer sections">
        {([
          { id: 'keys', label: 'API keys' },
          { id: 'webhooks', label: 'Webhooks' },
          { id: 'console', label: 'Try it' },
          { id: 'reference', label: 'Reference' },
        ] as const).map(tab => (
          <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={segmented(activeTab === tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── API keys ── */}
      {activeTab === 'keys' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[15px] items-start">
          {canManage && (
            <form onSubmit={handleCreateKey} className="lg:col-span-4 rounded-xl border-[0.5px] border-outline-variant p-[15px] flex flex-col gap-3">
              <h2 className="text-[14px] font-semibold text-on-surface">New key</h2>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-on-surface-variant">Name</span>
                <input type="text" required maxLength={100} value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. Zapier" className={input} />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-on-surface-variant">Scopes</span>
                {offeredScopes.map(s => checkbox(
                  selectedScopes.includes(s.id),
                  () => setSelectedScopes(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]),
                  s.label,
                  s.id
                ))}
              </div>
              <button type="submit" disabled={creatingKey} className={primaryBtn}>{creatingKey ? 'Creating…' : 'Create key'}</button>
            </form>
          )}

          <div className={`${canManage ? 'lg:col-span-8' : 'lg:col-span-12'} rounded-xl border-[0.5px] border-outline-variant overflow-hidden`}>
            <div className="px-[15px] py-3 border-b-[0.5px] border-outline-variant flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-on-surface">Keys</h2>
              <span className="text-xs text-outline">Send as <code className="text-on-surface-variant">Authorization: Bearer &lt;key&gt;</code></span>
            </div>
            {apiKeys.length === 0 ? (
              <p className="py-10 px-6 text-center text-xs text-on-surface-variant">{canManage ? 'No keys yet. Create one to call the API from your own code.' : 'No keys yet. Ask an owner or admin to create one.'}</p>
            ) : (
              <div className="flex flex-col">
                {apiKeys.map(k => (
                  <div key={k.id} className="px-[15px] py-2.5 flex items-center gap-3 border-b-[0.5px] border-outline-variant last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-on-surface truncate">{k.name}</div>
                      <div className="text-[11px] text-outline truncate">
                        <span className="font-mono">{k.key_prefix}…</span> · {(k.permissions || []).join(', ')}
                      </div>
                    </div>
                    <div className="hidden sm:block text-right text-[11px] text-outline shrink-0">
                      <div>Created {fmtDate(k.created_at)}</div>
                      <div>{k.last_used ? `Used ${fmtDate(k.last_used)}` : 'Never used'}</div>
                    </div>
                    {canManage && (
                      <button type="button" onClick={() => setKeyToRevoke(k)} title="Revoke key" aria-label={`Revoke ${k.name}`} className={`${iconBtn} hover:!text-error hover:!bg-error-container`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Webhooks ── */}
      {activeTab === 'webhooks' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[15px] items-start">
          <div className="lg:col-span-4 flex flex-col gap-[15px]">
            {canManage && (
              <form onSubmit={handleAddWebhook} className="rounded-xl border-[0.5px] border-outline-variant p-[15px] flex flex-col gap-3">
                <h2 className="text-[14px] font-semibold text-on-surface">New webhook</h2>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-on-surface-variant">Endpoint URL</span>
                  <input type="url" required value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://example.com/hooks/snip" className={input} />
                </label>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] text-on-surface-variant">Events</span>
                  {WEBHOOK_EVENTS.map(ev => checkbox(
                    webhookEvents.includes(ev.id),
                    () => setWebhookEvents(prev => prev.includes(ev.id) ? prev.filter(x => x !== ev.id) : [...prev, ev.id]),
                    ev.label,
                    ev.id
                  ))}
                </div>
                <button type="submit" disabled={savingWebhook} className={primaryBtn}>{savingWebhook ? 'Saving…' : 'Add webhook'}</button>
              </form>
            )}
            <div className="rounded-xl border-[0.5px] border-outline-variant p-[15px]">
              <h2 className="text-[14px] font-semibold text-on-surface">Verifying deliveries</h2>
              <p className="mt-1 text-xs text-on-surface-variant">Each POST carries <code>X-Signature-SHA256</code>: the HMAC-SHA256 of the raw body with the webhook&rsquo;s secret.</p>
              <pre className="mt-2 p-3 rounded-md bg-surface-container-low border-[0.5px] border-outline-variant text-[11px] font-mono text-on-surface overflow-x-auto leading-relaxed">{`const expected = crypto
  .createHmac('sha256', secret)
  .update(rawBody)
  .digest('hex');
const ok = crypto.timingSafeEqual(
  Buffer.from(req.headers['x-signature-sha256']),
  Buffer.from(expected)
);`}</pre>
            </div>
          </div>

          <div className="lg:col-span-8 rounded-xl border-[0.5px] border-outline-variant overflow-hidden">
            <div className="px-[15px] py-3 border-b-[0.5px] border-outline-variant">
              <h2 className="text-[14px] font-semibold text-on-surface">Webhooks</h2>
            </div>
            {webhooks.length === 0 ? (
              <p className="py-10 px-6 text-center text-xs text-on-surface-variant">No webhooks yet.</p>
            ) : (
              <div className="flex flex-col">
                {webhooks.map(wh => {
                  const hasSecret = !!wh.secret && !wh.secret.includes('•');
                  return (
                    <div key={wh.id} className="px-[15px] py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 border-b-[0.5px] border-outline-variant last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${wh.active ? 'bg-emerald-500' : 'bg-outline'}`} title={wh.active ? 'Active' : 'Paused'} />
                          <span className="text-xs font-medium text-on-surface truncate" title={wh.url}>{wh.url}</span>
                        </div>
                        <div className="text-[11px] text-outline truncate">{(wh.events || []).join(', ')}</div>
                        {hasSecret && (
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-outline">
                            <span className="font-mono truncate">{revealed[wh.id] ? wh.secret : 'whsec_••••••••••••'}</span>
                            <button type="button" onClick={() => setRevealed(p => ({ ...p, [wh.id]: !p[wh.id] }))} aria-label={revealed[wh.id] ? 'Hide secret' : 'Show secret'} className="p-0.5 hover:text-on-surface cursor-pointer">
                              {revealed[wh.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            <button type="button" onClick={() => copy(wh.secret!, `sec_${wh.id}`)} aria-label="Copy secret" className="p-0.5 hover:text-on-surface cursor-pointer">
                              {copied === `sec_${wh.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button type="button" onClick={() => handleTestWebhook(wh)} disabled={testingWebhookId === wh.id} title="Send test" aria-label="Send test" className={iconBtn}>
                            <Send className={`w-3.5 h-3.5 ${testingWebhookId === wh.id ? 'animate-pulse' : ''}`} />
                          </button>
                          <button type="button" onClick={() => toggleWebhook(wh.id)} title={wh.active ? 'Pause' : 'Resume'} aria-label={wh.active ? 'Pause' : 'Resume'} className={iconBtn}>
                            {wh.active ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                          </button>
                          <button type="button" onClick={() => deleteWebhook(wh.id)} title="Delete webhook" aria-label="Delete webhook" className={`${iconBtn} hover:!text-error hover:!bg-error-container`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Try it ── */}
      {activeTab === 'console' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[15px] items-start">
          <div className="lg:col-span-7 rounded-xl border-[0.5px] border-outline-variant p-[15px] flex flex-col gap-3">
            <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs self-start max-w-full overflow-x-auto" role="tablist" aria-label="Endpoint">
              {ENDPOINTS.map(ep => (
                <button key={ep.id} type="button" role="tab" aria-selected={endpoint === ep.id} onClick={() => { setEndpoint(ep.id); setResponse(null); }} className={segmented(endpoint === ep.id)}>
                  {ep.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-on-surface-variant">
              <span className="font-mono text-on-surface">{spec.method} {spec.path}</span> · {spec.desc}
            </p>

            {endpoint === 'shorten' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1 sm:col-span-3">
                  <span className="text-[11px] text-on-surface-variant">Destination URL</span>
                  <input type="url" value={destination} onChange={(e) => setDestination(e.target.value)} className={input} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-on-surface-variant">Slug <span className="text-outline">(optional)</span></span>
                  <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className={input} />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[11px] text-on-surface-variant">Title <span className="text-outline">(optional)</span></span>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
                </label>
              </div>
            )}
            {endpoint === 'bulk' && (
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-on-surface-variant">URLs, one per line</span>
                <textarea rows={4} value={bulkUrls} onChange={(e) => setBulkUrls(e.target.value)} className="px-3 py-2 bg-surface-container-low rounded-md text-xs text-on-surface border-[0.5px] border-outline-variant outline-none focus:border-on-surface-variant font-mono" />
              </label>
            )}
            {endpoint === 'audit' && <p className="text-[11px] text-amber-700">Running this scans your links for real and updates their flags.</p>}

            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs" role="tablist" aria-label="Language">
                {([['curl', 'cURL'], ['js', 'JavaScript'], ['python', 'Python']] as const).map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={lang === id} onClick={() => setLang(id)} className={segmented(lang === id)}>{label}</button>
                ))}
              </div>
              <button type="button" onClick={() => copy(snippet, 'snippet')} title="Copy code" aria-label="Copy code" className={iconBtn}>
                {copied === 'snippet' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <pre className="p-3 rounded-md bg-surface-container-low border-[0.5px] border-outline-variant text-[11px] font-mono text-on-surface overflow-x-auto leading-relaxed">{snippet}</pre>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-outline">Run sends it as you (signed in). Replace YOUR_API_KEY to call it from code.</span>
              <button type="button" onClick={runRequest} disabled={running || !wsId} className={primaryBtn}>
                <Play className="w-3.5 h-3.5" />
                <span>{running ? 'Running…' : 'Run'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border-[0.5px] border-outline-variant p-[15px] flex flex-col gap-2 min-w-0">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-on-surface">Response</h2>
              {response && (
                <span className={`text-[11px] font-mono ${response.status >= 200 && response.status < 300 ? 'text-emerald-700' : 'text-error'}`}>
                  {response.status || 'ERR'} · {response.ms} ms
                </span>
              )}
            </div>
            <pre className="p-3 rounded-md bg-surface-container-low border-[0.5px] border-outline-variant text-[11px] font-mono text-on-surface overflow-auto max-h-[420px] leading-relaxed min-h-[120px]">
              {response ? JSON.stringify(response.body, null, 2) : 'Run a request to see the response.'}
            </pre>
          </div>
        </div>
      )}

      {/* ── Reference ── */}
      {activeTab === 'reference' && (
        <div className="rounded-xl border-[0.5px] border-outline-variant overflow-hidden">
          <div className="px-[15px] py-3 border-b-[0.5px] border-outline-variant text-xs text-on-surface-variant">
            All requests: <code className="text-on-surface">Authorization: Bearer &lt;key&gt;</code> and a <code className="text-on-surface">workspace_id</code> (query for GET, body for POST). Keys only work in the workspace they were created in.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant border-b-[0.5px] border-outline-variant">
                  <th className="py-2.5 px-[15px] font-medium">Endpoint</th>
                  <th className="py-2.5 px-3 font-medium">Scope</th>
                  <th className="py-2.5 px-[15px] font-medium">What it does</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map(ep => (
                  <tr key={ep.id} className="border-b-[0.5px] border-outline-variant last:border-b-0">
                    <td className="py-2.5 px-[15px] font-mono whitespace-nowrap"><span className="text-primary-ink">{ep.method}</span> {ep.path}</td>
                    <td className="py-2.5 px-3 font-mono text-on-surface-variant whitespace-nowrap">{ep.scope}</td>
                    <td className="py-2.5 px-[15px] text-on-surface-variant">{ep.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New key: shown once */}
      {createdKey && createPortal(
        <div className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest rounded-xl max-w-md w-full p-6 shadow-2xl border-[0.5px] border-outline-variant">
            <h3 className="text-base font-semibold text-on-surface">Copy your key</h3>
            <p className="mt-1 text-xs text-on-surface-variant">This is the only time it&rsquo;s shown. Store it somewhere safe, like an environment variable.</p>
            <div className="mt-4 flex items-center gap-2">
              <code className="flex-1 min-w-0 h-[34px] px-3 flex items-center rounded-md bg-surface-container-low border-[0.5px] border-outline-variant text-xs font-mono text-on-surface overflow-x-auto whitespace-nowrap">{createdKey.full_key}</code>
              <button type="button" onClick={() => copy(createdKey.full_key, 'newkey')} className="h-[34px] px-3 rounded-md border-[0.5px] border-outline-variant text-xs hover:bg-surface-container cursor-pointer inline-flex items-center gap-1.5 shrink-0">
                {copied === 'newkey' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === 'newkey' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setCreatedKey(null)} className={primaryBtn}>Done</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Revoke confirmation */}
      {keyToRevoke && createPortal(
        <div className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-4 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setKeyToRevoke(null); }}>
          <div className="bg-surface-container-lowest rounded-xl max-w-sm w-full p-6 shadow-2xl border-[0.5px] border-outline-variant">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-on-surface">Revoke &ldquo;{keyToRevoke.name}&rdquo;?</h3>
              <button type="button" onClick={() => setKeyToRevoke(null)} aria-label="Close" className={iconBtn}><X className="w-4 h-4" /></button>
            </div>
            <p className="mt-1 text-xs text-on-surface-variant">Anything using this key stops working right away.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setKeyToRevoke(null)} className="h-[34px] px-4 rounded-md text-xs text-on-surface-variant hover:bg-surface-container-low cursor-pointer">Cancel</button>
              <button type="button" onClick={() => { deleteApiKey(keyToRevoke.id); setKeyToRevoke(null); }} className="h-[34px] px-4 rounded-md bg-error text-on-error text-xs font-medium hover:opacity-90 cursor-pointer">Revoke</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
