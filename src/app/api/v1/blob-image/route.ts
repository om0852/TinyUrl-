import { NextResponse } from 'next/server';
import { getVercelBlobStream } from '@/lib/blobStorage';
import { isSafeOutboundUrl } from '@/lib/security';
import { safeFetch } from '@/lib/safeFetch';
import sharp from 'sharp';

export const runtime = 'nodejs';

/**
 * Optimizes an image buffer to a 1200x630 progressive JPEG < 300KB
 * for WhatsApp, Twitter, LinkedIn, and social media crawlers.
 */
async function optimizeBuffer(inputBuffer: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(inputBuffer).metadata();
    const width = meta.width || 1200;
    const height = meta.height || 630;
    const aspectRatio = width / height;

    // If the image is already close to 1.91:1 (between 1.88 and 1.93), resize directly
    if (Math.abs(aspectRatio - 1.905) < 0.03) {
      return await sharp(inputBuffer)
        .resize(1200, 630, { fit: 'fill' })
        .jpeg({ quality: 84, progressive: true, mozjpeg: true })
        .toBuffer();
    }

    // NEVER CROP! Fit the full uncropped image inside 1200x630 over a matching ambient blurred background
    const background = await sharp(inputBuffer)
      .resize(1200, 630, { fit: 'cover' })
      .blur(30)
      .modulate({ brightness: 0.6 })
      .toBuffer();

    const foreground = await sharp(inputBuffer)
      .resize(1200, 630, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();

    return await sharp(background)
      .composite([{ input: foreground, gravity: 'center' }])
      .jpeg({ quality: 84, progressive: true, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.warn('Sharp compression fallback:', err);
    return inputBuffer;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('URL parameter is required', { status: 400 });
  }

  const safetyCheck = isSafeOutboundUrl(imageUrl);
  if (!safetyCheck.safe) {
    return new NextResponse(`Prohibited URL: ${safetyCheck.reason}`, { status: 400 });
  }

  let rawBuffer: Buffer | null = null;

  // 1. If this is a Vercel Blob storage URL
  if (imageUrl.includes('blob.vercel-storage.com')) {
    try {
      const blobResponse = await getVercelBlobStream(imageUrl);

      if (blobResponse && blobResponse.statusCode === 200 && blobResponse.stream) {
        const chunks: Uint8Array[] = [];
        const reader = (blobResponse.stream as any).getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
        rawBuffer = Buffer.concat(chunks);
      }
    } catch (err) {
      console.error('Error streaming Vercel Blob:', err);
    }
  }

  // 2. Fallback for public external images: proxy them
  if (!rawBuffer) {
    try {
      const fetched = await safeFetch(imageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TinyUrl-Bot/1.0)' },
        signal: AbortSignal.timeout(6000),
        redirect: 'manual'
      });
      if (fetched.ok) {
        const arrayBuffer = await fetched.arrayBuffer();
        rawBuffer = Buffer.from(arrayBuffer);
      }
    } catch (proxyErr) {
      console.error('Proxy fetch failed:', proxyErr);
    }
  }

  if (rawBuffer && rawBuffer.length > 0) {
    const optimized = await optimizeBuffer(rawBuffer);

    return new Response(new Uint8Array(optimized), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(optimized.length),
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // No redirect to arbitrary URLs: this endpoint is not an open redirect
  return NextResponse.json({ success: false, error: 'Image not available.' }, { status: 404 });
}
