'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { 
  Search, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Trash2, 
  Smartphone, 
  Plus, 
  Activity, 
  MousePointerClick, 
  CheckCircle2, 
  Layers, 
  ArrowRight
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { detectAppDeepLink } from '@/lib/deepLink';
import { SocialCardModal } from './SocialCardModal';

interface OverviewViewProps {
  onOpenCreateModal: () => void;
  onNavigateTab?: (tab: string) => void;
  onOpenCommandPalette?: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ 
  onOpenCreateModal, 
  onNavigateTab: _onNavigateTab
}) => {
  const { links, clicks, domains, createShortLink, deleteLink } = useStore();

  // Quick shorten bar state
  const [quickUrl, setQuickUrl] = useState('');
  const [quickAlias, setQuickAlias] = useState('');
  const [quickResult, setQuickResult] = useState<{ url: string; code: string } | null>(null);
  const [quickCopied, setQuickCopied] = useState(false);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'openinapp'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // QR Modal
  const [selectedQr, setSelectedQr] = useState<{ url: string; title: string } | null>(null);

  // Social Card Studio Modal
  const [socialModalData, setSocialModalData] = useState<{ isOpen: boolean; title: string; code: string }>({
    isOpen: false,
    title: 'Link Operations',
    code: 'spring-launch'
  });

  const handleQuickShorten = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrl) return;

    const res = createShortLink({
      destination_url: quickUrl,
      custom_slug: quickAlias.trim() || undefined,
      title: quickAlias ? `${quickAlias} Link` : undefined
    });

    if (res.link) {
      const domain = domains[0]?.hostname || (typeof window !== 'undefined' ? window.location.host : 'snip.to');
      const full = `https://${domain}/${res.link.short_code}`;
      setQuickResult({ url: full, code: res.link.short_code });
      setQuickUrl('');
      setQuickAlias('');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const originDomain = domains[0]?.hostname || (typeof window !== 'undefined' ? window.location.host : 'snip.to');

  // Filter links
  const filteredLinks = links.filter(link => {
    const matchesSearch = 
      (link.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (link.short_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (link.destination_url || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === 'active') return matchesSearch && link.status === 'active';
    if (statusFilter === 'openinapp') return matchesSearch && !!link.deep_link?.enabled;
    return matchesSearch;
  });

  // Calculate live statistics
  const totalClicksCount = links.reduce((acc, l) => acc + (l.clicks_count || 0), 0);
  const appDeepLinksCount = links.filter(l => l.deep_link?.enabled).length;
  const activeLinksCount = links.filter(l => l.status === 'active').length;
  const activePercentage = links.length > 0 ? Math.round((activeLinksCount / links.length) * 100) : 100;

  return (
    <div className="flex flex-col w-full space-y-6 pb-16 animate-fade-in text-on-surface">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface whitespace-nowrap">Workspace Overview</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-primary-container text-on-primary font-bold shadow-xs whitespace-nowrap shrink-0">
              {links.length} Links Active
            </span>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">
            Real-time link routing, mobile app deep link diagnostics, and audience click engagement.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button 
            type="button"
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary-container hover:bg-primary text-on-primary transition-all rounded-xl text-xs font-bold shadow-md shadow-primary-container/20 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Create Short Link</span>
          </button>
        </div>
      </div>

      {/* 2. Stat Metric Cards (Simplified & User-Centric) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Links */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Total Links
            </span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-on-surface">
              {links.length.toLocaleString()}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold">{activeLinksCount} active</span> in workspace
            </p>
          </div>
        </div>

        {/* Card 2: Total Clicks */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Total Clicks
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
              <MousePointerClick className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-on-surface">
              {totalClicksCount.toLocaleString()}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold">{clicks.length} events</span> tracked in real time
            </p>
          </div>
        </div>

        {/* Card 3: Mobile App Opens */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              OpeninApp Routing
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Smartphone className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-on-surface">
              {appDeepLinksCount} Links
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold">100% Native</span> in-app launch enabled
            </p>
          </div>
        </div>

        {/* Card 4: Active Health */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Network Health
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-on-surface">
              {activePercentage}%
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold">{activeLinksCount} of {links.length}</span> running healthy
            </p>
          </div>
        </div>

      </div>

      {/* 3. Quick Shorten Hero Bar */}
      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-xs">
        <form onSubmit={handleQuickShorten} className="space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Long URL Input */}
            <div className="flex-1 w-full relative">
              <input
                type="url"
                required
                placeholder="Paste destination long URL (YouTube, Instagram, Amazon, Shopify, website...)"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant/60 outline-none transition"
              />
            </div>

            {/* Custom Alias Input */}
            <input
              type="text"
              placeholder="custom-slug (optional)"
              value={quickAlias}
              onChange={(e) => setQuickAlias(e.target.value)}
              className="w-full sm:w-48 h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl text-xs font-mono text-on-surface placeholder:text-on-surface-variant/60 outline-none transition"
            />

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full sm:w-auto h-11 px-5 bg-primary-container hover:bg-primary text-on-primary rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-primary-container/20 cursor-pointer"
            >
              <span>Shorten URL</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Success Toast Bar */}
          {quickResult && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between text-xs animate-fade-in">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                <span className="text-primary font-semibold shrink-0">Shortened Link Ready:</span>
                <code className="text-on-surface font-bold font-mono truncate">{quickResult.url}</code>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(quickResult.url);
                  setQuickCopied(true);
                  setTimeout(() => setQuickCopied(false), 2000);
                }}
                className="shrink-0 ml-3 px-3 py-1 bg-surface-container-lowest border border-outline-variant/40 rounded-lg text-xs font-bold text-on-surface flex items-center gap-1 cursor-pointer"
              >
                {quickCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{quickCopied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* 4. Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-xs">
        
        {/* Left Search and Filter Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-outline absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search links, slugs, targets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 pr-3 w-full sm:w-72 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary outline-none transition"
            />
          </div>

          <div className="flex items-center gap-1 bg-surface-container p-1 rounded-xl shrink-0">
            {(['all', 'active', 'openinapp'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`h-7 px-3 rounded-lg text-xs font-semibold capitalize transition cursor-pointer whitespace-nowrap shrink-0 ${
                  statusFilter === filter
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {filter === 'openinapp' ? 'OpeninApp' : filter}
              </button>
            ))}
          </div>

          <span className="text-xs text-on-surface-variant font-mono hidden md:inline whitespace-nowrap">
            {filteredLinks.length} links listed
          </span>
        </div>

        {/* Right CTA */}
        <button
          type="button"
          onClick={onOpenCreateModal}
          className="px-3.5 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer border border-outline-variant/40 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-primary" />
          <span>New Link</span>
        </button>
      </div>

      {/* 5. Resource Cards */}
      <div className="space-y-3">
        {filteredLinks.length === 0 ? (
          <div className="border-2 border-dashed border-outline-variant/60 rounded-2xl bg-surface-container-low p-12 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center mx-auto text-on-surface-variant">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-on-surface">No links found</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Try refining your search keyword or create a new short link.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="mt-2 px-4 py-2 bg-primary-container text-on-primary text-xs font-bold rounded-xl cursor-pointer"
            >
              + Create Short Link
            </button>
          </div>
        ) : (
          filteredLinks.map((link) => {
            const fullShortUrl = `https://${originDomain}/${link.short_code}`;
            const isCopied = copiedId === link.id;
            const appDetection = detectAppDeepLink(link.destination_url);

            return (
              <div
                key={link.id}
                className="relative rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 group overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  
                  {/* Left: Link Details */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-on-surface truncate">
                        {link.title || 'Untitled Link'}
                      </h4>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-surface-container-high text-primary font-bold">
                        /{link.short_code}
                      </span>
                      {link.deep_link?.enabled && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold">
                          OpeninApp
                        </span>
                      )}
                      {appDetection?.isSupported && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant font-medium">
                          {appDetection.appName}
                        </span>
                      )}
                    </div>

                    {/* Short Code & Destination */}
                    <div className="flex items-center gap-2 text-xs">
                      <a
                        href={fullShortUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-primary hover:underline font-semibold flex items-center gap-1"
                      >
                        <span>{fullShortUrl}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <span className="text-on-surface-variant/40">→</span>
                      <span className="text-on-surface-variant truncate max-w-xs sm:max-w-md font-mono text-[11px]">
                        {link.destination_url}
                      </span>
                    </div>
                  </div>

                  {/* Right: Metrics & Interactive Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* Click Stat Pill */}
                    <div className="px-2.5 py-1 rounded-lg bg-surface-container text-xs font-semibold text-on-surface flex items-center gap-1.5 font-mono">
                      <Activity className="w-3.5 h-3.5 text-blue-600" />
                      <span>{link.clicks_count || 0} clicks</span>
                    </div>

                    {/* Copy Button */}
                    <button
                      type="button"
                      onClick={() => copyToClipboard(fullShortUrl, link.id)}
                      className="px-2.5 py-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-outline" />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>

                    {/* QR Code Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedQr({ url: fullShortUrl, title: link.title })}
                      className="p-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-high text-on-surface text-xs transition cursor-pointer"
                      title="View QR Code"
                    >
                      <QrCode className="w-4 h-4 text-on-surface-variant" />
                    </button>

                    {/* Delete Action */}
                    <button
                      type="button"
                      onClick={() => deleteLink(link.id)}
                      className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition cursor-pointer"
                      title="Delete Link"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>


      {/* QR Code Modal Dialog */}
      {selectedQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="fixed inset-0" onClick={() => setSelectedQr(null)} />
          <div className="bg-surface-container-lowest border border-outline-variant/60 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative z-10 text-center space-y-4">
            <h3 className="text-base font-bold text-on-surface">{selectedQr.title || 'QR Code'}</h3>
            <div className="p-4 bg-white rounded-xl inline-block shadow-md">
              <QRCodeSVG value={selectedQr.url} size={180} />
            </div>
            <p className="text-xs font-mono text-on-surface-variant break-all">{selectedQr.url}</p>
            <button
              type="button"
              onClick={() => setSelectedQr(null)}
              className="w-full py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs rounded-xl cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* Social Card Modal */}
      <SocialCardModal
        isOpen={socialModalData.isOpen}
        onClose={() => setSocialModalData({ ...socialModalData, isOpen: false })}
        linkTitle={socialModalData.title}
        shortCode={socialModalData.code}
      />

    </div>
  );
};
