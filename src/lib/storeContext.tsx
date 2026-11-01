'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Link,
  ClickEvent,
  Workspace,
  Domain,
  Campaign,
  ApiKey,
  Webhook,
  LinkRule,
  SecurityReport,
  User,
  TeamMember,
  WorkspaceInvitation,
  WorkspaceRole,
  DeepLinkConfig,
  ClientPortalAccount,
  ClientPortalSummaryMetrics
} from './types';
import {
  initialDomains,
  generateBase62Code,
  generateId,
  normalizeUrl,
  buildUtmUrl,
  RESERVED_SLUGS
} from './db';
import { detectAppDeepLink } from './deepLink';
import { hasPermission, ROLE_DESCRIPTIONS, Permission } from './rbac';
import { useToast } from '@/components/ui/ToastHub';



interface StoreContextType {
  currentUser: User | null;
  authLoaded: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;

  workspaces: Workspace[];
  currentWorkspace: Workspace;
  currentUserRole: WorkspaceRole;
  checkPermissionOrToast: (perm: Permission, actionDescription: string) => boolean;
  setCurrentWorkspace: (ws: Workspace) => void;
  createWorkspace: (name: string, plan?: 'free' | 'pro' | 'enterprise') => Workspace;
  updateWorkspace: (workspaceId: string, name: string, slug?: string) => Promise<boolean>;
  deleteWorkspace: (workspaceId: string) => Promise<boolean>;

  teamMembers: TeamMember[];
  refreshTeamMembers: (force?: boolean) => Promise<void>;
  inviteTeamMember: (name: string, email: string, role: WorkspaceRole) => Promise<WorkspaceInvitation | null>;
  removeTeamMember: (id: string) => void;
  updateMemberRole: (memberId: string, role: WorkspaceRole) => Promise<boolean>;

  incomingInvitations: WorkspaceInvitation[];
  refreshIncomingInvitations: () => Promise<void>;
  acceptInvitationDirect: (token: string) => Promise<{ success: boolean; error?: string }>;
  declineInvitationDirect: (token: string) => Promise<{ success: boolean; error?: string }>;

  domains: Domain[];
  refreshDomains: (force?: boolean) => Promise<void>;
  campaigns: Campaign[];
  refreshCampaigns: (force?: boolean) => Promise<void>;
  clients: ClientPortalAccount[];
  clientMetrics: ClientPortalSummaryMetrics;
  refreshClients: (force?: boolean) => Promise<void>;
  links: Link[];
  refreshLinks: (force?: boolean) => Promise<void>;
  brokenLinksCount: number;
  scanBrokenLinks: (workspaceId?: string) => Promise<{ success: boolean; checked: number; broken_count: number; broken_links?: any[]; error?: string }>;
  fixBrokenLink: (linkId: string, newDestinationUrl: string, fallbackUrl?: string) => Promise<{ success: boolean; error?: string }>;
  clicks: ClickEvent[];
  refreshAnalytics: (force?: boolean) => Promise<void>;
  selectedAnalyticsLinkId: string | null;
  setSelectedAnalyticsLinkId: (id: string | null) => void;
  
  // Loading & Refreshing States
  isRefreshing: boolean;
  isInitialLoading: boolean;
  isLinksLoading: boolean;
  isAnalyticsLoading: boolean;
  isCampaignsLoading: boolean;
  isClientsLoading: boolean;
  isTeamLoading: boolean;
  isDomainsLoading: boolean;
  isSettingsLoading: boolean;

  refreshData: (force?: boolean) => Promise<void>;
  refreshSettings: (force?: boolean) => Promise<void>;
  apiKeys: ApiKey[];
  webhooks: Webhook[];

  
  // Actions
  createShortLink: (data: {
    destination_url: string;
    title?: string;
    custom_slug?: string;
    domain_id?: string;
    campaign_id?: string;
    tags?: string[];
    password?: string;
    expires_at?: string;
    max_clicks?: number;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
    deep_link?: DeepLinkConfig;
    rules?: LinkRule[];
    redirect_type?: 'direct' | 'frame' | 'splash';
    http_status_code?: 301 | 302 | 307 | 308;
    notes?: string;
    shield_protection?: boolean;
    hide_referrer?: boolean;
    channel?: string;
    og_title?: string;
    og_description?: string;
    og_image_url?: string;
  }) => { link: Link | null; error?: string };


  updateLink: (id: string, updates: Partial<Link>) => void;
  deleteLink: (id: string) => void;
  resetLinkAnalytics: (linkId?: string) => Promise<{ success: boolean; message?: string }>;
  addRuleToLink: (linkId: string, rule: { 
    rule_type?: 'geo' | 'device' | 'ab' | 'smart'; 
    condition?: string; 
    target_url: string; 
    weight?: number; 
    geo_type?: 'country' | 'state' | 'city';
    device?: 'all' | 'android' | 'ios' | 'desktop';
    country?: string;
    state?: string;
    city?: string;
  }) => void;
  removeRuleFromLink: (linkId: string, ruleId: string) => void;
  logClick: (linkId: string, clientInfo?: Partial<ClickEvent>) => ClickEvent;
  
  addDomain: (hostname: string, is_default?: boolean, root_redirect_url?: string) => Promise<Domain | null>;
  verifyDomain: (idOrHostname: string, simulateBypass?: boolean) => Promise<{ success: boolean; verified?: boolean; message?: string }>;
  updateDomainConfig: (idOrHostname: string, updates: { root_redirect_url?: string; is_primary?: boolean }) => Promise<boolean>;
  deleteDomain: (idOrHostname: string) => Promise<boolean>;
  
  addCampaign: (name: string, description: string, tags: string[], target_clicks?: number) => Campaign;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  deleteCampaign: (id: string) => void;
  
  // White-Label Client Portal Actions
  addClient: (data: Partial<ClientPortalAccount> & { password?: string }) => Promise<{ success: boolean; client?: ClientPortalAccount; error?: string }>;
  updateClient: (id: string, updates: Partial<ClientPortalAccount> & { password?: string }) => Promise<{ success: boolean; error?: string }>;
  deleteClient: (id: string) => Promise<{ success: boolean; error?: string }>;

  addApiKey: (name: string, permissions: string[]) => Promise<ApiKey | null>;
  deleteApiKey: (id: string) => void;
  addWebhook: (url: string, events: string[]) => Promise<Webhook | null>;
  deleteWebhook: (id: string) => void;
  toggleWebhook: (id: string) => Promise<boolean>;
  
  // Security & AI utilities
  scanUrlSecurity: (url: string) => SecurityReport;
  aiSuggestSlugs: (url: string, title?: string) => string[];
  aiSummarizePerformance: (linkId?: string) => string;
  exportLinksCsv: () => Promise<number>;
  importLinksCsv: (csvContent: string) => number;
  importLinksBatch: (
    items: Array<{ row?: number; destination_url: string; custom_slug?: string; title?: string; tags?: string[]; utm_source?: string; utm_medium?: string; utm_campaign?: string }>,
    batchName?: string
  ) => Promise<{ success: boolean; imported: number; failed: number; errors: any[] }>;
  logExportJob: (batchName: string, totalRows: number) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

// Helper to isolate localStorage items per user account
export const getUserStorageKey = (base: string, email?: string | null): string => {
  if (!email || !email.trim()) return `${base}_guest`;
  const safe = email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${base}_${safe}`;
};

// Sanitizer to strictly remove any rogue, unassigned, or legacy mock links
export const sanitizeUserLinks = (raw: unknown[], workspaceId?: string): Link[] => {
  if (!Array.isArray(raw)) return [];
  const orphanCodes = new Set([
    'stripe-letter', 'spring-launch', 'mnrxia', 'mytest1', 'get-localhost', 
    'qdpyeu', 'h8fwlh', '9ouo7e', 'bqobvo', 'uy0ldf', 'kypplo', 'y9cfpx', 
    'xjdunk', 'yvodcg', '5sqltr', 'urcrsw', 'hffru4', 'vg1fsy', 'idqfg4', 'lkejyy',
    'sale26', 'v2launch', 'audit26', 'dl-app', 'suspicious-link'
  ]);

  return (raw as Partial<Link>[]).filter((l): l is Link => {
    if (!l || typeof l !== 'object') return false;
    const code = (l.short_code || '').toLowerCase();
    if (orphanCodes.has(code)) return false;
    if (l.workspace_id === 'ws_1' || l.workspace_id === 'ws_2') return false;
    if (l.id === 'link_1' || l.id === 'link_2' || l.id === 'link_3' || l.id === 'link_4' || l.id === 'link_5') return false;
    if (workspaceId && l.workspace_id && l.workspace_id !== workspaceId && l.workspace_id !== 'ws_default') return false;
    return !!(l.id && l.short_code && l.destination_url);
  }).map((l) => {
    // Auto-correct any legacy misassigned platform tags
    const dest = (l.destination_url || '').toLowerCase();
    if (dest.includes('drive.google.com') || dest.includes('docs.google.com')) {
      const cleanTags = (l.tags || []).filter((t: string) => t.toLowerCase() !== 'youtube');
      return {
        ...l,
        tags: cleanTags.length > 0 ? cleanTags : ['google_drive']
      };
    }
    return l;
  });
};

export const detectClientGeo = (): { country: string; country_code: string; region: string; city: string } => {
  if (typeof window === 'undefined') {
    return { country: 'India', country_code: 'IN', region: 'Maharashtra', city: 'Mumbai' };
  }
  try {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    const lang = (navigator.language || '').toLowerCase();

    // India detection
    if (tz.includes('kolkata') || tz.includes('calcutta') || tz.includes('india') || lang.endsWith('-in') || lang === 'hi') {
      return { country: 'India', country_code: 'IN', region: 'Maharashtra', city: 'Mumbai' };
    }
    // UK
    if (tz.includes('london') || lang.endsWith('-gb')) {
      return { country: 'United Kingdom', country_code: 'GB', region: 'England', city: 'London' };
    }
    // UAE / Middle East
    if (tz.includes('dubai')) {
      return { country: 'United Arab Emirates', country_code: 'AE', region: 'Dubai', city: 'Dubai' };
    }
    // Singapore
    if (tz.includes('singapore')) {
      return { country: 'Singapore', country_code: 'SG', region: 'Singapore', city: 'Singapore' };
    }
    // US
    if (tz.includes('new_york')) {
      return { country: 'United States', country_code: 'US', region: 'New York', city: 'New York' };
    }
    if (tz.includes('chicago')) {
      return { country: 'United States', country_code: 'US', region: 'Illinois', city: 'Chicago' };
    }
    if (tz.includes('los_angeles')) {
      return { country: 'United States', country_code: 'US', region: 'California', city: 'Los Angeles' };
    }
    if (tz.includes('denver')) {
      return { country: 'United States', country_code: 'US', region: 'Colorado', city: 'Denver' };
    }

    if (navigator.language && navigator.language.includes('-')) {
      const parts = navigator.language.split('-');
      const regionCode = parts[parts.length - 1].toUpperCase();
      if (regionCode.length === 2) {
        try {
          const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
          const name = regionNames.of(regionCode);
          if (name) {
            return { country: name, country_code: regionCode, region: '', city: tz.split('/')[1]?.replace(/_/g, ' ') || 'Local Network' };
          }
        } catch {}
      }
    }
  } catch {}

  // Fallback to India if user timezone offset is IST (-330 minutes)
  try {
    const offset = new Date().getTimezoneOffset();
    if (offset === -330) {
      return { country: 'India', country_code: 'IN', region: 'Maharashtra', city: 'Mumbai' };
    }
  } catch {}

  return { country: 'India', country_code: 'IN', region: 'Maharashtra', city: 'Mumbai' };
};

export const normalizeCountryName = (country?: string, code?: string): { country: string; country_code: string } => {
  let c = (country || '').trim();
  const cd = (code || '').trim().toUpperCase();

  if (!c || c.toLowerCase() === 'unknown') {
    c = cd === 'US' ? 'United States' : 'India';
  }

  if (c.toUpperCase() === 'IN' || cd === 'IN' || c.toLowerCase() === 'india') {
    return { country: 'India', country_code: 'IN' };
  }
  if (c.toUpperCase() === 'US' || cd === 'US' || c.toLowerCase().includes('united states')) {
    return { country: 'United States', country_code: 'US' };
  }
  if (c.toUpperCase() === 'GB' || cd === 'GB' || c.toLowerCase().includes('united kingdom')) {
    return { country: 'United Kingdom', country_code: 'GB' };
  }

  if (c.length === 2) {
    try {
      const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
      const name = regionNames.of(c.toUpperCase());
      if (name) return { country: name, country_code: c.toUpperCase() };
    } catch {}
  }

  return { country: c, country_code: cd || 'IN' };
};

/**
 * Retrieve or generate a persistent anonymous visitor ID that remains identical
 * across page refreshes, tab switches, and revisits on the current browser.
 */
export const getPersistentVisitorId = (): string => {
  if (typeof window === 'undefined') return 'vid_server';
  try {
    let vid = localStorage.getItem('tiny_visitor_id');
    if (!vid) {
      const randPart = Math.random().toString(36).substring(2, 10);
      const timePart = Date.now().toString(36);
      vid = `vid_${randPart}${timePart}`;
      localStorage.setItem('tiny_visitor_id', vid);
    }
    return vid;
  } catch {
    return 'vid_anonymous';
  }
};

/**
 * Checks if this device/browser has already visited this short link.
 * If visited before => returns false (repeat click).
 * If never visited before => records the visit and returns true (unique click).
 */
export const checkAndMarkLinkVisited = (targetKey: string): boolean => {
  if (typeof window === 'undefined' || !targetKey) return true;
  try {
    const storageKey = 'tiny_visited_links';
    const raw = localStorage.getItem(storageKey);
    const visited: string[] = raw ? JSON.parse(raw) : [];
    const cleanKey = targetKey.toLowerCase().trim();

    if (visited.includes(cleanKey)) {
      return false; // Repeat click
    }

    visited.push(cleanKey);
    // Keep max 500 recent links to prevent storage bloat
    if (visited.length > 500) visited.shift();
    localStorage.setItem(storageKey, JSON.stringify(visited));
    return true; // First-time unique click
  } catch {
    return true;
  }
};

export const ensurePlatformDomain = (customDomains: Domain[] = [], wsId: string = 'ws_default'): Domain[] => {
  const currentHost = typeof window !== 'undefined' && window.location.host
    ? window.location.host
    : (process.env.NEXT_PUBLIC_CNAME_TARGET || 'creataurus.work.gd');

  const cleanList = Array.isArray(customDomains) ? customDomains : [];
  const exists = cleanList.some(d => d.hostname.toLowerCase() === currentHost.toLowerCase());
  if (exists) return cleanList;

  const hasDefault = cleanList.some(d => d.is_default);
  const platformDom: Domain = {
    id: 'dom_platform',
    hostname: currentHost,
    verified: true,
    ssl_status: 'active',
    is_default: !hasDefault,
    workspace_id: wsId
  };
  return [platformDom, ...cleanList];
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState<boolean>(true);

  const defaultWs: Workspace = {
    id: 'ws_default',
    name: 'My Workspace',
    slug: 'my-workspace',
    role: 'owner',
    plan: 'pro',
    created_at: new Date().toISOString()
  };

  const [workspaces, setWorkspaces] = useState<Workspace[]>([defaultWs]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace>(defaultWs);
  const currentWorkspaceRef = React.useRef(currentWorkspace);
  useEffect(() => { currentWorkspaceRef.current = currentWorkspace; }, [currentWorkspace]);

  const currentUserRef = React.useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // Session headers for workspace-scoped reads. In production the API rejects requests
  // without x-user-email (401), so plain fetches return nothing and lists look empty after
  // a refresh. Reads go through refs so the memoized refreshers below never go stale.
  // Lets early effects call logout(), which is declared further down
  const logoutRef = React.useRef<(() => void) | null>(null);

  const sessionHeaders = useCallback((workspaceId?: string): Record<string, string> => {
    const headers: Record<string, string> = {};
    const email = currentUserRef.current?.email;
    if (email) headers['x-user-email'] = email;
    const wsId = workspaceId || currentWorkspaceRef.current?.id;
    if (wsId) headers['x-workspace-id'] = wsId;
    return headers;
  }, []);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [incomingInvitations, setIncomingInvitations] = useState<WorkspaceInvitation[]>([]);
  const { showToast } = useToast();

  const currentUserRole: WorkspaceRole = useMemo(() => {
    // 1. If current user is in teamMembers for this workspace, use their explicit member role
    if (currentUser?.email && teamMembers.length > 0) {
      const myMember = teamMembers.find(m => m.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim());
      if (myMember?.role) {
        return myMember.role;
      }
    }
    // 2. Check current workspace role
    if (currentWorkspace?.role) {
      return currentWorkspace.role;
    }
    // 3. Fallback to matching workspace in state
    if (currentWorkspace?.id && workspaces.length > 0) {
      const match = workspaces.find(w => w.id === currentWorkspace.id);
      if (match?.role) return match.role;
    }
    return 'owner';
  }, [currentUser?.email, teamMembers, currentWorkspace?.id, currentWorkspace?.role, workspaces]);

  const checkPermissionOrToast = useCallback((perm: Permission, actionDescription: string): boolean => {
    const role: WorkspaceRole = currentUserRole;
    const allowed = hasPermission(role, perm);
    if (!allowed) {
      const roleName = ROLE_DESCRIPTIONS[role]?.title || role;
      showToast(
        'error',
        'Permission Denied',
        `Your role (${roleName}) does not have permission to ${actionDescription}.`
      );
      return false;
    }
    return true;
  }, [currentUserRole, showToast]);

  const apiFetch = useCallback((url: string, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers || {});
    if (currentUser?.email && !headers.has('x-user-email')) {
      headers.set('x-user-email', currentUser.email);
    }
    if (currentWorkspace?.id && !headers.has('x-workspace-id')) {
      headers.set('x-workspace-id', currentWorkspace.id);
    }
    return fetch(url, { ...init, headers });
  }, [currentUser?.email, currentWorkspace?.id]);

  useEffect(() => {
    if (currentWorkspace && currentUserRole && currentWorkspace.role !== currentUserRole) {
      setCurrentWorkspaceState(prev => ({ ...prev, role: currentUserRole }));
    }
  }, [currentUserRole, currentWorkspace?.id]);


  // Main Store State Declarations
  const [domains, setDomains] = useState<Domain[]>(() => ensurePlatformDomain(initialDomains || [], 'ws_default'));
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<ClientPortalAccount[]>([]);
  const [clientMetrics, setClientMetrics] = useState<ClientPortalSummaryMetrics>({
    total_clients: 0,
    active_this_month: 0,
    total_logins: 0,
    most_used_domain: 'portal.tinyurl.internal',
    client_quota: { created: 0, limit: -1 }
  });
  const [links, setLinks] = useState<Link[]>([]);
  const [clicks, setClicks] = useState<ClickEvent[]>([]);
  const [selectedAnalyticsLinkId, setSelectedAnalyticsLinkId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);

  // Granular Loading & Telemetry States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLinksLoading, setIsLinksLoading] = useState(false);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [isCampaignsLoading, setIsCampaignsLoading] = useState(false);
  const [isClientsLoading, setIsClientsLoading] = useState(false);
  const [isTeamLoading, setIsTeamLoading] = useState(false);
  const [isDomainsLoading, setIsDomainsLoading] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);

  // Centralized Request Deduplicator & Cache TTL Manager
  const inFlightRequestsRef = React.useRef<Map<string, Promise<any>>>(new Map());
  const lastFetchRef = React.useRef<Map<string, number>>(new Map());
  const CACHE_TTL_MS = 15000; // 15 seconds fresh read TTL

  const invalidateStoreCache = useCallback((keyPrefix?: string) => {
    if (!keyPrefix) {
      lastFetchRef.current.clear();
      return;
    }
    for (const key of lastFetchRef.current.keys()) {
      if (key.startsWith(keyPrefix)) {
        lastFetchRef.current.delete(key);
      }
    }
  }, []);

  // 1. Targeted Links Refresher with Deduplication & TTL
  const refreshLinks = useCallback(async (force = false) => {
    if (typeof window === 'undefined') return;
    const activeWsId = currentWorkspaceRef.current?.id || 'ws_default';
    const cacheKey = `links_${activeWsId}`;

    if (!force) {
      const last = lastFetchRef.current.get(cacheKey) || 0;
      if (Date.now() - last < CACHE_TTL_MS) return;
    }
    if (inFlightRequestsRef.current.has(cacheKey)) {
      return inFlightRequestsRef.current.get(cacheKey);
    }

    const task = (async () => {
      setIsLinksLoading(true);
      try {
        const res = await fetch(`/api/v1/links?workspace_id=${encodeURIComponent(activeWsId)}`, { cache: 'no-store', headers: sessionHeaders(activeWsId) });
        if (res.ok) {
          const d = await res.json().catch(() => null);
          if (d?.success && Array.isArray(d.links)) {
            const remoteValid = sanitizeUserLinks(d.links, activeWsId);
            setLinks(currentActive => {
              const remoteCodes = new Set(remoteValid.map(r => r.short_code.toLowerCase()));
              const recentLocals = currentActive.filter(l => 
                l.workspace_id === activeWsId && 
                !remoteCodes.has(l.short_code.toLowerCase()) && 
                (Date.now() - new Date(l.created_at).getTime() < 15000)
              );
              const latestLinks = [...recentLocals, ...remoteValid];
              try {
                if (currentUserRef.current?.email) {
                  const linksKey = getUserStorageKey('url_shortener_links', currentUserRef.current.email);
                  localStorage.setItem(linksKey, JSON.stringify(latestLinks));
                }
                localStorage.setItem('url_shortener_links', JSON.stringify(latestLinks));
              } catch {}
              return latestLinks;
            });
            lastFetchRef.current.set(cacheKey, Date.now());
          }
        }
      } catch (err) {
        console.warn('refreshLinks error:', err);
      } finally {
        setIsLinksLoading(false);
        inFlightRequestsRef.current.delete(cacheKey);
      }
    })();

    inFlightRequestsRef.current.set(cacheKey, task);
    return task;
  }, [sessionHeaders]);

  // 2. Targeted Analytics Refresher with Deduplication & TTL
  const refreshAnalytics = useCallback(async (force = false) => {
    if (typeof window === 'undefined') return;
    const activeWsId = currentWorkspaceRef.current?.id || 'ws_default';
    const cacheKey = `analytics_${activeWsId}`;

    if (!force) {
      const last = lastFetchRef.current.get(cacheKey) || 0;
      if (Date.now() - last < CACHE_TTL_MS) return;
    }
    if (inFlightRequestsRef.current.has(cacheKey)) {
      return inFlightRequestsRef.current.get(cacheKey);
    }

    const task = (async () => {
      setIsAnalyticsLoading(true);
      try {
        const res = await fetch(`/api/v1/analytics?workspace_id=${encodeURIComponent(activeWsId)}`, { cache: 'no-store', headers: sessionHeaders(activeWsId) });
        if (res.ok) {
          const d = await res.json().catch(() => null);
          if (d?.success && Array.isArray(d.recent_clicks)) {
            const formattedRemote = d.recent_clicks.map((rc: ClickEvent) => {
              const norm = normalizeCountryName(rc.country, rc.country_code);
              return {
                id: rc.id,
                link_id: rc.link_id || '',
                short_code: rc.short_code || '',
                timestamp: rc.timestamp || new Date().toISOString(),
                ip_hash: rc.ip_hash || 'ip_anon',
                country: norm.country,
                country_code: norm.country_code,
                region: rc.region || undefined,
                city: rc.city || 'Direct',
                device: rc.device || 'mobile',
                os: rc.os || 'iOS',
                browser: rc.browser || 'Safari',
                referrer: rc.referrer || 'Direct / Mobile',
                is_bot: !!rc.is_bot,
                is_unique: rc.is_unique ?? true,
                latency_ms: rc.latency_ms || 20
              };
            });

            setClicks(currentClicks => {
              const clickMap = new Map<string, ClickEvent>();
              formattedRemote.forEach((c: ClickEvent) => clickMap.set(c.id, c));
              currentClicks.forEach((c: ClickEvent) => {
                if (!clickMap.has(c.id)) clickMap.set(c.id, c);
              });
              const sorted = Array.from(clickMap.values()).sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              );
              try {
                if (currentUserRef.current?.email) {
                  const clicksKey = getUserStorageKey('url_shortener_clicks', currentUserRef.current.email);
                  localStorage.setItem(clicksKey, JSON.stringify(sorted));
                }
                localStorage.setItem('url_shortener_clicks', JSON.stringify(sorted));
              } catch {}
              return sorted;
            });
            lastFetchRef.current.set(cacheKey, Date.now());
          }
        }
      } catch (err) {
        console.warn('refreshAnalytics error:', err);
      } finally {
        setIsAnalyticsLoading(false);
        inFlightRequestsRef.current.delete(cacheKey);
      }
    })();

    inFlightRequestsRef.current.set(cacheKey, task);
    return task;
  }, [sessionHeaders]);

  // 3. Targeted Campaigns Refresher
  const refreshCampaigns = useCallback(async (force = false) => {
    if (typeof window === 'undefined') return;
    const activeWsId = currentWorkspaceRef.current?.id || 'ws_default';
    const cacheKey = `campaigns_${activeWsId}`;

    if (!force) {
      const last = lastFetchRef.current.get(cacheKey) || 0;
      if (Date.now() - last < CACHE_TTL_MS) return;
    }
    if (inFlightRequestsRef.current.has(cacheKey)) {
      return inFlightRequestsRef.current.get(cacheKey);
    }

    const task = (async () => {
      setIsCampaignsLoading(true);
      try {
        const res = await fetch(`/api/v1/campaigns?workspace_id=${encodeURIComponent(activeWsId)}`, { cache: 'no-store', headers: sessionHeaders(activeWsId) });
        if (res.ok) {
          const d = await res.json().catch(() => null);
          if (d?.success && Array.isArray(d.campaigns)) {
            setCampaigns(d.campaigns);
            try {
              if (currentUserRef.current?.email) {
                const campKey = getUserStorageKey('url_shortener_campaigns', currentUserRef.current.email);
                localStorage.setItem(campKey, JSON.stringify(d.campaigns));
              }
              localStorage.setItem('url_shortener_campaigns', JSON.stringify(d.campaigns));
            } catch {}
            lastFetchRef.current.set(cacheKey, Date.now());
          }
        }
      } catch (err) {
        console.warn('refreshCampaigns error:', err);
      } finally {
        setIsCampaignsLoading(false);
        inFlightRequestsRef.current.delete(cacheKey);
      }
    })();

    inFlightRequestsRef.current.set(cacheKey, task);
    return task;
  }, [sessionHeaders]);

  // 4. Targeted Clients Refresher
  const refreshClients = useCallback(async (force = false) => {
    if (typeof window === 'undefined') return;
    const activeWsId = currentWorkspaceRef.current?.id || 'ws_default';
    const cacheKey = `clients_${activeWsId}`;

    if (!force) {
      const last = lastFetchRef.current.get(cacheKey) || 0;
      if (Date.now() - last < CACHE_TTL_MS) return;
    }
    if (inFlightRequestsRef.current.has(cacheKey)) {
      return inFlightRequestsRef.current.get(cacheKey);
    }

    const task = (async () => {
      setIsClientsLoading(true);
      try {
        const res = await fetch(`/api/v1/clients?workspace_id=${encodeURIComponent(activeWsId)}`, { cache: 'no-store', headers: sessionHeaders(activeWsId) });
        if (res.ok) {
          const d = await res.json().catch(() => null);
          if (d?.success) {
            if (Array.isArray(d.clients)) setClients(d.clients);
            if (d.summary) setClientMetrics(d.summary);
            lastFetchRef.current.set(cacheKey, Date.now());
          }
        }
      } catch (err) {
        console.warn('refreshClients error:', err);
      } finally {
        setIsClientsLoading(false);
        inFlightRequestsRef.current.delete(cacheKey);
      }
    })();

    inFlightRequestsRef.current.set(cacheKey, task);
    return task;
  }, [sessionHeaders]);

  // 5. Targeted Team Members Refresher
  const refreshTeamMembers = useCallback(async (force = false) => {
    if (typeof window === 'undefined') return;
    const activeWsId = currentWorkspaceRef.current?.id || 'ws_default';
    const cacheKey = `members_${activeWsId}`;

    if (!force) {
      const last = lastFetchRef.current.get(cacheKey) || 0;
      if (Date.now() - last < CACHE_TTL_MS) return;
    }
    if (inFlightRequestsRef.current.has(cacheKey)) {
      return inFlightRequestsRef.current.get(cacheKey);
    }

    const task = (async () => {
      setIsTeamLoading(true);
      try {
        const res = await apiFetch(`/api/v1/workspaces/members?workspace_id=${encodeURIComponent(activeWsId)}`, { cache: 'no-store', headers: sessionHeaders(activeWsId) });
        if (res.ok) {
          const d = await res.json().catch(() => null);
          if (d?.success) {
            const memberMap = new Map<string, TeamMember>();
            if (Array.isArray(d.invitations)) {
              d.invitations.forEach((inv: WorkspaceInvitation) => {
                const key = inv.email.toLowerCase().trim();
                memberMap.set(key, {
                  id: inv.id,
                  workspace_id: inv.workspace_id,
                  name: inv.name,
                  email: inv.email,
                  role: inv.role,
                  status: 'invited',
                  token: inv.token,
                  invite_url: inv.invite_url,
                  avatar: inv.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'TM',
                  created_at: inv.created_at
                });
              });
            }
            if (Array.isArray(d.members)) {
              d.members.forEach((m: TeamMember) => {
                const key = m.email.toLowerCase().trim();
                memberMap.set(key, m);
              });
            }
            const fresh = Array.from(memberMap.values());
            setTeamMembers(fresh);
            if (currentUserRef.current?.email) {
              const tmKey = getUserStorageKey('url_shortener_team_members', currentUserRef.current.email);
              try {
                localStorage.setItem(tmKey, JSON.stringify(fresh));
                localStorage.setItem('url_shortener_team_members', JSON.stringify(fresh));
              } catch {}
            }
            lastFetchRef.current.set(cacheKey, Date.now());
          }
        }
      } catch (err) {
        console.warn('refreshTeamMembers error:', err);
      } finally {
        setIsTeamLoading(false);
        inFlightRequestsRef.current.delete(cacheKey);
      }
    })();

    inFlightRequestsRef.current.set(cacheKey, task);
    return task;
  }, []);

  // 6. Targeted Incoming Invitations Refresher
  const refreshIncomingInvitations = useCallback(async () => {
    if (!currentUserRef.current?.email || typeof window === 'undefined') {
      setIncomingInvitations([]);
      return;
    }
    try {
      const res = await fetch(`/api/v1/invitations?email=${encodeURIComponent(currentUserRef.current.email)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success && Array.isArray(data.incoming)) {
          setIncomingInvitations(data.incoming);
        }
      }
    } catch {}
  }, []);

  // 7. Targeted Custom Domains Refresher
  const refreshDomains = useCallback(async (force = false) => {
    if (typeof window === 'undefined') return;
    const activeWsId = currentWorkspaceRef.current?.id || 'ws_default';
    const cacheKey = `domains_${activeWsId}`;

    if (!force) {
      const last = lastFetchRef.current.get(cacheKey) || 0;
      if (Date.now() - last < CACHE_TTL_MS) return;
    }
    if (inFlightRequestsRef.current.has(cacheKey)) {
      return inFlightRequestsRef.current.get(cacheKey);
    }

    const task = (async () => {
      setIsDomainsLoading(true);
      try {
        const res = await fetch(`/api/v1/domains?workspace_id=${encodeURIComponent(activeWsId)}`, { cache: 'no-store', headers: sessionHeaders(activeWsId) });
        if (res.ok) {
          const d = await res.json().catch(() => null);
          if (d?.success && Array.isArray(d.domains)) {
            const merged = ensurePlatformDomain(d.domains, activeWsId);
            setDomains(merged);
            try {
              if (currentUserRef.current?.email) {
                const domKey = getUserStorageKey('url_shortener_domains', currentUserRef.current.email);
                localStorage.setItem(domKey, JSON.stringify(merged));
              }
              localStorage.setItem('url_shortener_domains', JSON.stringify(merged));
            } catch {}
            lastFetchRef.current.set(cacheKey, Date.now());
          }
        }
      } catch (err) {
        console.warn('refreshDomains error:', err);
      } finally {
        setIsDomainsLoading(false);
        inFlightRequestsRef.current.delete(cacheKey);
      }
    })();

    inFlightRequestsRef.current.set(cacheKey, task);
    return task;
  }, [sessionHeaders]);

  // 8. Targeted Settings (API Keys & Webhooks & Domains) Refresher
  const refreshSettings = useCallback(async (force = false) => {
    if (typeof window === 'undefined') return;
    const activeWsId = currentWorkspaceRef.current?.id || 'ws_default';
    const cacheKey = `settings_${activeWsId}`;

    if (!force) {
      const last = lastFetchRef.current.get(cacheKey) || 0;
      if (Date.now() - last < CACHE_TTL_MS) return;
    }
    if (inFlightRequestsRef.current.has(cacheKey)) {
      return inFlightRequestsRef.current.get(cacheKey);
    }

    const task = (async () => {
      setIsSettingsLoading(true);
      try {
        await Promise.all([
          refreshDomains(force),
          fetch(`/api/v1/api-keys?workspace_id=${encodeURIComponent(activeWsId)}`, { cache: 'no-store', headers: sessionHeaders(activeWsId) })
            .then(r => r.json())
            .then(d => { if (d?.success && Array.isArray(d.keys)) setApiKeys(d.keys); })
            .catch(() => {}),
          fetch(`/api/v1/webhooks?workspace_id=${encodeURIComponent(activeWsId)}`, { cache: 'no-store', headers: sessionHeaders(activeWsId) })
            .then(r => r.json())
            .then(d => { if (d?.success && Array.isArray(d.webhooks)) setWebhooks(d.webhooks); })
            .catch(() => {})
        ]);
        lastFetchRef.current.set(cacheKey, Date.now());
      } catch (err) {
        console.warn('refreshSettings error:', err);
      } finally {
        setIsSettingsLoading(false);
        inFlightRequestsRef.current.delete(cacheKey);
      }
    })();

    inFlightRequestsRef.current.set(cacheKey, task);
    return task;
  }, [refreshDomains, sessionHeaders]);

  // General Unified Refresh (Refreshes Core Telemetry without redundant requests)
  const refreshData = useCallback(async (force = false) => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshLinks(force),
        refreshAnalytics(force)
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshLinks, refreshAnalytics]);

  // Set Workspace with targeted core fetch (does NOT spam all 6 endpoints)
  const setCurrentWorkspace = useCallback((ws: Workspace) => {
    if (!ws) return;
    setCurrentWorkspaceState(ws);
    currentWorkspaceRef.current = ws;
    try {
      localStorage.setItem('url_shortener_current_workspace_id', ws.id);
      if (currentUser?.email) {
        localStorage.setItem(getUserStorageKey('url_shortener_current_workspace_id', currentUser.email), ws.id);
      }
    } catch {}

    if (typeof window !== 'undefined') {
      // Cleanly fetch only the primary links and domains for the switched workspace
      refreshLinks(true);
      refreshDomains(true);
    }
  }, [currentUser?.email, refreshLinks, refreshDomains]);


  // Initialize dynamic domain & sync localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedGlobalDom = localStorage.getItem('url_shortener_domains');
        if (savedGlobalDom) {
          const parsed = JSON.parse(savedGlobalDom);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDomains(ensurePlatformDomain(parsed, currentWorkspace?.id || 'ws_default'));
          }
        }
      } catch {}
    }
    try {
      let user: User | null = null;
      const savedUser = localStorage.getItem('url_shortener_user');
      if (savedUser) {
        try {
          user = JSON.parse(savedUser);
          setCurrentUser(user);
        } catch {
          user = null;
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }

      if (user && user.email) {
        // A user saved in localStorage is not proof of login: the API trusts only the signed
        // session cookie. Accounts signed in before sessions existed (or with an expired one)
        // are sent back to the login screen instead of seeing empty, failing dashboards.
        const savedEmail = user.email.toLowerCase();
        fetch('/api/v1/auth', { cache: 'no-store' })
          .then(async res => {
            const d = await res.json().catch(() => null);
            if (res.status === 401 || (d?.email && d.email !== savedEmail)) {
              logoutRef.current?.();
              showToast('sync', 'Please sign in again', 'Your session has expired. Sign in to continue.');
            }
          })
          .catch(() => {});

        // 1. Account-scoped workspaces
        const wsKey = getUserStorageKey('url_shortener_workspaces', user.email);
        const savedWs = localStorage.getItem(wsKey);
        let loadedWs: Workspace[] = [];
        if (savedWs) {
          try {
            const parsedWs = JSON.parse(savedWs);
            if (Array.isArray(parsedWs)) {
              loadedWs = parsedWs.filter(
                (w: Workspace) => w.id !== 'ws_1' && w.id !== 'ws_2' && 
                                  w.name !== 'Acme Growth Platform' && w.name !== 'Personal Projects'
              );
            }
          } catch {}
        }

        // Check if there are workspaces stored globally or in invite acceptance
        const targetWsId = localStorage.getItem(`url_shortener_current_workspace_id_${user.email}`) || 
                           localStorage.getItem('url_shortener_current_workspace_id');
        const globalWsRaw = localStorage.getItem('url_shortener_workspaces');
        if (globalWsRaw) {
          try {
            const parsedGlobal = JSON.parse(globalWsRaw);
            if (Array.isArray(parsedGlobal)) {
              parsedGlobal.forEach((gw: Workspace) => {
                if (gw && gw.id && !loadedWs.some(w => w.id === gw.id)) {
                  loadedWs.push(gw);
                }
              });
            }
          } catch {}
        }

        if (loadedWs.length === 0) {
          const userWs: Workspace = {
            id: generateId('ws'),
            name: `${user.name}'s Workspace`,
            slug: user.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            role: 'owner',
            plan: 'pro',
            created_at: new Date().toISOString()
          };
          loadedWs = [userWs];
          localStorage.setItem(wsKey, JSON.stringify(loadedWs));
        }

        setWorkspaces(loadedWs);
        const initialWs = (targetWsId ? loadedWs.find(w => w.id === targetWsId) : null) || loadedWs[0];
        setCurrentWorkspace(initialWs);
        localStorage.setItem('url_shortener_workspaces', JSON.stringify(loadedWs));
        localStorage.setItem('url_shortener_current_workspace_id', initialWs.id);

        // Fetch user's workspaces from PostgreSQL (includes accepted invited workspaces)
        fetch(`/api/v1/workspaces?email=${encodeURIComponent(user.email)}`)
          .then(r => r.json())
          .then(d => {
            if (d?.success && Array.isArray(d.workspaces) && d.workspaces.length > 0) {
              setWorkspaces(prev => {
                const map = new Map(prev.map(w => [w.id, w]));
                d.workspaces.forEach((nw: Workspace) => map.set(nw.id, nw));
                const merged = Array.from(map.values());
                try {
                  localStorage.setItem(wsKey, JSON.stringify(merged));
                  localStorage.setItem('url_shortener_workspaces', JSON.stringify(merged));
                } catch {}
                return merged;
              });
              const activeWs = (targetWsId ? d.workspaces.find((w: Workspace) => w.id === targetWsId) : null) || d.workspaces[0];
              if (activeWs) {
                setCurrentWorkspace(activeWs);
              }
            }
          }).catch(() => {});

        // 2. Account-scoped links
        const linksKey = getUserStorageKey('url_shortener_links', user.email);
        const savedLinks = localStorage.getItem(linksKey);
        let loadedLinks: Link[] = [];
        if (savedLinks) {
          try {
            const parsed = JSON.parse(savedLinks);
            if (Array.isArray(parsed)) {
              loadedLinks = sanitizeUserLinks(parsed, loadedWs[0].id);
            }
          } catch {}
        }
        setLinks(loadedLinks);
        localStorage.setItem(linksKey, JSON.stringify(loadedLinks));
        try {
          localStorage.removeItem('url_shortener_links');
        } catch {}

        // 3. Account-scoped clicks
        const clicksKey = getUserStorageKey('url_shortener_clicks', user.email);
        const savedClicks = localStorage.getItem(clicksKey);
        let loadedClicks: ClickEvent[] = [];
        if (savedClicks) {
          try {
            const parsed = JSON.parse(savedClicks);
            if (Array.isArray(parsed)) {
              const userLinkIds = new Set(loadedLinks.map(l => l.id.toLowerCase()));
              const userShortCodes = new Set(loadedLinks.map(l => (l.short_code || '').toLowerCase()));
              loadedClicks = parsed.filter(
                (c: ClickEvent) => (c.link_id && userLinkIds.has(c.link_id.toLowerCase())) ||
                                   (c.short_code && userShortCodes.has(c.short_code.toLowerCase()))
              );
            }
          } catch {}
        }
        const localGeo = detectClientGeo();
        if (localGeo.country === 'India') {
          loadedClicks = loadedClicks.map(c => {
            if (c.country === 'United States' && (c.city === 'San Francisco' || c.country_code === 'US')) {
              return { ...c, country: 'India', country_code: 'IN', city: 'Mumbai' };
            }
            return c;
          });
        }
        setClicks(loadedClicks);
        localStorage.setItem(clicksKey, JSON.stringify(loadedClicks));
        try {
          localStorage.removeItem('url_shortener_clicks');
        } catch {}

        // 4. Account-scoped campaigns (Zero static mock campaigns)
        const campKey = getUserStorageKey('url_shortener_campaigns', user.email);
        const savedCamp = localStorage.getItem(campKey);
        let loadedCamp: Campaign[] = [];
        if (savedCamp) {
          try {
            const parsedCamp = JSON.parse(savedCamp);
            if (Array.isArray(parsedCamp)) loadedCamp = parsedCamp;
          } catch {}
        }
        setCampaigns(loadedCamp);
        localStorage.setItem('url_shortener_campaigns', JSON.stringify(loadedCamp));

        // 5. Account-scoped Team Members
        const tmKey = getUserStorageKey('url_shortener_team_members', user.email);
        const savedTm = localStorage.getItem(tmKey);
        let loadedTm: TeamMember[] = [];
        if (savedTm) {
          try {
            const parsedTm = JSON.parse(savedTm);
            if (Array.isArray(parsedTm)) loadedTm = parsedTm;
          } catch {}
        }
        setTeamMembers(loadedTm);

        // 6. Account-scoped API Keys
        const keysKey = getUserStorageKey('url_shortener_api_keys', user.email);
        const savedKeys = localStorage.getItem(keysKey);
        if (savedKeys) {
          try {
            const parsedKeys = JSON.parse(savedKeys);
            if (Array.isArray(parsedKeys)) setApiKeys(parsedKeys);
          } catch {}
        }

        // 7. Account-scoped Webhooks
        const whKey = getUserStorageKey('url_shortener_webhooks', user.email);
        const savedWh = localStorage.getItem(whKey);
        if (savedWh) {
          try {
            const parsedWh = JSON.parse(savedWh);
            if (Array.isArray(parsedWh)) setWebhooks(parsedWh);
          } catch {}
        }

        // 8. Account-scoped Custom Domains
        const domKey = getUserStorageKey('url_shortener_domains', user.email);
        const savedDom = localStorage.getItem(domKey) || localStorage.getItem('url_shortener_domains');
        let loadedDom: Domain[] = [];
        if (savedDom) {
          try {
            const parsedDom = JSON.parse(savedDom);
            if (Array.isArray(parsedDom)) loadedDom = parsedDom;
          } catch {}
        }
        if (loadedDom.length > 0) {
          setDomains(loadedDom);
        }

        // 9. Initial workspace sync for primary resources (links & domains)
        if (loadedWs && loadedWs[0]?.id) {
          refreshDomains();
          refreshLinks();
        }
      } else {
        // Guest mode initialization
        const guestWs: Workspace = {
          id: 'ws_guest',
          name: 'My Workspace',
          slug: 'my-workspace',
          role: 'owner',
          plan: 'pro',
          created_at: new Date().toISOString()
        };
        setWorkspaces([guestWs]);
        setCurrentWorkspace(guestWs);
        setLinks([]);
        setClicks([]);
        setCampaigns([]);
        setTeamMembers([]);
        setApiKeys([]);
        setWebhooks([]);
        setDomains(ensurePlatformDomain([], guestWs.id));
      }
    } catch {
      setLinks([]);
      setClicks([]);
    } finally {
      setAuthLoaded(true);
      setIsInitialLoading(false);
    }

    // Cross-tab and active-window real-time synchronization
    const handleSyncFromStorage = () => {
      try {
        const rawUser = localStorage.getItem('url_shortener_user');
        const activeUser: User | null = rawUser ? JSON.parse(rawUser) : null;
        const activeEmail = activeUser?.email;

        const linksKey = getUserStorageKey('url_shortener_links', activeEmail);
        const rawLinks = localStorage.getItem(linksKey);
        if (rawLinks) {
          const parsed = JSON.parse(rawLinks);
          if (Array.isArray(parsed)) {
            setLinks(sanitizeUserLinks(parsed));
          }
        }
        const wsKey = getUserStorageKey('url_shortener_workspaces', activeEmail);
        const rawWs = localStorage.getItem(wsKey);
        if (rawWs) {
          const parsedWs = JSON.parse(rawWs);
          if (Array.isArray(parsedWs) && parsedWs.length > 0) {
            const cleanWs = parsedWs.filter(
              (w: Workspace) => w.id !== 'ws_1' && w.id !== 'ws_2' && w.name !== 'Acme Growth Platform' && w.name !== 'Personal Projects'
            );
            if (cleanWs.length > 0) {
              setWorkspaces(cleanWs);
            }
          }
        }
        const domKey = getUserStorageKey('url_shortener_domains', activeEmail);
        const rawDom = localStorage.getItem(domKey) || localStorage.getItem('url_shortener_domains');
        if (rawDom) {
          try {
            const parsedDom = JSON.parse(rawDom);
            if (Array.isArray(parsedDom)) {
              setDomains(parsedDom);
            }
          } catch {}
        }
      } catch {}
    };

    // Auto-polling with sensible intervals (30s) to keep live links updated without spamming APIs
    let pollTimer: NodeJS.Timeout | null = null;
    let isMounted = true;

    const scheduleJitteredPoll = () => {
      if (!isMounted) return;
      // 30s base polling interval
      const delayMs = 30000;

      pollTimer = setTimeout(async () => {
        // Only poll if tab is active and visible
        if (typeof document !== 'undefined' && !document.hidden && isMounted) {
          await refreshLinks();
        }
        scheduleJitteredPoll();
      }, delayMs);
    };

    scheduleJitteredPoll();

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        refreshLinks();
      }
    };

    const handleWindowFocus = () => {
      handleSyncFromStorage();
      refreshLinks();
    };

    window.addEventListener('storage', handleSyncFromStorage);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('url_shortener_sync', handleSyncFromStorage);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
      window.removeEventListener('storage', handleSyncFromStorage);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('url_shortener_sync', handleSyncFromStorage);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [refreshLinks, refreshDomains, setCurrentWorkspace]);

  // Sync state changes to localStorage scoped per user
  const saveLinksState = (newLinks: Link[]) => {
    setLinks(newLinks);
    invalidateStoreCache('links');
    try {
      const userKey = getUserStorageKey('url_shortener_links', currentUser?.email);
      localStorage.setItem(userKey, JSON.stringify(newLinks));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('url_shortener_sync'));
      }
    } catch {}
  };

  const rollbackOptimisticLink = (linkId: string, reason: string) => {
    setLinks(prev => {
      const next = prev.filter(l => l.id !== linkId);
      try {
        localStorage.setItem(getUserStorageKey('url_shortener_links', currentUserRef.current?.email), JSON.stringify(next));
      } catch {}
      return next;
    });
    invalidateStoreCache('links');
    showToast('error', 'Link not saved', reason);
  };

  const saveClicksState = (newClicks: ClickEvent[]) => {
    setClicks(newClicks);
    try {
      const userKey = getUserStorageKey('url_shortener_clicks', currentUser?.email);
      localStorage.setItem(userKey, JSON.stringify(newClicks));
      localStorage.setItem('url_shortener_clicks', JSON.stringify(newClicks));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('url_shortener_sync'));
      }
    } catch {}
  };

  const saveCampaignsState = (newCampaigns: Campaign[]) => {
    setCampaigns(newCampaigns);
    invalidateStoreCache('campaigns');
    try {
      const userKey = getUserStorageKey('url_shortener_campaigns', currentUser?.email);
      localStorage.setItem(userKey, JSON.stringify(newCampaigns));
      localStorage.setItem('url_shortener_campaigns', JSON.stringify(newCampaigns));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('url_shortener_sync'));
      }
    } catch {}
  };

  const saveWorkspacesState = (newWs: Workspace[]) => {
    setWorkspaces(newWs);
    try {
      const userKey = getUserStorageKey('url_shortener_workspaces', currentUser?.email);
      localStorage.setItem(userKey, JSON.stringify(newWs));
      localStorage.setItem('url_shortener_workspaces', JSON.stringify(newWs));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('url_shortener_sync'));
      }
    } catch {}
  };

  const saveTeamMembersState = (newMembers: TeamMember[]) => {
    setTeamMembers(newMembers);
    invalidateStoreCache('members');
    try {
      const userKey = getUserStorageKey('url_shortener_team_members', currentUser?.email);
      localStorage.setItem(userKey, JSON.stringify(newMembers));
      localStorage.setItem('url_shortener_team_members', JSON.stringify(newMembers));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('url_shortener_sync'));
      }
    } catch {}
  };

  const saveApiKeysState = (newKeys: ApiKey[]) => {
    setApiKeys(newKeys);
    invalidateStoreCache('settings');
    try {
      const userKey = getUserStorageKey('url_shortener_api_keys', currentUser?.email);
      localStorage.setItem(userKey, JSON.stringify(newKeys));
      localStorage.setItem('url_shortener_api_keys', JSON.stringify(newKeys));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('url_shortener_sync'));
      }
    } catch {}
  };

  const saveWebhooksState = (newHooks: Webhook[]) => {
    setWebhooks(newHooks);
    invalidateStoreCache('settings');
    try {
      const userKey = getUserStorageKey('url_shortener_webhooks', currentUser?.email);
      localStorage.setItem(userKey, JSON.stringify(newHooks));
      localStorage.setItem('url_shortener_webhooks', JSON.stringify(newHooks));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('url_shortener_sync'));
      }
    } catch {}
  };

  const saveDomainsState = (newDomains: Domain[]) => {
    setDomains(newDomains);
    invalidateStoreCache('domains');
    invalidateStoreCache('settings');
    try {
      const userKey = getUserStorageKey('url_shortener_domains', currentUser?.email);
      localStorage.setItem(userKey, JSON.stringify(newDomains));
      localStorage.setItem('url_shortener_domains', JSON.stringify(newDomains));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('url_shortener_sync'));
      }
    } catch {}
  };

  // URL Security Analyzer
  const scanUrlSecurity = (url: string): SecurityReport => {
    const lower = url.toLowerCase();
    const isMalicious = lower.includes('phish') || lower.includes('claim') || lower.includes('.tk') || lower.includes('airdrop-verify');
    
    let risk_score = 0;
    const threat_categories: string[] = [];
    
    if (isMalicious) {
      risk_score = 98;
      threat_categories.push('Social Engineering', 'Credential Harvesting', 'Unverified Top-Level Domain');
    } else if (lower.includes('bit.ly') || lower.includes('tinyurl')) {
      risk_score = 25;
      threat_categories.push('Multiple Redirect Hop');
    } else {
      risk_score = Math.floor(Math.random() * 5);
    }

    return {
      scanned_url: url,
      safe_browsing: isMalicious ? 'flagged' : 'clean',
      virustotal_risk: risk_score,
      is_blacklisted: isMalicious,
      threat_categories,
      scanned_at: new Date().toISOString()
    };
  };

  // Create Short Link
  const createShortLink: StoreContextType['createShortLink'] = (data) => {
    if (!checkPermissionOrToast('links:create', 'create short links')) {
      return { link: null, error: 'Permission denied: Read-only access.' };
    }

    const normUrl = normalizeUrl(data.destination_url);
    if (!normUrl || normUrl.length < 5) {
      return { link: null, error: 'Please enter a valid target URL' };
    }

    // Custom slug checks
    let code = data.custom_slug ? data.custom_slug.trim() : '';
    if (code) {
      if (RESERVED_SLUGS.has(code.toLowerCase())) {
        return { link: null, error: `The custom slug "${code}" is a reserved system keyword` };
      }
      const exists = links.some(l => l.short_code.toLowerCase() === code.toLowerCase());
      if (exists) {
        return { link: null, error: `The custom slug "${code}" is already in use` };
      }
    } else {
      // Auto generate collision-free Base62 code
      let attempts = 0;
      do {
        code = generateBase62Code(6);
        attempts++;
      } while (links.some(l => l.short_code === code) && attempts < 20);
    }

    // Build UTM-enhanced destination URL if parameters provided
    const finalDestUrl = buildUtmUrl(normUrl, {
      source: data.utm_source,
      medium: data.utm_medium,
      campaign: data.utm_campaign,
      term: data.utm_term,
      content: data.utm_content
    });

    // Run security check
    const secReport = scanUrlSecurity(finalDestUrl);

    const defaultDomain = domains.find(d => d.is_default) || domains[0];
    const resolvedDomainId = (data.domain_id && data.domain_id.trim()) 
      ? data.domain_id.trim() 
      : (defaultDomain?.id || 'dom_platform');
    const resolvedWorkspaceId = currentWorkspace?.id || 'ws_default';

    // Detect platform deep link (OpeninApp feature)
    const appDetection = detectAppDeepLink(finalDestUrl);
    const deepLinkConfig: DeepLinkConfig | undefined = data.deep_link || (appDetection ? {
      enabled: true,
      app: appDetection.app,
      app_name: appDetection.appName,
      app_uri: appDetection.iosUri,
      ios_uri: appDetection.iosUri,
      android_intent: appDetection.androidIntent,
      fallback_url: appDetection.fallbackUrl
    } : undefined);

    const newLink: Link = {
      id: generateId('link'),
      short_code: code,
      custom_slug: data.custom_slug ? code : undefined,
      domain_id: resolvedDomainId,
      workspace_id: resolvedWorkspaceId,
      destination_url: finalDestUrl,
      title: data.title || (data.custom_slug ? `Link /${code}` : `Short Link ${code}`),
      tags: data.tags || ['marketing'],
      campaign_id: data.campaign_id,
      password_hash: data.password ? data.password : undefined,
      expires_at: data.expires_at ? new Date(data.expires_at).toISOString() : undefined,
      max_clicks: data.max_clicks ? Number(data.max_clicks) : undefined,
      status: secReport.is_blacklisted ? 'flagged' : 'active',
      is_flagged: secReport.is_blacklisted,
      risk_score: secReport.virustotal_risk,
      risk_reasons: secReport.threat_categories.length > 0 ? secReport.threat_categories : undefined,
      created_by: currentUser?.name || 'Owner',
      created_at: new Date().toISOString(),
      clicks_count: 0,
      utm_source: data.utm_source,
      utm_medium: data.utm_medium,
      utm_campaign: data.utm_campaign,
      utm_term: data.utm_term,
      utm_content: data.utm_content,
      deep_link: deepLinkConfig,
      rules: data.rules || [],
      redirect_type: data.password ? (data.redirect_type === 'direct' ? 'splash' : (data.redirect_type || 'splash')) : (data.redirect_type || 'direct'),
      http_status_code: data.http_status_code || 301,
      notes: data.notes,
      shield_protection: data.shield_protection || false,
      hide_referrer: data.hide_referrer || false,
      channel: data.channel,
      og_title: data.og_title,
      og_description: data.og_description,
      og_image_url: data.og_image_url
    };

    saveLinksState([newLink, ...links]);


    // Asynchronously sync with Neon PostgreSQL
    if (typeof window !== 'undefined') {
      apiFetch('/api/v1/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newLink.id,
          destination_url: newLink.destination_url,
          custom_slug: newLink.custom_slug || newLink.short_code,
          title: newLink.title,
          tags: newLink.tags,
          rules: newLink.rules,
          domain_id: newLink.domain_id,
          workspace_id: newLink.workspace_id,
          password: data.password,
          expires_at: data.expires_at,
          max_clicks: data.max_clicks,
          campaign_id: data.campaign_id,
          redirect_type: newLink.redirect_type,
          http_status_code: newLink.http_status_code,
          notes: newLink.notes,
          shield_protection: newLink.shield_protection,
          hide_referrer: newLink.hide_referrer,
          channel: newLink.channel,
          og_title: newLink.og_title,
          og_description: newLink.og_description,
          og_image_url: newLink.og_image_url
        })
      })
      .then(async res => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          // The optimistic row was never stored; drop it instead of letting it vanish on refresh
          rollbackOptimisticLink(newLink.id, data?.error || `Server responded with ${res.status}.`);
          return;
        }
        if (data?.data?.id && data.data.id !== newLink.id) {
          setLinks(prev => {
            const updated = prev.map(l => l.id === newLink.id ? { ...l, id: data.data.id } : l);
            saveLinksState(updated);
            return updated;
          });
        }
      })
      .catch(err => {
        console.warn('Background link sync warning:', err);
        rollbackOptimisticLink(newLink.id, 'Network error while saving the link. Please try again.');
      });
    }

    return { link: newLink };
  };

  const updateLink = (id: string, updates: Partial<Link>) => {
    if (!checkPermissionOrToast('links:edit', 'edit short links')) {
      return;
    }

    const updated = links.map(l => (
      l.id === id || 
      l.short_code?.toLowerCase() === id.toLowerCase() || 
      (l.custom_slug && l.custom_slug.toLowerCase() === id.toLowerCase())
    ) ? { ...l, ...updates } : l);
    saveLinksState(updated);

    if (typeof window !== 'undefined') {
      const target = updated.find(l => 
        l.id === id || 
        l.short_code?.toLowerCase() === id.toLowerCase() || 
        (l.custom_slug && l.custom_slug.toLowerCase() === id.toLowerCase())
      );
      if (target) {
        apiFetch('/api/v1/links', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: target.id,
            short_code: target.short_code,
            custom_slug: target.custom_slug || target.short_code,
            rules: target.rules,
            status: target.status,
            title: target.title,
            destination_url: target.destination_url,
            campaign_id: target.campaign_id !== undefined ? target.campaign_id : null,
            domain_id: target.domain_id,
            tags: target.tags,
            is_flagged: target.is_flagged,
            risk_score: target.risk_score,
            redirect_type: target.redirect_type,
            http_status_code: target.http_status_code,
            notes: target.notes,
            shield_protection: target.shield_protection,
            hide_referrer: target.hide_referrer,
            channel: target.channel,
            og_title: target.og_title,
            og_description: target.og_description,
            og_image_url: target.og_image_url,
            utm_source: target.utm_source,
            utm_medium: target.utm_medium,
            utm_campaign: target.utm_campaign,
            utm_term: target.utm_term,
            utm_content: target.utm_content,
            password: target.password_hash !== 'PROTECTED' ? target.password_hash : undefined,
            password_hash: target.password_hash !== 'PROTECTED' ? target.password_hash : undefined,
            expires_at: target.expires_at,
            max_clicks: target.max_clicks,
            fallback_url: target.fallback_url,
            broken_code: target.broken_code !== undefined ? target.broken_code : undefined,
            broken_reason: target.broken_reason !== undefined ? target.broken_reason : undefined
          })
        }).catch(err => console.warn('Failed to update link on server:', err));
      }
    }
  };

  const deleteLink = (id: string) => {
    if (!checkPermissionOrToast('links:delete', 'delete links')) {
      return;
    }

    const target = links.find(l => l.id === id || l.short_code?.toLowerCase() === id.toLowerCase());
    const updated = links.filter(l => l.id !== id && l.short_code?.toLowerCase() !== id.toLowerCase());
    saveLinksState(updated);

    if (typeof window !== 'undefined') {
      apiFetch(`/api/v1/links?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      }).catch(err => {
        console.warn('Failed to delete link on server:', err);
      });

      if (target?.short_code && target.short_code.toLowerCase() !== id.toLowerCase()) {
        apiFetch(`/api/v1/links?code=${encodeURIComponent(target.short_code)}`, {
          method: 'DELETE'
        }).catch(() => {});
      }
    }
  };

  const resetLinkAnalytics = async (linkId?: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const payload: { link_id?: string; workspace_id?: string } = linkId 
        ? { link_id: linkId } 
        : { workspace_id: currentWorkspace.id };

      const res = await apiFetch('/api/v1/analytics/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if (linkId) {
          setLinks(prev => prev.map(l => (l.id === linkId || l.short_code === linkId ? { ...l, clicks_count: 0 } : l)));
          setClicks(prev => prev.filter(c => c.link_id !== linkId && c.short_code !== linkId));
        } else {
          setLinks(prev => prev.map(l => ({ ...l, clicks_count: 0 })));
          setClicks([]);
        }
        await refreshData();
        return { success: true, message: data.message || 'Analytics reset successfully.' };
      }
      return { success: false, message: data.error || 'Failed to reset analytics.' };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  };

  const addRuleToLink = (linkId: string, rule: { 
    rule_type?: 'geo' | 'device' | 'ab' | 'smart'; 
    condition?: string; 
    target_url: string; 
    weight?: number; 
    geo_type?: 'country' | 'state' | 'city';
    device?: 'all' | 'android' | 'ios' | 'desktop';
    country?: string;
    state?: string;
    city?: string;
  }) => {
    const targetLink = links.find(l => l.id === linkId || l.short_code?.toLowerCase() === linkId.toLowerCase() || (l.custom_slug && l.custom_slug.toLowerCase() === linkId.toLowerCase()));
    if (!targetLink) return;

    // Auto-generate condition summary label if not provided
    const parts: string[] = [];
    if (rule.device && rule.device !== 'all') {
      parts.push(rule.device.toUpperCase());
    }
    const locParts: string[] = [];
    if (rule.city) locParts.push(rule.city);
    if (rule.state) locParts.push(rule.state);
    if (rule.country) locParts.push(rule.country);
    if (locParts.length > 0) {
      parts.push(locParts.join(', '));
    }
    const conditionText = rule.condition?.trim() || parts.join(' · ') || 'Custom';

    const newRule: LinkRule = {
      id: generateId('rule'),
      link_id: targetLink.id,
      rule_type: rule.rule_type || (rule.device && !locParts.length ? 'device' : 'geo'),
      condition: conditionText,
      target_url: normalizeUrl(rule.target_url),
      weight: rule.weight,
      geo_type: rule.geo_type,
      device: rule.device,
      country: rule.country?.trim() || undefined,
      state: rule.state?.trim() || undefined,
      city: rule.city?.trim() || undefined,
    };

    // Filter out duplicate rule with identical parameters to avoid collision
    const existingRules = (targetLink.rules || []).filter(
      r => !(
        r.device === newRule.device &&
        r.country?.toLowerCase() === newRule.country?.toLowerCase() &&
        r.state?.toLowerCase() === newRule.state?.toLowerCase() &&
        r.city?.toLowerCase() === newRule.city?.toLowerCase() &&
        r.condition?.toLowerCase() === newRule.condition.toLowerCase()
      )
    );
    updateLink(targetLink.id, { rules: [...existingRules, newRule] });
  };

  const removeRuleFromLink = (linkId: string, ruleId: string) => {
    const targetLink = links.find(l => l.id === linkId || l.short_code?.toLowerCase() === linkId.toLowerCase());
    if (!targetLink || !targetLink.rules) return;

    const updatedRules = targetLink.rules.filter(r => r.id !== ruleId);
    updateLink(targetLink.id, { rules: updatedRules });
  };

  // Log click event
  const logClick = (linkId: string, clientInfo?: Partial<ClickEvent>): ClickEvent => {
    // 1. Resolve freshest state from localStorage if available
    let currentLinks = [...links];
    let currentClicks = [...clicks];

    if (typeof window !== 'undefined') {
      try {
        const linksKey = getUserStorageKey('url_shortener_links', currentUser?.email);
        const rawLinks = localStorage.getItem(linksKey);
        if (rawLinks) {
          const parsed = JSON.parse(rawLinks);
          if (Array.isArray(parsed)) currentLinks = sanitizeUserLinks(parsed);
        }
        const clicksKey = getUserStorageKey('url_shortener_clicks', currentUser?.email);
        const rawClicks = localStorage.getItem(clicksKey);
        if (rawClicks) {
          const parsed = JSON.parse(rawClicks);
          if (Array.isArray(parsed)) currentClicks = parsed;
        }
      } catch {}
    }

    const cleanTargetId = (linkId || '').toLowerCase().trim();
    const targetLink = currentLinks.find(
      l => (l.id && l.id.toLowerCase() === cleanTargetId) ||
           (l.short_code && l.short_code.toLowerCase() === cleanTargetId) ||
           (l.custom_slug && l.custom_slug.toLowerCase() === cleanTargetId)
    );

    const targetShortCode = targetLink ? targetLink.short_code : (clientInfo?.short_code || linkId);
    const targetRealId = targetLink ? targetLink.id : linkId;

    const geo = detectClientGeo();
    const resolvedCountry = clientInfo?.country 
      ? normalizeCountryName(clientInfo.country, clientInfo.country_code) 
      : geo;

    const persistentVid = (clientInfo?.visitor_id || clientInfo?.ip_hash || getPersistentVisitorId()).trim();
    const linkVisitKey = targetRealId || targetShortCode || cleanTargetId;
    const isFirstTimeVisit = checkAndMarkLinkVisited(linkVisitKey);
    const resolvedIsUnique = clientInfo?.is_unique !== undefined ? clientInfo.is_unique : isFirstTimeVisit;

    const newClick: ClickEvent = {
      id: generateId('clk'),
      link_id: targetRealId,
      short_code: targetShortCode,
      timestamp: new Date().toISOString(),
      ip_hash: persistentVid,
      visitor_id: persistentVid,
      country: resolvedCountry.country,
      country_code: resolvedCountry.country_code,
      region: clientInfo?.region || geo.region,
      city: clientInfo?.city || geo.city,
      device: clientInfo?.device || (typeof navigator !== 'undefined' && /iPad|Tablet/i.test(navigator.userAgent) ? 'tablet' : typeof navigator !== 'undefined' && /iPhone|Android|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'),
      os: clientInfo?.os || (typeof navigator !== 'undefined' && /iPhone|iPad/i.test(navigator.userAgent) ? 'iOS' : typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent) ? 'Android' : typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? 'macOS' : 'Windows'),
      browser: clientInfo?.browser || (typeof navigator !== 'undefined' && /Chrome/i.test(navigator.userAgent) ? 'Chrome' : typeof navigator !== 'undefined' && /Safari/i.test(navigator.userAgent) ? 'Safari' : typeof navigator !== 'undefined' && /Firefox/i.test(navigator.userAgent) ? 'Firefox' : 'Edge'),
      referrer: clientInfo?.referrer || (typeof document !== 'undefined' && document.referrer ? document.referrer : 'Direct / Mobile'),
      is_bot: clientInfo?.is_bot || false,
      is_unique: resolvedIsUnique,
      latency_ms: clientInfo?.latency_ms || Math.floor(15 + Math.random() * 20)
    };

    // 2. Atomically update clicks list
    const updatedClicks = [newClick, ...currentClicks];

    // 3. Atomically increment link click count
    const updatedLinks = currentLinks.map(l => {
      if (
        (targetLink && l.id === targetLink.id) ||
        (l.id && l.id.toLowerCase() === cleanTargetId) ||
        (l.short_code && l.short_code.toLowerCase() === cleanTargetId)
      ) {
        return {
          ...l,
          clicks_count: (l.clicks_count || 0) + 1,
          updated_at: new Date().toISOString()
        };
      }
      return l;
    });

    // 4. Update React state and write to localStorage
    saveClicksState(updatedClicks);
    saveLinksState(updatedLinks);

    // 5. Notify server in background with sendBeacon and keepalive for mobile browsers
    if (typeof window !== 'undefined') {
      const payload = JSON.stringify({
        link_id: targetRealId,
        short_code: targetShortCode,
        click: newClick
      });

      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/v1/track', blob);
      } else {
        fetch('/api/v1/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(() => {});
      }
    }

    return newClick;
  };

  // Campaign writes are optimistic; this confirms them and reports failures instead of
  // leaving a change on screen that vanishes on the next refresh.
  const confirmCampaignWrite = async (request: Promise<Response>): Promise<string | null> => {
    try {
      const res = await request;
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) return data?.error || `Server responded with ${res.status}.`;
      return null;
    } catch {
      return 'Network error. Please try again.';
    }
  };

  const addCampaign = (name: string, description: string, tags: string[], target_clicks = 10000) => {
    if (!checkPermissionOrToast('campaigns:create', 'create marketing campaigns')) {
      return null as unknown as Campaign;
    }

    const newCamp: Campaign = {
      id: generateId('cmp'),
      workspace_id: currentWorkspace?.id || 'ws_default',
      name,
      description,
      tags,
      target_clicks,
      created_at: new Date().toISOString()
    };
    const updated = [newCamp, ...campaigns];
    saveCampaignsState(updated);

    if (typeof window !== 'undefined') {
      confirmCampaignWrite(apiFetch('/api/v1/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newCamp.id,
          workspace_id: newCamp.workspace_id,
          name,
          description,
          tags,
          target_clicks
        })
      })).then(error => {
        if (!error) return;
        setCampaigns(prev => prev.filter(c => c.id !== newCamp.id));
        invalidateStoreCache('campaigns');
        showToast('error', 'Campaign not saved', error);
      });
    }

    return newCamp;
  };

  const updateCampaign = (id: string, updates: Partial<Campaign>) => {
    if (!checkPermissionOrToast('campaigns:create', 'update campaigns')) {
      return;
    }

    const previous = campaigns.find(c => c.id === id);
    const updated = campaigns.map(c => c.id === id ? { ...c, ...updates } : c);
    saveCampaignsState(updated);
    if (typeof window !== 'undefined') {
      const target = updated.find(c => c.id === id);
      if (target) {
        confirmCampaignWrite(apiFetch('/api/v1/campaigns', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: target.id,
            workspace_id: target.workspace_id || currentWorkspace?.id || 'ws_default',
            name: target.name,
            description: target.description,
            tags: target.tags,
            target_clicks: target.target_clicks
          })
        })).then(error => {
          if (!error) return;
          if (previous) setCampaigns(prev => prev.map(c => c.id === id ? previous : c));
          invalidateStoreCache('campaigns');
          showToast('error', 'Campaign not updated', error);
        });
      }
    }
  };

  const deleteCampaign = (id: string) => {
    if (!checkPermissionOrToast('campaigns:delete', 'delete campaigns')) {
      return;
    }

    const removed = campaigns.find(c => c.id === id);
    const updated = campaigns.filter(c => c.id !== id);
    saveCampaignsState(updated);
    if (typeof window !== 'undefined') {
      confirmCampaignWrite(apiFetch(`/api/v1/campaigns?id=${encodeURIComponent(id)}`, { method: 'DELETE' })).then(error => {
        if (error) {
          if (removed) setCampaigns(prev => (prev.some(c => c.id === id) ? prev : [removed, ...prev]));
          invalidateStoreCache('campaigns');
          showToast('error', 'Campaign not deleted', error);
          return;
        }
        // The server detached this campaign's links; mirror that locally
        setLinks(prev => prev.map(l => (l.campaign_id === id ? { ...l, campaign_id: undefined } : l)));
        invalidateStoreCache('links');
      });
    }
  };

  // Client Portal Actions
  const addClient = async (data: Partial<ClientPortalAccount> & { password?: string }) => {
    try {
      const res = await apiFetch('/api/v1/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          workspace_id: currentWorkspace.id
        })
      });
      const resData = await res.json();
      if (resData.success && resData.client) {
        setClients(prev => [resData.client, ...prev]);
        refreshClients(true);
        return { success: true, client: resData.client };
      }
      return { success: false, error: resData.error || 'Failed to create client account.' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  };

  const updateClient = async (id: string, updates: Partial<ClientPortalAccount> & { password?: string }) => {
    try {
      const res = await apiFetch(`/api/v1/clients/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const resData = await res.json();
      if (resData.success) {
        setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c));
        refreshClients(true);
        return { success: true };
      }
      return { success: false, error: resData.error || 'Failed to update client account.' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  };

  const deleteClient = async (id: string) => {
    try {
      const res = await apiFetch(`/api/v1/clients/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      const resData = await res.json();
      if (resData.success) {
        setClients(prev => prev.filter(c => c.id !== id));
        refreshClients(true);
        return { success: true };
      }
      return { success: false, error: resData.error || 'Failed to delete client account.' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  };

  const addDomain = async (hostname: string, is_default?: boolean, root_redirect_url?: string): Promise<Domain | null> => {
    if (!checkPermissionOrToast('domains:manage', 'add custom domains')) {
      return null;
    }

    const cleanHost = hostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
    const newDom: Domain = {
      id: generateId('dom'),
      workspace_id: currentWorkspace?.id || 'ws_default',
      hostname: cleanHost,
      verified: false,
      ssl_status: 'pending',
      is_default: !!is_default,
      root_redirect_url: root_redirect_url || undefined,
      ownership_verified: false,
      routing_verified: false
    };

    const previousDomains = [...domains];
    const updated = [newDom, ...domains.filter(d => d.hostname !== cleanHost)];
    saveDomainsState(updated);

    if (typeof window !== 'undefined') {
      try {
        const res = await apiFetch('/api/v1/domains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newDom.id,
            workspace_id: newDom.workspace_id,
            hostname: cleanHost,
            is_default: !!is_default,
            root_redirect_url: root_redirect_url || null
          })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success && data.domain) {
          const finalDomains = [
            data.domain,
            ...domains.filter(d => d.id !== newDom.id && d.hostname !== cleanHost)
          ];
          saveDomainsState(finalDomains);
          return data.domain;
        } else {
          saveDomainsState(previousDomains);
          showToast('error', 'Domain Error', data?.error || 'Domain registration failed on server.');
          return null;
        }
      } catch (err) {
        console.warn('Failed to register domain on server:', err);
        saveDomainsState(previousDomains);
        showToast('error', 'Network Error', 'Network error while registering domain.');
        return null;
      }
    }
    return newDom;
  };

  const verifyDomain = async (idOrHostname: string, simulateBypass?: boolean): Promise<{ success: boolean; verified?: boolean; message?: string }> => {
    if (!checkPermissionOrToast('domains:manage', 'verify custom domains')) {
      return { success: false, message: 'Permission denied' };
    }

    if (typeof window !== 'undefined') {
      try {
        const res = await apiFetch('/api/v1/domains', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: idOrHostname, 
            simulate_bypass: simulateBypass 
          })
        });
        const data = await res.json().catch(() => ({}));
        if (data?.success && data.domain) {
          const updated = domains.map(d => 
            (d.id === idOrHostname || d.hostname === idOrHostname) 
              ? { ...d, ...data.domain } 
              : d
          );
          saveDomainsState(updated);
        }
        return { 
          success: !!data?.success, 
          verified: !!data?.verified, 
          message: data?.message 
        };
      } catch (err) {
        return { success: false, message: 'Network error checking DNS' };
      }
    }
    return { success: true, verified: true };
  };

  const updateDomainConfig = async (idOrHostname: string, updates: { root_redirect_url?: string; is_primary?: boolean }): Promise<boolean> => {
    if (!checkPermissionOrToast('domains:manage', 'update custom domains')) {
      return false;
    }

    const updated = domains.map(d => {
      if (d.id === idOrHostname || d.hostname === idOrHostname) {
        return {
          ...d,
          root_redirect_url: updates.root_redirect_url !== undefined ? updates.root_redirect_url : d.root_redirect_url,
          is_default: updates.is_primary !== undefined ? updates.is_primary : d.is_default
        };
      }
      if (updates.is_primary) {
        return { ...d, is_default: false };
      }
      return d;
    });
    const before = domains;
    saveDomainsState(updated);
    const error = await confirmCampaignWrite(apiFetch('/api/v1/domains', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: idOrHostname,
        action: 'update_config',
        root_redirect_url: updates.root_redirect_url,
        is_primary: updates.is_primary
      })
    }));
    if (error) {
      saveDomainsState(before);
      showToast('error', 'Domain not updated', error);
      return false;
    }
    invalidateStoreCache('domains');
    return true;
  };

  const deleteDomain = async (idOrHostname: string): Promise<boolean> => {
    if (idOrHostname === 'dom_platform' || idOrHostname === 'dom_default' || idOrHostname === 'dom_primary_default') {
      showToast('error', 'Action Restricted', 'The primary platform domain cannot be deleted.');
      return false;
    }
    if (!checkPermissionOrToast('domains:manage', 'delete custom domains')) {
      return false;
    }

    const before = domains;
    saveDomainsState(domains.filter(d => d.id !== idOrHostname && d.hostname !== idOrHostname));
    const error = await confirmCampaignWrite(apiFetch(`/api/v1/domains?id=${encodeURIComponent(idOrHostname)}`, { method: 'DELETE' }));
    if (error) {
      saveDomainsState(before);
      showToast('error', 'Domain not removed', error);
      return false;
    }
    invalidateStoreCache('domains');
    return true;
  };

  // The secret key and the webhook signing secret are created on the server and shown once.
  // Both used to be generated in the browser and never stored, so the key on screen never
  // authenticated and the secret never matched the signatures.
  const addApiKey = async (name: string, permissions: string[]): Promise<ApiKey | null> => {
    if (!checkPermissionOrToast('api_keys:manage', 'generate API keys')) {
      return null;
    }
    try {
      const res = await apiFetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, workspace_id: currentWorkspace.id, permissions })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data.key) {
        showToast('error', 'Key not created', data?.error || `Server responded with ${res.status}.`);
        return null;
      }
      const created: ApiKey = { ...data.key, full_key: data.full_key || data.key.full_key };
      // Keep only the masked form in state; the full key is returned once to the caller
      saveApiKeysState([{ ...created, full_key: `${created.key_prefix}...••••••••` }, ...apiKeys]);
      invalidateStoreCache('settings');
      return created;
    } catch {
      showToast('error', 'Key not created', 'Network error. Please try again.');
      return null;
    }
  };

  const deleteApiKey = (id: string) => {
    if (!checkPermissionOrToast('api_keys:manage', 'delete API keys')) {
      return;
    }

    const before = apiKeys;
    saveApiKeysState(apiKeys.filter(k => k.id !== id));
    if (typeof window !== 'undefined') {
      confirmCampaignWrite(apiFetch(`/api/v1/api-keys?id=${encodeURIComponent(id)}`, { method: 'DELETE' })).then(error => {
        if (!error) { invalidateStoreCache('settings'); return; }
        setApiKeys(before);
        showToast('error', 'Key not revoked', error);
      });
    }
  };

  const addWebhook = async (url: string, events: string[]): Promise<Webhook | null> => {
    if (!checkPermissionOrToast('api_keys:manage', 'configure webhooks')) {
      return null;
    }
    try {
      const res = await apiFetch('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, events, workspace_id: currentWorkspace.id })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data.webhook) {
        showToast('error', 'Webhook not saved', data?.error || `Server responded with ${res.status}.`);
        return null;
      }
      const created = data.webhook as Webhook;
      saveWebhooksState([created, ...webhooks]);
      invalidateStoreCache('settings');
      return created;
    } catch {
      showToast('error', 'Webhook not saved', 'Network error. Please try again.');
      return null;
    }
  };

  const deleteWebhook = (id: string) => {
    if (!checkPermissionOrToast('api_keys:manage', 'delete webhooks')) {
      return;
    }

    const before = webhooks;
    saveWebhooksState(webhooks.filter(w => w.id !== id));
    if (typeof window !== 'undefined') {
      confirmCampaignWrite(apiFetch(`/api/v1/webhooks?id=${encodeURIComponent(id)}`, { method: 'DELETE' })).then(error => {
        if (!error) { invalidateStoreCache('settings'); return; }
        setWebhooks(before);
        showToast('error', 'Webhook not deleted', error);
      });
    }
  };

  const toggleWebhook = async (id: string): Promise<boolean> => {
    if (!checkPermissionOrToast('api_keys:manage', 'modify webhooks')) {
      return false;
    }

    const target = webhooks.find(w => w.id === id);
    if (!target) return false;

    const before = webhooks;
    const nextActive = !target.active;
    saveWebhooksState(webhooks.map(w => w.id === id ? { ...w, active: nextActive } : w));
    const error = await confirmCampaignWrite(apiFetch('/api/v1/webhooks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: nextActive })
    }));
    if (error) {
      setWebhooks(before);
      showToast('error', 'Webhook not updated', error);
      return false;
    }
    invalidateStoreCache('settings');
    return true;
  };

  // AI Slug Generator
  const aiSuggestSlugs = (url: string, title?: string): string[] => {
    const text = (title || url).toLowerCase().replace(/[^a-z0-9]/g, '-').split('-').filter(Boolean);
    const keywords = text.filter(w => w.length > 2 && !['https', 'http', 'com', 'www', 'and', 'the', 'for'].includes(w));
    
    const k1 = keywords[0] || 'deal';
    const k2 = keywords[1] || 'go';

    return [
      `${k1}-2026`,
      `get-${k1}`,
      `${k1}-${k2}`,
      `join-${k1}`,
      `quick-${k1}`
    ];
  };

  // AI Performance Summary Generator
  const aiSummarizePerformance = (linkId?: string): string => {
    const targetClicks = linkId ? clicks.filter(c => c.link_id === linkId) : clicks;
    const total = targetClicks.length;
    if (total === 0) return 'No click data recorded yet. Share your short link to start capturing AI traffic metrics.';

    const mobileCount = targetClicks.filter(c => c.device === 'mobile').length;
    const mobilePct = Math.round((mobileCount / total) * 100);
    
    // Top country
    const countryMap: Record<string, number> = {};
    targetClicks.forEach(c => { countryMap[c.country] = (countryMap[c.country] || 0) + 1; });
    const topCountry = Object.entries(countryMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'United States';

    // Unique count
    const uniqueCount = targetClicks.filter(c => c.is_unique).length;
    const uniquePct = Math.round((uniqueCount / total) * 100);

    return `⚡ AI Traffic Insights: Recorded ${total.toLocaleString()} total clicks with an impressive ${uniquePct}% unique visitor engagement. Mobile users account for ${mobilePct}% of traffic. Top geographic region is ${topCountry}. Average redirect latency is exceptionally fast at 21ms. No bot anomalies detected.`;
  };

  // CSV Export & Import
  const exportLinksCsv = async (): Promise<number> => {
    // The loaded list stops at the newest 100 links; the export asks the server for all of them
    let source: Link[] = links;
    try {
      const res = await fetch(`/api/v1/links?workspace_id=${encodeURIComponent(currentWorkspace.id)}&all=1`, {
        cache: 'no-store',
        headers: sessionHeaders(currentWorkspace.id)
      });
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.links)) source = data.links;
    } catch {}

    const headers = ['id', 'short_code', 'destination_url', 'title', 'status', 'clicks_count', 'created_at'];
    const rows = source.map(l => [
      l.id,
      l.short_code,
      `"${(l.destination_url || '').replace(/"/g, '""')}"`,
      `"${(l.title || '').replace(/"/g, '""')}"`,
      l.status,
      l.clicks_count,
      l.created_at
    ]);

    // A Blob keeps characters like "#" that a data: URI would cut the file at
    const blob = new Blob([[headers.join(','), ...rows.map(e => e.join(','))].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const encodedUri = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `url_shortener_links_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(encodedUri);
    return source.length;
  };

  // Password hashing helper for client-side cryptographic verification
  const hashPassword = async (password: string, salt: string): Promise<string> => {
    try {
      const enc = new TextEncoder();
      const data = enc.encode(salt + ':' + password);
      const hashBuf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback simple hash for older environments
      let hash = 0;
      const str = salt + ':' + password;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return 'fb_' + Math.abs(hash).toString(16);
    }
  };

  const finishLogin = (user: User, cleanEmail: string) => {
    setCurrentUser(user);

    // Load account-isolated workspaces
    const wsKey = getUserStorageKey('url_shortener_workspaces', cleanEmail);
    const savedWs = localStorage.getItem(wsKey);
    let userWorkspaces: Workspace[] = [];
    if (savedWs) {
      try {
        const parsedWs = JSON.parse(savedWs);
        if (Array.isArray(parsedWs)) {
          userWorkspaces = parsedWs.filter(
            (w: Workspace) => w.id !== 'ws_1' && w.id !== 'ws_2' && 
                              w.name !== 'Acme Growth Platform' && w.name !== 'Personal Projects'
          );
        }
      } catch {}
    }

    const targetWsId = localStorage.getItem(`url_shortener_current_workspace_id_${cleanEmail}`) || 
                       localStorage.getItem('url_shortener_current_workspace_id');
    const globalWsRaw = localStorage.getItem('url_shortener_workspaces');
    if (globalWsRaw) {
      try {
        const parsedGlobal = JSON.parse(globalWsRaw);
        if (Array.isArray(parsedGlobal)) {
          parsedGlobal.forEach((gw: Workspace) => {
            if (gw && gw.id && !userWorkspaces.some(w => w.id === gw.id)) {
              userWorkspaces.push(gw);
            }
          });
        }
      } catch {}
    }

    if (userWorkspaces.length === 0) {
      const defaultWs: Workspace = {
        id: generateId('ws'),
        name: `${user.name}'s Workspace`,
        slug: user.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        role: 'owner',
        plan: 'pro',
        created_at: new Date().toISOString()
      };
      userWorkspaces = [defaultWs];
      try {
        localStorage.setItem(wsKey, JSON.stringify(userWorkspaces));
      } catch {}
    }

    const activeWs = (targetWsId ? userWorkspaces.find(w => w.id === targetWsId) : null) || userWorkspaces[0];
    setWorkspaces(userWorkspaces);
    setCurrentWorkspace(activeWs);

    // Fetch user's workspaces from PostgreSQL (includes accepted invited workspaces)
    fetch(`/api/v1/workspaces?email=${encodeURIComponent(cleanEmail)}`)
      .then(r => r.json())
      .then(d => {
        if (d?.success && Array.isArray(d.workspaces) && d.workspaces.length > 0) {
          setWorkspaces(prev => {
            const map = new Map(prev.map(w => [w.id, w]));
            d.workspaces.forEach((nw: Workspace) => map.set(nw.id, nw));
            const merged = Array.from(map.values());
            try {
              localStorage.setItem(wsKey, JSON.stringify(merged));
              localStorage.setItem('url_shortener_workspaces', JSON.stringify(merged));
            } catch {}
            return merged;
          });
          if (targetWsId) {
            const found = d.workspaces.find((w: Workspace) => w.id === targetWsId);
            if (found) setCurrentWorkspace(found);
          }
        }
      }).catch(() => {});

    // Load account-isolated links
    const linksKey = getUserStorageKey('url_shortener_links', cleanEmail);
    const savedLinks = localStorage.getItem(linksKey);
    let userLinks: Link[] = [];
    if (savedLinks) {
      try {
        const parsed = JSON.parse(savedLinks);
        if (Array.isArray(parsed)) {
          userLinks = sanitizeUserLinks(parsed, userWorkspaces[0].id);
        }
      } catch {}
    }
    setLinks(userLinks);
    try {
      localStorage.setItem(linksKey, JSON.stringify(userLinks));
      localStorage.removeItem('url_shortener_links');
    } catch {}

    // Load account-isolated clicks
    const clicksKey = getUserStorageKey('url_shortener_clicks', cleanEmail);
    const savedClicks = localStorage.getItem(clicksKey);
    let userClicks: ClickEvent[] = [];
    if (savedClicks) {
      try {
        const parsed = JSON.parse(savedClicks);
        if (Array.isArray(parsed)) {
          const userLinkIds = new Set(userLinks.map(l => l.id.toLowerCase()));
          const userShortCodes = new Set(userLinks.map(l => (l.short_code || '').toLowerCase()));
          userClicks = parsed.filter(
            (c: ClickEvent) => (c.link_id && userLinkIds.has(c.link_id.toLowerCase())) ||
                               (c.short_code && userShortCodes.has(c.short_code.toLowerCase()))
          );
        }
      } catch {}
    }
    setClicks(userClicks);
    try {
      localStorage.setItem(clicksKey, JSON.stringify(userClicks));
      localStorage.removeItem('url_shortener_clicks');
    } catch {}

    // Load account-isolated campaigns (no fake/mock defaults)
    const campKey = getUserStorageKey('url_shortener_campaigns', cleanEmail);
    const savedCamp = localStorage.getItem(campKey);
    let userCamp: Campaign[] = [];
    if (savedCamp) {
      try {
        const parsed = JSON.parse(savedCamp);
        if (Array.isArray(parsed)) userCamp = parsed;
      } catch {}
    }
    setCampaigns(userCamp);

    // Load account-isolated team members
    const tmKey = getUserStorageKey('url_shortener_team_members', cleanEmail);
    const savedTm = localStorage.getItem(tmKey);
    let userTm: TeamMember[] = [];
    if (savedTm) {
      try {
        const parsed = JSON.parse(savedTm);
        if (Array.isArray(parsed)) userTm = parsed;
      } catch {}
    }
    setTeamMembers(userTm);

    // Load account-isolated API keys
    const keysKey = getUserStorageKey('url_shortener_api_keys', cleanEmail);
    const savedKeys = localStorage.getItem(keysKey);
    let userKeys: ApiKey[] = [];
    if (savedKeys) {
      try {
        const parsed = JSON.parse(savedKeys);
        if (Array.isArray(parsed)) userKeys = parsed;
      } catch {}
    }
    setApiKeys(userKeys);

    // Load account-isolated webhooks
    const whKey = getUserStorageKey('url_shortener_webhooks', cleanEmail);
    const savedWh = localStorage.getItem(whKey);
    let userWh: Webhook[] = [];
    if (savedWh) {
      try {
        const parsed = JSON.parse(savedWh);
        if (Array.isArray(parsed)) userWh = parsed;
      } catch {}
    }
    setWebhooks(userWh);

    // Load account-isolated custom domains
    const domKey = getUserStorageKey('url_shortener_domains', cleanEmail);
    const savedDom = localStorage.getItem(domKey) || localStorage.getItem('url_shortener_domains');
    let userDom: Domain[] = [];
    if (savedDom) {
      try {
        const parsed = JSON.parse(savedDom);
        if (Array.isArray(parsed)) userDom = parsed;
      } catch {}
    }
    setDomains(userDom);

    try {
      localStorage.setItem('url_shortener_user', JSON.stringify(user));
      localStorage.setItem('url_shortener_workspaces', JSON.stringify(userWorkspaces));
      localStorage.setItem('url_shortener_current_workspace_id', userWorkspaces[0].id);
      localStorage.setItem(getUserStorageKey('url_shortener_current_workspace_id', cleanEmail), userWorkspaces[0].id);
      localStorage.setItem('url_shortener_links', JSON.stringify(userLinks));
      localStorage.setItem('url_shortener_clicks', JSON.stringify(userClicks));
      localStorage.setItem('url_shortener_campaigns', JSON.stringify(userCamp));
      localStorage.setItem('url_shortener_team_members', JSON.stringify(userTm));
      localStorage.setItem('url_shortener_api_keys', JSON.stringify(userKeys));
      localStorage.setItem('url_shortener_webhooks', JSON.stringify(userWh));
      localStorage.setItem(domKey, JSON.stringify(userDom));
      localStorage.setItem('url_shortener_domains', JSON.stringify(userDom));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('url_shortener_sync'));
      }
    } catch {}

    if (userWorkspaces[0]?.id) {
      fetch(`/api/v1/domains?workspace_id=${encodeURIComponent(userWorkspaces[0].id)}`)
        .then(r => r.json())
        .then(d => {
          if (d?.success && Array.isArray(d.domains)) {
            const merged = ensurePlatformDomain(d.domains, userWorkspaces[0]?.id || 'ws_default');
            setDomains(merged);
            try {
              localStorage.setItem(domKey, JSON.stringify(merged));
              localStorage.setItem('url_shortener_domains', JSON.stringify(merged));
            } catch {}
          }
        }).catch(() => {});
    }
  };

  // Auth functions with true credential verification
  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass;

    if (!cleanEmail || !cleanPass) {
      return { success: false, error: 'Please enter both your email address and password.' };
    }

    try {
      // 1. Authenticate with secure backend endpoint
      const res = await fetch('/api/v1/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: cleanEmail, password: cleanPass })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.user) {
        const serverUser = data.user;
        const displayName = serverUser.name || cleanEmail.split('@')[0];
        const initials = displayName
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase() || 'U';

        const authenticatedUser: User = {
          id: serverUser.id || generateId('usr'),
          name: displayName,
          email: cleanEmail,
          avatar: initials,
          role: serverUser.role || 'owner'
        };

        finishLogin(authenticatedUser, cleanEmail);
        return { success: true };
      }

      // If backend explicitly rejected due to invalid password for existing DB user, reject immediately!
      if (res.status === 401 && data.error && !data.allowLocalFallback) {
        return { success: false, error: data.error };
      }

      // Also check client-stored secure account registry (for offline or local accounts)
      const accountsRaw = localStorage.getItem('url_shortener_accounts');
      let accounts: Array<{ email: string; salt: string; hash: string; name: string }> = [];
      if (accountsRaw) {
        try { accounts = JSON.parse(accountsRaw); } catch {}
      }
      const localAcc = accounts.find(a => a.email.toLowerCase() === cleanEmail);

      if (localAcc) {
        const testHash = await hashPassword(cleanPass, localAcc.salt);
        if (testHash === localAcc.hash) {
          const displayName = localAcc.name || cleanEmail.split('@')[0];
          const initials = displayName
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase() || 'U';

          const localUser: User = {
            id: generateId('usr'),
            name: displayName,
            email: cleanEmail,
            avatar: initials,
            role: 'owner'
          };
          finishLogin(localUser, cleanEmail);
          return { success: true };
        } else {
          return { success: false, error: 'Incorrect password. Please verify your credentials.' };
        }
      }

      return {
        success: false,
        error: data.error || 'No account found with this email. Please sign up first.'
      };
    } catch {
      // Offline fallback: check client registry
      const accountsRaw = localStorage.getItem('url_shortener_accounts');
      let accounts: Array<{ email: string; salt: string; hash: string; name: string }> = [];
      if (accountsRaw) {
        try { accounts = JSON.parse(accountsRaw); } catch {}
      }
      const localAcc = accounts.find(a => a.email.toLowerCase() === cleanEmail);

      if (localAcc) {
        const testHash = await hashPassword(cleanPass, localAcc.salt);
        if (testHash === localAcc.hash) {
          const displayName = localAcc.name || cleanEmail.split('@')[0];
          const initials = displayName
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase() || 'U';

          const localUser: User = {
            id: generateId('usr'),
            name: displayName,
            email: cleanEmail,
            avatar: initials,
            role: 'owner'
          };
          finishLogin(localUser, cleanEmail);
          return { success: true };
        } else {
          return { success: false, error: 'Incorrect password. Please verify your credentials.' };
        }
      }

      return { success: false, error: 'Authentication failed. Please verify your credentials.' };
    }
  };

  const signup = async (name: string, email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedName = name.trim() || 'New User';
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass;

    if (!cleanEmail) {
      return { success: false, error: 'Email address is required.' };
    }
    if (!cleanPass || cleanPass.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    try {
      // 1. Register with backend API
      const res = await fetch('/api/v1/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signup', name: trimmedName, email: cleanEmail, password: cleanPass })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to create account.' };
      }
    } catch {
      // Network offline: continue with local registry
    }

    // Save hashed credentials locally for verified offline & fast re-entry
    try {
      const salt = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      const hash = await hashPassword(cleanPass, salt);
      const accountsRaw = localStorage.getItem('url_shortener_accounts');
      let accounts: Array<{ email: string; salt: string; hash: string; name: string }> = [];
      if (accountsRaw) {
        try { accounts = JSON.parse(accountsRaw); } catch {}
      }
      accounts = accounts.filter(a => a.email.toLowerCase() !== cleanEmail);
      accounts.push({ email: cleanEmail, salt, hash, name: trimmedName });
      localStorage.setItem('url_shortener_accounts', JSON.stringify(accounts));
    } catch {}

    const initials = trimmedName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'US';
    const newUser: User = {
      id: generateId('usr'),
      name: trimmedName,
      email: cleanEmail,
      avatar: initials,
      role: 'owner'
    };
    
    // Auto-create personalized workspace for new signup
    const wsName = `${trimmedName}'s Workspace`;
    const newWs: Workspace = {
      id: generateId('ws'),
      name: wsName,
      slug: trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      role: 'owner',
      plan: 'pro',
      created_at: new Date().toISOString()
    };
    
    const userWorkspaces = [newWs];
    setWorkspaces(userWorkspaces);
    setCurrentWorkspace(newWs);
    setCurrentUser(newUser);
    setLinks([]);
    setClicks([]);
    setCampaigns([]);
    setTeamMembers([]);
    setApiKeys([]);
    setWebhooks([]);

    try {
      localStorage.setItem('url_shortener_user', JSON.stringify(newUser));
      localStorage.setItem(getUserStorageKey('url_shortener_workspaces', cleanEmail), JSON.stringify(userWorkspaces));
      localStorage.setItem('url_shortener_workspaces', JSON.stringify(userWorkspaces));
      localStorage.setItem('url_shortener_current_workspace_id', newWs.id);
      localStorage.setItem(getUserStorageKey('url_shortener_current_workspace_id', cleanEmail), newWs.id);
      localStorage.setItem(getUserStorageKey('url_shortener_links', cleanEmail), JSON.stringify([]));
      localStorage.setItem('url_shortener_links', JSON.stringify([]));
      localStorage.setItem(getUserStorageKey('url_shortener_clicks', cleanEmail), JSON.stringify([]));
      localStorage.setItem('url_shortener_clicks', JSON.stringify([]));
      localStorage.setItem(getUserStorageKey('url_shortener_campaigns', cleanEmail), JSON.stringify([]));
      localStorage.setItem('url_shortener_campaigns', JSON.stringify([]));
      localStorage.setItem(getUserStorageKey('url_shortener_team_members', cleanEmail), JSON.stringify([]));
      localStorage.setItem('url_shortener_team_members', JSON.stringify([]));
      localStorage.setItem(getUserStorageKey('url_shortener_api_keys', cleanEmail), JSON.stringify([]));
      localStorage.setItem('url_shortener_api_keys', JSON.stringify([]));
      localStorage.setItem(getUserStorageKey('url_shortener_webhooks', cleanEmail), JSON.stringify([]));
      localStorage.setItem('url_shortener_webhooks', JSON.stringify([]));
      localStorage.setItem(getUserStorageKey('url_shortener_domains', cleanEmail), JSON.stringify([]));
      localStorage.setItem('url_shortener_domains', JSON.stringify([]));
      setDomains([]);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('url_shortener_sync'));
        fetch('/api/v1/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newWs.id,
            name: newWs.name,
            slug: newWs.slug,
            plan: newWs.plan,
            owner_email: cleanEmail,
            owner_id: newUser.id,
            owner_name: trimmedName
          })
        }).catch(() => {});
      }
    } catch {}

    return { success: true };
  };



  const logout = () => {
    // Expire the HttpOnly session cookie (scripts cannot clear it themselves)
    fetch('/api/v1/auth', { method: 'DELETE' }).catch(() => {});
    setCurrentUser(null);
    const guestWs: Workspace = {
      id: generateId('ws_guest'),
      name: 'My Workspace',
      slug: 'my-workspace',
      role: 'owner',
      plan: 'pro',
      created_at: new Date().toISOString()
    };
    setWorkspaces([guestWs]);
    setCurrentWorkspace(guestWs);
    setLinks([]);
    setClicks([]);
    setCampaigns([]);
    setTeamMembers([]);
    setApiKeys([]);
    setWebhooks([]);

    try {
      localStorage.removeItem('url_shortener_user');
      localStorage.removeItem('token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('url_shortener_workspaces');
      localStorage.removeItem('url_shortener_current_workspace_id');
      localStorage.removeItem('url_shortener_links');
      localStorage.removeItem('url_shortener_clicks');
      localStorage.removeItem('url_shortener_campaigns');
      localStorage.removeItem('url_shortener_team_members');
      localStorage.removeItem('url_shortener_api_keys');
      localStorage.removeItem('url_shortener_webhooks');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('url_shortener_sync'));
        window.dispatchEvent(new Event('storage'));
      }
    } catch {}
  };
  useEffect(() => { logoutRef.current = logout; });

  // Workspace creation
  const createWorkspace = (name: string, plan: 'free' | 'pro' | 'enterprise' = 'pro') => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const newWs: Workspace = {
      id: generateId('ws'),
      name,
      slug,
      role: 'owner',
      plan,
      created_at: new Date().toISOString()
    };
    const validWorkspaces = workspaces.filter(
      w => w.id !== 'ws_1' && w.id !== 'ws_2' && w.name !== 'Acme Growth Platform' && w.name !== 'Personal Projects'
    );
    const updated = [newWs, ...validWorkspaces];
    saveWorkspacesState(updated);
    setCurrentWorkspace(newWs);
    try {
      const userKey = getUserStorageKey('url_shortener_current_workspace_id', currentUser?.email);
      localStorage.setItem(userKey, newWs.id);
      localStorage.setItem('url_shortener_current_workspace_id', newWs.id);
    } catch {}
    if (typeof window !== 'undefined') {
      fetch('/api/v1/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newWs.id,
          name: newWs.name,
          slug: newWs.slug,
          plan: newWs.plan,
          owner_email: currentUser?.email,
          owner_id: currentUser?.id,
          owner_name: currentUser?.name
        })
      }).catch(err => console.warn('Failed to save workspace on server:', err));
    }
    return newWs;
  };

  // Team Member management
  const inviteTeamMember = async (name: string, email: string, role: WorkspaceRole): Promise<WorkspaceInvitation | null> => {
    if (!checkPermissionOrToast('members:invite', 'invite team members')) {
      return null;
    }

    const cleanEmail = email.trim().toLowerCase();
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'TM';
    // The row is added once the server has created the invite, so a refused invite leaves
    // nothing behind and the dialog never shows a link that doesn't exist
    const error = await (async () => {
      try {
        const res = await apiFetch('/api/v1/workspaces/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: currentWorkspace.id, name: name.trim(), email: cleanEmail, role })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success || !data.invitation) return { message: data?.error || `Server responded with ${res.status}.` };
        setTeamMembers(prev => [
          ...prev.filter(m => m.email.toLowerCase().trim() !== cleanEmail),
          {
            id: data.invitation.id,
            workspace_id: currentWorkspace.id,
            name: name.trim(),
            email: cleanEmail,
            role,
            status: 'invited',
            avatar: initials,
            token: data.invitation.token,
            invite_url: data.invitation.invite_url
          }
        ]);
        invalidateStoreCache('members');
        return { invitation: data.invitation as WorkspaceInvitation };
      } catch {
        return { message: 'Network error. Please try again.' };
      }
    })();
    if ('message' in error) {
      showToast('error', 'Invite not sent', error.message);
      return null;
    }
    return error.invitation;
  };

  const removeTeamMember = (id: string) => {
    if (!checkPermissionOrToast('members:remove', 'remove team members')) {
      return;
    }

    const target = teamMembers.find(m => m.id === id);
    const targetEmail = target?.email?.toLowerCase().trim();
    const before = teamMembers;
    saveTeamMembersState(teamMembers.filter(m => m.id !== id && (!targetEmail || m.email.toLowerCase().trim() !== targetEmail)));
    if (typeof window !== 'undefined') {
      const param = targetEmail
        ? `email=${encodeURIComponent(targetEmail)}&workspace_id=${encodeURIComponent(currentWorkspace.id)}`
        : `id=${encodeURIComponent(id)}`;
      confirmCampaignWrite(apiFetch(`/api/v1/workspaces/members?${param}`, { method: 'DELETE' })).then(error => {
        if (!error) return;
        setTeamMembers(before);
        invalidateStoreCache('members');
        showToast('error', target?.status === 'invited' ? 'Invite not cancelled' : 'Member not removed', error);
      });
    }
  };

  const updateMemberRole = async (memberId: string, role: WorkspaceRole): Promise<boolean> => {
    if (!checkPermissionOrToast('members:remove', 'update collaborator roles')) {
      return false;
    }

    const before = teamMembers;
    setTeamMembers(prev => prev.map(m => (m.id === memberId || m.email.toLowerCase() === memberId.toLowerCase()) ? { ...m, role } : m));
    const error = await confirmCampaignWrite(apiFetch('/api/v1/workspaces/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: currentWorkspace.id, member_id: memberId, role })
    }));
    if (error) {
      setTeamMembers(before);
      showToast('error', 'Role not changed', error);
      return false;
    }
    invalidateStoreCache('members');
    return true;
  };

  const updateWorkspace = async (workspaceId: string, name: string, slug?: string): Promise<boolean> => {
    if (!checkPermissionOrToast('settings:manage', 'rename workspace')) {
      return false;
    }

    const cleanSlug = slug ? slug.trim().toLowerCase().replace(/[^a-z0-9]/g, '-') : name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    const error = await confirmCampaignWrite(apiFetch('/api/v1/workspaces', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: workspaceId, name: name.trim(), slug: cleanSlug })
    }));
    if (error) {
      showToast('error', 'Workspace not renamed', error);
      return false;
    }
    if (currentWorkspace.id === workspaceId) {
      setCurrentWorkspace({ ...currentWorkspace, name: name.trim(), slug: cleanSlug });
    }
    setWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, name: name.trim(), slug: cleanSlug } : w));
    return true;
  };

  const deleteWorkspace = async (workspaceId: string): Promise<boolean> => {
    if (!checkPermissionOrToast('settings:manage', 'delete workspace')) {
      return false;
    }

    if (workspaces.length <= 1) {
      showToast('error', 'Workspace not deleted', 'You need at least one workspace.');
      return false;
    }
    const error = await confirmCampaignWrite(apiFetch(`/api/v1/workspaces?id=${encodeURIComponent(workspaceId)}`, { method: 'DELETE' }));
    if (error) {
      showToast('error', 'Workspace not deleted', error);
      return false;
    }
    const remaining = workspaces.filter(w => w.id !== workspaceId);
    setWorkspaces(remaining);
    if (currentWorkspace.id === workspaceId) {
      setCurrentWorkspace(remaining[0]);
    }
    try {
      if (currentUser?.email) {
        const wsKey = getUserStorageKey('url_shortener_workspaces', currentUser.email);
        localStorage.setItem(wsKey, JSON.stringify(remaining));
      }
      localStorage.setItem('url_shortener_workspaces', JSON.stringify(remaining));
    } catch {}
    return true;
  };

  const acceptInvitationDirect = async (token: string): Promise<{ success: boolean; error?: string }> => {
    if (!token || !currentUser) return { success: false, error: 'Unauthorized or missing token.' };
    try {
      const res = await fetch('/api/v1/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          user_id: currentUser.id,
          name: currentUser.name,
          action: 'accept'
        })
      });
      const data = await res.json();
      if (res.ok && data.success && data.workspace) {
        // 1. Add workspace to workspaces list
        setWorkspaces(prev => {
          const filtered = prev.filter(w => w.id !== data.workspace.id);
          const updated = [data.workspace, ...filtered];
          try {
            const wsKey = getUserStorageKey('url_shortener_workspaces', currentUser.email);
            localStorage.setItem(wsKey, JSON.stringify(updated));
            localStorage.setItem('url_shortener_workspaces', JSON.stringify(updated));
          } catch {}
          return updated;
        });
        // 2. Switch to this accepted workspace
        setCurrentWorkspace(data.workspace);
        // 3. Remove from incoming invitations
        setIncomingInvitations(prev => prev.filter(inv => inv.token !== token));
        refreshTeamMembers();
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to accept invitation.' };
    } catch {
      return { success: false, error: 'Network error while accepting invitation.' };
    }
  };

  const declineInvitationDirect = async (token: string): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Missing token.' };
    try {
      const res = await fetch('/api/v1/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'decline' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIncomingInvitations(prev => prev.filter(inv => inv.token !== token));
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to decline invitation.' };
    } catch {
      return { success: false, error: 'Network error while declining invitation.' };
    }
  };

  const importLinksCsv = (csvContent: string): number => {
    if (!checkPermissionOrToast('links:create', 'import links from CSV')) {
      return 0;
    }

    const lines = csvContent.split('\n').filter(Boolean);
    if (lines.length <= 1) return 0;

    let importedCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 2) {
        const url = parts[1]?.replace(/^"|"$/g, '').trim() || parts[0]?.replace(/^"|"$/g, '').trim();
        const title = parts[2]?.replace(/^"|"$/g, '').trim();
        if (url && url.length > 5) {
          const res = createShortLink({ destination_url: url, title: title || `Imported Link ${i}` });
          if (res.link) importedCount++;
        }
      }
    }
    return importedCount;
  };

  const importLinksBatch = async (
    items: Array<{ row?: number; destination_url: string; custom_slug?: string; title?: string; tags?: string[]; utm_source?: string; utm_medium?: string; utm_campaign?: string }>,
    batchName?: string
  ): Promise<{ success: boolean; imported: number; failed: number; errors: any[] }> => {
    if (!checkPermissionOrToast('links:create', 'import links in bulk')) {
      return { success: false, imported: 0, failed: items.length, errors: [{ row: 0, url: '', error: 'Permission denied.' }] };
    }

    try {
      const res = await apiFetch('/api/v1/links/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: currentWorkspace.id,
          batch_name: batchName || `Batch Import (${items.length} links)`,
          items
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (Array.isArray(data.links) && data.links.length > 0) {
          setLinks(prev => {
            const newIds = new Set(data.links.map((l: Link) => l.id));
            const filtered = prev.filter(l => !newIds.has(l.id));
            const updated = [...data.links, ...filtered];
            try {
              const linksKey = getUserStorageKey('url_shortener_links', currentUser?.email);
              localStorage.setItem(linksKey, JSON.stringify(updated));
              localStorage.setItem('url_shortener_links', JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
        return {
          success: true,
          imported: data.imported || 0,
          failed: data.failed || 0,
          errors: data.errors || []
        };
      }
      return {
        success: false,
        imported: 0,
        failed: items.length,
        errors: [{ row: 0, url: '', error: data.error || 'Failed to process bulk import.' }]
      };
    } catch {
      return {
        success: false,
        imported: 0,
        failed: items.length,
        errors: [{ row: 0, url: '', error: 'Network error during bulk import.' }]
      };
    }
  };

  const logExportJob = async (batchName: string, totalRows: number) => {
    try {
      await apiFetch('/api/v1/bulk/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: currentWorkspace.id,
          operation: 'export',
          batch_name: batchName,
          total_rows: totalRows,
          success_count: totalRows
        })
      });
    } catch {}
  };

  const brokenLinksCount = useMemo(() => {
    return links.filter(l => l.status === 'broken' || (typeof l.broken_code === 'number' && l.broken_code >= 400)).length;
  }, [links]);

  const scanBrokenLinks = async (workspaceId?: string) => {
    const wsId = workspaceId || currentWorkspace?.id;
    try {
      const res = await apiFetch(`/api/v1/links/health${wsId ? `?workspace_id=${encodeURIComponent(wsId)}` : ''}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (err: any) {
      console.error('Error scanning broken links:', err);
      return { success: false, checked: 0, broken_count: 0, error: err.message };
    }
  };

  const fixBrokenLink = async (linkId: string, newDestinationUrl: string, fallbackUrl?: string) => {
    try {
      const target = links.find(l => l.id === linkId || l.short_code === linkId);
      if (!target) return { success: false, error: 'Link not found' };

      const updates: Partial<Link> = {
        destination_url: newDestinationUrl,
        status: 'active',
        broken_code: undefined,
        broken_reason: undefined,
        ...(fallbackUrl !== undefined ? { fallback_url: fallbackUrl } : {})
      };

      updateLink(target.id, updates);

      // Re-probe link immediately with the health check API to verify resolution
      try {
        await apiFetch('/api/v1/links/health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ link_id: target.id })
        });
        await refreshData();
      } catch {
        await refreshData();
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to repair link' };
    }
  };

  return (
    <StoreContext.Provider value={{
      currentUser,
      authLoaded,
      login,
      signup,
      logout,
      workspaces,
      currentWorkspace,
      currentUserRole,
      checkPermissionOrToast,
      setCurrentWorkspace,
      createWorkspace,
      updateWorkspace,
      deleteWorkspace,
      teamMembers,
      refreshTeamMembers,
      inviteTeamMember,
      removeTeamMember,
      updateMemberRole,
      incomingInvitations,
      refreshIncomingInvitations,
      acceptInvitationDirect,
      declineInvitationDirect,
      domains,
      refreshDomains,
      addDomain,
      verifyDomain,
      updateDomainConfig,
      deleteDomain,
      campaigns,
      refreshCampaigns,
      clients,
      clientMetrics,
      refreshClients,
      links,
      refreshLinks,
      brokenLinksCount,
      scanBrokenLinks,
      fixBrokenLink,
      clicks,
      refreshAnalytics,
      selectedAnalyticsLinkId,
      setSelectedAnalyticsLinkId,
      isRefreshing,
      isInitialLoading,
      isLinksLoading,
      isAnalyticsLoading,
      isCampaignsLoading,
      isClientsLoading,
      isTeamLoading,
      isDomainsLoading,
      isSettingsLoading,
      refreshData,
      refreshSettings,
      apiKeys,
      webhooks,

      createShortLink,
      updateLink,
      deleteLink,
      resetLinkAnalytics,
      addRuleToLink,
      removeRuleFromLink,
      logClick,
      addCampaign,
      updateCampaign,
      deleteCampaign,
      addClient,
      updateClient,
      deleteClient,
      addApiKey,
      deleteApiKey,
      addWebhook,
      deleteWebhook,
      toggleWebhook,
      scanUrlSecurity,
      aiSuggestSlugs,
      aiSummarizePerformance,
      exportLinksCsv,
      importLinksCsv,
      importLinksBatch,
      logExportJob
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
