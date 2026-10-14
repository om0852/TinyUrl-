import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { AnalyticsApiResponse, AnalyticsMetrics, ClickEvent } from '@/lib/types';

interface CountryStatRow {
  country?: string | null;
  code?: string | null;
  country_code?: string | null;
  clicks?: number | string | null;
}

interface ClickStatRow {
  total_clicks?: number | string | null;
  unique_visitors?: number | string | null;
  bot_clicks?: number | string | null;
  avg_latency?: number | string | null;
  mobile_clicks?: number | string | null;
  desktop_clicks?: number | string | null;
  tablet_clicks?: number | string | null;
}

interface RawClickRow {
  id: string;
  link_id: string;
  short_code: string;
  timestamp: string;
  ip_hash: string;
  country?: string | null;
  country_code?: string | null;
  region?: string | null;
  city?: string | null;
  device?: string | null;
  os?: string | null;
  browser?: string | null;
  referrer?: string | null;
  is_bot?: boolean | null;
  is_unique?: boolean | null;
  latency_ms?: number | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || '').toLowerCase().trim();
  const workspaceId = (searchParams.get('workspace_id') || '').trim();

  let totalClicks = 0;
  let uniqueVisitors = 0;
  let botClicks = 0;
  let avgLatency = 0;
  let mobileClicks = 0;
  let desktopClicks = 0;
  let tabletClicks = 0;
  let topCountries: Array<{ country: string; code: string; clicks: number }> = [];

  // If neither code nor workspaceId is provided, return clean zero metrics (never leak cross-tenant data)
  if (!code && !workspaceId) {
    return NextResponse.json<AnalyticsApiResponse>({
      success: true,
      code: 'unspecified',
      metrics: {
        total_clicks: 0,
        unique_visitors: 0,
        bot_clicks_filtered: 0,
        avg_latency_ms: 0,
        top_countries: [],
        devices: { mobile: '0%', desktop: '0%', tablet: '0%' }
      }
    });
  }

  try {
    if (code && code !== 'all') {
      const stats = (await sql.query(`
        SELECT 
          COUNT(*)::int as total_clicks,
          COUNT(DISTINCT ip_hash)::int as unique_visitors,
          COUNT(*) FILTER (WHERE is_bot = true)::int as bot_clicks,
          ROUND(AVG(COALESCE(latency_ms, 20))::numeric, 1) as avg_latency,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(device, '')) = 'mobile')::int as mobile_clicks,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(device, '')) = 'desktop')::int as desktop_clicks,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(device, '')) = 'tablet')::int as tablet_clicks
        FROM click_events
        WHERE LOWER(short_code) = $1
      `, [code])) as unknown as ClickStatRow[];

      if (stats && stats.length > 0) {
        totalClicks = Number(stats[0].total_clicks) || 0;
        uniqueVisitors = Number(stats[0].unique_visitors) || 0;
        botClicks = Number(stats[0].bot_clicks) || 0;
        avgLatency = Number(stats[0].avg_latency) || 0;
        mobileClicks = Number(stats[0].mobile_clicks) || 0;
        desktopClicks = Number(stats[0].desktop_clicks) || 0;
        tabletClicks = Number(stats[0].tablet_clicks) || 0;
      }

      const countries = (await sql.query(`
        SELECT country, country_code as code, COUNT(*)::int as clicks
        FROM click_events
        WHERE LOWER(short_code) = $1
        GROUP BY country, country_code
        ORDER BY clicks DESC
        LIMIT 5
      `, [code])) as unknown as CountryStatRow[];

      if (countries && Array.isArray(countries)) {
        topCountries = countries.map((c) => ({
          country: c.country || 'Unknown',
          code: c.code || c.country_code || 'Unknown',
          clicks: Number(c.clicks) || 0
        }));
      }
    } else if (workspaceId) {
      // Scoped workspace aggregation
      const stats = (await sql.query(`
        SELECT 
          COUNT(c.id)::int as total_clicks,
          COUNT(DISTINCT c.ip_hash)::int as unique_visitors,
          COUNT(c.id) FILTER (WHERE c.is_bot = true)::int as bot_clicks,
          ROUND(AVG(COALESCE(c.latency_ms, 20))::numeric, 1) as avg_latency,
          COUNT(c.id) FILTER (WHERE LOWER(COALESCE(c.device, '')) = 'mobile')::int as mobile_clicks,
          COUNT(c.id) FILTER (WHERE LOWER(COALESCE(c.device, '')) = 'desktop')::int as desktop_clicks,
          COUNT(c.id) FILTER (WHERE LOWER(COALESCE(c.device, '')) = 'tablet')::int as tablet_clicks
        FROM click_events c
        INNER JOIN links l ON LOWER(c.short_code) = LOWER(l.short_code)
        WHERE l.workspace_id = $1
      `, [workspaceId])) as unknown as ClickStatRow[];

      if (stats && stats.length > 0) {
        totalClicks = Number(stats[0].total_clicks) || 0;
        uniqueVisitors = Number(stats[0].unique_visitors) || 0;
        botClicks = Number(stats[0].bot_clicks) || 0;
        avgLatency = Number(stats[0].avg_latency) || 0;
        mobileClicks = Number(stats[0].mobile_clicks) || 0;
        desktopClicks = Number(stats[0].desktop_clicks) || 0;
        tabletClicks = Number(stats[0].tablet_clicks) || 0;
      }

      const countries = (await sql.query(`
        SELECT c.country, c.country_code as code, COUNT(c.id)::int as clicks
        FROM click_events c
        INNER JOIN links l ON LOWER(c.short_code) = LOWER(l.short_code)
        WHERE l.workspace_id = $1
        GROUP BY c.country, c.country_code
        ORDER BY clicks DESC
        LIMIT 5
      `, [workspaceId])) as unknown as CountryStatRow[];

      if (countries && Array.isArray(countries)) {
        topCountries = countries.map((c) => ({
          country: c.country || 'Unknown',
          code: c.code || c.country_code || 'Unknown',
          clicks: Number(c.clicks) || 0
        }));
      }
    }
  } catch (err) {
    console.warn('Analytics query fallback:', err);
    totalClicks = 0;
    uniqueVisitors = 0;
    botClicks = 0;
    avgLatency = 0;
    topCountries = [];
  }

  // Fetch recent click events for workspace if requested
  let recentClicks: ClickEvent[] = [];
  let topRegions: Array<{ region: string; clicks: number }> = [];
  let topCities: Array<{ city: string; region?: string; country?: string; clicks: number }> = [];

  if (code || workspaceId) {
    try {
      const events = (code && code !== 'all')
        ? ((await sql.query(`
            SELECT c.*
            FROM click_events c
            WHERE LOWER(c.short_code) = $1
            ORDER BY c.timestamp DESC
            LIMIT 100
          `, [code])) as unknown as RawClickRow[])
        : ((await sql.query(`
            SELECT DISTINCT c.*
            FROM click_events c
            INNER JOIN links l ON (c.link_id = l.id OR LOWER(c.short_code) = LOWER(l.short_code))
            WHERE l.workspace_id = $1
            ORDER BY c.timestamp DESC
            LIMIT 100
          `, [workspaceId])) as unknown as RawClickRow[]);

      if (Array.isArray(events)) {
        recentClicks = events.map((c) => {
          let country = (c.country || '').trim();
          let code = (c.country_code || '').trim().toUpperCase();

          if (!country || country.toLowerCase() === 'unknown') {
            country = code ? code : 'Unknown';
          }
          if (country.length === 2 && !code) {
            code = country.toUpperCase();
          }

          if (code && code.length === 2) {
            try {
              const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
              const name = regionNames.of(code);
              if (name) country = name;
            } catch {}
          }

          return {
            id: c.id,
            link_id: c.link_id,
            short_code: c.short_code,
            timestamp: c.timestamp,
            ip_hash: c.ip_hash,
            country: country || 'Unknown',
            country_code: code || 'Unknown',
            region: c.region || undefined,
            city: c.city || 'Direct',
            device: (c.device as 'mobile' | 'desktop' | 'tablet') || 'desktop',
            os: (c.os as 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux') || 'Windows',
            browser: (c.browser as 'Chrome' | 'Safari' | 'Firefox' | 'Edge') || 'Chrome',
            referrer: c.referrer || 'Direct',
            is_bot: !!c.is_bot,
            is_unique: c.is_unique !== false,
            latency_ms: Number(c.latency_ms) || 0
          };
        });

        // Compute top regions & cities from clicks
        const regMap = new Map<string, number>();
        const cityMap = new Map<string, { city: string; region?: string; country?: string; clicks: number }>();

        recentClicks.forEach((c) => {
          if (c.region && c.region !== 'Unknown') {
            regMap.set(c.region, (regMap.get(c.region) || 0) + 1);
          }
          if (c.city && c.city !== 'Direct' && c.city !== 'Unknown') {
            const key = `${c.city}_${c.region || ''}`;
            const existing = cityMap.get(key) || { city: c.city, region: c.region, country: c.country, clicks: 0 };
            existing.clicks += 1;
            cityMap.set(key, existing);
          }
        });

        topRegions = Array.from(regMap.entries())
          .map(([region, clicks]) => ({ region, clicks }))
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 5);

        topCities = Array.from(cityMap.values())
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 5);
      }
    } catch (e) {
      console.warn('Recent clicks fetch error:', e);
    }
  }

  let mobilePct = totalClicks > 0 ? Math.round((mobileClicks / totalClicks) * 100) : 0;
  let desktopPct = totalClicks > 0 ? Math.round((desktopClicks / totalClicks) * 100) : 0;
  const tabletPct = totalClicks > 0 ? Math.round((tabletClicks / totalClicks) * 100) : 0;

  if (totalClicks > 0 && mobilePct + desktopPct + tabletPct !== 100) {
    const diff = 100 - (mobilePct + desktopPct + tabletPct);
    if (mobilePct >= desktopPct) mobilePct += diff;
    else desktopPct += diff;
  }

  const metrics: AnalyticsMetrics = {
    total_clicks: totalClicks,
    unique_visitors: uniqueVisitors,
    bot_clicks_filtered: botClicks,
    avg_latency_ms: avgLatency,
    top_countries: topCountries,
    top_regions: topRegions,
    top_cities: topCities,
    devices: {
      mobile: `${mobilePct}%`,
      desktop: `${desktopPct}%`,
      tablet: `${tabletPct}%`
    }
  };

  return NextResponse.json<AnalyticsApiResponse & { recent_clicks?: ClickEvent[] }>({
    success: true,
    code: code || workspaceId || 'all',
    metrics,
    recent_clicks: recentClicks
  });
}
