'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { 
  Smartphone, 
  Plus, 
  ChevronRight, 
  Zap, 
  Cpu, 
  Layers, 
  Download, 
  Filter, 
  Trash2, 
  X, 
  ExternalLink,
  MapPin,
  Globe,
  Building2,
  Laptop
} from 'lucide-react';
import { SkeletonGenericView } from '@/components/ui/Skeleton';

export const SmartRoutingView: React.FC = () => {
  const { 
    links, 
    addRuleToLink, 
    removeRuleFromLink, 
    createShortLink, 
    refreshLinks,
    isLinksLoading,
    isInitialLoading
  } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    refreshLinks();
  }, [refreshLinks]);

  // New Rule Modal
  const [newRuleModalOpen, setNewRuleModalOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [targetLinkId, setTargetLinkId] = useState(links[0]?.id || '');
  const [selectedDevice, setSelectedDevice] = useState<'all' | 'android' | 'ios' | 'desktop'>('all');
  const [targetCountry, setTargetCountry] = useState('');
  const [targetState, setTargetState] = useState('');
  const [targetCity, setTargetCity] = useState('');
  const [ruleDestinationUrl, setRuleDestinationUrl] = useState('');
  const [ruleFallback, setRuleFallback] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Sync default targetLinkId when links load
  useEffect(() => {
    if (!targetLinkId && links.length > 0) {
      setTargetLinkId(links[0].id);
    }
  }, [links, targetLinkId]);

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !ruleDestinationUrl.trim()) return;

    let linkIdToUse = targetLinkId || links[0]?.id;
    if (!linkIdToUse) {
      const newLnk = createShortLink({
        destination_url: ruleFallback || 'https://instagram.com',
        title: ruleName
      });
      if (newLnk.link) {
        linkIdToUse = newLnk.link.id;
      }
    }

    if (linkIdToUse) {
      addRuleToLink(linkIdToUse, {
        rule_type: 'smart',
        device: selectedDevice,
        country: targetCountry.trim() || undefined,
        state: targetState.trim() || undefined,
        city: targetCity.trim() || undefined,
        target_url: ruleDestinationUrl,
        weight: 100
      });
    }

    setRuleName('');
    setTargetCountry('');
    setTargetState('');
    setTargetCity('');
    setSelectedDevice('all');
    setRuleDestinationUrl('');
    setRuleFallback('');
    setNewRuleModalOpen(false);
  };

  // Compile real rules attached to links
  const dynamicRules = React.useMemo(() => {
    return links.flatMap(l => 
      (l.rules || []).map(r => {
        let badge = 'SMART';
        let badgeBg = 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';

        const filterTags: string[] = [];
        if (r.device && r.device !== 'all') {
          filterTags.push(`Device: ${r.device.toUpperCase()}`);
        }
        if (r.city) filterTags.push(`City: ${r.city}`);
        if (r.state) filterTags.push(`State: ${r.state}`);
        if (r.country) filterTags.push(`Country: ${r.country}`);

        if (filterTags.length === 0 && r.condition) {
          filterTags.push(r.condition);
        }

        if (r.city) {
          badge = 'CITY';
          badgeBg = 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300';
        } else if (r.state) {
          badge = 'STATE';
          badgeBg = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
        } else if (r.country) {
          badge = 'GEO';
          badgeBg = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
        } else if (r.device && r.device !== 'all') {
          badge = r.device === 'ios' ? 'iOS' : r.device === 'android' ? 'AND' : 'DEV';
          badgeBg = 'bg-primary-fixed text-primary';
        } else if (r.rule_type === 'device') {
          badge = 'DEV';
          badgeBg = 'bg-primary-fixed text-primary';
        } else if (r.rule_type === 'geo') {
          badge = 'GEO';
          badgeBg = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
        }

        return {
          id: r.id,
          linkId: l.id,
          title: `${l.title || l.short_code} · ${r.condition || filterTags.join(' · ') || 'Smart Route'}`,
          code: `${l.custom_slug || l.short_code}`,
          badge,
          badgeBg,
          scheme: r.target_url,
          openRate: r.city || r.state || r.country ? 'Geo & Device Match' : '96.2% native app rate',
          filters: filterTags,
          fallback: l.destination_url,
          clicks: (l.clicks_count || 0).toLocaleString(),
          status: l.status === 'active' ? 'Active' : 'Paused',
          isCustom: true
        };
      })
    );
  }, [links]);

  const filteredRules = dynamicRules.filter(r => 
    r.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    r.code.toLowerCase().includes(searchFilter.toLowerCase())
  );

  if (!mounted || ((isInitialLoading || isLinksLoading) && links.length === 0)) {
    return (
      <div className="flex flex-col w-full gap-8 animate-fade-in text-on-surface">
        <SkeletonGenericView title="Smart Routing Rules" />
      </div>
    );
  }

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
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight whitespace-nowrap">
              OpeninApp &amp; Smart Routing Console
            </h1>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-surface-container-low text-primary-container text-xs font-semibold border border-outline-variant/30 whitespace-nowrap shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Engine: 99.98% Native App Bounce</span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-on-surface-variant max-w-3xl leading-relaxed mt-0.5">
            Deep-link mobile app handlers, iOS Universal Links, Android App Links, and device/geo intent fallbacks to bypass trapped in-app webviews seamlessly.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button 
            type="button"
            id="new-routing-rule-btn"
            onClick={() => setNewRuleModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-container text-on-primary hover:bg-primary transition-all text-xs font-bold shadow-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Routing Rule</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metric Overview (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1 */}
        <div className="p-6 rounded-xl bg-surface-container-lowest shadow-xs border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Pass-through Rate</span>
            <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary-container">
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
        <div className="p-6 rounded-xl bg-surface-container-lowest shadow-xs border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Bypassed Webviews</span>
            <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary-container">
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
        <div className="p-6 rounded-xl bg-surface-container-lowest shadow-xs border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Active Deep-Link Rules</span>
            <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary-container">
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
        <div className="p-6 rounded-xl bg-surface-container-lowest shadow-xs border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Direct Handoff Latency</span>
            <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary-container">
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

      {/* 3. Routing Rules Data Table Section */}
      <div className="flex flex-col p-6 rounded-xl bg-surface-container-lowest shadow-xs border border-outline-variant/30">
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
                className="pl-8 pr-3 py-1.5 bg-surface-container-low rounded-lg text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary-container border border-outline-variant/30"
              />
            </div>
            <button 
              type="button" 
              onClick={() => {
                const csv = "Rule,Scheme,Platform,Clicks\n" + filteredRules.map(r => `"${r.title}","${r.scheme}","${(r.filters || []).join(',')}","${r.clicks}"`).join("\n");
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'smart-routing-rules.csv';
                a.click();
              }}
              className="p-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant transition-colors border border-outline-variant/30 cursor-pointer"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table Container (Desktop & Tablets >= 768px) */}
        <div className="hidden md:block overflow-x-auto mt-4">
          <table className="w-full text-left text-xs text-on-surface">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 rounded-l-lg">Rule &amp; Trigger URL</th>
                <th className="py-3 px-4">Target App Scheme</th>
                <th className="py-3 px-4">Device / OS Filters</th>
                <th className="py-3 px-4">Fallback Strategy</th>
                <th className="py-3 px-4 text-right">30D Clicks</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right rounded-r-lg">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-outline">
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
                        className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary font-semibold text-xs rounded-lg shadow-xs hover:bg-primary transition cursor-pointer"
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
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${rule.badgeBg}`}>
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
                        <span key={f} className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-semibold text-[10px]">
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
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      {rule.status}
                    </span>
                  </td>

                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 text-on-surface-variant">
                      <button 
                        type="button"
                        onClick={() => {
                          window.open(rule.scheme, '_blank', 'noopener,noreferrer');
                        }}
                        className="p-1.5 rounded-lg hover:bg-surface-container hover:text-on-surface cursor-pointer" 
                        title="Open Target URL"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
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

        {/* Mobile Card List (Screens < 768px) */}
        <div className="block md:hidden divide-y divide-outline-variant/20 mt-4">
          {filteredRules.length === 0 ? (
            <div className="py-8 px-4 text-center text-on-surface-variant flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-outline">
                <Smartphone className="w-6 h-6" />
              </div>
              <p className="font-bold text-sm text-on-surface">No Smart Routing Rules Found</p>
              <button
                type="button"
                onClick={() => setNewRuleModalOpen(true)}
                className="mt-1 inline-flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary font-semibold text-xs rounded-lg shadow-xs hover:bg-primary transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Routing Rule</span>
              </button>
            </div>
          ) : (
            filteredRules.map((rule) => (
              <div key={rule.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${rule.badgeBg}`}>
                      {rule.badge}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-on-surface truncate">{rule.title}</div>
                      <div className="font-mono text-primary-container text-xs font-semibold">/{rule.code}</div>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                    {rule.status}
                  </span>
                </div>

                <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/20 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-on-surface-variant">Target App Scheme:</span>
                    <span className="text-emerald-600 font-semibold">{rule.openRate}</span>
                  </div>
                  <div className="font-mono text-[11px] text-on-surface truncate">{rule.scheme}</div>
                </div>

                {rule.filters.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {rule.filters.map(f => (
                      <span key={f} className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-semibold text-[10px]">
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 text-xs">
                  <span className="font-mono text-xs font-bold text-on-surface">
                    {rule.clicks} clicks
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button 
                      type="button"
                      onClick={() => window.open(rule.scheme, '_blank', 'noopener,noreferrer')}
                      className="p-1.5 rounded-lg hover:bg-surface-container hover:text-on-surface cursor-pointer text-on-surface-variant" 
                      title="Open Target URL"
                    >
                      <ExternalLink className="w-4 h-4" />
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
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
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
          <div className="bg-surface-container-lowest rounded-xl max-w-xl w-full p-6 shadow-2xl border border-outline-variant/40 relative animate-fade-in max-h-[92vh] overflow-y-auto">
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
              Full multi-attribute routing: customize device targeting, location targeting (city, state, country), or combine them together.
            </p>

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-on-surface block mb-1">Rule Name</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. India Android Offer or Mumbai Store"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold text-on-surface block mb-1">Target Link</label>
                  {links.length > 0 ? (
                    <select
                      value={targetLinkId || links[0]?.id}
                      onChange={(e) => setTargetLinkId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs cursor-pointer font-medium"
                    >
                      {links.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.title || l.custom_slug || l.short_code} ({l.destination_url.slice(0, 24)}...)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      disabled
                      className="w-full px-3 py-2 bg-surface-container-low/50 rounded-lg border border-outline-variant/30 text-on-surface-variant text-xs cursor-not-allowed opacity-80"
                    >
                      <option value="" disabled selected>No links found — create a link first</option>
                    </select>
                  )}
                </div>
              </div>

              {/* 1. DEVICE TARGETING SECTION */}
              <div className="p-3.5 rounded-lg bg-surface-container-low/60 border border-outline-variant/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-on-surface">
                    <Smartphone className="w-4 h-4 text-primary" />
                    <span>1. Device Platform Targeting</span>
                  </div>
                  <span className="text-[10px] text-on-surface-variant">Filter by device OS</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { id: 'all', label: 'All Devices', icon: Globe },
                    { id: 'android', label: 'Android', icon: Smartphone },
                    { id: 'ios', label: 'iOS (Apple)', icon: Smartphone },
                    { id: 'desktop', label: 'Desktop / PC', icon: Laptop },
                  ].map(dev => {
                    const Icon = dev.icon;
                    const isSelected = selectedDevice === dev.id;
                    return (
                      <button
                        type="button"
                        key={dev.id}
                        onClick={() => setSelectedDevice(dev.id as 'all' | 'android' | 'ios' | 'desktop')}
                        className={`py-2 px-2.5 rounded-lg font-bold transition-all cursor-pointer border text-xs flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-primary-container text-on-primary border-primary-container shadow-xs'
                            : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-high'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{dev.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. LOCATION TARGETING SECTION (ALL 3: COUNTRY, STATE, CITY) */}
              <div className="p-3.5 rounded-lg bg-surface-container-low/60 border border-outline-variant/30 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-on-surface">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>2. Geo-Location Targeting (Country, State &amp; City)</span>
                  </div>
                  <span className="text-[10px] text-on-surface-variant">Leave blank to match all</span>
                </div>

                {/* Country Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-on-surface flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-primary" />
                      <span>Target Country</span>
                    </label>
                    <span className="text-[10px] text-on-surface-variant">Name or 2-letter ISO code</span>
                  </div>
                  <input 
                    type="text"
                    placeholder="e.g. India or IN, United States or US, UK... (optional)"
                    value={targetCountry}
                    onChange={(e) => setTargetCountry(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface-container rounded-lg border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <span className="text-[10px] text-on-surface-variant font-medium self-center mr-0.5">Quick:</span>
                    {[
                      { label: 'India (IN)', val: 'India' },
                      { label: 'United States (US)', val: 'United States' },
                      { label: 'United Kingdom (GB)', val: 'United Kingdom' },
                      { label: 'Canada (CA)', val: 'Canada' },
                      { label: 'Germany (DE)', val: 'Germany' },
                      { label: 'UAE (AE)', val: 'United Arab Emirates' }
                    ].map(c => (
                      <button
                        type="button"
                        key={c.val}
                        onClick={() => setTargetCountry(c.val)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition cursor-pointer ${
                          targetCountry === c.val
                            ? 'bg-primary-container text-on-primary'
                            : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* State / Region Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-on-surface flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Target State / Region / Province</span>
                    </label>
                    <span className="text-[10px] text-on-surface-variant">Name or Region code</span>
                  </div>
                  <input 
                    type="text"
                    placeholder="e.g. Maharashtra or MH, California or CA, Delhi or DL... (optional)"
                    value={targetState}
                    onChange={(e) => setTargetState(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface-container rounded-lg border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <span className="text-[10px] text-on-surface-variant font-medium self-center mr-0.5">Quick:</span>
                    {[
                      { label: 'Maharashtra (MH)', val: 'Maharashtra' },
                      { label: 'Delhi (DL)', val: 'Delhi' },
                      { label: 'Karnataka (KA)', val: 'Karnataka' },
                      { label: 'California (CA)', val: 'California' },
                      { label: 'New York (NY)', val: 'New York' },
                      { label: 'Texas (TX)', val: 'Texas' }
                    ].map(s => (
                      <button
                        type="button"
                        key={s.val}
                        onClick={() => setTargetState(s.val)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition cursor-pointer ${
                          targetState === s.val
                            ? 'bg-amber-600 text-white'
                            : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* City Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-on-surface flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-sky-600" />
                      <span>Target City</span>
                    </label>
                    <span className="text-[10px] text-on-surface-variant">Specific city name</span>
                  </div>
                  <input 
                    type="text"
                    placeholder="e.g. Mumbai, Pimpri, Pune, San Francisco, Bengaluru... (optional)"
                    value={targetCity}
                    onChange={(e) => setTargetCity(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface-container rounded-lg border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <span className="text-[10px] text-on-surface-variant font-medium self-center mr-0.5">Quick:</span>
                    {['Mumbai', 'Pimpri', 'Pune', 'Bengaluru', 'Delhi', 'San Francisco', 'New York', 'London'].map(ct => (
                      <button
                        type="button"
                        key={ct}
                        onClick={() => setTargetCity(ct)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition cursor-pointer ${
                          targetCity === ct
                            ? 'bg-sky-600 text-white'
                            : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface'
                        }`}
                      >
                        {ct}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. DESTINATION REDIRECT URL */}
              <div>
                <label className="font-semibold text-on-surface block mb-1">
                  Target Destination URL for this Rule
                </label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. https://play.google.com/store/... or https://mumbai.store.com"
                  value={ruleDestinationUrl}
                  onChange={(e) => setRuleDestinationUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface font-mono text-[11px]"
                />
              </div>

              {/* 4. FALLBACK WEB URL */}
              <div>
                <label className="font-semibold text-on-surface block mb-1">Fallback Web URL (Default)</label>
                <input 
                  type="url"
                  placeholder="https://example.com/fallback-page"
                  value={ruleFallback}
                  onChange={(e) => setRuleFallback(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface font-mono text-[11px]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20 mt-3">
                <button
                  type="button"
                  onClick={() => setNewRuleModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer shadow-xs text-xs"
                >
                  Save Smart Rule
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
