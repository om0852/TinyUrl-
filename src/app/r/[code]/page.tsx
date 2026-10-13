'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/lib/storeContext';
import { Link } from '@/lib/types';
import { ShieldAlert, Lock, ArrowRight, ShieldCheck, AlertTriangle, ExternalLink } from 'lucide-react';
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
  const [abRoll, setAbRoll] = useState(50);
  const [countdown, setCountdown] = useState(4);

  // Initialize random seed for A/B testing safely inside effect
  useEffect(() => {
    setAbRoll(Math.floor(Math.random() * 100));
  }, []);

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
            (l: Link) => (l.short_code && l.short_code.toLowerCase() === cleanCode) ||
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
  const hasRedirectedRef = React.useRef(false);

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
          if (abRoll < weight) {
            finalUrl = abRule.target_url;
          }
        }
      }
    }
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    return finalUrl;
  }, [link, abRoll]);

  // Client device and in-app browser detection
  const clientContext = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return { isIOS: false, isAndroid: false, isMobile: false, inAppInfo: { isInApp: false } };
    }
    const ua = navigator.userAgent;
    const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIOS = /iPhone|iPod/i.test(ua) || isIPad;
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid;
    const inAppInfo = detectInAppBrowser(ua);
    return { isIOS, isAndroid, isMobile, inAppInfo };
  }, []);

  // Deep Link details (OpeninApp feature)
  const appDeepLink = useMemo(() => {
    if (!resolvedTarget) return null;
    
    // Check if configured explicitly or auto-detected
    if (link?.deep_link) {
      if (link.deep_link.enabled === false) return null;
      const auto = detectAppDeepLink(resolvedTarget);
      return {
        app: link.deep_link.app,
        appName: link.deep_link.app_name || auto?.appName || 'App',
        color: auto?.color || '#FF0000',
        desktopUri: auto?.desktopUri || link.deep_link.app_uri || auto?.iosUri || resolvedTarget,
        iosUri: auto?.iosUri || link.deep_link.ios_uri || link.deep_link.app_uri || resolvedTarget,
        androidIntent: auto?.androidIntent || link.deep_link.android_intent || resolvedTarget,
        fallbackUrl: link.deep_link.fallback_url || resolvedTarget
      };
    }

    // Auto-detect deep link if not explicitly configured
    return detectAppDeepLink(resolvedTarget);
  }, [resolvedTarget, link]);

  // The active native URI (Android Intent, iOS URI, or Desktop URI)
  const activeNativeUri = useMemo(() => {
    if (!appDeepLink) return resolvedTarget;
    if (clientContext.isAndroid && appDeepLink.androidIntent) {
      return appDeepLink.androidIntent;
    }
    if (clientContext.isIOS && appDeepLink.iosUri) {
      return appDeepLink.iosUri;
    }
    // Desktop Chrome / Windows / Mac native app URI
    return appDeepLink.desktopUri || appDeepLink.iosUri || resolvedTarget;
  }, [appDeepLink, clientContext, resolvedTarget]);

  const tryRedirectToApp = () => {
    if (!activeNativeUri) return;
    try {
      window.location.href = activeNativeUri;
    } catch {
      window.location.replace(resolvedTarget);
    }
  };

  // Main redirect logic & click tracking: direct app opening or instant browser navigation
  useEffect(() => {
    if (!mounted || !link || !resolvedTarget || hasRedirectedRef.current) return;

    // Expiration or click limit checks
    if (link.expires_at && new Date(link.expires_at) < new Date()) return;
    if (link.max_clicks && link.clicks_count >= link.max_clicks) return;
    if (link.status === 'disabled') return;

    // If password-protected or flagged, do not redirect automatically
    if (link.password_hash || link.is_flagged || link.status !== 'active') return;

    // Prevent duplicate redirection triggers
    hasRedirectedRef.current = true;

    // Log click event safely in the background (will not block or cancel navigation)
    if (!hasLoggedRef.current) {
      hasLoggedRef.current = true;
      try {
        logClick(link.id, {
          short_code: code,
          referrer: typeof document !== 'undefined' && document.referrer ? document.referrer : 'Direct / None'
        });
      } catch (err) {
        console.warn('Click logging error:', err);
      }
    }

    // Standard direct redirect for plain web links (no app deep link detected)
    if (!appDeepLink || activeNativeUri === resolvedTarget) {
      window.location.replace(resolvedTarget);
      return;
    }

    // Direct OpenInApp / System Native App Deep Link execution
    let hasNavigatedAway = false;
    const markNavigated = () => {
      hasNavigatedAway = true;
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) markNavigated();
    });
    window.addEventListener('pagehide', markNavigated);
    window.addEventListener('blur', markNavigated);

    // 1. Attempt programmatic launch immediately
    try {
      window.location.href = activeNativeUri;
    } catch (e) {
      console.warn('Initial app launch attempt:', e);
    }

    // 2. Attach user gesture handlers for mobile: any screen interaction triggers intent
    const handleGestureLaunch = () => {
      if (!hasNavigatedAway) {
        try {
          window.location.href = activeNativeUri;
        } catch {}
      }
    };
    window.addEventListener('touchstart', handleGestureLaunch, { once: true, passive: true });
    window.addEventListener('click', handleGestureLaunch, { once: true, passive: true });

    // 3. Graceful countdown timer (4s): gives the native app sufficient time to launch
    let remaining = 4;
    const interval = setInterval(() => {
      if (hasNavigatedAway || document.hidden) {
        clearInterval(interval);
        return;
      }
      remaining -= 1;
      setCountdown(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(interval);
        if (!hasNavigatedAway && !document.hidden) {
          window.location.replace(resolvedTarget);
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', markNavigated);
      window.removeEventListener('blur', markNavigated);
      window.removeEventListener('touchstart', handleGestureLaunch);
      window.removeEventListener('click', handleGestureLaunch);
    };
  }, [mounted, link, resolvedTarget, appDeepLink, activeNativeUri, clientContext]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (link && link.password_hash === passwordInput) {
      setPasswordError(false);
      setIsUnlocked(true);
      if (appDeepLink && (clientContext.isMobile || clientContext.inAppInfo.isInApp)) {
        tryRedirectToApp();
        setTimeout(() => {
          if (!document.hidden) {
            window.location.replace(resolvedTarget);
          }
        }, 3500);
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

  // Active Direct Redirect View (OpeninApp experience)
  return (
    <div className="min-h-screen bg-[#052536] flex items-center justify-center p-4 selection:bg-[#008296]">
      {/* Only use meta refresh for plain web links, NEVER for app deep links! */}
      {!appDeepLink && resolvedTarget && <meta httpEquiv="refresh" content={`2;url=${resolvedTarget}`} />}
      <div className="bg-[#072e42] max-w-sm w-full p-6 rounded-2xl border border-[#0b4566] text-white shadow-2xl space-y-5">
        
        {/* Destination Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-medium text-emerald-400">
              <ShieldCheck className="w-4 h-4" /> Verified Safe
            </span>
            <span className="font-mono text-[11px] text-slate-400">/{code}</span>
          </div>

          <div className="p-3.5 bg-[#052536] rounded-xl border border-white/10 text-left">
            <p className="text-[11px] text-slate-400 font-medium mb-1 flex items-center justify-between">
              <span>{appDeepLink ? `Target App: ${appDeepLink.appName}` : 'Destination:'}</span>
              {appDeepLink && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${appDeepLink.color}25`, color: appDeepLink.color }}>
                  Direct Launch
                </span>
              )}
            </p>
            <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
              <span>{getDestinationHost(resolvedTarget)}</span>
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            </p>
          </div>
        </div>

        {/* In-App Browser Callout (Instagram, TikTok, Facebook, etc.) */}
        {clientContext.inAppInfo.isInApp && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-start gap-2.5 text-left">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="space-y-0.5 leading-snug">
              <p className="font-semibold text-amber-200">
                {clientContext.inAppInfo.browserName || 'In-App Browser'} detected
              </p>
              <p className="text-[11px] text-amber-300/90">
                Tap below to open directly in the native {appDeepLink?.appName || 'target'} app with your signed-in account.
              </p>
            </div>
          </div>
        )}

        {/* Linear Loading Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-[#052536] h-1.5 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full transition-all duration-1000 ease-linear rounded-full"
              style={{
                backgroundColor: appDeepLink?.color || '#008296',
                width: appDeepLink ? `${((4 - countdown) / 4) * 100}%` : '100%'
              }}
            />
          </div>
          <p className="text-[11px] text-slate-400 text-center">
            {appDeepLink ? (
              countdown > 0 ? (
                <span>Launching {appDeepLink.appName}... web fallback in {countdown}s</span>
              ) : (
                <span>Connecting to web destination...</span>
              )
            ) : (
              'Taking you to target URL...'
            )}
          </p>
        </div>

        {/* Action Buttons */}
        {appDeepLink ? (
          <div className="space-y-3 pt-1">
            <a
              href={activeNativeUri}
              onClick={() => tryRedirectToApp()}
              className="w-full py-3.5 px-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2.5 transition active:scale-[0.98] shadow-lg cursor-pointer"
              style={{ backgroundColor: appDeepLink.color || '#008296' }}
            >
              {appDeepLink.app === 'youtube' ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              <span>Open in {appDeepLink.appName} App</span>
            </a>

            <div className="text-center">
              <a
                href={resolvedTarget}
                onClick={(e) => {
                  e.preventDefault();
                  window.location.replace(resolvedTarget);
                }}
                className="text-xs text-slate-400 hover:text-white transition cursor-pointer inline-flex items-center gap-1"
              >
                <span>Continue in Web Browser</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        ) : (
          resolvedTarget && (
            <div className="pt-1 flex flex-col items-center">
              <a
                href={resolvedTarget}
                onClick={() => {
                  window.location.replace(resolvedTarget);
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-[#008296] hover:bg-[#009cb3] active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
              >
                <span>Continue Now</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )
        )}

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
