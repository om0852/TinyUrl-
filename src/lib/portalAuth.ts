import { sql } from '@/lib/postgres';
import { getPortalClientId } from '@/lib/session';

export interface PortalClientRow {
  id: string;
  workspace_id: string;
  name: string;
  company_name: string;
  status: string;
  custom_domain?: string | null;
  brand_logo_url?: string | null;
  brand_color?: string | null;
  can_view_analytics: boolean;
  can_edit_destination_url: boolean;
  can_create_links: boolean;
  max_links_quota?: number | null;
  assigned_link_ids: string[];
  assigned_campaign_ids: string[];
}

const parseIds = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : []; } catch { return []; }
  }
  return [];
};

/** The active portal client signed in on this request (signed snip_portal cookie), or null */
export async function getPortalClient(request: Request): Promise<PortalClientRow | null> {
  const clientId = getPortalClientId(request);
  if (!clientId) return null;
  const rows = (await sql.query(
    `SELECT * FROM client_portals WHERE id = $1 AND status = 'active' LIMIT 1`,
    [clientId]
  ).catch(() => [])) as Record<string, unknown>[];
  const r = rows?.[0];
  if (!r) return null;
  return {
    ...(r as unknown as PortalClientRow),
    assigned_link_ids: parseIds(r.assigned_link_ids),
    assigned_campaign_ids: parseIds(r.assigned_campaign_ids)
  };
}
