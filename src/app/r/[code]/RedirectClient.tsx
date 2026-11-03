'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useStore } from '@/lib/storeContext';
import { Link } from '@/lib/types';
import { Link2, ArrowRight, Shield, ShieldAlert, AlertTriangle, ExternalLink, Lock, Globe, Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { detectAppDeepLink, detectInAppBrowser } from '@/lib/deepLink';
import { resolveSmartTargetUrl } from '@/lib/geo';
import { isPlatformHost } from '@/lib/domainHelper';
import { PLATFORM_URL } from '@/lib/platformUrl';

// Seconds a Splash (or unverified) link waits before redirecting; the effect below counts it down
const SPLASH_SECONDS = 3;

// Only http(s) destinations are ever navigated to; javascript:, data: and the like become ''
function webUrlOrEmpty(raw: string | null | undefined): string {
  let value = (raw || '').trim();
  if (!value) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = 'https://' + value.replace(/^\/+/, '');
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

// Disabled, expired and used-up links behave like unknown links
function isLinkInactive(link: Link): boolean {
  if (link.status === 'disabled') return true;
  if (link.expires_at && new Date(link.expires_at) < new Date()) return true;
  return !!link.max_clicks && (link.clicks_count || 0) >= Number(link.max_clicks);
}

/* ─── Page shell: one centered card, no platform branding on customer domains ─── */
function PageShell({ children, isPlatform, wide = false }: { children: React.ReactNode; isPlatform: boolean; wide?: boolean }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-surface text-on-surface px-4 py-10">
      <main className={`w-full ${wide ? 'max-w-[460px]' : 'max-w-[400px]'}`}>{children}</main>
      {isPlatform && (
        <a href={PLATFORM_URL} className="mt-6 inline-flex items-center gap-1.5 text-[11px] text-outline hover:text-on-surface transition-colors">
          <Link2 className="w-3.5 h-3.5" /> Powered by TinyURL
        </a>
      )}
    </div>
  );
}

const card = 'w-full rounded-xl border-[0.5px] border-outline-variant bg-surface-container-lowest p-6 sm:p-7 shadow-sm';
const primaryBtn = 'w-full h-[40px] rounded-md bg-primary-container text-on-primary text-sm font-medium hover:bg-primary transition-colors cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60';
const quietLink = 'text-xs text-on-surface-variant hover:text-on-surface hover:underline cursor-pointer';

function IconTile({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'error' | 'brand' }) {
  const tones = {
    neutral: 'bg-surface-container text-on-surface-variant',
    error: 'bg-error-container text-error',
    brand: 'bg-primary-fixed text-primary-ink',
  };
  return <div className={`grid size-[44px] place-items-center rounded-md ${tones[tone]}`}>{children}</div>;
}

export interface RedirectClientProps {
  code: string;
  initialTarget?: string | null;
  initialLink?: Link | null;
  /** Signed token from the server that lets this page record one click */
  trackToken?: string;
}

export function RedirectClient({ code, initialTarget, initialLink, trackToken }: RedirectClientProps) {
  const { links, logClick } = useStore();
  const isPlatform = typeof window !== 'undefined' ? isPlatformHost(window.location.hostname) : true;

  // The server checks any ?target= against the link's own destinations before passing it in, so the
  // query string itself is never read here (it would let anyone choose where this page navigates)
  const edgeTarget = useMemo(() => webUrlOrEmpty(initialTarget), [initialTarget]);

  const [mounted, setMounted] = useState(true);
  const [resolvedLink, setResolvedLink] = useState<Link | null>(initialLink || null);
  const [resolving, setResolving] = useState(!initialLink && !edgeTarget);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [abRoll, setAbRoll] = useState(50);
  const [countdown, setCountdown] = useState(SPLASH_SECONDS);
  const [isFrameMode, setIsFrameMode] = useState(false);

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
    // 1. If edge/server middleware already computed the resolved destination URL, use it directly
    if (edgeTarget) return edgeTarget;

    // 2. Otherwise calculate using resolveSmartTargetUrl
    let finalUrl = (link && link.destination_url) || '';
    if (link?.rules && link.rules.length > 0) {
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      finalUrl = resolveSmartTargetUrl({
        rules: link.rules,
        defaultUrl: link.destination_url,
        userAgent,
        abVariant: abRoll < 50 ? 'B' : 'A'
      });
    }

    return webUrlOrEmpty(finalUrl);
  }, [edgeTarget, link, abRoll]);

  // Client device and in-app browser detection
  const clientContext = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return { isIOS: false, isAndroid: false, isMobile: false, inAppInfo: { isInApp: false, browserName: undefined as string | undefined }, isBot: false };
    }
    const ua = navigator.userAgent;
    const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIOS = /iPhone|iPod/i.test(ua) || isIPad;
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid;
    const inAppInfo = detectInAppBrowser(ua);
    const isBot = /bot|crawler|spider|crawling|slurp|duckduckbot|baiduspider|yandex/i.test(ua);
    return { isIOS, isAndroid, isMobile, inAppInfo, isBot };
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
          const rawRef = typeof document !== 'undefined' && document.referrer ? document.referrer : '';
          const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
          const inApp = detectInAppBrowser(ua);
          const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          const utmSource = urlParams?.get('utm_source') || urlParams?.get('ref') || urlParams?.get('source');

          let effectiveReferrer = rawRef;
          if (!effectiveReferrer && inApp.isInApp && inApp.browserName) {
            effectiveReferrer = inApp.browserName;
          } else if (!effectiveReferrer && utmSource) {
            effectiveReferrer = `utm:${utmSource}`;
          } else if (!effectiveReferrer) {
            effectiveReferrer = 'Direct / None';
          }

          logClick(link.id, {
            short_code: code,
            referrer: effectiveReferrer
          }, trackToken);
        } catch (err) {
          console.warn('Click logging error:', err);
        }
      }
    }

    // Apply Hide Referrer policy if configured
    if (typeof document !== 'undefined' && link?.hide_referrer) {
      try {
        let meta = document.querySelector('meta[name="referrer"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', 'referrer');
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', 'no-referrer');
      } catch {}
    }

    // Masked Frame Redirection
    if (link?.redirect_type === 'frame') {
      setIsFrameMode(true);
      return;
    }

    // Direct redirect immediately for safe links (only show intermediate screen when suspicious, password-protected, or splash/frame)
    const isSuspicious = Boolean(link?.is_flagged || (link?.status as string) === 'flagged' || (link?.risk_score && link.risk_score >= 60));
    const isSplash = link?.redirect_type === 'splash';

    if (!isSuspicious && !isSplash) {
      if (appDeepLink && activeNativeUri && activeNativeUri !== resolvedTarget) {
        // Android intent:// URIs carry their own browser_fallback_url, so hand off and stop
        if (clientContext.isAndroid && activeNativeUri.startsWith('intent://')) {
          window.location.href = activeNativeUri;
          return;
        }
        // iOS: try the app scheme and only fall back to the web URL if we are still on this
        // page afterwards. Replacing the location straight away cancelled the app launch.
        let leftPage = false;
        const markLeft = () => { leftPage = true; };
        document.addEventListener('visibilitychange', markLeft);
        window.addEventListener('pagehide', markLeft);
        window.addEventListener('blur', markLeft);
        try {
          window.location.href = activeNativeUri;
        } catch {}
        const fallbackTimer = setTimeout(() => {
          if (!leftPage && !document.hidden) window.location.replace(resolvedTarget);
        }, 1500);
        return () => {
          clearTimeout(fallbackTimer);
          document.removeEventListener('visibilitychange', markLeft);
          window.removeEventListener('pagehide', markLeft);
          window.removeEventListener('blur', markLeft);
        };
      }
      window.location.replace(resolvedTarget);
      return;
    }

    // If splash interstitial is enabled, show the countdown
    let hasNavigatedAway = false;
    const markNavigated = () => {
      hasNavigatedAway = true;
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) markNavigated();
    });
    window.addEventListener('pagehide', markNavigated);
    window.addEventListener('blur', markNavigated);

    let remaining = SPLASH_SECONDS;
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
    };
  }, [mounted, link, resolvedTarget, appDeepLink, activeNativeUri, clientContext, code, logClick]);

  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        const unlockedUrl = webUrlOrEmpty(data.destination_url);
        if (!unlockedUrl) {
          setPasswordError(true);
          return;
        }
        setResolvedLink(prev => prev ? { ...prev, destination_url: unlockedUrl } : ({ id: code, short_code: code, destination_url: unlockedUrl, redirect_type: 'direct' } as any));

        // Frame + Password combination: render the masked frame upon unlock
        if (link?.redirect_type === 'frame') {
          setIsFrameMode(true);
          return;
        }

        // Splash + Password combination: render the interstitial countdown upon unlock
        if (link?.redirect_type === 'splash') {
          return;
        }

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

  // ━━━ 1. Resolving the link ━━━
  if (!mounted || resolving) {
    return (
      <PageShell isPlatform={isPlatform}>
        <div className={`${card} flex items-center gap-3`}>
          <Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" />
          <span className="text-sm text-on-surface-variant">Opening link…</span>
        </div>
      </PageShell>
    );
  }

  // ━━━ 2. Unknown or inactive link ━━━
  if (!link || isLinkInactive(link)) {
    return (
      <PageShell isPlatform={isPlatform}>
        <div className={`${card} flex flex-col items-center text-center gap-4`}>
          <IconTile tone="error"><AlertTriangle className="w-5 h-5" /></IconTile>
          <div>
            <h1 className="text-lg font-semibold">Link not found</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              <span className="font-mono text-on-surface">/{code}</span> doesn&apos;t exist or is no longer active.
            </p>
          </div>
          {/* Always the deployed platform, also on custom domains */}
          <a href={`${PLATFORM_URL}/login`} className={primaryBtn}>Go to dashboard <ArrowRight className="w-4 h-4" /></a>
          <a href={PLATFORM_URL} className={quietLink}>Go to homepage</a>
        </div>
      </PageShell>
    );
  }

  // ━━━ 3. Masked frame ━━━
  if (isFrameMode && resolvedTarget) {
    const isFramingBlocked = /google\.com|youtube\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|github\.com/i.test(resolvedTarget);

    return (
      <div className="w-full h-screen fixed inset-0 z-50 flex flex-col bg-surface">
        <div className="h-12 bg-surface-container-lowest border-b-[0.5px] border-outline-variant px-3 sm:px-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid size-[28px] place-items-center rounded-md bg-surface-container text-on-surface-variant shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-on-surface truncate">{link.title || getDestinationHost(resolvedTarget)}</div>
              <div className="text-[11px] text-outline truncate">{getDestinationHost(resolvedTarget)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {isFramingBlocked && (
              <span className="hidden sm:inline text-[11px] text-amber-700">This site may not load here</span>
            )}
            <a
              href={resolvedTarget}
              target="_blank"
              rel="noopener noreferrer"
              className="h-[30px] px-3 rounded-md bg-primary-container text-on-primary text-xs font-medium hover:bg-primary transition-colors inline-flex items-center gap-1.5"
            >
              Open site <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
        <div className="flex-1 w-full relative bg-white">
          <iframe
            src={resolvedTarget}
            title={link.title || 'Destination'}
            className="w-full h-full border-none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads allow-modals"
          />
        </div>
      </div>
    );
  }

  // ━━━ 4. Shield: automated visitors get a neutral page ━━━
  if (link.shield_protection && clientContext.isBot) {
    return (
      <PageShell isPlatform={isPlatform}>
        <div className={`${card} flex flex-col items-center text-center gap-3`}>
          <IconTile><Shield className="w-5 h-5" /></IconTile>
          <h1 className="text-lg font-semibold">Protected link</h1>
          <p className="text-sm text-on-surface-variant">Open this link in a browser to continue.</p>
        </div>
      </PageShell>
    );
  }

  // ━━━ 5. Flagged by the security scan ━━━
  if (link.is_flagged || link.status === 'flagged') {
    const goBack = () => {
      if (window.history.length > 1) window.history.back();
      else window.location.assign(isPlatform ? PLATFORM_URL : '/');
    };
    return (
      <PageShell isPlatform={isPlatform} wide>
        <div className={`${card} flex flex-col gap-4 border-error/30`}>
          <div className="flex items-center gap-3">
            <IconTile tone="error"><ShieldAlert className="w-5 h-5" /></IconTile>
            <div>
              <h1 className="text-lg font-semibold">This link may be unsafe</h1>
              <p className="text-xs text-error">Flagged by a security scan</p>
            </div>
          </div>

          <div className="rounded-md bg-surface-container-low border-[0.5px] border-outline-variant p-3">
            <div className="text-[11px] text-outline">It leads to</div>
            <div className="text-sm font-medium text-on-surface break-all">{getDestinationHost(link.destination_url)}</div>
            <div className="mt-0.5 text-[11px] font-mono text-on-surface-variant break-all">{link.destination_url}</div>
          </div>

          <ul className="text-xs text-on-surface-variant list-disc pl-4 space-y-1">
            {(link.risk_reasons?.length ? link.risk_reasons : ['Possible phishing, scam or malware']).map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>

          <button type="button" onClick={goBack} className={primaryBtn}>Go back</button>
          <button type="button" onClick={() => { const dest = webUrlOrEmpty(link.destination_url); if (dest) window.location.replace(dest); }} className={`${quietLink} self-center text-error`}>
            Continue anyway
          </button>
        </div>
      </PageShell>
    );
  }

  // ━━━ 6. Password ━━━
  if (link.password_hash && !isUnlocked) {
    return (
      <PageShell isPlatform={isPlatform}>
        <div className={`${card} flex flex-col items-center text-center gap-4`}>
          <IconTile tone="brand"><Lock className="w-5 h-5" /></IconTile>
          <div>
            <h1 className="text-lg font-semibold">This link is protected</h1>
            <p className="mt-1 text-sm text-on-surface-variant">Enter the password to continue.</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="w-full flex flex-col gap-3 text-left">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                autoComplete="off"
                placeholder="Password"
                aria-label="Password"
                aria-invalid={passwordError}
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                className={`w-full h-[40px] pl-3 pr-10 rounded-md bg-surface-container-low text-sm text-on-surface border-[0.5px] outline-none ${passwordError ? 'border-error' : 'border-outline-variant focus:border-on-surface-variant'}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 px-3 text-outline hover:text-on-surface cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordError && <p role="alert" className="text-xs text-error">Wrong password. Try again.</p>}
            <button type="submit" disabled={isVerifyingPassword || !passwordInput.trim()} className={primaryBtn}>
              {isVerifyingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>
      </PageShell>
    );
  }

  // ━━━ 7. Splash / app hand-off: short countdown, then the destination ━━━
  const isRisky = (link.risk_score || 0) >= 60;
  const progress = Math.min(100, ((SPLASH_SECONDS - countdown) / SPLASH_SECONDS) * 100);
  const appColor = appDeepLink?.color || undefined;

  return (
    <PageShell isPlatform={isPlatform}>
      {/* Fallback for browsers without JS; plain web links only, never app deep links */}
      {!appDeepLink && resolvedTarget && <meta httpEquiv="refresh" content={`${SPLASH_SECONDS};url=${resolvedTarget}`} />}

      <div className={`${card} flex flex-col items-center text-center gap-4`}>
        {appColor ? (
          <div className="grid size-[44px] place-items-center rounded-md text-white" style={{ backgroundColor: appColor }}>
            <Zap className="w-5 h-5" />
          </div>
        ) : (
          <IconTile tone="brand"><Globe className="w-5 h-5" /></IconTile>
        )}

        <div className="min-w-0 w-full">
          <p className="text-xs text-outline">{appDeepLink ? `Opening in ${appDeepLink.appName}` : 'Taking you to'}</p>
          <h1 className="mt-0.5 text-lg font-semibold break-all">{getDestinationHost(resolvedTarget)}</h1>
          {link.title && link.title !== getDestinationHost(resolvedTarget) && (
            <p className="mt-0.5 text-xs text-on-surface-variant truncate">{link.title}</p>
          )}
        </div>

        {isRisky && (
          <div className="w-full rounded-md bg-amber-50 border-[0.5px] border-amber-200 px-3 py-2 text-left text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            <span>We couldn&apos;t verify this site. Check the address before entering any details.</span>
          </div>
        )}

        {clientContext.inAppInfo.isInApp && appDeepLink && (
          <div className="w-full rounded-md bg-surface-container-low px-3 py-2 text-left text-xs text-on-surface-variant">
            You&apos;re in {('browserName' in clientContext.inAppInfo ? clientContext.inAppInfo.browserName : undefined) || 'an in-app browser'}. Tap below to open the {appDeepLink.appName} app.
          </div>
        )}

        <div className="w-full">
          <div className="w-full h-1 rounded-full bg-surface-container overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-1000 ease-linear bg-primary-container"
              style={{ width: `${progress}%`, ...(appColor ? { backgroundColor: appColor } : {}) }}
            />
          </div>
          <p className="mt-2 text-[11px] text-outline">
            {countdown > 0 ? `${appDeepLink ? 'Website opens' : 'Opening'} in ${countdown}s` : 'Opening…'}
          </p>
        </div>

        {appDeepLink ? (
          <>
            <a
              href={activeNativeUri}
              onClick={() => tryRedirectToApp()}
              className="w-full h-[40px] rounded-md text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ backgroundColor: appColor || 'var(--color-primary-strong)' }}
            >
              Open in {appDeepLink.appName} <ExternalLink className="w-4 h-4" />
            </a>
            <a
              href={resolvedTarget}
              onClick={(e) => { e.preventDefault(); window.location.replace(resolvedTarget); }}
              className={quietLink}
            >
              Continue in browser
            </a>
          </>
        ) : (
          resolvedTarget && (
            <a href={resolvedTarget} onClick={(e) => { e.preventDefault(); window.location.replace(resolvedTarget); }} className={primaryBtn}>
              Continue now <ArrowRight className="w-4 h-4" />
            </a>
          )
        )}
      </div>
    </PageShell>
  );
}
