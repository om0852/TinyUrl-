import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { generateBase62Code, normalizeUrl, buildUtmUrl, RESERVED_SLUGS } from '@/lib/db';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';
import { Link } from '@/lib/types';
import { verifyWorkspacePermission } from '@/lib/serverAuth';

export interface BulkImportItem {
  destination_url: string;
  custom_slug?: string;
  title?: string;
  tags?: string[];
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  campaign_id?: string;
}

export interface BulkImportRequest {
  workspace_id: string;
  batch_name?: string;
  items: BulkImportItem[];
}

export interface BulkImportRowError {
  row: number;
  url: string;
  error: string;
}

export async function POST(request: Request) {
  try {
    let body: BulkImportRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ 
        success: false, 
        error: 'Malformed JSON payload in request body.' 
      }, { status: 400 });
    }

    const { workspace_id, batch_name, items } = body;

    // 1. Validation
    if (!workspace_id || typeof workspace_id !== 'string' || !workspace_id.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Field "workspace_id" is required for bulk link import.' 
      }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Array of "items" is required and cannot be empty.' 
      }, { status: 400 });
    }

    if (items.length > 1000) {
      return NextResponse.json({ 
        success: false, 
        error: 'Batch size exceeds maximum limit of 1,000 links per request.' 
      }, { status: 413 });
    }

    // 2. Permission check
    const authResult = await verifyWorkspacePermission(request, 'links:create', {
      workspaceId: workspace_id.trim()
    });
    if (!authResult.success) {
      return authResult.response;
    }
    const userEmail = authResult.context.userEmail || 'system';

    const cleanBatchName = (batch_name && typeof batch_name === 'string' && batch_name.trim()) 
      ? batch_name.trim().slice(0, 255) 
      : `Batch Import (${items.length} links)`;

    // 3. Process items
    const createdLinks: Link[] = [];
    const errors: BulkImportRowError[] = [];
    const allocatedSlugs = new Set<string>();

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const rowNum = index + 1;

      // URL Check
      const rawUrl = item?.destination_url ? String(item.destination_url).trim() : '';
      if (!rawUrl) {
        errors.push({ row: rowNum, url: '', error: 'Destination URL is required and cannot be empty.' });
        continue;
      }

      const normUrl = normalizeUrl(rawUrl);
      if (!/^https?:\/\//i.test(normUrl)) {
        errors.push({ row: rowNum, url: rawUrl, error: 'URL must use http:// or https:// protocol.' });
        continue;
      }

      // Check UTM
      const finalUrl = (item.utm_source || item.utm_medium || item.utm_campaign)
        ? buildUtmUrl(normUrl, {
            source: item.utm_source,
            medium: item.utm_medium,
            campaign: item.utm_campaign
          })
        : normUrl;

      // Slug assignment
      let slug = item.custom_slug ? String(item.custom_slug).trim() : '';
      if (slug) {
        if (!/^[a-zA-Z0-9_-]{3,64}$/.test(slug)) {
          errors.push({ row: rowNum, url: rawUrl, error: `Invalid custom slug "${slug}". Must be 3-64 alphanumeric characters, dashes, or underscores.` });
          continue;
        }

        if (RESERVED_SLUGS.has(slug.toLowerCase())) {
          errors.push({ row: rowNum, url: rawUrl, error: `Slug "${slug}" is a reserved system keyword.` });
          continue;
        }

        if (allocatedSlugs.has(slug.toLowerCase())) {
          errors.push({ row: rowNum, url: rawUrl, error: `Duplicate slug "${slug}" detected in this upload batch.` });
          continue;
        }

        // Check DB collision
        try {
          const existing = await sql.query(
            `SELECT id FROM links WHERE LOWER(short_code) = $1 OR LOWER(custom_slug) = $1 LIMIT 1`,
            [slug.toLowerCase()]
          );
          if (existing && existing.length > 0) {
            errors.push({ row: rowNum, url: rawUrl, error: `Slug "${slug}" is already in use by another link.` });
            continue;
          }
        } catch {}
      } else {
        // Auto-generate code and guarantee no collision
        let attempts = 0;
        let candidate = generateBase62Code(6);
        while (attempts < 6) {
          if (!allocatedSlugs.has(candidate.toLowerCase()) && !RESERVED_SLUGS.has(candidate.toLowerCase())) {
            try {
              const existing = await sql.query(
                `SELECT id FROM links WHERE LOWER(short_code) = $1 OR LOWER(custom_slug) = $1 LIMIT 1`,
                [candidate.toLowerCase()]
              );
              if (!existing || existing.length === 0) {
                slug = candidate;
                break;
              }
            } catch {
              slug = candidate;
              break;
            }
          }
          candidate = generateBase62Code(6 + Math.floor(attempts / 2));
          attempts++;
        }

        if (!slug) {
          errors.push({ row: rowNum, url: rawUrl, error: 'Could not allocate a unique short code after multiple attempts.' });
          continue;
        }
      }

      allocatedSlugs.add(slug.toLowerCase());

      const uniqueId = `link_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const itemTitle = (item.title && typeof item.title === 'string' && item.title.trim())
        ? item.title.trim().slice(0, 255)
        : `/${slug}`;

      let itemTags: string[] = ['bulk_import'];
      if (Array.isArray(item.tags) && item.tags.length > 0) {
        itemTags = item.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 8);
      }

      const newLink: Link = {
        id: uniqueId,
        workspace_id: workspace_id.trim(),
        short_code: slug,
        custom_slug: item.custom_slug ? slug : undefined,
        domain_id: 'dom_primary',
        campaign_id: item.campaign_id ? item.campaign_id.trim() : undefined,
        destination_url: finalUrl,
        title: itemTitle,
        tags: itemTags,
        status: 'active',
        is_flagged: false,
        risk_score: 0,
        created_by: userEmail,
        clicks_count: 0,
        rules: [],
        utm_source: item.utm_source ? String(item.utm_source).trim() : undefined,
        utm_medium: item.utm_medium ? String(item.utm_medium).trim() : undefined,
        utm_campaign: item.utm_campaign ? String(item.utm_campaign).trim() : undefined,
        created_at: new Date().toISOString()
      };

      // Insert link into DB
      try {
        await sql.query(
          `INSERT INTO links (id, workspace_id, short_code, custom_slug, destination_url, title, status, clicks_count, tags, rules, utm_source, utm_medium, utm_campaign, campaign_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (short_code) DO NOTHING`,
          [
            newLink.id,
            newLink.workspace_id,
            newLink.short_code,
            newLink.custom_slug || newLink.short_code,
            newLink.destination_url,
            newLink.title,
            newLink.status,
            0,
            JSON.stringify(newLink.tags),
            JSON.stringify(newLink.rules),
            newLink.utm_source || null,
            newLink.utm_medium || null,
            newLink.utm_campaign || null,
            newLink.campaign_id || null,
            newLink.created_at
          ]
        );

        linkCache.set(`link_${slug.toLowerCase()}`, newLink, 300);
        createdLinks.push(newLink);
      } catch (insertErr) {
        errors.push({ row: rowNum, url: rawUrl, error: `Database insert failed: ${insertErr instanceof Error ? insertErr.message : 'Unknown DB error'}` });
      }
    }

    // 4. Log in bulk_jobs table
    const jobId = `job_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const jobStatus = createdLinks.length === 0 && errors.length > 0 ? 'failed' : 'completed';

    try {
      await sql.query(
        `INSERT INTO bulk_jobs (id, workspace_id, user_email, operation, batch_name, total_rows, success_count, error_count, error_details, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [
          jobId,
          workspace_id.trim(),
          userEmail,
          'import',
          cleanBatchName,
          items.length,
          createdLinks.length,
          errors.length,
          JSON.stringify(errors.slice(0, 100)),
          jobStatus
        ]
      );
    } catch (jobErr) {
      console.warn('Failed to insert bulk_job record:', jobErr);
    }

    return NextResponse.json({
      success: true,
      job_id: jobId,
      batch_name: cleanBatchName,
      total: items.length,
      imported: createdLinks.length,
      failed: errors.length,
      errors,
      links: createdLinks
    });

  } catch (error) {
    console.error('Bulk links error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error during bulk import.' 
    }, { status: 500 });
  }
}
