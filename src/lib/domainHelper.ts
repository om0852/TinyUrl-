/**
 * Domain & Host Resolution Helper
 * 
 * Provides consistent domain detection across Edge Middleware, Server Components,
 * and API routes to enforce strict isolation between the primary platform domain
 * and customer custom domains.
 */

import { isTrustedEdgeProxyRequest } from './geo';

export function cleanHost(rawHost: string | null | undefined): string {
  if (!rawHost) return '';
  return rawHost
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//i, '')
    .split(',')[0]
    .split('/')[0]
    .split(':')[0]
    .replace(/\.$/, '');
}

/**
 * Checks if the given hostname is part of the primary platform infrastructure
 * (e.g. localhost, tinyurl.dev, creataurus.work.gd, vercel.app, etc.)
 */
export function isPlatformHost(host: string | null | undefined): boolean {
  const cleaned = cleanHost(host);
  if (!cleaned) return true;

  const platformHosts = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    'tinyurl.dev',
    'creataurus.work.gd',
    // The product domain (Cloudflare -> Caddy -> Vercel); always the platform, never a custom domain
    'link.grabormiss.com',
  ];

  const cnameTarget = cleanHost(process.env.CUSTOM_DOMAIN_CNAME_TARGET || process.env.NEXT_PUBLIC_CNAME_TARGET);
  if (cnameTarget && !platformHosts.includes(cnameTarget)) {
    platformHosts.push(cnameTarget);
  }

  const defaultDomain = cleanHost(process.env.NEXT_PUBLIC_DEFAULT_DOMAIN);
  if (defaultDomain && !platformHosts.includes(defaultDomain)) {
    platformHosts.push(defaultDomain);
  }

  const appUrl = cleanHost(process.env.NEXT_PUBLIC_APP_URL);
  if (appUrl && !platformHosts.includes(appUrl)) {
    platformHosts.push(appUrl);
  }

  const edgeIp = cleanHost(process.env.EDGE_PROXY_IP || process.env.NEXT_PUBLIC_EDGE_PROXY_IP);
  if (edgeIp && !platformHosts.includes(edgeIp)) {
    platformHosts.push(edgeIp);
  }

  // Exact match or subdomain of a platform host (e.g. www.creataurus.work.gd)
  for (const pHost of platformHosts) {
    if (cleaned === pHost || cleaned.endsWith(`.${pHost}`)) {
      return true;
    }
  }

  if (cleaned.endsWith('.vercel.app')) return true;
  if (cleaned.includes('localhost')) return true;

  return false;
}

/**
 * The hostname the visitor actually requested.
 * Caddy forwards custom domains to Vercel with Host set to the Vercel app and the real domain in
 * X-Original-Host, so x-forwarded-host is the Vercel app for every custom domain. X-Original-Host is
 * only believed when the request carries the edge proxy secret; anyone can send that header directly.
 */
export function resolveRequestHost(getHeader: (name: string) => string | null | undefined): string {
  const original = getHeader('x-original-host');
  if (original && isTrustedEdgeProxyRequest(getHeader)) return cleanHost(original);
  return cleanHost(getHeader('x-forwarded-host') || getHeader('host') || '');
}
