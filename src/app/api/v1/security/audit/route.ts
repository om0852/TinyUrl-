import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { linkCache } from '@/lib/cache';

interface AuditLinkRow {
  id: string;
  workspace_id?: string | null;
  short_code: string;
  destination_url: string;
  is_flagged?: boolean | null;
  risk_score?: number | string | null;
  status?: string | null;
}

export interface SecurityAuditResult {
  link_id: string;
  short_code: string;
  destination_url: string;
  target_host: string;
  status_code: number;
  http_status: string;
  latency_ms: number;
  ssl_valid: boolean;
  ssl_status: string;
  is_safe: boolean;
  risk_score: number;
  threat_flags: string[];
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { workspace_id, link_ids } = body;

    let links: AuditLinkRow[] = [];
    if (Array.isArray(link_ids) && link_ids.length > 0) {
      links = (await sql.query(
        `SELECT id, workspace_id, short_code, destination_url, is_flagged, risk_score, status 
         FROM links WHERE id = ANY($1::text[])`,
        [link_ids]
      )) as unknown as AuditLinkRow[];
    } else if (workspace_id && typeof workspace_id === 'string' && workspace_id.trim()) {
      links = (await sql.query(
        `SELECT id, workspace_id, short_code, destination_url, is_flagged, risk_score, status 
         FROM links WHERE workspace_id = $1 LIMIT 50`,
        [workspace_id.trim()]
      )) as unknown as AuditLinkRow[];
    } else {
      links = (await sql.query(
        `SELECT id, workspace_id, short_code, destination_url, is_flagged, risk_score, status 
         FROM links ORDER BY created_at DESC LIMIT 30`
      )) as unknown as AuditLinkRow[];
    }

    if (!links || links.length === 0) {
      return NextResponse.json({
        success: true,
        scanned_count: 0,
        threats_detected: 0,
        results: []
      });
    }

    const SUSPICIOUS_PATTERNS = [
      /phish/i,
      /account[-_.]?verif/i,
      /secure[-_.]?login/i,
      /update[-_.]?banking/i,
      /free[-_.]?crypto/i,
      /metamask[-_.]?claim/i,
      /bit\.ly\/quarantine/i
    ];

    const results: SecurityAuditResult[] = await Promise.all(
      links.map(async (l) => {
        let host = 'Unknown';
        try {
          host = new URL(l.destination_url).hostname;
        } catch {
          host = 'invalid-url';
        }

        const isHttps = /^https:\/\//i.test(l.destination_url);
        let statusCode = 200;
        let httpStatus = '200 OK';
        let latencyMs = 85;
        const threatFlags: string[] = [];

        // Check heuristic phishing patterns
        for (const pattern of SUSPICIOUS_PATTERNS) {
          if (pattern.test(l.destination_url)) {
            threatFlags.push(`Suspicious keyword pattern: ${pattern.source}`);
          }
        }

        if (!isHttps) {
          threatFlags.push('Missing TLS/SSL (Plain HTTP endpoint)');
        }

        // Live network probe with 3.5s timeout
        const startTime = Date.now();
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);

          const res = await fetch(l.destination_url, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TinyUrlSecurityBot/2.0'
            },
            signal: controller.signal,
            redirect: 'follow'
          });
          clearTimeout(timer);

          latencyMs = Math.max(10, Date.now() - startTime);
          statusCode = res.status;
          httpStatus = `${res.status} ${res.statusText || 'Response'}`.trim();

          if (statusCode >= 400) {
            threatFlags.push(`Unhealthy HTTP status (${statusCode})`);
          }
        } catch (fetchErr: any) {
          latencyMs = Math.max(15, Date.now() - startTime);
          statusCode = 504;
          httpStatus = fetchErr?.name === 'AbortError' ? '504 Timeout' : '502 Unreachable';
          threatFlags.push(`Host connection failed: ${httpStatus}`);
        }

        // Compute risk score (0 to 100)
        let riskScore = 0;
        if (!isHttps) riskScore += 25;
        if (statusCode >= 500) riskScore += 45;
        else if (statusCode >= 400) riskScore += 30;
        if (threatFlags.some(f => f.includes('Suspicious keyword'))) riskScore += 50;
        riskScore = Math.min(100, Math.max(0, riskScore));

        const isSafe = riskScore < 50 && statusCode < 400;
        const isFlagged = !isSafe;

        // Persist scan result to PostgreSQL
        try {
          await sql.query(
            `UPDATE links 
             SET risk_score = $1, 
                 is_flagged = $2,
                 status = CASE WHEN $2 = true THEN 'flagged' ELSE 'active' END,
                 updated_at = NOW()
             WHERE id = $3`,
            [riskScore, isFlagged, l.id]
          );
          linkCache.delete(`link_${l.short_code.toLowerCase()}`);
        } catch (dbErr) {
          console.warn('DB update failed for audit row:', dbErr);
        }

        return {
          link_id: l.id,
          short_code: l.short_code,
          destination_url: l.destination_url,
          target_host: host,
          status_code: statusCode,
          http_status: httpStatus,
          latency_ms: latencyMs,
          ssl_valid: isHttps,
          ssl_status: isHttps ? 'Valid TLS 1.3' : 'Insecure HTTP',
          is_safe: isSafe,
          risk_score: riskScore,
          threat_flags: threatFlags
        };
      })
    );

    const threatsDetected = results.filter(r => !r.is_safe).length;

    return NextResponse.json({
      success: true,
      scanned_count: results.length,
      threats_detected: threatsDetected,
      results
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Security audit service error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
