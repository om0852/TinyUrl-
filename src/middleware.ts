import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';
import { Link, LinkRule } from '@/lib/types';
import { extractGeoFromHeaders, resolveSmartTargetUrl } from '@/lib/geo';

const EXCLUDED_PREFIXES = [
  '/_next',
  '/api',
  '/favicon.ico',
  '/terms',
  '/privacy',
  '/login',
  '/signup',
  '/invite',
  '/c',
  '/stitch-screenshot',
  '/stitch-screen'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawHost = request.headers.get('x-forwarded-host') ||
                  request.headers.get('x-original-host') ||
                  request.headers.get('host') ||
                  request.nextUrl.host || '';
  const currentHost = rawHost.split(',')[0].trim().split(':')[0].toLowerCase();
  const isPlatformDomain = currentHost === 'localhost' || 
                           currentHost === '127.0.0.1' || 
                           currentHost.includes('vercel.app') || 
                           currentHost === 'tinyurl.dev';

  // 1. Custom Domain Root Redirect (e.g. go.brand.com/ -> brand.com)
  if (!isPlatformDomain) {
    try {
      let customDomain = linkCache.get<{ id: string; hostname: string; root_redirect_url?: string }>(`domain_${currentHost}`);
      if (!customDomain) {
        const domainRows = (await sql.query(
          `SELECT id, hostname, root_redirect_url, verified FROM domains WHERE LOWER(hostname) = $1 AND verified = true LIMIT 1`,
          [currentHost]
        )) as unknown as Array<{ id: string; hostname: string; root_redirect_url?: string; verified: boolean }>;
        if (domainRows && domainRows.length > 0) {
          customDomain = domainRows[0];
          linkCache.set(`domain_${currentHost}`, customDomain, 300);
        }
      }

      if (customDomain && (pathname === '/' || pathname === '')) {
        if (customDomain.root_redirect_url && /^https?:\/\//i.test(customDomain.root_redirect_url)) {
          return NextResponse.redirect(new URL(customDomain.root_redirect_url), 307);
        }
      }
    } catch {
      // Fallback silently
    }
  }

  // 2. Skip system paths, root on platform domain, bridge path /r/, and static assets
  if (
    pathname === '/' ||
    pathname.startsWith('/r/') ||
    EXCLUDED_PREFIXES.some(prefix => pathname.startsWith(prefix)) ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 3. Extract potential short code (handles both /code and /r/code)
  let code = pathname.startsWith('/r/') ? pathname.slice(3) : pathname.slice(1);
  code = code.replace(/\/$/, '').toLowerCase();

  if (!code) {
    return NextResponse.next();
  }

  try {
    // 4. Fast Cache Lookup (Edge LRU Cache)
    const cacheKey = !isPlatformDomain ? `link_${currentHost}_${code}` : `link_${code}`;
    let linkData = linkCache.get<Link & { rules?: string | LinkRule[] }>(cacheKey);

    if (!linkData) {
      // Query Neon PostgreSQL
      let rows: Array<Link & { rules?: string | LinkRule[] }> = [];

      if (!isPlatformDomain) {
        // Look up link for this custom domain first, fallback to unassigned link
        rows = (await sql.query(
          `SELECT l.* FROM links l
           LEFT JOIN domains d ON d.id = l.domain_id
           WHERE (LOWER(d.hostname) = $1 OR l.domain_id IS NULL)
             AND (LOWER(l.short_code) = $2 OR LOWER(l.custom_slug) = $2)
           ORDER BY CASE WHEN LOWER(d.hostname) = $1 THEN 0 ELSE 1 END
           LIMIT 1`,
          [currentHost, code]
        )) as unknown as Array<Link & { rules?: string | LinkRule[] }>;
      } else {
        rows = (await sql.query(
          `SELECT * FROM links WHERE LOWER(short_code) = $1 OR LOWER(custom_slug) = $1 LIMIT 1`,
          [code]
        )) as unknown as Array<Link & { rules?: string | LinkRule[] }>;
      }

      if (rows && rows.length > 0) {
        linkData = rows[0];
        linkCache.set(cacheKey, linkData, 180); // Cache for 3 minutes
      }
    }

    if (!linkData) {
      // Not a registered shortlink, continue to standard Next.js routing
      return NextResponse.next();
    }

    // 4. Status and expiration guards
    if (linkData.status === 'disabled') {
      return NextResponse.next();
    }

    if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
      return NextResponse.next();
    }

    if (linkData.max_clicks && linkData.clicks_count >= linkData.max_clicks) {
      return NextResponse.next();
    }

    // 5. If flagged, quarantine interstitial handles it in React page
    if (linkData.is_flagged) {
      return NextResponse.next();
    }

    // 6. If password protected, let the password unlock UI handle it
    if (linkData.password_hash) {
      return NextResponse.next();
    }

    // 7. Hand off click tracking and telemetry to /r/[code] and /api/v1/track
    // Deduplication guarantees exact 1-count tracking per real user visit without double-counting.

    // 8. Resolve Smart Edge Routing (Location: City > State > Country, Device, & A/B Split Testing)
    let destinationUrl = linkData.destination_url;
    const rules: LinkRule[] = typeof linkData.rules === 'string' ? JSON.parse(linkData.rules) : (linkData.rules || []);

    const userAgent = request.headers.get('user-agent') || '';
    const geo = extractGeoFromHeaders(name => request.headers.get(name));
    const existingAbVariant = request.cookies.get(`ab_${code}`)?.value as 'A' | 'B' | undefined;

    if (rules.length > 0) {
      destinationUrl = resolveSmartTargetUrl({
        rules,
        defaultUrl: linkData.destination_url,
        userAgent,
        geo,
        abVariant: existingAbVariant || null
      });

      // Handle sticky A/B test assignment if an A/B rule exists and no cookie is set
      const abRule = rules.find(r => r.rule_type === 'ab');
      if (abRule && !existingAbVariant) {
        const isB = destinationUrl === abRule.target_url;
        const abRewriteUrl = new URL(`/r/${code}`, request.url);
        abRewriteUrl.searchParams.set('target', destinationUrl);
        const response = pathname.startsWith('/r/')
          ? NextResponse.next()
          : NextResponse.rewrite(abRewriteUrl);

        response.headers.set('x-destination-url', destinationUrl);
        response.cookies.set(`ab_${code}`, isB ? 'B' : 'A', {
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
          sameSite: 'lax',
        });
        return response;
      }
    }

    // 8. If request is already on /r/<code>, let Next.js route it
    if (pathname.startsWith('/r/')) {
      return NextResponse.next();
    }

    // 9. For standard browser requests, rewrite to /r/<code> so that:
    // - Client-side click tracking & telemetry run
    // - LocalStorage & StoreContext update in real time
    // - OpeninApp deep linking handles mobile apps cleanly
    // - Verified safe transition displays properly
    const rewriteUrl = new URL(`/r/${code}`, request.url);
    rewriteUrl.searchParams.set('target', destinationUrl);
    const res = NextResponse.rewrite(rewriteUrl);
    res.headers.set('x-destination-url', destinationUrl);
    return res;
  } catch (error) {
    console.error('Edge middleware error:', error);
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
