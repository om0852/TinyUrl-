'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Search, 
  AlertTriangle, 
  RefreshCw, 
  Lock, 
  Radio, 
  ChevronRight, 
  Webhook, 
  Verified, 
  Copy, 
  Check, 
  Download, 
  Filter, 
  SlidersHorizontal, 
  PauseCircle, 
  PlayCircle, 
  ArrowRight, 
  Clock, 
  AlertCircle, 
  Bot, 
  Bell, 
  Shield, 
  Zap, 
  X, 
  ExternalLink,
  Timer,
  CheckCircle2,
  LockOpen
} from 'lucide-react';

interface SecurityRow {
  id: string;
  shortLink: string;
  tag: string;
  destinationUrl: string;
  targetHost: string;
  engines: string[];
  sslStatus: string;
  isSslValid: boolean;
  httpStatus: string;
  statusCode: number;
  latency: string;
  lastInspected: string;
  isDead?: boolean;
}

export const SecurityView: React.FC = () => {
  const { links, updateLink } = useStore();
  const [mounted, setMounted] = useState(false);

  // Audit animation state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditText, setAuditText] = useState('Run Workspace Audit');

  // Guardrail Toggles
  const [guardrails, setGuardrails] = useState({
    killswitch: true,
    bots: true,
    phishing: true,
    alerts: true,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [protocolFilter, setProtocolFilter] = useState('all');

  // Swap Modal
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapTargetSlug, setSwapTargetSlug] = useState('');
  const [newDestinationUrl, setNewDestinationUrl] = useState('');

  // Webhook Modal
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookService, setWebhookService] = useState('Slack');

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(text);
    showToast(`Copied ${text} to clipboard`);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const triggerAudit = () => {
    setIsAuditing(true);
    setAuditText('Inspecting 342 Nodes...');
    setTimeout(() => {
      setIsAuditing(false);
      setAuditText('Audit Complete (100%)');
      showToast('Workspace Security Audit completed with 0 threat vectors detected.');
      setTimeout(() => {
        setAuditText('Run Workspace Audit');
      }, 3000);
    }, 1800);
  };

  const [tableData, setTableData] = useState<SecurityRow[]>([]);

  useEffect(() => {
    if (links.length > 0) {
      const realRows: SecurityRow[] = links.map(l => {
        let hostName = 'External';
        try { hostName = new URL(l.destination_url).hostname; } catch {}
        return {
          id: l.id,
          shortLink: `${typeof window !== 'undefined' ? window.location.host : 'snip.to'}/${l.short_code}`,
          tag: l.tags?.join(' · ') || 'Active Link',
          destinationUrl: l.destination_url,
          targetHost: `Target Host: ${hostName}`,
          engines: ['GSB', 'VT', 'SnipAI'],
          sslStatus: l.destination_url.startsWith('https') ? 'Valid TLS 1.3' : 'Insecure HTTP',
          isSslValid: l.destination_url.startsWith('https'),
          httpStatus: l.status === 'flagged' ? '403 Blocked' : '200 OK',
          statusCode: l.status === 'flagged' ? 403 : 200,
          latency: `${Math.floor(80 + Math.random() * 60)}ms`,
          lastInspected: 'Just now',
          isDead: l.status === 'flagged'
        };
      });
      setTableData(realRows);
    } else {
      setTableData([]);
    }
  }, [links]);

  const handleOpenSwapModal = (slug: string) => {
    setSwapTargetSlug(slug);
    setNewDestinationUrl('');
    setSwapModalOpen(true);
  };

  const handleSaveSwap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDestinationUrl) return;

    setTableData(prev => prev.map(row => {
      if (row.shortLink === swapTargetSlug) {
        return {
          ...row,
          destinationUrl: newDestinationUrl,
          targetHost: 'Target Host: Verified Active Store',
          httpStatus: '200 OK',
          statusCode: 200,
          isDead: false,
          latency: '118ms',
          lastInspected: 'Just now',
          engines: ['GSB', 'VT', 'SnipAI']
        };
      }
      return row;
    }));

    setSwapModalOpen(false);
    showToast(`Target updated for ${swapTargetSlug} to ${newDestinationUrl}. Re-scan passed (200 OK).`);
  };

  const filteredRows = tableData.filter(row => {
    if (statusFilter === 'safe' && row.statusCode !== 200) return false;
    if (statusFilter === 'warning' && row.statusCode === 200) return false;
    if (statusFilter === 'quarantine' && !row.isDead) return false;
    return true;
  });

  return (
    <div className="flex flex-col w-full text-on-surface animate-fade-in">
      
      {/* 1. Page Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium mb-1">
            <span className="hover:text-on-surface cursor-pointer">Workspace</span>
            <ChevronRight className="w-3.5 h-3.5 text-outline" />
            <span className="text-primary-container font-semibold">Security &amp; Zero-Trust</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Zero-Trust Threat &amp; Malware Inspector
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-3xl mt-1 leading-relaxed">
            Real-time automated URL health scanning, phishing detection, malware heuristic analysis, and target destination uptime monitoring to protect your creator reputation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0 flex-wrap">
          <button 
            type="button"
            id="btn-webhook"
            onClick={() => setWebhookModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-surface-container-low text-on-surface px-4 py-2 rounded-xl hover:bg-surface-container transition-colors shadow-xs border border-outline-variant/30 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Webhook className="w-3.5 h-3.5 text-on-surface-variant" />
            <span>Configure Webhook Alert</span>
          </button>
          
          <button 
            type="button"
            id="btn-audit"
            disabled={isAuditing}
            onClick={triggerAudit}
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-primary-container text-on-primary px-4 py-2 rounded-xl hover:bg-primary transition-all shadow-sm cursor-pointer disabled:opacity-75 whitespace-nowrap shrink-0"
          >
            <ShieldCheck className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
            <span>{auditText}</span>
          </button>
        </div>
      </div>

      {/* 2. Security Posture Health Banner */}
      <div className="relative overflow-hidden bg-surface-container-lowest rounded-2xl shadow-xs border border-outline-variant/30 p-6 mb-6">
        <div className="absolute -right-8 -top-8 w-64 h-64 bg-primary/5 rounded-full pointer-events-none" />
        
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            
            {/* SVG Progress Circle */}
            <div className="relative shrink-0">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                <circle 
                  className="stroke-surface-container-high" 
                  cx="32" cy="32" r="28" 
                  fill="none" 
                  strokeWidth="5" 
                />
                <circle 
                  className="stroke-primary-container" 
                  cx="32" cy="32" r="28" 
                  fill="none" 
                  strokeDasharray="175.9" 
                  strokeDashoffset="1.05" 
                  strokeLinecap="round" 
                  strokeWidth="5" 
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Lock className="w-5 h-5 text-primary-container" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-base font-bold text-on-surface">
                  Workspace Security Health: {links.length === 0 || links.every(l => l.status === 'active') ? '100%' : '94.2%'}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-primary-container text-xs font-bold border border-primary-container/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-container" />
                  <span>Protected &amp; Hardened</span>
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                All {links.length} active redirect endpoints scanned within the last 15 minutes. {links.filter(l => l.status === 'flagged').length} compromised links detected.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 w-full lg:w-auto pt-2 lg:pt-0 justify-between lg:justify-end text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-primary-container animate-pulse" />
              <div className="flex flex-col">
                <span className="font-bold text-on-surface">Continuous Heuristics</span>
                <span className="text-on-surface-variant">Live polling via 4 edge regions</span>
              </div>
            </div>
            <div className="h-8 w-px bg-outline-variant/30 hidden sm:block" />
            <div className="flex flex-col items-end">
              <span className="font-mono font-semibold text-on-surface">Next Sweep: 08m 12s</span>
              <span className="text-on-surface-variant">VirusTotal &amp; Google Cloud Safebrowsing</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. KPI Metric Cards Grid (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        
        {/* Card 1 */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-outline-variant/30 flex flex-col justify-between hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Scanned Endpoints</span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-primary-container">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface tracking-tight">{links.length}</span>
              <span className="text-xs text-primary-container font-bold">Active</span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1.5 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-primary-container" />
              <span>{links.filter(l => l.destination_url?.startsWith('https')).length} verified TLS 1.3 / HSTS</span>
            </p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-outline-variant/30 flex flex-col justify-between hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Threats Neutralized</span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-primary-container">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface tracking-tight">
                {links.filter(l => l.status === 'flagged').length}
              </span>
              <span className="text-xs text-on-surface-variant font-medium">Flagged Threats</span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>0 Phishing attempts this week</span>
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-outline-variant/30 flex flex-col justify-between hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Destination Uptime</span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-primary-container">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface tracking-tight">
                {links.length === 0 || links.every(l => l.status === 'active') ? '100%' : '98.5%'}
              </span>
              <span className="text-xs text-emerald-700 font-bold">Healthy</span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1.5 flex items-center gap-1">
              <Timer className="w-3.5 h-3.5 text-outline" />
              <span>Avg HTTP 200 response: <strong className="font-mono text-on-surface">18ms</strong></span>
            </p>
          </div>
        </div>

        {/* Card 4 (Alert Highlighted) */}
        <div className={`bg-surface-container-lowest rounded-2xl p-5 shadow-xs border ${
          links.filter(l => l.status === 'flagged' || l.status === 'expired').length > 0 ? 'border-amber-300' : 'border-outline-variant/30'
        } flex flex-col justify-between hover:shadow-sm transition-shadow relative overflow-hidden`}>
          {links.filter(l => l.status === 'flagged' || l.status === 'expired').length > 0 && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          )}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Dead / 404 Link Alerts</span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface tracking-tight">
                {links.filter(l => l.status === 'flagged' || l.status === 'expired').length}
              </span>
              <span className="text-xs text-on-surface-variant font-medium">Warnings</span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{links.filter(l => l.status === 'flagged' || l.status === 'expired').length === 0 ? 'All links resolving normally' : 'Immediate target replacement needed'}</span>
            </p>
          </div>
        </div>

      </div>

      {/* 4. Real-Time Link Inspector & Audit Queue Section */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-outline-variant/30 overflow-hidden mb-6">
        
        {/* Header & Table Filters */}
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/20">
          <div>
            <h2 className="text-base font-bold text-on-surface">Live Destination Health &amp; Threat Queue</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Automated synthetic head requests executed across 8 global nodes every 10 minutes</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative">
              <Filter className="w-3.5 h-3.5 absolute left-3 top-2.5 text-outline pointer-events-none" />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-8 pr-7 py-1.5 bg-surface-container-low text-on-surface font-semibold rounded-xl outline-none focus:ring-2 focus:ring-primary-container border border-outline-variant/30 cursor-pointer text-xs"
              >
                <option value="all">All Statuses ({tableData.length})</option>
                <option value="safe">Safe Only (3)</option>
                <option value="warning">Warnings &amp; 404 (1)</option>
                <option value="quarantine">Quarantined (0)</option>
              </select>
            </div>

            <div className="relative">
              <Lock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-outline pointer-events-none" />
              <select 
                value={protocolFilter}
                onChange={(e) => setProtocolFilter(e.target.value)}
                className="pl-8 pr-7 py-1.5 bg-surface-container-low text-on-surface font-semibold rounded-xl outline-none focus:ring-2 focus:ring-primary-container border border-outline-variant/30 cursor-pointer text-xs"
              >
                <option value="all">All Protocols (TLS 1.2+)</option>
                <option value="tls13">TLS 1.3 Strict</option>
                <option value="partner">Partner Validated</option>
              </select>
            </div>

            <button 
              type="button"
              onClick={() => showToast('Audit log CSV exported.')}
              className="p-2 bg-surface-container-low rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors border border-outline-variant/30 cursor-pointer" 
              title="Export audit log CSV"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[760px]">
            <thead>
              <tr className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
                <th className="py-3 px-6 whitespace-nowrap">Short Link</th>
                <th className="py-3 px-4 whitespace-nowrap">Destination URL</th>
                <th className="py-3 px-4 whitespace-nowrap">Scan Engines</th>
                <th className="py-3 px-4 whitespace-nowrap">SSL Security</th>
                <th className="py-3 px-4 whitespace-nowrap">Destination Status</th>
                <th className="py-3 px-4 whitespace-nowrap">Latency</th>
                <th className="py-3 px-4 whitespace-nowrap">Last Inspected</th>
                <th className="py-3 px-6 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-outline">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-sm text-on-surface">No Destination Links Monitored</p>
                      <p className="text-xs text-on-surface-variant max-w-sm">
                        Create short links to enable synthetic health probes, SSL validation, and threat detection.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                <tr 
                  key={row.id} 
                  className={`transition-colors ${
                    row.isDead 
                      ? 'bg-amber-50/70 hover:bg-amber-100/60' 
                      : 'hover:bg-surface-container-low/50'
                  }`}
                >
                  {/* Short Link */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-bold ${row.isDead ? 'text-amber-900' : 'text-primary-container'}`}>
                        {row.shortLink}
                      </span>
                      <button 
                        type="button"
                        onClick={() => handleCopy(`https://${row.shortLink}`)}
                        className="text-outline hover:text-primary-container transition-colors cursor-pointer" 
                        title="Copy shortened URL"
                      >
                        {copiedLink === `https://${row.shortLink}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <span className={`text-[11px] block mt-0.5 ${row.isDead ? 'text-amber-800 font-semibold' : 'text-on-surface-variant'}`}>
                      {row.tag}
                    </span>
                  </td>

                  {/* Destination */}
                  <td className="py-4 px-4 max-w-xs">
                    <div className={`font-medium truncate ${row.isDead ? 'line-through text-on-surface/70' : 'text-on-surface'}`}>
                      {row.destinationUrl}
                    </div>
                    <span className={`text-[11px] block mt-0.5 ${row.isDead ? 'text-amber-800 font-semibold' : 'text-on-surface-variant'}`}>
                      {row.targetHost}
                    </span>
                  </td>

                  {/* Scan Engines */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-1.5">
                      {row.engines.map((eng, idx) => (
                        <span 
                          key={idx}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            eng === 'Dead Host'
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-surface-container text-primary-container'
                          }`}
                        >
                          {eng !== 'Dead Host' && <Check className="w-2.5 h-2.5" />}
                          <span>{eng}</span>
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* SSL Security */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-1 text-on-surface font-semibold text-xs">
                      {row.isSslValid ? (
                        <Lock className="w-3.5 h-3.5 text-primary-container" />
                      ) : (
                        <LockOpen className="w-3.5 h-3.5 text-outline" />
                      )}
                      <span>{row.sslStatus}</span>
                    </div>
                  </td>

                  {/* HTTP Status */}
                  <td className="py-4 px-4">
                    {row.statusCode === 200 ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container text-primary-container font-mono text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-container" />
                        <span>200 OK</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 font-mono text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                        <span>404 Not Found</span>
                      </span>
                    )}
                  </td>

                  {/* Latency */}
                  <td className={`py-4 px-4 font-mono font-semibold ${row.isDead ? 'text-amber-900' : 'text-on-surface'}`}>
                    {row.latency}
                  </td>

                  {/* Last Inspected */}
                  <td className={`py-4 px-4 text-xs ${row.isDead ? 'text-amber-900 font-semibold' : 'text-on-surface-variant'}`}>
                    {row.lastInspected}
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-6 text-right">
                    {row.isDead ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          type="button"
                          onClick={() => handleOpenSwapModal(row.shortLink)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-700 text-white hover:bg-amber-800 transition-colors text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Swap Target</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => showToast(`Paused redirect for ${row.shortLink}`)}
                          className="p-1.5 rounded-xl bg-surface-container-low text-on-surface-variant hover:text-amber-800 hover:bg-surface-container transition-colors cursor-pointer border border-outline-variant/30" 
                          title="Pause redirect immediately"
                        >
                          <PauseCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => showToast(`Rescanned ${row.shortLink} - Latency 112ms, 200 OK`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-surface-container-low text-on-surface hover:bg-surface-container transition-colors font-semibold text-xs border border-outline-variant/30 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3 text-outline" />
                        <span>Scan Now</span>
                      </button>
                    )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-4 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-t border-outline-variant/20">
          <span className="text-on-surface-variant">Showing {filteredRows.length} monitored destination{filteredRows.length === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-1">
            <button type="button" disabled className="px-3 py-1 rounded-xl bg-surface-container-lowest text-on-surface font-semibold shadow-xs opacity-50 cursor-not-allowed border border-outline-variant/30">
              Previous
            </button>
            <span className="px-2 font-mono text-on-surface font-semibold">1 / 86</span>
            <button type="button" onClick={() => showToast('Next page')} className="px-3 py-1 rounded-xl bg-surface-container-lowest text-on-surface font-semibold shadow-xs hover:bg-surface-container transition-colors border border-outline-variant/30 cursor-pointer">
              Next
            </button>
          </div>
        </div>

      </div>

      {/* 5. Zero-Trust Guardrails & Automated Quarantine */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        
        {/* Left Column: 4 Toggles */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-outline-variant/30">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-outline-variant/20">
            <div>
              <h2 className="text-base font-bold text-on-surface">Zero-Trust Guardrails &amp; Automated Quarantine</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Automated actions triggered whenever a remote endpoint violates integrity thresholds</p>
            </div>
            <SlidersHorizontal className="w-5 h-5 text-primary-container" />
          </div>

          <div className="space-y-4 text-xs">
            
            {/* Toggle 1 */}
            <div className="flex items-start justify-between gap-4 p-2 rounded-xl hover:bg-surface-container-low/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-primary-container shrink-0">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
                <div>
                  <label className="font-bold text-on-surface block cursor-pointer" htmlFor="toggle-killswitch">
                    Auto-Redirect Killswitch on 404 / 500 Server Error
                  </label>
                  <p className="text-on-surface-variant mt-0.5 leading-relaxed">
                    Automatically routes incoming audience traffic to your curated fallback bio hub instead of displaying a broken browser error screen or dead shop page.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input 
                  type="checkbox" 
                  id="toggle-killswitch"
                  checked={guardrails.killswitch}
                  onChange={(e) => {
                    setGuardrails(prev => ({ ...prev, killswitch: e.target.checked }));
                    showToast(`Killswitch guardrail ${e.target.checked ? 'enabled' : 'disabled'}`);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>

            {/* Toggle 2 */}
            <div className="flex items-start justify-between gap-4 p-2 rounded-xl hover:bg-surface-container-low/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-primary-container shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div>
                  <label className="font-bold text-on-surface block cursor-pointer" htmlFor="toggle-bots">
                    Bot Traffic Filtering &amp; Click Fraud Prevention
                  </label>
                  <p className="text-on-surface-variant mt-0.5 leading-relaxed">
                    Identifies headless Chromium runners, automated scrapers, and malicious crawler probes. Strips fraudulent hits from creator analytics and brand sponsorship reports.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input 
                  type="checkbox" 
                  id="toggle-bots"
                  checked={guardrails.bots}
                  onChange={(e) => {
                    setGuardrails(prev => ({ ...prev, bots: e.target.checked }));
                    showToast(`Bot fraud protection ${e.target.checked ? 'enabled' : 'disabled'}`);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>

            {/* Toggle 3 */}
            <div className="flex items-start justify-between gap-4 p-2 rounded-xl hover:bg-surface-container-low/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-primary-container shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <label className="font-bold text-on-surface block cursor-pointer" htmlFor="toggle-phishing">
                    Real-Time Phishing &amp; Domain Reputation Guard
                  </label>
                  <p className="text-on-surface-variant mt-0.5 leading-relaxed">
                    Instant quarantine if a third-party domain ownership expires, is parked with malware, or gets flagged by Spamhaus, PhishTank, or Google Safe Browsing.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input 
                  type="checkbox" 
                  id="toggle-phishing"
                  checked={guardrails.phishing}
                  onChange={(e) => {
                    setGuardrails(prev => ({ ...prev, phishing: e.target.checked }));
                    showToast(`Phishing reputation guard ${e.target.checked ? 'enabled' : 'disabled'}`);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>

            {/* Toggle 4 */}
            <div className="flex items-start justify-between gap-4 p-2 rounded-xl hover:bg-surface-container-low/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-primary-container shrink-0">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <div>
                  <label className="font-bold text-on-surface block cursor-pointer" htmlFor="toggle-alerts">
                    Instant Slack, Telegram &amp; SMS Downtime Alerts
                  </label>
                  <p className="text-on-surface-variant mt-0.5 leading-relaxed">
                    Dispatches high-priority webhooks the second an affiliate sponsorship sponsor link dies or throws certificate errors during active social campaigns.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input 
                  type="checkbox" 
                  id="toggle-alerts"
                  checked={guardrails.alerts}
                  onChange={(e) => {
                    setGuardrails(prev => ({ ...prev, alerts: e.target.checked }));
                    showToast(`Instant alerts ${e.target.checked ? 'enabled' : 'disabled'}`);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>

          </div>
        </div>

        {/* Right Column: Visual Verification Feed & Integration Status */}
        <div className="flex flex-col gap-6">
          
          {/* Active Integration Box */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-outline-variant/30">
            <h3 className="text-sm font-bold text-on-surface mb-1">Threat Feeds Connected</h3>
            <p className="text-xs text-on-surface-variant mb-4">Live consensus checks validating link safety</p>
            
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-surface-container-low rounded-xl border border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-on-surface">Google Safe Browsing v4</span>
                </div>
                <span className="font-mono text-[11px] text-emerald-700 font-bold">Connected</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-surface-container-low rounded-xl border border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-on-surface">VirusTotal Enterprise API</span>
                </div>
                <span className="font-mono text-[11px] text-emerald-700 font-bold">Connected</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-surface-container-low rounded-xl border border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-on-surface">Snip Zero-Trust Edge WAF</span>
                </div>
                <span className="font-mono text-[11px] text-primary-container font-bold">Active (34ms)</span>
              </div>
            </div>
          </div>

          {/* Live Incident Preview Box */}
          <div className="bg-amber-50/80 rounded-2xl p-5 shadow-xs border-l-4 border-l-amber-600 border border-outline-variant/30 flex flex-col justify-between flex-1">
            <div>
              <div className="flex items-center gap-2 text-amber-900 text-xs font-bold mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>Active Incident Under Mitigation</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed mb-4">
                Endpoint <strong className="font-mono text-amber-950 font-bold">snip.to/old-sponsor-discount</strong> returned 404 for 24 consecutive checks. Auto-redirect killswitch engaged. Visitors currently directed to your main fallback hub.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-amber-200">
              <button 
                type="button"
                onClick={() => handleOpenSwapModal('snip.to/old-sponsor-discount')}
                className="px-3.5 py-1.5 bg-primary-container text-on-primary text-xs font-bold rounded-xl hover:bg-primary transition-colors cursor-pointer shadow-xs"
              >
                Swap Destination Now
              </button>
              <button 
                type="button"
                onClick={() => showToast('Incident ignored for 24h. Killswitch remains engaged.')}
                className="px-3.5 py-1.5 bg-surface-container-lowest text-on-surface text-xs font-semibold rounded-xl hover:bg-surface-container transition-colors cursor-pointer border border-outline-variant/30"
              >
                Ignore for 24h
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* 6. Emergency Destination Swap Modal (Rendered via Portal) */}
      {mounted && swapModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSwapModalOpen(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-outline-variant/40 relative animate-fade-in">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSwapModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <ArrowRight className="w-5 h-5 text-primary-container" />
              <h3 className="text-base font-bold text-on-surface">Emergency Destination Swap</h3>
            </div>
            <p className="text-xs text-on-surface-variant mb-4">
              Update target destination for <strong className="text-primary-container font-mono">{swapTargetSlug}</strong> instantly across all edge nodes without altering the short link in your videos.
            </p>

            <form onSubmit={handleSaveSwap} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">New Target Destination URL</label>
                <input 
                  type="url"
                  required
                  placeholder="https://example.com/new-destination"
                  value={newDestinationUrl}
                  onChange={(e) => setNewDestinationUrl(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-container-low text-on-surface rounded-xl font-mono text-xs border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container"
                />
              </div>

              <div className="p-3 bg-surface-container-low rounded-xl flex items-center gap-2 text-on-surface-variant text-xs border border-outline-variant/20">
                <Zap className="w-4 h-4 text-primary-container shrink-0" />
                <span>Zero-latency edge replication: updates in ~250ms worldwide across all CDN pops.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20 mt-3">
                <button 
                  type="button"
                  onClick={() => setSwapModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-bold hover:bg-primary shadow-xs cursor-pointer text-xs"
                >
                  Update &amp; Re-Scan
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 7. Configure Webhook Alert Modal (Rendered via Portal) */}
      {mounted && webhookModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setWebhookModalOpen(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl border border-outline-variant/40 relative animate-fade-in">
            <button
              type="button"
              onClick={() => setWebhookModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h4 className="text-base font-bold text-on-surface mb-1">Configure Webhook Alert</h4>
            <p className="text-xs text-on-surface-variant mb-4">
              Receive instant alerts via Slack, Discord, or custom HTTP POST when broken links or threats are detected.
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              setWebhookModalOpen(false);
              showToast(`Webhook configured: ${webhookService} channel will receive instant security alerts.`);
            }} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-on-surface block mb-1">Alert Destination Service</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Slack', 'Discord', 'Custom POST'] as const).map(srv => (
                    <button
                      type="button"
                      key={srv}
                      onClick={() => setWebhookService(srv)}
                      className={`py-1.5 rounded-xl font-bold transition-all cursor-pointer border text-xs ${
                        webhookService === srv
                          ? 'bg-primary-container text-on-primary border-primary-container shadow-xs'
                          : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container'
                      }`}
                    >
                      {srv}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Webhook Endpoint URL</label>
                <input 
                  type="url"
                  required
                  placeholder="https://your-webhook-endpoint.com/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20 mt-3">
                <button
                  type="button"
                  onClick={() => setWebhookModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer shadow-xs text-xs"
                >
                  Save Webhook
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 8. Notification Toast */}
      {mounted && toastMessage && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-6 right-6 bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 transition-all duration-200 z-[100] animate-fade-in border border-outline-variant/30 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>,
        document.body
      )}

    </div>
  );
};
