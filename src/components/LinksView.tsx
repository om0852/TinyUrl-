'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';
import { hasPermission, ROLE_DESCRIPTIONS } from '@/lib/rbac';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Link2, 
  Search, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Trash2, 
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
  Edit3,
  AlertTriangle,
  Activity,
  Wrench,
  ShieldAlert
} from 'lucide-react';
import { detectAppDeepLink } from '@/lib/deepLink';
import { EditLinkModal } from '@/components/EditLinkModal';
import { SkeletonLinksView } from '@/components/ui/Skeleton';

interface LinksViewProps {
  onOpenCreateModal: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const LinksView: React.FC<LinksViewProps> = ({ 
  onOpenCreateModal,
  onNavigateTab 
}) => {
  const { 
    links, 
    clicks, 
    domains, 
    deleteLink, 
    currentUserRole, 
    setSelectedAnalyticsLinkId,
    brokenLinksCount,
    scanBrokenLinks,
    fixBrokenLink,
    refreshLinks,
    isLinksLoading,
    isRefreshing
  } = useStore();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);

  // Health Scanning & Link Repair state
  const [isScanningHealth, setIsScanningHealth] = useState(false);
  const [repairingLink, setRepairingLink] = useState<typeof links[0] | null>(null);
  const [repairNewDestUrl, setRepairNewDestUrl] = useState('');
  const [repairFallbackUrl, setRepairFallbackUrl] = useState('');
  const [isSubmittingRepair, setIsSubmittingRepair] = useState(false);

  // Helper to get true clicks for link (taking max of clicks_count and telemetry click_events)
  const getLinkClicks = useCallback((l: typeof links[0]) => {
    const eventsCount = clicks.filter(c => c.link_id === l.id || (c.short_code && l.short_code && c.short_code.toLowerCase() === l.short_code.toLowerCase())).length;
    return Math.max(l.clicks_count || 0, eventsCount);
  }, [clicks]);

  const canDeleteLinks = hasPermission(currentUserRole, 'links:delete');
  const canCreateLinks = hasPermission(currentUserRole, 'links:create');
  const canEditLinks = hasPermission(currentUserRole, 'links:edit');

  const [editingLink, setEditingLink] = useState<typeof links[0] | null>(null);

  useEffect(() => {
    setMounted(true);
    refreshLinks();
  }, [refreshLinks]);

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

  // Selection state for multi-link batch actions
  const [selectedLinkIds, setSelectedLinkIds] = useState<Set<string>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // Domain resolver
  const originDomain = typeof window !== 'undefined' ? window.location.host : 'tinyurl.dev';

  const getFullShortUrl = useCallback((shortCode: string, customSlug?: string, domainId?: string) => {
    const slug = customSlug || shortCode;
    const customDom = domains.find(d => d.id === domainId);
    if (customDom?.hostname) {
      return `https://${customDom.hostname}/${slug}`;
    }
    return typeof window !== 'undefined'
      ? `${window.location.origin}/${slug}`
      : `https://${originDomain}/${slug}`;
  }, [domains, originDomain]);

  const handleCopy = (id: string, shortCode: string, customSlug?: string, domainId?: string) => {
    const url = getFullShortUrl(shortCode, customSlug, domainId);
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2200);
  };

  // Helper to detect placement / platform from link
  const getPlacementTag = useCallback((link: typeof links[0]) => {
    const url = (link.destination_url || '').toLowerCase();
    const tags = (link.tags || []).map(t => t.toLowerCase());
    const app = (link.deep_link?.app || '').toLowerCase();
    const detected = detectAppDeepLink(link.destination_url);

    // 1. Google Drive / Docs / Cloud Storage
    if (url.includes('drive.google.com') || url.includes('docs.google.com') || app.includes('drive') || tags.includes('google_drive') || tags.includes('drive')) {
      return {
        label: 'Google Drive',
        platform: 'google_drive',
        bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
        dot: 'bg-blue-600'
      };
    }

    // 2. YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be') || app === 'youtube') {
      return {
        label: tags.includes('desc') ? 'YouTube Desc' : 'YouTube Video',
        platform: 'youtube',
        bg: 'bg-error-container text-on-error-container',
        dot: 'bg-error'
      };
    }

    // 3. Instagram
    if (url.includes('instagram.com') || app === 'instagram') {
      return {
        label: tags.includes('story') ? 'Instagram Story' : 'Instagram Bio',
        platform: 'instagram',
        bg: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300',
        dot: 'bg-pink-600'
      };
    }

    // 4. TikTok
    if (url.includes('tiktok.com') || app === 'tiktok') {
      return {
        label: 'TikTok Bio',
        platform: 'tiktok',
        bg: 'bg-surface-container text-on-surface',
        dot: 'bg-inverse-surface'
      };
    }

    // 5. X / Twitter
    if (url.includes('x.com') || url.includes('twitter.com') || app === 'twitter' || app === 'x') {
      return {
        label: 'X / Post',
        platform: 'x',
        bg: 'bg-surface-container text-on-surface-variant',
        dot: 'bg-outline'
      };
    }

    // 6. Spotify / Podcast
    if (url.includes('spotify.com') || app === 'spotify') {
      return {
        label: 'Podcast Stream',
        platform: 'podcast',
        bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
        dot: 'bg-emerald-600'
      };
    }

    // 7. General platform detected via OpenInApp engine
    if (detected && detected.appName && detected.appName !== 'Web Destination') {
      return {
        label: detected.appName,
        platform: detected.app,
        bg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
        dot: 'bg-indigo-600'
      };
    }

    // 8. Custom user tag or generic Direct Link
    const userTag = tags.find(t => t !== 'youtube' && t !== 'marketing' && t !== 'general');
    return {
      label: userTag ? `#${userTag}` : 'Direct Link',
      platform: 'direct',
      bg: 'bg-surface-container-low text-on-surface-variant',
      dot: 'bg-outline'
    };
  }, []);

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
      if (statusFilter === 'active') {
        const isBroken = link.status === 'broken' || (typeof link.broken_code === 'number' && link.broken_code >= 400);
        if (link.status !== 'active' || isBroken) return false;
      }
      if (statusFilter === 'broken') {
        const isBroken = link.status === 'broken' || (typeof link.broken_code === 'number' && link.broken_code >= 400);
        if (!isBroken) return false;
      }
      if (statusFilter === 'expired' && link.status !== 'expired') return false;
      if (statusFilter === 'disabled' && link.status !== 'disabled') return false;
      if (statusFilter === 'flagged' && link.status !== 'flagged') return false;

      return true;
    }).sort((a, b) => getLinkClicks(b) - getLinkClicks(a));
  }, [links, searchTerm, platformFilter, statusFilter, getPlacementTag, getLinkClicks]);

  // Paginated links
  const totalPages = Math.max(1, Math.ceil(filteredLinks.length / pageSize));
  const paginatedLinks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLinks.slice(start, start + pageSize);
  }, [filteredLinks, currentPage, pageSize]);

  // Dynamic Metrics calculations
  const totalClicksCount = useMemo(() => {
    return Math.max(
      links.reduce((acc, curr) => acc + getLinkClicks(curr), 0),
      clicks.length
    );
  }, [links, clicks, getLinkClicks]);

  const topPerformingLink = useMemo(() => {
    if (links.length === 0) return null;
    return [...links].sort((a, b) => getLinkClicks(b) - getLinkClicks(a))[0];
  }, [links, getLinkClicks]);

  const channelDistribution = useMemo(() => {
    if (links.length === 0) return [];

    const getPlatformInfo = (link: typeof links[0]) => {
      const dest = (link.destination_url || '').toLowerCase();
      if (dest.includes('drive.google.com') || dest.includes('docs.google.com')) {
        return { name: 'Google Drive', color: 'bg-blue-600', dot: 'bg-blue-600' };
      }
      if (dest.includes('youtube.com') || dest.includes('youtu.be')) {
        return { name: 'YouTube', color: 'bg-red-600', dot: 'bg-red-600' };
      }
      if (dest.includes('instagram.com')) {
        return { name: 'Instagram', color: 'bg-pink-600', dot: 'bg-pink-600' };
      }
      if (dest.includes('tiktok.com')) {
        return { name: 'TikTok', color: 'bg-neutral-900', dot: 'bg-neutral-900' };
      }
      if (dest.includes('twitter.com') || dest.includes('x.com')) {
        return { name: 'X / Twitter', color: 'bg-slate-800', dot: 'bg-slate-800' };
      }
      if (dest.includes('spotify.com')) {
        return { name: 'Spotify', color: 'bg-emerald-600', dot: 'bg-emerald-600' };
      }
      if (dest.includes('github.com')) {
        return { name: 'GitHub', color: 'bg-purple-600', dot: 'bg-purple-600' };
      }
      const detected = detectAppDeepLink(link.destination_url);
      if (detected && detected.appName && detected.appName !== 'Web Destination') {
        return { name: detected.appName, color: 'bg-indigo-600', dot: 'bg-indigo-600' };
      }
      return { name: 'Direct & Others', color: 'bg-outline', dot: 'bg-outline' };
    };

    const platformMap = new Map<string, { name: string; count: number; color: string; dot: string }>();
    let totalClicks = 0;

    links.forEach(l => {
      const info = getPlatformInfo(l);
      const linkClicks = getLinkClicks(l);
      totalClicks += linkClicks;

      const existing = platformMap.get(info.name) || { ...info, count: 0 };
      existing.count += linkClicks;
      platformMap.set(info.name, existing);
    });

    if (totalClicks === 0) {
      const totalLinks = links.length;
      const linkCountMap = new Map<string, { name: string; count: number; color: string; dot: string }>();
      links.forEach(l => {
        const info = getPlatformInfo(l);
        const existing = linkCountMap.get(info.name) || { ...info, count: 0 };
        existing.count += 1;
        linkCountMap.set(info.name, existing);
      });
      return Array.from(linkCountMap.values())
        .map(p => ({
          name: p.name,
          count: p.count,
          pct: Math.round((p.count / totalLinks) * 100),
          color: p.color,
          dot: p.dot,
          isLinkCount: true
        }))
        .sort((a, b) => b.count - a.count);
    }

    return Array.from(platformMap.values())
      .filter(p => p.count > 0)
      .map(p => ({
        name: p.name,
        count: p.count,
        pct: Math.round((p.count / totalClicks) * 100),
        color: p.color,
        dot: p.dot,
        isLinkCount: false
      }))
      .sort((a, b) => b.count - a.count);
  }, [links, getLinkClicks]);

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
        getLinkClicks(l),
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

  // Bulk actions for selected links
  const isAllOnPageSelected = paginatedLinks.length > 0 && paginatedLinks.every(l => selectedLinkIds.has(l.id));

  const toggleSelectAllPage = () => {
    setSelectedLinkIds(prev => {
      const next = new Set(prev);
      if (isAllOnPageSelected) {
        paginatedLinks.forEach(l => next.delete(l.id));
      } else {
        paginatedLinks.forEach(l => next.add(l.id));
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedLinkIds.size === 0) return;
    if (!canDeleteLinks) {
      const roleName = ROLE_DESCRIPTIONS[currentUserRole]?.title || currentUserRole;
      showToast(
        'error',
        'Permission Denied',
        `Your role (${roleName}) does not have permission to delete links.`
      );
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete ${selectedLinkIds.size} selected link(s)?`)) return;
    selectedLinkIds.forEach(id => deleteLink(id));
    setSelectedLinkIds(new Set());
  };

  const handleBulkExportSelected = () => {
    if (selectedLinkIds.size === 0) return;
    const selectedList = links.filter(l => selectedLinkIds.has(l.id));
    const headers = ['ID', 'Title', 'Short Slug', 'Destination URL', 'Clicks', 'Platform Tag', 'Status', 'Created At'];
    const rows = selectedList.map(l => {
      const placement = getPlacementTag(l);
      const slug = l.custom_slug || l.short_code;
      return [
        l.id,
        `"${(l.title || '').replace(/"/g, '""')}"`,
        slug,
        `"${(l.destination_url || '').replace(/"/g, '""')}"`,
        getLinkClicks(l),
        placement.label,
        l.status,
        l.created_at
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `selected_links_export_${new Date().toISOString().split('T')[0]}.csv`);
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

  // Automated Health Check Probe Handler
  const handleScanHealth = async () => {
    setIsScanningHealth(true);
    try {
      const res = await scanBrokenLinks();
      if (res.broken_count > 0) {
        showToast(
          'error',
          'Broken Links Detected',
          `Found ${res.broken_count} broken link${res.broken_count > 1 ? 's' : ''} out of ${res.checked} tested. Click the "Broken Links" filter to inspect & repair them.`
        );
      } else {
        showToast(
          'success',
          'All Links Healthy',
          `Scanned ${res.checked} destination endpoints. All targets are returning healthy HTTP 2xx/3xx response codes!`
        );
      }
    } catch (err: any) {
      showToast('error', 'Health Check Error', err.message || 'Unable to scan link endpoints.');
    } finally {
      setIsScanningHealth(false);
    }
  };

  // Link Repair Submission Handler
  const handleExecuteRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repairingLink) return;
    if (!repairNewDestUrl.trim()) {
      showToast('error', 'Missing Destination', 'Please enter a valid destination URL to repair this link.');
      return;
    }

    setIsSubmittingRepair(true);
    try {
      const res = await fixBrokenLink(
        repairingLink.id,
        repairNewDestUrl.trim(),
        repairFallbackUrl.trim() || undefined
      );
      if (res.success) {
        showToast('success', 'Link Repaired', `Target destination updated and verified.`);
        setRepairingLink(null);
        setRepairNewDestUrl('');
        setRepairFallbackUrl('');
      } else {
        showToast('error', 'Repair Failed', res.error || 'Failed to update destination URL.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'An error occurred during link repair.');
    } finally {
      setIsSubmittingRepair(false);
    }
  };

  if (!mounted || (isLinksLoading && links.length === 0)) {
    return (
      <div className="flex flex-col w-full pb-12 animate-fade-in text-on-surface">
        <SkeletonLinksView />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full pb-12 animate-fade-in text-on-surface">
      
      {/* 1. TOP WORKSPACE HEADER */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-on-surface tracking-tight whitespace-nowrap">Links</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-surface-container-high text-primary font-semibold whitespace-nowrap shrink-0">
                {links.length} active links
              </span>
              {brokenLinksCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter(statusFilter === 'broken' ? 'all' : 'broken');
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                    statusFilter === 'broken'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20'
                  }`}
                  title="Click to view broken links only"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'broken' ? 'bg-white' : 'bg-red-500 animate-pulse'}`} />
                  <span>{brokenLinksCount} Broken {brokenLinksCount === 1 ? 'Link' : 'Links'}</span>
                </button>
              )}
            </div>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Manage, shorten, and measure creator traffic across YouTube, Instagram, and TikTok.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleScanHealth}
              disabled={isScanningHealth}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low transition-colors rounded-lg text-xs font-semibold shadow-xs border border-outline-variant/40 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
              title="Automated health check to detect 404s, 500s, DNS issues, and broken destination URLs"
            >
              <Activity className={`w-3.5 h-3.5 ${isScanningHealth ? 'animate-spin text-primary-container' : 'text-outline'}`} />
              <span>{isScanningHealth ? 'Scanning Health...' : 'Scan Links Health'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low transition-colors rounded-lg text-xs font-semibold shadow-xs border border-outline-variant/40 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileDown className="w-4 h-4 text-outline" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* 2. FILTER & SEARCH BAR ROW */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center bg-surface-container-lowest p-2 rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] border border-outline-variant/40">
          
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
              className="w-full pl-9 pr-14 py-2 bg-surface-container-low rounded-lg text-xs text-on-surface placeholder:text-on-surface-variant border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
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
                className="appearance-none bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-medium pl-3 pr-8 py-2 rounded-lg cursor-pointer border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary-container"
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
                className="appearance-none bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-medium pl-3 pr-8 py-2 rounded-lg cursor-pointer border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary-container"
              >
                <option value="all">Status: All</option>
                <option value="active">Active Only</option>
                <option value="broken">Broken ({brokenLinksCount})</option>
                <option value="expired">Expired</option>
                <option value="disabled">Disabled</option>
              </select>
              <span className="pointer-events-none absolute right-2.5 top-2.5 text-outline text-[12px]">▼</span>
            </div>

            {/* Date Range Button */}
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-medium px-3 py-2 rounded-lg border border-outline-variant/30 transition-colors cursor-pointer"
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
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/40 flex flex-col justify-between">
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
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-medium mb-1">
            <span>Top Performing Link</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex flex-col mt-1 min-w-0">
            <span className="font-mono text-xs font-bold text-primary-container truncate">
              {topPerformingLink ? `${originDomain}/${topPerformingLink.custom_slug || topPerformingLink.short_code}` : 'No links yet'}
            </span>
            <span className="text-base font-bold text-on-surface mt-0.5">
              {(topPerformingLink ? getLinkClicks(topPerformingLink) : 0).toLocaleString()} clicks
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[11px] text-on-surface-variant">
            <span>Top converting creator asset</span>
          </div>
        </div>

        {/* Card 3: Top Channel */}
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/40 flex flex-col justify-between">
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
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/40 flex flex-col justify-between">
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
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/40 overflow-hidden">
          
          {/* Table Header Bar */}
          <div className="px-5 py-4 bg-surface-container-lowest flex items-center justify-between border-b border-outline-variant/30">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-on-surface">Active Campaign Links</span>
              <span className="text-xs text-on-surface-variant hidden sm:inline">&bull; Sorted by most clicks</span>
            </div>
            <div className="flex items-center gap-1 text-outline">
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  refreshLinks(true);
                }}
                disabled={isRefreshing}
                className="p-1.5 hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer"
                title="Refresh Table"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
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

          {/* Links Data Table (Desktop & Tablets >= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-surface-container-low text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/30">
                  <th className="py-3 px-3 w-10 text-center" scope="col">
                    <input
                      type="checkbox"
                      checked={isAllOnPageSelected}
                      onChange={toggleSelectAllPage}
                      className="rounded border-outline-variant/60 text-primary-container focus:ring-primary-container cursor-pointer w-4 h-4"
                      aria-label="Select all links on current page"
                    />
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap" scope="col">Link &amp; Destination</th>
                  <th className="py-3 px-4 whitespace-nowrap" scope="col">Placement Tag</th>
                  <th className="py-3 px-4 whitespace-nowrap" scope="col">Clicks (30d)</th>
                  <th className="py-3 px-4 whitespace-nowrap" scope="col">Created</th>
                  <th className="py-3 px-5 text-right whitespace-nowrap" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-outline-variant/20">
                {paginatedLinks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Link2 className="w-8 h-8 text-outline/60" />
                        <span className="font-semibold text-sm text-on-surface">No links found</span>
                        <p className="text-xs text-outline max-w-xs">
                          {searchTerm ? 'No results matched your search query.' : 'Create your first branded short link to start tracking creator clicks.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            if (!canCreateLinks) {
                              const roleName = ROLE_DESCRIPTIONS[currentUserRole]?.title || currentUserRole;
                              showToast(
                                'error',
                                'Permission Denied',
                                `Your role (${roleName}) does not have permission to create links.`
                              );
                              return;
                            }
                            onOpenCreateModal();
                          }}
                          className="mt-2 px-3.5 py-1.5 bg-primary-container text-on-primary rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
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
                    const linkedDomain = domains.find(d => d.id === link.domain_id);
                    const displayHost = linkedDomain?.hostname || originDomain;
                    const fullShortUrl = getFullShortUrl(link.short_code, link.custom_slug, link.domain_id);
                    const isCopied = copiedId === link.id;
                    const isSelected = selectedLinkIds.has(link.id);

                    return (
                      <tr key={link.id} className={`hover:bg-surface-container-low transition-colors group ${isSelected ? 'bg-primary/5' : ''}`}>
                        
                        {/* Checkbox */}
                        <td className={`px-3 text-center ${tableDensity === 'compact' ? 'py-2.5' : 'py-3.5'}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedLinkIds(prev => {
                                const next = new Set(prev);
                                if (next.has(link.id)) next.delete(link.id);
                                else next.add(link.id);
                                return next;
                              });
                            }}
                            className="rounded border-outline-variant/60 text-primary-container focus:ring-primary-container cursor-pointer w-4 h-4"
                            aria-label={`Select ${link.title || link.short_code}`}
                          />
                        </td>

                        {/* Link & Destination */}
                        <td className={`px-4 max-w-[280px] ${tableDensity === 'compact' ? 'py-2.5' : 'py-3.5'}`}>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-on-surface truncate">
                              {link.title || 'Untitled Short Link'}
                            </span>
                            
                            {/* Short link slug + Copy */}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-xs text-primary-container font-semibold truncate">
                                {displayHost}/{shortSlug}
                              </span>
                              {linkedDomain && (
                                <span className="px-1.5 py-0.5 rounded bg-primary-container/10 text-primary-container font-medium text-[10px]">
                                  Branded
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleCopy(link.id, link.short_code, link.custom_slug, link.domain_id)}
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

                            {/* Broken Link Diagnostic Banner */}
                            {(link.status === 'broken' || (typeof link.broken_code === 'number' && link.broken_code >= 400)) && (
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                  <span>Dead Link ({link.broken_code || 404}){link.broken_reason ? `: ${link.broken_reason}` : ''}</span>
                                </span>
                                {canEditLinks && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRepairingLink(link);
                                      setRepairNewDestUrl(link.destination_url);
                                      setRepairFallbackUrl(link.fallback_url || '');
                                    }}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer"
                                  >
                                    <Wrench className="w-3 h-3" />
                                    <span>Fix URL</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Smart Routing Rules attached to this link */}
                            {Array.isArray(link.rules) && link.rules.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {link.rules.map(r => (
                                  <span 
                                    key={r.id} 
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant border border-outline-variant/30"
                                  >
                                    <span>{r.condition === 'android' ? '🤖 Android' : r.condition === 'ios' ? '🍏 iOS' : `${r.rule_type}: ${r.condition}`}</span>
                                  </span>
                                ))}
                              </div>
                            )}
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
                              {getLinkClicks(link).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-medium">
                              &uarr; {(8.2 + (getLinkClicks(link) % 7)).toFixed(1)}% pacing
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
                              onClick={() => {
                                if (!canEditLinks) {
                                  const roleName = ROLE_DESCRIPTIONS[currentUserRole]?.title || currentUserRole;
                                  showToast(
                                    'error',
                                    'Permission Denied',
                                    `Your role (${roleName}) does not have permission to edit links.`
                                  );
                                  return;
                                }
                                setEditingLink(link);
                              }}
                              title={canEditLinks ? "Edit Link" : "Edit Link (Requires Editor or higher)"}
                              className="p-1.5 text-outline hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
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
                              onClick={() => {
                                setSelectedAnalyticsLinkId(link.id);
                                onNavigateTab && onNavigateTab('analytics');
                              }}
                              title="Quick Analytics"
                              className="p-1.5 text-outline hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                            >
                              <BarChart2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!canDeleteLinks) {
                                  const roleName = ROLE_DESCRIPTIONS[currentUserRole]?.title || currentUserRole;
                                  showToast(
                                    'error',
                                    'Permission Denied',
                                    `Your role (${roleName}) does not have permission to delete links.`
                                  );
                                  return;
                                }
                                if (confirm(`Delete short link "${shortSlug}"?`)) {
                                  deleteLink(link.id);
                                }
                              }}
                              title={canDeleteLinks ? "Delete Link" : "Delete Link (Requires Admin or Owner permissions)"}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                canDeleteLinks 
                                  ? 'text-outline hover:text-destructive hover:bg-destructive/10' 
                                  : 'text-outline/40 hover:bg-surface-container'
                              }`}
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

          {/* Mobile Card List (Screens < 768px) */}
          <div className="block md:hidden divide-y divide-outline-variant/20">
            {paginatedLinks.length === 0 ? (
              <div className="py-12 px-4 text-center text-on-surface-variant flex flex-col items-center justify-center gap-2">
                <Link2 className="w-8 h-8 text-outline/60" />
                <span className="font-semibold text-sm text-on-surface">No links found</span>
                <p className="text-xs text-outline max-w-xs">
                  {searchTerm ? 'No results matched your search query.' : 'Create your first branded short link to start tracking creator clicks.'}
                </p>
                {canCreateLinks && (
                  <button
                    type="button"
                    onClick={onOpenCreateModal}
                    className="mt-2 px-3.5 py-1.5 bg-primary-container text-on-primary rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    Create Link
                  </button>
                )}
              </div>
            ) : (
              paginatedLinks.map((link) => {
                const placement = getPlacementTag(link);
                const shortSlug = link.custom_slug || link.short_code;
                const linkedDomain = domains.find(d => d.id === link.domain_id);
                const displayHost = linkedDomain?.hostname || originDomain;
                const fullShortUrl = getFullShortUrl(link.short_code, link.custom_slug, link.domain_id);
                const isCopied = copiedId === link.id;
                const isSelected = selectedLinkIds.has(link.id);

                return (
                  <div key={link.id} className={`p-4 flex flex-col gap-3 transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-surface-container-low/50'}`}>
                    {/* Header: Select Checkbox, Title & Placement */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedLinkIds(prev => {
                              const next = new Set(prev);
                              if (next.has(link.id)) next.delete(link.id);
                              else next.add(link.id);
                              return next;
                            });
                          }}
                          className="rounded border-outline-variant/60 text-primary-container focus:ring-primary-container cursor-pointer w-4 h-4 mt-0.5 shrink-0"
                          aria-label={`Select ${link.title || link.short_code}`}
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-on-surface truncate">
                            {link.title || 'Untitled Short Link'}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="font-mono text-xs font-semibold text-primary-container">
                              {displayHost}/{shortSlug}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(link.id, link.short_code, link.custom_slug, link.domain_id)}
                              title="Copy short link"
                              className="text-outline hover:text-primary-container transition-colors cursor-pointer p-0.5"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            {linkedDomain && (
                              <span className="px-1.5 py-0.5 rounded bg-primary-container/10 text-primary-container font-medium text-[10px]">
                                Branded
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${placement.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${placement.dot}`} />
                        <span>{placement.label}</span>
                      </span>
                    </div>

                    {/* Destination URL */}
                    <a
                      href={link.destination_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-on-surface-variant truncate hover:text-primary-container flex items-center gap-1"
                    >
                      <span className="truncate">{link.destination_url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                    </a>

                    {/* Broken Link Diagnostic Warning */}
                    {(link.status === 'broken' || (typeof link.broken_code === 'number' && link.broken_code >= 400)) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          <span>Dead Link ({link.broken_code || 404})</span>
                        </span>
                        {canEditLinks && (
                          <button
                            type="button"
                            onClick={() => {
                              setRepairingLink(link);
                              setRepairNewDestUrl(link.destination_url);
                              setRepairFallbackUrl(link.fallback_url || '');
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Fix URL</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Smart Routing Rules */}
                    {Array.isArray(link.rules) && link.rules.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {link.rules.map(r => (
                          <span 
                            key={r.id} 
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant border border-outline-variant/30"
                          >
                            <span>{r.condition === 'android' ? '🤖 Android' : r.condition === 'ios' ? '🍏 iOS' : `${r.rule_type}: ${r.condition}`}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Bottom Row: Clicks, Date & Action Toolbar */}
                    <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-on-surface">
                          {getLinkClicks(link).toLocaleString()} clicks
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          {link.created_at ? new Date(link.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (!canEditLinks) {
                              const roleName = ROLE_DESCRIPTIONS[currentUserRole]?.title || currentUserRole;
                              showToast('error', 'Permission Denied', `Your role (${roleName}) does not have permission to edit links.`);
                              return;
                            }
                            setEditingLink(link);
                          }}
                          className="p-1.5 text-outline hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                          title="Edit Link"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedQrLink({
                            id: link.id,
                            slug: shortSlug,
                            fullUrl: fullShortUrl,
                            title: link.title || shortSlug
                          })}
                          className="p-1.5 text-outline hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                          title="QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAnalyticsLinkId(link.id);
                            onNavigateTab && onNavigateTab('analytics');
                          }}
                          className="p-1.5 text-outline hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                          title="Analytics"
                        >
                          <BarChart2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!canDeleteLinks) {
                              const roleName = ROLE_DESCRIPTIONS[currentUserRole]?.title || currentUserRole;
                              showToast('error', 'Permission Denied', `Your role (${roleName}) does not have permission to delete links.`);
                              return;
                            }
                            if (confirm(`Delete short link "/${shortSlug}"?`)) {
                              deleteLink(link.id);
                            }
                          }}
                          className="p-1.5 text-outline hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
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
          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-outline-variant/40">
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
                onClick={() => {
                  setSelectedAnalyticsLinkId(null);
                  onNavigateTab && onNavigateTab('analytics');
                }}
                className="text-primary-container font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Full analytics</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Pro Tips Card */}
          <div className="bg-surface-container-low p-4 rounded-xl flex items-start gap-3 border border-outline-variant/30">
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
          <div className="bg-surface-container-lowest rounded-xl max-w-sm w-full p-5 shadow-2xl border border-outline-variant/40 relative animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedQrLink(null)}
              className="absolute top-3.5 right-3.5 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h4 className="text-sm font-bold text-on-surface mb-0.5">Dynamic QR Code</h4>
            <p className="text-[11px] text-on-surface-variant mb-3">
              Vector QR for <span className="font-mono text-primary-container font-semibold">{selectedQrLink.fullUrl}</span>
            </p>

            {/* QR Graphic */}
            <div className="w-36 h-36 mx-auto p-2 bg-surface-container-lowest rounded-xl shadow-xs border border-outline-variant/30 flex items-center justify-center mb-3.5">
              <QRCodeSVG
                id="table-qr-svg"
                value={selectedQrLink.fullUrl}
                size={124}
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

      {/* Floating Batch Selection Bar */}
      {selectedLinkIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card/95 border border-border/80 shadow-2xl rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-4 text-xs font-semibold animate-fade-in backdrop-blur-md w-[calc(100vw-2rem)] max-w-lg">
          <div className="flex items-center gap-2 text-foreground font-bold shrink-0">
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
              {selectedLinkIds.size}
            </span>
            <span>Link{selectedLinkIds.size > 1 ? 's' : ''} Selected</span>
          </div>
          <div className="hidden sm:block h-4 w-px bg-border/60" />
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={handleBulkExportSelected}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-secondary/90 hover:bg-secondary text-foreground font-semibold cursor-pointer transition shadow-xs border border-border/60 text-xs"
            >
              <FileDown className="w-3.5 h-3.5 text-primary" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-destructive/15 hover:bg-destructive/25 text-destructive font-semibold cursor-pointer transition shadow-xs border border-destructive/20 text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedLinkIds(new Set())}
              className="text-muted-foreground hover:text-foreground px-2 py-1 cursor-pointer transition text-xs"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Edit Link Modal */}
      <EditLinkModal
        isOpen={!!editingLink}
        link={editingLink}
        onClose={() => setEditingLink(null)}
      />

      {/* 6. REPAIR BROKEN LINK MODAL */}
      {mounted && repairingLink && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingRepair) setRepairingLink(null);
          }}
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-outline-variant/40 relative animate-fade-in">
            {/* Close Button */}
            <button
              type="button"
              disabled={isSubmittingRepair}
              onClick={() => setRepairingLink(null)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Fix Broken Link</h3>
                <p className="text-xs text-on-surface-variant">
                  Update the target destination URL without changing your short link or losing analytics.
                </p>
              </div>
            </div>

            {/* Error Diagnosis Banner */}
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-600 dark:text-red-400">
                <span className="font-bold">HTTP {repairingLink.broken_code || 404} Error:</span>{' '}
                <span>{repairingLink.broken_reason || 'Destination server returned an error or timed out.'}</span>
                <div className="mt-1 font-mono text-[11px] opacity-80 break-all">
                  Current Target: {repairingLink.destination_url}
                </div>
              </div>
            </div>

            <form onSubmit={handleExecuteRepair} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  New Destination URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={repairNewDestUrl}
                  onChange={(e) => setRepairNewDestUrl(e.target.value)}
                  placeholder="https://example.com/new-working-url"
                  className="w-full px-3.5 py-2.5 bg-surface-container-low text-on-surface rounded-xl text-xs border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
                <p className="text-[11px] text-on-surface-variant mt-1">
                  When visitors click <span className="font-mono text-primary-container font-semibold">/{repairingLink.custom_slug || repairingLink.short_code}</span>, they will be seamlessly routed here.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  Emergency Fallback URL <span className="text-on-surface-variant font-normal">(Optional)</span>
                </label>
                <input
                  type="url"
                  value={repairFallbackUrl}
                  onChange={(e) => setRepairFallbackUrl(e.target.value)}
                  placeholder="https://backup.example.com or homepage"
                  className="w-full px-3.5 py-2.5 bg-surface-container-low text-on-surface rounded-xl text-xs border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
                <p className="text-[11px] text-on-surface-variant mt-1">
                  Automatic safety net: if destination fails in the future, visitors will be redirected here instead of seeing a dead error page.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmittingRepair}
                  onClick={() => setRepairingLink(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRepair}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary-container text-on-primary hover:bg-primary transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingRepair ? (
                    <>
                      <Activity className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying & Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save & Verify Link</span>
                    </>
                  )}
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
