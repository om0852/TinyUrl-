import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { generateBase62Code, normalizeUrl, buildUtmUrl, RESERVED_SLUGS } from '@/lib/db';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';
import { ShortenApiRequest, ShortenApiResponse, Link } from '@/lib/types';
import { dispatchWorkspaceWebhooks } from '@/lib/webhooks';

import { verifyWorkspacePermission } from '@/lib/serverAuth';

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
      domain_id,
      custom_slug, 
      title, 
      tags, 
      utm_source, 
      utm_medium, 
      utm_campaign, 
      utm_term,
      utm_content,
      rules,
      password,
      expires_at,
      max_clicks,
      campaign_id,
      redirect_type,
      http_status_code,
      notes,
      shield_protection,
      hide_referrer,
      channel,
      og_title,
      og_description,
      og_image_url
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

    // 2.5 RBAC Permission Verification
    const authResult = await verifyWorkspacePermission(request, 'links:create', {
      workspaceId: workspace_id.trim()
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const cleanPassword = password && typeof password === 'string' && password.trim().length > 0 
      ? password.trim() 
      : undefined;

    if (cleanPassword && cleanPassword.length > 255) {
      return NextResponse.json<ShortenApiResponse>({ 
        success: false, 
        error: 'Password cannot exceed 255 characters.' 
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
          `SELECT id, workspace_id FROM links WHERE LOWER(short_code) = $1 OR LOWER(custom_slug) = $1 LIMIT 1`,
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
            `SELECT id FROM links WHERE LOWER(short_code) = $1 OR LOWER(custom_slug) = $1 LIMIT 1`,
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
      campaign: utm_campaign,
      term: utm_term,
      content: utm_content
    });

    const uniqueId = body.id || `link_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`}`;

    const cleanCampaignId = campaign_id && typeof campaign_id === 'string' && campaign_id.trim() ? campaign_id.trim() : undefined;

    const cleanDomainId = domain_id && typeof domain_id === 'string' && domain_id.trim() ? domain_id.trim() : 'dom_primary';

    const newLink: Link = {
      id: uniqueId,
      workspace_id: workspace_id.trim(),
      short_code: code,
      custom_slug: custom_slug ? code : undefined,
      domain_id: cleanDomainId,
      campaign_id: cleanCampaignId,
      destination_url: finalUrl,
      title: title && typeof title === 'string' ? title.slice(0, 255) : `Short Link /${code}`,
      tags: Array.isArray(tags) ? tags.map(String).slice(0, 10) : ['api'],
      status: 'active',
      is_flagged: false,
      risk_score: 0,
      created_by: 'Owner',
      clicks_count: 0,
      utm_source: utm_source && typeof utm_source === 'string' ? utm_source.slice(0, 128) : undefined,
      utm_medium: utm_medium && typeof utm_medium === 'string' ? utm_medium.slice(0, 128) : undefined,
      utm_campaign: utm_campaign && typeof utm_campaign === 'string' ? utm_campaign.slice(0, 128) : undefined,
      utm_term: utm_term && typeof utm_term === 'string' ? utm_term.slice(0, 128) : undefined,
      utm_content: utm_content && typeof utm_content === 'string' ? utm_content.slice(0, 128) : undefined,
      rules: Array.isArray(rules) ? rules : [],
      password_hash: cleanPassword,
      expires_at: expires_at ? new Date(expires_at).toISOString() : undefined,
      max_clicks: max_clicks ? Number(max_clicks) : undefined,
      redirect_type: cleanPassword ? (redirect_type === 'direct' ? 'splash' : (redirect_type || 'splash')) : (redirect_type || 'direct'),
      http_status_code: http_status_code || 301,
      notes: notes && typeof notes === 'string' ? notes.slice(0, 1000) : undefined,
      shield_protection: Boolean(shield_protection),
      hide_referrer: Boolean(hide_referrer),
      channel: channel && typeof channel === 'string' ? channel.slice(0, 100) : undefined,
      og_title: og_title && typeof og_title === 'string' ? og_title.slice(0, 255) : undefined,
      og_description: og_description && typeof og_description === 'string' ? og_description.slice(0, 1000) : undefined,
      og_image_url: og_image_url && typeof og_image_url === 'string' ? og_image_url.slice(0, 1000) : undefined,
      created_at: new Date().toISOString()
    };

    // Save to PostgreSQL with collision guard
    try {
      const insertResult = await sql.query(
        `INSERT INTO links (
          id, workspace_id, domain_id, short_code, custom_slug, destination_url, title, status, clicks_count, 
          tags, rules, utm_source, utm_medium, utm_campaign, utm_term, utm_content, campaign_id, redirect_type, http_status_code, 
          notes, shield_protection, hide_referrer, channel, og_title, og_description, og_image_url, 
          password_hash, expires_at, max_clicks, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
        ON CONFLICT (short_code) DO UPDATE SET
          destination_url = EXCLUDED.destination_url,
          custom_slug = COALESCE(EXCLUDED.custom_slug, links.custom_slug),
          domain_id = COALESCE(EXCLUDED.domain_id, links.domain_id),
          rules = COALESCE(EXCLUDED.rules, links.rules),
          title = COALESCE(EXCLUDED.title, links.title),
          campaign_id = COALESCE(EXCLUDED.campaign_id, links.campaign_id),
          redirect_type = COALESCE(EXCLUDED.redirect_type, links.redirect_type),
          http_status_code = COALESCE(EXCLUDED.http_status_code, links.http_status_code),
          notes = COALESCE(EXCLUDED.notes, links.notes),
          shield_protection = COALESCE(EXCLUDED.shield_protection, links.shield_protection),
          hide_referrer = COALESCE(EXCLUDED.hide_referrer, links.hide_referrer),
          channel = COALESCE(EXCLUDED.channel, links.channel),
          og_title = COALESCE(EXCLUDED.og_title, links.og_title),
          og_description = COALESCE(EXCLUDED.og_description, links.og_description),
          og_image_url = COALESCE(EXCLUDED.og_image_url, links.og_image_url),
          password_hash = COALESCE(EXCLUDED.password_hash, links.password_hash),
          expires_at = COALESCE(EXCLUDED.expires_at, links.expires_at),
          max_clicks = COALESCE(EXCLUDED.max_clicks, links.max_clicks),
          utm_source = COALESCE(EXCLUDED.utm_source, links.utm_source),
          utm_medium = COALESCE(EXCLUDED.utm_medium, links.utm_medium),
          utm_campaign = COALESCE(EXCLUDED.utm_campaign, links.utm_campaign),
          utm_term = COALESCE(EXCLUDED.utm_term, links.utm_term),
          utm_content = COALESCE(EXCLUDED.utm_content, links.utm_content)
        RETURNING id`,
        [
          newLink.id,
          newLink.workspace_id,
          newLink.domain_id,
          newLink.short_code,
          newLink.custom_slug || newLink.short_code,
          newLink.destination_url,
          newLink.title,
          newLink.status,
          newLink.clicks_count,
          JSON.stringify(newLink.tags),
          JSON.stringify(newLink.rules),
          utm_source || null,
          utm_medium || null,
          utm_campaign || null,
          utm_term || null,
          utm_content || null,
          cleanCampaignId || null,
          newLink.redirect_type || 'direct',
          newLink.http_status_code || 301,
          newLink.notes || null,
          newLink.shield_protection || false,
          newLink.hide_referrer || false,
          newLink.channel || null,
          newLink.og_title || null,
          newLink.og_description || null,
          newLink.og_image_url || null,
          newLink.password_hash || null,
          newLink.expires_at || null,
          newLink.max_clicks || null,
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

    // Asynchronously dispatch webhook event
    dispatchWorkspaceWebhooks(newLink.workspace_id, {
      event: 'link.created',
      timestamp: new Date().toISOString(),
      data: {
        id: newLink.id,
        short_code: newLink.short_code,
        custom_slug: newLink.custom_slug,
        destination_url: newLink.destination_url,
        title: newLink.title,
        workspace_id: newLink.workspace_id,
        created_at: newLink.created_at
      }
    }).catch(whErr => console.warn('Webhook dispatch error:', whErr));

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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-workspace-id, x-user-email'
    }
  });
}
