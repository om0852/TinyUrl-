'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/storeContext';
import { Link } from '@/lib/types';
import { Link2, ArrowRight, Shield, AlertTriangle, ExternalLink, Lock, Globe, Zap } from 'lucide-react';
import { detectAppDeepLink, detectInAppBrowser } from '@/lib/deepLink';

/* ─── Animated Progress Bar ─── */
function AnimatedProgressBar({
  duration = 2000,
  color = 'var(--primary)',
  onComplete,
}: {
  duration?: number;
  color?: string;
  onComplete?: () => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const startRef = useRef(0);
  const completedRef = useRef(false);

  useEffect(() => {
    startRef.current = performance.now();
    let raf: number;

    function tick(now: number) {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const pct = Math.round(progress * 100);

      if (barRef.current) barRef.current.style.width = `${pct}%`;
      if (labelRef.current) {
        const rem = Math.max(0, (duration - elapsed) / 1000).toFixed(1);
        labelRef.current.textContent =
          progress < 1 ? `Redirecting in ${rem}s` : 'Launching destination…';
      }

      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, onComplete]);

  return (
    <div className="w-full space-y-2">
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-container, #e9edff)' }}>
        <div
          ref={barRef}
          className="h-full rounded-full transition-[width] duration-75 ease-linear"
          style={{ width: '0%', backgroundColor: color }}
        />
      </div>
      <span
        ref={labelRef}
        className="block text-center text-xs tracking-wide"
        style={{ color: 'var(--on-surface-variant, #464555)' }}
      >
        Preparing redirect…
      </span>
    </div>
  );
}

/* ─── Conduit Animation (Source → Pulse → Destination) ─── */
function ConduitAnimation({ appName, appColor }: { appName?: string; appColor?: string }) {
  return (
    <div className="w-full max-w-xs py-4 flex items-center justify-between relative px-4 mx-auto">
      {/* Source Node */}
      <div className="relative flex items-center justify-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center relative shadow-sm"
          style={{
            backgroundColor: 'var(--surface-container, #e9edff)',
            border: '1px solid var(--outline-variant, #c7c4d8)',
          }}
        >
          <div
            className="absolute inset-0 rounded-2xl animate-ping opacity-20"
            style={{ backgroundColor: appColor || 'var(--primary, #4f46e5)' }}
          />
          <Link2 className="w-6 h-6" style={{ color: appColor || 'var(--primary, #4f46e5)' }} />
        </div>
      </div>

      {/* Pulsing Conduit Stream */}
      <div className="flex-1 mx-3 relative flex items-center justify-center">
        <div
          className="w-full h-1 rounded-full overflow-hidden relative"
          style={{ backgroundColor: 'var(--surface-container, #e9edff)' }}
        >
          <div
            className="h-full rounded-full animate-pulse w-full"
            style={{ backgroundColor: appColor || 'var(--primary, #4f46e5)' }}
          />
        </div>
        <div
          className="absolute w-2.5 h-2.5 rounded-full animate-ping"
          style={{
            backgroundColor: appColor || 'var(--primary, #4f46e5)',
            boxShadow: `0 0 12px ${appColor || 'var(--primary, #4f46e5)'}`,
          }}
        />
      </div>

      {/* Destination Node */}
      <div className="relative flex items-center justify-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center relative shadow-md"
          style={{
            backgroundColor: appColor || 'var(--primary, #4f46e5)',
            color: 'white',
            boxShadow: `0 4px 14px ${appColor || 'var(--primary, #4f46e5)'}33`,
          }}
        >
          {appName ? (
            <Zap className="w-6 h-6" />
          ) : (
            <Globe className="w-6 h-6" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Page Shell ─── */
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col justify-between items-center"
      style={{ backgroundColor: 'var(--background, #f9f9ff)', color: 'var(--foreground, #141b2b)' }}
    >
      {/* Header Logo Pill */}
      <header className="w-full pt-8 px-8 flex justify-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full shadow-sm"
          style={{
            backgroundColor: 'var(--card, #ffffff)',
            boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
          }}
        >
          <Link2 className="w-[18px] h-[18px]" style={{ color: 'var(--primary, #4f46e5)' }} />
          <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--foreground, #141b2b)' }}>
            TinyURL
          </span>
          <span
            className="text-xs px-1.5 rounded font-mono"
            style={{
              backgroundColor: 'var(--muted, #f1f3ff)',
              color: 'var(--muted-foreground, #464555)',
            }}
          >
            bridge
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full flex-1 flex flex-col items-center justify-center max-w-[1280px] mx-auto px-4 md:px-8">
        <div className="flex flex-col w-full items-center justify-center py-4">
          {/* Ambient Glow Orbs */}
          <div className="relative w-full max-w-xl flex flex-col items-center">
            <div
              className="absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none -z-10"
              style={{ backgroundColor: 'rgba(79, 70, 229, 0.07)' }}
            />
            <div
              className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-96 h-40 rounded-full blur-2xl pointer-events-none -z-10"
              style={{ backgroundColor: 'rgba(78, 69, 213, 0.07)' }}
            />

            {children}
          </div>
        </div>
      </main>

      {/* Footer spacer */}
      <div className="h-12" />
    </div>
  );
}

export interface RedirectClientProps {
  code: string;
  initialTarget?: string | null;
  initialLink?: Link | null;
}

export function RedirectClient({ code, initialTarget, initialLink }: RedirectClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { links, logClick } = useStore();

  const edgeTarget = useMemo(() => {
    if (initialTarget) return initialTarget;
    const fromParams = searchParams?.get('target');
    if (fromParams) return fromParams;
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        return url.searchParams.get('target') || '';
      } catch {
        return '';
      }
    }
    return '';
  }, [initialTarget, searchParams]);

  const [mounted, setMounted] = useState(true);
  const [resolvedLink, setResolvedLink] = useState<Link | null>(initialLink || null);
  const [resolving, setResolving] = useState(!initialLink && !edgeTarget);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [abRoll, setAbRoll] = useState(50);
  const [countdown, setCountdown] = useState(4);

  // Sticky A/B testing: read existing assignment from cookie or localStorage, or persist new assignment
  useEffect(() => {
    if (!code) return;
    try {
      const cleanCode = code.toLowerCase().trim();
      const storageKey = `ab_variant_${cleanCode}`;
      const savedRoll = localStorage.getItem(storageKey);
      if (savedRoll !== null && !isNaN(Number(savedRoll))) {
        setAbRoll(Number(savedRoll));
        return;
      }
      const match = document.cookie.match(new RegExp(`(?:^|; )ab_${cleanCode}=([^;]*)`));
      if (match && match[1]) {
        const roll = match[1] === 'B' ? 10 : 90;
        setAbRoll(roll);
        localStorage.setItem(storageKey, String(roll));
        return;
      }
      const newRoll = Math.floor(Math.random() * 100);
      setAbRoll(newRoll);
      localStorage.setItem(storageKey, String(newRoll));
      document.cookie = `ab_${cleanCode}=${newRoll < 50 ? 'B' : 'A'}; path=/; max-age=2592000; SameSite=Lax`;
    } catch {
      setAbRoll(Math.floor(Math.random() * 100));
    }
  }, [code]);

  // Dynamic link resolution across server props, store, localStorage, and API
  useEffect(() => {
    // If server already resolved the link or target, no client fetch is needed!
    if (initialLink || initialTarget || edgeTarget) {
      setResolving(false);
      setMounted(true);
      return;
    }

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
    fetch(`/api/v1/links?code=${encodeURIComponent(cleanCode)}`)
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
  }, [code, links, initialLink, initialTarget, edgeTarget]);

  // Synchronous resolution fallback if server provided target URL or initial link
  const link: Link | null = useMemo(() => {
    if (resolvedLink) return resolvedLink;
    if (initialLink) return initialLink;
    if (edgeTarget) {
      const clean = (code || '').toLowerCase().trim();
      return {
        id: `link_${clean}`,
        workspace_id: 'ws_default',
        short_code: code || clean,
        custom_slug: code || clean,
        domain_id: 'dom_primary',
        destination_url: edgeTarget,
        title: `Short Link /${code || clean}`,
        tags: [],
        clicks_count: 0,
        status: 'active',
        is_flagged: false,
        risk_score: 0,
        created_by: 'Owner',
        created_at: new Date().toISOString(),
        rules: []
      };
    }
    return null;
  }, [resolvedLink, initialLink, edgeTarget, code]);

  const hasLoggedRef = useRef(false);
  const hasRedirectedRef = useRef(false);

  // Compute smart destination URL
  const resolvedTarget = useMemo(() => {
    let finalUrl = edgeTarget || (link ? link.destination_url : '');

    if (!edgeTarget && link?.rules && link.rules.length > 0) {
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
      const isAndroid = /Android/i.test(userAgent);

      const deviceRule = link.rules.find(r => 
        r.rule_type === 'device' && (
          (r.condition?.toLowerCase() === 'ios' && isIOS) ||
          (r.condition?.toLowerCase() === 'android' && isAndroid) ||
          (r.condition?.toLowerCase() === 'all' && (isIOS || isAndroid))
        )
      );

      if (deviceRule && deviceRule.target_url) {
        finalUrl = deviceRule.target_url;
      } else {
        const abRule = link.rules.find(r => r.rule_type === 'ab');
        if (abRule && abRule.target_url) {
          const weight = abRule.weight || 50;
          if (abRoll < weight) {
            finalUrl = abRule.target_url;
          }
        }
      }
    }
    if (finalUrl && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.includes('://')) {
      finalUrl = 'https://' + finalUrl;
    }
    return finalUrl;
  }, [edgeTarget, link, abRoll]);

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
    const isTargetChanged = link?.destination_url && resolvedTarget !== link.destination_url;
    if (link?.deep_link && !isTargetChanged) {
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

    // Auto-detect deep link if not explicitly configured or if targeted by a rule
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

  const tryRedirectToApp = useCallback(() => {
    if (!activeNativeUri) return;
    try {
      window.location.href = activeNativeUri;
    } catch {
      window.location.replace(resolvedTarget);
    }
  }, [activeNativeUri, resolvedTarget]);

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

    // Log click event safely in the background (guaranteed exact 1 execution per pageview)
    if (!hasLoggedRef.current) {
      hasLoggedRef.current = true;
      let alreadyLogged = false;
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          const sKey = `snip_tracked_${code.toLowerCase().trim()}`;
          const lastLogged = window.sessionStorage.getItem(sKey);
          const now = Date.now();
          if (lastLogged && (now - Number(lastLogged)) < 5000) {
            alreadyLogged = true;
          } else {
            window.sessionStorage.setItem(sKey, String(now));
          }
        } catch {}
      }

      if (!alreadyLogged) {
        try {
          logClick(link.id, {
            short_code: code,
            referrer: typeof document !== 'undefined' && document.referrer ? document.referrer : 'Direct / None'
          });
        } catch (err) {
          console.warn('Click logging error:', err);
        }
      }
    }

    // Standard direct redirect for plain web links (no app deep link detected)
    if (!appDeepLink || activeNativeUri === resolvedTarget) {
      setTimeout(() => {
        window.location.replace(resolvedTarget);
      }, 30);
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
  }, [mounted, link, resolvedTarget, appDeepLink, activeNativeUri, clientContext, code, logClick]);

  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim() || isVerifyingPassword) return;

    setIsVerifyingPassword(true);
    setPasswordError(false);

    try {
      const res = await fetch('/api/v1/links/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, password: passwordInput.trim() })
      });

      const data = await res.json();

      if (res.ok && data.success && data.destination_url) {
        setIsUnlocked(true);
        setPasswordError(false);
        const unlockedUrl = data.destination_url;

        if (appDeepLink && (clientContext.isMobile || clientContext.inAppInfo.isInApp)) {
          tryRedirectToApp();
          setTimeout(() => {
            if (!document.hidden) {
              window.location.replace(unlockedUrl);
            }
          }, 3500);
        } else {
          window.location.replace(unlockedUrl);
        }
      } else {
        setPasswordError(true);
      }
    } catch {
      setPasswordError(true);
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const getDestinationHost = (rawUrl: string) => {
    try {
      return new URL(rawUrl).hostname;
    } catch {
      return rawUrl;
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. Initial hydration and link resolution loader
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (!mounted || resolving) {
    return (
      <PageShell>
        <div
          className="w-full rounded-xl shadow-xl p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden backdrop-blur-md"
          style={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            boxShadow: '0 10px 40px rgba(79, 70, 229, 0.05)',
          }}
        >
          <ConduitAnimation />
          <div className="flex flex-col items-center mt-4 text-center space-y-2">
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight" style={{ color: 'var(--foreground, #141b2b)' }}>
              Connecting…
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted-foreground, #464555)' }}>
              Resolving your short link
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. Short link not found state
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (!link) {
    return (
      <PageShell>
        <div
          className="w-full rounded-xl shadow-xl p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden backdrop-blur-md"
          style={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            boxShadow: '0 10px 40px rgba(79, 70, 229, 0.05)',
          }}
        >
          {/* Error Icon */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{
              backgroundColor: 'rgba(186, 26, 26, 0.08)',
              border: '1px solid rgba(186, 26, 26, 0.15)',
            }}
          >
            <AlertTriangle className="w-8 h-8" style={{ color: '#ba1a1a' }} />
          </div>

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1" style={{ color: 'var(--foreground, #141b2b)' }}>
            Link Not Found
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground, #464555)' }}>
            The short link <code className="font-mono px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--muted, #f1f3ff)', color: 'var(--primary, #4f46e5)' }}>/{code}</code> does not exist or has expired.
          </p>

          <button
            onClick={() => router.push('/')}
            className="w-full max-w-xs py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.97] cursor-pointer"
            style={{
              backgroundColor: 'var(--primary, #4f46e5)',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)',
            }}
          >
            Return to Homepage <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </PageShell>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. Security Warning / Phishing Block State
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (link.is_flagged || link.status === 'flagged') {
    return (
      <PageShell>
        <div
          className="w-full rounded-xl shadow-xl p-6 md:p-8 flex flex-col items-start text-left relative overflow-hidden backdrop-blur-md"
          style={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            border: '1px solid rgba(186, 26, 26, 0.2)',
            boxShadow: '0 10px 40px rgba(186, 26, 26, 0.06)',
          }}
        >
          {/* Warning Header */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'rgba(186, 26, 26, 0.1)',
                border: '1px solid rgba(186, 26, 26, 0.2)',
              }}
            >
              <Shield className="w-6 h-6" style={{ color: '#ba1a1a' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--foreground, #141b2b)' }}>Security Alert</h2>
              <p className="text-xs font-semibold" style={{ color: '#ba1a1a' }}>Flagged by threat scanner</p>
            </div>
          </div>

          {/* Threat Details */}
          <div
            className="w-full rounded-lg p-4 text-xs space-y-2 mb-5"
            style={{
              backgroundColor: 'rgba(186, 26, 26, 0.04)',
              border: '1px solid rgba(186, 26, 26, 0.1)',
            }}
          >
            <p className="font-semibold" style={{ color: '#ba1a1a' }}>Target URL:</p>
            <p
              className="font-mono text-xs break-all p-2 rounded"
              style={{
                backgroundColor: 'rgba(186, 26, 26, 0.06)',
                color: '#93000a',
                border: '1px solid rgba(186, 26, 26, 0.1)',
              }}
            >
              {link.destination_url}
            </p>
            <div className="pt-2" style={{ borderTop: '1px solid var(--border, #e1e8fd)' }}>
              <p className="font-semibold mb-1" style={{ color: 'var(--foreground, #141b2b)' }}>Threat Reasons:</p>
              <ul className="list-disc list-inside space-y-0.5" style={{ color: 'var(--muted-foreground, #464555)' }}>
                {link.risk_reasons?.map((reason, i) => (
                  <li key={i}>{reason}</li>
                )) || <li>Potential phishing, credential harvesting, or malware vector</li>}
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 w-full">
            <button
              onClick={() => router.push('/')}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              style={{
                backgroundColor: 'var(--muted, #f1f3ff)',
                color: 'var(--foreground, #141b2b)',
                border: '1px solid var(--border, #e1e8fd)',
              }}
            >
              Go to Safety
            </button>
            <button
              onClick={() => window.location.replace(link.destination_url)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer text-white"
              style={{ backgroundColor: 'rgba(186, 26, 26, 0.8)' }}
            >
              Proceed Anyway
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. Password Protection View
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (link.password_hash && !isUnlocked) {
    return (
      <PageShell>
        <div
          className="w-full rounded-xl shadow-xl p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden backdrop-blur-md"
          style={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            boxShadow: '0 10px 40px rgba(79, 70, 229, 0.05)',
            border: '1px solid var(--border, #e1e8fd)',
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{
              backgroundColor: 'rgba(79, 70, 229, 0.08)',
              border: '1px solid rgba(79, 70, 229, 0.15)',
            }}
          >
            <Lock className="w-6 h-6" style={{ color: 'var(--primary, #4f46e5)' }} />
          </div>

          <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--foreground, #141b2b)' }}>Protected Link</h2>
          <p className="text-sm mb-5" style={{ color: 'var(--muted-foreground, #464555)' }}>
            Enter password to access <strong style={{ color: 'var(--foreground, #141b2b)' }}>{link.title}</strong>
          </p>

          <form onSubmit={handlePasswordSubmit} className="w-full max-w-xs space-y-4">
            <div>
              <input
                type="password"
                placeholder="Enter password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
                style={{
                  backgroundColor: 'var(--muted, #f1f3ff)',
                  border: `1.5px solid ${passwordError ? '#ba1a1a' : 'var(--border, #e1e8fd)'}`,
                  color: 'var(--foreground, #141b2b)',
                }}
              />
              {passwordError && (
                <p className="text-xs text-left mt-1.5" style={{ color: '#ba1a1a' }}>
                  Incorrect password. Please try again.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.97] cursor-pointer"
              style={{
                backgroundColor: 'var(--primary, #4f46e5)',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)',
              }}
            >
              Continue to Link <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </PageShell>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. Active Direct Redirect View (Bridge Experience)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <PageShell>
      {/* Only use meta refresh for plain web links, NEVER for app deep links! */}
      {!appDeepLink && resolvedTarget && <meta httpEquiv="refresh" content={`2;url=${resolvedTarget}`} />}

      <div
        className="w-full rounded-xl shadow-xl p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(255,255,255,0.95)',
          boxShadow: '0 10px 40px rgba(79, 70, 229, 0.05)',
        }}
      >
        {/* Conduit Animation */}
        <ConduitAnimation
          appName={appDeepLink?.appName}
          appColor={appDeepLink?.color || 'var(--primary, #4f46e5)'}
        />

        {/* Typography */}
        <div className="flex flex-col items-center mt-4 text-center">
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight" style={{ color: 'var(--foreground, #141b2b)' }}>
            Redirecting you now…
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground, #464555)' }}>
            Taking you to{' '}
            <span className="font-medium" style={{ color: 'var(--foreground, #141b2b)' }}>
              {getDestinationHost(resolvedTarget)}
            </span>
          </p>
        </div>

        {/* Short Code & Safety Badge */}
        <div className="flex items-center gap-3 mt-4 text-xs" style={{ color: 'var(--muted-foreground, #464555)' }}>
          <span className="flex items-center gap-1 font-medium" style={{ color: '#16a34a' }}>
            <Shield className="w-3.5 h-3.5" /> Verified Safe
          </span>
          <span
            className="font-mono text-[11px] px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--muted, #f1f3ff)', color: 'var(--muted-foreground, #464555)' }}
          >
            /{code}
          </span>
        </div>

        {/* In-App Browser Callout */}
        {clientContext.inAppInfo.isInApp && (
          <div
            className="w-full mt-4 p-3 rounded-xl text-xs flex items-start gap-2.5 text-left"
            style={{
              backgroundColor: 'rgba(234, 179, 8, 0.08)',
              border: '1px solid rgba(234, 179, 8, 0.2)',
              color: '#92400e',
            }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#d97706' }} />
            <div className="space-y-0.5 leading-snug">
              <p className="font-semibold" style={{ color: '#92400e' }}>
                {clientContext.inAppInfo.browserName || 'In-App Browser'} detected
              </p>
              <p className="text-[11px]" style={{ color: '#a16207' }}>
                Tap below to open directly in the native {appDeepLink?.appName || 'target'} app with your signed-in account.
              </p>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="w-full mt-5">
          {appDeepLink ? (
            <div className="w-full space-y-2">
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--muted, #f1f3ff)' }}>
                <div
                  className="h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{
                    backgroundColor: appDeepLink.color || 'var(--primary, #4f46e5)',
                    width: `${((4 - countdown) / 4) * 100}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-center" style={{ color: 'var(--muted-foreground, #464555)' }}>
                {countdown > 0 ? (
                  <span>Launching {appDeepLink.appName}… web fallback in {countdown}s</span>
                ) : (
                  <span>Connecting to web destination…</span>
                )}
              </p>
            </div>
          ) : (
            <AnimatedProgressBar
              duration={2000}
              color="var(--primary, #4f46e5)"
            />
          )}
        </div>

        {/* Action Buttons */}
        {appDeepLink ? (
          <div className="w-full space-y-3 mt-5">
            <a
              href={activeNativeUri}
              onClick={() => tryRedirectToApp()}
              className="w-full py-3.5 px-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.97] shadow-lg cursor-pointer"
              style={{
                backgroundColor: appDeepLink.color || 'var(--primary, #4f46e5)',
                boxShadow: `0 4px 14px ${appDeepLink.color || 'var(--primary, #4f46e5)'}33`,
              }}
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
                className="text-xs transition cursor-pointer inline-flex items-center gap-1"
                style={{ color: 'var(--muted-foreground, #464555)' }}
              >
                <span>Continue in Web Browser</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        ) : (
          resolvedTarget && (
            <div className="mt-5 flex flex-col items-center w-full">
              <a
                href={resolvedTarget}
                onClick={() => {
                  window.location.replace(resolvedTarget);
                }}
                className="w-full max-w-xs py-2.5 px-4 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.97] cursor-pointer"
                style={{
                  backgroundColor: 'var(--primary, #4f46e5)',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)',
                }}
              >
                <span>Continue Now</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )
        )}
      </div>
    </PageShell>
  );
}
