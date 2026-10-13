import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';
import { TrackApiRequest, TrackApiResponse } from '@/lib/types';

export async function POST(request: Request) {
  try {
    let body: Partial<TrackApiRequest>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json<TrackApiResponse>({ 
        success: false, 
        error: 'Malformed JSON payload in request body.' 
      }, { status: 400 });
    }

    const { link_id, short_code, click } = body;

    if (!link_id && !short_code) {
      return NextResponse.json<TrackApiResponse>({ 
        success: false, 
        error: 'Either "link_id" or "short_code" identifier is required.' 
      }, { status: 400 });
    }

    const code = (short_code || '').trim().toLowerCase();
    const id = (link_id || '').trim();

    // Deduplication guard: ignore repeated beacons with the same click.id within 60 seconds
    if (click && typeof click === 'object' && click.id) {
      const dedupKey = `tracked_clk_${click.id}`;
      if (linkCache.get(dedupKey)) {
        return NextResponse.json<TrackApiResponse>({ 
          success: true, 
          message: 'Click telemetry already recorded.' 
        }, { status: 200 });
      }
      linkCache.set(dedupKey, true, 60);
    }

    // 1. Update PostgreSQL counters
    try {
      if (id || code) {
        await sql.query(
          `UPDATE links SET clicks_count = COALESCE(clicks_count, 0) + 1, updated_at = NOW() 
           WHERE (id = $1 AND $1 != '') OR (LOWER(short_code) = $2 AND $2 != '')`,
          [id || '', code || '']
        );
      }

      if (click && typeof click === 'object') {
        const vercelCountry = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry');
        const vercelRegion = request.headers.get('x-vercel-ip-country-region') || request.headers.get('cf-region');
        const vercelCity = request.headers.get('x-vercel-ip-city') || request.headers.get('cf-ipcity');

        let resolvedCode = (vercelCountry || click.country_code || '').trim().toUpperCase();
        let resolvedCity = vercelCity ? decodeURIComponent(vercelCity) : (click.city || 'Direct');

        // Only override if client explicitly indicated India, otherwise respect headers or mark Unknown
        if (!resolvedCode) {
          if (click.country?.toLowerCase().includes('india')) {
            resolvedCode = 'IN';
          } else {
            resolvedCode = 'Unknown';
          }
        }

        let resolvedCountry = 'Unknown';
        if (resolvedCode !== 'Unknown') {
          try {
            const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
            resolvedCountry = regionNames.of(resolvedCode) || (resolvedCode === 'IN' ? 'India' : resolvedCode === 'US' ? 'United States' : resolvedCode);
          } catch {
            resolvedCountry = resolvedCode === 'IN' ? 'India' : resolvedCode === 'US' ? 'United States' : resolvedCode;
          }
        }

        const INDIAN_STATES: Record<string, string> = {
          'MH': 'Maharashtra', 'DL': 'Delhi', 'KA': 'Karnataka', 'TN': 'Tamil Nadu',
          'GJ': 'Gujarat', 'UP': 'Uttar Pradesh', 'WB': 'West Bengal', 'TS': 'Telangana',
          'TG': 'Telangana', 'AP': 'Andhra Pradesh', 'KL': 'Kerala', 'RJ': 'Rajasthan',
          'MP': 'Madhya Pradesh', 'HR': 'Haryana', 'PB': 'Punjab', 'BR': 'Bihar',
          'OR': 'Odisha', 'OD': 'Odisha', 'AS': 'Assam', 'JH': 'Jharkhand',
          'CT': 'Chhattisgarh', 'UT': 'Uttarakhand', 'HP': 'Himachal Pradesh',
          'GA': 'Goa', 'JK': 'Jammu & Kashmir', 'CH': 'Chandigarh'
        };

        const US_STATES: Record<string, string> = {
          'CA': 'California', 'NY': 'New York', 'TX': 'Texas', 'FL': 'Florida',
          'IL': 'Illinois', 'WA': 'Washington', 'PA': 'Pennsylvania', 'OH': 'Ohio',
          'GA': 'Georgia', 'NC': 'North Carolina', 'MI': 'Michigan', 'NJ': 'New Jersey',
          'VA': 'Virginia', 'CO': 'Colorado', 'MA': 'Massachusetts', 'AZ': 'Arizona'
        };

        let resolvedRegion = (click.region || '').trim();
        if (vercelRegion) {
          const vReg = vercelRegion.trim().toUpperCase();
          if (resolvedCode === 'IN' && INDIAN_STATES[vReg]) {
            resolvedRegion = INDIAN_STATES[vReg];
          } else if (resolvedCode === 'US' && US_STATES[vReg]) {
            resolvedRegion = US_STATES[vReg];
          } else {
            resolvedRegion = vercelRegion;
          }
        }
        if (!resolvedRegion && resolvedCity) {
          const cLow = resolvedCity.toLowerCase();
          if (cLow.includes('mumbai') || cLow.includes('pune') || cLow.includes('nagpur') || cLow.includes('nashik') || cLow.includes('thane')) {
            resolvedRegion = 'Maharashtra';
          } else if (cLow.includes('delhi')) {
            resolvedRegion = 'Delhi';
          } else if (cLow.includes('bengaluru') || cLow.includes('bangalore') || cLow.includes('mysore')) {
            resolvedRegion = 'Karnataka';
          } else if (cLow.includes('hyderabad')) {
            resolvedRegion = 'Telangana';
          } else if (cLow.includes('chennai')) {
            resolvedRegion = 'Tamil Nadu';
          } else if (cLow.includes('kolkata')) {
            resolvedRegion = 'West Bengal';
          } else if (cLow.includes('ahmedabad') || cLow.includes('surat')) {
            resolvedRegion = 'Gujarat';
          }
        }

        const clickId = click.id || `clk_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`}`;

        try {
          await sql.query(
            `INSERT INTO click_events (id, link_id, short_code, ip_hash, country, country_code, region, city, device, os, browser, referrer, is_bot, is_unique, latency_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             ON CONFLICT (id) DO NOTHING`,
            [
              clickId,
              id || null,
              code || null,
              click.ip_hash || 'ip_anon',
              resolvedCountry,
              resolvedCode,
              resolvedRegion || null,
              resolvedCity,
              click.device || 'mobile',
              click.os || 'iOS',
              click.browser || 'Safari',
              click.referrer || 'Direct / Mobile',
              !!click.is_bot,
              click.is_unique ?? true,
              click.latency_ms || 20
            ]
          );
        } catch {
          // Backward compatibility fallback if region column migration is pending
          await sql.query(
            `INSERT INTO click_events (id, link_id, short_code, ip_hash, country, country_code, city, device, os, browser, referrer, is_bot, is_unique, latency_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (id) DO NOTHING`,
            [
              clickId,
              id || null,
              code || null,
              click.ip_hash || 'ip_anon',
              resolvedCountry,
              resolvedCode,
              resolvedCity,
              click.device || 'mobile',
              click.os || 'iOS',
              click.browser || 'Safari',
              click.referrer || 'Direct / Mobile',
              !!click.is_bot,
              click.is_unique ?? true,
              click.latency_ms || 20
            ]
          );
        }
      }
    } catch (dbErr) {
      console.warn('DB tracking warning:', dbErr);
    }

    // 2. Update Edge cache
    if (code) {
      const cached = linkCache.get(`link_${code}`) as any;
      if (cached && typeof cached === 'object') {
        cached.clicks_count = (cached.clicks_count || 0) + 1;
        linkCache.set(`link_${code}`, cached, 180);
      }
    }

    return NextResponse.json<TrackApiResponse>({ 
      success: true, 
      message: 'Click telemetry recorded successfully.' 
    }, { status: 200 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Tracking error.';
    return NextResponse.json<TrackApiResponse>({ 
      success: false, 
      error: msg 
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || '').trim().toLowerCase();

  if (!code) {
    return NextResponse.json({ 
      success: false, 
      error: 'Query parameter "code" is required.' 
    }, { status: 400 });
  }

  try {
    const rows = await sql.query(
      `SELECT clicks_count FROM links WHERE LOWER(short_code) = $1 LIMIT 1`,
      [code]
    );
    if (rows && rows.length > 0) {
      return NextResponse.json({ 
        success: true, 
        clicks_count: Number(rows[0].clicks_count) || 0 
      });
    }
  } catch {}

  return NextResponse.json({ success: true, clicks_count: 0 });
}
