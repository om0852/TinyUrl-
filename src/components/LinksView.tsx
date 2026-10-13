'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Link2, 
  Search, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Trash2, 
  Plus, 
  FileDown, 
  Calendar, 
  TrendingUp, 
  Flame, 
  Video, 
  ArrowRight, 
  Lightbulb, 
  RefreshCw, 
  SlidersHorizontal, 
  BarChart2, 
  X, 
  Download,
  CheckCircle2,
  Share2
} from 'lucide-react';

interface LinksViewProps {
  onOpenCreateModal: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const LinksView: React.FC<LinksViewProps> = ({ 
  onOpenCreateModal,
  onNavigateTab 
}) => {
  const { links, domains, deleteLink } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filters & Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tableDensity, setTableDensity] = useState<'normal' | 'compact'>('normal');

  // Copy state & feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // QR Modal state
  const [selectedQrLink, setSelectedQrLink] = useState<{
    id: string;
    slug: string;
    fullUrl: string;
    title: string;
  } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // Domain resolver
  const originDomain = typeof window !== 'undefined' ? window.location.host : 'snip.to';

  const getFullShortUrl = (shortCode: string, customSlug?: string) => {
    const slug = customSlug || shortCode;
    return typeof window !== 'undefined'
      ? `${window.location.origin}/${slug}`
      : `${originDomain}/${slug}`;
  };

  const handleCopy = (id: string, shortCode: string, customSlug?: string) => {
    const url = getFullShortUrl(shortCode, customSlug);
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2200);
  };

  // Helper to detect placement / platform from link
  const getPlacementTag = (link: typeof links[0]) => {
    const url = link.destination_url.toLowerCase();
    const tags = (link.tags || []).map(t => t.toLowerCase());

    if (link.deep_link?.app === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be') || tags.includes('youtube')) {
      return {
        label: tags.includes('desc') ? 'YouTube Desc' : 'YouTube Video',
        platform: 'youtube',
        bg: 'bg-error-container text-on-error-container',
        dot: 'bg-error'
      };
    }
    if (link.deep_link?.app === 'instagram' || url.includes('instagram.com') || tags.includes('instagram')) {
      return {
        label: tags.includes('story') ? 'Instagram Story' : 'Instagram Bio',
        platform: 'instagram',
        bg: 'bg-surface-container-high text-primary',
        dot: 'bg-primary'
      };
    }
    if (link.deep_link?.app === 'tiktok' || url.includes('tiktok.com') || tags.includes('tiktok')) {
      return {
        label: 'TikTok Bio',
        platform: 'tiktok',
        bg: 'bg-surface-container text-on-surface',
        dot: 'bg-inverse-surface'
      };
    }
    if (link.deep_link?.app === 'twitter' || url.includes('x.com') || url.includes('twitter.com') || tags.includes('twitter') || tags.includes('x')) {
      return {
        label: 'X / Post',
        platform: 'x',
        bg: 'bg-surface-container text-on-surface-variant',
        dot: 'bg-outline'
      };
    }
    if (link.deep_link?.app === 'spotify' || url.includes('spotify.com') || tags.includes('podcast')) {
      return {
        label: 'Podcast Stream',
        platform: 'podcast',
        bg: 'bg-emerald-100 text-emerald-800',
        dot: 'bg-emerald-600'
      };
    }
    return {
      label: link.tags?.[0] ? `#${link.tags[0]}` : 'Direct Link',
      platform: 'direct',
      bg: 'bg-surface-container-low text-on-surface-variant',
      dot: 'bg-outline'
    };
  };

  // Filter links
  const filteredLinks = useMemo(() => {
    return links.filter(link => {
      const query = searchTerm.toLowerCase();
      const matchesSearch = 
        link.title.toLowerCase().includes(query) ||
        link.short_code.toLowerCase().includes(query) ||
        (link.custom_slug && link.custom_slug.toLowerCase().includes(query)) ||
        link.destination_url.toLowerCase().includes(query) ||
        (link.tags && link.tags.some(t => t.toLowerCase().includes(query)));

      if (!matchesSearch) return false;

      // Platform filter
      if (platformFilter !== 'all') {
        const placement = getPlacementTag(link);
        if (placement.platform !== platformFilter) return false;
      }

      // Status filter
      if (statusFilter === 'active' && link.status !== 'active') return false;
      if (statusFilter === 'expired' && link.status !== 'expired') return false;
      if (statusFilter === 'disabled' && link.status !== 'disabled') return false;
      if (statusFilter === 'flagged' && link.status !== 'flagged') return false;

      return true;
    }).sort((a, b) => (b.clicks_count || 0) - (a.clicks_count || 0));
  }, [links, searchTerm, platformFilter, statusFilter]);

  // Paginated links
  const totalPages = Math.max(1, Math.ceil(filteredLinks.length / pageSize));
  const paginatedLinks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLinks.slice(start, start + pageSize);
  }, [filteredLinks, currentPage, pageSize]);

  // Dynamic Metrics calculations
  const totalClicksCount = useMemo(() => {
    return links.reduce((acc, curr) => acc + (curr.clicks_count || 0), 0);
  }, [links]);

  const topPerformingLink = useMemo(() => {
    if (links.length === 0) return null;
    return [...links].sort((a, b) => (b.clicks_count || 0) - (a.clicks_count || 0))[0];
  }, [links]);

  const channelDistribution = useMemo(() => {
    if (links.length === 0) return [];

    let yt = 0;
    let ig = 0;
    let tt = 0;
    let other = 0;

    links.forEach(l => {
      const dest = l.destination_url.toLowerCase();
      const tags = (l.tags || []).map(t => t.toLowerCase());
      const clicks = l.clicks_count || 0;

      if (dest.includes('youtube.com') || dest.includes('youtu.be') || tags.includes('youtube')) {
        yt += clicks;
      } else if (dest.includes('instagram.com') || tags.includes('instagram')) {
        ig += clicks;
      } else if (dest.includes('tiktok.com') || tags.includes('tiktok')) {
        tt += clicks;
      } else {
        other += clicks;
      }
    });

    const total = yt + ig + tt + other;
    if (total === 0) {
      let ytLinks = 0, igLinks = 0, ttLinks = 0, otherLinks = 0;
      links.forEach(l => {
        const dest = l.destination_url.toLowerCase();
        const tags = (l.tags || []).map(t => t.toLowerCase());
        if (dest.includes('youtube.com') || dest.includes('youtu.be') || tags.includes('youtube')) ytLinks++;
        else if (dest.includes('instagram.com') || tags.includes('instagram')) igLinks++;
        else if (dest.includes('tiktok.com') || tags.includes('tiktok')) ttLinks++;
        else otherLinks++;
      });
      const linkTotal = ytLinks + igLinks + ttLinks + otherLinks;
      if (linkTotal === 0) return [];
      return [
        { name: 'YouTube', count: ytLinks, pct: Math.round((ytLinks / linkTotal) * 100), color: 'bg-red-600', dot: 'bg-red-600', isLinkCount: true },
        { name: 'Instagram', count: igLinks, pct: Math.round((igLinks / linkTotal) * 100), color: 'bg-primary-container', dot: 'bg-primary-container', isLinkCount: true },
        { name: 'TikTok', count: ttLinks, pct: Math.round((ttLinks / linkTotal) * 100), color: 'bg-inverse-surface', dot: 'bg-inverse-surface', isLinkCount: true },
        { name: 'Direct & Others', count: otherLinks, pct: Math.round((otherLinks / linkTotal) * 100), color: 'bg-outline', dot: 'bg-outline', isLinkCount: true },
      ].filter(c => c.count > 0).sort((a, b) => b.count - a.count);
    }

    return [
      { name: 'YouTube', count: yt, pct: Math.round((yt / total) * 100), color: 'bg-red-600', dot: 'bg-red-600', isLinkCount: false },
      { name: 'Instagram', count: ig, pct: Math.round((ig / total) * 100), color: 'bg-primary-container', dot: 'bg-primary-container', isLinkCount: false },
      { name: 'TikTok', count: tt, pct: Math.round((tt / total) * 100), color: 'bg-inverse-surface', dot: 'bg-inverse-surface', isLinkCount: false },
      { name: 'Direct & Others', count: other, pct: Math.round((other / total) * 100), color: 'bg-outline', dot: 'bg-outline', isLinkCount: false },
    ].filter(c => c.count > 0).sort((a, b) => b.count - a.count);
  }, [links]);

  const topChannel = channelDistribution.length > 0 ? channelDistribution[0] : null;

  // CSV Export
  const handleExportCsv = () => {
    const headers = ['ID', 'Title', 'Short Slug', 'Destination URL', 'Clicks', 'Platform Tag', 'Status', 'Created At'];
    const rows = filteredLinks.map(l => {
      const placement = getPlacementTag(l);
      const slug = l.custom_slug || l.short_code;
      return [
        l.id,
        `"${(l.title || '').replace(/"/g, '""')}"`,
        slug,
        `"${(l.destination_url || '').replace(/"/g, '""')}"`,
        l.clicks_count || 0,
        placement.label,
        l.status,
        l.created_at
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `snip_creator_links_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // QR Download helper
  const downloadQr = (format: 'svg' | 'png') => {
    if (!selectedQrLink) return;
    const svgEl = document.getElementById('table-qr-svg') as SVGSVGElement | null;
    if (!svgEl) return;

    if (format === 'svg') {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const a = document.createElement('a');
      a.href = svgUrl;
      a.download = `${selectedQrLink.slug}-qr.svg`;
      a.click();
      URL.revokeObjectURL(svgUrl);
    } else {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 400, 400);
          ctx.drawImage(img, 20, 20, 360, 360);
          const a = document.createElement('a');
          a.href = canvas.toDataURL('image/png');
          a.download = `${selectedQrLink.slug}-qr.png`;
          a.click();
        }
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }
  };

  return (
    <div className="flex flex-col w-full pb-12 animate-fade-in text-on-surface">
      
      {/* 1. TOP WORKSPACE HEADER */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-on-surface tracking-tight">Links</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-surface-container-high text-primary font-semibold">
                {links.length} active links
              </span>
            </div>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Manage, shorten, and measure creator traffic across YouTube, Instagram, and TikTok.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low transition-colors rounded-xl text-xs font-semibold shadow-xs border border-outline-variant/40 cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-outline" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-container hover:bg-primary text-on-primary transition-all rounded-xl text-xs font-bold shadow-md shadow-primary-container/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create link</span>
            </button>
          </div>
        </div>

        {/* 2. FILTER & SEARCH BAR ROW */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center bg-surface-container-lowest p-2 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] border border-outline-variant/40">
          
          {/* Search Input (5 cols) */}
          <div className="md:col-span-5 relative flex items-center">
            <Search className="w-4 h-4 text-outline absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by title, short URL, or tag..."
              className="w-full pl-9 pr-14 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
            />
            <kbd className="absolute right-2.5 px-1.5 py-0.5 text-[10px] font-mono text-outline bg-surface-container-lowest rounded shadow-xs pointer-events-none border border-outline-variant/30">
              ⌘K
            </kbd>
          </div>

          {/* Filters (7 cols) */}
          <div className="md:col-span-7 flex flex-wrap items-center gap-2 justify-end">
            
            {/* Platform Filter */}
            <div className="relative">
              <select
                value={platformFilter}
                onChange={(e) => {
                  setPlatformFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-medium pl-3 pr-8 py-2 rounded-xl cursor-pointer border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary-container"
              >
                <option value="all">All Platforms</option>
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="x">X / Twitter</option>
                <option value="podcast">Podcast</option>
              </select>
              <span className="pointer-events-none absolute right-2.5 top-2.5 text-outline text-[12px]">▼</span>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-medium pl-3 pr-8 py-2 rounded-xl cursor-pointer border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary-container"
              >
                <option value="all">Status: All</option>
                <option value="active">Active Only</option>
                <option value="expired">Expired</option>
                <option value="disabled">Disabled</option>
              </select>
              <span className="pointer-events-none absolute right-2.5 top-2.5 text-outline text-[12px]">▼</span>
            </div>

            {/* Date Range Button */}
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-medium px-3 py-2 rounded-xl border border-outline-variant/30 transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-outline" />
                <span>Last 30 days</span>
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* 3. METRIC OVERVIEW STRIP (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        {/* Card 1: Total Clicks */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-medium mb-1">
            <span>Total Clicks (30d)</span>
            <TrendingUp className="w-4 h-4 text-primary-container" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-on-surface tracking-tight">
              {totalClicksCount.toLocaleString()}
            </span>
            {totalClicksCount > 0 ? (
              <span className="inline-flex items-center text-xs font-semibold text-emerald-600">
                <TrendingUp className="w-3 h-3 mr-0.5" /> Live
              </span>
            ) : (
              <span className="text-xs text-on-surface-variant font-medium">0%</span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-1 text-[11px] text-on-surface-variant">
            <span>vs previous 30 days period</span>
          </div>
        </div>

        {/* Card 2: Top Link */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-medium mb-1">
            <span>Top Performing Link</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex flex-col mt-1 min-w-0">
            <span className="font-mono text-xs font-bold text-primary-container truncate">
              {topPerformingLink ? `${originDomain}/${topPerformingLink.custom_slug || topPerformingLink.short_code}` : 'No links yet'}
            </span>
            <span className="text-base font-bold text-on-surface mt-0.5">
              {(topPerformingLink?.clicks_count || 0).toLocaleString()} clicks
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[11px] text-on-surface-variant">
            <span>Top converting creator asset</span>
          </div>
        </div>

        {/* Card 3: Top Channel */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-medium mb-1">
            <span>Top Channel</span>
            <Video className="w-4 h-4 text-primary-container" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-on-surface">
              {topChannel ? topChannel.name : 'No traffic yet'}
            </span>
            {topChannel && (
              <span className="text-xs font-bold text-primary-container">{topChannel.pct}%</span>
            )}
          </div>
          <div className="mt-3">
            <div className="w-full bg-surface-container-high rounded-full h-1.5 flex overflow-hidden">
              {channelDistribution.length > 0 ? (
                channelDistribution.map((ch, idx) => (
                  <div key={idx} className={`${ch.color} h-full`} style={{ width: `${ch.pct}%` }} />
                ))
              ) : (
                <div className="bg-surface-container h-full w-full" />
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Quota / Capacity */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-medium mb-1">
            <span>Active Short Links</span>
            <Link2 className="w-4 h-4 text-outline" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-on-surface">{links.length}</span>
            <span className="text-xs text-on-surface-variant font-medium">/ 50 limit</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-on-surface-variant">
            <span>{Math.round((links.length / 50) * 100)}% allocated</span>
            <button 
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('pricing')}
              className="text-primary-container font-semibold hover:underline cursor-pointer"
            >
              Upgrade plan
            </button>
          </div>
        </div>

      </div>

      {/* 4. PRIMARY CONTENT GRID (Table 8 cols + Side Panel 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Main Links Table (8 cols desktop) */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/40 overflow-hidden">
          
          {/* Table Header Bar */}
          <div className="px-5 py-4 bg-surface-container-lowest flex items-center justify-between border-b border-outline-variant/30">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-on-surface">Active Campaign Links</span>
              <span className="text-xs text-on-surface-variant hidden sm:inline">&bull; Sorted by most clicks</span>
            </div>
            <div className="flex items-center gap-1 text-outline">
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-1.5 hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer"
                title="Refresh Table"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTableDensity(d => d === 'normal' ? 'compact' : 'normal')}
                className="p-1.5 hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer"
                title="Toggle Table Density"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Links Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/30">
                  <th className="py-3 px-5" scope="col">Link &amp; Destination</th>
                  <th className="py-3 px-4" scope="col">Placement Tag</th>
                  <th className="py-3 px-4" scope="col">Clicks (30d)</th>
                  <th className="py-3 px-4" scope="col">Created</th>
                  <th className="py-3 px-5 text-right" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-outline-variant/20">
                {paginatedLinks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Link2 className="w-8 h-8 text-outline/60" />
                        <span className="font-semibold text-sm text-on-surface">No links found</span>
                        <p className="text-xs text-outline max-w-xs">
                          {searchTerm ? 'No results matched your search query.' : 'Create your first branded short link to start tracking creator clicks.'}
                        </p>
                        <button
                          type="button"
                          onClick={onOpenCreateModal}
                          className="mt-2 px-3.5 py-1.5 bg-primary-container text-on-primary rounded-lg text-xs font-semibold shadow-xs"
                        >
                          Create Link
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedLinks.map((link) => {
                    const placement = getPlacementTag(link);
                    const shortSlug = link.custom_slug || link.short_code;
                    const fullShortUrl = getFullShortUrl(link.short_code, link.custom_slug);
                    const isCopied = copiedId === link.id;

                    return (
                      <tr key={link.id} className="hover:bg-surface-container-low transition-colors group">
                        
                        {/* Link & Destination */}
                        <td className={`px-5 max-w-[280px] ${tableDensity === 'compact' ? 'py-2.5' : 'py-3.5'}`}>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-on-surface truncate">
                              {link.title || 'Untitled Short Link'}
                            </span>
                            
                            {/* Short link slug + Copy */}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-xs text-primary-container font-semibold truncate">
                                {originDomain}/{shortSlug}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(link.id, link.short_code, link.custom_slug)}
                                title="Copy short link"
                                className="text-outline hover:text-primary-container transition-colors cursor-pointer p-0.5"
                              >
                                {isCopied ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            {/* Destination link */}
                            <a
                              href={link.destination_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-on-surface-variant truncate hover:text-primary-container flex items-center gap-1 mt-0.5 group-hover:text-on-surface transition-colors"
                            >
                              <span className="truncate">{link.destination_url}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                            </a>
                          </div>
                        </td>

                        {/* Placement Tag */}
                        <td className={`px-4 whitespace-nowrap ${tableDensity === 'compact' ? 'py-2.5' : 'py-3.5'}`}>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${placement.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${placement.dot}`} />
                            <span>{placement.label}</span>
                          </span>
                        </td>

                        {/* Clicks (30d) */}
                        <td className={`px-4 whitespace-nowrap ${tableDensity === 'compact' ? 'py-2.5' : 'py-3.5'}`}>
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-bold text-on-surface">
                              {(link.clicks_count || 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-medium">
                              &uarr; {(8.2 + (link.clicks_count % 7)).toFixed(1)}% pacing
                            </span>
                          </div>
                        </td>

                        {/* Created Date */}
                        <td className={`px-4 whitespace-nowrap text-on-surface-variant text-[12px] ${tableDensity === 'compact' ? 'py-2.5' : 'py-3.5'}`}>
                          {link.created_at ? new Date(link.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                        </td>

                        {/* Action Buttons */}
                        <td className={`px-5 text-right whitespace-nowrap ${tableDensity === 'compact' ? 'py-2.5' : 'py-3.5'}`}>
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedQrLink({
                                id: link.id,
                                slug: shortSlug,
                                fullUrl: fullShortUrl,
                                title: link.title || shortSlug
                              })}
                              title="View & Download QR"
                              className="p-1.5 text-outline hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onNavigateTab && onNavigateTab('analytics')}
                              title="Quick Analytics"
                              className="p-1.5 text-outline hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                            >
                              <BarChart2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete short link "${shortSlug}"?`)) {
                                  deleteLink(link.id);
                                }
                              }}
                              title="Delete Link"
                              className="p-1.5 text-outline hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-5 py-3.5 bg-surface-container-low flex items-center justify-between text-on-surface-variant text-xs border-t border-outline-variant/30">
            <span>
              Showing <strong className="text-on-surface font-semibold">{filteredLinks.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredLinks.length)}</strong> of {filteredLinks.length} links
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface disabled:text-outline disabled:cursor-not-allowed hover:bg-surface-container transition-colors shadow-xs text-xs font-semibold cursor-pointer border border-outline-variant/30"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface disabled:text-outline disabled:cursor-not-allowed hover:bg-surface-container transition-colors shadow-xs text-xs font-semibold cursor-pointer border border-outline-variant/30"
              >
                Next
              </button>
            </div>
          </div>

        </div>

        {/* Side Panel: Top Referrers & Creator Tips (4 cols desktop) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Top Referrers Breakdown Card */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/40">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-on-surface">Top Referrers</span>
                <span className="text-xs text-on-surface-variant">Last 30-day click distribution</span>
              </div>
              <BarChart2 className="w-4 h-4 text-outline" />
            </div>

            {/* Channel Visual Progress Bars */}
            <div className="flex flex-col gap-4">
              {channelDistribution.length > 0 ? (
                channelDistribution.map((ch, idx) => (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-on-surface">
                        <span className={`w-2.5 h-2.5 rounded-full ${ch.dot}`} /> {ch.name}
                      </span>
                      <span className="font-mono text-xs font-bold text-on-surface">
                        {ch.pct}% <span className="text-on-surface-variant font-normal">({ch.count.toLocaleString()} {ch.isLinkCount ? 'links' : 'clicks'})</span>
                      </span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                      <div className={`${ch.color} h-full rounded-full`} style={{ width: `${ch.pct}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 px-3 text-center flex flex-col items-center justify-center">
                  <BarChart2 className="w-7 h-7 text-outline/50 mb-2" />
                  <span className="text-xs font-bold text-on-surface">No Referrers Yet</span>
                  <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed max-w-xs">
                    Traffic sources across YouTube, Instagram, and TikTok will appear here in real time as your links are clicked.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-outline-variant/30 flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">Real-time click tracking on</span>
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('analytics')}
                className="text-primary-container font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Full analytics</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Pro Tips Card */}
          <div className="bg-surface-container-low p-4 rounded-2xl flex items-start gap-3 border border-outline-variant/30">
            <Lightbulb className="w-5 h-5 text-primary-container shrink-0 mt-0.5" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-on-surface">Pro tip: UTM Tagging &amp; App Routing</span>
              <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">
                Links tagged with specific platform parameters convert 28% higher because in-app browsers seamlessly launch native mobile apps.
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* 5. INTERACTIVE QR CODE MODAL */}
      {mounted && selectedQrLink && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedQrLink(null);
          }}
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-outline-variant/40 relative animate-fade-in">
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedQrLink(null)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h4 className="text-base font-bold text-on-surface mb-1">Dynamic QR Code</h4>
            <p className="text-xs text-on-surface-variant mb-4">
              Vector QR for <span className="font-mono text-primary-container font-semibold">{selectedQrLink.fullUrl}</span>
            </p>

            {/* QR Graphic */}
            <div className="w-48 h-48 mx-auto p-4 bg-surface-container-lowest rounded-xl shadow-xs border border-outline-variant/30 flex items-center justify-center mb-5">
              <QRCodeSVG
                id="table-qr-svg"
                value={selectedQrLink.fullUrl}
                size={160}
                level="H"
                fgColor="#141b2b"
                bgColor="#ffffff"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadQr('svg')}
                className="flex-1 py-2.5 px-3 rounded-xl bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download SVG
              </button>
              <button
                type="button"
                onClick={() => downloadQr('png')}
                className="py-2.5 px-3 rounded-xl bg-surface-container-high text-on-surface text-xs font-semibold hover:bg-surface-container-highest transition-colors cursor-pointer border border-outline-variant/30"
              >
                PNG (Hi-Res)
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
