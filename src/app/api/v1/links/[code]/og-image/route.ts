import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { getVercelBlobStream } from '@/lib/blobStorage';
import sharp from 'sharp';

export const runtime = 'nodejs';

/**
 * Optimizes an image buffer specifically for WhatsApp, Twitter, LinkedIn, and Facebook
 * OpenGraph crawlers:
 * - 1200 x 630 px (standard 1.91:1 ratio)
 * - JPEG format at 82% quality (~40-80 KB)
 * - Strictly under WhatsApp's 300 KB limit to prevent silent thumbnail drops
 */
async function optimizeToOgJpeg(inputBuffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(inputBuffer)
      .resize(1200, 630, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({
        quality: 82,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer();
  } catch (err) {
    console.warn('Sharp optimization error, falling back to raw buffer:', err);
    return inputBuffer;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!code) {
    return new NextResponse('Code required', { status: 400 });
  }

  const cleanCode = code.replace(/\+$/, '').trim().toLowerCase();

  try {
    const rows = (await sql.query(
      `SELECT id, short_code, custom_slug, title, og_title, og_description, og_image_url 
       FROM links 
       WHERE LOWER(short_code) = $1 OR LOWER(custom_slug) = $1 
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
    let rawImage = link.og_image_url?.trim();

    // If the image was wrapped in a proxy URL (/api/v1/blob-image?url=...), unwrap the inner URL
    if (rawImage && rawImage.includes('/api/v1/blob-image')) {
      try {
        const dummyBase = 'http://localhost';
        const parsed = new URL(rawImage.startsWith('http') ? rawImage : `${dummyBase}${rawImage}`);
        const extracted = parsed.searchParams.get('url');
        if (extracted) {
          rawImage = extracted.trim();
        }
      } catch {}
    }

    let sourceBuffer: Buffer | null = null;

    // 1. If og_image_url is stored in Vercel Blob (public or private)
    if (rawImage && rawImage.includes('blob.vercel-storage.com')) {
      try {
        const blobRes = await getVercelBlobStream(rawImage);
        if (blobRes && blobRes.statusCode === 200 && blobRes.stream) {
          const chunks: Uint8Array[] = [];
          const reader = (blobRes.stream as any).getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }
          sourceBuffer = Buffer.concat(chunks);
        }
      } catch (blobFetchErr) {
        console.error('Vercel Blob stream error in og-image:', blobFetchErr);
      }
    }

    // 2. If og_image_url is a Base64 Data URI (e.g. data:image/png;base64,... or data:image/jpeg;base64,...)
    if (!sourceBuffer && rawImage && rawImage.startsWith('data:image/')) {
      const match = rawImage.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/);
      if (match) {
        sourceBuffer = Buffer.from(match[1], 'base64');
      }
    }

    // 3. If og_image_url is an external HTTP/HTTPS URL
    if (!sourceBuffer && rawImage && /^https?:\/\//i.test(rawImage)) {
      try {
        const proxied = await fetch(rawImage, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TinyUrl-Bot/1.0)' },
          signal: AbortSignal.timeout(5000)
        });
        if (proxied.ok) {
          const arrayBuffer = await proxied.arrayBuffer();
          sourceBuffer = Buffer.from(arrayBuffer);
        }
      } catch (proxyErr) {
        console.warn('External image proxy fetch failed:', proxyErr);
      }
    }

    // If we have a source image buffer, optimize it to high-res JPEG under 300KB
    if (sourceBuffer && sourceBuffer.length > 0) {
      const optimizedJpeg = await optimizeToOgJpeg(sourceBuffer);

      return new Response(new Uint8Array(optimizedJpeg), {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': String(optimizedJpeg.length),
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 4. Dynamic High-Resolution Card Fallback (converted from SVG to JPEG for WhatsApp compatibility)
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

    try {
      const fallbackJpeg = await sharp(Buffer.from(svg))
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();

      return new Response(new Uint8Array(fallbackJpeg), {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': String(fallbackJpeg.length),
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch {
      // Direct SVG fallback if sharp fails
      return new Response(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

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
