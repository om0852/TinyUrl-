import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql, initializeDatabase } from '@/lib/postgres';

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, email, password, name } = body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ success: false, error: 'Valid email address is required.' }, { status: 400 });
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ success: false, error: 'Password is required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Ensure database tables exist if database is connected
    try {
      await initializeDatabase();
    } catch {}

    if (action === 'signup') {
      if (password.length < 6) {
        return NextResponse.json({ success: false, error: 'Password must be at least 6 characters long.' }, { status: 400 });
      }

      const cleanName = (name || '').trim() || cleanEmail.split('@')[0];

      // Check if user already exists
      try {
        const existing = await sql.query(`SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`, [cleanEmail]);
        if (existing && existing.length > 0) {
          return NextResponse.json({ 
            success: false, 
            error: 'An account with this email already exists. Please log in.' 
          }, { status: 409 });
        }
      } catch (dbErr) {
        // Table might not exist yet; try creating it
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

      // Insert new user
      try {
        await sql.query(`
          INSERT INTO users (id, name, email, password_hash, salt, role)
          VALUES ($1, $2, $3, $4, $5, 'owner')
        `, [userId, cleanName, cleanEmail, passwordHash, salt]);
      } catch (insertErr) {
        console.warn('PostgreSQL user insert fallback:', insertErr);
      }

      return NextResponse.json({
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
      // Login validation
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

          // Constant-time comparison to prevent timing attacks
          const isMatch = crypto.timingSafeEqual(
            Buffer.from(computedHash, 'utf8'),
            Buffer.from(userRow.password_hash, 'utf8')
          );

          if (!isMatch) {
            return NextResponse.json({ 
              success: false, 
              error: 'Incorrect password. Please verify your credentials.' 
            }, { status: 401 });
          }

          const initials = (userRow.name || cleanEmail).split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'U';

          return NextResponse.json({
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

      // If database is not configured or user not in DB yet, return structured response
      return NextResponse.json({
        success: false,
        error: 'No account found with this email. Please create an account first.',
        allowLocalFallback: true
      }, { status: 401 });

    } else {
      return NextResponse.json({ success: false, error: 'Invalid auth action specified.' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Authentication service error.' }, { status: 500 });
  }
}
