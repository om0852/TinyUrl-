'use client';

import React, { useState } from 'react';
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
  AlertCircle
} from 'lucide-react';

export const ApiDocsView: React.FC = () => {
  const { apiKeys, addApiKey, deleteApiKey } = useStore();

  const [keyName, setKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // Interactive API tester
  const [apiEndpoint, setApiEndpoint] = useState<'shorten' | 'links' | 'analytics'>('shorten');
  const [apiResponse, setApiResponse] = useState<Record<string, unknown> | null>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Code Snippet language
  const [activeLang, setActiveLang] = useState<'curl' | 'js' | 'python'>('curl');

  const handleCreateApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName) return;

    const res = addApiKey(keyName, ['links:read', 'links:write', 'analytics:read']);
    setCreatedKey(res.full_key);
    setKeyName('');
  };

  const handleCopyNewKey = () => {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleTestApi = async () => {
    setLoading(true);
    setApiResponse(null);
    setResponseStatus(null);
    try {
      if (apiEndpoint === 'shorten') {
        const res = await fetch('/api/v1/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination_url: 'https://loomlink.io/sample-showcase',
            custom_slug: `demo${Math.floor(Math.random() * 900 + 100)}`
          })
        });
        setResponseStatus(res.status);
        const data = await res.json();
        setApiResponse(data);
      } else if (apiEndpoint === 'links') {
        const res = await fetch('/api/v1/links');
        setResponseStatus(res.status);
        const data = await res.json();
        setApiResponse(data);
      } else {
        const res = await fetch('/api/v1/track?code=sale26');
        setResponseStatus(res.status);
        const data = await res.json();
        setApiResponse(data);
      }
    } catch (err: unknown) {
      setResponseStatus(500);
      setApiResponse({ error: err instanceof Error ? err.message : 'Unknown network error' });
    } finally {
      setLoading(false);
    }
  };

  const getCodeSnippet = () => {
    if (activeLang === 'curl') {
      if (apiEndpoint === 'shorten') {
        return `curl -X POST "https://api.snip.to/v1/shorten" \\
  -H "Authorization: Bearer sk_live_demo12345" \\
  -H "Content-Type: application/json" \\
  -d '{
    "destination_url": "https://example.com/summer-sale",
    "custom_slug": "summer26",
    "deep_link": { "app": "youtube" }
  }'`;
      }
      if (apiEndpoint === 'links') {
        return `curl -X GET "https://api.snip.to/v1/links" \\
  -H "Authorization: Bearer sk_live_demo12345"`;
      }
      return `curl -X GET "https://api.snip.to/v1/track?code=sale26" \\
  -H "Authorization: Bearer sk_live_demo12345"`;
    }

    if (activeLang === 'js') {
      return `const response = await fetch('https://api.snip.to/v1/shorten', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_demo12345',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    destination_url: 'https://example.com/summer-sale',
    custom_slug: 'summer26'
  })
});
const data = await response.json();
console.log(data.short_url);`;
    }

    return `import requests

headers = {
    'Authorization': 'Bearer sk_live_demo12345',
    'Content-Type': 'application/json'
}
payload = {
    'destination_url': 'https://example.com/summer-sale',
    'custom_slug': 'summer26'
}

response = requests.post('https://api.snip.to/v1/shorten', json=payload, headers=headers)
print(response.json())`;
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="flex flex-col w-full space-y-6 pb-16 animate-fade-in text-on-surface">
      
      {/* 1. TOP HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">Developer REST API & Webhooks</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-primary-container text-on-primary font-bold shadow-xs">
              <Terminal className="w-3.5 h-3.5" />
              v1.4 OpenAPI 3.1
            </span>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">
            Programmatic link shortening, OpeninApp deep routing, real-time click webhook streaming, and API token management.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-surface-container-lowest rounded-xl border border-outline-variant/40 shadow-xs flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Edge Gateway: Global Anycast</span>
          </div>
        </div>
      </div>

      {/* 2. STATS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Active API Keys</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Key className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-on-surface">{Math.max(apiKeys.length, 2)}</div>
            <p className="text-xs text-on-surface-variant mt-0.5">Full programmatic access</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Gateway Latency</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-emerald-600">12ms</div>
            <p className="text-xs text-on-surface-variant mt-0.5">Neon Edge connection pool</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Rate Limit</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-on-surface">1,000 / min</div>
            <p className="text-xs text-on-surface-variant mt-0.5">Burst capacity up to 5,000/min</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Auth Method</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-on-surface">Bearer Token</div>
            <p className="text-xs text-on-surface-variant mt-0.5">SHA-256 hashed secret keys</p>
          </div>
        </div>

      </div>

      {/* 3. MAIN WORKBENCH: 2-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: INTERACTIVE API PLAYGROUND (7 COLS) */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/40 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-outline-variant/40 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Play className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-on-surface">Live API Playground</h2>
                  <p className="text-xs text-on-surface-variant">Execute requests directly against the live backend</p>
                </div>
              </div>

              {/* Endpoint Selector Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-surface-container rounded-xl">
                {([
                  { id: 'shorten', label: 'POST /shorten' },
                  { id: 'links', label: 'GET /links' },
                  { id: 'analytics', label: 'GET /track' }
                ] as const).map((ep) => (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => {
                      setApiEndpoint(ep.id);
                      setApiResponse(null);
                      setResponseStatus(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      apiEndpoint === ep.id
                        ? 'bg-surface-container-lowest text-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {ep.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Tabs & Code Snippet */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(['curl', 'js', 'python'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setActiveLang(lang)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-md transition cursor-pointer ${
                        activeLang === lang
                          ? 'bg-surface-container-high text-primary'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {lang === 'curl' ? 'cURL' : lang === 'js' ? 'Node / Fetch' : 'Python'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleCopySnippet}
                  className="flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  {copiedCurl ? (
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

              <div className="relative rounded-xl overflow-hidden bg-slate-950 p-4 border border-slate-800">
                <pre className="text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed">
                  {getCodeSnippet()}
                </pre>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestApi}
                  disabled={loading}
                  className="px-5 py-2.5 bg-primary-container hover:bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md shadow-primary-container/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending Request...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Execute Request</span>
                    </>
                  )}
                </button>
                <span className="text-xs text-on-surface-variant">Sends live request to local runtime</span>
              </div>

              {/* Live Response Viewer */}
              {apiResponse && (
                <div className="mt-4 pt-4 border-t border-outline-variant/40 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-on-surface">Response Payload</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        responseStatus && responseStatus < 300 
                          ? 'bg-emerald-500/10 text-emerald-600' 
                          : 'bg-error-container text-on-error-container'
                      }`}>
                        {responseStatus} {responseStatus && responseStatus < 300 ? 'OK' : 'Error'}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-on-surface-variant">Content-Type: application/json</span>
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto max-h-56">
                    <pre className="text-[11px] font-mono text-slate-300">
                      {JSON.stringify(apiResponse, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: API KEYS & WEBHOOKS (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Create API Key */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/40 shadow-xs">
            <div className="flex items-center gap-2.5 pb-3 border-b border-outline-variant/40 mb-4">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-on-surface">Generate API Key</h2>
                <p className="text-xs text-on-surface-variant">Scoped access for CI/CD or backends</p>
              </div>
            </div>

            <form onSubmit={handleCreateApiKey} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Key Description</label>
                <input
                  type="text"
                  required
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. Production Webhook Service"
                  className="w-full h-10 px-3.5 bg-surface-container-lowest border border-outline-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl text-xs text-on-surface outline-none transition"
                />
              </div>

              <button
                type="submit"
                className="w-full h-10 bg-primary-container hover:bg-primary text-on-primary font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Secret Key</span>
              </button>
            </form>

            {createdKey && (
              <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Copy token now (shown once)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyNewKey}
                    className="text-xs font-bold text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/40 font-mono text-[11px] text-on-surface break-all select-all">
                  {createdKey}
                </div>
              </div>
            )}
          </div>

          {/* Active API Keys List */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/40 shadow-xs">
            <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" />
              Active Workspace Keys
            </h3>

            <div className="space-y-2.5">
              {apiKeys.length === 0 ? (
                <div className="p-4 bg-surface-container-low rounded-xl text-center text-xs text-on-surface-variant border border-dashed border-outline-variant/60">
                  No active custom keys. Use the generator above to create one.
                </div>
              ) : (
                apiKeys.map((k) => (
                  <div
                    key={k.id}
                    className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/40 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-on-surface block">{k.name}</span>
                      <span className="font-mono text-[11px] text-on-surface-variant">
                        {k.key_prefix}...••••••••
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteApiKey(k.id)}
                      className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition cursor-pointer"
                      title="Revoke Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Webhook Events Reference */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/40 shadow-xs">
            <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
              <WebhookIcon className="w-4 h-4 text-primary" />
              Supported Webhook Events
            </h3>

            <div className="space-y-2 text-xs">
              {[
                { event: 'link.created', desc: 'Fires when a new short link is registered' },
                { event: 'link.clicked', desc: 'Streams referrer and IP country payload' },
                { event: 'link.quarantined', desc: 'Triggers when a threat or malware is detected' }
              ].map((ev, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                  <span className="font-mono font-bold text-primary">{ev.event}</span>
                  <span className="text-[11px] text-on-surface-variant">{ev.desc}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
