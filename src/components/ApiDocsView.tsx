'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { Code2, Key, Webhook, Plus, Copy, Check, Play, Trash2 } from 'lucide-react';

export const ApiDocsView: React.FC = () => {
  const { apiKeys, addApiKey, deleteApiKey, webhooks, addWebhook, deleteWebhook } = useStore();

  const [keyName, setKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');

  // Interactive API tester
  const [apiEndpoint, setApiEndpoint] = useState<'shorten' | 'links' | 'analytics'>('shorten');
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleCreateApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName) return;

    const res = addApiKey(keyName, ['links:read', 'links:write']);
    setCreatedKey(res.full_key);
    setKeyName('');
  };

  const handleAddWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl) return;

    addWebhook(webhookUrl, ['link.created', 'link.clicked']);
    setWebhookUrl('');
  };

  const handleTestApi = async () => {
    setLoading(true);
    setApiResponse(null);
    try {
      if (apiEndpoint === 'shorten') {
        const res = await fetch('/api/v1/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination_url: 'https://acme.com/store/deal',
            custom_slug: `test${Math.floor(Math.random() * 900 + 100)}`
          })
        });
        const data = await res.json();
        setApiResponse(data);
      } else if (apiEndpoint === 'links') {
        const res = await fetch('/api/v1/links');
        const data = await res.json();
        setApiResponse(data);
      } else {
        const res = await fetch('/api/v1/analytics?code=sale26');
        const data = await res.json();
        setApiResponse(data);
      }
    } catch (err: any) {
      setApiResponse({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Code2 className="w-5 h-5 text-indigo-400" /> Developer REST API & Webhook Infrastructure
        </h1>
        <p className="text-xs text-slate-400">Generate secret API keys, configure event webhooks, and interact with API endpoints</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* API Key Management */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" /> Workspace API Keys
          </h3>

          <form onSubmit={handleCreateApiKey} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Key Description / Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Production Backend Service"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 gradient-button text-white font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Generate Secret Key
            </button>
          </form>

          {createdKey && (
            <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs space-y-1">
              <span className="font-semibold text-amber-300 block">Copy Secret Key (Shown Once):</span>
              <p className="font-mono text-[10px] text-amber-200 break-all bg-black/40 p-2 rounded">{createdKey}</p>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
            {apiKeys.map((k) => (
              <div key={k.id} className="p-2.5 bg-slate-900/80 border border-white/5 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{k.name}</p>
                  <p className="font-mono text-[10px] text-slate-400">{k.key_prefix}••••••••</p>
                </div>
                <button
                  onClick={() => deleteApiKey(k.id)}
                  className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive API Explorer */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-400" /> Interactive REST API Explorer
            </h3>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setApiEndpoint('shorten')}
                className={`px-3 py-1 rounded-lg font-mono font-semibold transition ${
                  apiEndpoint === 'shorten' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                POST /shorten
              </button>
              <button
                onClick={() => setApiEndpoint('links')}
                className={`px-3 py-1 rounded-lg font-mono font-semibold transition ${
                  apiEndpoint === 'links' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                GET /links
              </button>
              <button
                onClick={() => setApiEndpoint('analytics')}
                className={`px-3 py-1 rounded-lg font-mono font-semibold transition ${
                  apiEndpoint === 'analytics' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                GET /analytics
              </button>
            </div>
          </div>

          <button
            onClick={handleTestApi}
            disabled={loading}
            className="w-full py-2.5 gradient-button text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            <Play className="w-4 h-4 fill-current" /> {loading ? 'Executing HTTP Request...' : 'Send Test API Request'}
          </button>

          {apiResponse && (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <p className="text-[10px] font-mono text-slate-400 mb-2 uppercase">HTTP Response Preview (200 OK):</p>
              <pre className="font-mono text-emerald-400 overflow-x-auto text-[11px] leading-tight">
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
