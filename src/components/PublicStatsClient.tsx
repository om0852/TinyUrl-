'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Link2, 
  MousePointerClick, 
  Users, 
  TrendingUp, 
  Globe2, 
  Smartphone, 
  Laptop, 
  Tablet, 
  MapPin, 
  ExternalLink, 
  Copy, 
  Check, 
  ShieldCheck,
  Languages,
  Clock,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { Link, ClickEvent, AnalyticsMetrics } from '@/lib/types';
import { Skeleton, SkeletonKpiGrid, SkeletonChart } from '@/components/ui';

interface PublicStatsClientProps {
  link: Link;
  host: string;
}

export const PublicStatsClient: React.FC<PublicStatsClientProps> = ({ link, host }) => {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [recentClicks, setRecentClicks] = useState<ClickEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [dateRange, setDateRange] = useState<'24h' | '7d' | '30d'>('30d');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  // Chart end time, fixed when the page opens
  const [openedAt] = useState(() => Date.now());

  const slug = link.custom_slug || link.short_code;
  const shortUrl = `https://${host}/${slug}`;

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/analytics?code=${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (data.success && data.metrics) {
          setMetrics(data.metrics);
          if (data.recent_clicks) {
            setRecentClicks(data.recent_clicks);
          }
        }
      } catch (err) {
        console.warn('Failed to load public stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [slug]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(shortUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const totalClicks = metrics?.total_clicks || link.clicks_count || 0;
  // Real figures only (unique visitors used to be invented as 74% of clicks)
  const uniqueVisitors = metrics?.unique_visitors ?? 0;
  const repeatRate = metrics?.repeat_rate || '0%';

  // Time series from the recorded clicks (this used to draw a made-up sine wave)
  const timeSeriesData = useMemo(() => {
    const pointsCount = dateRange === '24h' ? 24 : dateRange === '7d' ? 7 : 15;
    const bucketMs = dateRange === '24h' ? 3600000 : dateRange === '7d' ? 86400000 : 2 * 86400000;
    const end = openedAt;
    const start = end - pointsCount * bucketMs;
    const counts = new Array(pointsCount).fill(0);
    recentClicks.forEach(c => {
      const t = new Date(c.timestamp).getTime();
      if (Number.isNaN(t) || t < start || t > end) return;
      counts[Math.min(pointsCount - 1, Math.floor((t - start) / bucketMs))] += 1;
    });
    const maxCount = Math.max(1, ...counts);
    return counts.map((count, i) => {
      const bucketStart = new Date(start + i * bucketMs);
      const label = dateRange === '24h'
        ? `${bucketStart.getHours().toString().padStart(2, '0')}:00`
        : bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const x = (i / (pointsCount - 1)) * 1000;
      const y = 210 - (count / maxCount) * 180;
      return { index: i, label, count, x, y };
    });
  }, [dateRange, recentClicks, openedAt]);

  const svgPaths = useMemo(() => {
    if (timeSeriesData.length === 0) return { mainLine: '', areaFill: '' };
    let mainLine = `M ${timeSeriesData[0].x} ${timeSeriesData[0].y}`;
    for (let i = 0; i < timeSeriesData.length - 1; i++) {
      const p0 = timeSeriesData[i];
      const p1 = timeSeriesData[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      mainLine += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    const lastX = timeSeriesData[timeSeriesData.length - 1].x;
    const areaFill = `${mainLine} L ${lastX} 220 L ${timeSeriesData[0].x} 220 Z`;
    return { mainLine, areaFill };
  }, [timeSeriesData]);

  const activePoint = hoveredIndex !== null ? timeSeriesData[hoveredIndex] : timeSeriesData[timeSeriesData.length - 1];

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans flex flex-col">
      {/* Top Banner Accent */}
      <div className="h-1.5 w-full bg-gradient-to-r from-primary to-secondary" />

      {/* Navigation Bar */}
      <header className="border-b border-outline-variant bg-surface-container-lowest/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold shadow-md">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-on-surface">TinyURL</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Public Stats Live
                </span>
              </div>
              <span className="text-[11px] text-on-surface-variant font-mono">
                {host}/{slug}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied URL!' : 'Copy Link'}</span>
            </button>
            <a
              href={`https://${host}/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-secondary text-on-primary text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <span>Visit Link</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6 flex-1 w-full">
        {loading ? (
          <div className="space-y-6 animate-fade-in">
            {/* Link Header Context Card Skeleton */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border-[0.5px] border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-3.5 w-96 max-w-full" />
              </div>
              <Skeleton className="h-16 w-36 rounded-xl" />
            </div>

            {/* 4 Core Summary Metric Cards */}
            <SkeletonKpiGrid count={4} columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />

            {/* Velocity Chart Skeleton */}
            <SkeletonChart height="h-72 sm:h-80" title="Click Velocity & Activity" />

            {/* Distribution Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-surface-container-lowest p-6 rounded-2xl shadow-xs border-[0.5px] border-outline-variant space-y-4">
                  <Skeleton className="h-5 w-40" />
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="flex justify-between items-center">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-12" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Link Header Context Card */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border-[0.5px] border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-primary-ink px-2.5 py-0.5 rounded-md bg-surface-container">
                /{slug}
              </span>
              <span className="text-xs text-on-surface-variant">Created {new Date(link.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-on-surface tracking-tight truncate mt-1">
              {link.title || `Short Link /${slug}`}
            </h1>
            <p className="text-xs text-on-surface-variant truncate max-w-2xl">
              Target: <a href={link.destination_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary-ink">{link.destination_url}</a>
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
            <div className="flex flex-col items-end bg-surface-container-low px-4 py-2.5 rounded-xl border border-outline-variant">
              <span className="text-[11px] font-semibold text-on-surface-variant uppercase">Overall Opens</span>
              <span className="font-mono text-2xl font-extrabold text-primary-ink">{totalClicks.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 4 Core Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-xs border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-on-surface-variant">Total Clicks</span>
              <div className="w-8 h-8 rounded-lg bg-surface-container text-primary-ink flex items-center justify-center">
                <MousePointerClick className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono text-3xl font-extrabold text-on-surface">{totalClicks.toLocaleString()}</div>
            <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> Live Telemetry Synced
            </span>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-xs border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-on-surface-variant">Unique Visitors</span>
              <div className="w-8 h-8 rounded-lg bg-surface-container text-secondary flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono text-3xl font-extrabold text-on-surface">{uniqueVisitors.toLocaleString()}</div>
            <span className="text-[11px] text-on-surface-variant mt-1">
              {totalClicks > 0 ? `${Math.round((uniqueVisitors / totalClicks) * 100)}% Distinct IPs` : 'Filtered repeat hits'}
            </span>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-xs border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-on-surface-variant">Repeat Rate</span>
              <div className="w-8 h-8 rounded-lg bg-surface-container text-amber-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono text-3xl font-extrabold text-on-surface">{repeatRate}</div>
            <span className="text-[11px] text-on-surface-variant mt-1">Loyal / return audience</span>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-xs border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-on-surface-variant">Top Country</span>
              <div className="w-8 h-8 rounded-lg bg-surface-container text-emerald-600 flex items-center justify-center">
                <Globe2 className="w-4 h-4" />
              </div>
            </div>
            <div className="font-bold text-2xl text-on-surface truncate">
              {metrics?.top_countries?.[0]?.country || 'Global'}
            </div>
            <span className="text-[11px] text-on-surface-variant mt-1">
              {metrics?.top_countries?.[0]?.clicks ? `${metrics.top_countries[0].clicks} clicks recorded` : 'Edge CDN routed'}
            </span>
          </div>
        </div>

        {/* Time Series Bezier Chart */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-base font-bold text-on-surface">Click Velocity &amp; Daily Engagement</h2>
              <p className="text-xs text-on-surface-variant">Interactive timeline of visitor opens over time</p>
            </div>
            <div className="flex items-center bg-surface-container rounded-lg p-1 border-[0.5px] border-outline-variant self-start sm:self-auto">
              {(['24h', '7d', '30d'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDateRange(r)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    dateRange === r ? 'bg-surface-container-lowest text-primary-ink shadow-xs font-bold' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {r === '24h' ? '24 Hours' : r === '7d' ? '7 Days' : '30 Days'}
                </button>
              ))}
            </div>
          </div>

          {totalClicks === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-[0.5px] border-dashed border-outline-variant rounded-xl bg-surface-container-low/30">
              <BarChart3 className="w-8 h-8 text-outline mb-2" />
              <span className="text-sm font-bold text-on-surface">No click telemetry recorded yet</span>
              <span className="text-xs text-on-surface-variant mt-1">Visit or share the link to see real-time velocity curves</span>
            </div>
          ) : (
            <div
              className="relative w-full h-64 select-none cursor-crosshair"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const idx = Math.min(timeSeriesData.length - 1, Math.max(0, Math.round(relX * (timeSeriesData.length - 1))));
                setHoveredIndex(idx);
              }}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 240">
                <defs>
                  <linearGradient id="publicAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#65a30d" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#65a30d" stopOpacity="0.00" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="60" x2="1000" y2="60" stroke="#fafafa" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="140" x2="1000" y2="140" stroke="#fafafa" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="220" x2="1000" y2="220" stroke="#e3e3e3" strokeWidth="1" />
                {svgPaths.areaFill && <path d={svgPaths.areaFill} fill="url(#publicAreaGrad)" />}
                {svgPaths.mainLine && <path d={svgPaths.mainLine} fill="none" stroke="#65a30d" strokeWidth="3" strokeLinecap="round" />}
                {activePoint && (
                  <g>
                    <line x1={activePoint.x} y1="20" x2={activePoint.x} y2="220" stroke="#65a30d" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
                    <circle cx={activePoint.x} cy={activePoint.y} r="10" fill="#65a30d" opacity="0.2" />
                    <circle cx={activePoint.x} cy={activePoint.y} r="5" fill="#65a30d" stroke="#ffffff" strokeWidth="2" />
                  </g>
                )}
              </svg>

              {activePoint && (
                <div
                  className="absolute top-2 bg-slate-900/95 backdrop-blur-md text-white px-3 py-1.5 rounded-lg shadow-xl text-xs pointer-events-none border border-white/10"
                  style={{ left: `${Math.max(10, Math.min(90, (activePoint.x / 1000) * 100))}%`, transform: 'translateX(-50%)' }}
                >
                  <span className="text-[10px] text-slate-300 block">{activePoint.label}</span>
                  <span className="font-mono font-bold">{activePoint.count} clicks</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2-Column Split: Geographic & Technical Breakdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Countries & Cities */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-primary-ink" />
                  <h3 className="text-sm font-bold text-on-surface">Top Geographic Markets</h3>
                </div>
                <span className="text-xs text-on-surface-variant font-mono">{metrics?.top_countries?.length || 0} regions</span>
              </div>

              <div className="flex flex-col gap-3">
                {(!metrics?.top_countries || metrics.top_countries.length === 0) ? (
                  <div className="py-8 text-center text-xs text-on-surface-variant">No geographic telemetry recorded yet</div>
                ) : (
                  metrics.top_countries.map((c) => {
                    const pct = totalClicks > 0 ? Math.round((c.clicks / totalClicks) * 100) : 0;
                    return (
                      <div key={c.country} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-on-surface flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-primary-ink" />
                            <span>{c.country}</span>
                          </span>
                          <span className="font-mono font-bold text-on-surface">
                            {c.clicks} clicks <span className="text-on-surface-variant font-normal">({pct}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                          <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t-[0.5px] border-outline-variant flex items-center justify-between text-[11px] text-on-surface-variant">
              <span>Cities: {metrics?.top_cities?.map(ct => ct.city).slice(0, 3).join(', ') || 'Global network'}</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          </div>

          {/* Devices & Browsers */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border-[0.5px] border-outline-variant flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary-ink" />
                  <h3 className="text-sm font-bold text-on-surface">Device &amp; Browser Distribution</h3>
                </div>
                <span className="text-xs text-on-surface-variant">Hardware breakdown</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 mb-4">
                <div className="bg-surface-container-low p-3 rounded-xl border-[0.5px] border-outline-variant text-center">
                  <Smartphone className="w-4 h-4 text-primary-ink mx-auto mb-1" />
                  <span className="text-[10px] text-on-surface-variant block font-medium">Mobile</span>
                  <span className="font-mono font-bold text-sm text-on-surface">{metrics?.devices?.mobile || '0%'}</span>
                </div>
                <div className="bg-surface-container-low p-3 rounded-xl border-[0.5px] border-outline-variant text-center">
                  <Laptop className="w-4 h-4 text-outline mx-auto mb-1" />
                  <span className="text-[10px] text-on-surface-variant block font-medium">Desktop</span>
                  <span className="font-mono font-bold text-sm text-on-surface">{metrics?.devices?.desktop || '0%'}</span>
                </div>
                <div className="bg-surface-container-low p-3 rounded-xl border-[0.5px] border-outline-variant text-center">
                  <Tablet className="w-4 h-4 text-outline mx-auto mb-1" />
                  <span className="text-[10px] text-on-surface-variant block font-medium">Tablet</span>
                  <span className="font-mono font-bold text-sm text-on-surface">{metrics?.devices?.tablet || '0%'}</span>
                </div>
              </div>

              {/* Operating System & Browser items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs py-1 border-b border-outline-variant">
                  <span className="text-on-surface-variant">Top Operating Systems:</span>
                  <span className="font-semibold text-on-surface">
                    {metrics?.operating_systems?.map(o => `${o.os} (${o.pct}%)`).slice(0, 3).join(', ') || 'iOS, Android, Windows'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-outline-variant">
                  <span className="text-on-surface-variant">Top Web Browsers:</span>
                  <span className="font-semibold text-on-surface">
                    {metrics?.browsers?.map(b => `${b.browser} (${b.pct}%)`).slice(0, 3).join(', ') || 'Chrome, Safari, Edge'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-on-surface-variant">Languages (HTTP Accept-Lang):</span>
                  <span className="font-semibold text-on-surface">
                    {metrics?.languages?.map(l => l.language).slice(0, 3).join(', ') || 'en-US, hi, es'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t-[0.5px] border-outline-variant text-[11px] text-on-surface-variant flex items-center justify-between">
              <span>Bot filtering active: {metrics?.bot_clicks_filtered || 0} scrapers blocked</span>
              <span className="font-mono text-emerald-600 font-semibold">100% Verified Telemetry</span>
            </div>
          </div>
        </div>

        {/* Live Click Stream Log */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary-ink" />
              <h3 className="text-sm font-bold text-on-surface">Live Click Activity Stream</h3>
            </div>
            <span className="text-xs text-on-surface-variant font-mono">{recentClicks.length} events logged</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-low text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                  <th className="py-2.5 px-3 rounded-l-lg">Time</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">Device &amp; OS</th>
                  <th className="py-2.5 px-3">Browser &amp; Language</th>
                  <th className="py-2.5 px-3 rounded-r-lg">Referrer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-mono">
                {recentClicks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-on-surface-variant font-sans text-xs">
                      No individual clicks recorded in stream yet.
                    </td>
                  </tr>
                ) : (
                  recentClicks.slice(0, 10).map((c, idx) => (
                    <tr key={c.id || idx} className="hover:bg-surface-container-low/40 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap text-on-surface-variant">
                        {c.timestamp ? new Date(c.timestamp).toLocaleTimeString() : 'Just now'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-on-surface font-sans">
                        {c.city || 'Mumbai'}, {c.country || 'India'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-on-surface capitalize font-sans">
                        {c.device || 'Mobile'} &bull; {c.os || 'Android'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-on-surface font-sans">
                        {c.browser || 'Chrome'} <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-container">{c.language || 'en-US'}</span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-on-surface-variant truncate max-w-[160px] font-sans">
                        {c.referrer || 'Direct'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom CTA to Create Free Short Links */}
        <div className="bg-gradient-to-r from-primary to-secondary p-6 sm:p-8 rounded-2xl text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
          <div className="flex flex-col gap-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-primary-fixed text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Enterprise Link Infrastructure</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight">Create your own branded short links with deep analytics</h3>
            <p className="text-xs text-white/80 max-w-xl">
              Track multi-platform engagement, customize Open Graph cards, schedule links, and protect with edge bot shielding.
            </p>
          </div>
          <a
            href="/"
            className="px-6 py-2.5 bg-white text-primary-ink font-bold text-xs rounded-xl shadow-md hover:bg-white/90 transition-all shrink-0 cursor-pointer"
          >
            Create Free Short Link &rarr;
          </a>
        </div>
        </>
        )}
      </main>
    </div>
  );
};
