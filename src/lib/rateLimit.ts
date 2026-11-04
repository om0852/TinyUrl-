import { sql } from '@/lib/postgres';

let tableReady: Promise<unknown> | null = null;

function ensureTable() {
  if (!tableReady) {
    tableReady = sql.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        bucket VARCHAR(200) NOT NULL,
        window_start TIMESTAMPTZ NOT NULL,
        hits INT NOT NULL DEFAULT 0,
        PRIMARY KEY (bucket, window_start)
      )
    `).catch(err => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the current window ends */
  retryAfter: number;
}

/**
 * Fixed-window counter: at most `limit` hits per `windowSeconds` for one bucket (e.g. "mcp:ip:1.2.3.4").
 * Kept in Postgres because Redis isn't configured in production; one upsert per call.
 * Fails open: if the database is unreachable the request is allowed rather than blocked.
 */
export async function rateLimit(bucket: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  try {
    await ensureTable();
    const rows = (await sql.query(
      `INSERT INTO rate_limits (bucket, window_start, hits)
       VALUES ($1, to_timestamp(floor(extract(epoch FROM NOW()) / $2) * $2), 1)
       ON CONFLICT (bucket, window_start) DO UPDATE SET hits = rate_limits.hits + 1
       RETURNING hits, extract(epoch FROM window_start) AS window_epoch`,
      [bucket.slice(0, 200), windowSeconds]
    )) as { hits: number | string; window_epoch: number | string }[];

    // Old windows are useless; clear them now and then instead of on a schedule
    if (Math.random() < 0.01) {
      sql.query(`DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 day'`).catch(() => {});
    }

    const hits = Number(rows?.[0]?.hits) || 0;
    const windowEnd = (Number(rows?.[0]?.window_epoch) || 0) + windowSeconds;
    return { ok: hits <= limit, retryAfter: Math.max(1, Math.ceil(windowEnd - Date.now() / 1000)) };
  } catch {
    return { ok: true, retryAfter: 0 };
  }
}
