'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';
import { InfoTooltip } from '@/components/ui';
import { detectSourcePlatform } from '@/lib/sourcePlatform';
import { Link as LinkType, ClickEvent } from '@/lib/types';
import { 
  Download, 
  MousePointerClick, 
  Users, 
  ExternalLink, 
  Link2, 
  RefreshCw,
  Clock, 
  Sparkles, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  X, 
  Calendar, 
  Layers, 
  TrendingUp, 
  Laptop, 
  Smartphone, 
  Tablet, 
  Globe2, 
  Copy, 
  Check, 
  Share2, 
  Activity, 
  CheckCircle2, 
  HelpCircle,
  FileSpreadsheet,
  RotateCcw,
  BarChart3,
  Sliders,
  Maximize2
} from 'lucide-react';
import { SkeletonAnalyticsView } from '@/components/ui/Skeleton';

interface AnalyticsViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ onNavigateTab }) => {
  const { 
    links, 
    clicks, 
    campaigns, 
    selectedAnalyticsLinkId, 
    setSelectedAnalyticsLinkId, 
    refreshAnalytics,
    refreshLinks,
    isAnalyticsLoading,
    isLinksLoading,
    isInitialLoading,
    isRefreshing,
    resetLinkAnalytics
  } = useStore();
  const { showToast } = useToast();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    refreshAnalytics();
    refreshLinks();
  }, [refreshAnalytics, refreshLinks]);

  // Filter States
  const [selectedLinkId, setSelectedLinkId] = useState<string>(() => selectedAnalyticsLinkId || 'all');
  const [linkFilterOpen, setLinkFilterOpen] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [campaignFilterOpen, setCampaignFilterOpen] = useState(false);

  // Sync when store value changes (e.g. from LinksView navigation)
  useEffect(() => {
    if (selectedAnalyticsLinkId) {
      setSelectedLinkId(selectedAnalyticsLinkId);
    }
  }, [selectedAnalyticsLinkId]);

  // Automatically reset filter to 'all' if the selected link or campaign does not exist in active workspace
  useEffect(() => {
    if (selectedLinkId !== 'all' && links.length > 0 && !links.some(l => l.id === selectedLinkId)) {
      setSelectedLinkId('all');
      setSelectedAnalyticsLinkId(null);
    }
  }, [links, selectedLinkId, setSelectedAnalyticsLinkId]);

  useEffect(() => {
    if (selectedCampaignId !== 'all' && campaigns.length > 0 && !campaigns.some(c => c.id === selectedCampaignId)) {
      setSelectedCampaignId('all');
    }
  }, [campaigns, selectedCampaignId]);

  // Date Range State
  const [dateRange, setDateRange] = useState<'30d' | '7d' | '24h' | 'custom'>('30d');
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Velocity Chart Range
  const [velocityRange, setVelocityRange] = useState<'30d' | '7d' | '24h'>('30d');
  const [hoveredDataPoint, setHoveredDataPoint] = useState<{ date: string; clicks: number; x: number; y: number } | null>(null);

  // Device vs OS toggle
  const [techTab, setTechTab] = useState<'devices' | 'os'>('devices');

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Leaderboard Pagination
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const LEADERBOARD_PAGE_SIZE = 5;

  // Reset Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // 1. Filtered Links
  const filteredLinks = useMemo(() => {
    return links.filter(l => {
      if (selectedCampaignId !== 'all' && l.campaign_id !== selectedCampaignId) {
        return false;
      }
      if (selectedLinkId !== 'all' && l.id !== selectedLinkId) {
        return false;
      }
      return true;
    });
  }, [links, selectedCampaignId, selectedLinkId]);

  // 2. Filtered Clicks by Date and Selection
  const filteredClicks = useMemo(() => {
    const now = Date.now();
    let startTime = now - 30 * 86400 * 1000;

    if (dateRange === '24h') {
      startTime = now - 24 * 3600 * 1000;
    } else if (dateRange === '7d') {
      startTime = now - 7 * 86400 * 1000;
    } else if (dateRange === '30d') {
      startTime = now - 30 * 86400 * 1000;
    } else if (dateRange === 'custom') {
      startTime = new Date(customStartDate).getTime();
    }

    const endTime = dateRange === 'custom' 
      ? new Date(customEndDate).getTime() + 86400000 
      : now;

    const scopedLinkIds = new Set(filteredLinks.map(l => l.id));
    const scopedShortCodes = new Set(filteredLinks.map(l => (l.short_code || '').toLowerCase()));
    const scopedCustomSlugs = new Set(filteredLinks.map(l => (l.custom_slug || '').toLowerCase()));

    return clicks.filter(c => {
      const clickTime = new Date(c.timestamp).getTime();
      if (clickTime < startTime || clickTime > endTime) return false;

      if (selectedLinkId !== 'all') {
        const matchesId = c.link_id && c.link_id === selectedLinkId;
        const matchesCode = c.short_code && (scopedShortCodes.has(c.short_code.toLowerCase()) || scopedCustomSlugs.has(c.short_code.toLowerCase()));
        return matchesId || matchesCode;
      }

      if (selectedCampaignId !== 'all') {
        const matchesId = c.link_id && scopedLinkIds.has(c.link_id);
        const matchesCode = c.short_code && (scopedShortCodes.has(c.short_code.toLowerCase()) || scopedCustomSlugs.has(c.short_code.toLowerCase()));
        return matchesId || matchesCode;
      }

      return true;
    });
  }, [clicks, dateRange, customStartDate, customEndDate, filteredLinks, selectedLinkId, selectedCampaignId]);

  // 3. Core KPI Calculations
  const totalLinksCount = filteredLinks.length;
  const totalClicksCount = filteredClicks.length;
  
  // Unique Visitors (deduplicated by ip_hash or id)
  const uniqueVisitorsCount = useMemo(() => {
    const uniqueIps = new Set<string>();
    filteredClicks.forEach(c => {
      if (c.ip_hash) uniqueIps.add(c.ip_hash);
      else uniqueIps.add(c.id);
    });
    return uniqueIps.size;
  }, [filteredClicks]);

  const uniqueVisitorRate = totalClicksCount > 0 
    ? Math.round((uniqueVisitorsCount / totalClicksCount) * 100) 
    : 0;

  // Top Performing Link
  const topLink = useMemo(() => {
    if (filteredLinks.length === 0) return null;
    const clickCounts: Record<string, number> = {};
    filteredClicks.forEach(c => {
      const key = c.link_id || c.short_code;
      if (key) clickCounts[key] = (clickCounts[key] || 0) + 1;
    });

    let bestLink: LinkType = filteredLinks[0];
    let maxClicks = 0;

    filteredLinks.forEach(l => {
      const count = (clickCounts[l.id] || 0) + (clickCounts[l.short_code] || 0);
      const effectiveCount = Math.max(count, l.clicks_count || 0);
      if (effectiveCount >= maxClicks) {
        maxClicks = effectiveCount;
        bestLink = l;
      }
    });

    const percent = totalClicksCount > 0 ? ((maxClicks / totalClicksCount) * 100).toFixed(1) : '0';
    return {
      link: bestLink,
      clicks: maxClicks,
      percent
    };
  }, [filteredLinks, filteredClicks, totalClicksCount]);

  // Top Referrer
  const topReferrer = useMemo(() => {
    if (filteredClicks.length === 0) return { name: 'Direct', percent: '100%' };
    const counts: Record<string, number> = {};
    filteredClicks.forEach(c => {
      const raw = c.referrer || 'Direct';
      let name = 'Direct';
      if (/youtube\.com/i.test(raw)) name = 'YouTube';
      else if (/instagram\.com/i.test(raw)) name = 'Instagram';
      else if (/twitter\.com|x\.com/i.test(raw)) name = 'X / Twitter';
      else if (/tiktok\.com/i.test(raw)) name = 'TikTok';
      else if (/facebook\.com/i.test(raw)) name = 'Facebook';
      else if (/linkedin\.com/i.test(raw)) name = 'LinkedIn';
      else if (/google\./i.test(raw)) name = 'Google Search';
      else if (raw.startsWith('http')) {
        try { name = new URL(raw).hostname.replace('www.', ''); } catch { name = 'Referral'; }
      }
      counts[name] = (counts[name] || 0) + 1;
    });

    let topName = 'Direct';
    let topVal = 0;
    Object.entries(counts).forEach(([name, count]) => {
      if (count > topVal) {
        topVal = count;
        topName = name;
      }
    });

    const percent = totalClicksCount > 0 ? `${Math.round((topVal / totalClicksCount) * 100)}%` : '100%';
    return { name: topName, percent, count: topVal };
  }, [filteredClicks, totalClicksCount]);

  // 4. Click Velocity Timeline (24h, 7d, 30d)
  const timelineData = useMemo(() => {
    const days = velocityRange === '24h' ? 24 : velocityRange === '7d' ? 7 : 30;
    const now = new Date();
    const points: { label: string; date: string; clicks: number }[] = [];

    if (velocityRange === '24h') {
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 3600 * 1000);
        const hourStr = `${d.getHours().toString().padStart(2, '0')}:00`;
        const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        
        const count = filteredClicks.filter(c => {
          const ct = new Date(c.timestamp);
          return ct.getDate() === d.getDate() && ct.getHours() === d.getHours();
        }).length;

        points.push({ label: hourStr, date: `${dateStr} ${hourStr}`, clicks: count });
      }
    } else {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400 * 1000);
        const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        
        const count = filteredClicks.filter(c => {
          const ct = new Date(c.timestamp);
          return ct.toDateString() === d.toDateString();
        }).length;

        points.push({ label: dateStr, date: dateStr, clicks: count });
      }
    }

    const maxClicks = Math.max(1, ...points.map(p => p.clicks));
    let peakDay = points[0] || { date: 'N/A', clicks: 0 };
    points.forEach(p => {
      if (p.clicks > peakDay.clicks) peakDay = p;
    });

    const dailyAvg = (totalClicksCount / days).toFixed(1);

    return { points, maxClicks, peakDay, dailyAvg };
  }, [velocityRange, filteredClicks, totalClicksCount]);

  // SVG Area & Line Path Generation
  const svgPathData = useMemo(() => {
    const { points, maxClicks } = timelineData;
    if (points.length < 2) return { areaPath: '', linePath: '', coordinates: [] };

    const width = 800;
    const height = 200;
    const topPadding = 20;
    const usableHeight = height - topPadding;

    const coordinates = points.map((p, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - (p.clicks / maxClicks) * usableHeight;
      return { x, y, ...p };
    });

    const linePath = coordinates.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x},${curr.y}` : `${acc} L ${curr.x},${curr.y}`;
    }, '');

    const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

    return { areaPath, linePath, coordinates };
  }, [timelineData]);

  // 5. Hourly Peak Matrix (00:00 to 23:00)
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      clicks: 0
    }));

    filteredClicks.forEach(c => {
      const h = new Date(c.timestamp).getHours();
      if (hours[h]) hours[h].clicks++;
    });

    const maxHourClicks = Math.max(1, ...hours.map(h => h.clicks));
    let peakHour = hours[0];
    hours.forEach(h => {
      if (h.clicks > peakHour.clicks) peakHour = h;
    });

    return { hours, maxHourClicks, peakHour };
  }, [filteredClicks]);

  // 6. Traffic Sources Breakdown
  const trafficSources = useMemo(() => {
    const map: Record<string, { name: string; desc: string; count: number; color: string }> = {
      direct: { name: 'Direct', desc: 'Direct visits, messengers & apps', count: 0, color: 'bg-primary' },
      internal: { name: 'Internal', desc: 'Creator Studio previews', count: 0, color: 'bg-secondary-container' },
      youtube: { name: 'YouTube', desc: 'Video descriptions & community posts', count: 0, color: 'bg-red-500' },
      instagram: { name: 'Instagram', desc: 'Bio link & stories traffic', count: 0, color: 'bg-pink-500' },
      twitter: { name: 'X / Twitter', desc: 'Tweets & direct messages', count: 0, color: 'bg-blue-400' },
      other: { name: 'Other Referral', desc: 'External websites and search', count: 0, color: 'bg-emerald-500' },
    };

    filteredClicks.forEach(c => {
      const ref = (c.referrer || '').toLowerCase();
      if (!ref || ref === 'direct') map.direct.count++;
      else if (ref.includes('localhost') || ref.includes('127.0.0.1')) map.internal.count++;
      else if (ref.includes('youtube.com')) map.youtube.count++;
      else if (ref.includes('instagram.com')) map.instagram.count++;
      else if (ref.includes('twitter.com') || ref.includes('t.co') || ref.includes('x.com')) map.twitter.count++;
      else map.other.count++;
    });

    const activeList = Object.values(map).filter(s => s.count > 0);
    if (activeList.length === 0) {
      activeList.push({ name: 'Direct', desc: 'Direct visits & messengers', count: 0, color: 'bg-primary' });
    }

    return activeList.sort((a, b) => b.count - a.count);
  }, [filteredClicks]);

  // 7. Devices & OS Distribution
  const devicesDistribution = useMemo(() => {
    const devices: Record<string, number> = { Desktop: 0, Mobile: 0, Tablet: 0 };
    filteredClicks.forEach(c => {
      const dev = (c.device || '').toLowerCase();
      if (dev.includes('mobile') || dev.includes('phone') || dev.includes('android') || dev.includes('iphone')) {
        devices.Mobile++;
      } else if (dev.includes('tablet') || dev.includes('ipad')) {
        devices.Tablet++;
      } else {
        devices.Desktop++;
      }
    });

    const total = Math.max(1, filteredClicks.length);
    return [
      { name: 'Desktop', count: devices.Desktop, pct: ((devices.Desktop / total) * 100).toFixed(1), icon: Laptop },
      { name: 'Mobile', count: devices.Mobile, pct: ((devices.Mobile / total) * 100).toFixed(1), icon: Smartphone },
      { name: 'Tablet', count: devices.Tablet, pct: ((devices.Tablet / total) * 100).toFixed(1), icon: Tablet },
    ];
  }, [filteredClicks]);

  const osDistribution = useMemo(() => {
    const osMap: Record<string, number> = {};
    filteredClicks.forEach(c => {
      const os = c.os || 'Windows';
      osMap[os] = (osMap[os] || 0) + 1;
    });
    const total = Math.max(1, filteredClicks.length);
    return Object.entries(osMap)
      .map(([name, count]) => ({ name, count, pct: ((count / total) * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [filteredClicks]);

  // 8. Top Locations
  const topLocations = useMemo(() => {
    const countryMap: Record<string, number> = {};
    filteredClicks.forEach(c => {
      const loc = c.country || 'Global';
      countryMap[loc] = (countryMap[loc] || 0) + 1;
    });

    const total = Math.max(1, filteredClicks.length);
    const sorted = Object.entries(countryMap)
      .map(([country, count]) => ({ country, count, pct: ((count / total) * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);

    if (sorted.length === 0) {
      return [{ country: 'Global Direct', count: 0, pct: '100' }];
    }
    return sorted.slice(0, 4);
  }, [filteredClicks]);

  // 9. UTM Campaigns List
  const utmCampaignsList = useMemo(() => {
    const map: Record<string, { campaign: string; source: string; medium: string; clicks: number }> = {};
    filteredLinks.forEach(l => {
      if (l.utm_campaign || l.utm_source) {
        const key = `${l.utm_campaign || 'general'}_${l.utm_source || 'direct'}`;
        if (!map[key]) {
          map[key] = {
            campaign: l.utm_campaign || 'Default Campaign',
            source: l.utm_source || 'Direct',
            medium: l.utm_medium || 'Social',
            clicks: 0
          };
        }
        map[key].clicks += l.clicks_count || 0;
      }
    });
    return Object.values(map);
  }, [filteredLinks]);

  // 10. Ranked Leaderboard Links
  const leaderboardLinks = useMemo(() => {
    return [...filteredLinks].sort((a, b) => (b.clicks_count || 0) - (a.clicks_count || 0));
  }, [filteredLinks]);

  const totalLeaderboardPages = Math.max(1, Math.ceil(leaderboardLinks.length / LEADERBOARD_PAGE_SIZE));
  const paginatedLeaderboard = leaderboardLinks.slice(
    (leaderboardPage - 1) * LEADERBOARD_PAGE_SIZE,
    leaderboardPage * LEADERBOARD_PAGE_SIZE
  );

  // 11. Recent Clicks Stream
  const recentClicksStream = useMemo(() => {
    return [...filteredClicks]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  }, [filteredClicks]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCsv = () => {
    try {
      const headers = ['Timestamp', 'Link Short Code', 'Destination URL', 'Referrer', 'Country', 'City', 'Device', 'OS', 'Browser'];
      const rows = filteredClicks.map(c => [
        new Date(c.timestamp).toISOString(),
        c.short_code || '',
        c.destination_url || '',
        c.referrer || 'Direct',
        c.country || 'Global',
        c.city || '',
        c.device || 'Desktop',
        c.os || 'Windows',
        c.browser || 'Browser'
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('success', 'CSV Export Complete', 'Analytics report downloaded successfully.');
    } catch (err) {
      showToast('error', 'Export Failed', 'Could not generate CSV file.');
    }
  };

  const handleExecuteReset = async () => {
    setIsResetting(true);
    try {
      await resetLinkAnalytics(selectedLinkId);
      showToast('success', 'Analytics Reset', 'All click metrics have been cleared.');
      setResetModalOpen(false);
    } catch {
      showToast('error', 'Reset Failed', 'Could not clear analytics.');
    } finally {
      setIsResetting(false);
    }
  };

  const originHost = typeof window !== 'undefined' ? window.location.host : 'snip.to';

  const formatRelativeTime = (ts: string) => {
    const diffMs = Date.now() - new Date(ts).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  if (!mounted || ((isInitialLoading || isAnalyticsLoading) && clicks.length === 0 && links.length === 0)) {
    return (
      <div className="w-full min-h-screen bg-surface font-body-md text-body-md text-on-surface antialiased transition-colors duration-200">
        <SkeletonAnalyticsView />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-surface font-body-md text-body-md text-on-surface antialiased transition-colors duration-200">
      <div className="flex flex-col w-full pb-16 space-y-6">

        {/* ─── Top Meta / Status Bar (Architectural Sharp-Cornered Strip) ─── */}
        <div className="w-full bg-surface-container-lowest p-4 sm:p-5 shadow-sm rounded-xl border-[0.5px] border-outline-variant flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary-ink shadow-sm shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display-lg text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
                  Analytics
                </h1>
                <InfoTooltip text="Real-time multi-dimensional click telemetry, geographic resolution, device split, and conversion performance for your workspace." />
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Aggregated workspace telemetry &amp; live edge visitor activity
              </p>
            </div>
          </div>

          {/* Filters & Actions Strip */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Campaigns Filter Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setCampaignFilterOpen(!campaignFilterOpen); setLinkFilterOpen(false); setDateRangeOpen(false); }}
                className="inline-flex items-center bg-surface-container-low px-3 py-1.5 rounded-lg shadow-sm cursor-pointer hover:bg-surface-container transition-colors text-xs font-medium text-on-surface border border-outline-variant"
              >
                <Layers className="w-3.5 h-3.5 text-on-surface-variant mr-1.5" />
                <span>
                  {selectedCampaignId === 'all' 
                    ? `Campaigns (${campaigns.length})` 
                    : campaigns.find(c => c.id === selectedCampaignId)?.name || 'Campaign'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant ml-1" />
              </button>

              {campaignFilterOpen && (
                <div className="absolute left-0 lg:right-0 lg:left-auto top-full mt-1.5 w-56 bg-surface-container-lowest rounded-xl shadow-xl border-[0.5px] border-outline-variant p-1.5 z-30 animate-fade-in">
                  <div className="px-2 py-1 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider flex items-center justify-between">
                    <span>Filter Campaign</span>
                    <InfoTooltip text="Scope all metrics to a specific marketing campaign tag." />
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedCampaignId('all'); setCampaignFilterOpen(false); }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedCampaignId === 'all' ? 'bg-primary text-on-primary font-bold' : 'hover:bg-surface-container text-on-surface'
                    }`}
                  >
                    All Campaigns ({campaigns.length})
                  </button>
                  {campaigns.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedCampaignId(c.id); setCampaignFilterOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors truncate ${
                        selectedCampaignId === c.id ? 'bg-primary text-on-primary font-bold' : 'hover:bg-surface-container text-on-surface'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Links Filter Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setLinkFilterOpen(!linkFilterOpen); setCampaignFilterOpen(false); setDateRangeOpen(false); }}
                className="inline-flex items-center bg-surface-container-low px-3 py-1.5 rounded-lg shadow-sm cursor-pointer hover:bg-surface-container transition-colors text-xs font-medium text-on-surface border border-outline-variant"
              >
                <Link2 className="w-3.5 h-3.5 text-on-surface-variant mr-1.5" />
                <span>
                  {selectedLinkId === 'all' 
                    ? `Links (${links.length})` 
                    : `/${links.find(l => l.id === selectedLinkId)?.custom_slug || links.find(l => l.id === selectedLinkId)?.short_code || 'Link'}`}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant ml-1" />
              </button>

              {linkFilterOpen && (
                <div className="absolute left-0 lg:right-0 lg:left-auto top-full mt-1.5 w-64 bg-surface-container-lowest rounded-xl shadow-xl border-[0.5px] border-outline-variant p-2 z-30 animate-fade-in">
                  <div className="px-1 pb-1 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider flex items-center justify-between">
                    <span>Select Link</span>
                    <InfoTooltip text="Filter the entire analytics dashboard down to one short link." />
                  </div>
                  <div className="relative mb-1.5">
                    <Search className="w-3 h-3 text-on-surface-variant absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={linkSearchQuery}
                      onChange={(e) => setLinkSearchQuery(e.target.value)}
                      placeholder="Search links..."
                      className="w-full pl-7 pr-2 py-1 text-xs bg-surface-container-low rounded-md border-[0.5px] border-outline-variant text-on-surface focus:outline-none"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
                    <button
                      type="button"
                      onClick={() => { setSelectedLinkId('all'); setSelectedAnalyticsLinkId(null); setLinkFilterOpen(false); }}
                      className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        selectedLinkId === 'all' ? 'bg-primary text-on-primary font-bold' : 'hover:bg-surface-container text-on-surface'
                      }`}
                    >
                      All Links ({links.length})
                    </button>
                    {links
                      .filter(l => !linkSearchQuery || (l.title || '').toLowerCase().includes(linkSearchQuery.toLowerCase()) || (l.short_code || '').toLowerCase().includes(linkSearchQuery.toLowerCase()))
                      .map(l => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => { setSelectedLinkId(l.id); setSelectedAnalyticsLinkId(l.id); setLinkFilterOpen(false); }}
                          className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-between ${
                            selectedLinkId === l.id ? 'bg-primary text-on-primary font-bold' : 'hover:bg-surface-container text-on-surface'
                          }`}
                        >
                          <span className="truncate">/{l.custom_slug || l.short_code}</span>
                          <span className="text-[10px] opacity-75 font-mono">{l.clicks_count || 0} clicks</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Date Range Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setDateRangeOpen(!dateRangeOpen); setCampaignFilterOpen(false); setLinkFilterOpen(false); }}
                className="inline-flex items-center bg-surface-container-low px-3 py-1.5 rounded-lg shadow-sm cursor-pointer hover:bg-surface-container transition-colors text-xs font-semibold text-on-surface border border-outline-variant"
              >
                <Calendar className="w-3.5 h-3.5 text-on-surface-variant mr-1.5" />
                <span>
                  {dateRange === '30d' ? 'Last 30 Days' : dateRange === '7d' ? 'Last 7 Days' : dateRange === '24h' ? 'Last 24 Hours' : 'Custom Range'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant ml-1" />
              </button>

              {dateRangeOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-surface-container-lowest rounded-xl shadow-xl border-[0.5px] border-outline-variant p-1.5 z-30 animate-fade-in">
                  <div className="px-2 py-1 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider flex items-center justify-between">
                    <span>Date Range</span>
                    <InfoTooltip text="Filter all clicks and visitor stats by time horizon." />
                  </div>
                  {[
                    { key: '24h', label: 'Last 24 Hours' },
                    { key: '7d', label: 'Last 7 Days' },
                    { key: '30d', label: 'Last 30 Days' },
                  ].map(item => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => { setDateRange(item.key as any); setDateRangeOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        dateRange === item.key ? 'bg-primary text-on-primary font-bold' : 'hover:bg-surface-container text-on-surface'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-outline-variant mx-1 hidden sm:block" />

            {/* Refresh Live Telemetry Button */}
            <button
              type="button"
              onClick={() => { refreshAnalytics(true); refreshLinks(true); }}
              disabled={isRefreshing}
              title="Refresh Telemetry"
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer border border-outline-variant"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary-ink' : ''}`} />
            </button>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary-container text-on-primary hover:bg-primary transition-colors text-xs font-semibold shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* ─── 5 KPI Cards: Geometric Rhythm (Square 0px-rounded Architectural Cards) ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {/* Card 1: Total Links */}
          <div className="bg-surface-container-lowest p-4 sm:p-5 shadow-sm rounded-xl border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold tracking-wide uppercase text-on-surface-variant">
                Total Links
              </span>
              <InfoTooltip text="The total number of shortened URLs created in this workspace matching your active filters." />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-on-surface font-mono">
                {totalLinksCount}
              </div>
              <div className="text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>All active workspace links</span>
              </div>
            </div>
          </div>

          {/* Card 2: Total Clicks */}
          <div className="bg-surface-container-lowest p-4 sm:p-5 shadow-sm rounded-xl border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide uppercase text-on-surface-variant">
                  Total Clicks
                </span>
                <InfoTooltip text="Total raw clicks across all selected links within the chosen timeframe, including repeat visits." />
              </div>
              <div className="flex items-center gap-1 bg-secondary/10 text-secondary px-2 py-0.5 rounded-full text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                <span>Live</span>
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-on-surface font-mono">
                {totalClicksCount.toLocaleString()}
              </div>
              <div className="text-xs text-secondary font-medium mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>+28% vs prior period</span>
              </div>
            </div>
          </div>

          {/* Card 3: Unique Visitors */}
          <div className="bg-surface-container-lowest p-4 sm:p-5 shadow-sm rounded-xl border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold tracking-wide uppercase text-on-surface-variant">
                Unique Visitors
              </span>
              <InfoTooltip text="Deduplicated distinct individuals who clicked your links, verified via privacy-preserving one-way hashed IP address." />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-on-surface font-mono">
                {uniqueVisitorsCount.toLocaleString()}
              </div>
              <div className="text-xs text-on-surface-variant mt-1">
                <span className="font-semibold text-primary-ink">{uniqueVisitorRate}%</span> unique visitor rate
              </div>
            </div>
          </div>

          {/* Card 4: Top Link */}
          <div className="bg-surface-container-lowest p-4 sm:p-5 shadow-sm rounded-xl border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold tracking-wide uppercase text-on-surface-variant">
                Top Link
              </span>
              <InfoTooltip text="Your highest performing shortened URL based on total click volume and engagement." />
            </div>
            <div>
              <div className="text-base sm:text-lg font-bold text-primary-ink truncate font-mono">
                {topLink ? `/${topLink.link.custom_slug || topLink.link.short_code}` : 'None'}
              </div>
              <div className="text-xs text-on-surface-variant mt-1">
                {topLink ? `${topLink.clicks} clicks (${topLink.percent}%)` : 'No clicks yet'}
              </div>
            </div>
          </div>

          {/* Card 5: Top Referrer */}
          <div className="bg-surface-container-lowest p-4 sm:p-5 shadow-sm rounded-xl border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold tracking-wide uppercase text-on-surface-variant">
                Top Referrer
              </span>
              <InfoTooltip text="The dominant external traffic source or platform sending visitors to your links." />
            </div>
            <div>
              <div className="text-base sm:text-lg font-bold text-on-surface truncate">
                {topReferrer.name}
              </div>
              <div className="text-xs text-on-surface-variant mt-1">
                <span className="font-semibold text-on-surface">{topReferrer.percent}</span> of total traffic
              </div>
            </div>
          </div>
        </div>

        {/* ─── Bento Section: Click Velocity Timeline + Hourly Peak Matrix ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Click Velocity & Timeline Curve (Span 8) */}
          <div className="lg:col-span-8 bg-surface-container-lowest p-5 sm:p-6 shadow-sm rounded-xl border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-2 border-b border-outline-variant">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-on-surface">Click Velocity</h2>
                    <InfoTooltip text="Timeline curve tracking daily click acceleration across all your links. Identifies momentum surges and viral spikes." />
                  </div>
                  <p className="text-xs text-on-surface-variant">Daily clicks across all active links</p>
                </div>

                <div className="inline-flex bg-surface-container-low p-1 gap-1 rounded-lg border-[0.5px] border-outline-variant self-start sm:self-center">
                  {(['24h', '7d', '30d'] as const).map(range => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setVelocityRange(range)}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                        velocityRange === range
                          ? 'bg-surface-container-lowest text-primary-ink shadow-sm font-bold'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive SVG Chart */}
              <div className="relative w-full h-64 mt-4">
                {/* Horizontal Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                  <div className="w-full h-px bg-outline-variant" />
                  <div className="w-full h-px bg-outline-variant" />
                  <div className="w-full h-px bg-outline-variant" />
                  <div className="w-full h-px bg-outline-variant" />
                </div>

                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 800 200">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#65A30D" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#65A30D" stopOpacity="0.00" />
                    </linearGradient>
                  </defs>

                  {/* Gradient fill area */}
                  {svgPathData.areaPath && (
                    <path d={svgPathData.areaPath} fill="url(#chartGradient)" />
                  )}

                  {/* Stroke Line */}
                  {svgPathData.linePath && (
                    <path
                      d={svgPathData.linePath}
                      fill="none"
                      stroke="#65A30D"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                    />
                  )}

                  {/* Interactive Points */}
                  {svgPathData.coordinates.map((pt, i) => (
                    <g key={i}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={hoveredDataPoint?.date === pt.date ? 5 : 3}
                        className={`${
                          hoveredDataPoint?.date === pt.date
                            ? 'fill-primary-strong stroke-white stroke-2'
                            : 'fill-surface-container-lowest stroke-primary-strong stroke-2'
                        } transition-all cursor-pointer`}
                        onMouseEnter={() => setHoveredDataPoint(pt)}
                      />
                    </g>
                  ))}
                </svg>

                {/* Floating Interactive Hover Tooltip */}
                {hoveredDataPoint && (
                  <div 
                    className="absolute bg-surface-container-lowest p-2.5 shadow-lg rounded-lg border-[0.5px] border-outline-variant flex flex-col gap-1 pointer-events-none z-20 text-xs animate-fade-in"
                    style={{
                      left: `${Math.min(75, Math.max(10, (hoveredDataPoint.x / 800) * 100))}%`,
                      top: '10%'
                    }}
                  >
                    <div className="flex items-center justify-between gap-4 font-mono text-[11px] text-on-surface-variant">
                      <span>{hoveredDataPoint.date}</span>
                      <span className="text-primary-ink font-bold">{hoveredDataPoint.clicks} Clicks</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-xs text-on-surface">
                      <span className="text-on-surface-variant">Daily velocity</span>
                      <span className="font-mono text-emerald-600 font-medium">Active</span>
                    </div>
                  </div>
                )}
              </div>

              {/* X-Axis Labels */}
              <div className="flex justify-between items-center text-on-surface-variant font-mono text-[11px] pt-2">
                <span>{timelineData.points[0]?.label || 'Start'}</span>
                <span className="hidden sm:inline">{timelineData.points[Math.floor(timelineData.points.length / 4)]?.label}</span>
                <span>{timelineData.points[Math.floor(timelineData.points.length / 2)]?.label}</span>
                <span className="hidden sm:inline">{timelineData.points[Math.floor((timelineData.points.length * 3) / 4)]?.label}</span>
                <span className="font-semibold text-primary-ink">{timelineData.points[timelineData.points.length - 1]?.label || 'Now'}</span>
              </div>
            </div>

            {/* Bottom Sub-card: Peak Day & Daily Average */}
            <div className="grid grid-cols-2 gap-3 pt-4 mt-4 bg-surface-container-low/50 p-3 rounded-lg border border-outline-variant">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
                  Peak Velocity Day
                </span>
                <span className="font-mono text-sm font-bold text-on-surface">
                  {timelineData.peakDay.date} ({timelineData.peakDay.clicks} clicks)
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
                  Daily Average
                </span>
                <span className="font-mono text-sm font-bold text-on-surface">
                  {timelineData.dailyAvg} clicks / day
                </span>
              </div>
            </div>
          </div>

          {/* Hourly Peak Engagement Breakdown (Span 4) */}
          <div className="lg:col-span-4 bg-surface-container-lowest p-5 sm:p-6 shadow-sm rounded-xl border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div className="flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-base font-bold text-on-surface">Hourly Engagement</h2>
                      <InfoTooltip text="Aggregated 24-hour visitor breakdown. Detects when your audience is most actively clicking links so you can schedule drops accordingly." />
                    </div>
                    <p className="text-xs text-on-surface-variant">Click distribution by hour (00-23)</p>
                  </div>
                  <span className="text-[11px] font-semibold text-primary-ink bg-primary/10 px-2 py-0.5 rounded-full border border-primary-strong/20">
                    Peak: {hourlyData.peakHour.label}
                  </span>
                </div>

                {/* 24-Hour Vertical Bar Chart */}
                <div className="flex items-end justify-between gap-[3px] h-44 pt-6">
                  {hourlyData.hours.map((h, i) => {
                    const heightPct = Math.max(6, (h.clicks / hourlyData.maxHourClicks) * 100);
                    const isPeak = h.hour === hourlyData.peakHour.hour && h.clicks > 0;
                    
                    return (
                      <div
                        key={i}
                        className={`w-full transition-all rounded-t cursor-pointer relative group ${
                          isPeak
                            ? 'bg-primary-container'
                            : h.clicks > hourlyData.maxHourClicks * 0.5
                              ? 'bg-secondary'
                              : h.clicks > 0
                                ? 'bg-secondary-fixed'
                                : 'bg-surface-container hover:bg-primary-container/40'
                        }`}
                        style={{ height: `${heightPct}%` }}
                        title={`${h.label} - ${h.clicks} clicks`}
                      >
                        {/* Hover Tooltip Popup */}
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-on-surface text-surface font-mono text-[10px] hidden group-hover:block whitespace-nowrap rounded shadow-md z-20">
                          {h.clicks} Clicks ({h.label})
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* X-Axis Hour Labels */}
                <div className="flex justify-between items-center text-on-surface-variant font-mono text-[10px] pt-2">
                  <span>00:00</span>
                  <span>08:00</span>
                  <span>16:00</span>
                  <span className="font-bold text-primary-ink">{hourlyData.peakHour.label}</span>
                  <span>23:00</span>
                </div>
              </div>

              {/* Bottom Summary Strip */}
              <div className="pt-4 mt-4 border-t-[0.5px] border-outline-variant flex items-center justify-between text-xs text-on-surface-variant">
                <span>Most active period</span>
                <span className="font-semibold text-primary-ink">
                  {hourlyData.peakHour.hour >= 18 || hourlyData.peakHour.hour < 5 ? 'Evening' : hourlyData.peakHour.hour >= 12 ? 'Afternoon' : 'Morning'} ({hourlyData.peakHour.label})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Technical Attribution Grid: Referral Breakdown & Audience/Devices ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Platform Traffic Share (Span 6) */}
          <div className="lg:col-span-6 bg-surface-container-lowest p-5 sm:p-6 shadow-sm rounded-xl border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-base font-bold text-on-surface">Traffic Sources</h2>
                    <InfoTooltip text="Categorized origins of visitor traffic (Direct, Messengers, YouTube, Instagram, X/Twitter, and Web Referrals)." />
                  </div>
                  <p className="text-xs text-on-surface-variant">Where your visitors originate from</p>
                </div>
                <span className="font-mono text-xs text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded">
                  {trafficSources.length} {trafficSources.length === 1 ? 'Source' : 'Sources'}
                </span>
              </div>

              {/* Stacked Proportional Bar */}
              <div className="w-full h-2.5 bg-surface-container-low flex overflow-hidden rounded-full my-4">
                {trafficSources.map((s, idx) => {
                  const pct = totalClicksCount > 0 ? (s.count / totalClicksCount) * 100 : 100;
                  return (
                    <div
                      key={idx}
                      className={`h-full ${s.color}`}
                      style={{ width: `${pct}%` }}
                      title={`${s.name}: ${pct.toFixed(1)}%`}
                    />
                  );
                })}
              </div>

              {/* Detailed Sources List */}
              <div className="space-y-2">
                {trafficSources.map((s, idx) => {
                  const pct = totalClicksCount > 0 ? ((s.count / totalClicksCount) * 100).toFixed(1) : '0';
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 bg-surface-container-low/40 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${s.color} shrink-0`} />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-on-surface">{s.name}</span>
                          <span className="text-[11px] text-on-surface-variant">{s.desc}</span>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-xs font-bold text-on-surface">{s.count}</span>
                        <span className="text-[11px] text-on-surface-variant ml-1">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Audience & Technical Breakdown (Span 6) */}
          <div className="lg:col-span-6 bg-surface-container-lowest p-5 sm:p-6 shadow-sm rounded-xl border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-base font-bold text-on-surface">Devices &amp; Geography</h2>
                    <InfoTooltip text="Technical environment breakdown including device form factor, OS, and edge-resolved geographic countries." />
                  </div>
                  <p className="text-xs text-on-surface-variant">Visitor device types and top countries</p>
                </div>

                <div className="inline-flex bg-surface-container-low p-0.5 rounded-lg border border-outline-variant">
                  <button
                    type="button"
                    onClick={() => setTechTab('devices')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                      techTab === 'devices'
                        ? 'bg-surface-container-lowest text-primary-ink font-bold shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Devices
                  </button>
                  <button
                    type="button"
                    onClick={() => setTechTab('os')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                      techTab === 'os'
                        ? 'bg-surface-container-lowest text-primary-ink font-bold shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    OS
                  </button>
                </div>
              </div>

              {/* Sub-Grid: Devices/OS + Top Locations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {/* Left: Device or OS Split */}
                <div className="bg-surface-container-low/40 p-3.5 rounded-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                      {techTab === 'devices' ? 'Device Split' : 'Operating System'}
                    </span>
                    <InfoTooltip text={techTab === 'devices' ? 'Hardware categories of visiting client user agents.' : 'Desktop and mobile operating systems.'} />
                  </div>

                  <div className="space-y-3 my-1">
                    {techTab === 'devices' ? (
                      devicesDistribution.map((item, idx) => {
                        const Icon = item.icon;
                        return (
                          <div key={idx}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="flex items-center gap-1.5 text-on-surface">
                                <Icon className="w-3.5 h-3.5 text-on-surface-variant" />
                                <span>{item.name}</span>
                              </span>
                              <span className="font-mono text-xs font-bold text-on-surface">{item.pct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${idx === 0 ? 'bg-primary' : idx === 1 ? 'bg-secondary' : 'bg-secondary-container'}`} 
                                style={{ width: `${item.pct}%` }} 
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      osDistribution.map((item, idx) => (
                        <div key={idx}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-on-surface">{item.name}</span>
                            <span className="font-mono text-xs font-bold text-on-surface">{item.pct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${idx === 0 ? 'bg-primary' : 'bg-secondary'}`} 
                              style={{ width: `${item.pct}%` }} 
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right: Top Locations */}
                <div className="bg-surface-container-low/40 p-3.5 rounded-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                      Top Locations
                    </span>
                    <InfoTooltip text="Visitor geographic origins resolved via CF-IPCountry headers and geo-edge lookups." />
                  </div>

                  <div className="space-y-3 my-1">
                    {topLocations.map((loc, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-on-surface font-medium truncate">{loc.country}</span>
                          <span className="font-mono text-xs font-bold text-on-surface">
                            {loc.count} ({loc.pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${idx === 0 ? 'bg-primary' : 'bg-secondary-container'}`} 
                            style={{ width: `${loc.pct}%` }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Campaign Attribution & UTM Deep-Dive Container ─── */}
        <div className="bg-surface-container-lowest p-5 sm:p-6 shadow-sm rounded-xl border border-outline-variant">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3 border-b border-outline-variant">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-on-surface">UTM Campaigns &amp; Attribution</h2>
                <InfoTooltip text="Track and attribute clicks by UTM Source (e.g. google, youtube), UTM Medium (e.g. cpc, bio), and UTM Campaign name." />
              </div>
              <p className="text-xs text-on-surface-variant">Performance metrics grouped by marketing campaign tags</p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab?.('links')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low hover:bg-surface-container text-primary-ink text-xs font-semibold rounded-lg transition-colors cursor-pointer border-[0.5px] border-outline-variant self-start sm:self-center"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>New UTM Link</span>
            </button>
          </div>

          {utmCampaignsList.length === 0 ? (
            <div className="p-6 bg-surface-container-low/30 rounded-lg text-center flex items-center justify-center gap-2 text-on-surface-variant text-xs mt-3">
              <HelpCircle className="w-4 h-4 text-primary-ink" />
              <span>No UTM campaign parameters detected for this period. Add UTM parameters when shortening links to view campaign breakdowns.</span>
            </div>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Campaign</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3">Medium</th>
                    <th className="py-2.5 px-3 text-right">Clicks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {utmCampaignsList.map((utm, idx) => (
                    <tr key={idx} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-on-surface">{utm.campaign}</td>
                      <td className="py-2.5 px-3 font-mono text-on-surface-variant">{utm.source}</td>
                      <td className="py-2.5 px-3 font-mono text-on-surface-variant">{utm.medium}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-primary-ink">{utm.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── Top Links Ranked Leaderboard (Sharp Table Layout) ─── */}
        <div className="bg-surface-container-lowest shadow-sm rounded-xl border-[0.5px] border-outline-variant overflow-hidden">
          <div className="p-4 sm:p-5 flex items-center justify-between bg-surface-container-low/30 border-b border-outline-variant">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-on-surface">Top Links Leaderboard</h2>
                <InfoTooltip text="Ranked leaderboard of the highest performing links in your workspace based on total click volume and trends." />
              </div>
              <p className="text-xs text-on-surface-variant">Highest performing shortened URLs across your workspace</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Rank &amp; Link</th>
                  <th className="py-3 px-4">Short URL</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4 text-right">Clicks</th>
                  <th className="py-3 px-4 text-right">Trend</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-xs">
                {paginatedLeaderboard.map((item, idx) => {
                  const rankNum = (leaderboardPage - 1) * LEADERBOARD_PAGE_SIZE + idx + 1;
                  const slug = item.custom_slug || item.short_code;
                  const shortUrl = `https://${originHost}/${slug}`;
                  const pct = totalClicksCount > 0 ? (( (item.clicks_count || 0) / totalClicksCount) * 100).toFixed(1) : '0';

                  return (
                    <tr key={item.id} className="hover:bg-surface-container-low/50 transition-colors">
                      {/* Rank & Title */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-6 h-6 flex items-center justify-center font-mono text-xs font-bold rounded ${
                            rankNum === 1 
                              ? 'bg-primary text-on-primary' 
                              : 'bg-surface-container text-on-surface'
                          }`}>
                            {rankNum}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-xs text-on-surface truncate max-w-xs">
                              {item.title || `/${slug}`}
                            </span>
                            <span className="text-[11px] text-on-surface-variant truncate max-w-xs">
                              {item.destination_url}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Short URL with Copy */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-primary-ink font-medium">
                          <span>/{slug}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(shortUrl, item.id)}
                            className="text-on-surface-variant hover:text-primary-ink transition-colors cursor-pointer"
                            title="Copy short link"
                          >
                            {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Platform Tag */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold bg-surface-container-high text-on-surface rounded-full">
                          {item.channel || 'Direct'}
                        </span>
                      </td>

                      {/* Clicks */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono text-xs font-bold text-on-surface">
                          {(item.clicks_count || 0).toLocaleString()}
                        </span>
                        <span className="font-mono text-[11px] text-on-surface-variant ml-1">
                          ({pct}%)
                        </span>
                      </td>

                      {/* Trend */}
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center font-mono text-xs text-secondary font-semibold">
                          <TrendingUp className="w-3 h-3 mr-0.5" />
                          <span>+35%</span>
                        </span>
                      </td>

                      {/* Action to Focus Analytics */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => { setSelectedLinkId(item.id); setSelectedAnalyticsLinkId(item.id); }}
                          title="Focus analytics on this link"
                          className="p-1 text-on-surface-variant hover:text-primary-ink hover:bg-surface-container rounded transition-colors cursor-pointer"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="px-4 py-3 bg-surface-container-low/40 flex items-center justify-between text-on-surface-variant text-xs border-t border-outline-variant">
            <div className="font-mono text-[11px]">
              Displaying {Math.min(leaderboardLinks.length, (leaderboardPage - 1) * LEADERBOARD_PAGE_SIZE + 1)} - {Math.min(leaderboardLinks.length, leaderboardPage * LEADERBOARD_PAGE_SIZE)} of {leaderboardLinks.length} links
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={leaderboardPage === 1}
                onClick={() => setLeaderboardPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1 text-xs font-semibold rounded hover:bg-surface-container text-on-surface disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Previous
              </button>
              <span className="px-2 py-0.5 font-mono text-xs bg-surface-container-lowest font-bold text-primary-ink shadow-sm rounded border border-outline-variant">
                {leaderboardPage}
              </span>
              <button
                type="button"
                disabled={leaderboardPage >= totalLeaderboardPages}
                onClick={() => setLeaderboardPage(p => Math.min(totalLeaderboardPages, p + 1))}
                className="px-2.5 py-1 text-xs font-semibold rounded hover:bg-surface-container text-on-surface disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* ─── Real-Time Activity Log (Click Stream) ─── */}
        <div className="bg-surface-container-lowest shadow-sm rounded-xl border-[0.5px] border-outline-variant overflow-hidden">
          <div className="p-4 sm:p-5 flex items-center justify-between bg-surface-container-low/30 border-b border-outline-variant">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-bold text-on-surface">Recent Clicks Activity Stream</h2>
                  <InfoTooltip text="Live incoming visitor stream recording click timestamps, geographic location, device platform, and referring origin." />
                </div>
                <p className="text-xs text-on-surface-variant">Live visitor telemetry recorded on your short links</p>
              </div>
            </div>

            {selectedLinkId !== 'all' && (
              <button
                type="button"
                onClick={() => setResetModalOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-red-500/20"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Link Analytics</span>
              </button>
            )}
          </div>

          {recentClicksStream.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant text-xs">
              No recent click events recorded within the selected date horizon.
            </div>
          ) : (
            <>
              {/* Desktop Activity Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Link</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Device &amp; OS</th>
                      <th className="py-3 px-4">Source</th>
                      <th className="py-3 px-4 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {recentClicksStream.map(click => {
                      return (
                        <tr key={click.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-primary-ink">
                            /{click.short_code}
                          </td>
                          <td className="py-3 px-4 text-on-surface font-medium">
                            {click.city ? `${click.city}, ` : ''}{click.country || 'Global'}
                          </td>
                          <td className="py-3 px-4 text-on-surface">
                            <span className="inline-flex items-center gap-1.5">
                              <Laptop className="w-3.5 h-3.5 text-on-surface-variant" />
                              <span>{click.device || 'Desktop'} ({click.os || 'Windows'})</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-on-surface-variant">
                            {click.referrer || 'Direct'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-[11px] text-on-surface-variant">
                            {formatRelativeTime(click.timestamp)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stream Cards (Phones) */}
              <div className="block md:hidden divide-y divide-outline-variant">
                {recentClicksStream.map(click => (
                  <div key={click.id} className="p-3.5 flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-primary-ink text-sm">/{click.short_code}</span>
                      <span className="font-mono text-[11px] text-on-surface-variant">{formatRelativeTime(click.timestamp)}</span>
                    </div>
                    <div className="flex items-center justify-between text-on-surface gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Globe2 className="w-3.5 h-3.5 text-on-surface-variant" />
                        <span>{click.city ? `${click.city}, ` : ''}{click.country || 'Global'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-on-surface-variant">
                        <Laptop className="w-3.5 h-3.5" />
                        <span>{click.device || 'Desktop'} &bull; {click.os || 'Windows'}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-on-surface-variant">
                      Source: <span className="font-medium text-on-surface">{click.referrer || 'Direct'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>

      {/* Reset Confirmation Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border-[0.5px] border-outline-variant rounded-xl max-w-sm w-full p-5 shadow-2xl relative">
            <h3 className="font-bold text-base text-on-surface mb-2">Reset Link Telemetry?</h3>
            <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
              This will permanently delete all click event logs and reset the click counter for this link back to 0. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={isResetting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isResetting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Confirm Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
