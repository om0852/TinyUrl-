'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { Code2, Key, Plus, Trash2, Play } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export const ApiDocsView: React.FC = () => {
  const { apiKeys, addApiKey, deleteApiKey } = useStore();

  const [keyName, setKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

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

  const handleTestApi = async () => {
    setLoading(true);
    setApiResponse(null);
    try {
      if (apiEndpoint === 'shorten') {
        const res = await fetch('/api/v1/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination_url: 'https://example.com/store/deal',
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
    <div className="space-y-8 animate-fade-in text-foreground">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Code2 className="w-5 h-5 text-primary" /> Developer REST API &amp; Webhooks
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Programmatic link creation, analytics consumption, webhooks, and authenticated API tokens.
          </p>
        </div>

        <Badge variant="primary" className="px-3 py-1 text-xs">
          v1 Stable REST
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* API Key Management */}
        <Card className="p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border/40">
            <Key className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">Workspace API Keys</h3>
          </div>

          <form onSubmit={handleCreateApiKey} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Key Description / Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Production Backend Service"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="w-full h-10 px-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full text-xs font-bold"
            >
              <Plus className="w-4 h-4 mr-2" /> Generate Secret Key
            </Button>
          </form>

          {createdKey && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs space-y-1.5">
              <span className="font-semibold text-amber-500 text-xs block">Secret Key (Shown Once):</span>
              <p className="font-mono text-xs text-foreground break-all bg-background p-2 rounded-lg border border-border/40">{createdKey}</p>
            </div>
          )}

          <div className="space-y-2 pt-3 border-t border-border/40 text-xs">
            {apiKeys.map((k) => (
              <div key={k.id} className="p-3 bg-muted/20 border border-border/40 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground text-xs">{k.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{k.key_prefix}••••••••</p>
                </div>
                <button
                  onClick={() => deleteApiKey(k.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Interactive API Explorer */}
        <Card className="lg:col-span-2 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-500" /> Interactive REST API Explorer
            </h3>

            <div className="flex items-center gap-1.5 text-xs bg-muted/30 p-1 rounded-lg border border-border/40">
              {(['shorten', 'links', 'analytics'] as const).map((ep) => (
                <button
                  key={ep}
                  onClick={() => setApiEndpoint(ep)}
                  className={`px-3 py-1 rounded-md font-mono text-[11px] font-semibold transition cursor-pointer ${
                    apiEndpoint === ep
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {ep === 'shorten' ? 'POST /shorten' : ep === 'links' ? 'GET /links' : 'GET /analytics'}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleTestApi}
            disabled={loading}
            size="lg"
            className="w-full text-xs font-bold"
          >
            <Play className="w-4 h-4 mr-2 fill-current" /> {loading ? 'Executing HTTP Request...' : 'Send Test API Request'}
          </Button>

          {apiResponse && (
            <div className="p-4 bg-muted/20 rounded-xl border border-border/40 text-xs space-y-2">
              <p className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">HTTP Response Preview (200 OK):</p>
              <pre className="font-mono text-foreground overflow-x-auto text-xs leading-relaxed max-h-60 p-3 bg-background rounded-lg border border-border/40">
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </div>
          )}
        </Card>

      </div>

    </div>
  );
};
