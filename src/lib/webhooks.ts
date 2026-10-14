import crypto from 'crypto';
import { sql } from '@/lib/postgres';

export interface WebhookPayload {
  event: 'link.created' | 'link.clicked' | 'link.updated' | 'link.deleted';
  timestamp: string;
  data: Record<string, unknown>;
}

export async function dispatchWorkspaceWebhooks(
  workspaceId: string | null | undefined, 
  payload: WebhookPayload
): Promise<void> {
  try {
    const wsId = workspaceId && workspaceId.trim() ? workspaceId.trim() : 'ws_default';
    const rows = (await sql.query(
      `SELECT id, url, secret, events FROM webhooks 
       WHERE is_active = true 
         AND (workspace_id = $1 OR workspace_id = 'ws_default' OR workspace_id IS NULL)`,
      [wsId]
    )) as Array<{ id: string; url: string; secret?: string | null; events?: string[] | string | null }>;

    if (!rows || rows.length === 0) return;

    const bodyString = JSON.stringify(payload);

    const dispatches = rows.map(async (hook) => {
      try {
        let eventsList: string[] = [];
        if (typeof hook.events === 'string') {
          try { 
            eventsList = JSON.parse(hook.events); 
          } catch { 
            eventsList = ['click', 'link.clicked', 'link.created']; 
          }
        } else if (Array.isArray(hook.events)) {
          eventsList = hook.events;
        }

        const matchesEvent = eventsList.some(e => {
          if (e === payload.event) return true;
          if (e === 'click' && payload.event === 'link.clicked') return true;
          if (e === 'link' && payload.event.startsWith('link.')) return true;
          if (e === '*') return true;
          return false;
        });

        if (!matchesEvent) return;

        const secret = hook.secret || 'whsec_default';
        const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

        await fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'TinyUrl-Webhooks/1.0',
            'X-Signature-SHA256': signature,
            'X-Hub-Signature-256': `sha256=${signature}`,
            'X-Event': payload.event,
            'X-Webhook-ID': String(hook.id)
          },
          body: bodyString,
          signal: AbortSignal.timeout(4000)
        }).catch(err => {
          console.warn(`[Webhook] Dispatch failed for ${hook.url}:`, err instanceof Error ? err.message : err);
        });
      } catch (innerErr) {
        console.warn(`[Webhook] Processing error for hook:`, innerErr);
      }
    });

    await Promise.allSettled(dispatches);
  } catch (err) {
    console.warn('[Webhook] Dispatch error:', err);
  }
}
