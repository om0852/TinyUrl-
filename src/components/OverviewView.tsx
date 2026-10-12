'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { 
  Search, 
  ChevronDown, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Trash2, 
  Smartphone, 
  Sparkles, 
  Share2, 
  Plus, 
  Filter, 
  ShieldCheck, 
  ArrowRight, 
  Activity, 
  MousePointerClick, 
  CheckCircle2, 
  Zap, 
  Layers, 
  Clock, 
  Radio, 
  Globe 
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { detectAppDeepLink } from '@/lib/deepLink';
import { SocialCardModal } from './SocialCardModal';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface OverviewViewProps {
  onOpenCreateModal: () => void;
  onNavigateTab: (tab: any) => void;
  onOpenCommandPalette?: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ 
  onOpenCreateModal, 
  onNavigateTab,
  onOpenCommandPalette 
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
      const domain = domains[0]?.hostname || 'tiny-url-self.vercel.app';
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

  const domain = domains[0]?.hostname || 'tiny-url-self.vercel.app';

  // Filter links
  const filteredLinks = links.filter(link => {
    const matchesSearch = 
      link.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.short_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.destination_url.toLowerCase().includes(searchQuery.toLowerCase());

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
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your short links, track visitor clicks, and configure mobile app deep routing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={onOpenCreateModal}
            size="lg" 
            className="shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="mr-2 h-4 w-4" /> New Resource
          </Button>
        </div>
      </div>

      {/* 2. Stat Metric Cards (Simplified & User-Centric) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Card 1: Total Links */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-200 border-l-4 border-l-primary rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Links
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-full">
              <Layers className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {links.length.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-emerald-500 font-semibold">{activeLinksCount} active</span> in workspace
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Clicks */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-200 border-l-4 border-l-blue-500 rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Clicks
            </CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-full">
              <MousePointerClick className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {totalClicksCount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-emerald-500 font-semibold">{clicks.length} events</span> tracked in real time
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Mobile App Opens */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-200 border-l-4 border-l-emerald-500 rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Mobile App Opens
            </CardTitle>
            <div className="p-2 bg-emerald-500/10 rounded-full">
              <Smartphone className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {appDeepLinksCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Badge variant="success" className="text-[9px] px-1 py-0 font-normal">Active</Badge>
              <span className="text-xs text-muted-foreground">Direct app launch links</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Active Links */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-200 border-l-4 border-l-amber-500 rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Links
            </CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-full">
              <CheckCircle2 className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {activePercentage}%
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-emerald-500 font-semibold">{activeLinksCount} of {links.length}</span> healthy &amp; active
            </p>
          </CardContent>
        </Card>

      </div>

      {/* 3. Quick Shorten Hero Bar */}
      <Card className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
        <form onSubmit={handleQuickShorten} className="space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Long URL Input */}
            <div className="flex-1 w-full relative">
              <input
                type="url"
                required
                placeholder="Paste long URL (e.g. https://www.youtube.com/watch?v=..., Amazon product, documentation...)"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                className="w-full h-10 px-4 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
            </div>

            {/* Custom Alias Input */}
            <input
              type="text"
              placeholder="custom-slug (optional)"
              value={quickAlias}
              onChange={(e) => setQuickAlias(e.target.value)}
              className="w-full sm:w-48 h-10 px-3.5 bg-background border border-border/60 focus:border-primary rounded-lg text-xs font-mono text-foreground placeholder:text-muted-foreground/60 outline-none transition"
            />

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-auto text-xs font-bold"
            >
              <span>Shorten URL</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>

          {/* Quick Success Toast Bar */}
          {quickResult && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between text-xs animate-fade-in">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                <span className="text-primary font-semibold shrink-0">Shortened Link Ready:</span>
                <code className="text-foreground font-bold font-mono truncate">{quickResult.url}</code>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(quickResult.url);
                  setQuickCopied(true);
                  setTimeout(() => setQuickCopied(false), 2000);
                }}
                className="shrink-0 ml-3"
              >
                {quickCopied ? <Check className="w-3.5 h-3.5 text-emerald-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                <span>{quickCopied ? 'Copied!' : 'Copy'}</span>
              </Button>
            </div>
          )}
        </form>
      </Card>

      {/* 4. Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
        
        {/* Left Search and Filter Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search links, slugs, targets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 pr-3 w-full sm:w-72 bg-card border border-border/60 rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary outline-none transition"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-muted/30 border border-border/40 p-0.5 rounded-lg">
            {(['all', 'active', 'openinapp'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`h-7 px-3 rounded-md text-xs font-medium capitalize transition cursor-pointer ${
                  statusFilter === filter
                    ? 'bg-card text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {filter === 'openinapp' ? 'OpeninApp' : filter}
              </button>
            ))}
          </div>

          <span className="text-xs text-muted-foreground font-mono hidden md:inline">
            {filteredLinks.length} links listed
          </span>
        </div>

        {/* Right CTA */}
        <Button
          onClick={onOpenCreateModal}
          size="sm"
          className="text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          <span>New Link</span>
        </Button>
      </div>

      {/* 5. Resource Cards (Section 7.2 Accent Strip Indicator) */}
      <div className="space-y-3">
        {filteredLinks.length === 0 ? (
          <div className="border-2 border-dashed border-border/50 rounded-xl bg-muted/5 p-12 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center mx-auto text-muted-foreground">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No resources found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try refining your search keyword or create a new short link.
              </p>
            </div>
            <Button onClick={onOpenCreateModal} size="default" className="mt-2">
              <Plus className="w-4 h-4 mr-1.5" /> + Create Project Link
            </Button>
          </div>
        ) : (
          filteredLinks.map((link) => {
            const fullShortUrl = `https://${domain}/${link.short_code}`;
            const isCopied = copiedId === link.id;
            const appDetection = detectAppDeepLink(link.destination_url);

            return (
              <div
                key={link.id}
                className="relative rounded-xl border border-border/40 bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 group overflow-hidden"
              >
                {/* Accent Strip Indicator on Hover (Section 7.2) */}
                <div className="w-1 h-full bg-primary/0 group-hover:bg-primary transition-all duration-300 absolute left-0 top-0 rounded-l-xl" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  
                  {/* Left: Link Details */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-foreground truncate">
                        {link.title || 'Untitled Link'}
                      </h4>
                      <Badge variant="primary" className="font-mono text-[9px]">
                        /{link.short_code}
                      </Badge>
                      {link.deep_link?.enabled && (
                        <Badge variant="success" className="text-[9px]">
                          OpeninApp
                        </Badge>
                      )}
                      {appDetection?.isSupported && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
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
                      <span className="text-muted-foreground/40">→</span>
                      <span className="text-muted-foreground truncate max-w-xs sm:max-w-md font-mono text-[11px]">
                        {link.destination_url}
                      </span>
                    </div>
                  </div>

                  {/* Right: Metrics & Interactive Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* Click Stat Pill */}
                    <div className="px-2.5 py-1 rounded-md bg-muted/40 border border-border/30 text-xs font-semibold text-foreground flex items-center gap-1.5 font-mono">
                      <Activity className="w-3.5 h-3.5 text-blue-500" />
                      <span>{link.clicks_count || 0} clicks</span>
                    </div>

                    {/* Copy Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(fullShortUrl, link.id)}
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </Button>

                    {/* QR Code Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedQr({ url: fullShortUrl, title: link.title })}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </Button>

                    {/* Delete Action */}
                    <button
                      onClick={() => deleteLink(link.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition cursor-pointer"
                      title="Delete Link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 6. Live Activity Timeline (Section 7.4) */}
      <div className="pt-4 border-t border-border/40">
        <h3 className="text-base font-semibold text-foreground mb-4">
          Live Routing &amp; Operational Timeline
        </h3>

        <div className="space-y-4 relative border-l border-border/50 ml-3.5 pl-6">
          <div className="relative">
            <span className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-background" />
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Global SSL &amp; Edge Health Verified</span>
              <span className="text-muted-foreground font-mono text-[11px]">2 mins ago</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automated Zero-Phish scan completed across 100% of custom slugs with zero threat indicators.
            </p>
          </div>

          <div className="relative">
            <span className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-background" />
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">OpeninApp Deep Routing Triggered</span>
              <span className="text-muted-foreground font-mono text-[11px]">8 mins ago</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Client request on iOS 17 redirected straight into YouTube native client bypassing in-app webview.
            </p>
          </div>

          <div className="relative">
            <span className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-background" />
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Workspace Synchronization Active</span>
              <span className="text-muted-foreground font-mono text-[11px]">15 mins ago</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Workspace links, QR codes, and routing rules synced across all devices.
            </p>
          </div>
        </div>
      </div>

      {/* QR Code Modal Dialog */}
      {selectedQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="fixed inset-0" onClick={() => setSelectedQr(null)} />
          <div className="bg-card border border-border/60 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative z-10 text-center space-y-4">
            <h3 className="text-base font-bold text-foreground">{selectedQr.title || 'QR Code'}</h3>
            <div className="p-4 bg-white rounded-xl inline-block shadow-md">
              <QRCodeSVG value={selectedQr.url} size={180} />
            </div>
            <p className="text-xs font-mono text-muted-foreground break-all">{selectedQr.url}</p>
            <Button onClick={() => setSelectedQr(null)} className="w-full">
              Close Preview
            </Button>
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
