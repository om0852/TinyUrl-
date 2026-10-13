import {
  Link,
  ClickEvent,
  Workspace,
  Domain,
  Campaign,
  ApiKey,
  Webhook,
  TeamMember
} from './types';

// Reserved words that cannot be used as short codes or custom slugs
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'login', 'register', 'dashboard', 'auth', 'settings',
  'security', 'terms', 'privacy', 's', 'qr', 'analytics', 'help',
  'support', 'pricing', 'logout', 'user', 'account', 'status'
]);

const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateBase62Code(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * BASE62_CHARS.length);
    code += BASE62_CHARS[randomIndex];
  }
  return code;
}

export function normalizeUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export function getShortUrlPrefix(domainName: string = ''): string {
  const host = domainName || (typeof window !== 'undefined' ? window.location.host : '');
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  const protocol = isLocal ? 'http://' : 'https://';
  return `${protocol}${host || 'localhost:3000'}`;
}

export function buildUtmUrl(baseUrl: string, utms: {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}): string {
  try {
    const urlObj = new URL(baseUrl);
    if (utms.source) urlObj.searchParams.set('utm_source', utms.source);
    if (utms.medium) urlObj.searchParams.set('utm_medium', utms.medium);
    if (utms.campaign) urlObj.searchParams.set('utm_campaign', utms.campaign);
    if (utms.term) urlObj.searchParams.set('utm_term', utms.term);
    if (utms.content) urlObj.searchParams.set('utm_content', utms.content);
    return urlObj.toString();
  } catch {
    return baseUrl;
  }
}

// Clean Empty Seed Data (Zero fake/mock data for real user accounts)
export const initialWorkspaces: Workspace[] = [];

export const initialTeamMembers: TeamMember[] = [];

const defaultWebsiteDomain = process.env.NEXT_PUBLIC_DEFAULT_DOMAIN || 'localhost:3000';

export const initialDomains: Domain[] = [
  { id: 'dom_1', hostname: defaultWebsiteDomain, verified: true, ssl_status: 'active', is_default: true, workspace_id: 'ws_default' }
];

export const initialCampaigns: Campaign[] = [];

export const initialLinks: Link[] = [];

// Clean clicks array (No fake/random clicks generated)
export function generateMockClicks(): ClickEvent[] {
  return [];
}

export const initialApiKeys: ApiKey[] = [];

export const initialWebhooks: Webhook[] = [];
