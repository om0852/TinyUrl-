import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspace_id') || request.headers.get('x-workspace-id');

  try {
    let rows: any[] = [];
    if (workspaceId) {
      rows = await sql.query(`
        SELECT * FROM links WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100
      `, [workspaceId]);
    } else {
      rows = await sql.query(`
        SELECT * FROM links ORDER BY created_at DESC LIMIT 100
      `);
    }

    if (Array.isArray(rows)) {
      return NextResponse.json({
        success: true,
        source: 'neon_postgresql',
        total: rows.length,
        links: rows.map((l: any) => ({
          id: l.id,
          workspace_id: l.workspace_id,
          short_code: l.short_code,
          short_url: `https://lmk.to/${l.short_code}`,
          destination_url: l.destination_url,
          title: l.title,
          tags: typeof l.tags === 'string' ? JSON.parse(l.tags) : (l.tags || []),
          clicks_count: Number(l.clicks_count) || 0,
          status: l.status || 'active',
          created_at: l.created_at
        }))
      });
    }
  } catch (err) {
    console.warn('Neon DB read error, links empty fallback:', err);
  }

  // When scoped to a workspace or when DB is initialized clean, return empty list (never inject static fake links)
  return NextResponse.json({
    success: true,
    source: 'empty_workspace',
    total: 0,
    links: []
  });
}
