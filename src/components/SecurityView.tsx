'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';
import { SkeletonGenericView } from '@/components/ui';
import { Link } from '@/lib/types';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Download,
  Lock,
  LockOpen,
  PauseCircle,
  PlayCircle,
  Search,
  Edit3,
  Bell,
  X,
  WifiOff
} from 'lucide-react';

/** One row of /api/v1/security/audit results */
interface ScanResult {
  link_id: string;
  status_code: number;
  http_status: string;
  latency_ms: number;
  reachable: boolean;
  is_threat: boolean;
  risk_score: number;
  threat_flags: string[];
  status: Link['status'];
}

// Each request probes its links in parallel; small batches keep one request well inside the
// serverless time limit
const SCAN_BATCH = 25;
const PAGE_SIZE = 10;

type Filter = 'all' | 'flagged' | 'unreachable' | 'paused' | 'http';

const isPaused = (l: Link) => l.status === 'disabled' || l.status === 'expired';
const isFlagged = (l: Link) => !!l.is_flagged || l.status === 'flagged';
const hostOf = (url: string) => { try { return new URL(url).hostname; } catch { return url; } };

export const SecurityView: React.FC = () => {
  const { links, updateLink, currentWorkspace, addWebhook, checkPermissionOrToast, refreshLinks, isInitialLoading } = useStore();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    refreshLinks();
  }, [refreshLinks]);

  // Results from scans run in this session, by link id
  const [scans, setScans] = useState<Record<string, ScanResult>>({});
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [scanningRowId, setScanningRowId] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [filter, searchQuery]);

  const [swapLink, setSwapLink] = useState<Link | null>(null);
  const [newDestinationUrl, setNewDestinationUrl] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);

  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  const host = typeof window !== 'undefined' ? window.location.host : '';

  // Sends one batch to the scanner and applies what it returns. The server stores flags and
  // risk scores itself; the local copy just mirrors it without another write.
  const scanBatch = async (ids: string[]): Promise<ScanResult[]> => {
    const res = await fetch('/api/v1/security/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-workspace-id': currentWorkspace?.id || '' },
      body: JSON.stringify({ workspace_id: currentWorkspace?.id, link_ids: ids })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success || !Array.isArray(data.results)) {
      throw new Error(data?.error || `Scan failed (${res.status})`);
    }
    const results = data.results as ScanResult[];
    setScans(prev => {
      const next = { ...prev };
      results.forEach(r => { next[r.link_id] = r; });
      return next;
    });
    return results;
  };

  const applyServerState = (results: ScanResult[]) => {
    // Reflect the scanner's verdict locally without sending it back to the server
    results.forEach(r => {
      const link = links.find(l => l.id === r.link_id);
      if (!link) return;
      if (link.status !== r.status || link.is_flagged !== r.is_threat || link.risk_score !== r.risk_score) {
        updateLink(r.link_id, { status: r.status, is_flagged: r.is_threat, risk_score: r.risk_score });
      }
    });
  };

  const scanAll = async () => {
    if (!checkPermissionOrToast('links:edit', 'run security scans')) return;
    if (links.length === 0) {
      showToast('error', 'Nothing to scan', 'This workspace has no links yet.');
      return;
    }
    const ids = links.map(l => l.id);
    setScanProgress({ done: 0, total: ids.length });
    const all: ScanResult[] = [];
    try {
      for (let i = 0; i < ids.length; i += SCAN_BATCH) {
        all.push(...await scanBatch(ids.slice(i, i + SCAN_BATCH)));
        setScanProgress({ done: Math.min(ids.length, i + SCAN_BATCH), total: ids.length });
      }
      applyServerState(all);
      const threats = all.filter(r => r.is_threat).length;
      const down = all.filter(r => !r.reachable && !r.is_threat).length;
      showToast(
        threats > 0 ? 'error' : 'success',
        `Scanned ${all.length} ${all.length === 1 ? 'link' : 'links'}`,
        [threats ? `${threats} flagged` : 'No threats found', down ? `${down} not responding` : ''].filter(Boolean).join(' · ')
      );
    } catch (err) {
      applyServerState(all);
      showToast('error', 'Scan stopped', err instanceof Error ? err.message : 'Network error.');
    } finally {
      setScanProgress(null);
    }
  };

  const scanOne = async (link: Link) => {
    if (!checkPermissionOrToast('links:edit', 'run security scans')) return;
    setScanningRowId(link.id);
    try {
      const [r] = await scanBatch([link.id]);
      if (r) {
        applyServerState([r]);
        showToast(r.is_threat ? 'error' : 'success', `/${link.short_code}: ${r.http_status}`, r.is_threat ? r.threat_flags.join(' · ') : `${r.latency_ms} ms`);
      }
    } catch (err) {
      showToast('error', 'Scan failed', err instanceof Error ? err.message : 'Network error.');
    } finally {
      setScanningRowId(null);
    }
  };

  const togglePause = (link: Link) => {
    if (!checkPermissionOrToast('links:edit', 'pause links')) return;
    const paused = isPaused(link);
    updateLink(link.id, { status: paused ? 'active' : 'disabled' });
    showToast('success', paused ? 'Link resumed' : 'Link paused', `/${link.short_code}`);
  };

  const openSwap = (link: Link) => {
    setSwapLink(link);
    setNewDestinationUrl(link.destination_url);
  };

  const saveSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapLink || !newDestinationUrl.trim()) return;
    if (!checkPermissionOrToast('links:edit', 'change link destinations')) return;
    setIsSwapping(true);
    try {
      updateLink(swapLink.id, { destination_url: newDestinationUrl.trim() });
      setSwapLink(null);
      // Re-check the new destination; the scan clears or sets the flag
      setTimeout(() => { scanOne({ ...swapLink, destination_url: newDestinationUrl.trim() }); }, 800);
    } finally {
      setIsSwapping(false);
    }
  };

  const exportCsv = () => {
    if (links.length === 0) return;
    const headers = ['Short code', 'Short URL', 'Destination', 'Protocol', 'Status', 'Flagged', 'Risk score', 'Last check', 'Response time (ms)'];
    const rows = links.map(l => {
      const scan = scans[l.id];
      return [
        l.short_code,
        `https://${host}/${l.short_code}`,
        `"${l.destination_url.replace(/"/g, '""')}"`,
        /^https:/i.test(l.destination_url) ? 'HTTPS' : 'HTTP',
        l.status,
        isFlagged(l) ? 'yes' : 'no',
        l.risk_score || 0,
        scan ? `"${scan.http_status}"` : 'not checked',
        scan ? scan.latency_ms : ''
      ];
    });
    const url = URL.createObjectURL(new Blob([[headers.join(','), ...rows.map(r => r.join(','))].join('\n')], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `security_${currentWorkspace?.slug || 'workspace'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const saveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;
    const hook = await addWebhook(webhookUrl.trim(), ['link.flagged']);
    if (hook && 'id' in hook && hook.id) {
      setWebhookModalOpen(false);
      setWebhookUrl('');
      showToast('success', 'Alert webhook saved', 'It gets a signed POST whenever a scan flags a link.');
    }
  };

  const flaggedCount = links.filter(isFlagged).length;
  const pausedCount = links.filter(isPaused).length;
  const httpCount = links.filter(l => !/^https:/i.test(l.destination_url)).length;
  const unreachableCount = links.filter(l => scans[l.id] && !scans[l.id].reachable && !isFlagged(l)).length;
  const checkedCount = links.filter(l => scans[l.id]).length;

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return links.filter(l => {
      if (filter === 'flagged' && !isFlagged(l)) return false;
      if (filter === 'paused' && !isPaused(l)) return false;
      if (filter === 'http' && /^https:/i.test(l.destination_url)) return false;
      if (filter === 'unreachable' && !(scans[l.id] && !scans[l.id].reachable)) return false;
      if (q && !l.short_code.toLowerCase().includes(q) && !l.destination_url.toLowerCase().includes(q) && !(l.title || '').toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => Number(isFlagged(b)) - Number(isFlagged(a)));
  }, [links, scans, filter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!mounted || (isInitialLoading && links.length === 0)) {
    return <SkeletonGenericView title="Security" />;
  }

  const iconBtn = 'size-[30px] rounded-md grid place-items-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50';

  const checkCell = (l: Link) => {
    const scan = scans[l.id];
    if (!scan) return <span className="text-outline">Not checked</span>;
    return (
      <span className={scan.reachable ? 'text-on-surface-variant' : 'text-amber-700'}>
        {scan.http_status}{scan.latency_ms > 0 && <span className="text-outline"> · {scan.latency_ms} ms</span>}
      </span>
    );
  };

  const statusCell = (l: Link) => {
    const [dot, label] = isFlagged(l)
      ? ['bg-rose-500', 'Flagged']
      : isPaused(l)
        ? ['bg-outline', 'Paused']
        : scans[l.id] && !scans[l.id].reachable
          ? ['bg-amber-500', 'Not responding']
          : ['bg-emerald-500', 'Active'];
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant whitespace-nowrap">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {label}
      </span>
    );
  };

  const rowActions = (l: Link) => (
    <>
      <button type="button" onClick={() => scanOne(l)} disabled={scanningRowId === l.id || !!scanProgress} title="Scan now" aria-label="Scan now" className={iconBtn}>
        <RefreshCw className={`w-3.5 h-3.5 ${scanningRowId === l.id ? 'animate-spin' : ''}`} />
      </button>
      <button type="button" onClick={() => openSwap(l)} title="Change destination" aria-label="Change destination" className={iconBtn}>
        <Edit3 className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => togglePause(l)} title={isPaused(l) ? 'Resume' : 'Pause'} aria-label={isPaused(l) ? 'Resume' : 'Pause'} className={iconBtn}>
        {isPaused(l) ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
      </button>
    </>
  );

  return (
    <div className="flex flex-col w-full gap-[15px] pb-16 animate-fade-in text-on-surface">

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0 max-w-2xl flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
            <input
              type="text"
              placeholder="Search links"
              aria-label="Search links"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[34px] pl-9 pr-3 bg-surface-container-low rounded-full text-xs font-light text-on-surface border-[0.5px] border-outline-variant placeholder:text-outline outline-none focus:border-on-surface-variant"
            />
          </div>
          <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs shrink-0 overflow-x-auto" role="tablist" aria-label="Filter links">
            {([
              { id: 'all', label: 'All' },
              { id: 'flagged', label: 'Flagged' },
              { id: 'unreachable', label: 'Not responding' },
              { id: 'paused', label: 'Paused' },
              { id: 'http', label: 'HTTP' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                onClick={() => setFilter(tab.id)}
                className={`h-[26px] px-2.5 rounded-[4px] whitespace-nowrap transition-colors cursor-pointer ${
                  filter === tab.id ? 'bg-surface-container-lowest text-on-surface font-medium shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="btn-webhook"
            onClick={() => setWebhookModalOpen(true)}
            title="Alert webhook"
            aria-label="Alert webhook"
            className="size-[34px] rounded-md border-[0.5px] border-outline-variant grid place-items-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={links.length === 0}
            title="Export CSV"
            aria-label="Export CSV"
            className="size-[34px] rounded-md border-[0.5px] border-outline-variant grid place-items-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            id="btn-audit"
            onClick={scanAll}
            disabled={!!scanProgress}
            className="h-[34px] px-4 rounded-md bg-primary-container text-on-primary text-xs font-medium hover:bg-primary transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-70"
          >
            <ShieldCheck className={`w-4 h-4 ${scanProgress ? 'animate-pulse' : ''}`} />
            <span>{scanProgress ? `Scanning ${scanProgress.done}/${scanProgress.total}` : 'Scan all links'}</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-[15px]">
        {[
          { icon: <ShieldAlert className="w-5 h-5" />, value: flaggedCount, label: 'Flagged', hint: 'Show a warning page' },
          { icon: <WifiOff className="w-5 h-5" />, value: unreachableCount, label: 'Not responding', hint: checkedCount ? `Of ${checkedCount} checked` : 'Run a scan' },
          { icon: <PauseCircle className="w-5 h-5" />, value: pausedCount, label: 'Paused', hint: 'Not redirecting' },
          { icon: httpCount ? <LockOpen className="w-5 h-5" /> : <Lock className="w-5 h-5" />, value: httpCount, label: 'Plain HTTP', hint: `Of ${links.length} links` },
        ].map(card => (
          <div key={card.label} className="flex items-center gap-[10px] rounded-xl border-[0.5px] border-outline-variant p-[15px] min-w-0">
            <div className="grid size-[40px] place-items-center rounded-md bg-surface-container text-on-surface-variant shrink-0">{card.icon}</div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-on-surface">{card.value.toLocaleString()}</div>
              <p className="text-xs text-outline truncate">{card.label} · {card.hint}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Links */}
      <div className="rounded-xl border-[0.5px] border-outline-variant overflow-hidden">
        <div className="px-[15px] py-3 flex items-center justify-between border-b-[0.5px] border-outline-variant">
          <h2 className="text-[14px] font-semibold text-on-surface">Links</h2>
          <span className="text-xs text-outline">{filtered.length} of {links.length}</span>
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 px-6 text-center text-xs text-on-surface-variant">
            {links.length === 0 ? 'No links yet.' : filter === 'unreachable' && checkedCount === 0 ? 'Run a scan to check which destinations respond.' : 'Nothing matches.'}
          </p>
        ) : (
          <>
            <table className="hidden md:table w-full text-left text-xs">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant border-b-[0.5px] border-outline-variant">
                  <th className="py-2.5 px-[15px] font-medium">Link</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium">Last check</th>
                  <th className="py-2.5 px-3 font-medium text-right">Risk</th>
                  <th className="py-2.5 px-[15px] font-medium text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(l => {
                  const flags = scans[l.id]?.threat_flags || l.risk_reasons || [];
                  return (
                    <tr key={l.id} className="border-b-[0.5px] border-outline-variant last:border-b-0 hover:bg-surface-container-low transition-colors">
                      <td className="py-2.5 px-[15px] max-w-[340px]">
                        <div className="font-medium text-on-surface truncate">/{l.short_code}</div>
                        <div className="text-[11px] text-outline truncate" title={l.destination_url}>
                          {!/^https:/i.test(l.destination_url) && <span className="text-amber-700">HTTP · </span>}
                          {hostOf(l.destination_url)}
                        </div>
                        {isFlagged(l) && flags.length > 0 && <div className="text-[11px] text-error truncate" title={flags.join('\n')}>{flags[0]}</div>}
                      </td>
                      <td className="py-2.5 px-3">{statusCell(l)}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{checkCell(l)}</td>
                      <td className={`py-2.5 px-3 text-right tabular-nums ${(l.risk_score || 0) >= 60 ? 'text-error font-medium' : 'text-on-surface-variant'}`}>{l.risk_score || 0}</td>
                      <td className="py-2.5 px-[15px]">
                        <div className="flex items-center justify-end gap-0.5">{rowActions(l)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="md:hidden flex flex-col">
              {pageRows.map(l => (
                <div key={l.id} className="p-[15px] flex flex-col gap-1.5 border-b-[0.5px] border-outline-variant last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-on-surface truncate">/{l.short_code}</span>
                    {statusCell(l)}
                  </div>
                  <div className="text-[11px] text-outline truncate">{hostOf(l.destination_url)} · risk {l.risk_score || 0}</div>
                  <div className="text-[11px]">{checkCell(l)}</div>
                  <div className="flex items-center gap-0.5 -ml-1.5">{rowActions(l)}</div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="px-[15px] py-2.5 flex items-center justify-between gap-2 border-t-[0.5px] border-outline-variant text-xs text-on-surface-variant">
                <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(filtered.length, page * PAGE_SIZE)} of {filtered.length}</span>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-[28px] px-3 rounded-md border-[0.5px] border-outline-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-[28px] px-3 rounded-md border-[0.5px] border-outline-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-[11px] text-outline">
        A scan checks each destination for phishing patterns and private-network addresses, and whether it responds. Only threats get flagged; flagged links show a warning page instead of redirecting.
      </p>

      {/* Change destination */}
      {mounted && swapLink && createPortal(
        <div
          className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setSwapLink(null); }}
        >
          <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-6 shadow-2xl border-[0.5px] border-outline-variant">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-on-surface">Change destination for /{swapLink.short_code}</h3>
              <button type="button" onClick={() => setSwapLink(null)} aria-label="Close" className={iconBtn}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={saveSwap} className="space-y-4 text-xs">
              <label className="block">
                <span className="block text-xs font-medium text-on-surface mb-1.5">New destination URL</span>
                <input
                  type="url"
                  required
                  value={newDestinationUrl}
                  onChange={(e) => setNewDestinationUrl(e.target.value)}
                  className="w-full h-[34px] px-3 bg-surface-container-low text-on-surface rounded-md text-xs border-[0.5px] border-outline-variant outline-none focus:border-on-surface-variant"
                />
              </label>
              <p className="text-[11px] text-outline">The short link stays the same. The new destination is scanned right after saving.</p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setSwapLink(null)} className="h-[34px] px-4 rounded-md text-on-surface-variant hover:bg-surface-container-low cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSwapping} className="h-[34px] px-4 rounded-md bg-primary-container text-on-primary font-medium hover:bg-primary cursor-pointer disabled:opacity-50">Save and scan</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Alert webhook */}
      {mounted && webhookModalOpen && createPortal(
        <div
          className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setWebhookModalOpen(false); }}
        >
          <div className="bg-surface-container-lowest rounded-xl max-w-md w-full p-6 shadow-2xl border-[0.5px] border-outline-variant">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-on-surface">Alert webhook</h3>
              <button type="button" onClick={() => setWebhookModalOpen(false)} aria-label="Close" className={iconBtn}><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-on-surface-variant mb-4">Gets a signed POST (event <code>link.flagged</code>) whenever a scan flags a link.</p>
            <form onSubmit={saveWebhook} className="space-y-4 text-xs">
              <label className="block">
                <span className="block text-xs font-medium text-on-surface mb-1.5">Endpoint URL</span>
                <input
                  type="url"
                  required
                  placeholder="https://hooks.slack.com/…"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full h-[34px] px-3 bg-surface-container-low text-on-surface rounded-md text-xs border-[0.5px] border-outline-variant outline-none focus:border-on-surface-variant"
                />
              </label>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setWebhookModalOpen(false)} className="h-[34px] px-4 rounded-md text-on-surface-variant hover:bg-surface-container-low cursor-pointer">Cancel</button>
                <button type="submit" className="h-[34px] px-4 rounded-md bg-primary-container text-on-primary font-medium hover:bg-primary cursor-pointer">Save</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
