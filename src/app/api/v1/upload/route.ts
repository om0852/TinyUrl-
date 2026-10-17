import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getBlobToken, getBlobStoreId, isBlobConfigured, uploadToVercelBlob } from '@/lib/blobStorage';

export const runtime = 'nodejs';

// Supported MIME types for OpenGraph, logos, and previews
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif'
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let fileBuffer: Buffer | null = null;
    let fileName = 'upload.jpg';
    let mimeType = 'image/jpeg';
    let fileSize = 0;

    // 1. Handle multipart/form-data
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = (formData.get('file') || formData.get('image')) as File | null;

      if (!file) {
        return NextResponse.json({
          success: false,
          error: 'No file found in request. Please supply a "file" or "image" field.'
        }, { status: 400 });
      }

      fileName = file.name || 'image.jpg';
      mimeType = file.type || 'image/jpeg';
      fileSize = file.size;

      if (fileSize > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({
          success: false,
          error: `File size exceeds the 10MB limit (size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB)`
        }, { status: 400 });
      }

      const arrayBuf = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
    } 
    // 2. Handle JSON with Base64 payload { data, filename, mimeType }
    else if (contentType.includes('application/json')) {
      const json = await request.json();
      const rawData = json.data || json.image || json.file;
      fileName = json.filename || json.name || 'image.jpg';

      if (!rawData || typeof rawData !== 'string') {
        return NextResponse.json({
          success: false,
          error: 'Missing image data string in JSON body.'
        }, { status: 400 });
      }

      if (rawData.startsWith('data:')) {
        const match = rawData.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
        if (!match) {
          return NextResponse.json({ success: false, error: 'Malformed Data URI' }, { status: 400 });
        }
        mimeType = match[1];
        fileBuffer = Buffer.from(match[2], 'base64');
      } else {
        fileBuffer = Buffer.from(rawData, 'base64');
        mimeType = json.mimeType || 'image/jpeg';
      }

      fileSize = fileBuffer.length;
      if (fileSize > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({
          success: false,
          error: `File size exceeds the 10MB limit (size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB)`
        }, { status: 400 });
      }
    } 
    // 3. Handle raw binary stream
    else {
      const arrayBuf = await request.arrayBuffer();
      if (!arrayBuf || arrayBuf.byteLength === 0) {
        return NextResponse.json({ success: false, error: 'Empty file payload' }, { status: 400 });
      }

      fileBuffer = Buffer.from(arrayBuf);
      fileSize = fileBuffer.length;
      mimeType = contentType.split(';')[0].trim() || 'image/jpeg';
      fileName = `upload-${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`;
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json({ success: false, error: 'Failed to read image content' }, { status: 400 });
    }

    // Check MIME type safety
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      // If svg is allowed or check extensions
      if (!fileName.toLowerCase().endsWith('.svg')) {
        return NextResponse.json({
          success: false,
          error: `Unsupported image format: "${mimeType}". Allowed formats: JPEG, PNG, WebP, GIF, SVG, AVIF.`
        }, { status: 400 });
      }
    }

    // Construct a clean, collision-free pathname for Vercel Blob
    const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : 'jpg';
    const baseSlug = fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 30);
    const uniqueHash = crypto.randomBytes(6).toString('hex');
    const blobPathname = `og-images/${Date.now()}-${uniqueHash}-${baseSlug}.${ext}`;

    const blobToken = getBlobToken();

    // Strategy 1: Upload to Vercel Blob Storage
    if (blobToken) {
      try {
        const blobResult = await uploadToVercelBlob(blobPathname, fileBuffer, mimeType);
        const isPrivate = blobResult.access === 'private';

        const reqUrl = new URL(request.url);
        const rawHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || reqUrl.host;
        const host = rawHost.split(',')[0].trim();
        const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
        const publicProxyUrl = `${proto}://${host}/api/v1/blob-image?url=${encodeURIComponent(blobResult.url)}`;

        // If the store is private, use the public proxy route so messaging platforms & preview can load it without 403
        const finalUrl = isPrivate ? publicProxyUrl : blobResult.url;

        return NextResponse.json({
          success: true,
          url: finalUrl,
          blobUrl: blobResult.url,
          downloadUrl: blobResult.downloadUrl,
          pathname: blobResult.pathname,
          contentType: blobResult.contentType,
          size: fileSize,
          storage: 'vercel_blob',
          access: isPrivate ? 'private' : 'public',
          message: 'Image successfully uploaded and stored on Vercel Blob'
        });
      } catch (blobError: any) {
        console.error('Vercel Blob API error:', blobError?.message || blobError);
        // If Vercel Blob fails, fall back gracefully to inline image
      }
    }

    // Strategy 2: Graceful fallback when Vercel Blob upload is unavailable
    const base64DataUri = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

    return NextResponse.json({
      success: true,
      url: base64DataUri,
      size: fileSize,
      contentType: mimeType,
      storage: 'inline_data_uri',
      warning: blobToken 
        ? 'Vercel Blob upload failed. Stored as inline image fallback.' 
        : 'BLOB_READ_WRITE_TOKEN is not configured in environment. Stored as high-res inline image.',
      message: 'Image uploaded successfully'
    });

  } catch (error: any) {
    console.error('Image upload handler error:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unexpected server error processing image upload'
    }, { status: 500 });
  }
}

export async function GET() {
  const isConfigured = isBlobConfigured();
  const storeId = getBlobStoreId();
  return NextResponse.json({
    service: 'Vercel Blob Image Upload Service',
    configured: isConfigured,
    storeId,
    storage: isConfigured ? 'vercel_blob' : 'fallback_inline',
    allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
    maxFileSize: '10MB',
    endpoint: '/api/v1/upload'
  });
}

