'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { 
  X, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldAlert, 
  ChevronDown, 
  Lock, 
  Clock, 
  Zap, 
  Smartphone, 
  CheckCircle2 
} from 'lucide-react';
import { detectAppDeepLink } from '@/lib/deepLink';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateLinkModal: React.FC<CreateLinkModalProps> = ({ isOpen, onClose }) => {
  const { createShortLink, domains, campaigns, aiSuggestSlugs } = useStore();

  const [destinationUrl, setDestinationUrl] = useState('');
  const [title, setTitle] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [password, setPassword] = useState('');
  const [maxClicks, setMaxClicks] = useState<number | ''>('');
  const [expiresAt, setExpiresAt] = useState('');
  const [deepLinkEnabled, setDeepLinkEnabled] = useState(true);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [suggestedSlugs, setSuggestedSlugs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdResult, setCreatedResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const detectedApp = destinationUrl ? detectAppDeepLink(destinationUrl) : null;

  const handleAiSuggest = () => {
    if (!destinationUrl && !title) {
      setErrorMsg('Enter a Destination URL or Title first to get AI slug ideas.');
      return;
    }
    setErrorMsg('');
    const suggestions = aiSuggestSlugs(destinationUrl, title);
    setSuggestedSlugs(suggestions);
    if (suggestions.length > 0) {
      setCustomSlug(suggestions[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!destinationUrl.startsWith('http://') && !destinationUrl.startsWith('https://')) {
      setErrorMsg('Destination URL must start with http:// or https://');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    const res = createShortLink({
      destination_url: destinationUrl,
      custom_slug: customSlug.trim() || undefined,
      title: title.trim() || undefined,
      campaign_id: campaignId || undefined,
      tags: tags.length > 0 ? tags : undefined,
      password: password || undefined,
      max_clicks: maxClicks !== '' ? Number(maxClicks) : undefined,
      expires_at: expiresAt || undefined,
      deep_link: detectedApp && deepLinkEnabled ? {
        enabled: true,
        app: detectedApp.app,
        app_name: detectedApp.appName,
        app_uri: detectedApp.iosUri,
        ios_uri: detectedApp.iosUri,
        android_intent: detectedApp.androidIntent,
        fallback_url: detectedApp.fallbackUrl
      } : undefined
    });

    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    if (res.link) {
      const activeDomain = domains[0]?.hostname || 'tiny-url-self.vercel.app';
      setCreatedResult({
        ...res.link,
        short_url: `https://${activeDomain}/${res.link.short_code}`
      });
    }
  };

  const handleCopy = () => {
    if (createdResult) {
      navigator.clipboard.writeText(createdResult.short_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetForm = () => {
    setDestinationUrl('');
    setTitle('');
    setCustomSlug('');
    setCampaignId('');
    setTagsInput('');
    setPassword('');
    setMaxClicks('');
    setExpiresAt('');
    setSuggestedSlugs([]);
    setErrorMsg('');
    setCreatedResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div 
        className="fixed inset-0" 
        onClick={resetForm} 
      />

      <div className="relative bg-card border border-border/60 max-w-lg w-full rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto text-foreground z-10 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/25 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Create New Shortlink</h2>
              <p className="text-xs text-muted-foreground">Direct edge deep routing &bull; Zero-latency bypass</p>
            </div>
          </div>
          <button
            onClick={resetForm}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Modal View */}
        {createdResult ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20 shadow-sm">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground mb-1">Shortlink Ready!</h3>
              <p className="text-muted-foreground text-xs">Your shortlink is active and syncing across global edge regions.</p>
            </div>

            <div className="p-3 bg-background rounded-xl border border-border/60 flex items-center justify-between gap-3">
              <span className="font-mono text-primary font-bold text-xs truncate">{createdResult.short_url}</span>
              <Button
                type="button"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-300" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </Button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={resetForm}
                className="w-full"
              >
                Create Another Link
              </Button>
              <a
                href={createdResult.short_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                Test Link
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            
            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Destination URL */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Destination URL <span className="text-destructive">*</span>
              </label>
              <input
                type="url"
                required
                placeholder="https://yourbrand.com/special-product-launch"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                className="w-full h-10 px-3.5 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
            </div>

            {/* OpeninApp Smart Deep Link Badge */}
            {detectedApp && (
              <div className="p-3 bg-muted/20 border border-border/60 rounded-xl flex items-center justify-between transition-all animate-fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div 
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shadow-xs shrink-0"
                    style={{ backgroundColor: detectedApp.color }}
                  >
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground truncate">
                        ⚡ OpeninApp: {detectedApp.appName} App
                      </span>
                      <Badge variant="success" className="text-[9px]">
                        Auto-detected
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Opens directly in native app &bull; Bypasses browser webview
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                  <input
                    type="checkbox"
                    checked={deepLinkEnabled}
                    onChange={(e) => setDeepLinkEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            )}

            {/* Title & Custom Slug Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Link Label (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Launch Campaign"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-10 px-3.5 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground">Custom Slug</label>
                  <button
                    type="button"
                    onClick={handleAiSuggest}
                    className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" /> AI Suggest
                  </button>
                </div>
                <div className="flex items-center">
                  <span className="h-10 px-3 bg-muted border border-r-0 border-border/60 rounded-l-lg text-xs font-mono text-muted-foreground flex items-center select-none shrink-0">
                    {domains[0]?.hostname || 'tiny.url'}/
                  </span>
                  <input
                    type="text"
                    placeholder="custom_slug"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    className="w-full h-10 px-3 bg-background border border-border/60 focus:border-primary rounded-r-lg text-xs font-mono text-foreground placeholder:text-muted-foreground/60 outline-none transition"
                  />
                </div>
              </div>
            </div>

            {/* AI Suggested Slugs Pills */}
            {suggestedSlugs.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Suggested Slugs:</span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedSlugs.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCustomSlug(s)}
                      className={`px-2 py-0.5 rounded-md font-mono text-[11px] border transition cursor-pointer ${
                        customSlug === s
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/40 text-muted-foreground border-border/40 hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Advanced Settings Accordion */}
            <div className="pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <span>Advanced Security &amp; Access Controls</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>

              {showAdvanced && (
                <div className="space-y-3 pt-3 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                        Campaign Folder
                      </label>
                      <select
                        value={campaignId}
                        onChange={(e) => setCampaignId(e.target.value)}
                        className="w-full h-9 px-3 bg-background border border-border/60 rounded-lg text-xs text-foreground focus:border-primary outline-none"
                      >
                        <option value="">No Campaign</option>
                        {campaigns.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                        Tags (comma-separated)
                      </label>
                      <input
                        type="text"
                        placeholder="meta_ads, promo"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        className="w-full h-9 px-3 bg-background border border-border/60 rounded-lg text-xs text-foreground outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-primary" /> Password Protection
                      </label>
                      <input
                        type="password"
                        placeholder="Optional passphrase"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-9 px-3 bg-background border border-border/60 rounded-lg text-xs text-foreground outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-primary" /> Max Visits / Click Limit
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 500"
                        value={maxClicks}
                        onChange={(e) => setMaxClicks(e.target.value ? Number(e.target.value) : '')}
                        className="w-full h-9 px-3 bg-background border border-border/60 rounded-lg text-xs text-foreground outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Expiration Date</label>
                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full h-9 px-3 bg-background border border-border/60 rounded-lg text-xs text-foreground outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={resetForm}
                className="w-full"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                className="w-full"
              >
                Create Shortlink
              </Button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
