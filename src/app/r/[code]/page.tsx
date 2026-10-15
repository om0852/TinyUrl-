import { Suspense } from 'react';
import { headers } from 'next/headers';
import { Metadata } from 'next';
import { sql } from '@/lib/postgres';
import { Link, LinkRule } from '@/lib/types';
import { extractGeoFromHeaders, resolveSmartTargetUrl } from '@/lib/geo';
import { RedirectClient } from './RedirectClient';

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ target?: string; title?: string; id?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  if (!code) return {};

  try {
    const cleanCode = code.trim().toLowerCase();
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
      const link = rows[0];
      const title = link.og_title?.trim() || link.title?.trim() || `Link /${link.short_code}`;
      const description = link.og_description?.trim() || `Open link: ${link.destination_url || 'destination'}`;
      const imageUrl = link.og_image_url?.trim() || undefined;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          images: imageUrl ? [{ url: imageUrl, alt: title }] : [],
          type: 'website'
        },
        twitter: {
          card: imageUrl ? 'summary_large_image' : 'summary',
          title,
          description,
          images: imageUrl ? [imageUrl] : []
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

  let initialTarget = sParams.target ? decodeURIComponent(sParams.target) : null;
  let initialLink: Link | null = null;
  let isSocialCrawler = false;

  if (code) {
    try {
      const cleanCode = code.trim().toLowerCase();
      const headersList = await headers();
      const rawHost = headersList.get('host') || '';
      const userAgent = headersList.get('user-agent') || '';
      const currentHost = rawHost.split(':')[0].toLowerCase();
      
      // Social crawler detection for WhatsApp, Facebook, Twitter, Telegram, Slack, LinkedIn, Discord
      isSocialCrawler = /whatsapp|facebookexternalhit|twitterbot|telegrambot|linkedinbot|slackbot|discordbot/i.test(userAgent);

      const isPlatformDomain = currentHost === 'localhost' || 
                               currentHost === '127.0.0.1' || 
                               currentHost.includes('vercel.app') || 
                               currentHost === 'tinyurl.dev';

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
        og_title?: string;
        og_description?: string;
        og_image_url?: string;
      }> = [];

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
          redirect_type: ((row as Record<string, unknown>).redirect_type as 'direct' | 'frame' | 'splash') || 'direct',
          http_status_code: ((row as Record<string, unknown>).http_status_code as 301 | 302 | 307 | 308) || 301,
          notes: (row as Record<string, unknown>).notes as string | undefined,
          shield_protection: Boolean((row as Record<string, unknown>).shield_protection),
          hide_referrer: Boolean((row as Record<string, unknown>).hide_referrer),
          channel: (row as Record<string, unknown>).channel as string | undefined,
          og_title: (row as Record<string, unknown>).og_title as string | undefined,
          og_description: (row as Record<string, unknown>).og_description as string | undefined,
          og_image_url: (row as Record<string, unknown>).og_image_url as string | undefined
        };

        // Server-Side Location & Device Smart Routing evaluation
        if (!isPasswordLocked && parsedRules.length > 0) {
          try {
            const geo = extractGeoFromHeaders(name => headersList.get(name));

            const resolved = resolveSmartTargetUrl({
              rules: parsedRules,
              defaultUrl: row.destination_url,
              userAgent,
              geo
            });

            if (resolved) {
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
          const ogImg = initialLink.og_image_url;

          return (
            <div style={{ padding: '40px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
              {ogImg && (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={ogImg} 
                  alt={ogTitle} 
                  style={{ width: '100%', maxHeight: '315px', objectFit: 'cover', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' }} 
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
      }
    } catch (err) {
      console.warn('Server redirect lookup error:', err);
    }
  }

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
