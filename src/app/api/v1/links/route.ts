import { NextResponse } from 'next/server';
import { initialLinks } from '@/lib/db';
import { sql } from '@/lib/postgres';

export async function GET() {
  try {
    const rows = await sql.query(`
      SELECT * FROM links ORDER BY created_at DESC LIMIT 100
    `);

    if (rows && rows.length > 0) {
      return NextResponse.json({
        success: true,
        source: 'neon_postgresql',
        total: rows.length,
        links: rows.map((l: any) => ({
          id: l.id,
          short_code: l.short_code,
          short_url: `https://lmk.to/${l.short_code}`,
          destination_url: l.destination_url,
          title: l.title,
          tags: typeof l.tags === 'string' ? JSON.parse(l.tags) : (l.tags || []),
          clicks_count: l.clicks_count,
          status: l.status,
          created_at: l.created_at
        }))
      });
    }
  } catch (err) {
    console.warn('Neon DB read error, falling back to cached links:', err);
  }

  return NextResponse.json({
    success: true,
    source: 'in_memory_fallback',
    total: initialLinks.length,
    links: initialLinks.map(l => ({
      id: l.id,
      short_code: l.short_code,
      short_url: `https://lmk.to/${l.short_code}`,
      destination_url: l.destination_url,
      title: l.title,
      tags: l.tags,
      clicks_count: l.clicks_count,
      status: l.status,
      created_at: l.created_at
    }))
  });
}
