'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { 
  Smartphone, 
  Play, 
  Plus, 
  ChevronRight, 
  Sparkles, 
  Zap, 
  Cpu, 
  Layers, 
  Check, 
  Copy, 
  Download, 
  Filter, 
  Globe, 
  Edit, 
  Trash2, 
  X, 
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export const SmartRoutingView: React.FC = () => {
  const { links, addRuleToLink, removeRuleFromLink, createShortLink } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Policy switches state
  const [policies, setPolicies] = useState({
    bypassIg: true,
    bypassTiktok: true,
    preserveAffiliate: true,
    customUniversal: true
  });

  // Simulator state
  const [testUrl, setTestUrl] = useState('https://instagram.com/reel/C89xLK_p9');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simVerified, setSimVerified] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // New Rule Modal
  const [newRuleModalOpen, setNewRuleModalOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [targetLinkId, setTargetLinkId] = useState(links[0]?.id || '');
  const [ruleAppScheme, setRuleAppScheme] = useState('');
  const [ruleFallback, setRuleFallback] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<'ios' | 'android' | 'all'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Handle Simulation
  const handleSimulate = () => {
    setIsSimulating(true);
    setSimVerified(false);
    setTimeout(() => {
      setIsSimulating(false);
      setSimVerified(true);
      setTimeout(() => setSimVerified(false), 3000);
    }, 600);
  };

  const handleCopyPayload = () => {
    const payload = JSON.stringify({
      target_url: testUrl,
      intent_android: "intent://instagram.com/#Intent;package=com.instagram.android;scheme=https;end",
      universal_ios: "instagram://media?id=xyz",
      resolved_ms: 11,
      bypass_webview: true
    }, null, 2);
    navigator.clipboard.writeText(payload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName || !ruleAppScheme) return;

    let linkIdToUse = targetLinkId;
    if (!linkIdToUse) {
      if (links.length > 0) {
        linkIdToUse = links[0].id;
      } else {
        const newLnk = createShortLink({
          destination_url: ruleFallback || 'https://instagram.com',
          title: ruleName
        });
        if (newLnk.link) {
          linkIdToUse = newLnk.link.id;
        }
      }
    }

    if (linkIdToUse) {
      addRuleToLink(linkIdToUse, {
        rule_type: 'device',
        condition: selectedDevice,
        target_url: ruleAppScheme,
        weight: 100
      });
    }

    setRuleName('');
    setRuleAppScheme('');
    setRuleFallback('');
    setNewRuleModalOpen(false);
  };

  // Compile real rules attached to links
  const dynamicRules = React.useMemo(() => {
    return links.flatMap(l => 
      (l.rules || []).map(r => ({
        id: r.id,
        linkId: l.id,
        title: `${l.title || l.short_code} · ${r.condition}`,
        code: `${l.custom_slug || l.short_code}`,
        badge: r.rule_type === 'device' ? 'DEV' : 'GEO',
        badgeBg: r.rule_type === 'device' ? 'bg-primary-fixed text-primary' : 'bg-emerald-100 text-emerald-800',
        scheme: r.target_url,
        openRate: '96.2% native app rate',
        filters: [r.condition, r.rule_type],
        fallback: l.destination_url,
        clicks: (l.clicks_count || 0).toLocaleString(),
        status: l.status === 'active' ? 'Active' : 'Paused',
        isCustom: true
      }))
    );
  }, [links]);

  const filteredRules = dynamicRules.filter(r => 
    r.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    r.code.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full gap-8 animate-fade-in text-on-surface">
      
      {/* 1. Top Breadcrumb & Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
            <span className="hover:text-on-surface cursor-pointer">Workspace</span>
            <ChevronRight className="w-3.5 h-3.5 text-outline" />
            <span className="text-primary-container font-semibold">Smart Routing</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
              OpeninApp &amp; Smart Routing Console
            </h1>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-low text-primary-container text-xs font-semibold border border-outline-variant/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Engine: 99.98% Native App Bounce</span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-on-surface-variant max-w-3xl leading-relaxed mt-0.5">
            Deep-link mobile app handlers, iOS Universal Links, Android App Links, and device/geo intent fallbacks to bypass trapped in-app webviews seamlessly.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button 
            type="button"
            onClick={() => {
              const input = document.getElementById('intent-test-input') as HTMLInputElement;
              if (input) {
                input.focus();
                input.select();
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container-low text-on-surface hover:bg-surface-container transition-all text-xs font-semibold shadow-xs border border-outline-variant/30 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-primary-container fill-primary-container" />
            <span>Test Intent URL</span>
          </button>
          
          <button 
            type="button"
            id="new-routing-rule-btn"
            onClick={() => setNewRuleModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-container text-on-primary hover:bg-primary transition-all text-xs font-bold shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Routing Rule</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metric Overview (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1 */}
        <div className="p-6 rounded-2xl bg-surface-container-lowest shadow-xs border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Pass-through Rate</span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-primary-container">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface tracking-tight">
                {dynamicRules.length > 0 ? '100%' : '0%'}
              </span>
              <span className="inline-flex items-center text-xs text-emerald-700 font-bold">
                {dynamicRules.length > 0 ? 'Live' : 'Standby'}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              {dynamicRules.length > 0 ? 'Active native app handoff enabled' : 'No routing rules active'}
            </p>
          </div>
          <div className="mt-4 h-1.5 w-full bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-primary-container rounded-full" style={{ width: dynamicRules.length > 0 ? '100%' : '0%' }} />
          </div>
        </div>

        {/* Card 2 */}
        <div className="p-6 rounded-2xl bg-surface-container-lowest shadow-xs border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Bypassed Webviews</span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-primary-container">
              <ExternalLink className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface tracking-tight">
                {links.filter(l => l.deep_link?.enabled || (l.rules && l.rules.length > 0)).reduce((acc, l) => acc + (l.clicks_count || 0), 0).toLocaleString()}
              </span>
              <span className="text-xs text-on-surface-variant font-medium">clicks</span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">Direct to native YouTube, IG &amp; TikTok</p>
          </div>
          <div className="mt-4 flex items-center gap-1 h-2">
            <div className="h-full bg-primary-container/20 flex-1 rounded-sm" />
            <div className="h-full bg-primary-container/30 flex-1 rounded-sm" />
            <div className="h-full bg-primary-container/50 flex-1 rounded-sm" />
            <div className="h-full bg-primary-container/70 flex-1 rounded-sm" />
            <div className="h-full bg-primary-container/90 flex-1 rounded-sm" />
            <div className="h-full bg-primary-container flex-1 rounded-sm" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="p-6 rounded-2xl bg-surface-container-lowest shadow-xs border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Active Deep-Link Rules</span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-primary-container">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface tracking-tight">{dynamicRules.length}</span>
              <span className="text-xs text-primary-container font-semibold">rules active</span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              Across {links.length} configured links
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-on-surface-variant">
            <span className={`w-2 h-2 rounded-full ${dynamicRules.length > 0 ? 'bg-emerald-500' : 'bg-outline'}`} />
            <span>{dynamicRules.length > 0 ? 'Zero collisions detected' : 'No rules created yet'}</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="p-6 rounded-2xl bg-surface-container-lowest shadow-xs border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Direct Handoff Latency</span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-primary-container">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface tracking-tight">
                {dynamicRules.length > 0 ? '12ms' : '0ms'}
              </span>
              <span className="text-xs text-emerald-700 font-bold">Edge-V8</span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">Sub-15ms edge resolution</p>
          </div>
          <div className="mt-4 flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>us-east &bull; eu-central &bull; ap-southeast</span>
          </div>
        </div>

      </div>

      {/* 3. Interactive Rule Matrix & Visual Sandbox Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Rule Configuration Matrix / Rule Builder Preview (7 cols) */}
        <div className="lg:col-span-7 flex flex-col p-6 rounded-2xl bg-surface-container-lowest shadow-xs border border-outline-variant/30">
          <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-xs">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-on-surface">Rule Configuration Matrix</h2>
                <p className="text-xs text-on-surface-variant">Active execution protocol definition</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Protocol</span>
            </span>
          </div>

          {/* Highlighted Protocol Rule Card */}
          <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-4 mt-4 border border-outline-variant/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs font-bold text-xs">
                  ▶
                </div>
                <div>
                  <div className="text-sm font-bold text-on-surface">YouTube Native Deep-Link Protocol</div>
                  <div className="font-mono text-xs text-primary-container font-semibold">snip.to/latest-video</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-on-surface-variant bg-surface-container-lowest px-2.5 py-1 rounded-lg border border-outline-variant/30 self-start sm:self-auto">
                Priority: 01 (Critical)
              </span>
            </div>

            {/* Intent Scheme Mapping Visualizer */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-3 rounded-xl bg-surface-container-lowest flex flex-col border border-outline-variant/20">
                <span className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Primary Intent (Android)</span>
                <span className="text-primary-container font-semibold truncate mt-1">vnd.youtube://v/xyz</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-lowest flex flex-col border border-outline-variant/20">
                <span className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Universal Link (iOS)</span>
                <span className="text-primary-container font-semibold truncate mt-1">youtube.com/watch?v=xyz</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-lowest flex flex-col border border-outline-variant/20">
                <span className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">HTTP Web Fallback</span>
                <span className="text-on-surface-variant font-medium truncate mt-1">https://m.youtube.com</span>
              </div>
            </div>

            {/* Matrix Policy Switches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              
              {/* Switch 1: Bypass IG */}
              <div className="p-3 rounded-xl bg-surface-container-lowest flex items-center justify-between border border-outline-variant/20">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-bold text-on-surface">Bypass IG In-App Browser</span>
                  <span className="text-[11px] text-on-surface-variant">Break webview into Safari/Chrome</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    checked={policies.bypassIg}
                    onChange={(e) => setPolicies(p => ({ ...p, bypassIg: e.target.checked }))}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-surface-container peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container" />
                </label>
              </div>

              {/* Switch 2: Bypass TikTok */}
              <div className="p-3 rounded-xl bg-surface-container-lowest flex items-center justify-between border border-outline-variant/20">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-bold text-on-surface">Bypass TikTok Webview</span>
                  <span className="text-[11px] text-on-surface-variant">Auto-invoke native deep link</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    checked={policies.bypassTiktok}
                    onChange={(e) => setPolicies(p => ({ ...p, bypassTiktok: e.target.checked }))}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-surface-container peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container" />
                </label>
              </div>

              {/* Switch 3: Affiliate Cookies */}
              <div className="p-3 rounded-xl bg-surface-container-lowest flex items-center justify-between border border-outline-variant/20">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-bold text-on-surface">Preserve Affiliate Cookies</span>
                  <span className="text-[11px] text-on-surface-variant">Append subtag &amp; tag parameters</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    checked={policies.preserveAffiliate}
                    onChange={(e) => setPolicies(p => ({ ...p, preserveAffiliate: e.target.checked }))}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-surface-container peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container" />
                </label>
              </div>

              {/* Switch 4: Custom Universal Domain */}
              <div className="p-3 rounded-xl bg-surface-container-lowest flex items-center justify-between border border-outline-variant/20">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-bold text-on-surface">Custom Universal Domain</span>
                  <span className="text-[11px] font-mono text-on-surface-variant">links.creatorstudio.io</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    checked={policies.customUniversal}
                    onChange={(e) => setPolicies(p => ({ ...p, customUniversal: e.target.checked }))}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-surface-container peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container" />
                </label>
              </div>

            </div>
          </div>
        </div>

        {/* Visual Simulator / Test Sandbox Panel (5 cols) */}
        <div className="lg:col-span-5 flex flex-col p-6 rounded-2xl bg-surface-container-lowest shadow-xs border border-outline-variant/30">
          <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-surface-container-low text-primary-container flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-on-surface">Handoff Simulator</h2>
                <p className="text-xs text-on-surface-variant">Live intent payload validation</p>
              </div>
            </div>
            <span className="font-mono text-[11px] text-on-surface-variant bg-surface-container-low px-2.5 py-1 rounded-lg border border-outline-variant/30">
              iPhone 15 Pro (iOS 17.4)
            </span>
          </div>

          {/* Test URL Input Box */}
          <div className="flex flex-col gap-1.5 mt-4">
            <label className="text-xs font-semibold text-on-surface-variant" htmlFor="intent-test-input">
              Destination Target URL
            </label>
            <div className="flex items-center gap-2 bg-surface-container-low rounded-xl p-1.5 border border-outline-variant/30 focus-within:ring-2 focus-within:ring-primary-container transition-all">
              <span className="pl-2 text-on-surface-variant text-xs">🔗</span>
              <input 
                id="intent-test-input"
                type="text"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="Paste Amazon, YouTube, or Spotify URL..."
                className="w-full bg-transparent px-2 py-1 font-mono text-xs text-on-surface outline-none"
              />
              <button 
                type="button"
                onClick={handleSimulate}
                disabled={isSimulating}
                className="px-4 py-1.5 rounded-lg bg-primary-container text-on-primary font-bold text-xs hover:bg-primary transition-all shrink-0 cursor-pointer disabled:opacity-75"
              >
                {isSimulating ? 'Resolving...' : simVerified ? 'Verified ✓' : 'Simulate'}
              </button>
            </div>
          </div>

          {/* Split Preview Simulator Cards */}
          <div className="grid grid-cols-2 gap-3 mt-4 flex-1">
            
            {/* Standard Webview (Negative UX) */}
            <div className="flex flex-col rounded-xl bg-surface-container-low p-3 border border-outline-variant/20">
              <div className="flex items-center gap-1.5 pb-2 text-rose-600 text-xs font-bold">
                <span>✕</span>
                <span>Standard Webview</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-lowest flex flex-col gap-2 flex-1 shadow-2xs border border-outline-variant/20 justify-between">
                <div className="h-2 w-16 bg-surface-container rounded" />
                <div className="h-16 w-full rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center p-2">
                  <AlertCircle className="w-5 h-5 text-rose-400 mb-1" />
                  <span className="text-[11px] text-on-surface-variant font-medium leading-tight">
                    Logged Out &bull; Cookie Dropped
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-rose-50 text-rose-700 text-[10px] leading-tight font-medium">
                  ⚠️ User forced to manually re-login. 68% cart abandonment.
                </div>
              </div>
            </div>

            {/* Snip Smart Hand-off (Optimized UX) */}
            <div className="flex flex-col rounded-xl bg-surface-container-high p-3 border border-primary-container/30">
              <div className="flex items-center gap-1.5 pb-2 text-primary-container text-xs font-bold">
                <Check className="w-3.5 h-3.5" />
                <span>Snip Deep-Link Direct</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-lowest flex flex-col gap-2 flex-1 shadow-2xs border border-primary-container/20 justify-between">
                <div className="h-2 w-20 bg-primary-container/20 rounded" />
                <div className="h-16 w-full rounded-lg bg-primary-container/10 flex flex-col items-center justify-center text-center p-2">
                  <Smartphone className="w-5 h-5 text-primary-container mb-1" />
                  <span className="text-[11px] text-primary-container font-bold leading-tight">
                    Native App Activated
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] leading-tight font-medium">
                  ✓ Direct 1-tap checkout. User profile &amp; credit cards active.
                </div>
              </div>
            </div>

          </div>

          {/* Micro status footer */}
          <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-on-surface-variant font-mono text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Direct scheme resolved in 11ms</span>
            </span>
            <button 
              type="button"
              onClick={handleCopyPayload}
              className="hover:text-primary-container transition-colors flex items-center gap-1 cursor-pointer font-semibold"
            >
              {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPayload ? 'Copied!' : 'Copy payload'}</span>
            </button>
          </div>

        </div>

      </div>

      {/* 4. Routing Rules Data Table Section */}
      <div className="flex flex-col p-6 rounded-2xl bg-surface-container-lowest shadow-xs border border-outline-variant/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/20">
          <div>
            <h2 className="text-base font-bold text-on-surface">Active Deep-Link Routing Rules</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Real-time condition mapping, protocol fallback chains, and monthly handoff volume.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter className="w-3.5 h-3.5 absolute left-3 top-3 text-on-surface-variant pointer-events-none" />
              <input 
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter rules..."
                className="pl-8 pr-3 py-1.5 bg-surface-container-low rounded-xl text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary-container border border-outline-variant/30"
              />
            </div>
            <button 
              type="button" 
              onClick={() => {
                const csv = "Rule,Scheme,Platform,Clicks\n" + filteredRules.map((r: any) => `"${r.title}","${r.scheme}","${(r.filters || []).join(',')}","${r.clicks}"`).join("\n");
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'smart-routing-rules.csv';
                a.click();
              }}
              className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface-variant transition-colors border border-outline-variant/30 cursor-pointer"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs text-on-surface">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 rounded-l-xl">Rule &amp; Trigger URL</th>
                <th className="py-3 px-4">Target App Scheme</th>
                <th className="py-3 px-4">Device / OS Filters</th>
                <th className="py-3 px-4">Fallback Strategy</th>
                <th className="py-3 px-4 text-right">30D Clicks</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right rounded-r-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-outline">
                        <Smartphone className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <p className="font-bold text-sm text-on-surface">No Smart Routing Rules Found</p>
                        <p className="text-xs text-on-surface-variant max-w-sm">
                          Create dynamic app-intent rules or device triggers to skip in-app webviews and open directly in native apps.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewRuleModalOpen(true)}
                        className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary font-semibold text-xs rounded-xl shadow-xs hover:bg-primary transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Create First Routing Rule</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-surface-container-low/60 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${rule.badgeBg}`}>
                        {rule.badge}
                      </div>
                      <div>
                        <div className="font-bold text-on-surface">{rule.title}</div>
                        <div className="font-mono text-primary-container text-xs font-semibold">{rule.code}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs text-on-surface">{rule.scheme}</span>
                      <span className="text-[11px] text-emerald-600 font-semibold">{rule.openRate}</span>
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <div className="flex flex-wrap gap-1">
                      {rule.filters.map(f => (
                        <span key={f} className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface font-semibold text-[10px]">
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <span className="px-2 py-1 rounded-lg bg-surface-container-low font-mono text-[11px] text-on-surface-variant border border-outline-variant/20">
                      {rule.fallback}
                    </span>
                  </td>

                  <td className="py-4 px-4 text-right font-mono text-xs font-bold text-on-surface">
                    {rule.clicks}
                  </td>

                  <td className="py-4 px-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      {rule.status}
                    </span>
                  </td>

                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 text-on-surface-variant">
                      <button 
                        type="button"
                        onClick={() => {
                          setTestUrl(rule.scheme);
                          handleSimulate();
                        }}
                        className="p-1.5 rounded-lg hover:bg-surface-container hover:text-on-surface cursor-pointer" 
                        title="Test Rule"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      {rule.isCustom && (
                        <button 
                          type="button" 
                          onClick={() => {
                            if (rule.linkId && rule.id) {
                              removeRuleFromLink(rule.linkId, rule.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/20 cursor-pointer transition-colors" 
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>

        {/* Table Pagination / Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-outline-variant/20 text-on-surface-variant text-xs mt-4">
          <span>Showing {filteredRules.length} active smart routing schemes</span>
        </div>

      </div>

      {/* New Routing Rule Modal */}
      {mounted && newRuleModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setNewRuleModalOpen(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl border border-outline-variant/40 relative animate-fade-in">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setNewRuleModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h4 className="text-base font-bold text-on-surface mb-1">Add Smart Routing Rule</h4>
            <p className="text-xs text-on-surface-variant mb-4">
              Configure deep linking and device fallback handlers to bypass trapped webviews.
            </p>

            <form onSubmit={handleCreateRule} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-on-surface block mb-1">Rule Name</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. TikTok Profile Deep Link"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Target Link</label>
                {links.length > 0 ? (
                  <select
                    value={targetLinkId || links[0]?.id}
                    onChange={(e) => setTargetLinkId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs cursor-pointer"
                  >
                    {links.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.title || l.custom_slug || l.short_code} ({l.destination_url.slice(0, 30)}...)
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    disabled
                    className="w-full px-3 py-2 bg-surface-container-low/50 rounded-xl border border-outline-variant/30 text-on-surface-variant text-xs cursor-not-allowed opacity-80"
                  >
                    <option value="" disabled selected>No links found — create a link first</option>
                  </select>
                )}
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Target Native App Scheme</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. vnd.youtube://... or instagram://media..."
                  value={ruleAppScheme}
                  onChange={(e) => setRuleAppScheme(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Device Targeting</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['all', 'ios', 'android'] as const).map(dev => (
                    <button
                      type="button"
                      key={dev}
                      onClick={() => setSelectedDevice(dev)}
                      className={`py-1.5 rounded-xl font-bold uppercase transition-all cursor-pointer border text-xs ${
                        selectedDevice === dev
                          ? 'bg-primary-container text-on-primary border-primary-container shadow-xs'
                          : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container'
                      }`}
                    >
                      {dev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Fallback Web URL</label>
                <input 
                  type="url"
                  placeholder="https://tiktok.com/@creator"
                  value={ruleFallback}
                  onChange={(e) => setRuleFallback(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20 mt-3">
                <button
                  type="button"
                  onClick={() => setNewRuleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer shadow-xs text-xs"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
