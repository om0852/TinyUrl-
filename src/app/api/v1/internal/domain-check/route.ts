import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

interface DomainRow {
  id: string;
  hostname: string;
  verified: boolean;
}

/**
 * On-Demand Edge TLS Verification Endpoint ("Ask" endpoint)
 * 
 * Used by:
 * - Caddy On-Demand TLS (`on_demand_tls { ask http://... }`)
 * - Reverse proxy edge clusters (Nginx, Traefik, HAProxy)
 * - Internal zero-trust edge probes
 * 
 * Behavior:
 * Returns HTTP 200 ONLY if the hostname is authorized and verified in PostgreSQL.
 * Drops/Returns HTTP 404 for any unauthorized or unknown hostname to prevent certificate exhaustion.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain') || searchParams.get('hostname');

    if (!domain || typeof domain !== 'string') {
      return new NextResponse('Domain parameter missing', { status: 400 });
    }

    const cleanHost = domain.trim().toLowerCase()
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '');

    // Allow internal platform domains & bridge domain automatically
    const primaryBridge = (process.env.CUSTOM_DOMAIN_CNAME_TARGET || process.env.NEXT_PUBLIC_CNAME_TARGET || 'creataurus.work.gd').toLowerCase();

    if (
      cleanHost === 'localhost' ||
      cleanHost === '127.0.0.1' ||
      cleanHost.endsWith('.vercel.app') ||
      cleanHost === 'tinyurl.dev' ||
      cleanHost === primaryBridge ||
      cleanHost === 'creataurus.work.gd'
    ) {
      return new NextResponse('OK', { status: 200 });
    }

    // Query Neon PostgreSQL for verified status
    const rows = (await sql.query(
      `SELECT id, hostname, verified FROM domains WHERE LOWER(hostname) = $1 AND verified = true LIMIT 1`,
      [cleanHost]
    )) as unknown as DomainRow[];

    if (rows && rows.length > 0) {
      return new NextResponse('OK', { 
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    return new NextResponse('Domain not authorized or pending verification', { 
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  } catch (err) {
    console.error('Edge domain-check error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}
