import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/postgres';
import { verifyWorkspacePermission } from '@/lib/serverAuth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'Query parameter "workspace_id" is required.' }, { status: 400 });
    }

    const authResult = await verifyWorkspacePermission(request, 'export:data', {
      workspaceId: workspaceId.trim()
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const rows = await sql.query(
      `SELECT id, workspace_id, user_email, operation, batch_name, total_rows, success_count, error_count, error_details, status, created_at
       FROM bulk_jobs 
       WHERE workspace_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [workspaceId.trim()]
    ).catch(() => []);

    return NextResponse.json({
      success: true,
      jobs: rows || []
    });
  } catch (error) {
    console.error('Fetch bulk jobs error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch bulk jobs.' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { workspace_id, operation, batch_name, total_rows, success_count, error_count } = body;

    if (!workspace_id) {
      return NextResponse.json({ success: false, error: 'Field "workspace_id" is required.' }, { status: 400 });
    }

    const authResult = await verifyWorkspacePermission(request, 'export:data', {
      workspaceId: String(workspace_id).trim()
    });
    if (!authResult.success) {
      return authResult.response;
    }
    const userEmail = authResult.context.userEmail || 'system';

    const jobId = `job_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const cleanOperation = operation === 'export' ? 'export' : 'import';
    const cleanBatchName = String(batch_name || 'Bulk Operation').slice(0, 255);
    const total = Number(total_rows) || 0;
    const success = Number(success_count ?? total_rows) || 0;
    const errors = Number(error_count) || 0;

    await sql.query(
      `INSERT INTO bulk_jobs (id, workspace_id, user_email, operation, batch_name, total_rows, success_count, error_count, error_details, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '[]'::jsonb, 'completed', NOW())`,
      [jobId, String(workspace_id).trim(), userEmail, cleanOperation, cleanBatchName, total, success, errors]
    ).catch(err => {
      console.warn('Failed to log bulk job:', err);
    });

    return NextResponse.json({
      success: true,
      job: {
        id: jobId,
        workspace_id,
        operation: cleanOperation,
        batch_name: cleanBatchName,
        total_rows: total,
        success_count: success,
        error_count: errors,
        status: 'completed',
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to record bulk job.' }, { status: 500 });
  }
}
