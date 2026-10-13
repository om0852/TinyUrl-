import { NextResponse } from 'next/server';
import { generateBase62Code, normalizeUrl, buildUtmUrl, RESERVED_SLUGS } from '@/lib/db';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      destination_url, 
      custom_slug, 
      title, 
      tags, 
      utm_source, 
      utm_medium, 
      utm_campaign, 
      rules,
      workspace_id 
    } = body;

    // Strict input validation & URL sanitization
    if (!destination_url || typeof destination_url !== 'string' || !destination_url.trim()) {
      return NextResponse.json({ error: 'Valid destination_url parameter is required' }, { status: 400 });
    }

    const normUrl = normalizeUrl(destination_url.trim());

    // Disallow dangerous URI schemes (javascript:, data:, vbscript:, file:)
    if (!/^https?:\/\//i.test(normUrl)) {
      return NextResponse.json({ 
        error: 'Security Error: Destination URL must use http:// or https:// protocol' 
      }, { status: 422 });
    }

    let code = custom_slug && typeof custom_slug === 'string' ? custom_slug.trim() : '';
    if (code) {
      // Validate slug characters and length
      if (!/^[a-zA-Z0-9_-]{3,64}$/.test(code)) {
        return NextResponse.json({ 
          error: 'Custom slug must be between 3 and 64 characters and contain only letters, numbers, hyphens, and underscores' 
        }, { status: 422 });
      }
      if (RESERVED_SLUGS.has(code.toLowerCase())) {
        return NextResponse.json({ error: `Custom slug "${code}" is a reserved system path` }, { status: 422 });
      }
    } else {
      code = generateBase62Code(6);
    }

    const finalUrl = buildUtmUrl(normUrl, {
      source: utm_source,
      medium: utm_medium,
      campaign: utm_campaign
    });

    const newLink = {
      id: `link_${Date.now()}`,
      workspace_id: workspace_id || null,
      short_code: code,
      short_url: `https://lmk.to/${code}`,
      destination_url: finalUrl,
      title: title ? String(title).slice(0, 255) : `Short Link /${code}`,
      tags: Array.isArray(tags) ? tags.map(String).slice(0, 10) : ['api'],
      status: 'active',
      clicks_count: 0,
      rules: Array.isArray(rules) ? rules : [],
      created_at: new Date().toISOString()
    };

    // Save to Neon PostgreSQL with workspace scoping
    try {
      await sql.query(
        `INSERT INTO links (id, workspace_id, short_code, destination_url, title, status, clicks_count, tags, rules, utm_source, utm_medium, utm_campaign, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (short_code) DO UPDATE SET destination_url = EXCLUDED.destination_url`,
        [
          newLink.id,
          newLink.workspace_id,
          newLink.short_code,
          newLink.destination_url,
          newLink.title,
          newLink.status,
          newLink.clicks_count,
          JSON.stringify(newLink.tags),
          JSON.stringify(newLink.rules),
          utm_source || null,
          utm_medium || null,
          utm_campaign || null,
          newLink.created_at
        ]
      );
    } catch (dbErr) {
      console.warn('Neon DB write error, continuing with cache:', dbErr);
    }

    // Cache in Edge cache for sub-15ms resolution
    linkCache.set(`link_${code.toLowerCase()}`, newLink, 300);

    return NextResponse.json({
      success: true,
      message: 'Short URL created and registered on edge infrastructure',
      data: newLink
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
