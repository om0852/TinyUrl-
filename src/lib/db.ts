import {
  Link,
  ClickEvent,
  Workspace,
  Domain,
  Campaign,
  QRCodeConfig,
  ApiKey,
  Webhook,
  LinkRule,
  SecurityReport,
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

// Initial Seed Data
export const initialWorkspaces: Workspace[] = [
  { id: 'ws_1', name: 'Acme Growth Platform', slug: 'acme-corp', role: 'owner', plan: 'enterprise', created_at: '2026-01-10T10:00:00Z' },
  { id: 'ws_2', name: 'Personal Projects', slug: 'personal', role: 'owner', plan: 'free', created_at: '2026-02-01T14:30:00Z' }
];

export const initialTeamMembers: TeamMember[] = [
  { id: 'tm_1', workspace_id: 'ws_1', name: 'Alex Morgan', email: 'alex@acme.com', role: 'owner', status: 'active', avatar: 'AM' },
  { id: 'tm_2', workspace_id: 'ws_1', name: 'Sarah Jenkins', email: 'sarah@acme.com', role: 'admin', status: 'active', avatar: 'SJ' },
  { id: 'tm_3', workspace_id: 'ws_1', name: 'Dave Miller', email: 'dave@acme.com', role: 'editor', status: 'active', avatar: 'DM' },
  { id: 'tm_4', workspace_id: 'ws_1', name: 'Client Analyst', email: 'analyst@client.com', role: 'viewer', status: 'active', avatar: 'CA' }
];

const defaultWebsiteDomain = process.env.NEXT_PUBLIC_DEFAULT_DOMAIN || 'localhost:3000';

export const initialDomains: Domain[] = [
  { id: 'dom_1', hostname: defaultWebsiteDomain, verified: true, ssl_status: 'active', is_default: true, workspace_id: 'ws_1' }
];

export const initialCampaigns: Campaign[] = [
  { id: 'cmp_1', workspace_id: 'ws_1', name: 'Black Friday 2026', description: 'Holiday promotional short links and retargeting ads', tags: ['holiday', 'promos', 'meta_ads'], target_clicks: 50000, created_at: '2026-09-01T08:00:00Z' },
  { id: 'cmp_2', workspace_id: 'ws_1', name: 'Product Launch v2.0', description: 'New SaaS feature announcement links across Twitter and LinkedIn', tags: ['saas', 'launch', 'social'], target_clicks: 25000, created_at: '2026-09-15T12:00:00Z' },
  { id: 'cmp_3', workspace_id: 'ws_1', name: 'Influencer Outreach', description: 'Custom UTM tracking for Youtube tech reviewers', tags: ['youtube', 'influencers'], target_clicks: 10000, created_at: '2026-10-01T09:00:00Z' }
];

export const initialLinks: Link[] = [
  {
    id: 'link_1',
    short_code: 'sale26',
    custom_slug: 'sale26',
    domain_id: 'dom_2',
    workspace_id: 'ws_1',
    destination_url: 'https://acme.com/store/black-friday-special?discount=FLAT50',
    title: 'Black Friday 50% Off Special Sale',
    tags: ['promo', 'ecommerce', 'sale'],
    campaign_id: 'cmp_1',
    status: 'active',
    is_flagged: false,
    risk_score: 2,
    created_by: 'Alex Morgan',
    created_at: '2026-10-01T10:00:00Z',
    clicks_count: 14820,
    utm_source: 'instagram',
    utm_medium: 'bio_link',
    utm_campaign: 'black_friday_2026',
    retargeting_pixels: [
      { provider: 'meta', pixel_id: 'FB_PIXEL_9921' },
      { provider: 'google', pixel_id: 'G_TAG_7712' }
    ],
    rules: [
      { id: 'r_1', link_id: 'link_1', rule_type: 'device', condition: 'iOS', target_url: 'https://apps.apple.com/app/acme-store/id1234567' },
      { id: 'r_2', link_id: 'link_1', rule_type: 'device', condition: 'Android', target_url: 'https://play.google.com/store/apps/details?id=com.acme.store' },
      { id: 'r_3', link_id: 'link_1', rule_type: 'geo', condition: 'UK', target_url: 'https://acme.co.uk/store/black-friday' }
    ]
  },
  {
    id: 'link_2',
    short_code: 'v2launch',
    custom_slug: 'v2launch',
    domain_id: 'dom_1',
    workspace_id: 'ws_1',
    destination_url: 'https://acme.com/blog/introducing-v2-platform',
    title: 'Platform V2 Launch Technical Overview',
    tags: ['saas', 'announcement'],
    campaign_id: 'cmp_2',
    status: 'active',
    is_flagged: false,
    risk_score: 0,
    created_by: 'Alex Morgan',
    created_at: '2026-10-03T11:20:00Z',
    clicks_count: 8430,
    utm_source: 'twitter',
    utm_medium: 'tweet',
    utm_campaign: 'v2_launch',
    rules: [
      { id: 'r_4', link_id: 'link_2', rule_type: 'ab', condition: '50', target_url: 'https://acme.com/blog/introducing-v2-variant-b', weight: 50 }
    ]
  },
  {
    id: 'link_3',
    short_code: 'passcode1',
    domain_id: 'dom_1',
    workspace_id: 'ws_1',
    destination_url: 'https://drive.google.com/file/d/1823912839/view',
    title: 'Investor Pitch Deck PDF Document',
    tags: ['investor', 'pdf', 'protected'],
    password_hash: 'investor2026',
    status: 'active',
    is_flagged: false,
    risk_score: 5,
    created_by: 'Alex Morgan',
    created_at: '2026-10-05T16:00:00Z',
    clicks_count: 312,
    max_clicks: 1000,
    expires_at: '2026-11-01T00:00:00Z'
  },
  {
    id: 'link_4',
    short_code: 'igapp',
    domain_id: 'dom_1',
    workspace_id: 'ws_1',
    destination_url: 'https://instagram.com/acmeofficial',
    title: 'Official Instagram Profile Deep Link',
    tags: ['instagram', 'social', 'deep-link'],
    status: 'active',
    is_flagged: false,
    risk_score: 1,
    created_by: 'Alex Morgan',
    created_at: '2026-10-06T09:15:00Z',
    clicks_count: 4290,
    deep_link: {
      app: 'instagram',
      app_uri: 'instagram://user?username=acmeofficial',
      fallback_url: 'https://instagram.com/acmeofficial'
    }
  },
  {
    id: 'link_5',
    short_code: 'suspicious-link',
    domain_id: 'dom_1',
    workspace_id: 'ws_1',
    destination_url: 'https://malicious-claim-gift-airdrop.tk/verify',
    title: 'Claim Free Token Airdrop (Flagged Link)',
    tags: ['suspicious', 'spam'],
    status: 'flagged',
    is_flagged: true,
    risk_score: 98,
    risk_reasons: ['Google Safe Browsing flagged phishing URL', 'VirusTotal detection 14/72 engines', 'Unverified TLD .tk'],
    created_by: 'External User',
    created_at: '2026-10-08T18:40:00Z',
    clicks_count: 42
  }
];

// Helper to generate seed clicks for analytics charts
export function generateMockClicks(): ClickEvent[] {
  const events: ClickEvent[] = [];
  const countries = [
    { country: 'United States', code: 'US', cities: ['New York', 'San Francisco', 'Austin', 'Seattle'] },
    { country: 'India', code: 'IN', cities: ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad'] },
    { country: 'United Kingdom', code: 'GB', cities: ['London', 'Manchester', 'Edinburgh'] },
    { country: 'Germany', code: 'DE', cities: ['Berlin', 'Munich', 'Hamburg'] },
    { country: 'Japan', code: 'JP', cities: ['Tokyo', 'Osaka'] },
    { country: 'Canada', code: 'CA', cities: ['Toronto', 'Vancouver'] }
  ];
  const devices: Array<'mobile' | 'desktop' | 'tablet'> = ['mobile', 'desktop', 'desktop', 'mobile', 'tablet'];
  const oses: Array<'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux'> = ['iOS', 'Android', 'Windows', 'macOS'];
  const browsers: Array<'Chrome' | 'Safari' | 'Firefox' | 'Edge'> = ['Chrome', 'Chrome', 'Safari', 'Firefox', 'Edge'];
  const referrers = ['Direct / None', 'https://t.co', 'https://linkedin.com', 'https://facebook.com', 'https://google.com', 'https://instagram.com'];

  const now = new Date();
  for (let i = 0; i < 280; i++) {
    const daysAgo = Math.floor(Math.random() * 14);
    const hoursAgo = Math.floor(Math.random() * 24);
    const date = new Date(now.getTime() - (daysAgo * 86400000) - (hoursAgo * 3600000));
    
    const geo = countries[Math.floor(Math.random() * countries.length)];
    const city = geo.cities[Math.floor(Math.random() * geo.cities.length)];
    const device = devices[Math.floor(Math.random() * devices.length)];
    const os = oses[Math.floor(Math.random() * oses.length)];
    const browser = browsers[Math.floor(Math.random() * browsers.length)];
    const referrer = referrers[Math.floor(Math.random() * referrers.length)];
    const is_bot = Math.random() < 0.04;
    const is_unique = Math.random() < 0.72;
    const link_id = Math.random() < 0.6 ? 'link_1' : Math.random() < 0.85 ? 'link_2' : 'link_4';

    events.push({
      id: `clk_${i}_${Date.now()}`,
      link_id,
      short_code: link_id === 'link_1' ? 'sale26' : link_id === 'link_2' ? 'v2launch' : 'igapp',
      timestamp: date.toISOString(),
      ip_hash: `hash_${Math.floor(Math.random() * 100000)}`,
      country: geo.country,
      country_code: geo.code,
      city,
      device,
      os,
      browser,
      referrer,
      is_bot,
      is_unique,
      latency_ms: Math.floor(18 + Math.random() * 22)
    });
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}



export const initialApiKeys: ApiKey[] = [
  {
    id: 'key_1',
    workspace_id: 'ws_1',
    name: 'Production Server Integration',
    key_prefix: 'ak_live_99a8',
    full_key: 'ak_live_99a8f273b0928a719283c110293847',
    permissions: ['links:read', 'links:write', 'analytics:read'],
    created_at: '2026-09-01T10:00:00Z',
    last_used: '2026-10-09T14:22:00Z'
  }
];

export const initialWebhooks: Webhook[] = [
  {
    id: 'wh_1',
    workspace_id: 'ws_1',
    url: 'https://api.client.com/webhooks/link-events',
    events: ['link.created', 'link.clicked', 'link.flagged'],
    secret: 'whsec_881293849102834710',
    active: true,
    created_at: '2026-09-10T12:00:00Z'
  }
];
