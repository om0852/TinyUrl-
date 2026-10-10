'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { getShortUrlPrefix } from '@/lib/db';
import { 
  X, 
  Sparkles, 
  Lock, 
  Clock, 
  Tag, 
  ShieldAlert, 
  Copy, 
  Check, 
  ArrowRight,
  Zap,
  CheckCircle2,
  Globe
} from 'lucide-react';

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateLinkModal: React.FC<CreateLinkModalProps> = ({ isOpen, onClose }) => {
  const { createShortLink, campaigns, domains, aiSuggestSlugs } = useStore();

  const [destinationUrl, setDestinationUrl] = useState('');
  const [title, setTitle] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [password, setPassword] = useState('');
  const [maxClicks, setMaxClicks] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [tagsInput, setTagsInput] = useState('marketing, promo');
  
  // UTM params
  const [showUtm, setShowUtm] = useState(false);
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  
  // States
  const [errorMsg, setErrorMsg] = useState('');
  const [createdResult, setCreatedResult] = useState<{ short_url: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [suggestedSlugs, setSuggestedSlugs] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleAiSuggest = () => {
    if (!destinationUrl) {
      setErrorMsg('Please enter a destination URL first to get AI slug suggestions');
      return;
    }
    setErrorMsg('');
    const suggestions = aiSuggestSlugs(destinationUrl, title);
    setSuggestedSlugs(suggestions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    const res = createShortLink({
      destination_url: destinationUrl,
      title: title || undefined,
      custom_slug: customSlug || undefined,
      campaign_id: campaignId || undefined,
      tags,
      password: password || undefined,
      max_clicks: maxClicks ? Number(maxClicks) : undefined,
      expires_at: expiresAt || undefined,
      utm_source: utmSource || undefined,
      utm_medium: utmMedium || undefined,
      utm_campaign: utmCampaign || undefined
    });

    if (res.error) {
      setErrorMsg(res.error);
    } else if (res.link) {
      setCreatedResult({
        short_url: `${getShortUrlPrefix(domains[0]?.hostname)}/${res.link.short_code}`,
        code: res.link.short_code
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
    setCreatedResult(null);
    setErrorMsg('');
    setSuggestedSlugs([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#072e42] max-w-xl w-full rounded-2xl border border-white/20 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#008296] text-white flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Create New Short Link</h2>
              <p className="text-xs text-slate-300">Base62 collision-checked &amp; UTM auto-tracked</p>
            </div>
          </div>
          <button
            onClick={resetForm}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Modal View */}
        {createdResult ? (
          <div className="text-center py-6 space-y-6">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white mb-1">Short Link Generated!</h3>
              <p className="text-slate-300 text-xs">Your short link is active, cached in Redis, and monitored for safety.</p>
            </div>

            <div className="p-4 bg-[#052536] rounded-xl border border-[#008296] flex items-center justify-between gap-3">
              <span className="font-mono text-cyan-300 font-bold text-sm truncate">{createdResult.short_url}</span>
              <button
                onClick={handleCopy}
                className="tinyurl-btn-green px-4 py-2 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={resetForm}
                className="w-full py-2.5 bg-[#0a405c] hover:bg-[#0c4c6e] text-white text-xs font-bold rounded-xl transition"
              >
                Create Another Link
              </button>
              <a
                href={`/r/${createdResult.code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 tinyurl-btn-teal text-white text-xs font-bold rounded-xl text-center flex items-center justify-center gap-1.5"
              >
                Test Redirect <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {errorMsg && (
              <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-200 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Long URL Input */}
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                Destination URL <span className="text-red-400">*</span>
              </label>
              <input
                type="url"
                required
                placeholder="https://acme.com/store/black-friday-special?discount=FLAT50"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#052536] border border-white/20 focus:border-[#008296] rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none"
              />
            </div>

            {/* Title & Custom Slug Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">Link Title / Label</label>
                <input
                  type="text"
                  placeholder="e.g. Black Friday Campaign"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#052536] border border-white/20 focus:border-[#008296] rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-200">Custom Back-Half / Slug</label>
                  <button
                    type="button"
                    onClick={handleAiSuggest}
                    className="text-[10px] text-cyan-300 hover:text-white font-bold flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-cyan-400" /> AI Suggest
                  </button>
                </div>
                <div className="flex items-center">
                  <span className="px-2.5 py-2.5 bg-[#052536] border border-r-0 border-white/20 rounded-l-xl text-xs font-mono text-slate-300">
                    {domains[0]?.hostname || 'localhost:3000'}/
                  </span>
                  <input
                    type="text"
                    placeholder="sale2026"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#052536] border border-white/20 focus:border-[#008296] rounded-r-xl text-xs font-mono text-white placeholder-slate-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* AI Slug Suggestions pills */}
            {suggestedSlugs.length > 0 && (
              <div className="p-3 bg-[#052536] border border-cyan-500/30 rounded-xl text-xs space-y-1.5">
                <span className="text-[11px] font-bold text-cyan-300">Suggested AI Slugs:</span>
                <div className="flex flex-wrap gap-2">
                  {suggestedSlugs.map((slug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCustomSlug(slug)}
                      className="px-2.5 py-1 bg-[#008296]/30 hover:bg-[#008296] border border-cyan-400/40 rounded-lg text-cyan-100 text-xs font-mono transition"
                    >
                      /{slug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Campaign & Tags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">Campaign</label>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#052536] border border-white/20 focus:border-[#008296] rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="">No Campaign (Default)</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">Tags (Comma separated)</label>
                <input
                  type="text"
                  placeholder="promo, saas, twitter"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#052536] border border-white/20 focus:border-[#008296] rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none"
                />
              </div>
            </div>

            {/* UTM Builder Accordion */}
            <div className="border border-white/20 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowUtm(!showUtm)}
                className="w-full p-3 bg-[#052536] hover:bg-[#07334a] flex items-center justify-between text-xs font-bold text-slate-200 transition"
              >
                <span className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-cyan-400" /> Built-in UTM Parameters Builder
                </span>
                <span className="text-slate-300 text-[10px]">{showUtm ? 'Hide' : 'Configure'}</span>
              </button>

              {showUtm && (
                <div className="p-3.5 bg-[#052536] space-y-3 border-t border-white/10 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-300 block mb-1">UTM Source</label>
                      <input
                        type="text"
                        placeholder="newsletter"
                        value={utmSource}
                        onChange={(e) => setUtmSource(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#072e42] border border-white/20 rounded-lg text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-300 block mb-1">UTM Medium</label>
                      <input
                        type="text"
                        placeholder="cpc / email"
                        value={utmMedium}
                        onChange={(e) => setUtmMedium(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#072e42] border border-white/20 rounded-lg text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-300 block mb-1">UTM Campaign</label>
                      <input
                        type="text"
                        placeholder="black_friday"
                        value={utmCampaign}
                        onChange={(e) => setUtmCampaign(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#072e42] border border-white/20 rounded-lg text-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Protection & Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" /> Password Protection
                </label>
                <input
                  type="password"
                  placeholder="Optional lock password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#052536] border border-white/20 rounded-xl text-xs text-white placeholder-slate-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-400" /> Max Click Limit
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1000 clicks"
                  value={maxClicks}
                  onChange={(e) => setMaxClicks(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#052536] border border-white/20 rounded-xl text-xs text-white placeholder-slate-400"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 bg-[#052536] hover:bg-[#07334a] text-slate-200 text-xs font-bold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 tinyurl-btn-green text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg"
              >
                Create Short Link <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
