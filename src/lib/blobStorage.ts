import { put, get } from '@vercel/blob';

// Default Vercel Blob credentials provided for store_oI8nR4XOe5lQd52s
const DEFAULT_BLOB_STORE_ID = 'store_oI8nR4XOe5lQd52s';
const DEFAULT_BLOB_TOKEN = 'vercel_blob_rw_oI8nR4XOe5lQd52s_VyLOz0KFw0z1BXZecNDK3ZukeYyK6h';

/**
 * Clean and retrieve the Vercel Blob Read/Write token.
 * Strips accidental wrapping quotes ("..." or '...') that commonly happen in .env files.
 */
export function getBlobToken(): string {
  const raw = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  if (raw && typeof raw === 'string') {
    const cleaned = raw.trim().replace(/^["']|["']$/g, '');
    if (cleaned.length > 10) {
      return cleaned;
    }
  }
  return DEFAULT_BLOB_TOKEN;
}

/**
 * Retrieve the Store ID.
 */
export function getBlobStoreId(): string {
  const raw = process.env.BLOB_STORE_ID;
  if (raw && typeof raw === 'string') {
    const cleaned = raw.trim().replace(/^["']|["']$/g, '');
    if (cleaned.length > 5) {
      return cleaned;
    }
  }
  return DEFAULT_BLOB_STORE_ID;
}

/**
 * Check if Vercel Blob is configured and usable.
 */
export function isBlobConfigured(): boolean {
  return Boolean(getBlobToken());
}

/**
 * Check whether a given URL is a Vercel Blob storage URL.
 */
export function isVercelBlobUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('blob.vercel-storage.com') || url.includes('/api/v1/blob-image');
}

/**
 * Resolve an image URL for display in browser preview components.
 * If the image points to a private Vercel Blob URL, routes it through our authenticated proxy
 * so that the browser does NOT receive a 403 Forbidden.
 */
export function resolveDisplayImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const clean = url.trim();
  if (!clean) return '';

  // If already a base64 inline buffer or already proxied, return as-is
  if (clean.startsWith('data:') || clean.includes('/api/v1/blob-image')) {
    return clean;
  }

  // If private Vercel Blob URL, route through proxy
  if (clean.includes('.private.blob.vercel-storage.com')) {
    return `/api/v1/blob-image?url=${encodeURIComponent(clean)}`;
  }

  return clean;
}

/**
 * Upload a buffer directly to Vercel Blob.
 * Automatically attempts public access first, and seamlessly switches to private access
 * if the store is configured with private access.
 */
export async function uploadToVercelBlob(
  pathname: string,
  buffer: Buffer,
  contentType: string
): Promise<{
  url: string;
  downloadUrl: string;
  pathname: string;
  contentType: string;
  access: 'public' | 'private';
}> {
  const token = getBlobToken();

  try {
    // Attempt public access first
    const result = await put(pathname, buffer, {
      access: 'public',
      token,
      contentType,
      addRandomSuffix: false
    });
    return {
      url: result.url,
      downloadUrl: result.downloadUrl,
      pathname: result.pathname,
      contentType: result.contentType,
      access: 'public'
    };
  } catch (err: any) {
    // If the store is private, use private access
    const msg = err?.message || '';
    if (msg.includes('private') || msg.includes('Cannot use public access on a private store')) {
      const result = await put(pathname, buffer, {
        access: 'private',
        token,
        contentType,
        addRandomSuffix: false
      });
      return {
        url: result.url,
        downloadUrl: result.downloadUrl,
        pathname: result.pathname,
        contentType: result.contentType,
        access: 'private'
      };
    }
    throw err;
  }
}

/**
 * Fetch a Vercel Blob object as a readable stream (works for both public and private stores).
 */
export async function getVercelBlobStream(blobUrl: string) {
  const token = getBlobToken();
  const accessMode = blobUrl.includes('.private.') ? 'private' : 'public';
  return await get(blobUrl, {
    token,
    access: accessMode
  });
}

/**
 * Browser-side image optimizer:
 * Scales large images to 1200x630 max dimensions and encodes as JPEG (~50-150 KB)
 * to strictly satisfy WhatsApp's 300KB limit before uploading.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  // If not running in a browser environment, return file as is
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  // If already a small JPEG under 200KB, keep it
  if (file.type === 'image/jpeg' && file.size < 200 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
      img.onload = () => {
        try {
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 630;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob && blob.size < file.size) {
                const cleanName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
                const optimizedFile = new File([blob], cleanName, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                resolve(optimizedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.85
          );
        } catch {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

