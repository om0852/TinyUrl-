import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { getVercelBlobStream } from '@/lib/blobStorage';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code') || searchParams.get('slug') || searchParams.get('id');
  
  if (!code) {
    return new NextResponse('Code or slug parameter is required', { status: 400 });
  }

  const cleanCode = code.replace(/\+$/, '').trim().toLowerCase();

  try {
    const rows = (await sql.query(
      `SELECT id, short_code, custom_slug, title, og_title, og_description, og_image_url 
       FROM links 
       WHERE LOWER(short_code) = $1 OR LOWER(custom_slug) = $1 OR id = $1
       LIMIT 1`,
      [cleanCode]
    )) as Array<{
      id: string;
      short_code: string;
      custom_slug?: string;
      title?: string;
      og_title?: string;
      og_description?: string;
      og_image_url?: string;
    }>;

    if (!rows || rows.length === 0) {
      return new NextResponse('Link not found', { status: 404 });
    }

    const link = rows[0];
    const rawImage = link.og_image_url?.trim();

    // 1. If stored in Vercel Blob (public or private)
    if (rawImage && rawImage.includes('blob.vercel-storage.com')) {
      try {
        const blobRes = await getVercelBlobStream(rawImage);

        if (blobRes && blobRes.statusCode === 200 && blobRes.stream) {
          const contentType = blobRes.headers.get('content-type') || 'image/jpeg';
          return new Response(blobRes.stream, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      } catch (blobFetchErr) {
        console.error('Vercel Blob stream error in og-image query route:', blobFetchErr);
      }
    }

    // 2. If Base64 Data URI
    if (rawImage && rawImage.startsWith('data:image/')) {
      const match = rawImage.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');

        return new Response(buffer, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Length': String(buffer.length),
            'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    if (rawImage && /^https?:\/\//i.test(rawImage)) {
      try {
        const proxied = await fetch(rawImage, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TinyUrl-Bot/1.0)' },
          signal: AbortSignal.timeout(5000)
        });
        if (proxied.ok) {
          const contentType = proxied.headers.get('content-type') || 'image/jpeg';
          const arrayBuffer = await proxied.arrayBuffer();
          return new Response(arrayBuffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400, s-maxage=604800',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      } catch {
        return NextResponse.redirect(new URL(rawImage), 302);
      }
    }

    const displayTitle = (link.og_title || link.title || link.short_code).slice(0, 50);
    const displayDesc = (link.og_description || `https://creataurus.work.gd/${link.custom_slug || link.short_code}`).slice(0, 90);

    const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#311042" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)" />
  <circle cx="1050" cy="120" r="280" fill="#6366f1" opacity="0.25" filter="blur(60px)" />
  <circle cx="150" cy="520" r="240" fill="#06b6d4" opacity="0.2" filter="blur(50px)" />
  <g transform="translate(100, 160)">
    <rect x="0" y="0" width="140" height="34" rx="8" fill="#4f46e5" opacity="0.4" />
    <text x="70" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#c7d2fe" text-anchor="middle">VERIFIED LINK</text>
    <text x="0" y="110" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="800" fill="#ffffff">${escapeXml(displayTitle)}</text>
    <text x="0" y="180" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="400" fill="#94a3b8">${escapeXml(displayDesc)}</text>
  </g>
  <g transform="translate(100, 530)">
    <text x="0" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="600" fill="#64748b">creataurus.work.gd • Open Graph Preview</text>
  </g>
</svg>`.trim();

    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    console.error('OG image route error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
