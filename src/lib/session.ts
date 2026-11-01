import crypto from 'crypto';

// Signed, HttpOnly session cookie issued after a successful password check.
// The browser sends it automatically on same-origin requests; page scripts cannot read it,
// and it cannot be forged without the server secret. Format: base64url(payload).base64url(hmac)

export const SESSION_COOKIE = 'snip_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface SessionPayload {
  email: string;
  exp: number; // unix seconds
}

function sessionSecret(): string {
  const explicit = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (explicit) return explicit;
  // Fall back to a key derived from a secret every deployment already has, so a missing
  // SESSION_SECRET never locks everyone out. Set SESSION_SECRET to rotate sessions independently.
  const dbUrl = process.env.DATABASE_URL || '';
  return crypto.createHash('sha256').update(`snip-session:${dbUrl}`).digest('hex');
}

function sign(data: string): string {
  return crypto.createHmac('sha256', sessionSecret()).update(data).digest('base64url');
}

export function createSessionToken(email: string): string {
  const payload: SessionPayload = {
    email: email.trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;

  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.email || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.email;
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/** Email of the signed-in user for this request, or null when there is no valid session. */
export function getSessionEmail(request: Request): string | null {
  return verifySessionToken(readCookie(request, SESSION_COOKIE));
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

// ── Client portal session ──
// Portal clients are not workspace users; they get their own signed HttpOnly cookie carrying the
// client id. Portal routes read the client only from this cookie (a client_id in the URL or body
// used to be trusted on its own, so anyone with the id could act as that client).

export const PORTAL_COOKIE = 'snip_portal';
const PORTAL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface PortalPayload {
  cid: string;
  exp: number;
}

export function createPortalToken(clientId: string, ttlSeconds = PORTAL_TTL_SECONDS): string {
  const payload: PortalPayload = { cid: clientId, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = Buffer.from(JSON.stringify({ ...payload, kind: 'portal' })).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** Client id of the signed-in portal client, or null */
export function getPortalClientId(request: Request): string | null {
  const token = readCookie(request, PORTAL_COOKIE);
  if (!token) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as PortalPayload & { kind?: string };
    if (payload.kind !== 'portal' || !payload.cid || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.cid;
  } catch {
    return null;
  }
}

export function portalCookieOptions(maxAge = PORTAL_TTL_SECONDS) {
  return { ...sessionCookieOptions(maxAge) };
}

// ── Click tracking token ──
// The redirect page hands the browser a short-lived signed token for the link it rendered;
// /api/v1/track only records a click that carries one (anyone could post fake clicks before).

const CLICK_TOKEN_TTL_SECONDS = 30 * 60;

export function createClickToken(linkId: string): string {
  const payload = { kind: 'click', lid: linkId, n: crypto.randomBytes(9).toString('base64url'), exp: Math.floor(Date.now() / 1000) + CLICK_TOKEN_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** { linkId, nonce } when the token is genuine and unexpired, else null */
export function verifyClickToken(token: unknown): { linkId: string; nonce: string } | null {
  if (typeof token !== 'string') return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { kind?: string; lid?: string; n?: string; exp?: number };
    if (p.kind !== 'click' || !p.lid || !p.n || !p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
    return { linkId: p.lid, nonce: p.n };
  } catch {
    return null;
  }
}
