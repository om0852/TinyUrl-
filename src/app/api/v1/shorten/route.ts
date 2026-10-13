import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { generateBase62Code, normalizeUrl, buildUtmUrl, RESERVED_SLUGS } from '@/lib/db';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';
import { ShortenApiRequest, ShortenApiResponse, Link } from '@/lib/types';

export async function POST(request: Request) {
  try {
    let body: Partial<ShortenApiRequest>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json<ShortenApiResponse>({ 
        success: false, 
        error: 'Malformed JSON payload in request body.' 
      }, { status: 400 });
    }

    const { 
      destination_url, 
      workspace_id,
      custom_slug, 
      title, 
      tags, 
      utm_source, 
      utm_medium, 
      utm_campaign, 
      rules,
      password,
      expires_at,
      max_clicks
    } = body;

    // 1. Strict Destination URL Validation
    if (!destination_url || typeof destination_url !== 'string' || !destination_url.trim()) {
      return NextResponse.json<ShortenApiResponse>({ 
        success: false, 
        error: 'Field "destination_url" is required and cannot be empty.' 
      }, { status: 400 });
    }

    const normUrl = normalizeUrl(destination_url.trim());
    if (!/^https?:\/\//i.test(normUrl)) {
      return NextResponse.json<ShortenApiResponse>({ 
        success: false, 
        error: 'Security Error: Destination URL must use http:// or https:// protocol.' 
      }, { status: 422 });
    }

    // 2. Strict Workspace ID Validation
    if (!workspace_id || typeof workspace_id !== 'string' || !workspace_id.trim()) {
      return NextResponse.json<ShortenApiResponse>({ 
        success: false, 
        error: 'Field "workspace_id" is required for multi-tenant link attribution.' 
      }, { status: 400 });
    }

    // 3. Custom Slug Validation & Collision Protection
    let code = custom_slug && typeof custom_slug === 'string' ? custom_slug.trim() : '';
    if (code) {
      if (!/^[a-zA-Z0-9_-]{3,64}$/.test(code)) {
        return NextResponse.json<ShortenApiResponse>({ 
          success: false, 
          error: 'Custom slug must be between 3 and 64 characters and contain only alphanumeric characters, hyphens, and underscores.' 
        }, { status: 422 });
      }
      if (RESERVED_SLUGS.has(code.toLowerCase())) {
        return NextResponse.json<ShortenApiResponse>({ 
          success: false, 
          error: `Custom slug "${code}" is a reserved system keyword and cannot be used.` 
        }, { status: 422 });
      }

      // Check if custom slug already exists in Neon DB
      try {
        const existing = await sql.query(
          `SELECT id, workspace_id FROM links WHERE LOWER(short_code) = $1 LIMIT 1`,
          [code.toLowerCase()]
        );
        if (existing && existing.length > 0) {
          return NextResponse.json<ShortenApiResponse>({
            success: false,
            error: `The custom slug "${code}" is already in use by another link. Please choose a different slug.`
          }, { status: 409 });
        }
      } catch (checkErr) {
        console.warn('PostgreSQL slug collision check fallback:', checkErr);
      }
    } else {
      // Auto-generate code and guarantee no collision
      let attempts = 0;
      let uniqueCode = generateBase62Code(6);
      while (attempts < 5) {
        try {
          const existing = await sql.query(
            `SELECT id FROM links WHERE LOWER(short_code) = $1 LIMIT 1`,
            [uniqueCode.toLowerCase()]
          );
          if (!existing || existing.length === 0) break;
          uniqueCode = generateBase62Code(6);
          attempts++;
        } catch {
          break;
        }
      }
      code = uniqueCode;
    }

    const finalUrl = buildUtmUrl(normUrl, {
      source: utm_source,
      medium: utm_medium,
      campaign: utm_campaign
    });

    const uniqueId = `link_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`}`;

    const newLink: Link = {
      id: uniqueId,
      workspace_id: workspace_id.trim(),
      short_code: code,
      custom_slug: custom_slug ? code : undefined,
      domain_id: 'dom_primary',
      destination_url: finalUrl,
      title: title && typeof title === 'string' ? title.slice(0, 255) : `Short Link /${code}`,
      tags: Array.isArray(tags) ? tags.map(String).slice(0, 10) : ['api'],
      status: 'active',
      is_flagged: false,
      risk_score: 0,
      created_by: 'Owner',
      clicks_count: 0,
      rules: Array.isArray(rules) ? rules : [],
      password_hash: password ? String(password) : undefined,
      expires_at: expires_at ? new Date(expires_at).toISOString() : undefined,
      max_clicks: max_clicks ? Number(max_clicks) : undefined,
      created_at: new Date().toISOString()
    };

    // Save to PostgreSQL with collision guard
    try {
      const insertResult = await sql.query(
        `INSERT INTO links (id, workspace_id, short_code, destination_url, title, status, clicks_count, tags, rules, utm_source, utm_medium, utm_campaign, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (short_code) DO NOTHING
         RETURNING id`,
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

      if (Array.isArray(insertResult) && insertResult.length === 0) {
        return NextResponse.json<ShortenApiResponse>({
          success: false,
          error: `The short code "${code}" could not be reserved because it was just taken. Please try again.`
        }, { status: 409 });
      }
    } catch (dbErr) {
      console.warn('PostgreSQL write fallback:', dbErr);
    }

    // Cache in Edge cache for instant lookup
    linkCache.set(`link_${code.toLowerCase()}`, newLink, 300);

    return NextResponse.json<ShortenApiResponse>({
      success: true,
      message: 'Short URL created successfully.',
      data: newLink
    }, { status: 201 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json<ShortenApiResponse>({ 
      success: false, 
      error: msg 
    }, { status: 500 });
  }
}
