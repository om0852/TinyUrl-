import crypto from 'crypto';
import net from 'node:net';
import { lookup } from 'node:dns/promises';

/**
 * Security validation and defense utilities
 * Prevents Server-Side Request Forgery (SSRF), open redirects, and private IP leakage.
 */

// Addresses the server must never fetch: loopback, private networks, link-local and cloud metadata,
// carrier NAT, benchmarking, multicast/reserved, and the IPv6 equivalents (incl. NAT64 and unique-local)
const BLOCKED_RANGES = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]
] as const) BLOCKED_RANGES.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]
] as const) BLOCKED_RANGES.addSubnet(address, prefix, 'ipv6');

/** True for an IP literal in a blocked range; IPv4-mapped IPv6 (::ffff:7f00:1) is checked as IPv4 */
export function isBlockedAddress(ip: string): boolean {
  const value = ip.trim().toLowerCase().replace(/^\[|\]$/g, '');
  const family = net.isIP(value);
  if (family === 4) return BLOCKED_RANGES.check(value, 'ipv4');
  if (family !== 6) return false;
  const dotted = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return BLOCKED_RANGES.check(dotted[1], 'ipv4');
  const hex = value.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return BLOCKED_RANGES.check(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`, 'ipv4');
  }
  return BLOCKED_RANGES.check(value, 'ipv6');
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  '169.254.169.254',
  'instance-data',
  'local'
]);

/**
 * Validates whether a given URL is safe to fetch from a backend serverless node.
 * Strictly blocks private addresses, loopback, cloud metadata endpoints, and non-http(s) schemes.
 */
export function isSafeOutboundUrl(rawUrl: string): { safe: boolean; reason?: string; url?: URL } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { safe: false, reason: 'Empty or invalid URL parameter.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { safe: false, reason: 'Malformed URL.' };
  }

  // 1. Protocol check: strictly http: or https:
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: `Unsupported protocol: ${parsed.protocol}. Only http and https are permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase().trim().replace(/^\[|\]$/g, '');

  // 2. Block reserved hostnames
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    return { safe: false, reason: 'Target hostname is reserved or internal.' };
  }

  // 3. IP literals in private, loopback, metadata or other reserved ranges (v4, v6 and v4-mapped)
  if (isBlockedAddress(hostname)) {
    return { safe: false, reason: 'Target is a private, loopback or reserved address.' };
  }

  return { safe: true, url: parsed };
}

/**
 * isSafeOutboundUrl plus a DNS lookup: refuses a hostname when any address it resolves to is
 * private or reserved (e.g. a domain pointed at 169.254.169.254 or 10.0.0.5). Use this before every
 * server-side fetch of a user-supplied URL.
 */
export async function checkOutboundUrl(rawUrl: string): Promise<{ safe: boolean; reason?: string; url?: URL }> {
  const check = isSafeOutboundUrl(rawUrl);
  if (!check.safe || !check.url) return check;
  const hostname = check.url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(hostname)) return check;
  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0) return { safe: false, reason: 'Hostname does not resolve.' };
    if (addresses.some(a => isBlockedAddress(a.address))) {
      return { safe: false, reason: 'Hostname resolves to a private, loopback or reserved address.' };
    }
  } catch {
    return { safe: false, reason: 'Hostname does not resolve.' };
  }
  return check;
}

/**
 * Hashes a short link password with PBKDF2 using SHA-256 and 100,000 iterations.
 */
export function hashLinkPassword(password: string): string {
  if (!password) return '';
  return crypto.pbkdf2Sync(password.trim(), 'salt_link_password_hash', 100000, 32, 'sha256').toString('hex');
}

/**
 * Timing-safe verification of link passwords with backward compatibility for legacy plaintext hashes.
 */
export function verifyLinkPassword(password: string, storedHash?: string | null): boolean {
  if (!storedHash) return true;
  if (!password) return false;
  try {
    const hashedAttempt = hashLinkPassword(password);
    const bufAttempt = Buffer.from(hashedAttempt, 'utf8');
    const bufStored = Buffer.from(storedHash, 'utf8');

    if (bufAttempt.length === bufStored.length && crypto.timingSafeEqual(bufAttempt, bufStored)) {
      return true;
    }

    // Backward compatibility with legacy plaintext passwords
    const bufPlain = Buffer.from(password.trim(), 'utf8');
    if (bufPlain.length === bufStored.length && crypto.timingSafeEqual(bufPlain, bufStored)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

