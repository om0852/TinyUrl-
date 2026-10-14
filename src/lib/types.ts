export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: WorkspaceRole;
}

export interface TeamMember {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  status: 'active' | 'invited';
  avatar?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  plan: 'free' | 'pro' | 'enterprise';
  created_at: string;
}

export interface Domain {
  id: string;
  hostname: string;
  verified: boolean;
  ssl_status: 'active' | 'pending' | 'failed';
  is_default: boolean;
  workspace_id: string;
}

export interface LinkRule {
  id: string;
  link_id: string;
  rule_type: 'geo' | 'device' | 'ab' | 'smart';
  condition: string; // e.g. 'iOS', 'Android', 'IN', 'Maharashtra', 'Mumbai', 'Android · Mumbai, MH, IN'
  target_url: string;
  weight?: number;
  geo_type?: 'country' | 'state' | 'city';
  device?: 'all' | 'android' | 'ios' | 'desktop';
  country?: string;
  state?: string;
  city?: string;
}

export interface RetargetingPixel {
  provider: 'meta' | 'google' | 'tiktok';
  pixel_id: string;
}

export interface DeepLinkConfig {
  enabled?: boolean;
  app: string;
  app_name?: string;
  app_uri?: string;
  ios_uri?: string;
  android_intent?: string;
  fallback_url: string;
}


export interface Link {
  id: string;
  short_code: string;
  custom_slug?: string;
  domain_id: string;
  workspace_id: string;
  destination_url: string;
  title: string;
  tags: string[];
  campaign_id?: string;
  password_hash?: string;
  expires_at?: string;
  max_clicks?: number;
  status: 'active' | 'disabled' | 'expired' | 'flagged';
  is_flagged: boolean;
  risk_score: number; // 0 - 100
  risk_reasons?: string[];
  created_by: string;
  created_at: string;
  clicks_count: number;
  
  // Marketing additions
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  
  retargeting_pixels?: RetargetingPixel[];
  deep_link?: DeepLinkConfig;
  rules?: LinkRule[];
  scheduled_activation?: string;

  // Smart routing runtime resolution
  resolved_destination_url?: string;
  visitor_geo?: {
    countryCode?: string;
    countryName?: string;
    regionCode?: string;
    regionName?: string;
    city?: string;
  };
}

export interface ClickEvent {
  id: string;
  link_id: string;
  short_code: string;
  timestamp: string; // ISO string
  ip_hash: string;
  country: string;
  country_code: string;
  region?: string;
  city: string;
  device: 'mobile' | 'desktop' | 'tablet';
  os: 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux';
  browser: 'Chrome' | 'Safari' | 'Firefox' | 'Edge';
  referrer: string;
  is_bot: boolean;
  is_unique: boolean;
  latency_ms: number;
}

export interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  tags: string[];
  target_clicks: number;
  created_at: string;
}

export interface QRCodeConfig {
  id: string;
  link_id: string;
  fg_color: string;
  bg_color: string;
  logo_type: 'none' | 'link' | 'qr' | 'star' | 'brand';
  dot_style: 'square' | 'dots' | 'rounded';
  error_correction: 'L' | 'M' | 'Q' | 'H';
}



export interface ApiKey {
  id: string;
  workspace_id: string;
  name: string;
  key_prefix: string;
  full_key: string;
  permissions: string[];
  created_at: string;
  last_used?: string;
}

export interface Webhook {
  id: string;
  workspace_id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  created_at: string;
}

export interface SecurityReport {
  scanned_url: string;
  safe_browsing: 'clean' | 'flagged' | 'malware';
  virustotal_risk: number; // 0 - 100
  is_blacklisted: boolean;
  threat_categories: string[];
  scanned_at: string;
}

// ─── API Request & Response Contracts ───

export interface ShortenApiRequest {
  id?: string;
  destination_url: string;
  workspace_id: string;
  custom_slug?: string;
  title?: string;
  tags?: string[];
  rules?: LinkRule[];
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  password?: string;
  expires_at?: string;
  max_clicks?: number;
}

export interface ShortenApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: Link;
}

export interface LinksQueryRequest {
  workspace_id?: string;
  code?: string;
}

export interface LinksApiResponse {
  success: boolean;
  source: string;
  total: number;
  links: Link[];
  error?: string;
}

export interface AuthApiRequest {
  action: 'login' | 'signup';
  email: string;
  password: string;
  name?: string;
}

export interface AuthApiResponse {
  success: boolean;
  user?: User;
  message?: string;
  error?: string;
  allowLocalFallback?: boolean;
}

export interface AnalyticsMetrics {
  total_clicks: number;
  unique_visitors: number;
  bot_clicks_filtered: number;
  avg_latency_ms: number;
  top_countries: Array<{ country: string; code: string; clicks: number }>;
  top_regions?: Array<{ region: string; clicks: number }>;
  top_cities?: Array<{ city: string; region?: string; country?: string; clicks: number }>;
  devices: { mobile: string; desktop: string; tablet: string };
}

export interface AnalyticsApiResponse {
  success: boolean;
  code: string;
  metrics: AnalyticsMetrics;
  error?: string;
}

export interface TrackApiRequest {
  link_id?: string;
  short_code?: string;
  click: Partial<ClickEvent>;
}

export interface TrackApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

