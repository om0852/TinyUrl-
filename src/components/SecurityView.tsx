'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { ShieldAlert, ShieldCheck, Search, AlertTriangle, RefreshCw, Lock, Radio } from 'lucide-react';
import { SecurityReport } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

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
    <div className="space-y-8 animate-fade-in text-foreground">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" /> Zero-Trust Threat &amp; Malware Inspector
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Automated Google Safe Browsing API, VirusTotal link risk scoring, and spam quarantine enforcement.
          </p>
        </div>

        <Badge variant="success" className="px-3 py-1 text-xs">
          Zero-Day Shield Active
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* On-Demand URL Scanner */}
        <Card className="shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border/40">
            <Search className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Real-time URL Threat Inspector</h3>
          </div>

          <form onSubmit={handleScan} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Enter URL to Inspect</label>
              <input
                type="url"
                required
                placeholder="https://example.com/check-link"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                className="w-full h-10 px-3.5 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full text-xs font-bold"
            >
              <ShieldCheck className="w-4 h-4 mr-2" /> Run Safe Browsing Scan
            </Button>
          </form>

          {reportResult && (
            <div className={`p-4 rounded-xl border text-xs space-y-2 ${
              reportResult.is_blacklisted 
                ? 'bg-destructive/10 border-destructive/20 text-destructive' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
            }`}>
              <div className="flex items-center justify-between font-bold">
                <span>Threat Classification:</span>
                <span className="uppercase">{reportResult.safe_browsing}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>VirusTotal Risk Index:</span>
                <span className="font-mono font-bold">{reportResult.virustotal_risk} / 100</span>
              </div>
              {reportResult.threat_categories.length > 0 && (
                <div className="pt-2 border-t border-border/40">
                  <span className="font-semibold block mb-1 text-[11px]">Flagged Categories:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {reportResult.threat_categories.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Flagged / Quarantined Links */}
        <Card className="lg:col-span-2 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Quarantined Threat Queue
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Links flagged by automated anti-phishing algorithms are locked from edge redirection.
              </p>
            </div>
            <Badge variant="destructive">
              {flaggedLinks.length} Flagged
            </Badge>
          </div>

          <div className="space-y-3">
            {flaggedLinks.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border/50 rounded-xl bg-muted/10 space-y-2">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-foreground">Zero Quarantined Threats</p>
                <p className="text-xs text-muted-foreground">All active shortlinks in your workspace pass zero-phish checks.</p>
              </div>
            ) : (
              flaggedLinks.map((link) => (
                <div
                  key={link.id}
                  className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-xs">{link.title}</span>
                      <span className="font-mono text-xs text-destructive font-bold">/{link.short_code}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">{link.destination_url}</p>
                    <Badge variant="destructive" className="text-[10px]">Suspicious Domain / Phishing Alert</Badge>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestoreLink(link.id)}
                    className="shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Restore
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>

      </div>

    </div>
  );
};
