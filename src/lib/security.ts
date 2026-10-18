import crypto from 'crypto';

/**
 * Security validation and defense utilities
 * Prevents Server-Side Request Forgery (SSRF), open redirects, and private IP leakage.
 */

// Private IPv4 CIDR blocks and special addresses
const PRIVATE_IP_PATTERNS = [
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,                // Loopback (127.0.0.0/8)
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,                 // RFC1918 Class A (10.0.0.0/8)
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/,    // RFC1918 Class B (172.16.0.0/12)
  /^192\.168\.\d{1,3}\.\d{1,3}$/,                    // RFC1918 Class C (192.168.0.0/16)
  /^169\.254\.\d{1,3}\.\d{1,3}$/,                    // Link-Local & Cloud Metadata (169.254.0.0/16)
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/, // CGNAT (100.64.0.0/10)
  /^0\.0\.0\.0$/,                                    // Current network
  /^255\.255\.255\.255$/                             // Broadcast
];

// Special IPv6 representations
const PRIVATE_IPV6_PATTERNS = [
  /^::1$/i,                                          // IPv6 Loopback
  /^fe80:/i,                                         // Link-Local unicast
  /^fc00:/i,                                         // Unique local address
  /^fd00:/i                                          // Unique local address
];

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

  // 3. Block IPv4 private ranges
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { safe: false, reason: 'Target resolves to a private or loopback IPv4 address.' };
    }
  }

  // 4. Block IPv6 private ranges
  for (const pattern of PRIVATE_IPV6_PATTERNS) {
    if (pattern.test(hostname)) {
      return { safe: false, reason: 'Target resolves to a private or loopback IPv6 address.' };
    }
  }

  return { safe: true, url: parsed };
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

