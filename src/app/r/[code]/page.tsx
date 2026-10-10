'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StoreProvider, useStore } from '@/lib/storeContext';
import { ShieldAlert, Lock, ArrowRight, Sparkles, ExternalLink, Clock, Smartphone, AlertTriangle } from 'lucide-react';

function RedirectInner() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) || '';
  const { links, logClick } = useStore();

  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pixelStatus, setPixelStatus] = useState<string | null>(null);
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);
  const [isDeepLink, setIsDeepLink] = useState(false);

  const link = links.find(l => l.short_code.toLowerCase() === code.toLowerCase() || l.custom_slug?.toLowerCase() === code.toLowerCase());

  useEffect(() => {
    if (!link) return;

    // Check expiration or click limit
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return;
    }
    if (link.max_clicks && link.clicks_count >= link.max_clicks) {
      return;
    }
    if (link.status === 'disabled') {
      return;
    }

    // Determine target URL based on smart rules (Device, Geo, A/B)
    let finalUrl = link.destination_url;

    if (link.rules && link.rules.length > 0) {
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
      const isAndroid = /Android/i.test(userAgent);

      // Check device rules
      const deviceRule = link.rules.find(r => 
        r.rule_type === 'device' && (
          (r.condition.toLowerCase() === 'ios' && isIOS) ||
          (r.condition.toLowerCase() === 'android' && isAndroid)
        )
      );

      if (deviceRule) {
        finalUrl = deviceRule.target_url;
      } else {
        // Check A/B split rules
        const abRule = link.rules.find(r => r.rule_type === 'ab');
        if (abRule) {
          const weight = abRule.weight || 50;
          if (Math.random() * 100 < weight) {
            finalUrl = abRule.target_url;
          }
        }
      }
    }

    setRedirectTarget(finalUrl);

    // Deep link check
    if (link.deep_link) {
      setIsDeepLink(true);
    }

    // Log click asynchronously
    logClick(link.id, {
      short_code: code,
      referrer: typeof document !== 'undefined' && document.referrer ? document.referrer : 'Direct / None'
    });

  }, [link, code]);

  // Handle password submission
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (link && link.password_hash === passwordInput) {
      setPasswordError(false);
      setIsUnlocked(true);
      performRedirect(redirectTarget || link.destination_url);
    } else {
      setPasswordError(true);
    }
  };

  const performRedirect = (target: string) => {
    if (link?.retargeting_pixels && link.retargeting_pixels.length > 0) {
      setPixelStatus(`Firing ${link.retargeting_pixels.map(p => p.provider).join(', ')} retargeting pixels...`);
      setTimeout(() => {
        if (link.deep_link) {
          window.location.href = link.deep_link.app_uri;
          setTimeout(() => { window.location.href = target; }, 1500);
        } else {
          window.location.href = target;
        }
      }, 1000);
    } else {
      if (link?.deep_link) {
        window.location.href = link.deep_link.app_uri;
        setTimeout(() => { window.location.href = target; }, 1500);
      } else {
        window.location.href = target;
      }
    }
  };

  useEffect(() => {
    if (link && !link.password_hash && !link.is_flagged && link.status === 'active' && redirectTarget) {
      performRedirect(redirectTarget);
    }
  }, [redirectTarget, link]);

  // Not Found State
  if (!link) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <div className="glass-panel max-w-md w-full p-8 rounded-2xl text-center border border-white/10">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Short Link Not Found</h1>
          <p className="text-slate-400 text-sm mb-6">
            The short link <code className="text-indigo-400 font-mono">/r/{code}</code> does not exist or may have been removed.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 rounded-xl gradient-button text-white font-medium flex items-center justify-center gap-2"
          >
            Go to Platform Dashboard <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Flagged Phishing / Security Block State
  if (link.is_flagged || link.status === 'flagged') {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <div className="glass-panel max-w-lg w-full p-8 rounded-2xl border border-rose-500/30 text-left">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center border border-rose-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Security Warning: Suspected Link</h2>
              <p className="text-rose-400 text-xs font-semibold">Flagged by Google Safe Browsing & VirusTotal</p>
            </div>
          </div>

          <div className="bg-rose-950/30 border border-rose-500/20 rounded-xl p-4 mb-6 text-sm text-slate-300 space-y-2">
            <p className="font-semibold text-rose-300">Target URL:</p>
            <p className="font-mono text-xs text-rose-200/80 break-all bg-black/40 p-2 rounded border border-rose-500/20">
              {link.destination_url}
            </p>
            <div className="pt-2 border-t border-rose-500/20 text-xs text-slate-400">
              <p className="font-medium text-slate-300 mb-1">Threat Detection Reasons:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                {link.risk_reasons?.map((reason, i) => (
                  <li key={i}>{reason}</li>
                )) || <li>High risk heuristic phishing score ({link.risk_score}/100)</li>}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition"
            >
              Return to Safety
            </button>
            <button
              onClick={() => performRedirect(link.destination_url)}
              className="text-xs text-slate-500 hover:text-rose-400 underline text-center"
            >
              I understand the risks, proceed anyway
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Password Protection State
  if (link.password_hash && !isUnlocked) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <div className="glass-panel max-w-md w-full p-8 rounded-2xl text-center border border-indigo-500/30">
          <div className="w-14 h-14 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Password Protected Link</h2>
          <p className="text-slate-400 text-sm mb-6">
            Enter the access password to unlock <span className="text-indigo-400 font-semibold">{link.title}</span>
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Enter password (hint: investor2026)"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/90 border border-slate-700 focus:border-indigo-500 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none"
              />
              {passwordError && (
                <p className="text-rose-400 text-xs text-left mt-1">Incorrect password. Please try again.</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 gradient-button text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2"
            >
              Unlock & Redirect <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Active Redirecting / Pixel Firing State
  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
      <div className="glass-panel max-w-md w-full p-8 rounded-2xl text-center border border-indigo-500/20 animate-float">
        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-violet-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/30">
          <Sparkles className="w-8 h-8 animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Redirecting You...</h2>
        <p className="text-slate-400 text-sm mb-4">
          Navigating to <span className="text-indigo-400 font-medium break-all">{redirectTarget || link.destination_url}</span>
        </p>

        {pixelStatus && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-xs text-indigo-300 mb-4 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" /> {pixelStatus}
          </div>
        )}

        {isDeepLink && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/30 rounded-lg text-xs text-violet-300 mb-4">
            <Smartphone className="w-3.5 h-3.5" /> Opening mobile native app...
          </div>
        )}

        <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full w-full animate-pulse"></div>
        </div>

        <p className="text-xs text-slate-500">
          Powered by <span className="text-slate-400 font-semibold">URL Shortener Platform</span> &bull; Redirect Latency &lt; 25ms
        </p>
      </div>
    </div>
  );
}

export default function RedirectPage() {
  return (
    <StoreProvider>
      <Suspense fallback={<div className="min-h-screen bg-[#052536] flex items-center justify-center text-white text-sm">Redirecting...</div>}>
        <RedirectInner />
      </Suspense>
    </StoreProvider>
  );
}
