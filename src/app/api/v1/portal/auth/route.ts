import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql, initializeDatabase } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';
import { PORTAL_COOKIE, createPortalToken, portalCookieOptions } from '@/lib/session';

const MAX_ATTEMPTS = 10;
const LOCKOUT_SECONDS = 15 * 60;
const INVALID = 'Invalid email or password.';

function hashPassword(password: string, iterations = 210000): string {
  const salt = 'client_portal_salt_2026';
  return crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
}

function verifyClientPassword(password: string, storedHash?: string): boolean {
  if (!storedHash) return false;
  try {
    const target = Buffer.from(storedHash, 'utf8');
    return [210000, 10000].some(iterations => {
      const candidate = Buffer.from(hashPassword(password, iterations), 'utf8');
      return candidate.length === target.length && crypto.timingSafeEqual(candidate, target);
    });
  } catch {
    return false;
  }
}

function clientIp(request: Request): string {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: Request) {
  try {
    await initializeDatabase();
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Malformed JSON payload.' }, { status: 400 });
    }

    const { email, password, client_id } = body as { email?: unknown; password?: unknown; client_id?: unknown };
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false, error: 'Field "email" is required.' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ success: false, error: 'Field "password" is required.' }, { status: 400 });
    }
    const cleanEmail = email.trim().toLowerCase();

    // Slow down guessing: 10 failed tries per email + IP, then a 15 minute pause
    const attemptsKey = `portal_login_${cleanEmail}_${clientIp(request)}`;
    const attempts = Number(await linkCache.get<number>(attemptsKey).catch(() => 0)) || 0;
    if (attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ success: false, error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
    }
    const fail = async () => {
      await linkCache.set(attemptsKey, attempts + 1, LOCKOUT_SECONDS).catch(() => {});
      // One message for unknown email, wrong password and suspended accounts
      return NextResponse.json({ success: false, error: INVALID }, { status: 401 });
    };

    const rows = (typeof client_id === 'string' && client_id
      ? await sql.query(`SELECT * FROM client_portals WHERE id = $1 AND LOWER(email) = $2 LIMIT 1`, [client_id, cleanEmail])
      : await sql.query(`SELECT * FROM client_portals WHERE LOWER(email) = $1 ORDER BY created_at DESC LIMIT 1`, [cleanEmail])
    ) as Record<string, unknown>[];

    const client = rows?.[0];
    if (!client || !verifyClientPassword(password.trim(), client.password_hash as string)) return fail();
    if (client.status !== 'active') {
      return NextResponse.json({ success: false, error: 'This portal is not active. Contact your agency.' }, { status: 403 });
    }

    await linkCache.delete(attemptsKey).catch(() => {});
    await sql.query(
      `UPDATE client_portals SET total_logins = total_logins + 1, last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [client.id]
    );

    // Only what the portal shows; links and permissions come from /portal/resources
    const clientProfile = {
      id: client.id,
      name: client.name,
      email: client.email,
      company_name: client.company_name
    };

    const res = NextResponse.json({ success: true, message: 'Signed in.', client: clientProfile });
    // The portal session: portal routes identify the client from this signed cookie only
    res.cookies.set(PORTAL_COOKIE, createPortalToken(String(client.id)), portalCookieOptions());
    return res;
  } catch (error) {
    console.error('Client portal auth error:', error);
    return NextResponse.json({ success: false, error: 'Sign-in failed. Please try again.' }, { status: 500 });
  }
}

// Sign out of the portal
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(PORTAL_COOKIE, '', portalCookieOptions(0));
  return res;
}
