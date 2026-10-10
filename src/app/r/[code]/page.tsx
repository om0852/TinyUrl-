'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StoreProvider, useStore } from '@/lib/storeContext';
import { ShieldAlert, Lock, ArrowRight, ShieldCheck, AlertTriangle, ExternalLink } from 'lucide-react';

function RedirectInner() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) || '';
  const { links, logClick } = useStore();

  const [mounted, setMounted] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pixelStatus, setPixelStatus] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const link = links.find(
    l => l.short_code.toLowerCase() === code.toLowerCase() || l.custom_slug?.toLowerCase() === code.toLowerCase()
  );

  useEffect(() => {
    if (!mounted || !link) return;

    // Expiration or click limit checks
    if (link.expires_at && new Date(link.expires_at) < new Date()) return;
    if (link.max_clicks && link.clicks_count >= link.max_clicks) return;
    if (link.status === 'disabled') return;

    // Smart routing resolution
    let finalUrl = link.destination_url;

    if (link.rules && link.rules.length > 0) {
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
      const isAndroid = /Android/i.test(userAgent);

      const deviceRule = link.rules.find(r => 
        r.rule_type === 'device' && (
          (r.condition.toLowerCase() === 'ios' && isIOS) ||
          (r.condition.toLowerCase() === 'android' && isAndroid)
        )
      );

      if (deviceRule) {
        finalUrl = deviceRule.target_url;
      } else {
        const abRule = link.rules.find(r => r.rule_type === 'ab');
        if (abRule) {
          const weight = abRule.weight || 50;
          if (Math.random() * 100 < weight) {
            finalUrl = abRule.target_url;
          }
        }
      }
    }

    // Log click event
    logClick(link.id, {
      short_code: code,
      referrer: typeof document !== 'undefined' && document.referrer ? document.referrer : 'Direct / None'
    });

    // Instant redirect if clean
    if (!link.password_hash && !link.is_flagged && link.status === 'active') {
      performRedirect(finalUrl);
    }
  }, [mounted, link, code]);

  const performRedirect = (target: string) => {
    if (link?.retargeting_pixels && link.retargeting_pixels.length > 0) {
      setPixelStatus(`Syncing analytics event (${link.retargeting_pixels.map(p => p.provider).join(', ')})...`);
      setTimeout(() => {
        if (link.deep_link) {
          window.location.replace(link.deep_link.app_uri);
          setTimeout(() => { window.location.replace(target); }, 1000);
        } else {
          window.location.replace(target);
        }
      }, 300);
    } else if (link?.deep_link) {
      window.location.replace(link.deep_link.app_uri);
      setTimeout(() => { window.location.replace(target); }, 1000);
    } else {
      window.location.replace(target);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (link && link.password_hash === passwordInput) {
      setPasswordError(false);
      setIsUnlocked(true);
      performRedirect(link.destination_url);
    } else {
      setPasswordError(true);
    }
  };

  // Helper to format clean domain name for destination
  const getDestinationHost = (rawUrl: string) => {
    try {
      const u = new URL(rawUrl);
      return u.hostname;
    } catch {
      return rawUrl;
    }
  };

  // 1. Initial hydration phase loader (Clean minimal design)
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#052536] flex items-center justify-center p-4 selection:bg-[#008296]">
        <div className="bg-[#072e42] p-8 rounded-xl text-center border border-[#0b4566] text-white shadow-2xl max-w-sm w-full space-y-4">
          <div className="w-10 h-10 border-2 border-t-[#008296] border-slate-700 rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold tracking-wide text-slate-200">Connecting to destination...</p>
        </div>
      </div>
    );
  }

  // 2. Short link not found state
  if (!link) {
    return (
      <div className="min-h-screen bg-[#052536] flex items-center justify-center p-4">
        <div className="bg-[#072e42] max-w-md w-full p-8 rounded-xl text-center border border-white/10 shadow-2xl space-y-5">
          <div className="w-14 h-14 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white mb-1">Link Not Found</h1>
            <p className="text-slate-300 text-xs leading-relaxed">
              The short link <code className="text-cyan-300 font-mono">/{code}</code> does not exist or has expired.
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 rounded-lg tinyurl-btn-teal text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md"
          >
            Return to Homepage <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 3. Security Warning / Phishing Block State
  if (link.is_flagged || link.status === 'flagged') {
    return (
      <div className="min-h-screen bg-[#052536] flex items-center justify-center p-4">
        <div className="bg-[#072e42] max-w-lg w-full p-8 rounded-xl border border-red-500/40 text-left shadow-2xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center border border-red-500/30 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Security Alert: Flagged Destination</h2>
              <p className="text-red-400 text-xs font-semibold">Flagged by threat scanner</p>
            </div>
          </div>

          <div className="bg-[#052536] border border-red-500/30 rounded-lg p-4 text-xs text-slate-200 space-y-2">
            <p className="font-bold text-red-300">Target URL:</p>
            <p className="font-mono text-xs text-red-200 break-all bg-black/40 p-2 rounded border border-red-500/20">
              {link.destination_url}
            </p>
            <div className="pt-2 border-t border-white/10 text-xs text-slate-300">
              <p className="font-semibold text-slate-200 mb-1">Threat Reasons:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                {link.risk_reasons?.map((reason, i) => (
                  <li key={i}>{reason}</li>
                )) || <li>High risk phishing score ({link.risk_score}/100)</li>}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => router.push('/')}
              className="w-full py-2.5 bg-[#0a405c] hover:bg-[#0c4c6e] text-white rounded-lg text-xs font-bold transition"
            >
              Back to Safety
            </button>
            <button
              onClick={() => performRedirect(link.destination_url)}
              className="text-xs text-slate-400 hover:text-red-300 underline text-center"
            >
              Proceed anyway at your own risk
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Password Protection View
  if (link.password_hash && !isUnlocked) {
    return (
      <div className="min-h-screen bg-[#052536] flex items-center justify-center p-4">
        <div className="bg-[#072e42] max-w-md w-full p-8 rounded-xl text-center border border-[#008296] shadow-2xl space-y-5">
          <div className="w-12 h-12 bg-[#008296]/20 text-cyan-300 rounded-full flex items-center justify-center mx-auto border border-cyan-400/30">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Protected Link</h2>
            <p className="text-slate-300 text-xs">
              Enter password to access <strong className="text-white">{link.title}</strong>
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Enter password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#052536] border border-white/20 focus:border-[#008296] rounded-lg text-white placeholder-slate-400 text-xs focus:outline-none"
              />
              {passwordError && (
                <p className="text-red-400 text-xs text-left mt-1">Incorrect password. Please try again.</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 tinyurl-btn-teal text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-md"
            >
              Continue to Link <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 5. Active Modern Human-Crafted Redirecting View
  return (
    <div className="min-h-screen bg-[#052536] flex items-center justify-center p-4 selection:bg-[#008296]">
      <div className="bg-[#072e42] max-w-sm w-full p-6 rounded-xl border border-[#0b4566] text-white shadow-2xl space-y-5">
        
        {/* Destination Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-medium text-emerald-400">
              <ShieldCheck className="w-4 h-4" /> Verified Safe
            </span>
            <span className="font-mono text-[11px] text-slate-400">/{code}</span>
          </div>

          <div className="p-3 bg-[#052536] rounded-lg border border-white/10 text-left">
            <p className="text-[11px] text-slate-400 font-medium mb-0.5">Redirecting to:</p>
            <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
              <span>{getDestinationHost(link.destination_url)}</span>
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            </p>
          </div>
        </div>

        {/* Linear Loading Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-[#052536] h-1.5 rounded-full overflow-hidden border border-white/5">
            <div className="bg-[#008296] h-full w-full animate-pulse transition-all duration-300" />
          </div>
          {pixelStatus ? (
            <p className="text-[11px] text-cyan-300 font-medium">{pixelStatus}</p>
          ) : (
            <p className="text-[11px] text-slate-400">Taking you to target URL...</p>
          )}
        </div>

      </div>
    </div>
  );
}

export default function RedirectPage() {
  return (
    <StoreProvider>
      <Suspense fallback={<div className="min-h-screen bg-[#052536] flex items-center justify-center text-white text-xs">Redirecting...</div>}>
        <RedirectInner />
      </Suspense>
    </StoreProvider>
  );
}
