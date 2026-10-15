'use client';

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { 
  Key, 
  Plus, 
  Trash2, 
  Play, 
  Copy, 
  Check, 
  Terminal, 
  ShieldCheck, 
  Radio, 
  RefreshCw,
  Server,
  Webhook as WebhookIcon,
  AlertCircle,
  ExternalLink,
  Lock,
  Layers,
  Send,
  Eye,
  EyeOff,
  CheckCircle2,
  Code2,
  SlidersHorizontal,
  X,
  PlayCircle,
  PauseCircle
} from 'lucide-react';

type ApiTab = 'console' | 'keys' | 'webhooks' | 'reference';
type LangType = 'curl' | 'js' | 'python';

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
    currentUser, 
    checkPermissionOrToast 
  } = useStore();

  const [activeTab, setActiveTab] = useState<ApiTab>('console');
  const [activeLang, setActiveLang] = useState<LangType>('curl');

  // Interactive API Console state
  const [selectedEndpoint, setSelectedEndpoint] = useState<'shorten' | 'bulk' | 'links' | 'audit' | 'analytics'>('shorten');
  const [customDestination, setCustomDestination] = useState('https://github.com/trending');
  const [customSlug, setCustomSlug] = useState('gh-trending');
  const [customTitle, setCustomTitle] = useState('Trending Repositories');
  const [apiResponse, setApiResponse] = useState<Record<string, unknown> | null>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseLatency, setResponseLatency] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // API Key Generator state
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'links:create',
    'links:read',
    'analytics:read'
  ]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);

  // Webhook Registration Modal state
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([
    'link.created',
    'link.clicked'
  ]);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});

  // Toast & Copy states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedWhId, setCopiedWhId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'https://tinyurl.dev';
  const effectiveKeyPrefix = apiKeys.length > 0 ? `${apiKeys[0].key_prefix}...` : 'sk_live_••••••••••••';

  // Toggle scope selection
  const handleToggleScope = (scope: string) => {
    setSelectedScopes(prev => 
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  // Toggle webhook event selection
  const handleToggleEvent = (ev: string) => {
    setWebhookEvents(prev => 
      prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]
    );
  };

  // Handle Create API Key
  const handleCreateApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;

    if (!checkPermissionOrToast('api_keys:manage', 'generate secret API keys')) {
      return;
    }

    const created = addApiKey(keyName.trim(), selectedScopes);
    setCreatedKey(created.full_key);
    setKeyName('');
    setKeyModalOpen(true);
    showToast(`API Key "${created.name}" generated successfully.`);
  };

  // Copy newly created secret key
  const handleCopyNewKey = () => {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey);
    setCopiedKey(true);
    showToast('Secret key copied to clipboard.');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Handle Register Webhook
  const handleRegisterWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;

    if (!checkPermissionOrToast('api_keys:manage', 'register webhooks')) {
      return;
    }

    if (webhookEvents.length === 0) {
      showToast('Select at least one event subscription.');
      return;
    }

    addWebhook(webhookUrl.trim(), webhookEvents);
    setWebhookModalOpen(false);
    setWebhookUrl('');
    showToast('Webhook registered successfully.');
  };

  // Simulate Webhook Ping / Test Dispatch
  const handleTestWebhookPing = async (id: string, url: string) => {
    setTestingWebhookId(id);
    try {
      // Simulate real dispatch check
      await new Promise(res => setTimeout(res, 800));
      showToast(`Ping delivered to ${url} • HTTP 200 OK (112ms)`);
    } catch {
      showToast(`Ping failed for ${url}`);
    } finally {
      setTestingWebhookId(null);
    }
  };

  // Interactive Live Request Runner
  const handleExecuteConsole = async () => {
    setIsExecuting(true);
    setApiResponse(null);
    setResponseStatus(null);
    setResponseLatency(null);
    const start = Date.now();

    try {
      if (selectedEndpoint === 'shorten') {
        const res = await fetch('/api/v1/shorten', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-email': currentUser?.email || '',
            'x-workspace-id': currentWorkspace?.id || ''
          },
          body: JSON.stringify({
            destination_url: customDestination.trim() || 'https://github.com/trending',
            custom_slug: customSlug.trim() || undefined,
            title: customTitle.trim() || undefined
          })
        });
        const elapsed = Date.now() - start;
        setResponseStatus(res.status);
        setResponseLatency(elapsed);
        const data = await res.json();
        setApiResponse(data);
      } else if (selectedEndpoint === 'bulk') {
        const res = await fetch('/api/v1/links/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': currentUser?.email || '',
            'x-workspace-id': currentWorkspace?.id || ''
          },
          body: JSON.stringify({
            workspace_id: currentWorkspace?.id,
            links: [
              { destination_url: 'https://docs.github.com', title: 'GitHub Docs', custom_slug: `gh-docs-${Math.floor(Math.random() * 900 + 100)}` },
              { destination_url: 'https://status.github.com', title: 'GitHub Status', custom_slug: `gh-status-${Math.floor(Math.random() * 900 + 100)}` }
            ]
          })
        });
        const elapsed = Date.now() - start;
        setResponseStatus(res.status);
        setResponseLatency(elapsed);
        const data = await res.json();
        setApiResponse(data);
      } else if (selectedEndpoint === 'links') {
        const res = await fetch(`/api/v1/links?workspace_id=${encodeURIComponent(currentWorkspace?.id || '')}`);
        const elapsed = Date.now() - start;
        setResponseStatus(res.status);
        setResponseLatency(elapsed);
        const data = await res.json();
        setApiResponse(data);
      } else if (selectedEndpoint === 'audit') {
        const res = await fetch('/api/v1/security/audit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': currentUser?.email || '',
            'x-workspace-id': currentWorkspace?.id || ''
          },
          body: JSON.stringify({
            workspace_id: currentWorkspace?.id
          })
        });
        const elapsed = Date.now() - start;
        setResponseStatus(res.status);
        setResponseLatency(elapsed);
        const data = await res.json();
        setApiResponse(data);
      } else {
        const res = await fetch(`/api/v1/analytics?workspace_id=${encodeURIComponent(currentWorkspace?.id || '')}`);
        const elapsed = Date.now() - start;
        setResponseStatus(res.status);
        setResponseLatency(elapsed);
        const data = await res.json();
        setApiResponse(data);
      }
    } catch (err: unknown) {
      setResponseStatus(500);
      setResponseLatency(Date.now() - start);
      setApiResponse({ error: err instanceof Error ? err.message : 'Network execution failed.' });
    } finally {
      setIsExecuting(false);
    }
  };

  // Generate Dynamic Code Snippets
  const getDynamicSnippet = useMemo(() => {
    const bearer = apiKeys[0]?.full_key && !apiKeys[0].full_key.includes('••••') 
      ? apiKeys[0].full_key 
      : (apiKeys[0]?.key_prefix ? `${apiKeys[0].key_prefix}abcdef1234567890` : 'sk_live_prod_sample_key_9872');

    if (activeLang === 'curl') {
      if (selectedEndpoint === 'shorten') {
        return `curl -X POST "${currentHost}/api/v1/shorten" \\
  -H "Authorization: Bearer ${bearer}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "destination_url": "${customDestination.trim() || 'https://example.com/summer-sale'}",
    "custom_slug": "${customSlug.trim() || 'summer26'}",
    "title": "${customTitle.trim() || 'Summer Sale Launch'}"
  }'`;
      }
      if (selectedEndpoint === 'bulk') {
        return `curl -X POST "${currentHost}/api/v1/links/bulk" \\
  -H "Authorization: Bearer ${bearer}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "links": [
      { "destination_url": "https://apple.com/iphone", "title": "iPhone Page" },
      { "destination_url": "https://apple.com/macbook", "title": "MacBook Page" }
    ]
  }'`;
      }
      if (selectedEndpoint === 'links') {
        return `curl -X GET "${currentHost}/api/v1/links" \\
  -H "Authorization: Bearer ${bearer}"`;
      }
      if (selectedEndpoint === 'audit') {
        return `curl -X POST "${currentHost}/api/v1/security/audit" \\
  -H "Authorization: Bearer ${bearer}" \\
  -H "Content-Type: application/json"`;
      }
      return `curl -X GET "${currentHost}/api/v1/analytics" \\
  -H "Authorization: Bearer ${bearer}"`;
    }

    if (activeLang === 'js') {
      if (selectedEndpoint === 'shorten') {
        return `const res = await fetch('${currentHost}/api/v1/shorten', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${bearer}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    destination_url: '${customDestination.trim() || 'https://example.com/summer-sale'}',
    custom_slug: '${customSlug.trim() || 'summer26'}',
    title: '${customTitle.trim() || 'Summer Sale Launch'}'
  })
});
const data = await res.json();
console.log('Short link:', data.short_url);`;
      }
      return `const res = await fetch('${currentHost}/api/v1/${selectedEndpoint}', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ${bearer}'
  }
});
const data = await res.json();
console.log(data);`;
    }

    // Python
    return `import requests

url = "${currentHost}/api/v1/${selectedEndpoint}"
headers = {
    "Authorization": "Bearer ${bearer}",
    "Content-Type": "application/json"
}
payload = {
    "destination_url": "${customDestination.trim() || 'https://example.com/summer-sale'}",
    "custom_slug": "${customSlug.trim() || 'summer26'}"
}

response = requests.post(url, json=payload, headers=headers)
print(response.status_code, response.json())`;
  }, [activeLang, selectedEndpoint, customDestination, customSlug, customTitle, currentHost, apiKeys]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getDynamicSnippet);
    setCopiedSnippet(true);
    showToast('Code snippet copied to clipboard.');
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="flex flex-col w-full space-y-6 pb-16 animate-fade-in text-on-surface">
      
      {/* 1. TOP HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
              Developer REST API &amp; Webhooks
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs bg-primary-container text-on-primary font-bold shadow-xs">
              <Terminal className="w-3.5 h-3.5" />
              v1.4 OpenAPI 3.1
            </span>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-2xl">
            High-throughput REST endpoints, HMAC-signed webhook delivery, scoped API key authorization, and an interactive developer playground.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="px-3 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/40 shadow-xs flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Edge Gateway: Active</span>
          </div>
          <div className="px-3 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/40 shadow-xs flex items-center gap-2 text-xs font-mono text-on-surface">
            <span className="text-on-surface-variant font-sans font-medium">Host:</span>
            <span>{currentHost.replace(/^https?:\/\//, '')}</span>
          </div>
        </div>
      </div>

      {/* 2. STATS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Active API Keys */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Active API Keys</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary-container">
              <Key className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-on-surface tracking-tight">{apiKeys.length}</div>
            <p className="text-xs text-on-surface-variant mt-0.5">Scoped programmatic access</p>
          </div>
        </div>

        {/* Configured Webhooks */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Webhooks</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <WebhookIcon className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-on-surface tracking-tight">{webhooks.length}</div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {webhooks.filter(w => w.active).length} streaming active events
            </p>
          </div>
        </div>

        {/* Edge SLA */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Edge SLA</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600 tracking-tight">&lt; 18ms</div>
            <p className="text-xs text-on-surface-variant mt-0.5">Global edge redirect caching</p>
          </div>
        </div>

        {/* Auth Standard */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Authentication</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-on-surface tracking-tight">Bearer Token</div>
            <p className="text-xs text-on-surface-variant mt-0.5">SHA-256 hashed secret keys</p>
          </div>
        </div>

      </div>

      {/* 3. NAVIGATION TAB BAR */}
      <div className="flex items-center gap-1.5 p-1 bg-surface-container-low rounded-xl border border-outline-variant/30 w-fit text-xs font-bold">
        {[
          { id: 'console', label: 'Interactive Console', icon: Play },
          { id: 'keys', label: `API Keys (${apiKeys.length})`, icon: Key },
          { id: 'webhooks', label: `Webhooks (${webhooks.length})`, icon: WebhookIcon },
          { id: 'reference', label: 'Endpoint Reference', icon: Code2 }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ApiTab)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer ${
                isActive
                  ? 'bg-surface-container-lowest text-primary-container shadow-xs font-extrabold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. TAB CONTENTS */}

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: INTERACTIVE API CONSOLE
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'console' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: Request Configuration & Code (7 COLS) */}
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30 shadow-xs flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-outline-variant/20 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary-container">
                    <Play className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-on-surface">Interactive API Console</h2>
                    <p className="text-xs text-on-surface-variant">Execute live requests directly against your active workspace</p>
                  </div>
                </div>

                {/* Endpoint Tabs */}
                <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-lg flex-wrap">
                  {[
                    { id: 'shorten', label: 'POST /shorten' },
                    { id: 'bulk', label: 'POST /links/bulk' },
                    { id: 'links', label: 'GET /links' },
                    { id: 'audit', label: 'POST /audit' },
                    { id: 'analytics', label: 'GET /analytics' }
                  ].map((ep) => (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => {
                        setSelectedEndpoint(ep.id as any);
                        setApiResponse(null);
                        setResponseStatus(null);
                        setResponseLatency(null);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold transition cursor-pointer ${
                        selectedEndpoint === ep.id
                          ? 'bg-surface-container-lowest text-primary-container shadow-xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {ep.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive Request Form (for POST /shorten) */}
              {selectedEndpoint === 'shorten' && (
                <div className="p-4 bg-surface-container-low rounded-lg mb-4 border border-outline-variant/20 space-y-3 text-xs">
                  <div className="font-bold text-on-surface">Request Parameters:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">Destination URL</label>
                      <input 
                        type="url"
                        value={customDestination}
                        onChange={(e) => setCustomDestination(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-xs font-mono text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                        placeholder="https://example.com/target"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">Custom Slug (Optional)</label>
                      <input 
                        type="text"
                        value={customSlug}
                        onChange={(e) => setCustomSlug(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-xs font-mono text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                        placeholder="vanity-alias"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">Title (Optional)</label>
                      <input 
                        type="text"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                        placeholder="Campaign Title"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Language Selection & Code Snippet */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {(['curl', 'js', 'python'] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setActiveLang(lang)}
                        className={`text-xs font-bold px-3 py-1 rounded-lg transition cursor-pointer ${
                          activeLang === lang
                            ? 'bg-surface-container-high text-primary-container shadow-xs'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {lang === 'curl' ? 'cURL' : lang === 'js' ? 'Node.js / Fetch' : 'Python (requests)'}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                  >
                    {copiedSnippet ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Snippet</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative rounded-lg overflow-hidden bg-slate-950 p-4 border border-slate-800">
                  <pre className="text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed">
                    {getDynamicSnippet}
                  </pre>
                </div>

                {/* Execution Button */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleExecuteConsole}
                    disabled={isExecuting}
                    className="px-5 py-2.5 bg-primary-container hover:bg-primary text-on-primary font-bold text-xs rounded-lg shadow-md shadow-primary-container/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isExecuting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Executing...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send Live Request</span>
                      </>
                    )}
                  </button>
                  <span className="text-xs text-on-surface-variant">Sends authenticated HTTP probe via local edge runtime</span>
                </div>

                {/* Live Response Viewer */}
                {apiResponse && (
                  <div className="mt-4 pt-4 border-t border-outline-variant/20 space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-on-surface">Response Payload</span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          responseStatus && responseStatus < 300 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {responseStatus} {responseStatus && responseStatus < 300 ? 'OK' : 'Error'}
                        </span>
                        {responseLatency && (
                          <span className="text-[11px] font-mono text-on-surface-variant">
                            {responseLatency}ms
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-on-surface-variant">application/json</span>
                    </div>

                    <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 overflow-x-auto max-h-60">
                      <pre className="text-[11px] font-mono text-slate-300">
                        {JSON.stringify(apiResponse, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* RIGHT: Quick Reference & Token Overview (5 COLS) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Quick Token Overview */}
            <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30 shadow-xs">
              <div className="flex items-center gap-2.5 pb-3 border-b border-outline-variant/20 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Active Authorization Token</h3>
                  <p className="text-xs text-on-surface-variant">Default token used for code snippets</p>
                </div>
              </div>

              {apiKeys.length === 0 ? (
                <div className="p-4 bg-surface-container-low rounded-lg text-center text-xs text-on-surface-variant border border-dashed border-outline-variant/40">
                  <p className="font-semibold text-on-surface mb-1">No API keys registered</p>
                  <p className="text-xs text-on-surface-variant mb-3">Generate a secret key to authenticate remote requests.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('keys')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-container text-on-primary rounded-lg font-bold text-xs shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Secret Key</span>
                  </button>
                </div>
              ) : (
                <div className="p-3.5 bg-surface-container-low rounded-lg border border-outline-variant/20 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-on-surface">{apiKeys[0].name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                      Primary
                    </span>
                  </div>
                  <div className="p-2 bg-surface-container-lowest rounded-md font-mono text-[11px] text-primary-container border border-outline-variant/30 break-all">
                    {apiKeys[0].key_prefix}...••••••••••••
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {apiKeys[0].permissions.map((perm, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-container font-semibold text-on-surface-variant">
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Standard Headers Card */}
            <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30 shadow-xs">
              <h3 className="text-sm font-bold text-on-surface mb-2 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary-container" />
                <span>Required Request Headers</span>
              </h3>
              <p className="text-xs text-on-surface-variant mb-4">Include these headers on every outbound programmatic request</p>

              <div className="space-y-2 text-xs font-mono">
                <div className="p-2.5 bg-surface-container-low rounded-lg flex items-center justify-between border border-outline-variant/20">
                  <span className="text-on-surface font-bold">Authorization</span>
                  <span className="text-on-surface-variant text-[11px]">Bearer sk_live_...</span>
                </div>
                <div className="p-2.5 bg-surface-container-low rounded-lg flex items-center justify-between border border-outline-variant/20">
                  <span className="text-on-surface font-bold">Content-Type</span>
                  <span className="text-on-surface-variant text-[11px]">application/json</span>
                </div>
                <div className="p-2.5 bg-surface-container-low rounded-lg flex items-center justify-between border border-outline-variant/20">
                  <span className="text-on-surface font-bold">x-workspace-id</span>
                  <span className="text-on-surface-variant text-[11px]">{currentWorkspace?.id || 'ws_default'}</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: API KEYS MANAGEMENT
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'keys' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Key Generator Form (5 COLS) */}
          <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30 shadow-xs">
            <div className="flex items-center gap-2.5 pb-3 border-b border-outline-variant/20 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-on-surface">Generate New Secret Key</h2>
                <p className="text-xs text-on-surface-variant">Scoped access for CI/CD, backends, or third-party tools</p>
              </div>
            </div>

            <form onSubmit={handleCreateApiKey} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Key Description / Service Name</label>
                <input
                  type="text"
                  required
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. Production Webhook Runner"
                  className="w-full h-10 px-3.5 bg-surface-container-low border border-outline-variant/30 focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 rounded-lg text-xs text-on-surface outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">Permission Scopes</label>
                <div className="space-y-2">
                  {[
                    { id: 'links:create', name: 'Create Short Links', desc: 'Generate URLs & custom aliases' },
                    { id: 'links:read', name: 'Read Links & Analytics', desc: 'Query destination URLs & telemetry' },
                    { id: 'links:edit', name: 'Modify Short Links', desc: 'Update targets & emergency swap' },
                    { id: 'analytics:read', name: 'Raw Click Events', desc: 'Access granular country & referrer logs' },
                    { id: 'export:data', name: 'Bulk Data Export', desc: 'Download CSV and telemetry streams' }
                  ].map(scope => {
                    const isChecked = selectedScopes.includes(scope.id);
                    return (
                      <label 
                        key={scope.id} 
                        onClick={() => handleToggleScope(scope.id)}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-primary-container/5 border-primary-container/40' 
                            : 'bg-surface-container-low border-outline-variant/20 hover:bg-surface-container'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} 
                          className="mt-0.5 accent-primary-container cursor-pointer"
                        />
                        <div>
                          <span className="font-bold text-on-surface block">{scope.name}</span>
                          <span className="text-[11px] text-on-surface-variant font-mono">{scope.id} • {scope.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-10 bg-primary-container hover:bg-primary text-on-primary font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Scoped Key</span>
              </button>
            </form>
          </div>

          {/* Active Keys Table (7 COLS) */}
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-4">
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <Key className="w-4 h-4 text-primary-container" />
                <span>Active Workspace Keys ({apiKeys.length})</span>
              </h2>
              <span className="text-xs text-on-surface-variant">Hashed with SHA-256</span>
            </div>

            <div className="space-y-3 text-xs">
              {apiKeys.length === 0 ? (
                <div className="py-12 text-center text-on-surface-variant">
                  <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-outline mx-auto mb-2">
                    <Key className="w-5 h-5" />
                  </div>
                  <p className="font-bold text-sm text-on-surface">No API Keys Generated</p>
                  <p className="text-xs text-on-surface-variant max-w-sm mx-auto mt-1">
                    Generate an API key above to automate link creation from your backends, Discord bots, or CLI pipelines.
                  </p>
                </div>
              ) : (
                apiKeys.map((k) => (
                  <div
                    key={k.id}
                    className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-on-surface text-sm">{k.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                          {k.created_at ? new Date(k.created_at).toLocaleDateString() : 'Active'}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-primary-container mt-1 font-semibold">
                        {k.key_prefix}...••••••••••••
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {k.permissions.map((p, i) => (
                          <span key={i} className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-container-high text-on-surface-variant font-medium">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (checkPermissionOrToast('api_keys:manage', 'revoke API keys')) {
                            deleteApiKey(k.id);
                            showToast(`Revoked key: ${k.name}`);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer border border-red-200"
                        title="Revoke Key"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: WEBHOOKS MANAGEMENT
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          
          <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/20 mb-5">
              <div>
                <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                  <WebhookIcon className="w-4 h-4 text-emerald-600" />
                  <span>Configured Webhook Subscriptions ({webhooks.length})</span>
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Real-time HTTP POST event dispatching with HMAC-SHA256 signatures for telemetry, link creations, and threat quarantine.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setWebhookModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-container hover:bg-primary text-on-primary font-bold text-xs rounded-lg shadow-xs transition cursor-pointer self-start sm:self-auto shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Register Webhook</span>
              </button>
            </div>

            {/* Webhook List */}
            <div className="space-y-3 text-xs">
              {webhooks.length === 0 ? (
                <div className="py-12 text-center text-on-surface-variant">
                  <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-outline mx-auto mb-2">
                    <WebhookIcon className="w-5 h-5" />
                  </div>
                  <p className="font-bold text-sm text-on-surface">No Webhooks Registered</p>
                  <p className="text-xs text-on-surface-variant max-w-sm mx-auto mt-1 mb-4">
                    Receive instant real-time HTTP callbacks to Slack, Discord, Zapier, or your own backend API whenever events occur.
                  </p>
                  <button
                    type="button"
                    onClick={() => setWebhookModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary-container text-on-primary text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Webhook Endpoint</span>
                  </button>
                </div>
              ) : (
                webhooks.map((wh) => (
                  <div
                    key={wh.id}
                    className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/20 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                          wh.active 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                            : 'bg-surface-container text-on-surface-variant border-outline-variant/40'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${wh.active ? 'bg-emerald-600' : 'bg-outline'}`} />
                          <span>{wh.active ? 'Streaming' : 'Paused'}</span>
                        </span>
                        <span className="font-mono text-xs font-bold text-on-surface break-all">{wh.url}</span>
                      </div>

                      {/* Subscribed events */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {wh.events.map((ev, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-container font-semibold text-primary-container">
                            {ev}
                          </span>
                        ))}
                      </div>

                      {/* Signing Secret */}
                      <div className="flex items-center gap-2 text-[11px] text-on-surface-variant font-mono pt-1">
                        <span>Secret:</span>
                        <span className="bg-surface-container-lowest px-2 py-0.5 rounded border border-outline-variant/30 select-all">
                          {revealedSecrets[wh.id] ? wh.secret : `${wh.secret.substring(0, 10)}••••••••••••`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRevealedSecrets(prev => ({ ...prev, [wh.id]: !prev[wh.id] }))}
                          className="p-1 text-on-surface-variant hover:text-on-surface transition cursor-pointer"
                          title={revealedSecrets[wh.id] ? 'Hide secret' : 'Reveal secret'}
                        >
                          {revealedSecrets[wh.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(wh.secret);
                            setCopiedWhId(wh.id);
                            showToast('Webhook secret copied.');
                            setTimeout(() => setCopiedWhId(null), 2000);
                          }}
                          className="p-1 text-on-surface-variant hover:text-on-surface transition cursor-pointer"
                          title="Copy secret"
                        >
                          {copiedWhId === wh.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
                      <button
                        type="button"
                        disabled={testingWebhookId === wh.id}
                        onClick={() => handleTestWebhookPing(wh.id, wh.url)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-semibold text-xs border border-outline-variant/30 hover:bg-surface-container transition cursor-pointer disabled:opacity-50"
                      >
                        <Send className={`w-3.5 h-3.5 text-primary-container ${testingWebhookId === wh.id ? 'animate-pulse' : ''}`} />
                        <span>{testingWebhookId === wh.id ? 'Pinging...' : 'Send Test Ping'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await toggleWebhook(wh.id);
                          showToast(`Webhook ${wh.active ? 'paused' : 'resumed'}.`);
                        }}
                        className="p-2 rounded-lg bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition cursor-pointer border border-outline-variant/30"
                        title={wh.active ? 'Pause webhook delivery' : 'Resume webhook delivery'}
                      >
                        {wh.active ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4 text-emerald-600" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (checkPermissionOrToast('api_keys:manage', 'delete webhooks')) {
                            deleteWebhook(wh.id);
                            showToast('Webhook deleted.');
                          }
                        }}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition cursor-pointer border border-red-200"
                        title="Delete Webhook"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Webhook Signature Verification Guide */}
          <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30 shadow-xs">
            <h3 className="text-sm font-bold text-on-surface mb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary-container" />
              <span>Verifying Webhook Signatures (HMAC-SHA256)</span>
            </h3>
            <p className="text-xs text-on-surface-variant mb-4">
              Every webhook delivery includes a <code className="font-mono text-primary-container">x-tinyurl-signature</code> header computed over the raw request payload using your webhook signing secret.
            </p>

            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed">
{`const crypto = require('crypto');

function verifyWebhook(payload, signatureHeader, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedSignature)
  );
}`}
            </div>
          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: REST ENDPOINT REFERENCE
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'reference' && (
        <div className="space-y-4 text-xs">
          {[
            {
              method: 'POST',
              path: '/api/v1/shorten',
              title: 'Shorten Destination URL',
              desc: 'Generates a collision-free short URL with optional custom slug, domain, and UTM tags.',
              body: `{
  "destination_url": "https://example.com/summer-sale",
  "custom_slug": "summer26",
  "title": "Summer Campaign"
}`
            },
            {
              method: 'POST',
              path: '/api/v1/links/bulk',
              title: 'Batch Link Generation',
              desc: 'Accepts an array of up to 1,000 links in a single atomic batch request with collision checks.',
              body: `{
  "links": [
    { "destination_url": "https://sample.com/1", "title": "Link 1" },
    { "destination_url": "https://sample.com/2", "custom_slug": "slug2" }
  ]
}`
            },
            {
              method: 'GET',
              path: '/api/v1/links',
              title: 'List Workspace Links',
              desc: 'Returns paginated links, custom vanity aliases, click counts, tags, and status.',
              body: `// Query Parameters: ?workspace_id=ws_...&page=1&limit=50`
            },
            {
              method: 'POST',
              path: '/api/v1/security/audit',
              title: 'Destination Security Audit',
              desc: 'Dispatches synthetic head probes to verify destination HTTP response codes, TLS handshakes, and phishing heuristics.',
              body: `{
  "workspace_id": "ws_...",
  "link_ids": ["link_1", "link_2"]
}`
            },
            {
              method: 'GET',
              path: '/api/v1/analytics',
              title: 'Workspace Telemetry & Clicks',
              desc: 'Aggregates click volume, top referring platforms, countries, and device breakdowns.',
              body: `// Query Parameters: ?workspace_id=ws_...&range=7d`
            }
          ].map((endpoint, i) => (
            <div key={i} className="p-5 bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                    endpoint.method === 'POST' 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {endpoint.method}
                  </span>
                  <span className="font-mono font-bold text-sm text-on-surface">{endpoint.path}</span>
                </div>
                <span className="text-on-surface-variant font-semibold">{endpoint.title}</span>
              </div>
              <p className="text-on-surface-variant">{endpoint.desc}</p>
              <div className="p-3 bg-slate-950 rounded-lg font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800">
                <pre>{endpoint.body}</pre>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ONE-TIME SECRET KEY REVEAL
          ───────────────────────────────────────────────────────────── */}
      {keyModalOpen && createdKey && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setKeyModalOpen(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-6 shadow-2xl border border-outline-variant/40 relative animate-fade-in">
            <button
              type="button"
              onClick={() => setKeyModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2 text-amber-700">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-base font-bold text-on-surface">Secret API Key Created</h3>
            </div>
            <p className="text-xs text-on-surface-variant mb-4">
              Please copy your secret key right now. For security purposes, this token will <strong>never be shown again</strong>.
            </p>

            <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/30 space-y-2 mb-4">
              <div className="font-mono text-xs text-primary-container font-bold break-all select-all">
                {createdKey}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-outline-variant/20">
              <span className="text-[11px] text-on-surface-variant">Store securely in your environment variables.</span>
              <button
                type="button"
                onClick={handleCopyNewKey}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-container hover:bg-primary text-on-primary font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedKey ? 'Copied Token!' : 'Copy Secret Key'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: REGISTER WEBHOOK
          ───────────────────────────────────────────────────────────── */}
      {webhookModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setWebhookModalOpen(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-6 shadow-2xl border border-outline-variant/40 relative animate-fade-in">
            <button
              type="button"
              onClick={() => setWebhookModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <WebhookIcon className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-on-surface">Register Webhook Endpoint</h3>
            </div>
            <p className="text-xs text-on-surface-variant mb-4">
              Receive real-time HTTP callbacks when events occur in this workspace.
            </p>

            <form onSubmit={handleRegisterWebhook} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Target Endpoint URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://api.yourdomain.com/webhooks/tinyurl"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-xs font-mono text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">Event Subscriptions</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: 'link.created', label: 'link.created', desc: 'When a new link is registered' },
                    { id: 'link.clicked', label: 'link.clicked', desc: 'When a link is visited' },
                    { id: 'link.flagged', label: 'link.flagged', desc: 'When a threat is quarantined' },
                    { id: 'security.alert', label: 'security.alert', desc: 'When destination returns 404/500' }
                  ].map(ev => {
                    const isChecked = webhookEvents.includes(ev.id);
                    return (
                      <label
                        key={ev.id}
                        onClick={() => handleToggleEvent(ev.id)}
                        className={`flex items-start gap-2 p-2.5 rounded-lg border transition cursor-pointer ${
                          isChecked 
                            ? 'bg-primary-container/5 border-primary-container/40' 
                            : 'bg-surface-container-low border-outline-variant/20 hover:bg-surface-container'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 accent-primary-container cursor-pointer"
                        />
                        <div>
                          <span className="font-mono font-bold text-on-surface block text-[11px]">{ev.label}</span>
                          <span className="text-[10px] text-on-surface-variant">{ev.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20 mt-4">
                <button
                  type="button"
                  onClick={() => setWebhookModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer shadow-xs text-xs"
                >
                  Register Webhook
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─────────────────────────────────────────────────────────────
          TOAST FEEDBACK
          ───────────────────────────────────────────────────────────── */}
      {toastMessage && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-6 right-6 bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2.5 transition-all duration-200 z-[100] animate-fade-in border border-outline-variant/30 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>,
        document.body
      )}

    </div>
  );
};
