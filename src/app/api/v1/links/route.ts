import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';
import { LinksApiResponse, Link, LinkRule } from '@/lib/types';
import { extractGeoFromHeaders, resolveSmartTargetUrl } from '@/lib/geo';

interface RawLinkRow {
  id: string;
  workspace_id?: string | null;
  short_code: string;
  custom_slug?: string | null;
  domain_id?: string | null;
  campaign_id?: string | null;
  destination_url: string;
  title?: string | null;
  tags?: string[] | string | null;
  clicks_count?: number | string | null;
  status?: string | null;
  is_flagged?: boolean | null;
  risk_score?: number | string | null;
  created_by?: string | null;
  created_at?: string | null;
  rules?: LinkRule[] | string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  expires_at?: string | null;
  max_clicks?: number | string | null;
  password_hash?: string | null;
  redirect_type?: 'direct' | 'frame' | 'splash' | null;
  http_status_code?: number | null;
  notes?: string | null;
  shield_protection?: boolean | null;
  hide_referrer?: boolean | null;
  channel?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  broken_code?: number | null;
  broken_reason?: string | null;
  last_health_check?: string | null;
  fallback_url?: string | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspace_id') || request.headers.get('x-workspace-id');
  const code = searchParams.get('code');

  try {
    let rows: RawLinkRow[] = [];
    if (code && typeof code === 'string' && code.trim()) {
      rows = (await sql.query(`
        SELECT 
          l.*,
          COALESCE(
            GREATEST(
              COALESCE(l.clicks_count, 0),
              (SELECT COUNT(*)::int FROM click_events c WHERE (c.link_id = l.id AND l.id != '') OR LOWER(c.short_code) = LOWER(l.short_code))
            ),
            0
          ) as resolved_clicks_count
        FROM links l
        WHERE LOWER(l.short_code) = $1 OR LOWER(l.custom_slug) = $1
        LIMIT 1
      `, [code.trim().toLowerCase()])) as unknown as RawLinkRow[];
    } else if (workspaceId && typeof workspaceId === 'string' && workspaceId.trim()) {
      rows = (await sql.query(`
        SELECT 
          l.*,
          COALESCE(
            GREATEST(
              COALESCE(l.clicks_count, 0),
              (SELECT COUNT(*)::int FROM click_events c WHERE (c.link_id = l.id AND l.id != '') OR LOWER(c.short_code) = LOWER(l.short_code))
            ),
            0
          ) as resolved_clicks_count
        FROM links l
        WHERE l.workspace_id = $1 
        ORDER BY l.created_at DESC 
        LIMIT 100
      `, [workspaceId.trim()])) as unknown as RawLinkRow[];
    } else {
      // Strict multi-tenant isolation: Never expose links without workspace or code filter
      return NextResponse.json<LinksApiResponse>({
        success: true,
        source: 'scoped_workspace',
        total: 0,
        links: []
      });
    }

    if (Array.isArray(rows)) {
      const isPublicCodeQuery = !!code;
      const geo = extractGeoFromHeaders(name => request.headers.get(name));
      const userAgent = request.headers.get('user-agent') || '';

      const formattedLinks: Link[] = rows.map((l: RawLinkRow) => {
        const isPasswordLocked = isPublicCodeQuery && !!l.password_hash;
        const parsedRules: LinkRule[] = isPasswordLocked 
          ? [] 
          : (typeof l.rules === 'string' ? JSON.parse(l.rules) : (Array.isArray(l.rules) ? l.rules : []));

        // Evaluate smart routing destination for visitor device & geo
        let resolvedDestination = isPasswordLocked ? '' : l.destination_url;
        if (!isPasswordLocked && parsedRules.length > 0) {
          resolvedDestination = resolveSmartTargetUrl({
            rules: parsedRules,
            defaultUrl: l.destination_url,
            userAgent,
            geo
          });
        }

        const exactClicksCount = Number(
          (l as unknown as { resolved_clicks_count?: number | string }).resolved_clicks_count !== undefined
            ? (l as unknown as { resolved_clicks_count?: number | string }).resolved_clicks_count
            : l.clicks_count
        ) || 0;

        return {
          id: l.id,
          workspace_id: l.workspace_id || '',
          short_code: l.short_code,
          custom_slug: l.custom_slug || l.short_code,
          domain_id: l.domain_id || 'dom_primary',
          destination_url: isPasswordLocked ? '' : l.destination_url,
          resolved_destination_url: resolvedDestination,
          visitor_geo: geo,
          title: l.title || `Short Link /${l.short_code}`,
          tags: typeof l.tags === 'string' ? JSON.parse(l.tags) : (Array.isArray(l.tags) ? l.tags : []),
          clicks_count: exactClicksCount,
          status: (l.status as 'active' | 'disabled' | 'expired' | 'flagged' | 'broken') || 'active',
          is_flagged: !!l.is_flagged,
          risk_score: Number(l.risk_score) || 0,
          broken_code: l.broken_code ? Number(l.broken_code) : undefined,
          broken_reason: l.broken_reason || undefined,
          last_health_check: l.last_health_check ? new Date(l.last_health_check).toISOString() : undefined,
          fallback_url: l.fallback_url || undefined,
          created_by: l.created_by || 'Owner',
          created_at: l.created_at || new Date().toISOString(),
          rules: parsedRules,
          campaign_id: l.campaign_id || undefined,
          utm_source: l.utm_source || undefined,
          utm_medium: l.utm_medium || undefined,
          utm_campaign: l.utm_campaign || undefined,
          utm_term: l.utm_term || undefined,
          utm_content: l.utm_content || undefined,
          expires_at: l.expires_at || undefined,
          max_clicks: l.max_clicks ? Number(l.max_clicks) : undefined,
          password_hash: l.password_hash ? 'PROTECTED' : undefined,
          redirect_type: (l.redirect_type as 'direct' | 'frame' | 'splash') || 'direct',
          http_status_code: (Number(l.http_status_code) as 301 | 302 | 307 | 308) || 301,
          notes: l.notes || undefined,
          shield_protection: !!l.shield_protection,
          hide_referrer: !!l.hide_referrer,
          channel: l.channel || undefined,
          og_title: l.og_title || undefined,
          og_description: l.og_description || undefined,
          og_image_url: l.og_image_url || undefined
        };
      });

      return NextResponse.json<LinksApiResponse>({
        success: true,
        source: 'neon_postgresql',
        total: formattedLinks.length,
        links: formattedLinks
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }
  } catch (err) {
    console.warn('Neon DB read error, links empty fallback:', err);
  }

  return NextResponse.json<LinksApiResponse>({
    success: true,
    source: 'empty_workspace',
    total: 0,
    links: []
  });
}

import { verifyWorkspacePermission } from '@/lib/serverAuth';

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { 
      id, 
      short_code, 
      custom_slug, 
      rules, 
      status, 
      title, 
      destination_url, 
      campaign_id, 
      domain_id,
      tags, 
      is_flagged, 
      risk_score,
      redirect_type,
      http_status_code,
      notes,
      shield_protection,
      hide_referrer,
      channel,
      og_title,
      og_description,
      og_image_url,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      password,
      password_hash,
      expires_at,
      max_clicks,
      broken_code,
      broken_reason,
      fallback_url
    } = body;

    const lookupId = (id || short_code || custom_slug || '').trim();
    if (!lookupId) {
      return NextResponse.json({ success: false, error: 'Link identifier is required.' }, { status: 400 });
    }

    // RBAC: Requires links:edit permission
    const authResult = await verifyWorkspacePermission(request, 'links:edit', { linkId: lookupId });
    if (!authResult.success) {
      return authResult.response;
    }

    const rulesJson = Array.isArray(rules) ? JSON.stringify(rules) : (rules === null ? '[]' : null);
    const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : (tags === null ? '[]' : null);
    const newShortCode = short_code ? String(short_code).trim() : null;
    const newCustomSlug = custom_slug !== undefined ? (custom_slug ? String(custom_slug).trim() : null) : null;
    const newCampaignId = campaign_id !== undefined ? (campaign_id === null || campaign_id === '' || campaign_id === '__remove__' ? '__null__' : String(campaign_id).trim()) : null;
    const flaggedVal = typeof is_flagged === 'boolean' ? is_flagged : null;
    const riskScoreVal = typeof risk_score === 'number' ? risk_score : null;

    const cleanDomainId = domain_id ? String(domain_id).trim() : null;
    const cleanRedirectType = redirect_type ? String(redirect_type).trim() : null;
    const cleanStatusCode = http_status_code ? Number(http_status_code) : null;
    const cleanNotes = notes !== undefined ? String(notes) : null;
    const shieldVal = typeof shield_protection === 'boolean' ? shield_protection : null;
    const hideRefVal = typeof hide_referrer === 'boolean' ? hide_referrer : null;
    const cleanChannel = channel !== undefined ? String(channel) : null;
    const cleanOgTitle = og_title !== undefined ? String(og_title) : null;
    const cleanOgDesc = og_description !== undefined ? String(og_description) : null;
    const cleanOgImg = og_image_url !== undefined ? String(og_image_url) : null;
    const cleanUtmSource = utm_source !== undefined ? String(utm_source) : null;
    const cleanUtmMedium = utm_medium !== undefined ? String(utm_medium) : null;
    const cleanUtmCampaign = utm_campaign !== undefined ? String(utm_campaign) : null;
    const cleanUtmTerm = utm_term !== undefined ? String(utm_term) : null;
    const cleanUtmContent = utm_content !== undefined ? String(utm_content) : null;
    const cleanFallbackUrl = fallback_url !== undefined ? (fallback_url ? String(fallback_url).trim() : '__null__') : null;
    const cleanBrokenCode = broken_code !== undefined ? (broken_code === null || broken_code === -1 ? -1 : Number(broken_code)) : null;
    const cleanBrokenReason = broken_reason !== undefined ? (broken_reason === null ? '__null__' : String(broken_reason).trim()) : null;

    const cleanPassword = (password !== undefined || password_hash !== undefined)
      ? (password || password_hash ? String(password || password_hash) : '__null__')
      : null;

    const cleanExpiresAt = expires_at !== undefined
      ? (expires_at ? new Date(expires_at).toISOString() : '__null__')
      : null;

    const cleanMaxClicks = max_clicks !== undefined
      ? (max_clicks === null || max_clicks === '' || Number(max_clicks) <= 0 ? -1 : Number(max_clicks))
      : null;

    const rows = (await sql.query(
      `UPDATE links 
       SET rules = CASE WHEN $1::text IS NOT NULL THEN $1::jsonb ELSE rules END,
           status = COALESCE($2, status),
           title = COALESCE($3, title),
           destination_url = COALESCE($4, destination_url),
           short_code = COALESCE($5, short_code),
           custom_slug = COALESCE($6, custom_slug),
           campaign_id = CASE 
             WHEN $8 = '__null__' THEN NULL 
             WHEN $8::text IS NOT NULL THEN $8 
             ELSE campaign_id 
           END,
           tags = CASE WHEN $9::text IS NOT NULL THEN $9::jsonb ELSE tags END,
           is_flagged = COALESCE($10, is_flagged),
           risk_score = COALESCE($11, risk_score),
           domain_id = COALESCE($12, domain_id),
           redirect_type = COALESCE($13, redirect_type),
           http_status_code = COALESCE($14, http_status_code),
           notes = CASE WHEN $15::text IS NOT NULL THEN $15 ELSE notes END,
           shield_protection = COALESCE($16, shield_protection),
           hide_referrer = COALESCE($17, hide_referrer),
           channel = CASE WHEN $18::text IS NOT NULL THEN $18 ELSE channel END,
           og_title = CASE WHEN $19::text IS NOT NULL THEN $19 ELSE og_title END,
           og_description = CASE WHEN $20::text IS NOT NULL THEN $20 ELSE og_description END,
           og_image_url = CASE WHEN $21::text IS NOT NULL THEN $21 ELSE og_image_url END,
           utm_source = CASE WHEN $22::text IS NOT NULL THEN $22 ELSE utm_source END,
           utm_medium = CASE WHEN $23::text IS NOT NULL THEN $23 ELSE utm_medium END,
           utm_campaign = CASE WHEN $24::text IS NOT NULL THEN $24 ELSE utm_campaign END,
           utm_term = CASE WHEN $25::text IS NOT NULL THEN $25 ELSE utm_term END,
           utm_content = CASE WHEN $26::text IS NOT NULL THEN $26 ELSE utm_content END,
           password_hash = CASE 
             WHEN $27 = '__null__' THEN NULL 
             WHEN $27::text IS NOT NULL THEN $27 
             ELSE password_hash 
           END,
           expires_at = CASE 
             WHEN $28 = '__null__' THEN NULL 
             WHEN $28::timestamptz IS NOT NULL THEN $28::timestamptz 
             ELSE expires_at 
           END,
           max_clicks = CASE 
             WHEN $29 = -1 THEN NULL 
             WHEN $29::int IS NOT NULL THEN $29::int 
             ELSE max_clicks 
           END,
           fallback_url = CASE
             WHEN $30 = '__null__' THEN NULL
             WHEN $30::text IS NOT NULL THEN $30
             ELSE fallback_url
           END,
           broken_code = CASE
             WHEN $31 = -1 THEN NULL
             WHEN $31::int IS NOT NULL THEN $31::int
             ELSE broken_code
           END,
           broken_reason = CASE
             WHEN $32 = '__null__' THEN NULL
             WHEN $32::text IS NOT NULL THEN $32
             ELSE broken_reason
           END,
           updated_at = NOW()
       WHERE id = $7 
          OR LOWER(short_code) = LOWER($7) 
          OR LOWER(custom_slug) = LOWER($7)
       RETURNING *`,
      [
        rulesJson, 
        status || null, 
        title || null, 
        destination_url || null, 
        newShortCode, 
        newCustomSlug, 
        lookupId, 
        newCampaignId,
        tagsJson,
        flaggedVal,
        riskScoreVal,
        cleanDomainId,
        cleanRedirectType,
        cleanStatusCode,
        cleanNotes,
        shieldVal,
        hideRefVal,
        cleanChannel,
        cleanOgTitle,
        cleanOgDesc,
        cleanOgImg,
        cleanUtmSource,
        cleanUtmMedium,
        cleanUtmCampaign,
        cleanUtmTerm,
        cleanUtmContent,
        cleanPassword,
        cleanExpiresAt,
        cleanMaxClicks,
        cleanFallbackUrl,
        cleanBrokenCode,
        cleanBrokenReason
      ]
    )) as unknown as RawLinkRow[];

    if (rows && rows.length > 0) {
      const updatedRow = rows[0];
      linkCache.delete(`link_${lookupId.toLowerCase()}`);
      if (updatedRow.short_code) {
        linkCache.delete(`link_${updatedRow.short_code.toLowerCase()}`);
      }
      if (updatedRow.custom_slug) {
        linkCache.delete(`link_${updatedRow.custom_slug.toLowerCase()}`);
      }
      if (newShortCode) {
        linkCache.delete(`link_${newShortCode.toLowerCase()}`);
      }
      if (newCustomSlug) {
        linkCache.delete(`link_${newCustomSlug.toLowerCase()}`);
      }

      const formatted: Link = {
        id: updatedRow.id,
        workspace_id: updatedRow.workspace_id || '',
        short_code: updatedRow.short_code,
        custom_slug: updatedRow.custom_slug || updatedRow.short_code,
        domain_id: updatedRow.domain_id || 'dom_primary',
        destination_url: updatedRow.destination_url,
        title: updatedRow.title || `Short Link /${updatedRow.short_code}`,
        tags: typeof updatedRow.tags === 'string' ? JSON.parse(updatedRow.tags) : (Array.isArray(updatedRow.tags) ? updatedRow.tags : []),
        clicks_count: Number(updatedRow.clicks_count) || 0,
        status: (updatedRow.status as 'active' | 'disabled' | 'expired' | 'flagged') || 'active',
        is_flagged: !!updatedRow.is_flagged,
        risk_score: Number(updatedRow.risk_score) || 0,
        created_by: updatedRow.created_by || 'Owner',
        created_at: updatedRow.created_at || new Date().toISOString(),
        rules: typeof updatedRow.rules === 'string' ? JSON.parse(updatedRow.rules) : (Array.isArray(updatedRow.rules) ? updatedRow.rules : []),
        campaign_id: updatedRow.campaign_id || undefined,
        utm_source: updatedRow.utm_source || undefined,
        utm_medium: updatedRow.utm_medium || undefined,
        utm_campaign: updatedRow.utm_campaign || undefined,
        utm_term: updatedRow.utm_term || undefined,
        utm_content: updatedRow.utm_content || undefined,
        expires_at: updatedRow.expires_at || undefined,
        max_clicks: updatedRow.max_clicks ? Number(updatedRow.max_clicks) : undefined,
        password_hash: updatedRow.password_hash ? 'PROTECTED' : undefined,
        redirect_type: (updatedRow.redirect_type as 'direct' | 'frame' | 'splash') || 'direct',
        http_status_code: (Number(updatedRow.http_status_code) as 301 | 302 | 307 | 308) || 301,
        notes: updatedRow.notes || undefined,
        shield_protection: !!updatedRow.shield_protection,
        hide_referrer: !!updatedRow.hide_referrer,
        channel: updatedRow.channel || undefined,
        og_title: updatedRow.og_title || undefined,
        og_description: updatedRow.og_description || undefined,
        og_image_url: updatedRow.og_image_url || undefined
      };

      return NextResponse.json({
        success: true,
        message: 'Link updated successfully.',
        link: formatted
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Link updated successfully.',
      link: null
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database update error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id') || searchParams.get('code');

    if (!id) {
      try {
        const body = await request.json();
        id = body?.id || body?.code;
      } catch {
        // Body might be empty
      }
    }

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Link ID or short code is required.' }, { status: 400 });
    }

    const cleanId = id.trim();

    // RBAC: Requires links:delete permission (owner, admin only)
    const authResult = await verifyWorkspacePermission(request, 'links:delete', { linkId: cleanId });
    if (!authResult.success) {
      return authResult.response;
    }

    const rows = (await sql.query(
      `DELETE FROM links WHERE id = $1 OR LOWER(short_code) = LOWER($1) RETURNING *`,
      [cleanId]
    )) as unknown as RawLinkRow[];

    if (rows && rows.length > 0) {
      const deletedRow = rows[0];
      if (deletedRow.short_code) {
        linkCache.delete(`link_${deletedRow.short_code.toLowerCase()}`);
      }
      if (deletedRow.custom_slug) {
        linkCache.delete(`link_${deletedRow.custom_slug.toLowerCase()}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Link deleted successfully from database.',
      deleted: rows && rows.length > 0 ? rows[0] : null
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database delete error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-workspace-id, x-user-email'
    }
  });
}

