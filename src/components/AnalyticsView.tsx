'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';

import { StatCard } from '@/components/ui/StatCard';
import { detectSourcePlatform } from '@/lib/sourcePlatform';
import { ClicksTimelineChart, TimelineData } from '@/components/ClicksTimelineChart';
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

// GET /api/v1/analytics/summary
interface AnalyticsSummary {
  total_clicks: number;
  unique_visitors: number;
  per_link: { link_id: string; clicks: number }[];
  referrers: { referrer: string; clicks: number }[];
  devices: { device: string; clicks: number }[];
  operating_systems: { os: string; clicks: number }[];
  countries: { country: string; clicks: number }[];
  hourly: { hour: number; clicks: number }[];
  series: { unit: 'hour' | 'day'; from: string; buckets: { bucket: string; clicks: number }[] };
  recent: { id: string; link_id: string; short_code: string; timestamp: string; country?: string; city?: string; device?: string; os?: string; referrer?: string }[];
}

const localDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "2026-11-04" as local midnight (new Date('2026-11-04') is UTC midnight) */
const localDayStart = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

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
    currentWorkspace,
    isAnalyticsLoading,
    isLinksLoading,
    isInitialLoading,
    isRefreshing,
    resetLinkAnalytics
  } = useStore();
  const { showToast } = useToast();

  const [mounted, setMounted] = useState(false);
  // "2m ago" labels are measured from this, refreshed every 30 seconds (Date.now() can't run in render)
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
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
  // Local calendar dates (toISOString() gave the UTC date, a day off near midnight outside UTC)
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return localDateString(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => localDateString(new Date()));

  // Velocity Chart Range
  const [velocityRange, setVelocityRange] = useState<'30d' | '7d' | '24h'>('30d');

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

  // 2. Server summary: every figure below is computed in the database over all non-bot clicks
  // in the range (it used to come from at most the 5000 newest clicks loaded in the browser),
  // with days and hours in this browser's time zone
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const summaryParams = useRef('');

  useEffect(() => {
    const wsId = currentWorkspace?.id;
    if (!wsId) return;
    const now = Date.now();
    let from = now - 30 * 86400 * 1000;
    let to = now;
    if (dateRange === '24h') from = now - 24 * 3600 * 1000;
    else if (dateRange === '7d') from = now - 7 * 86400 * 1000;
    else if (dateRange === 'custom') {
      // Whole local days: start of the first day to the start of the day after the last
      from = localDayStart(customStartDate).getTime();
      const end = localDayStart(customEndDate);
      end.setDate(end.getDate() + 1);
      to = end.getTime();
    }

    // The velocity chart's own window (last 24 hours, or the last 7 / 30 local days)
    const seriesStart = new Date(now);
    if (velocityRange === '24h') {
      seriesStart.setMinutes(0, 0, 0);
      seriesStart.setHours(seriesStart.getHours() - 23);
    } else {
      seriesStart.setHours(0, 0, 0, 0);
      seriesStart.setDate(seriesStart.getDate() - (velocityRange === '7d' ? 6 : 29));
    }

    const params = new URLSearchParams({
      workspace_id: wsId,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      series: velocityRange === '24h' ? 'hour' : 'day',
      series_from: seriesStart.toISOString(),
    });
    if (selectedLinkId !== 'all') params.set('link_id', selectedLinkId);
    else if (selectedCampaignId !== 'all') params.set('campaign_id', selectedCampaignId);
    const query = params.toString();
    summaryParams.current = query;

    const controller = new AbortController();
    fetch(`/api/v1/analytics/summary?${query}`, { cache: 'no-store', signal: controller.signal })
      .then(res => res.json())
      .then((data: AnalyticsSummary & { success?: boolean }) => {
        if (data?.success) setSummary(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [currentWorkspace?.id, dateRange, customStartDate, customEndDate, velocityRange, selectedLinkId, selectedCampaignId, clicks.length]);

  // 3. Core KPI Calculations
  const totalLinksCount = filteredLinks.length;
  const totalClicksCount = summary?.total_clicks || 0;
  const uniqueVisitorsCount = summary?.unique_visitors || 0;

  const uniqueVisitorRate = totalClicksCount > 0
    ? Math.round((uniqueVisitorsCount / totalClicksCount) * 100)
    : 0;

  const clicksByLink = useMemo(() => {
    const map: Record<string, number> = {};
    (summary?.per_link || []).forEach(p => { map[p.link_id] = p.clicks; });
    return map;
  }, [summary]);

  // Top Performing Link: most clicks in the selected range
  const topLink = useMemo(() => {
    if (filteredLinks.length === 0) return null;
    let bestLink: LinkType = filteredLinks[0];
    let maxClicks = -1;
    filteredLinks.forEach(l => {
      const count = clicksByLink[l.id] || 0;
      if (count > maxClicks) {
        maxClicks = count;
        bestLink = l;
      }
    });
    const percent = totalClicksCount > 0 ? ((maxClicks / totalClicksCount) * 100).toFixed(1) : '0';
    return { link: bestLink, clicks: Math.max(0, maxClicks), percent };
  }, [filteredLinks, clicksByLink, totalClicksCount]);

  // Top Referrer
  const topReferrer = useMemo(() => {
    const referrers = summary?.referrers || [];
    if (totalClicksCount === 0) return { name: 'None', percent: '' };
    const counts: Record<string, number> = {};
    referrers.forEach(({ referrer: raw, clicks: n }) => {
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
      counts[name] = (counts[name] || 0) + n;
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
  }, [summary, totalClicksCount]);

  // 4. Click Velocity Timeline (24h, 7d, 30d): one bucket per hour or day, oldest first
  const timelineData = useMemo((): TimelineData => {
    const isHourly = velocityRange === '24h';
    const count = isHourly ? 24 : velocityRange === '7d' ? 7 : 30;
    const now = new Date();
    const points: { label: string; date: string; clicks: number }[] = [];
    const byBucket: Record<string, number> = {};
    if (summary?.series.unit === (isHourly ? 'hour' : 'day')) {
      summary.series.buckets.forEach(b => { byBucket[b.bucket] = b.clicks; });
    }

    for (let i = count - 1; i >= 0; i--) {
      const start = new Date(now);
      if (isHourly) {
        start.setMinutes(0, 0, 0);
        start.setHours(start.getHours() - i);
      } else {
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - i);
      }
      // Same keys the server builds in this time zone: YYYY-MM-DD or YYYY-MM-DDTHH
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
        + (isHourly ? `T${String(start.getHours()).padStart(2, '0')}` : '');
      const clicks = byBucket[key] || 0;

      const day = start.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const hour = `${start.getHours().toString().padStart(2, '0')}:00`;
      points.push({ label: isHourly ? hour : day, date: isHourly ? `${day}, ${hour}` : day, clicks });
    }

    const total = points.reduce((sum, p) => sum + p.clicks, 0);
    const peak = points.reduce((best, p) => (p.clicks > best.clicks ? p : best), points[0] || { label: '', date: 'N/A', clicks: 0 });
    const peakIndex = points.indexOf(peak);

    // Clean y-axis: 1/2/5 steps, at most 4 intervals
    const max = Math.max(1, peak.clicks);
    const rawStep = max / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const step = Math.max(1, [1, 2, 5, 10].map(m => m * magnitude).find(m => m >= rawStep) || magnitude);
    const axisMax = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = axisMax; v >= 0; v -= step) ticks.push(v);

    // Every nth label, counted back from the newest bucket so the latest one is always labelled
    const labelEvery = isHourly ? 4 : count === 7 ? 1 : 5;

    return {
      points,
      total,
      peak,
      peakIndex: peak.clicks > 0 ? peakIndex : -1,
      average: total / count,
      unit: (isHourly ? 'hour' : 'day') as TimelineData['unit'],
      axisMax,
      ticks,
      labelEvery
    };
  }, [velocityRange, summary]);

  // 5. Hourly Peak Matrix (00:00 to 23:00, local time)
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      clicks: 0
    }));

    (summary?.hourly || []).forEach(h => {
      if (hours[h.hour]) hours[h.hour].clicks = h.clicks;
    });

    const maxHourClicks = Math.max(1, ...hours.map(h => h.clicks));
    let peakHour = hours[0];
    hours.forEach(h => {
      if (h.clicks > peakHour.clicks) peakHour = h;
    });

    return { hours, maxHourClicks, peakHour };
  }, [summary]);

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

    (summary?.referrers || []).forEach(({ referrer, clicks: n }) => {
      const ref = (referrer || '').toLowerCase();
      if (!ref || ref === 'direct' || ref.startsWith('direct /')) map.direct.count += n;
      else if (ref.includes('localhost') || ref.includes('127.0.0.1')) map.internal.count += n;
      else if (ref.includes('youtube.com')) map.youtube.count += n;
      else if (ref.includes('instagram.com')) map.instagram.count += n;
      else if (ref.includes('twitter.com') || ref.includes('t.co') || ref.includes('x.com')) map.twitter.count += n;
      else map.other.count += n;
    });

    const activeList = Object.values(map).filter(s => s.count > 0);
    if (activeList.length === 0) {
      activeList.push({ name: 'Direct', desc: 'Direct visits & messengers', count: 0, color: 'bg-primary' });
    }

    return activeList.sort((a, b) => b.count - a.count);
  }, [summary]);

  // 7. Devices & OS Distribution
  const devicesDistribution = useMemo(() => {
    const devices: Record<string, number> = { Desktop: 0, Mobile: 0, Tablet: 0 };
    (summary?.devices || []).forEach(({ device, clicks: n }) => {
      const dev = (device || '').toLowerCase();
      if (dev.includes('mobile') || dev.includes('phone') || dev.includes('android') || dev.includes('iphone')) {
        devices.Mobile += n;
      } else if (dev.includes('tablet') || dev.includes('ipad')) {
        devices.Tablet += n;
      } else {
        devices.Desktop += n;
      }
    });

    const total = Math.max(1, totalClicksCount);
    return [
      { name: 'Desktop', count: devices.Desktop, pct: ((devices.Desktop / total) * 100).toFixed(1), icon: Laptop },
      { name: 'Mobile', count: devices.Mobile, pct: ((devices.Mobile / total) * 100).toFixed(1), icon: Smartphone },
      { name: 'Tablet', count: devices.Tablet, pct: ((devices.Tablet / total) * 100).toFixed(1), icon: Tablet },
    ];
  }, [summary, totalClicksCount]);

  const osDistribution = useMemo(() => {
    const total = Math.max(1, totalClicksCount);
    return (summary?.operating_systems || [])
      .map(({ os, clicks: count }) => ({ name: os, count, pct: ((count / total) * 100).toFixed(1) }))
      .slice(0, 4);
  }, [summary, totalClicksCount]);

  // 8. Top Locations
  const topLocations = useMemo(() => {
    const total = Math.max(1, totalClicksCount);
    const sorted = (summary?.countries || [])
      .map(({ country, clicks: count }) => ({ country, count, pct: ((count / total) * 100).toFixed(1) }));

    if (sorted.length === 0) {
      return [{ country: 'Global Direct', count: 0, pct: '100' }];
    }
    return sorted.slice(0, 4);
  }, [summary, totalClicksCount]);

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

  // 11. Recent Clicks Stream (newest 8 in the range, from the summary)
  const recentClicksStream = summary?.recent || [];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Every click in the range, built by the server (not just the clicks loaded in this page)
  const handleExportCsv = async () => {
    if (!summaryParams.current) return;
    try {
      const res = await fetch(`/api/v1/analytics/export?${summaryParams.current}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      const rows = Number(res.headers.get('X-Row-Count')) || 0;
      showToast('success', 'CSV exported', res.headers.get('X-Row-Limit-Reached') === '1'
        ? `First ${rows.toLocaleString()} clicks. Narrow the date range for the rest.`
        : `${rows.toLocaleString()} click${rows === 1 ? '' : 's'} downloaded.`);
    } catch {
      showToast('error', 'Export failed', 'Could not generate the CSV file.');
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
    const diffMs = now - new Date(ts).getTime();
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
      <div className="w-full font-body-md text-body-md text-on-surface antialiased">
        <SkeletonAnalyticsView />
      </div>
    );
  }

  return (
    <div className="w-full font-body-md text-body-md text-on-surface antialiased">
      <div className="flex flex-col w-full pb-16 space-y-6">

        {/* ─── Top Meta / Status Bar (Architectural Sharp-Cornered Strip) ─── */}
        <div className="w-full flex flex-wrap items-center justify-end gap-2 pb-[15px] border-b-[0.5px] border-outline-variant">
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

        {/* ─── KPI cards ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatCard
            label="Total links"
            value={totalLinksCount.toLocaleString()}
            note={<span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Active in this workspace</span>}
          />
          <StatCard
            label="Total clicks"
            info="Every click, including repeat visits."
            value={totalClicksCount.toLocaleString()}
            note={`${Math.max(0, totalClicksCount - uniqueVisitorsCount).toLocaleString()} repeat clicks`}
          />
          <StatCard
            label="Unique visitors"
            info="Each visitor counted once, however often they click."
            value={uniqueVisitorsCount.toLocaleString()}
            note={<><span className="font-semibold text-primary-ink">{uniqueVisitorRate}%</span> unique visitor rate</>}
          />
          <StatCard
            label="Top link"
            kind="text"
            valueClassName="font-mono text-primary-ink"
            value={topLink ? `/${topLink.link.custom_slug || topLink.link.short_code}` : 'None'}
            note={topLink ? `${topLink.clicks} clicks (${topLink.percent}%)` : 'No clicks yet'}
          />
          <StatCard
            label="Top referrer"
            kind="text"
            value={topReferrer.name}
            note={topReferrer.percent ? <><span className="font-semibold text-on-surface">{topReferrer.percent}</span> of total traffic</> : 'No clicks yet'}
          />
        </div>

        {/* ─── Bento Section: Click Velocity Timeline + Hourly Peak Matrix ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Click Velocity & Timeline Curve (Span 8) */}
          <ClicksTimelineChart className="lg:col-span-8" data={timelineData} range={velocityRange} onRangeChange={setVelocityRange} />

          {/* Hourly Peak Engagement Breakdown (Span 4) */}
          <div className="lg:col-span-4 bg-surface-container-lowest p-5 sm:p-6 shadow-sm rounded-xl border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div className="flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-[14px] font-semibold text-on-surface">Clicks by hour</h2>
                    </div>
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
                    <h2 className="text-[14px] font-semibold text-on-surface">Traffic sources</h2>
                  </div>
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
                    <h2 className="text-[14px] font-semibold text-on-surface">Devices &amp; countries</h2>
                  </div>
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
                  {/* Custom-domain locations come from the DB-IP Lite database (CC BY 4.0 requires this credit) */}
                  <a href="https://db-ip.com" target="_blank" rel="noreferrer" className="mt-2 text-[10px] text-outline hover:underline self-start">
                    IP Geolocation by DB-IP
                  </a>
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
                <h2 className="text-[14px] font-semibold text-on-surface">UTM campaigns</h2>
              </div>
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
                <h2 className="text-[14px] font-semibold text-on-surface">Top links</h2>
              </div>
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
                  <h2 className="text-[14px] font-semibold text-on-surface">Recent clicks</h2>
                </div>
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
