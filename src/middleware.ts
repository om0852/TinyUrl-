import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';
import { Link, LinkRule } from '@/lib/types';
import { extractGeoFromHeaders, resolveSmartTargetUrl } from '@/lib/geo';
import { cleanHost, isPlatformHost, resolveRequestHost } from '@/lib/domainHelper';

// Prefixes that belong exclusively to the main platform and must NEVER be served on custom domains
const PLATFORM_EXCLUSIVE_PREFIXES = [
  '/login',
  '/signup',
  '/invite',
  '/c',
  '/portal',
  '/landing',
  '/terms',
  '/privacy',
  '/stitch-screenshot',
  '/stitch-screen'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const currentHost = resolveRequestHost(name => request.headers.get(name)) || cleanHost(request.nextUrl.host);
  const isPlatform = isPlatformHost(currentHost);

  // 1. Static Assets & Framework Files (always pass through)
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CASE 1: CUSTOM DOMAIN REQUEST (!isPlatform)
  // Strict isolation: only short link redirection, unlock UI, and custom domain 404
  // The main platform (landing, dashboard, login, settings, etc.) is NEVER exposed here.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (!isPlatform) {
    // A. API routes on Custom Domains:
    // Only permit APIs strictly required for link resolution, unlocking, tracking, and OG preview
    if (pathname.startsWith('/api/')) {
      const isPermittedApi =
        pathname === '/api/v1/links/unlock' ||
        pathname === '/api/v1/track' ||
        pathname.startsWith('/api/v1/links') || // GET /api/v1/links or /api/v1/links/[code]/og-image
        pathname.startsWith('/api/v1/og-image') ||
        pathname.startsWith('/api/v1/blob-image');

      if (!isPermittedApi) {
        return NextResponse.json(
          { success: false, error: 'This API route is not available on custom domains.' },
          { status: 404 }
        );
      }
      return NextResponse.next();
    }

    // B. Root path on Custom Domain (pathname === '/' or '')
    if (pathname === '/' || pathname === '') {
      let rootRedirectUrl: string | null = null;
      try {
        let customDomain = await linkCache.get<{ id: string; hostname: string; root_redirect_url?: string }>(`domain_${currentHost}`);
        if (!customDomain) {
          const domainRows = (await sql.query(
            `SELECT id, hostname, root_redirect_url, verified FROM domains WHERE LOWER(hostname) = $1 AND verified = true LIMIT 1`,
            [currentHost]
          )) as unknown as Array<{ id: string; hostname: string; root_redirect_url?: string; verified: boolean }>;
          if (domainRows && domainRows.length > 0) {
            customDomain = domainRows[0];
            await linkCache.set(`domain_${currentHost}`, customDomain, 300);
          }
        }

        if (customDomain?.root_redirect_url && /^https?:\/\//i.test(customDomain.root_redirect_url)) {
          rootRedirectUrl = customDomain.root_redirect_url;
        }
      } catch (err) {
        console.error('Custom domain root redirect lookup error:', err);
      }

      if (rootRedirectUrl) {
        return NextResponse.redirect(new URL(rootRedirectUrl), 307);
      }

      // If no root_redirect_url is configured, return 404 (NEVER load platform landing page!)
      const notFoundUrl = new URL('/not-found', request.url);
      notFoundUrl.searchParams.set('domain', currentHost);
      return NextResponse.rewrite(notFoundUrl, { status: 404 });
    }

    // C. Internal /not-found path
    if (pathname === '/not-found') {
      return NextResponse.next();
    }

    // D. Internal /r/ bridge path on Custom Domain
    if (pathname.startsWith('/r/')) {
      const bridgeCode = pathname.slice(3).replace(/\/$/, '').toLowerCase();
      if (!bridgeCode) {
        const notFoundUrl = new URL('/not-found', request.url);
        notFoundUrl.searchParams.set('domain', currentHost);
        return NextResponse.rewrite(notFoundUrl, { status: 404 });
      }
      return NextResponse.next();
    }

    // E. Extract short code
    let code = pathname.slice(1).replace(/\/$/, '').toLowerCase();
    if (!code) {
      const notFoundUrl = new URL('/not-found', request.url);
      notFoundUrl.searchParams.set('domain', currentHost);
      return NextResponse.rewrite(notFoundUrl, { status: 404 });
    }

    // F. Resolve short link for this custom domain
    try {
      const cleanCode = code.replace(/\+$/, '');
      const cacheKey = `link_${currentHost}_${cleanCode}`;
      let linkData = await linkCache.get<Link & { rules?: string | LinkRule[] }>(cacheKey);

      if (!linkData) {
        const rows = (await sql.query(
          // Only links of the workspace that owns this verified domain: links pinned to it, or
          // links without a domain. NULL-domain links used to resolve on every custom domain.
          `SELECT l.* FROM domains d
           JOIN links l ON l.workspace_id = d.workspace_id
                       AND (l.domain_id = d.id OR l.domain_id IS NULL)
           WHERE LOWER(d.hostname) = $1 AND d.verified = true
             AND (LOWER(l.short_code) = $2 OR LOWER(l.custom_slug) = $2)
           ORDER BY (l.domain_id = d.id) DESC
           LIMIT 1`,
          [currentHost, cleanCode]
        )) as unknown as Array<Link & { rules?: string | LinkRule[] }>;

        if (rows && rows.length > 0) {
          linkData = rows[0];
          await linkCache.set(cacheKey, linkData, 180);
        }
      }

      // CRITICAL GUARD: If code is NOT a registered shortlink on this custom domain,
      // IMMEDIATELY RETURN 404. Never allow Next.js to route to platform pages (e.g. /landing).
      if (!linkData) {
        const notFoundUrl = new URL('/not-found', request.url);
        notFoundUrl.searchParams.set('domain', currentHost);
        notFoundUrl.searchParams.set('code', code);
        return NextResponse.rewrite(notFoundUrl, { status: 404 });
      }

      // Status and expiration guards
      if (linkData.status === 'disabled') {
        const notFoundUrl = new URL('/not-found', request.url);
        notFoundUrl.searchParams.set('domain', currentHost);
        notFoundUrl.searchParams.set('code', code);
        notFoundUrl.searchParams.set('reason', 'disabled');
        return NextResponse.rewrite(notFoundUrl, { status: 404 });
      }

      if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
        const notFoundUrl = new URL('/not-found', request.url);
        notFoundUrl.searchParams.set('domain', currentHost);
        notFoundUrl.searchParams.set('code', code);
        notFoundUrl.searchParams.set('reason', 'expired');
        return NextResponse.rewrite(notFoundUrl, { status: 404 });
      }

      if (linkData.max_clicks && linkData.clicks_count >= linkData.max_clicks) {
        const notFoundUrl = new URL('/not-found', request.url);
        notFoundUrl.searchParams.set('domain', currentHost);
        notFoundUrl.searchParams.set('code', code);
        notFoundUrl.searchParams.set('reason', 'click_limit');
        return NextResponse.rewrite(notFoundUrl, { status: 404 });
      }

      // If flagged, password protected, splash, frame, or public stats (+), route to bridge UI
      if (linkData.is_flagged || linkData.password_hash || code.endsWith('+')) {
        const rewriteUrl = new URL(`/r/${code}`, request.url);
        return NextResponse.rewrite(rewriteUrl);
      }

      // Resolve smart target URL (Location, Device, A/B Testing)
      let destinationUrl = linkData.destination_url;
      const rules: LinkRule[] = typeof linkData.rules === 'string' ? JSON.parse(linkData.rules) : (linkData.rules || []);
      const userAgent = request.headers.get('user-agent') || '';
      const geo = extractGeoFromHeaders(name => request.headers.get(name));
      const existingAbVariant = request.cookies.get(`ab_${cleanCode}`)?.value as 'A' | 'B' | undefined;

      if (rules.length > 0) {
        destinationUrl = resolveSmartTargetUrl({
          rules,
          defaultUrl: linkData.destination_url,
          userAgent,
          geo,
          abVariant: existingAbVariant || null
        });

        const abRule = rules.find(r => r.rule_type === 'ab');
        if (abRule && !existingAbVariant) {
          const isB = destinationUrl === abRule.target_url;
          const abRewriteUrl = new URL(`/r/${code}`, request.url);
          abRewriteUrl.searchParams.set('target', destinationUrl);
          const response = NextResponse.rewrite(abRewriteUrl);
          response.headers.set('x-destination-url', destinationUrl);
          response.cookies.set(`ab_${cleanCode}`, isB ? 'B' : 'A', {
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
            sameSite: 'lax',
          });
          return response;
        }
      }

      // Rewrite to /r/[code] for telemetry logging and fast redirection
      const rewriteUrl = new URL(`/r/${code}`, request.url);
      rewriteUrl.searchParams.set('target', destinationUrl);
      const res = NextResponse.rewrite(rewriteUrl);
      res.headers.set('x-destination-url', destinationUrl);
      return res;

    } catch (error) {
      console.error('Custom domain link resolution error:', error);
      const notFoundUrl = new URL('/not-found', request.url);
      notFoundUrl.searchParams.set('domain', currentHost);
      return NextResponse.rewrite(notFoundUrl, { status: 404 });
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CASE 2: PRIMARY PLATFORM DOMAIN REQUEST (isPlatform === true)
  // The full URL Shortener console, landing page, and routes are served here.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // On the platform domain, root '/', '/r/*', and platform-exclusive prefixes load normally
  if (
    pathname === '/' ||
    pathname.startsWith('/r/') ||
    pathname === '/not-found' ||
    PLATFORM_EXCLUSIVE_PREFIXES.some(prefix => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  // Extract potential short code on platform domain
  let code = pathname.startsWith('/r/') ? pathname.slice(3) : pathname.slice(1);
  code = code.replace(/\/$/, '').toLowerCase();

  if (!code) {
    return NextResponse.next();
  }

  try {
    const cleanCode = code.replace(/\+$/, '');
    const cacheKey = `link_${cleanCode}`;
    let linkData = await linkCache.get<Link & { rules?: string | LinkRule[] }>(cacheKey);

    if (!linkData) {
      const rows = (await sql.query(
        `SELECT * FROM links WHERE LOWER(short_code) = $1 OR LOWER(custom_slug) = $1 LIMIT 1`,
        [cleanCode]
      )) as unknown as Array<Link & { rules?: string | LinkRule[] }>;

      if (rows && rows.length > 0) {
        linkData = rows[0];
        await linkCache.set(cacheKey, linkData, 180);
      }
    }

    if (!linkData) {
      // On the platform domain, if not a shortlink, proceed to standard Next.js routing (or 404)
      return NextResponse.next();
    }

    // Status and expiration guards. These used to fall through to the page, which redirected
    // (and counted) disabled, expired and used-up links anyway.
    const inactiveReason = linkData.status === 'disabled' ? 'disabled'
      : linkData.expires_at && new Date(linkData.expires_at) < new Date() ? 'expired'
      : linkData.max_clicks && linkData.clicks_count >= linkData.max_clicks ? 'click_limit'
      : null;
    if (inactiveReason) {
      const notFoundUrl = new URL('/not-found', request.url);
      notFoundUrl.searchParams.set('code', code);
      notFoundUrl.searchParams.set('reason', inactiveReason);
      return NextResponse.rewrite(notFoundUrl, { status: 404 });
    }

    // If flagged, password protected, or public stats (+), let /r/[code] handle it
    if (linkData.is_flagged || linkData.password_hash || code.endsWith('+')) {
      return NextResponse.next();
    }

    let destinationUrl = linkData.destination_url;
    const rules: LinkRule[] = typeof linkData.rules === 'string' ? JSON.parse(linkData.rules) : (linkData.rules || []);
    const userAgent = request.headers.get('user-agent') || '';
    const geo = extractGeoFromHeaders(name => request.headers.get(name));
    const existingAbVariant = request.cookies.get(`ab_${cleanCode}`)?.value as 'A' | 'B' | undefined;

    if (rules.length > 0) {
      destinationUrl = resolveSmartTargetUrl({
        rules,
        defaultUrl: linkData.destination_url,
        userAgent,
        geo,
        abVariant: existingAbVariant || null
      });

      const abRule = rules.find(r => r.rule_type === 'ab');
      if (abRule && !existingAbVariant) {
        const isB = destinationUrl === abRule.target_url;
        const abRewriteUrl = new URL(`/r/${code}`, request.url);
        abRewriteUrl.searchParams.set('target', destinationUrl);
        const response = pathname.startsWith('/r/')
          ? NextResponse.next()
          : NextResponse.rewrite(abRewriteUrl);

        response.headers.set('x-destination-url', destinationUrl);
        response.cookies.set(`ab_${cleanCode}`, isB ? 'B' : 'A', {
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
          sameSite: 'lax',
        });
        return response;
      }
    }

    if (pathname.startsWith('/r/')) {
      return NextResponse.next();
    }

    const rewriteUrl = new URL(`/r/${code}`, request.url);
    rewriteUrl.searchParams.set('target', destinationUrl);
    const res = NextResponse.rewrite(rewriteUrl);
    res.headers.set('x-destination-url', destinationUrl);
    return res;
  } catch (error) {
    console.error('Platform link resolution error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
