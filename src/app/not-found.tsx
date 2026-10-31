import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { cleanHost, isPlatformHost } from '@/lib/domainHelper';
import { Link2, AlertCircle, ArrowLeft, Globe, ExternalLink } from 'lucide-react';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';

interface NotFoundProps {
  searchParams?: Promise<{
    domain?: string;
    code?: string;
    reason?: string;
  }>;
}

export default async function NotFound(props?: NotFoundProps) {
  const sParams = props?.searchParams ? await props.searchParams : undefined;
  let customHost = sParams?.domain ? cleanHost(sParams.domain) : '';
  const requestedCode = sParams?.code ? sParams.code.trim().replace(/^\//, '') : '';
  const reason = sParams?.reason;

  if (!customHost) {
    try {
      const headersList = await headers();
      const rawHost = headersList.get('x-forwarded-host') ||
                      headersList.get('x-original-host') ||
                      headersList.get('host') || '';
      customHost = cleanHost(rawHost);
    } catch {
      // Fallback
    }
  }

  const isPlatform = isPlatformHost(customHost);

  // If this is a custom domain, check if a root redirect URL is available
  let rootRedirectUrl: string | null = null;
  if (!isPlatform && customHost) {
    try {
      let cachedDomain = await linkCache.get<{ root_redirect_url?: string }>(`domain_${customHost}`);
      if (!cachedDomain) {
        const rows = (await sql.query(
          `SELECT root_redirect_url FROM domains WHERE LOWER(hostname) = $1 LIMIT 1`,
          [customHost]
        )) as Array<{ root_redirect_url?: string }>;
        if (rows && rows.length > 0) {
          cachedDomain = rows[0];
          await linkCache.set(`domain_${customHost}`, cachedDomain, 300);
        }
      }
      if (cachedDomain?.root_redirect_url && /^https?:\/\//i.test(cachedDomain.root_redirect_url)) {
        rootRedirectUrl = cachedDomain.root_redirect_url;
      }
    } catch {
      // Ignore fallback
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // VIEW 1: CUSTOM DOMAIN 404 (Never leaks platform dashboard or branding)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (!isPlatform) {
    let reasonText = 'The requested short link does not exist or has been removed.';
    if (reason === 'expired') {
      reasonText = 'This short link has reached its expiration date.';
    } else if (reason === 'disabled') {
      reasonText = 'This short link is currently paused or inactive.';
    } else if (reason === 'click_limit') {
      reasonText = 'This short link has reached its maximum allowed click capacity.';
    } else if (!requestedCode) {
      reasonText = 'This domain is configured for short link redirection.';
    }

    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans selection:bg-lime-400/30">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-lime-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-lime-400/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-6 shadow-inner">
            {requestedCode ? (
              <AlertCircle className="w-8 h-8 text-amber-400" />
            ) : (
              <Globe className="w-8 h-8 text-lime-700" />
            )}
          </div>

          {/* Domain Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-xs font-mono text-slate-300 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {customHost || 'Custom Domain'}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            {requestedCode ? 'Link Not Found' : 'Domain Active'}
          </h1>

          {/* Description */}
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            {reasonText}
            {requestedCode && (
              <span className="block mt-2 font-mono text-xs text-lime-300 bg-slate-800/60 py-1 px-2 rounded-md border border-slate-700/40">
                /{requestedCode}
              </span>
            )}
          </p>

          {/* Action Button: Only if customer configured a root website */}
          {rootRedirectUrl && (
            <a
              href={rootRedirectUrl}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-lime-400 hover:bg-lime-500 text-on-primary font-medium text-sm transition-all shadow-lg shadow-lime-500/20 active:scale-[0.98]"
            >
              <span>Visit Main Website</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          <div className="mt-6 pt-6 border-t border-slate-800/80 text-[11px] text-slate-500">
            HTTP 404 &bull; Custom Domain Link Engine
          </div>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // VIEW 2: PRIMARY PLATFORM 404 (Full TinyURL platform experience)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans selection:bg-lime-400/30">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-lime-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-lime-400/10 border border-lime-500/20 flex items-center justify-center mb-6 shadow-inner">
          <Link2 className="w-8 h-8 text-lime-700" />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
          404 &bull; Page Not Found
        </h1>

        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          The short link or page you are looking for doesn&apos;t exist, has expired, or was relocated.
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-lime-400 hover:bg-lime-500 text-on-primary font-semibold text-sm transition-all shadow-lg shadow-lime-500/25 active:scale-[0.98]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to TinyURL Console</span>
        </Link>
      </div>
    </div>
  );
}
