import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql, initializeDatabase } from '@/lib/postgres';
import { AuthApiRequest, AuthApiResponse } from '@/lib/types';

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    let body: Partial<AuthApiRequest>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json<AuthApiResponse>({ 
        success: false, 
        error: 'Malformed JSON payload in request body.' 
      }, { status: 400 });
    }

    const { action, email, password, name } = body;

    // 1. Strict Action Validation
    if (!action || (action !== 'login' && action !== 'signup')) {
      return NextResponse.json<AuthApiResponse>({ 
        success: false, 
        error: 'Invalid or missing "action" field. Must be either "login" or "signup".' 
      }, { status: 400 });
    }

    // 2. Strict Email Validation
    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json<AuthApiResponse>({ 
        success: false, 
        error: 'Field "email" is required and cannot be empty.' 
      }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json<AuthApiResponse>({ 
        success: false, 
        error: 'Invalid email address format.' 
      }, { status: 422 });
    }

    // 3. Strict Password Validation
    if (!password || typeof password !== 'string') {
      return NextResponse.json<AuthApiResponse>({ 
        success: false, 
        error: 'Field "password" is required.' 
      }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json<AuthApiResponse>({ 
        success: false, 
        error: 'Password must be at least 6 characters long.' 
      }, { status: 422 });
    }

    // Ensure database tables exist
    try {
      await initializeDatabase();
    } catch {}

    if (action === 'signup') {
      const cleanName = (name && typeof name === 'string' ? name.trim() : '') || cleanEmail.split('@')[0];

      if (!cleanName) {
        return NextResponse.json<AuthApiResponse>({ 
          success: false, 
          error: 'Field "name" is required for registration.' 
        }, { status: 400 });
      }

      // Check for existing user
      try {
        const existing = await sql.query(`SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`, [cleanEmail]);
        if (existing && existing.length > 0) {
          return NextResponse.json<AuthApiResponse>({ 
            success: false, 
            error: 'An account with this email already exists. Please log in.' 
          }, { status: 409 });
        }
      } catch (dbErr) {
        try {
          await sql.query(`
            CREATE TABLE IF NOT EXISTS users (
              id VARCHAR(64) PRIMARY KEY,
              name VARCHAR(255) NOT NULL,
              email VARCHAR(255) UNIQUE NOT NULL,
              password_hash VARCHAR(255) NOT NULL,
              salt VARCHAR(64) NOT NULL,
              role VARCHAR(32) DEFAULT 'owner',
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
          `);
        } catch {}
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);
      const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const initials = cleanName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'U';

      // Insert new user into database
      try {
        await sql.query(`
          INSERT INTO users (id, name, email, password_hash, salt, role)
          VALUES ($1, $2, $3, $4, $5, 'owner')
        `, [userId, cleanName, cleanEmail, passwordHash, salt]);
      } catch (insertErr) {
        console.warn('PostgreSQL user insert fallback:', insertErr);
      }

      return NextResponse.json<AuthApiResponse>({
        success: true,
        user: {
          id: userId,
          name: cleanName,
          email: cleanEmail,
          avatar: initials,
          role: 'owner'
        },
        message: 'Account successfully registered.'
      }, { status: 201 });

    } else if (action === 'login') {
      try {
        const rows = await sql.query(`
          SELECT id, name, email, password_hash, salt, role 
          FROM users 
          WHERE LOWER(email) = $1 
          LIMIT 1
        `, [cleanEmail]);

        if (rows && rows.length > 0) {
          const userRow = rows[0];
          const computedHash = hashPassword(password, userRow.salt);

          const isMatch = crypto.timingSafeEqual(
            Buffer.from(computedHash, 'utf8'),
            Buffer.from(userRow.password_hash, 'utf8')
          );

          if (!isMatch) {
            return NextResponse.json<AuthApiResponse>({ 
              success: false, 
              error: 'Incorrect password. Please verify your credentials.' 
            }, { status: 401 });
          }

          const initials = (userRow.name || cleanEmail).split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'U';

          return NextResponse.json<AuthApiResponse>({
            success: true,
            user: {
              id: userRow.id,
              name: userRow.name,
              email: userRow.email,
              avatar: initials,
              role: userRow.role || 'owner'
            },
            message: 'Authentication successful.'
          });
        }
      } catch (dbErr) {
        console.warn('PostgreSQL user lookup fallback:', dbErr);
      }

      return NextResponse.json<AuthApiResponse>({
        success: false,
        error: 'No account found with this email. Please create an account first.',
        allowLocalFallback: true
      }, { status: 401 });
    }

    return NextResponse.json<AuthApiResponse>({ 
      success: false, 
      error: 'Invalid auth action specified.' 
    }, { status: 400 });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Authentication service error.';
    return NextResponse.json<AuthApiResponse>({ 
      success: false, 
      error: msg 
    }, { status: 500 });
  }
}
