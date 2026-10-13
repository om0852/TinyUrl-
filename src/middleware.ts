import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';

const EXCLUDED_PREFIXES = [
  '/_next',
  '/api',
  '/favicon.ico',
  '/terms',
  '/privacy',
  '/login',
  '/signup',
  '/stitch-screenshot',
  '/stitch-screen'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip system paths, root, and static assets
  if (
    pathname === '/' ||
    EXCLUDED_PREFIXES.some(prefix => pathname.startsWith(prefix)) ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. Extract potential short code (handles both /code and /r/code)
  let code = pathname.startsWith('/r/') ? pathname.slice(3) : pathname.slice(1);
  code = code.replace(/\/$/, '').toLowerCase();

  if (!code) {
    return NextResponse.next();
  }

  try {
    // 3. Fast Cache Lookup (Edge LRU Cache)
    let linkData: any = linkCache.get(`link_${code}`);

    if (!linkData) {
      // Query Neon PostgreSQL
      const rows = await sql.query(
        `SELECT * FROM links WHERE LOWER(short_code) = $1 LIMIT 1`,
        [code]
      );

      if (rows && rows.length > 0) {
        linkData = rows[0];
        linkCache.set(`link_${code}`, linkData, 180); // Cache for 3 minutes
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

    // 7. Server-Side Real-Time Click Tracking (Reliable across all mobile phones, apps, and browsers)
    try {
      const userAgent = request.headers.get('user-agent') || '';
      const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
      const isAndroid = /Android/i.test(userAgent);
      const device = isIOS || isAndroid ? 'mobile' : /iPad|Tablet/i.test(userAgent) ? 'tablet' : 'desktop';
      const os = isIOS ? 'iOS' : isAndroid ? 'Android' : /Mac/i.test(userAgent) ? 'macOS' : /Windows/i.test(userAgent) ? 'Windows' : 'Linux';
      const browser = /Chrome/i.test(userAgent) ? 'Chrome' : /Safari/i.test(userAgent) ? 'Safari' : /Firefox/i.test(userAgent) ? 'Firefox' : 'Edge';
      const rawCountryCode = (request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || '').trim().toUpperCase();
      const rawCity = request.headers.get('x-vercel-ip-city');
      const city = rawCity ? decodeURIComponent(rawCity) : 'Mobile Network';
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'ip_anon';
      const ipHash = 'ip_' + Math.abs(ip.split('').reduce((a, b) => (((a << 5) - a) + b.charCodeAt(0)) | 0, 0));

      let countryCode = rawCountryCode;
      let country = 'India';

      if (countryCode) {
        try {
          const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
          country = regionNames.of(countryCode) || (countryCode === 'IN' ? 'India' : countryCode === 'US' ? 'United States' : countryCode);
        } catch {
          country = countryCode === 'IN' ? 'India' : countryCode === 'US' ? 'United States' : countryCode;
        }
      } else {
        const acceptLang = (request.headers.get('accept-language') || '').toLowerCase();
        if (acceptLang.includes('in') || acceptLang.includes('hi')) {
          countryCode = 'IN';
          country = 'India';
        } else {
          countryCode = 'IN';
          country = 'India';
        }
      }

      // Asynchronously update PostgreSQL counters
      sql.query(
        `UPDATE links SET clicks_count = COALESCE(clicks_count, 0) + 1, updated_at = NOW() WHERE LOWER(short_code) = $1`,
        [code]
      ).catch(() => {});

      sql.query(
        `INSERT INTO click_events (id, link_id, short_code, ip_hash, country, country_code, city, device, os, browser, referrer, is_bot, is_unique, latency_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO NOTHING`,
        [
          `clk_${Date.now()}_${Math.floor(Math.random() * 8999 + 1000)}`,
          linkData.id,
          linkData.short_code || code,
          ipHash,
          country,
          countryCode || 'IN',
          city,
          device,
          os,
          browser,
          request.headers.get('referer') || 'Direct / Mobile',
          false,
          true,
          18
        ]
      ).catch(() => {});
    } catch {}

    // 8. Resolve Smart Edge Routing (Device, Geo & A/B Split Testing)
    let destinationUrl = linkData.destination_url;
    const rules = typeof linkData.rules === 'string' ? JSON.parse(linkData.rules) : (linkData.rules || []);

    const userAgent = request.headers.get('user-agent') || '';
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    const isAndroid = /Android/i.test(userAgent);
    const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || 'US';

    if (rules.length > 0) {
      // Device rule
      const deviceRule = rules.find((r: any) => 
        r.rule_type === 'device' && (
          (r.condition?.toLowerCase() === 'ios' && isIOS) ||
          (r.condition?.toLowerCase() === 'android' && isAndroid)
        )
      );

      if (deviceRule && deviceRule.target_url) {
        destinationUrl = deviceRule.target_url;
      } else {
        // Geo rule
        const geoRule = rules.find((r: any) => 
          r.rule_type === 'geo' && r.condition?.toUpperCase() === country.toUpperCase()
        );

        if (geoRule && geoRule.target_url) {
          destinationUrl = geoRule.target_url;
        } else {
          // A/B test rule
          const abRule = rules.find((r: any) => r.rule_type === 'ab');
          if (abRule && abRule.target_url) {
            const weight = abRule.weight || 50;
            if (Math.random() * 100 < weight) {
              destinationUrl = abRule.target_url;
            }
          }
        }
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
    return NextResponse.rewrite(new URL(`/r/${code}`, request.url));
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
