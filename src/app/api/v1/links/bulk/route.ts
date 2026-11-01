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
  /** Line in the uploaded file, for error messages */
  row?: number;
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
    const resolvedWorkspaceId = (workspace_id || request.headers.get('x-workspace-id') || 'ws_default').trim();
    if (!resolvedWorkspaceId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Field "workspace_id" is required for bulk link import.' 
      }, { status: 400 });
    }

    const itemsList = (Array.isArray(items) && items.length > 0)
      ? items 
      : (Array.isArray((body as any).links) ? (body as any).links : []);

    if (!Array.isArray(itemsList) || itemsList.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Array of "items" (or "links") is required and cannot be empty.' 
      }, { status: 400 });
    }

    if (itemsList.length > 1000) {
      return NextResponse.json({ 
        success: false, 
        error: 'Batch size exceeds maximum limit of 1,000 links per request.' 
      }, { status: 413 });
    }

    // 2. Permission check
    const authResult = await verifyWorkspacePermission(request, 'links:create', {
      workspaceId: resolvedWorkspaceId
    });
    if (!authResult.success) {
      return authResult.response;
    }
    const userEmail = authResult.context.userEmail || 'system';

    const cleanBatchName = (batch_name && typeof batch_name === 'string' && batch_name.trim()) 
      ? batch_name.trim().slice(0, 255) 
      : `Batch Import (${itemsList.length} links)`;

    // 3. Process items and validate in memory
    const createdLinks: Link[] = [];
    const errors: BulkImportRowError[] = [];
    const allocatedSlugs = new Set<string>();

    interface ValidatedItem {
      rowNum: number;
      rawUrl: string;
      finalUrl: string;
      item: BulkImportItem;
      slug: string;
      isCustom: boolean;
    }

    const stage1Valid: ValidatedItem[] = [];
    const slugsToCheck: string[] = [];

    for (let index = 0; index < itemsList.length; index++) {
      const item = itemsList[index];
      const rowNum = Number.isInteger(item?.row) && (item.row as number) > 0 ? (item.row as number) : index + 1;

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
      let parsedHost = '';
      try { parsedHost = new URL(normUrl).hostname; } catch {}
      if (!parsedHost || !parsedHost.includes('.') && parsedHost !== 'localhost') {
        errors.push({ row: rowNum, url: rawUrl, error: 'Not a valid web address.' });
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
      let isCustom = false;

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

        isCustom = true;
        allocatedSlugs.add(slug.toLowerCase());
        slugsToCheck.push(slug.toLowerCase());
      } else {
        // Generate a random candidate
        let candidate = generateBase62Code(7);
        while (allocatedSlugs.has(candidate.toLowerCase()) || RESERVED_SLUGS.has(candidate.toLowerCase())) {
          candidate = generateBase62Code(8);
        }
        slug = candidate;
        allocatedSlugs.add(slug.toLowerCase());
        slugsToCheck.push(slug.toLowerCase());
      }

      stage1Valid.push({
        rowNum,
        rawUrl,
        finalUrl,
        item,
        slug,
        isCustom
      });
    }

    // Batch query existing slugs in PostgreSQL to eliminate N+1 roundtrips
    const existingDbSlugs = new Set<string>();
    if (slugsToCheck.length > 0) {
      try {
        const checkResults = await sql.query(
          `SELECT LOWER(short_code) as code, LOWER(custom_slug) as slug FROM links WHERE LOWER(short_code) = ANY($1::text[]) OR LOWER(custom_slug) = ANY($1::text[])`,
          [slugsToCheck]
        );
        if (Array.isArray(checkResults)) {
          for (const row of checkResults) {
            if (row.code) existingDbSlugs.add(String(row.code).toLowerCase());
            if (row.slug) existingDbSlugs.add(String(row.slug).toLowerCase());
          }
        }
      } catch (err) {
        console.warn('Batch slug existence check error:', err);
        return NextResponse.json({ success: false, error: 'Could not check which slugs are free. Nothing was imported; please try again.' }, { status: 503 });
      }
    }

    // Prepare links to insert
    const linksToInsert: Link[] = [];
    const rowOf = new Map<string, number>();

    for (const validItem of stage1Valid) {
      const { rowNum, rawUrl, finalUrl, item, isCustom } = validItem;
      let slug = validItem.slug;

      if (isCustom) {
        if (existingDbSlugs.has(slug.toLowerCase())) {
          errors.push({ row: rowNum, url: rawUrl, error: `Slug "${slug}" is already in use by another link.` });
          continue;
        }
      } else {
        // Auto-generated slug collision resolution
        let attempts = 0;
        while (existingDbSlugs.has(slug.toLowerCase()) && attempts < 5) {
          slug = generateBase62Code(8);
          attempts++;
        }
        if (existingDbSlugs.has(slug.toLowerCase())) {
          errors.push({ row: rowNum, url: rawUrl, error: 'Could not allocate a unique short code after multiple attempts.' });
          continue;
        }
        existingDbSlugs.add(slug.toLowerCase());
      }

      const uniqueId = `link_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const itemTitle = (item.title && typeof item.title === 'string' && item.title.trim())
        ? item.title.trim().slice(0, 255)
        : `/${slug}`;

      let itemTags: string[] = ['bulk_import'];
      if (Array.isArray(item.tags) && item.tags.length > 0) {
        itemTags = item.tags.map((t: string) => String(t).trim()).filter(Boolean).slice(0, 8);
      }

      const newLink: Link = {
        id: uniqueId,
        workspace_id: resolvedWorkspaceId,
        short_code: slug,
        custom_slug: isCustom ? slug : undefined,
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
        utm_source: item.utm_source ? String(item.utm_source).trim().slice(0, 128) : undefined,
        utm_medium: item.utm_medium ? String(item.utm_medium).trim().slice(0, 128) : undefined,
        utm_campaign: item.utm_campaign ? String(item.utm_campaign).trim().slice(0, 128) : undefined,
        created_at: new Date().toISOString()
      };

      linksToInsert.push(newLink);
      rowOf.set(newLink.id, rowNum);
    }

    const linkValues = (link: Link) => [
      link.id,
      link.workspace_id,
      link.domain_id || 'dom_primary',
      link.short_code,
      link.custom_slug || link.short_code,
      link.destination_url,
      link.title,
      link.status,
      0,
      JSON.stringify(link.tags),
      JSON.stringify(link.rules),
      link.utm_source || null,
      link.utm_medium || null,
      link.utm_campaign || null,
      link.campaign_id || null,
      link.created_at
    ];
    const recordResult = async (link: Link, inserted: boolean) => {
      if (!inserted) {
        errors.push({ row: rowOf.get(link.id) || 0, url: link.destination_url, error: `Slug "${link.short_code}" is already in use by another link.` });
        return;
      }
      await linkCache.set(`link_${link.short_code.toLowerCase()}`, link, 300);
      createdLinks.push(link);
    };

    // Batch insert into DB in chunks of 50 rows
    const CHUNK_SIZE = 50;
    for (let i = 0; i < linksToInsert.length; i += CHUNK_SIZE) {
      const chunk = linksToInsert.slice(i, i + CHUNK_SIZE);
      const valueClauses: string[] = [];
      const values: any[] = [];
      let pIndex = 1;

      for (const link of chunk) {
        valueClauses.push(`(${Array.from({ length: 16 }, (_, k) => `$${pIndex + k}`).join(', ')})`);
        values.push(...linkValues(link));
        pIndex += 16;
      }

      try {
        const inserted = (await sql.query(
          `INSERT INTO links (id, workspace_id, domain_id, short_code, custom_slug, destination_url, title, status, clicks_count, tags, rules, utm_source, utm_medium, utm_campaign, campaign_id, created_at)
           VALUES ${valueClauses.join(', ')}
           ON CONFLICT (short_code) DO NOTHING
           RETURNING id`,
          values
        )) as unknown as { id: string }[];
        const insertedIds = new Set((inserted || []).map(r => r.id));
        for (const link of chunk) await recordResult(link, insertedIds.has(link.id));
      } catch (insertErr) {
        // Fallback for this chunk to isolate any failing row
        for (const link of chunk) {
          try {
            const inserted = (await sql.query(
              `INSERT INTO links (id, workspace_id, domain_id, short_code, custom_slug, destination_url, title, status, clicks_count, tags, rules, utm_source, utm_medium, utm_campaign, campaign_id, created_at)
               VALUES (${Array.from({ length: 16 }, (_, k) => `$${k + 1}`).join(', ')})
               ON CONFLICT (short_code) DO NOTHING
               RETURNING id`,
              linkValues(link)
            )) as unknown as { id: string }[];
            await recordResult(link, (inserted || []).length > 0);
          } catch (singleErr) {
            errors.push({
              row: rowOf.get(link.id) || 0,
              url: link.destination_url,
              error: `Database insert failed: ${singleErr instanceof Error ? singleErr.message : 'Unknown error'}`
            });
          }
        }
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
          resolvedWorkspaceId,
          userEmail,
          'import',
          cleanBatchName,
          itemsList.length,
          createdLinks.length,
          errors.length,
          JSON.stringify(errors.slice(0, 100)),
          jobStatus
        ]
      );
    } catch (jobErr) {
      console.warn('Failed to insert bulk_job record:', jobErr);
    }

    errors.sort((a, b) => a.row - b.row);
    return NextResponse.json({
      success: true,
      job_id: jobId,
      batch_name: cleanBatchName,
      total: itemsList.length,
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
