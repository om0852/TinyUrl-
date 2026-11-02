'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Copy,
  Check,
  LogOut,
  RefreshCw,
  MousePointerClick,
  Users,
  Link2,
  Globe,
  Pencil,
  Search,
  BarChart3,
  ExternalLink,
  Gauge,
  X,
} from 'lucide-react';

interface PortalClient {
  id: string;
  name: string;
  email?: string;
  company_name: string;
  brand_color?: string;
  brand_logo_url?: string;
  custom_domain?: string;
  can_view_analytics: boolean;
  can_edit_destination_url: boolean;
}

interface LinkItem {
  id: string;
  short_code: string;
  custom_slug?: string;
  destination_url: string;
  title?: string;
  status: string;
  clicks_count: number;
  created_at: string;
  campaign_id?: string;
  utm_campaign?: string;
  domain_hostname?: string | null;
}

interface CampaignItem {
  id: string;
  name: string;
}

interface ClickEvent {
  id: string;
  link_id?: string;
  timestamp: string;
  country?: string;
  city?: string;
  device?: string;
  os?: string;
  browser?: string;
  referrer?: string;
}

type StatusFilter = 'all' | 'active' | 'paused';

const iconBtn =
  'size-[34px] rounded-md border-[0.5px] border-outline-variant grid place-items-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50';
const smallBtn =
  'h-[28px] px-2.5 rounded-md border-[0.5px] border-outline-variant text-xs text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer inline-flex items-center gap-1.5';

// Header and content share one width so their edges line up; wide enough to avoid big side gutters
const container = 'w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10';
// Link | Destination | Clicks | Actions, on medium screens and up
const rowGrid = 'md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_80px_200px] md:items-center md:gap-4';

const hostOf = (url: string) => {
  try { return new URL(url).host + new URL(url).pathname.replace(/\/$/, ''); } catch { return url; }
};

export default function ClientPortalDashboardPage() {
  const router = useRouter();

  const [client, setClient] = useState<PortalClient | null>(null);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [clicks, setClicks] = useState<ClickEvent[]>([]);
  const [metrics, setMetrics] = useState({ total_clicks: 0, unique_clicks: 0, quota_used: 0, quota_max: 10 });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openAnalytics, setOpenAnalytics] = useState<string | null>(null);

  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [newDestinationUrl, setNewDestinationUrl] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // The signed portal cookie is the session; the server decides who this is and what they may do
  const fetchResources = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setLoadError('');
    try {
      const res = await fetch('/api/v1/portal/resources', { cache: 'no-store' });
      if (res.status === 401) {
        router.replace('/portal/login');
        return;
      }
      const data = await res.json();
      if (!data.success) {
        setLoadError(data.error || 'Could not load your links.');
        return;
      }
      setClient(data.client);
      setLinks(data.links || []);
      setClicks(data.clicks || []);
      setCampaigns(data.campaigns || []);
      if (data.metrics) setMetrics(data.metrics);
    } catch {
      setLoadError('Network error. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    // Profiles were kept in browser storage before the cookie session; drop any leftover copy
    try { localStorage.removeItem('snip_client_session'); } catch {}
    fetchResources();
  }, [fetchResources]);

  const handleLogout = () => {
    fetch('/api/v1/portal/auth', { method: 'DELETE' })
      .catch(() => {})
      .finally(() => router.replace('/portal/login'));
  };

  const shortUrlOf = (link: LinkItem) => {
    const code = link.custom_slug || link.short_code;
    if (link.domain_hostname) return `https://${link.domain_hostname}/${code}`;
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/${code}`;
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const openEdit = (link: LinkItem) => {
    setEditingLink(link);
    setNewDestinationUrl(link.destination_url);
    setEditError('');
  };

  const handleSaveDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink) return;
    setEditError('');
    try {
      const u = new URL(newDestinationUrl.trim());
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    } catch {
      setEditError('Enter a full URL starting with https://');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/v1/portal/links/${encodeURIComponent(editingLink.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination_url: newDestinationUrl.trim() }),
      });
      if (res.status === 401) {
        router.replace('/portal/login');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setEditError(data.error || 'Could not update the link.');
        return;
      }
      setLinks(prev => prev.map(l => (l.id === editingLink.id ? { ...l, destination_url: data.destination_url } : l)));
      setEditingLink(null);
    } catch {
      setEditError('Network error. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const campaignName = (link: LinkItem) =>
    campaigns.find(c => c.id === link.campaign_id)?.name || link.utm_campaign || '';

  const filteredLinks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return links.filter(l => {
      if (statusFilter === 'active' && l.status !== 'active') return false;
      if (statusFilter === 'paused' && l.status === 'active') return false;
      if (!q) return true;
      return [l.title, l.short_code, l.custom_slug, l.destination_url, campaignName(l)]
        .some(v => v && v.toLowerCase().includes(q));
    });
    // campaignName reads campaigns
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, campaigns, searchQuery, statusFilter]);

  const clicksByLink = useMemo(() => {
    const map: Record<string, ClickEvent[]> = {};
    for (const c of clicks) {
      if (!c.link_id) continue;
      (map[c.link_id] ||= []).push(c);
    }
    return map;
  }, [clicks]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-6 h-6 border-2 border-outline-variant border-t-on-surface rounded-full animate-spin" />
      </div>
    );
  }

  const canAnalytics = !!client?.can_view_analytics;
  const canEdit = !!client?.can_edit_destination_url;
  const quotaPct = Math.min(100, (metrics.quota_used / Math.max(1, metrics.quota_max)) * 100);

  const stats = [
    { icon: <Link2 className="w-5 h-5" />, value: links.length.toLocaleString(), label: 'Links', hint: campaigns.length ? `${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'}` : 'Assigned to you' },
    { icon: <MousePointerClick className="w-5 h-5" />, value: metrics.total_clicks.toLocaleString(), label: 'Clicks', hint: 'All time' },
    canAnalytics
      ? { icon: <Users className="w-5 h-5" />, value: metrics.unique_clicks.toLocaleString(), label: 'Visitors', hint: 'Recent unique' }
      : { icon: <Users className="w-5 h-5" />, value: '—', label: 'Visitors', hint: 'Not shared' },
    { icon: <Gauge className="w-5 h-5" />, value: `${metrics.quota_used} / ${metrics.quota_max}`, label: 'Quota', hint: `${Math.round(quotaPct)}% used` },
  ];

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface-container-lowest border-b-[0.5px] border-outline-variant">
        <div className={`${container} h-[60px] flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3 min-w-0">
            {client?.brand_logo_url ? (
              <img src={client.brand_logo_url} alt="" className="h-8 w-auto max-w-[110px] object-contain rounded" />
            ) : (
              <div
                className="grid size-[34px] place-items-center rounded-md text-white shrink-0"
                style={{ backgroundColor: client?.brand_color || '#65a30d' }}
              >
                <Building2 className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[14px] font-semibold truncate">{client?.company_name || 'Client portal'}</div>
              {client?.custom_domain && (
                <div className="text-[11px] text-outline flex items-center gap-1 truncate">
                  <Globe className="w-3 h-3 shrink-0" />{client.custom_domain}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:block text-right mr-1">
              <div className="text-xs font-medium truncate max-w-[180px]">{client?.name}</div>
              {client?.email && <div className="text-[11px] text-outline truncate max-w-[180px]">{client.email}</div>}
            </div>
            <button onClick={() => fetchResources(true)} disabled={refreshing} className={iconBtn} aria-label="Refresh" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleLogout} className="h-[34px] px-3 rounded-md border-[0.5px] border-outline-variant text-xs font-medium text-on-surface-variant hover:text-error hover:border-error/40 hover:bg-error/5 transition-colors cursor-pointer inline-flex items-center gap-1.5">
              <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Sign out</span>
              <span className="sr-only sm:hidden">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className={`${container} flex-1 py-6 space-y-[15px]`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold">Your links</h1>
            <p className="text-xs text-outline mt-0.5">Shared with you by your agency.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className={`px-2 py-0.5 rounded-full ${canAnalytics ? 'bg-primary-fixed text-on-secondary-container' : 'bg-surface-container text-outline'}`}>
              Analytics {canAnalytics ? 'on' : 'off'}
            </span>
            <span className={`px-2 py-0.5 rounded-full ${canEdit ? 'bg-primary-fixed text-on-secondary-container' : 'bg-surface-container text-outline'}`}>
              {canEdit ? 'Can edit destinations' : 'View only'}
            </span>
          </div>
        </div>

        {loadError && (
          <div role="alert" className="px-3 py-2 rounded-md bg-error/10 text-error text-xs flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button onClick={() => fetchResources(true)} className="underline cursor-pointer">Retry</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-[15px]">
          {stats.map(card => (
            <div key={card.label} className="flex items-center gap-[10px] rounded-xl border-[0.5px] border-outline-variant bg-surface-container-lowest p-[15px] min-w-0">
              <div className="grid size-[40px] place-items-center rounded-md bg-surface-container text-on-surface-variant shrink-0">{card.icon}</div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-on-surface">{card.value}</div>
                <p className="text-xs text-outline truncate">{card.label} · {card.hint}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Links */}
        <div className="rounded-xl border-[0.5px] border-outline-variant bg-surface-container-lowest overflow-hidden">
          <div className="px-[15px] py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-[0.5px] border-outline-variant">
            <div className="inline-flex self-start p-[3px] bg-surface-container rounded-md text-xs" role="tablist" aria-label="Status">
              {(['all', 'active', 'paused'] as StatusFilter[]).map(s => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                  className={`h-[26px] px-3 rounded-[4px] capitalize cursor-pointer transition-colors ${
                    statusFilter === s ? 'bg-surface-container-lowest text-on-surface font-medium shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search links"
                aria-label="Search links"
                className="w-full h-[34px] pl-9 pr-3 bg-surface-container-low rounded-full text-xs text-on-surface border-[0.5px] border-outline-variant placeholder:text-outline outline-none focus:border-on-surface-variant"
              />
            </div>
          </div>

          {filteredLinks.length > 0 && (
            <div className={`hidden ${rowGrid} px-[15px] py-2 bg-surface-container-low border-b-[0.5px] border-outline-variant text-xs font-medium text-on-surface-variant`}>
              <span>Link</span>
              <span>Destination</span>
              <span className="text-right">Clicks</span>
              <span className="text-right"><span className="sr-only">Actions</span></span>
            </div>
          )}

          {filteredLinks.length === 0 ? (
            <p className="py-10 px-6 text-center text-xs text-on-surface-variant">
              {links.length === 0 ? 'No links have been shared with you yet.' : 'Nothing matches.'}
            </p>
          ) : (
            <ul>
              {filteredLinks.map(link => {
                const shortUrl = shortUrlOf(link);
                const camp = campaignName(link);
                const isOpen = canAnalytics && openAnalytics === link.id;
                const linkClicks = clicksByLink[link.id] || [];
                return (
                  <li key={link.id} className="border-b-[0.5px] border-outline-variant last:border-b-0">
                    <div className={`px-[15px] py-3 flex flex-col gap-2 ${rowGrid} hover:bg-surface-container-low transition-colors`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[13px] font-medium truncate" title={link.title || undefined}>{link.title || `/${link.custom_slug || link.short_code}`}</span>
                          <span className={`shrink-0 px-1.5 rounded-full text-[10px] ${link.status === 'active' ? 'bg-primary-fixed text-on-secondary-container' : 'bg-surface-container text-outline'}`}>
                            {link.status === 'active' ? 'Active' : link.status.charAt(0).toUpperCase() + link.status.slice(1)}
                          </span>
                          {camp && <span className="shrink-0 px-1.5 rounded-full text-[10px] bg-surface-container text-on-surface-variant truncate max-w-[140px]">{camp}</span>}
                        </div>
                        <div className="text-xs text-primary-ink truncate mt-0.5">{shortUrl.replace(/^https?:\/\//, '')}</div>
                      </div>

                      <a
                        href={link.destination_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={link.destination_url}
                        className="min-w-0 text-xs text-on-surface-variant hover:text-on-surface hover:underline truncate"
                      >
                        <span className="md:hidden text-outline">→ </span>{hostOf(link.destination_url)}
                      </a>

                      <span className="text-xs tabular-nums text-on-surface md:text-right">
                        {(Number(link.clicks_count) || 0).toLocaleString()}<span className="md:hidden text-outline"> clicks</span>
                      </span>

                      <div className="flex items-center gap-1.5 md:justify-end">
                        <button onClick={() => handleCopy(shortUrl, link.id)} className={iconBtn} aria-label="Copy short link" title="Copy">
                          {copiedId === link.id ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <a href={shortUrl} target="_blank" rel="noopener noreferrer" className={iconBtn} aria-label="Open short link" title="Open">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        {canAnalytics && (
                          <button
                            onClick={() => setOpenAnalytics(isOpen ? null : link.id)}
                            aria-expanded={isOpen}
                            className={`${iconBtn} ${isOpen ? 'bg-surface-container text-on-surface' : ''}`}
                            aria-label="Recent clicks"
                            title="Recent clicks"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                        )}
                        {canEdit && (
                          <button onClick={() => openEdit(link)} className={`${smallBtn} h-[34px]`}>
                            <Pencil className="w-3.5 h-3.5" />Edit
                          </button>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="px-[15px] pb-3">
                        {linkClicks.length === 0 ? (
                          <p className="text-xs text-outline py-2">No clicks yet.</p>
                        ) : (
                          <div className="rounded-md border-[0.5px] border-outline-variant overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="bg-surface-container-low text-on-surface-variant">
                                  <th className="py-2 px-3 font-medium">When</th>
                                  <th className="py-2 px-3 font-medium">Location</th>
                                  <th className="py-2 px-3 font-medium">Device</th>
                                  <th className="py-2 px-3 font-medium">Referrer</th>
                                </tr>
                              </thead>
                              <tbody>
                                {linkClicks.slice(0, 10).map(c => (
                                  <tr key={c.id} className="border-t-[0.5px] border-outline-variant">
                                    <td className="py-2 px-3 text-on-surface-variant whitespace-nowrap">
                                      {new Date(c.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                    </td>
                                    <td className="py-2 px-3">{[c.city, c.country].filter(Boolean).join(', ') || 'Unknown'}</td>
                                    <td className="py-2 px-3 text-on-surface-variant">{[c.device, c.os].filter(Boolean).join(' · ') || 'Unknown'}</td>
                                    <td className="py-2 px-3 text-on-surface-variant truncate max-w-[220px]">{c.referrer || 'Direct'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>

      {/* Edit destination */}
      {editingLink && (
        <div
          className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => !savingEdit && setEditingLink(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-dest-title"
            className="bg-surface-container-lowest rounded-xl max-w-md w-full p-6 shadow-2xl border-[0.5px] border-outline-variant"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 id="edit-dest-title" className="text-base font-semibold text-on-surface">Edit destination</h3>
                <p className="text-xs text-outline mt-0.5">/{editingLink.custom_slug || editingLink.short_code}</p>
              </div>
              <button onClick={() => setEditingLink(null)} className="p-1 rounded-md text-outline hover:text-on-surface cursor-pointer" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDestination} className="space-y-4 text-xs">
              <label className="block">
                <span className="block text-xs font-medium text-on-surface mb-1.5">Destination URL</span>
                <input
                  type="url"
                  required
                  autoFocus
                  value={newDestinationUrl}
                  onChange={(e) => setNewDestinationUrl(e.target.value)}
                  placeholder="https://example.com/page"
                  className="w-full h-[34px] px-3 bg-surface-container-low text-on-surface rounded-md text-xs border-[0.5px] border-outline-variant outline-none focus:border-on-surface-variant"
                />
                <span className="block text-[11px] text-outline mt-1">Takes effect right away.</span>
              </label>
              {editError && <p role="alert" className="text-error">{editError}</p>}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditingLink(null)} className="h-[34px] px-4 rounded-md text-on-surface-variant hover:bg-surface-container-low cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="h-[34px] px-4 rounded-md bg-primary-container text-on-primary font-medium hover:bg-primary cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
