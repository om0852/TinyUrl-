import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { after } from 'next/server';
import { Metadata } from 'next';
import crypto from 'crypto';
import { sql } from '@/lib/postgres';
import { Link, LinkRule } from '@/lib/types';
import { extractGeoFromHeaders, getTrustedEdgeClientIp, resolveSmartTargetUrl } from '@/lib/geo';
import { RedirectClient } from './RedirectClient';
import { PublicStatsClient } from '@/components/PublicStatsClient';
import { linkCache } from '@/lib/cache';
import { cleanHost, isPlatformHost } from '@/lib/domainHelper';

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ target?: string; title?: string; id?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  if (!code) return {};

  try {
    const cleanCode = code.replace(/\+$/, '').trim().toLowerCase();

    // Check Redis & Edge memory cache first
    let link: {
      title?: string;
      destination_url?: string;
      short_code?: string;
      custom_slug?: string;
      og_title?: string;
      og_description?: string;
      og_image_url?: string;
    } | null = null;

    const cachedLink = await linkCache.get<any>(`link_${cleanCode}`);
    if (cachedLink) {
      link = {
        title: cachedLink.title,
        destination_url: cachedLink.destination_url,
        short_code: cachedLink.short_code,
        custom_slug: cachedLink.custom_slug,
        og_title: cachedLink.og_title,
        og_description: cachedLink.og_description,
        og_image_url: cachedLink.og_image_url
      };
    } else {
      const rows = (await sql.query(
        `SELECT title, destination_url, short_code, custom_slug, og_title, og_description, og_image_url 
         FROM links 
         WHERE LOWER(short_code) = $1 OR LOWER(custom_slug) = $1 
         LIMIT 1`,
        [cleanCode]
      )) as Array<{
        title?: string;
        destination_url?: string;
        short_code?: string;
        custom_slug?: string;
        og_title?: string;
        og_description?: string;
        og_image_url?: string;
      }>;

      if (rows && rows.length > 0) {
        link = rows[0];
      }
    }

    if (link) {
      const title = link.og_title?.trim() || link.title?.trim() || `Link /${link.short_code}`;
      const description = link.og_description?.trim() || `Open link: ${link.destination_url || 'destination'}`;
      
      const headersList = await headers().catch(() => null);
      const rawHost = headersList?.get('x-forwarded-host') || headersList?.get('host') || 'creataurus.work.gd';
      const proto = headersList?.get('x-forwarded-proto') || (rawHost.includes('localhost') ? 'http' : 'https');
      const host = rawHost.split(',')[0].trim().split(':')[0];
      const baseUrl = `${proto}://${host}`;
      const canonicalUrl = `${baseUrl}/${link.custom_slug || link.short_code}`;

      // Open Graph image for social platforms (WhatsApp, Twitter, Facebook, LinkedIn)
      // Always served through our optimized /og-image route which authenticates private blobs,
      // resizes to 1200x630, and compresses to progressive JPEG strictly under 300KB.
      const ogCode = link.custom_slug || link.short_code;
      const imageUrl = `${baseUrl}/api/v1/links/${ogCode}/og-image`;

      return {
        title,
        description,
        metadataBase: new URL(baseUrl),
        alternates: {
          canonical: canonicalUrl
        },
        openGraph: {
          title,
          description,
          url: canonicalUrl,
          siteName: host,
          locale: 'en_US',
          type: 'website',
          images: [
            {
              url: imageUrl,
              secureUrl: imageUrl,
              width: 1200,
              height: 630,
              alt: title,
              type: 'image/jpeg'
            }
          ]
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          site: `@${host}`,
          images: [imageUrl]
        }
      };
    }
  } catch (err) {
    console.warn('Metadata generation error:', err);
  }

  return {};
}

export default async function RedirectPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const sParams = await searchParams;

  let initialLink: Link | null = null;
  let isSocialCrawler = false;
  let shouldDirectRedirectUrl: string | null = null;
  let initialTarget: string | null = null;
  const rawQueryTarget = sParams.target ? decodeURIComponent(sParams.target) : null;

  if (code) {
    try {
      const isPublicStatsRequest = code.endsWith('+') || sParams.target === 'stats';
      const cleanCode = code.replace(/\+$/, '').trim().toLowerCase();
      const headersList = await headers();
      const rawHost = headersList.get('x-forwarded-host') || headersList.get('host') || '';
      const userAgent = headersList.get('user-agent') || '';
      const currentHost = cleanHost(rawHost);
      
      // Comprehensive social crawler detection: WhatsApp, Facebook, Meta external agents, Twitter/X, Telegram, Slack, LinkedIn, Discord, Applebot, Skype, Pinterest
      isSocialCrawler = /whatsapp|facebookexternalhit|meta-externalagent|meta-externalfetcher|facebot|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|applebot|skypeuripreview|pinterest/i.test(userAgent);

      const isPlatformDomain = isPlatformHost(currentHost);

      let rows: Array<{
        id: string;
        workspace_id?: string;
        domain_id?: string;
        short_code: string;
        custom_slug?: string;
        destination_url: string;
        title?: string;
        tags?: string[] | string;
        clicks_count?: number;
        status?: string;
        is_flagged?: boolean;
        risk_score?: number;
        created_by?: string;
        created_at?: string;
        rules?: LinkRule[] | string;
        password_hash?: string;
        expires_at?: string;
        max_clicks?: number;
        redirect_type?: string;
        http_status_code?: number;
        notes?: string;
        shield_protection?: boolean;
        hide_referrer?: boolean;
        channel?: string;
        og_title?: string;
        og_description?: string;
        og_image_url?: string;
        utm_source?: string;
        utm_medium?: string;
        utm_campaign?: string;
        utm_term?: string;
        utm_content?: string;
      }> = [];

      const cacheKey = !isPlatformDomain ? `link_${currentHost}_${cleanCode}` : `link_${cleanCode}`;
      const cached = await linkCache.get<any>(cacheKey);

      if (cached && typeof cached === 'object') {
        rows = [cached];
      } else {
        if (!isPlatformDomain) {
          rows = (await sql.query(
            `SELECT l.* FROM links l
             LEFT JOIN domains d ON d.id = l.domain_id
             WHERE (LOWER(d.hostname) = $1 OR l.domain_id IS NULL)
               AND (LOWER(l.short_code) = $2 OR LOWER(l.custom_slug) = $2)
             ORDER BY CASE WHEN LOWER(d.hostname) = $1 THEN 0 ELSE 1 END
             LIMIT 1`,
            [currentHost, cleanCode]
          )) as unknown as typeof rows;
        } else {
          rows = (await sql.query(
            `SELECT * FROM links WHERE LOWER(short_code) = $1 OR LOWER(custom_slug) = $1 LIMIT 1`,
            [cleanCode]
          )) as unknown as typeof rows;
        }

        if (rows && rows.length > 0) {
          await linkCache.set(cacheKey, rows[0], 180);
        }
      }

      if (!rows || rows.length === 0) {
        if (!isPlatformDomain) {
          notFound();
        }
      }

      if (rows && rows.length > 0) {
        const row = rows[0];
        const isPasswordLocked = !!row.password_hash;
        const parsedRules: LinkRule[] = isPasswordLocked 
          ? [] 
          : (typeof row.rules === 'string' ? JSON.parse(row.rules) : (Array.isArray(row.rules) ? row.rules : []));

        initialLink = {
          id: row.id,
          workspace_id: row.workspace_id || '',
          short_code: row.short_code,
          custom_slug: row.custom_slug || row.short_code,
          domain_id: row.domain_id || 'dom_primary',
          destination_url: isPasswordLocked ? '' : row.destination_url,
          title: row.title || `Short Link /${row.short_code}`,
          tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (Array.isArray(row.tags) ? row.tags : []),
          clicks_count: Number(row.clicks_count) || 0,
          status: (row.status as 'active' | 'disabled' | 'expired' | 'flagged') || 'active',
          is_flagged: !!row.is_flagged,
          risk_score: Number(row.risk_score) || 0,
          created_by: row.created_by || 'Owner',
          created_at: row.created_at || new Date().toISOString(),
          rules: parsedRules,
          expires_at: row.expires_at || undefined,
          max_clicks: row.max_clicks ? Number(row.max_clicks) : undefined,
          password_hash: row.password_hash ? 'PROTECTED' : undefined,
          redirect_type: (row.redirect_type as 'direct' | 'frame' | 'splash') || 'direct',
          http_status_code: (row.http_status_code as 301 | 302 | 307 | 308) || 301,
          notes: row.notes,
          shield_protection: Boolean(row.shield_protection),
          hide_referrer: Boolean(row.hide_referrer),
          channel: row.channel,
          og_title: row.og_title,
          og_description: row.og_description,
          og_image_url: row.og_image_url,
          utm_source: row.utm_source,
          utm_medium: row.utm_medium,
          utm_campaign: row.utm_campaign,
          utm_term: row.utm_term,
          utm_content: row.utm_content
        };

        // If public stats requested via '+' suffix, deliver public stats view!
        if (isPublicStatsRequest && initialLink) {
          return <PublicStatsClient link={initialLink} host={currentHost} />;
        }

        // Strict Open Redirect Guard: Only allow rawQueryTarget if it exactly matches the registered destination or a rule target
        const allowedTargets = new Set([row.destination_url, ...parsedRules.map(r => r.target_url)].filter(Boolean));
        if (rawQueryTarget && allowedTargets.has(rawQueryTarget)) {
          initialTarget = rawQueryTarget;
        }

        // Server-Side Location & Device Smart Routing evaluation
        if (!initialTarget && !isPasswordLocked && parsedRules.length > 0) {
          try {
            const geo = extractGeoFromHeaders(name => headersList.get(name));

            const resolved = resolveSmartTargetUrl({
              rules: parsedRules,
              defaultUrl: row.destination_url,
              userAgent,
              geo
            });

            if (resolved && allowedTargets.has(resolved)) {
              initialTarget = resolved;
            }
          } catch {}
        }

        if (!initialTarget && !isPasswordLocked) {
          initialTarget = row.destination_url;
        }

        // If social crawler (WhatsApp/Telegram/Facebook), deliver direct preview card
        if (isSocialCrawler) {
          const ogTitle = initialLink.og_title || initialLink.title;
          const ogDesc = initialLink.og_description || `Click to open link on ${currentHost}`;
          const proto = headersList.get('x-forwarded-proto') || (rawHost.includes('localhost') ? 'http' : 'https');
          const displayImg = `${proto}://${currentHost}/api/v1/links/${initialLink.custom_slug || initialLink.short_code}/og-image`;

          return (
            <div style={{ padding: '40px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
              {displayImg && (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={displayImg} 
                  alt={ogTitle} 
                  style={{ width: '100%', maxHeight: '315px', objectFit: 'contain', backgroundColor: '#020617', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' }} 
                />
              )}
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', marginBottom: '10px' }}>{ogTitle}</h1>
              <p style={{ fontSize: '15px', color: '#64748b', lineHeight: '1.5', marginBottom: '20px' }}>{ogDesc}</p>
              <a 
                href={initialTarget || row.destination_url} 
                style={{ display: 'inline-block', backgroundColor: '#4f46e5', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}
              >
                Continue to Destination &rarr;
              </a>
            </div>
          );
        }

        // Check if link requires intermediate UI (Suspicious, Password, Splash, Masked Frame)
        const isSuspicious = Boolean(row.is_flagged || row.status === 'flagged' || Number(row.risk_score || 0) >= 60);
        const isSplashOrFrame = initialLink.redirect_type === 'splash' || initialLink.redirect_type === 'frame';

        // DIRECT REDIRECT: If the link is clean and safe, redirect user immediately without showing redirect page!
        if (initialTarget && !isSuspicious && !isPasswordLocked && !isSplashOrFrame) {
          // Asynchronously log the click in the background with rich telemetry
          try {
            const trustedIp = getTrustedEdgeClientIp(name => headersList.get(name));
            const ip = trustedIp || headersList.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
            const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
            const geo = extractGeoFromHeaders(name => headersList.get(name));
            const referrer = headersList.get('referer') || 'Direct / None';
            const ua = userAgent || '';
            const rawLang = headersList.get('accept-language')?.split(',')[0]?.split(';')[0]?.trim() || 'en-US';

            const isMobile = /mobile|iphone|ipod|android/i.test(ua);
            const isTablet = /tablet|ipad/i.test(ua);
            const device = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

            let os = 'Windows';
            if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
            else if (/android/i.test(ua)) os = 'Android';
            else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
            else if (/linux/i.test(ua)) os = 'Linux';
            else if (/windows/i.test(ua)) os = 'Windows';

            let browser = 'Chrome';
            if (/edg/i.test(ua)) browser = 'Edge';
            else if (/opr|opera/i.test(ua)) browser = 'Opera';
            else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
            else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
            else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
            else if (/instagram|fbav|whatsapp|tiktok|snapchat|linkedin/i.test(ua)) browser = 'In-App';

            const isBot = /bot|spider|crawl|slurp|facebookexternalhit|whatsapp|telegrambot|twitterbot|pinterest|slackbot|curl|wget|python|postman|insomnia|go-http-client|headlesschrome/i.test(ua);

            const clickId = `clk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const clickTarget = initialTarget;

            // after() keeps the invocation alive until the writes finish (also when redirect() throws);
            // a bare un-awaited promise can be dropped or delayed once the serverless response is sent.
            after(async () => {
              // Only judge repeat visits when the IP is the verified visitor IP. Without the trusted
              // edge proxy, custom-domain traffic all shares the proxy's IP and would look like repeats.
              let isUnique = true;
              if (trustedIp) {
                try {
                  const prior = await sql.query(
                    `SELECT 1 FROM click_events WHERE link_id = $1 AND ip_hash = $2 LIMIT 1`,
                    [row.id, ipHash]
                  );
                  if (prior && prior.length > 0) isUnique = false;
                } catch {}
              }

              await sql.query(
                `INSERT INTO click_events (
                  id, link_id, short_code, timestamp, ip_hash, country, country_code, city, region,
                  device, os, browser, referrer, language, user_agent,
                  utm_source, utm_medium, utm_campaign, utm_term, utm_content, destination_url,
                  is_bot, is_unique
                )
                VALUES (
                  $1, $2, $3, NOW(), $4, $5, $6, $7, $8,
                  $9, $10, $11, $12, $13, $14,
                  $15, $16, $17, $18, $19, $20,
                  $21, $22
                )`,
                [
                  clickId,
                  row.id,
                  row.short_code,
                  ipHash,
                  geo.countryName || 'Unknown',
                  geo.countryCode || 'Unknown',
                  geo.city || 'Unknown',
                  geo.regionName || geo.regionCode || null,
                  device,
                  os,
                  browser,
                  referrer.slice(0, 255),
                  rawLang.slice(0, 64),
                  ua.slice(0, 500),
                  row.utm_source || null,
                  row.utm_medium || null,
                  row.utm_campaign || null,
                  row.utm_term || null,
                  row.utm_content || null,
                  clickTarget,
                  isBot,
                  isUnique
                ]
              ).catch((err: unknown) => console.warn('Click insert failed:', err));

              await sql.query(`UPDATE links SET clicks_count = clicks_count + 1 WHERE id = $1`, [row.id])
                .catch((err: unknown) => console.warn('Click counter update failed:', err));
            });
          } catch {}

          shouldDirectRedirectUrl = initialTarget;
        }
      }
    } catch (err) {
      console.warn('Server redirect lookup error:', err);
    }
  }

  // Direct immediate server redirect when link is safe
  if (shouldDirectRedirectUrl) {
    redirect(shouldDirectRedirectUrl);
  }

  // Intermediate screen only rendered when link is suspicious, password-protected, or splash/frame!
  return (
    <Suspense fallback={null}>
      <RedirectClient 
        code={code} 
        initialTarget={initialTarget} 
        initialLink={initialLink} 
      />
    </Suspense>
  );
}
