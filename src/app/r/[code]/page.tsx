'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StoreProvider, useStore } from '@/lib/storeContext';
import { ShieldAlert, Lock, ArrowRight, Sparkles, AlertTriangle, Smartphone } from 'lucide-react';

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

    // Check expiration or max click limits
    if (link.expires_at && new Date(link.expires_at) < new Date()) return;
    if (link.max_clicks && link.clicks_count >= link.max_clicks) return;
    if (link.status === 'disabled') return;

    // Determine target URL based on smart rules (Device, Geo, A/B)
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

    // Log click asynchronously
    logClick(link.id, {
      short_code: code,
      referrer: typeof document !== 'undefined' && document.referrer ? document.referrer : 'Direct / None'
    });

    // Execute instant redirect if no password or security block
    if (!link.password_hash && !link.is_flagged && link.status === 'active') {
      performRedirect(finalUrl);
    }
  }, [mounted, link, code]);

  const performRedirect = (target: string) => {
    if (link?.retargeting_pixels && link.retargeting_pixels.length > 0) {
      setPixelStatus(`Firing ${link.retargeting_pixels.map(p => p.provider).join(', ')} retargeting pixels...`);
      setTimeout(() => {
        if (link.deep_link) {
          window.location.replace(link.deep_link.app_uri);
          setTimeout(() => { window.location.replace(target); }, 1200);
        } else {
          window.location.replace(target);
        }
      }, 500);
    } else if (link?.deep_link) {
      window.location.replace(link.deep_link.app_uri);
      setTimeout(() => { window.location.replace(target); }, 1200);
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

  // 1. Initial hydration mount phase loader (Prevents SSR hydration mismatch)
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#052536] flex items-center justify-center p-4">
        <div className="bg-[#072e42] p-8 rounded-2xl text-center border border-[#008296]/30 text-white shadow-2xl max-w-sm w-full">
          <div className="w-12 h-12 bg-[#008296]/20 text-cyan-300 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-400/30">
            <Sparkles className="w-6 h-6 animate-spin" />
          </div>
          <h2 className="text-xl font-bold mb-1">Redirecting...</h2>
          <p className="text-xs text-slate-300">Resolving destination URL</p>
        </div>
      </div>
    );
  }

  // 2. Short link not found state
  if (!link) {
    return (
      <div className="min-h-screen bg-[#052536] flex items-center justify-center p-4">
        <div className="bg-[#072e42] max-w-md w-full p-8 rounded-2xl text-center border border-white/10 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Short Link Not Found</h1>
          <p className="text-slate-300 text-sm mb-6">
            The short link <code className="text-cyan-300 font-mono">/{code}</code> does not exist or may have expired.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 rounded-xl tinyurl-btn-teal text-white font-bold flex items-center justify-center gap-2"
          >
            Go to Platform Dashboard <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 3. Flagged Phishing / Security warning block
  if (link.is_flagged || link.status === 'flagged') {
    return (
      <div className="min-h-screen bg-[#052536] flex items-center justify-center p-4">
        <div className="bg-[#072e42] max-w-lg w-full p-8 rounded-2xl border border-red-500/40 text-left shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-xl flex items-center justify-center border border-red-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Security Warning: Flagged Link</h2>
              <p className="text-red-400 text-xs font-semibold">Flagged by Threat Intelligence Scanner</p>
            </div>
          </div>

          <div className="bg-[#052536] border border-red-500/30 rounded-xl p-4 mb-6 text-sm text-slate-200 space-y-2">
            <p className="font-semibold text-red-300">Target URL:</p>
            <p className="font-mono text-xs text-red-200/90 break-all bg-black/40 p-2 rounded border border-red-500/20">
              {link.destination_url}
            </p>
            <div className="pt-2 border-t border-white/10 text-xs text-slate-300">
              <p className="font-semibold text-slate-200 mb-1">Threat Reasons:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                {link.risk_reasons?.map((reason, i) => (
                  <li key={i}>{reason}</li>
                )) || <li>High risk heuristic phishing score ({link.risk_score}/100)</li>}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 bg-[#0a405c] hover:bg-[#0c4c6e] text-white rounded-xl text-sm font-bold transition"
            >
              Return to Safety
            </button>
            <button
              onClick={() => performRedirect(link.destination_url)}
              className="text-xs text-slate-400 hover:text-red-300 underline text-center"
            >
              I understand the risks, proceed anyway
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Password Protection lock
  if (link.password_hash && !isUnlocked) {
    return (
      <div className="min-h-screen bg-[#052536] flex items-center justify-center p-4">
        <div className="bg-[#072e42] max-w-md w-full p-8 rounded-2xl text-center border border-[#008296] shadow-2xl">
          <div className="w-14 h-14 bg-[#008296]/20 text-cyan-300 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-400/30">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Password Protected Link</h2>
          <p className="text-slate-300 text-sm mb-6">
            Enter the password to unlock <span className="text-cyan-300 font-bold">{link.title}</span>
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Enter password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-3 bg-[#052536] border border-white/20 focus:border-[#008296] rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none"
              />
              {passwordError && (
                <p className="text-red-400 text-xs text-left mt-1">Incorrect password. Please try again.</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 tinyurl-btn-teal text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2"
            >
              Unlock &amp; Redirect <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 5. Active Redirecting / Pixel Firing View
  return (
    <div className="min-h-screen bg-[#052536] flex items-center justify-center p-4">
      <div className="bg-[#072e42] max-w-md w-full p-8 rounded-2xl text-center border border-[#008296]/40 shadow-2xl text-white">
        <div className="w-16 h-16 bg-[#008296]/30 text-cyan-300 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg border border-cyan-400/30">
          <Sparkles className="w-8 h-8 animate-spin" style={{ animationDuration: '2s' }} />
        </div>
        
        <h2 className="text-2xl font-black text-white mb-2">Redirecting You...</h2>
        <p className="text-slate-300 text-sm mb-4">
          Navigating to <span className="text-cyan-300 font-bold break-all">{link.destination_url}</span>
        </p>

        {pixelStatus && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-xs text-cyan-200 mb-4 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" /> {pixelStatus}
          </div>
        )}

        {link.deep_link && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-xs text-cyan-200 mb-4">
            <Smartphone className="w-3.5 h-3.5" /> Opening mobile native app...
          </div>
        )}

        <div className="w-full bg-[#052536] h-1.5 rounded-full overflow-hidden mb-6">
          <div className="bg-[#008296] h-full w-full animate-pulse"></div>
        </div>

        <p className="text-xs text-slate-400">
          Powered by <span className="text-white font-bold">URL Shortener Platform</span> &bull; Redirect Latency &lt; 20ms
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
