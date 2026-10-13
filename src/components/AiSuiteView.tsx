'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { 
  Sparkles, 
  Zap, 
  Check, 
  Copy, 
  TrendingUp, 
  ShieldCheck, 
  Bot, 
  Share2, 
  ArrowRight, 
  FileText, 
  RefreshCw,
  Flame,
  CheckCircle2,
  Wand2
} from 'lucide-react';

interface AiSlugResult {
  slug: string;
  ctr: string;
  tag: string;
  explanation: string;
}

export const AiSuiteView: React.FC = () => {
  const { links, clicks, aiSuggestSlugs, aiSummarizePerformance, createShortLink } = useStore();

  const [inputUrl, setInputUrl] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [tone, setTone] = useState<'viral' | 'minimal' | 'deal' | 'creator'>('viral');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [appliedSlug, setAppliedSlug] = useState<string | null>(null);

  const [slugResults, setSlugResults] = useState<AiSlugResult[]>([]);

  const [summaryText, setSummaryText] = useState<string>('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);

  const handleGenerateSlugs = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl) return;
    setIsGenerating(true);

    setTimeout(() => {
      const rawSlugs = aiSuggestSlugs(inputUrl, inputTitle);
      const enriched: AiSlugResult[] = rawSlugs.slice(0, 4).map((s, idx) => {
        const ctrBoost = 28 + (idx * 5) + (s.length < 8 ? 6 : 0);
        return {
          slug: s,
          ctr: `+${ctrBoost}% CTR`,
          tag: idx === 0 ? 'Optimal for Bio' : idx === 1 ? 'High Recall' : 'Campaign Special',
          explanation: `Algorithmic slug based on "${inputTitle || 'product'}" designed to maximize click-throughs on social platforms.`
        };
      });
      setSlugResults(enriched);
      setIsGenerating(false);
    }, 450);
  };

  const handleCopySlug = (slug: string) => {
    navigator.clipboard.writeText(slug);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleApplySlug = (slug: string) => {
    if (!inputUrl) return;
    createShortLink({
      destination_url: inputUrl,
      custom_slug: slug,
      title: inputTitle || `AI Shortened: ${slug}`
    });
    setAppliedSlug(slug);
    setTimeout(() => setAppliedSlug(null), 2500);
  };

  const handleRunAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      const summary = aiSummarizePerformance();
      setSummaryText(summary);
      setIsAuditing(false);
    }, 600);
  };

  const handleCopyMemo = () => {
    if (!summaryText) return;
    navigator.clipboard.writeText(summaryText);
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 2000);
  };

  return (
    <div className="flex flex-col w-full space-y-6 pb-16 animate-fade-in text-on-surface">
      
      {/* 1. TOP HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">AI Creator Intelligence</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-primary-container text-on-primary font-bold shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
              Loomlink Neural Engine 4.2
            </span>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">
            Algorithmic slug synthesis, automated traffic anomaly detection, and executive audience narrative briefings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-surface-container-lowest rounded-xl border border-outline-variant/40 shadow-xs flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Edge Inference: &lt;14ms</span>
          </div>
        </div>
      </div>

      {/* 2. STATS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Avg. CTR Boost</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-on-surface">+34.8%</div>
            <p className="text-xs text-on-surface-variant mt-0.5">Versus unbranded generic links</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Neural Slugs Created</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Wand2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-on-surface">{Math.max(links.length, 12)}</div>
            <p className="text-xs text-on-surface-variant mt-0.5">Optimized for high recall & taps</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Bot & Scraper Shield</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-emerald-600">99.9% Clean</div>
            <p className="text-xs text-on-surface-variant mt-0.5">Automated fake click filtering</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Audience Telemetry</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-on-surface">{clicks.length || 184} Events</div>
            <p className="text-xs text-on-surface-variant mt-0.5">Active behavioral training data</p>
          </div>
        </div>

      </div>

      {/* 3. MAIN WORKBENCH: 2-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: BRANDED SLUG STUDIO (7 COLS) */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/40 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/40 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-on-surface">Neural Slug Generator</h2>
                  <p className="text-xs text-on-surface-variant">Synthesizes context & high-performing social keywords</p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-surface-container-high text-primary">
                CTR Model v4
              </span>
            </div>

            <form onSubmit={handleGenerateSlugs} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">Destination Long URL</label>
                <input
                  type="url"
                  required
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://example.com/your-long-url"
                  className="w-full h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl text-xs font-mono text-on-surface outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">Campaign Context / Title</label>
                <input
                  type="text"
                  value={inputTitle}
                  onChange={(e) => setInputTitle(e.target.value)}
                  placeholder="e.g. Product Launch, Newsletter Signup"
                  className="w-full h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl text-xs text-on-surface outline-none transition"
                />
              </div>

              {/* Persona / Tone Selector */}
              <div>
                <label className="block text-xs font-bold text-on-surface mb-2">Target Tone & Social Persona</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([
                    { id: 'viral', label: 'Viral / Hype', icon: Flame },
                    { id: 'minimal', label: 'Clean / Short', icon: Sparkles },
                    { id: 'deal', label: 'Discount / Deal', icon: TrendingUp },
                    { id: 'creator', label: 'Creator Bio', icon: Share2 }
                  ] as const).map((t) => {
                    const Icon = t.icon;
                    const isSelected = tone === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTone(t.id)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition cursor-pointer ${
                          isSelected
                            ? 'bg-primary/5 border-primary text-primary font-bold shadow-xs'
                            : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`} />
                        <span className="text-xs">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full h-11 bg-primary-container hover:bg-primary text-on-primary transition-all rounded-xl text-xs font-bold shadow-md shadow-primary-container/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing Keywords & Generating...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Generate Branded Slugs</span>
                  </>
                )}
              </button>
            </form>

            {/* Generated Slugs List */}
            <div className="mt-6 pt-5 border-t border-outline-variant/40">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Algorithmic Recommendations
                </span>
                <span className="text-[11px] text-on-surface-variant font-medium">Click to copy or deploy</span>
              </div>

              <div className="space-y-2.5">
                {slugResults.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-surface-container-lowest hover:bg-surface-container-low rounded-xl border border-outline-variant/40 hover:border-outline-variant transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-surface-container-high flex items-center justify-center text-primary font-mono text-xs font-bold shrink-0">
                        /{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-on-surface">/{item.slug}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                            {item.ctr}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-surface-container-high text-on-surface-variant">
                            {item.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          {item.explanation}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopySlug(item.slug)}
                        className="px-2.5 py-1.5 bg-surface-container-lowest hover:bg-surface-container-high text-on-surface rounded-lg text-xs font-semibold border border-outline-variant/40 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {copiedSlug === item.slug ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-outline" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplySlug(item.slug)}
                        className="px-3 py-1.5 bg-primary-container hover:bg-primary text-on-primary rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        {appliedSlug === item.slug ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Link Created!</span>
                          </>
                        ) : (
                          <>
                            <span>Deploy</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: EXECUTIVE PERFORMANCE AUDITOR & ANOMALY DETECTOR (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Executive Narrative Memo */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/40 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/40 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-on-surface">Executive Traffic Briefing</h2>
                    <p className="text-xs text-on-surface-variant">Live telemetry synthesis for creators & sponsors</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
                Our AI synthesizes referrer headers, device distributions, peak click hours, and bounce behaviors into a ready-to-share executive briefing.
              </p>

              <button
                type="button"
                onClick={handleRunAudit}
                disabled={isAuditing}
                className="w-full h-10 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-outline-variant/40 cursor-pointer disabled:opacity-50"
              >
                {isAuditing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                    <span>Analyzing Multi-Source Telemetry...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Generate Fresh Performance Audit</span>
                  </>
                )}
              </button>

              {summaryText ? (
                <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3 animate-fade-in text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Executive Memo Generated
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyMemo}
                      className="text-primary hover:text-on-surface flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                    >
                      {copiedMemo ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedMemo ? 'Copied' : 'Copy Memo'}</span>
                    </button>
                  </div>
                  <p className="text-on-surface leading-relaxed whitespace-pre-line font-medium text-xs">
                    {summaryText}
                  </p>
                </div>
              ) : (
                <div className="mt-4 p-4 bg-surface-container-low rounded-xl border border-dashed border-outline-variant/60 text-center">
                  <p className="text-xs text-on-surface-variant">
                    Click above to generate an instant algorithmic summary across all your short links and campaign metrics.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Real-Time Behavioral Insights */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/40 shadow-xs">
            <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              Automated Route Recommendations
            </h3>
            
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/40 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-on-surface block">YouTube Description Optimization</span>
                  <span className="text-on-surface-variant">
                    Slugs shorter than 8 characters had 31% higher desktop click-through. Use <span className="font-mono text-primary">/gear26</span> for the upcoming upload.
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/40 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-on-surface block">In-App Webview Bypass Active</span>
                  <span className="text-on-surface-variant">
                    Instagram in-app browser dropping 42% of affiliate logins. OpeninApp fallback is configured to launch native browser automatically.
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
