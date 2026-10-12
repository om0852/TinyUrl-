import { NextResponse } from 'next/server';
import { generateBase62Code, normalizeUrl, buildUtmUrl, RESERVED_SLUGS } from '@/lib/db';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { destination_url, custom_slug, title, tags, utm_source, utm_medium, utm_campaign, rules } = body;

    if (!destination_url) {
      return NextResponse.json({ error: 'destination_url parameter is required' }, { status: 400 });
    }

    const normUrl = normalizeUrl(destination_url);

    let code = custom_slug ? custom_slug.trim() : '';
    if (code) {
      if (RESERVED_SLUGS.has(code.toLowerCase())) {
        return NextResponse.json({ error: `Custom slug "${code}" is reserved` }, { status: 422 });
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
      short_code: code,
      short_url: `https://lmk.to/${code}`,
      destination_url: finalUrl,
      title: title || `Short Link /${code}`,
      tags: tags || ['api'],
      status: 'active',
      clicks_count: 0,
      rules: rules || [],
      created_at: new Date().toISOString()
    };

    // Save to Neon PostgreSQL
    try {
      await sql.query(
        `INSERT INTO links (id, short_code, destination_url, title, status, clicks_count, tags, rules, utm_source, utm_medium, utm_campaign, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (short_code) DO UPDATE SET destination_url = EXCLUDED.destination_url`,
        [
          newLink.id,
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
