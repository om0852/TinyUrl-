import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export async function POST(request: Request) {
  try {
    let body: { link_id?: string; short_code?: string; workspace_id?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Malformed JSON payload.' }, { status: 400 });
    }

    const { link_id, short_code, workspace_id } = body;

    if (!link_id && !short_code && !workspace_id) {
      return NextResponse.json(
        { success: false, error: 'Provide link_id, short_code, or workspace_id to reset analytics.' },
        { status: 400 }
      );
    }

    if (link_id || short_code) {
      // 1. Purge click events for this specific link
      await sql.query(
        `DELETE FROM click_events 
         WHERE (link_id = $1 AND $1 != '') OR (LOWER(short_code) = $2 AND $2 != '')`,
        [link_id || '', (short_code || '').toLowerCase()]
      );

      // 2. Reset clicks counter on links table
      await sql.query(
        `UPDATE links 
         SET clicks_count = 0, updated_at = NOW() 
         WHERE (id = $1 AND $1 != '') OR (LOWER(short_code) = $2 AND $2 != '')`,
        [link_id || '', (short_code || '').toLowerCase()]
      );

      return NextResponse.json({
        success: true,
        message: 'Link analytics and click stream wiped successfully.'
      });
    }

    if (workspace_id) {
      // 1. Purge click events for all links under this workspace
      await sql.query(
        `DELETE FROM click_events 
         WHERE link_id IN (SELECT id FROM links WHERE workspace_id = $1)`,
        [workspace_id]
      );

      // 2. Reset counters on all links in workspace
      await sql.query(
        `UPDATE links 
         SET clicks_count = 0, updated_at = NOW() 
         WHERE workspace_id = $1`,
        [workspace_id]
      );

      return NextResponse.json({
        success: true,
        message: 'Workspace analytics and click history wiped successfully.'
      });
    }

    return NextResponse.json({ success: false, error: 'No matching target for reset.' }, { status: 400 });
  } catch (error) {
    console.error('Reset stats error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to reset analytics.' },
      { status: 500 }
    );
  }
}
