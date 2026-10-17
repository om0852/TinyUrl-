import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('URL parameter is required', { status: 400 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  // If this is a Vercel Blob storage URL
  if (imageUrl.includes('blob.vercel-storage.com')) {
    try {
      const accessMode = (imageUrl.includes('.private.') ? 'private' : 'public') as 'private' | 'public';
      const blobResponse = await get(imageUrl, {
        token: token || undefined,
        access: accessMode
      });

      if (blobResponse && blobResponse.statusCode === 200 && blobResponse.stream) {
        const contentType = blobResponse.headers.get('content-type') || 'image/jpeg';
        const contentLength = blobResponse.headers.get('content-length');

        const headers: Record<string, string> = {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
          'Access-Control-Allow-Origin': '*'
        };
        if (contentLength) {
          headers['Content-Length'] = contentLength;
        }

        return new Response(blobResponse.stream, {
          status: 200,
          headers
        });
      }
    } catch (err) {
      console.error('Error streaming Vercel Blob:', err);
    }
  }

  // Fallback for public external images: proxy them
  try {
    const fetched = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TinyUrl-Bot/1.0)' },
      signal: AbortSignal.timeout(6000)
    });
    if (fetched.ok) {
      const arrayBuffer = await fetched.arrayBuffer();
      const contentType = fetched.headers.get('content-type') || 'image/jpeg';
      return new Response(arrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, s-maxage=604800',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  } catch (proxyErr) {
    console.error('Proxy fetch failed:', proxyErr);
  }

  return NextResponse.redirect(new URL(imageUrl), 302);
}
