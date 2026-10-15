'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Building2, 
  ExternalLink, 
  Copy, 
  Check, 
  LogOut, 
  RefreshCw, 
  MousePointerClick, 
  Users, 
  Link2, 
  Globe, 
  Edit3, 
  Search, 
  ChevronRight, 
  ShieldCheck, 
  Clock, 
  ArrowUpRight,
  BarChart3,
  Calendar,
  AlertTriangle,
  X
} from 'lucide-react';

interface ClientSession {
  id: string;
  name: string;
  email: string;
  company_name: string;
  brand_color?: string;
  brand_logo_url?: string;
  custom_domain?: string;
  can_view_analytics: boolean;
  can_edit_destination_url: boolean;
  can_create_links: boolean;
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
}

interface ClickEvent {
  id: string;
  timestamp: string;
  country?: string;
  city?: string;
  device?: string;
  os?: string;
  browser?: string;
  referrer?: string;
}

function ClientPortalDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClientId = searchParams.get('client_id');

  const [session, setSession] = useState<ClientSession | null>(null);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [clicks, setClicks] = useState<ClickEvent[]>([]);
  const [metrics, setMetrics] = useState({
    total_assigned_links: 0,
    total_clicks: 0,
    unique_clicks: 0,
    quota_used: 0,
    quota_max: 10,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit Destination URL modal state
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [newDestinationUrl, setNewDestinationUrl] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState(false);

  // Expanded analytics for a link
  const [selectedLinkAnalytics, setSelectedLinkAnalytics] = useState<string | null>(null);

  // Load session from storage or query
  useEffect(() => {
    try {
      const stored = localStorage.getItem('snip_client_session');
      if (stored) {
        setSession(JSON.parse(stored));
      } else if (queryClientId) {
        // Fallback session stub with client_id from query
        setSession({
          id: queryClientId,
          name: 'Portal User',
          email: '',
          company_name: 'Client Portal',
          can_view_analytics: true,
          can_edit_destination_url: true,
          can_create_links: false,
        });
      } else {
        router.replace('/portal/login');
      }
    } catch {
      router.replace('/portal/login');
    }
  }, [router, queryClientId]);

  // Fetch client resources
  const fetchResources = useCallback(async (isRefresh = false) => {
    if (!session?.id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/v1/portal/resources?client_id=${encodeURIComponent(session.id)}`);
      const data = await res.json();

      if (data.success) {
        setLinks(data.links || []);
        setClicks(data.clicks || []);
        if (data.metrics) setMetrics(data.metrics);
        if (data.client) {
          setSession((prev) => ({
            ...prev,
            ...data.client,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load portal resources:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.id]);

  useEffect(() => {
    if (session?.id) {
      fetchResources();
    }
  }, [session?.id, fetchResources]);

  const handleLogout = () => {
    localStorage.removeItem('snip_client_session');
    router.replace('/portal/login');
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink || !session) return;
    setEditError('');
    setEditSuccess(false);

    try {
      // Basic URL format validation
      new URL(newDestinationUrl);
    } catch {
      setEditError('Please enter a valid URL including http:// or https://');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/v1/portal/links/${editingLink.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: session.id,
          destination_url: newDestinationUrl.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setEditError(data.error || 'Failed to update destination URL.');
        setSavingEdit(false);
        return;
      }

      setEditSuccess(true);
      setTimeout(() => {
        setEditingLink(null);
        setEditSuccess(false);
        fetchResources(true);
      }, 1000);
    } catch (err: any) {
      setEditError(err.message || 'Network error occurred while saving.');
    } finally {
      setSavingEdit(false);
    }
  };

  const brandColor = session?.brand_color || '#6366f1';
  const filteredLinks = links.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.title && l.title.toLowerCase().includes(q)) ||
      (l.short_code && l.short_code.toLowerCase().includes(q)) ||
      (l.custom_slug && l.custom_slug.toLowerCase().includes(q)) ||
      (l.destination_url && l.destination_url.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Client Portal Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {session?.brand_logo_url ? (
            <img 
              src={session.brand_logo_url} 
              alt={session.company_name} 
              className="h-8 w-auto max-w-[120px] object-contain rounded"
            />
          ) : (
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold shadow-md"
              style={{ backgroundColor: brandColor }}
            >
              <Building2 className="w-5 h-5" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white">
                {session?.company_name || 'Client Portal'}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                Sandboxed Client
              </span>
            </div>
            {session?.custom_domain && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Globe className="w-3 h-3 text-slate-400" />
                <span>{session.custom_domain}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchResources(true)}
            disabled={refreshing}
            title="Refresh Data"
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-500' : ''}`} />
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{session?.name}</span>
            <span className="text-[11px] text-slate-400">{session?.email}</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Portal View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Welcome & Permission Notice */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900/10 via-violet-900/5 to-transparent border border-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span>Welcome, {session?.name || 'Partner'}</span>
              <span className="text-indigo-500">✨</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              This client dashboard gives you isolated access to review performance metrics and live clicks for your brand&apos;s assigned short links.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm px-3.5 py-2 rounded-xl border border-slate-200/60 dark:border-slate-800/60 w-fit">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>View & Destination Management Enabled</span>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Assigned Links</span>
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Link2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold mt-2 text-slate-900 dark:text-white">
              {metrics.total_assigned_links}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Active campaigns & short URLs
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Total Clicks</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <MousePointerClick className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold mt-2 text-slate-900 dark:text-white">
              {metrics.total_clicks.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Aggregated engagements
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Unique Visitors</span>
              <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold mt-2 text-slate-900 dark:text-white">
              {metrics.unique_clicks.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Deduplicated visitor IP traffic
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Allocated Quota</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold mt-2 text-slate-900 dark:text-white">
              {metrics.quota_used} <span className="text-sm font-normal text-slate-400">/ {metrics.quota_max}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (metrics.quota_used / Math.max(1, metrics.quota_max)) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Assigned Links Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Assigned Short Links</span>
                <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full font-normal">
                  {filteredLinks.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                All links provisioned by your agency partner for your campaigns.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assigned links..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs text-slate-400">Loading your scoped links & analytics...</p>
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="p-12 text-center max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <Link2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Links Assigned Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Your agency administrator hasn&apos;t assigned any links or campaigns to your portal account yet. Once assigned, they will appear here with live click tracking.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLinks.map((link) => {
                const shortUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${link.custom_slug || link.short_code}`;
                const isSelected = selectedLinkAnalytics === link.id;

                return (
                  <div key={link.id} className="p-4 sm:p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Link Info */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-900 dark:text-white">
                            {link.title || `/${link.custom_slug || link.short_code}`}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider ${
                            link.status === 'active' 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                              : 'bg-slate-500/10 text-slate-600 border border-slate-500/20'
                          }`}>
                            {link.status}
                          </span>
                        </div>

                        {/* Short code pill & Copy */}
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <code className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded font-mono font-medium">
                            {shortUrl}
                          </code>
                          <button
                            onClick={() => handleCopy(shortUrl, link.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            {copiedId === link.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500 font-semibold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                          <a
                            href={shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Test Redirect</span>
                          </a>
                        </div>

                        {/* Target Destination URL */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                          <span className="text-slate-400">Destination:</span>
                          <a 
                            href={link.destination_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline truncate max-w-md inline-flex items-center gap-1"
                          >
                            <span>{link.destination_url}</span>
                            <ArrowUpRight className="w-3 h-3 flex-shrink-0" />
                          </a>
                        </div>
                      </div>

                      {/* Right Action & Stats */}
                      <div className="flex items-center gap-3 self-end lg:self-center">
                        <div className="text-right px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {link.clicks_count.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                            Clicks
                          </div>
                        </div>

                        {session?.can_edit_destination_url && (
                          <button
                            onClick={() => {
                              setEditingLink(link);
                              setNewDestinationUrl(link.destination_url);
                              setEditError('');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-900 transition-all shadow-sm"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit Target URL</span>
                          </button>
                        )}

                        {session?.can_view_analytics && (
                          <button
                            onClick={() => setSelectedLinkAnalytics(isSelected ? null : link.id)}
                            className={`p-2 rounded-xl border transition-colors ${
                              isSelected 
                                ? 'bg-indigo-600 text-white border-indigo-600' 
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title="Toggle Clicks Detail"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Link Analytics */}
                    {isSelected && session?.can_view_analytics && (
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl p-4 animate-fade-in">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                          <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Recent Visitor Activity for this Link</span>
                        </h4>
                        
                        {clicks.filter(c => (c as any).link_id === link.id || (c as any).short_code === link.short_code).length === 0 ? (
                          <p className="text-xs text-slate-400 py-2">No individual click events recorded for this link yet.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                  <th className="py-2 px-3 font-semibold">Timestamp</th>
                                  <th className="py-2 px-3 font-semibold">Location</th>
                                  <th className="py-2 px-3 font-semibold">Device & OS</th>
                                  <th className="py-2 px-3 font-semibold">Referrer</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {clicks
                                  .filter(c => (c as any).link_id === link.id || (c as any).short_code === link.short_code)
                                  .slice(0, 10)
                                  .map(c => (
                                    <tr key={c.id}>
                                      <td className="py-2 px-3 text-slate-500">
                                        {new Date(c.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                      </td>
                                      <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-300">
                                        {c.country || 'Global'} {c.city ? `(${c.city})` : ''}
                                      </td>
                                      <td className="py-2 px-3 text-slate-500">
                                        {c.device || 'Desktop'} • {c.os || 'Windows'}
                                      </td>
                                      <td className="py-2 px-3 text-slate-500 truncate max-w-xs">
                                        {c.referrer || 'Direct / Bookmark'}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Edit Destination Modal */}
      {editingLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setEditingLink(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Update Destination URL
                </h3>
                <p className="text-xs text-slate-400">
                  Target for /{editingLink.custom_slug || editingLink.short_code}
                </p>
              </div>
            </div>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
                {editError}
              </div>
            )}

            {editSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Destination URL updated successfully!</span>
              </div>
            )}

            <form onSubmit={handleSaveDestination} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  New Destination URL
                </label>
                <input
                  type="url"
                  required
                  value={newDestinationUrl}
                  onChange={(e) => setNewDestinationUrl(e.target.value)}
                  placeholder="https://yourbrand.com/new-landing-page"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Traffic hitting your short link will be routed to this new URL immediately.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLink(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || editSuccess}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] rounded-xl transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {savingEdit ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientPortalDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ClientPortalDashboardContent />
    </Suspense>
  );
}
