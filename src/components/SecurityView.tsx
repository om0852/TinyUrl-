'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { ShieldAlert, ShieldCheck, Search, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { SecurityReport } from '@/lib/types';

export const SecurityView: React.FC = () => {
  const { links, updateLink, scanUrlSecurity } = useStore();
  const [scanInput, setScanInput] = useState('');
  const [reportResult, setReportResult] = useState<SecurityReport | null>(null);

  const flaggedLinks = links.filter(l => l.is_flagged || l.status === 'flagged');

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput) return;

    const rep = scanUrlSecurity(scanInput);
    setReportResult(rep);
  };

  const handleRestoreLink = (id: string) => {
    updateLink(id, { is_flagged: false, status: 'active', risk_score: 0 });
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400" /> Link Safety & Malware Prevention Suite
        </h1>
        <p className="text-xs text-slate-400">Automated Google Safe Browsing API, VirusTotal scanning, and spamlink quarantine enforcement</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* On-Demand URL Scanner */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-indigo-400" /> Real-time URL Threat Inspector
          </h3>

          <form onSubmit={handleScan} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Enter URL to Inspect</label>
              <input
                type="url"
                required
                placeholder="https://example.com/check-link"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 gradient-button text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <ShieldCheck className="w-4 h-4" /> Run Safe Browsing & VirusTotal Scan
            </button>
          </form>

          {reportResult && (
            <div className={`p-4 rounded-xl border text-xs space-y-2 ${
              reportResult.is_blacklisted 
                ? 'bg-rose-950/40 border-rose-500/30 text-rose-200' 
                : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
            }`}>
              <div className="flex items-center justify-between font-bold">
                <span>Safe Browsing Status:</span>
                <span className="uppercase">{reportResult.safe_browsing}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>VirusTotal Risk Index:</span>
                <span className="font-mono font-bold">{reportResult.virustotal_risk} / 100</span>
              </div>
              {reportResult.threat_categories.length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <span className="font-semibold block mb-1">Threat Categories:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
                    {reportResult.threat_categories.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Flagged / Quarantined Links */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" /> Quarantined Suspicious Links ({flaggedLinks.length})
            </span>
            <span className="text-xs text-slate-400 font-normal">Auto-Disabled</span>
          </h3>

          {flaggedLinks.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-white/5">
              No flagged links currently in quarantine.
            </div>
          ) : (
            <div className="space-y-3">
              {flaggedLinks.map((link) => (
                <div key={link.id} className="p-4 bg-slate-900/80 border border-rose-500/30 rounded-xl flex items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{link.title}</span>
                      <span className="px-2 py-0.5 text-[9px] bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 rounded">
                        Risk Score: {link.risk_score}
                      </span>
                    </div>
                    <p className="font-mono text-rose-400 text-[11px] truncate max-w-md">{link.destination_url}</p>
                  </div>

                  <button
                    onClick={() => handleRestoreLink(link.id)}
                    className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Override & Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
