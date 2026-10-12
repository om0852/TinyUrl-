'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/lib/storeContext';
import { Link } from '@/lib/types';
import { ShieldAlert, Lock, ArrowRight, ShieldCheck, AlertTriangle, ExternalLink, Smartphone, Sparkles, RefreshCw } from 'lucide-react';
import { detectAppDeepLink, detectInAppBrowser } from '@/lib/deepLink';

function RedirectInner() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) || '';
  const { links, logClick } = useStore();

  const [mounted, setMounted] = useState(false);
  const [resolving, setResolving] = useState(true);
  const [resolvedLink, setResolvedLink] = useState<Link | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pixelStatus, setPixelStatus] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(2);
  const [manualAttempt, setManualAttempt] = useState(false);

  // Dynamic link resolution across store, localStorage, and API
  useEffect(() => {
    const cleanCode = code.toLowerCase().trim();
    if (!cleanCode) {
      setResolving(false);
      setMounted(true);
      return;
    }

    // 1. Try resolving from store state
    let target = links.find(
      l => (l.short_code && l.short_code.toLowerCase() === cleanCode) ||
           (l.custom_slug && l.custom_slug.toLowerCase() === cleanCode)
    );

    // 2. Direct localStorage lookup fallback
    if (!target && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('url_shortener_links');
        if (raw) {
          const parsed: Link[] = JSON.parse(raw);
          target = parsed.find(
            l => (l.short_code && l.short_code.toLowerCase() === cleanCode) ||
                 (l.custom_slug && l.custom_slug.toLowerCase() === cleanCode)
          );
        }
      } catch {}
    }

    if (target) {
      setResolvedLink(target);
      setResolving(false);
      setMounted(true);
      return;
    }

    // 3. Fallback to API if not in local storage yet
    fetch('/api/v1/links')
      .then(res => res.json())
      .then(data => {
        if (data?.links && Array.isArray(data.links)) {
          const apiTarget = data.links.find(
            (l: any) => (l.short_code && l.short_code.toLowerCase() === cleanCode) ||
                        (l.custom_slug && l.custom_slug.toLowerCase() === cleanCode)
          );
          if (apiTarget) {
            setResolvedLink(apiTarget);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        setResolving(false);
        setMounted(true);
      });
  }, [code, links]);

  const link = resolvedLink;
  const hasLoggedRef = React.useRef(false);

  // Compute smart destination URL
  const resolvedTarget = useMemo(() => {
    if (!link) return '';
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
    return finalUrl;
  }, [link]);

  // Client device and in-app browser detection
  const clientContext = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return { isIOS: false, isAndroid: false, isMobile: false, inAppInfo: { isInApp: false } };
    }
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid;
    const inAppInfo = detectInAppBrowser(ua);
    return { isIOS, isAndroid, isMobile, inAppInfo };
  }, [mounted]);

  // Deep Link details (OpeninApp feature)
  const appDeepLink = useMemo(() => {
    if (!resolvedTarget) return null;
    
    // Check if configured explicitly or auto-detected
    if (link?.deep_link && link.deep_link.enabled !== false) {
      const auto = detectAppDeepLink(resolvedTarget);
      return {
        app: link.deep_link.app,
        appName: link.deep_link.app_name || auto?.appName || 'App',
        color: auto?.color || '#4f46e5',
        iosUri: link.deep_link.ios_uri || link.deep_link.app_uri || auto?.iosUri || resolvedTarget,
        androidIntent: link.deep_link.android_intent || auto?.androidIntent || resolvedTarget,
        fallbackUrl: link.deep_link.fallback_url || resolvedTarget
      };
    }

    const auto = detectAppDeepLink(resolvedTarget);
    return auto;
  }, [resolvedTarget, link]);

  // The active mobile URI (Android Intent vs iOS URI)
  const activeNativeUri = useMemo(() => {
    if (!appDeepLink) return resolvedTarget;
    if (clientContext.isAndroid && appDeepLink.androidIntent) {
      return appDeepLink.androidIntent;
    }
    if (clientContext.isIOS && appDeepLink.iosUri) {
      return appDeepLink.iosUri;
    }
    return appDeepLink.androidIntent || appDeepLink.iosUri || resolvedTarget;
  }, [appDeepLink, clientContext, resolvedTarget]);

  // Main redirect logic & click tracking
  useEffect(() => {
    if (!mounted || !link || hasLoggedRef.current) return;

    // Expiration or click limit checks
    if (link.expires_at && new Date(link.expires_at) < new Date()) return;
    if (link.max_clicks && link.clicks_count >= link.max_clicks) return;
    if (link.status === 'disabled') return;

    hasLoggedRef.current = true;

    // Log click event
    logClick(link.id, {
      short_code: code,
      referrer: typeof document !== 'undefined' && document.referrer ? document.referrer : 'Direct / None'
    });

    // If password-protected or flagged, do not redirect automatically
    if (link.password_hash || link.is_flagged || link.status !== 'active') return;

    // If OpeninApp deep link applies on mobile:
    if (appDeepLink && (clientContext.isMobile || clientContext.inAppInfo.isInApp)) {
      // Countdown for auto-trigger
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            tryRedirectToApp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }

    // Standard redirect for desktop or general websites
    const timeout = setTimeout(() => {
      window.location.replace(resolvedTarget);
    }, 600);

    return () => clearTimeout(timeout);
  }, [mounted, link, resolvedTarget, appDeepLink, clientContext]);

  const tryRedirectToApp = () => {
    if (!activeNativeUri) return;
    try {
      window.location.href = activeNativeUri;
    } catch {
      window.location.href = resolvedTarget;
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (link && link.password_hash === passwordInput) {
      setPasswordError(false);
      setIsUnlocked(true);
      if (appDeepLink && clientContext.isMobile) {
        tryRedirectToApp();
      } else {
        window.location.replace(resolvedTarget);
      }
    } else {
      setPasswordError(true);
    }
  };

  const getDestinationHost = (rawUrl: string) => {
    try {
      return new URL(rawUrl).hostname;
    } catch {
      return rawUrl;
    }
  };

  // 1. Initial hydration and link resolution loader
  if (!mounted || resolving) {
    return (
      <div className="min-h-screen bg-[#052536] flex items-center justify-center p-4">
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
            className="w-full py-3 rounded-lg tinyurl-btn-teal text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer"
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
                )) || <li>Potential phishing, credential harvesting, or malware vector</li>}
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex-1 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition"
            >
              Go to Safety
            </button>
            <button
              onClick={() => window.location.replace(link.destination_url)}
              className="px-4 py-2.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold transition"
            >
              Proceed Anyway (Unsafe)
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

  // 5. OpeninApp Smart Interstitial Screen (Mobile App Deep Link)
  if (appDeepLink) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#031520] via-[#052536] to-[#072e42] flex items-center justify-center p-4 text-white selection:bg-[#008296]">
        <div className="relative bg-[#072e42]/90 backdrop-blur-xl max-w-md w-full p-7 rounded-2xl border border-white/10 shadow-2xl space-y-6 text-center">
          
          {/* OpeninApp Header Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[11px] font-semibold text-cyan-300 mx-auto">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>OpeninApp Smart Redirect</span>
          </div>

          {/* App Icon with Halo */}
          <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
            <div 
              className="absolute inset-0 rounded-2xl opacity-40 blur-lg animate-pulse"
              style={{ backgroundColor: appDeepLink.color }}
            />
            <div 
              className="relative w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl border border-white/20 text-white"
              style={{ backgroundColor: appDeepLink.color }}
            >
              <Smartphone className="w-10 h-10" />
            </div>
          </div>

          {/* Title & App Info */}
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Opening in {appDeepLink.appName}...
            </h1>
            <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
              Bypassing in-app webview so you stay logged in and enjoy the full native experience.
            </p>
          </div>

          {/* In-App Browser Warning Alert */}
          {clientContext.inAppInfo.isInApp && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left flex items-start gap-2.5">
              <span className="text-amber-400 text-sm">💡</span>
              <p className="text-[11px] text-amber-200 leading-tight">
                <strong>{clientContext.inAppInfo.browserName || 'In-App Browser'} detected:</strong> If the app doesn&apos;t open automatically, tap the button below or tap the <strong>•••</strong> menu at the top-right to open in Safari/Chrome.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <a
              href={activeNativeUri}
              onClick={() => {
                setManualAttempt(true);
                tryRedirectToApp();
              }}
              className="w-full py-3.5 px-5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-xl hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
              style={{ backgroundColor: appDeepLink.color }}
            >
              <Smartphone className="w-4 h-4" />
              <span>Open in {appDeepLink.appName} App</span>
            </a>

            <a
              href={resolvedTarget}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-2 transition"
            >
              <span>Continue in Web Browser</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Countdown & Status */}
          <div className="pt-2 border-t border-white/5 text-[11px] text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
            {countdown > 0 ? (
              <span>Auto-opening in <strong>{countdown}s</strong>...</span>
            ) : (
              <span>Attempted native app launch</span>
            )}
          </div>

        </div>
      </div>
    );
  }

  // 6. Active Standard Web Redirect View
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
              <span>{getDestinationHost(resolvedTarget)}</span>
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
    <Suspense fallback={<div className="min-h-screen bg-[#052536] flex items-center justify-center text-white text-xs">Redirecting...</div>}>
      <RedirectInner />
    </Suspense>
  );
}
