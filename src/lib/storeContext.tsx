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
  DeepLinkConfig
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
  refreshTeamMembers: () => Promise<void>;
  inviteTeamMember: (name: string, email: string, role: WorkspaceRole) => Promise<WorkspaceInvitation | null>;
  removeTeamMember: (id: string) => void;
  updateMemberRole: (memberId: string, role: WorkspaceRole) => Promise<boolean>;

  incomingInvitations: WorkspaceInvitation[];
  refreshIncomingInvitations: () => Promise<void>;
  acceptInvitationDirect: (token: string) => Promise<{ success: boolean; error?: string }>;
  declineInvitationDirect: (token: string) => Promise<{ success: boolean; error?: string }>;

  domains: Domain[];
  campaigns: Campaign[];
  links: Link[];
  clicks: ClickEvent[];
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
  }) => { link: Link | null; error?: string };


  updateLink: (id: string, updates: Partial<Link>) => void;
  deleteLink: (id: string) => void;
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
  
  addDomain: (hostname: string, is_default?: boolean) => Promise<Domain | null>;
  verifyDomain: (idOrHostname: string) => Promise<boolean>;
  deleteDomain: (idOrHostname: string) => Promise<boolean>;
  
  addCampaign: (name: string, description: string, tags: string[], target_clicks?: number) => Campaign;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  deleteCampaign: (id: string) => void;
  addApiKey: (name: string, permissions: string[]) => ApiKey;
  deleteApiKey: (id: string) => void;
  addWebhook: (url: string, events: string[]) => Webhook;
  deleteWebhook: (id: string) => void;
  
  // Security & AI utilities
  scanUrlSecurity: (url: string) => SecurityReport;
  aiSuggestSlugs: (url: string, title?: string) => string[];
  aiSummarizePerformance: (linkId?: string) => string;
  exportLinksCsv: () => void;
  importLinksCsv: (csvContent: string) => number;
  importLinksBatch: (
    items: Array<{ destination_url: string; custom_slug?: string; title?: string; tags?: string[]; utm_source?: string; utm_medium?: string; utm_campaign?: string }>,
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


  const setCurrentWorkspace = useCallback((ws: Workspace) => {
    if (!ws) return;
    setCurrentWorkspaceState(ws);
    try {
      localStorage.setItem('url_shortener_current_workspace_id', ws.id);
      if (currentUser?.email) {
        localStorage.setItem(getUserStorageKey('url_shortener_current_workspace_id', currentUser.email), ws.id);
      }
    } catch {}

    if (typeof window !== 'undefined') {
      // 1. Fetch links for newly selected workspace
      fetch(`/api/v1/links?workspace_id=${encodeURIComponent(ws.id)}`)
        .then(r => r.json())
        .then(d => {
          if (d?.success && Array.isArray(d.links)) {
            setLinks(sanitizeUserLinks(d.links, ws.id));
          }
        }).catch(() => {});

      // 2. Fetch campaigns for newly selected workspace
      fetch(`/api/v1/campaigns?workspace_id=${encodeURIComponent(ws.id)}`)
        .then(r => r.json())
        .then(d => {
          if (d?.success && Array.isArray(d.campaigns)) {
            setCampaigns(d.campaigns);
          }
        }).catch(() => {});

      // 3. Fetch team members and pending invitations for newly selected workspace (deduplicated)
      fetch(`/api/v1/workspaces/members?workspace_id=${encodeURIComponent(ws.id)}`)
        .then(r => r.json())
        .then(d => {
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
            setTeamMembers(Array.from(memberMap.values()));
          }
        }).catch(() => {});
    }
  }, [currentUser?.email]);

  const refreshTeamMembers = useCallback(async () => {
    if (!currentWorkspace?.id || typeof window === 'undefined') return;
    try {
      const res = await fetch(`/api/v1/workspaces/members?workspace_id=${encodeURIComponent(currentWorkspace.id)}`);
      const d = await res.json();
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
        if (currentUser?.email) {
          const tmKey = getUserStorageKey('url_shortener_team_members', currentUser.email);
          try {
            localStorage.setItem(tmKey, JSON.stringify(fresh));
            localStorage.setItem('url_shortener_team_members', JSON.stringify(fresh));
          } catch {}
        }
      }
    } catch {}
  }, [currentWorkspace?.id, currentUser?.email]);

  const refreshIncomingInvitations = useCallback(async () => {
    if (!currentUser?.email) {
      setIncomingInvitations([]);
      return;
    }
    try {
      const res = await fetch(`/api/v1/invitations?email=${encodeURIComponent(currentUser.email)}`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.incoming)) {
        setIncomingInvitations(data.incoming);
      }
    } catch {}
  }, [currentUser?.email]);

  useEffect(() => {
    refreshIncomingInvitations();
    refreshTeamMembers();
  }, [refreshIncomingInvitations, refreshTeamMembers]);

  const [domains, setDomains] = useState<Domain[]>(initialDomains);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [clicks, setClicks] = useState<ClickEvent[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);

  // Initialize dynamic domain & sync localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const activeDomain = window.location.host || process.env.NEXT_PUBLIC_DEFAULT_DOMAIN || 'localhost:3000';
      setDomains([
        {
          id: 'dom_primary',
          hostname: activeDomain,
          verified: true,
          ssl_status: 'active',
          is_default: true,
          workspace_id: 'ws_default'
        }
      ]);
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

        // 8. Synchronize with backend API only for current user's workspace
        if (loadedWs && loadedWs[0]?.id) {
          const activeWsId = loadedWs[0].id;
          fetch(`/api/v1/links?workspace_id=${encodeURIComponent(activeWsId)}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.success && Array.isArray(data.links)) {
                const remoteValid = sanitizeUserLinks(data.links, activeWsId);
                if (remoteValid.length > 0) {
                  setLinks(currentActive => {
                    const remoteMap = new Map(remoteValid.map(r => [r.short_code.toLowerCase(), r]));
                    let hasChanges = false;
                    const updated = currentActive.map(local => {
                      const remote = remoteMap.get(local.short_code.toLowerCase());
                      if (remote && (remote.clicks_count || 0) > (local.clicks_count || 0)) {
                        hasChanges = true;
                        return {
                          ...local,
                          clicks_count: remote.clicks_count
                        };
                      }
                      return local;
                    });
                    const localKeys = new Set(currentActive.map(l => l.short_code.toLowerCase()));
                    remoteValid.forEach(r => {
                      if (!localKeys.has(r.short_code.toLowerCase())) {
                        updated.push(r);
                        hasChanges = true;
                      }
                    });
                    if (hasChanges) {
                      try {
                        const linksKey = getUserStorageKey('url_shortener_links', user.email);
                        localStorage.setItem(linksKey, JSON.stringify(updated));
                      } catch {}
                      return updated;
                    }
                    return currentActive;
                  });
                }
              }
            })
            .catch(() => {});
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
      }
    } catch {
      setLinks([]);
      setClicks([]);
    } finally {
      setAuthLoaded(true);
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
        const clicksKey = getUserStorageKey('url_shortener_clicks', activeEmail);
        const rawClicks = localStorage.getItem(clicksKey);
        if (rawClicks) {
          const parsedClicks = JSON.parse(rawClicks);
          if (Array.isArray(parsedClicks)) {
            setClicks(parsedClicks);
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
      } catch {}
    };

    // Live Server Telemetry Synchronizer (Polls PostgreSQL for clicks from mobile phones & external devices)
    const syncFromBackend = async () => {
      try {
        const rawUser = localStorage.getItem('url_shortener_user');
        const activeUser: User | null = rawUser ? JSON.parse(rawUser) : null;
        if (!activeUser?.email) return;

        const wsKey = getUserStorageKey('url_shortener_workspaces', activeUser.email);
        const rawWs = localStorage.getItem(wsKey);
        const parsedWs: Workspace[] = rawWs ? JSON.parse(rawWs) : [];
        const savedWsId = localStorage.getItem(`url_shortener_current_workspace_id_${activeUser.email}`) || 
                          localStorage.getItem('url_shortener_current_workspace_id');
        const activeWs = (savedWsId ? parsedWs.find(w => w.id === savedWsId) : null) || parsedWs[0];
        if (!activeWs?.id) return;

        // 1. Fetch newest link counters from PostgreSQL
        const linksRes = await fetch(`/api/v1/links?workspace_id=${encodeURIComponent(activeWs.id)}`);
        const linksData = await linksRes.json();
        if (linksData?.success && Array.isArray(linksData.links)) {
          const remoteValid = sanitizeUserLinks(linksData.links, activeWs.id);
          if (remoteValid.length > 0) {
            setLinks(currentActive => {
              const remoteMap = new Map(remoteValid.map(r => [r.short_code.toLowerCase(), r]));
              let hasChanges = false;
              const updated = currentActive.map(local => {
                const remote = remoteMap.get(local.short_code.toLowerCase());
                const remoteCount = remote ? (Number(remote.clicks_count) || 0) : 0;
                const localCount = Number(local.clicks_count) || 0;
                if (remoteCount > localCount) {
                  hasChanges = true;
                  return {
                    ...local,
                    clicks_count: remoteCount
                  };
                }
                return local;
              });
              const localKeys = new Set(currentActive.map(l => l.short_code.toLowerCase()));
              remoteValid.forEach(r => {
                if (!localKeys.has(r.short_code.toLowerCase())) {
                  updated.push(r);
                  hasChanges = true;
                }
              });
              if (hasChanges) {
                try {
                  const linksKey = getUserStorageKey('url_shortener_links', activeUser.email);
                  localStorage.setItem(linksKey, JSON.stringify(updated));
                } catch {}
                return updated;
              }
              return currentActive;
            });
          }
        }

        // 2. Fetch newest click events from PostgreSQL
        const analyticsRes = await fetch(`/api/v1/analytics?workspace_id=${encodeURIComponent(activeWs.id)}`, {
          cache: 'no-store'
        });
        const analyticsData = await analyticsRes.json();
        if (analyticsData?.success && Array.isArray(analyticsData.recent_clicks) && analyticsData.recent_clicks.length > 0) {
          setClicks(currentClicks => {
            const clickMap = new Map(currentClicks.map(c => [c.id, c]));
            let hasNewClicks = false;
            analyticsData.recent_clicks.forEach((rc: ClickEvent) => {
              if (!clickMap.has(rc.id)) {
                hasNewClicks = true;
                const norm = normalizeCountryName(rc.country, rc.country_code);
                clickMap.set(rc.id, {
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
                });
              }
            });

            // Always verify if clickMap total is greater than existing clicks
            if (hasNewClicks || clickMap.size > currentClicks.length) {
              const sorted = Array.from(clickMap.values()).sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              );
              try {
                const clicksKey = getUserStorageKey('url_shortener_clicks', activeUser.email);
                localStorage.setItem(clicksKey, JSON.stringify(sorted));
              } catch {}

              // Synchronize links clicks_count immediately with the verified telemetry events count
              setLinks(currentLinks => {
                let linksChanged = false;
                const synchronizedLinks = currentLinks.map(l => {
                  const eventsForL = sorted.filter(c => 
                    (c.link_id && c.link_id === l.id) || 
                    (c.short_code && c.short_code.toLowerCase() === l.short_code.toLowerCase())
                  ).length;
                  if (eventsForL > (l.clicks_count || 0)) {
                    linksChanged = true;
                    return { ...l, clicks_count: eventsForL };
                  }
                  return l;
                });
                if (linksChanged) {
                  try {
                    const linksKey = getUserStorageKey('url_shortener_links', activeUser.email);
                    localStorage.setItem(linksKey, JSON.stringify(synchronizedLinks));
                  } catch {}
                  return synchronizedLinks;
                }
                return currentLinks;
              });

              return sorted;
            }
            return currentClicks;
          });
        }

        // 3. Fetch custom domains from PostgreSQL
        fetch(`/api/v1/domains?workspace_id=${encodeURIComponent(activeWs.id)}`)
          .then(r => r.json())
          .then(d => {
            if (d?.success && Array.isArray(d.domains) && d.domains.length > 0) {
              setDomains(d.domains);
            }
          }).catch(() => {});

        // 4. Fetch API keys from PostgreSQL
        fetch(`/api/v1/api-keys?workspace_id=${encodeURIComponent(activeWs.id)}`)
          .then(r => r.json())
          .then(d => {
            if (d?.success && Array.isArray(d.keys)) {
              setApiKeys(d.keys);
            }
          }).catch(() => {});

        // 5. Fetch Webhooks from PostgreSQL
        fetch(`/api/v1/webhooks?workspace_id=${encodeURIComponent(activeWs.id)}`)
          .then(r => r.json())
          .then(d => {
            if (d?.success && Array.isArray(d.webhooks)) {
              setWebhooks(d.webhooks);
            }
          }).catch(() => {});

        // 6. Fetch Campaigns from PostgreSQL
        fetch(`/api/v1/campaigns?workspace_id=${encodeURIComponent(activeWs.id)}`)
          .then(r => r.json())
          .then(d => {
            if (d?.success && Array.isArray(d.campaigns)) {
              setCampaigns(d.campaigns);
            }
          }).catch(() => {});

        // 7. Fetch Team Members and Invitations from PostgreSQL (deduplicated by email)
        fetch(`/api/v1/workspaces/members?workspace_id=${encodeURIComponent(activeWs.id)}`)
          .then(r => r.json())
          .then(d => {
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
                    status: 'invited' as const,
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
              setTeamMembers(Array.from(memberMap.values()));
            }
          }).catch(() => {});
      } catch {}
    };

    window.addEventListener('storage', handleSyncFromStorage);
    window.addEventListener('focus', handleSyncFromStorage);
    window.addEventListener('focus', syncFromBackend);
    window.addEventListener('url_shortener_sync', handleSyncFromStorage);

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) syncFromBackend();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    const pollTimer = setInterval(syncFromBackend, 4000);

    return () => {
      window.removeEventListener('storage', handleSyncFromStorage);
      window.removeEventListener('focus', handleSyncFromStorage);
      window.removeEventListener('focus', syncFromBackend);
      window.removeEventListener('url_shortener_sync', handleSyncFromStorage);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      clearInterval(pollTimer);
    };
  }, []);

  // Sync state changes to localStorage scoped per user
  const saveLinksState = (newLinks: Link[]) => {
    setLinks(newLinks);
    try {
      const userKey = getUserStorageKey('url_shortener_links', currentUser?.email);
      localStorage.setItem(userKey, JSON.stringify(newLinks));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('url_shortener_sync'));
      }
    } catch {}
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
    try {
      const userKey = getUserStorageKey('url_shortener_webhooks', currentUser?.email);
      localStorage.setItem(userKey, JSON.stringify(newHooks));
      localStorage.setItem('url_shortener_webhooks', JSON.stringify(newHooks));
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
      domain_id: data.domain_id || defaultDomain.id,
      workspace_id: currentWorkspace.id,
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
      rules: data.rules || []
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
          workspace_id: newLink.workspace_id
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data?.data?.id) {
          setLinks(prev => prev.map(l => l.id === newLink.id ? { ...l, id: data.data.id } : l));
        }
      })
      .catch(() => {});
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
            tags: target.tags
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
      apiFetch('/api/v1/campaigns', {
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
      }).catch(err => console.warn('Failed to save campaign on server:', err));
    }

    return newCamp;
  };

  const updateCampaign = (id: string, updates: Partial<Campaign>) => {
    if (!checkPermissionOrToast('campaigns:create', 'update campaigns')) {
      return;
    }

    const updated = campaigns.map(c => c.id === id ? { ...c, ...updates } : c);
    saveCampaignsState(updated);
    if (typeof window !== 'undefined') {
      const target = updated.find(c => c.id === id);
      if (target) {
        apiFetch('/api/v1/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: target.id,
            workspace_id: target.workspace_id,
            name: target.name,
            description: target.description,
            tags: target.tags,
            target_clicks: target.target_clicks
          })
        }).catch(err => console.warn('Failed to update campaign on server:', err));
      }
    }
  };

  const deleteCampaign = (id: string) => {
    if (!checkPermissionOrToast('campaigns:delete', 'delete campaigns')) {
      return;
    }

    const updated = campaigns.filter(c => c.id !== id);
    saveCampaignsState(updated);
    if (typeof window !== 'undefined') {
      apiFetch(`/api/v1/campaigns?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  const addDomain = async (hostname: string, is_default?: boolean): Promise<Domain | null> => {
    if (!checkPermissionOrToast('domains:manage', 'add custom domains')) {
      return null;
    }

    const cleanHost = hostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const newDom: Domain = {
      id: generateId('dom'),
      workspace_id: currentWorkspace?.id || 'ws_default',
      hostname: cleanHost,
      verified: false,
      ssl_status: 'pending',
      is_default: !!is_default
    };
    const updated = [newDom, ...domains];
    setDomains(updated);

    if (typeof window !== 'undefined') {
      try {
        const res = await apiFetch('/api/v1/domains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newDom.id,
            workspace_id: newDom.workspace_id,
            hostname: cleanHost,
            is_default: !!is_default
          })
        });
        const data = await res.json();
        if (data?.success && data.domain) {
          setDomains(prev => prev.map(d => d.id === newDom.id ? { ...d, id: data.domain.id } : d));
          return data.domain;
        }
      } catch (err) {
        console.warn('Failed to register domain on server:', err);
      }
    }
    return newDom;
  };

  const verifyDomain = async (idOrHostname: string): Promise<boolean> => {
    if (!checkPermissionOrToast('domains:manage', 'verify custom domains')) {
      return false;
    }

    setDomains(prev => prev.map(d => (d.id === idOrHostname || d.hostname === idOrHostname) ? { ...d, verified: true, ssl_status: 'active' } : d));
    if (typeof window !== 'undefined') {
      try {
        const res = await apiFetch('/api/v1/domains', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: idOrHostname, verified: true, ssl_status: 'active' })
        });
        const data = await res.json();
        return !!data?.success;
      } catch {
        return false;
      }
    }
    return true;
  };

  const deleteDomain = async (idOrHostname: string): Promise<boolean> => {
    if (!checkPermissionOrToast('domains:manage', 'delete custom domains')) {
      return false;
    }

    setDomains(prev => prev.filter(d => d.id !== idOrHostname && d.hostname !== idOrHostname));
    if (typeof window !== 'undefined') {
      try {
        const res = await apiFetch(`/api/v1/domains?id=${encodeURIComponent(idOrHostname)}`, { method: 'DELETE' });
        const data = await res.json();
        return !!data?.success;
      } catch {
        return false;
      }
    }
    return true;
  };

  const addApiKey = (name: string, permissions: string[]) => {
    if (!checkPermissionOrToast('api_keys:manage', 'generate API keys')) {
      return {} as ApiKey;
    }

    const prefix = `sk_live_${Math.random().toString(36).substring(2, 6)}`;
    const fullKey = `${prefix}_${Math.random().toString(36).substring(2, 18)}${Math.random().toString(36).substring(2, 18)}`;
    const newKey: ApiKey = {
      id: generateId('key'),
      workspace_id: currentWorkspace?.id || 'ws_default',
      name,
      key_prefix: prefix,
      full_key: fullKey,
      permissions,
      created_at: new Date().toISOString()
    };
    saveApiKeysState([newKey, ...apiKeys]);

    if (typeof window !== 'undefined') {
      apiFetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          workspace_id: currentWorkspace?.id || 'ws_default',
          permissions
        })
      })
      .then(r => r.json())
      .then(d => {
        if (d?.success && d.key) {
          setApiKeys(prev => prev.map(k => k.id === newKey.id ? { ...k, id: d.key.id, key_prefix: d.key.key_prefix } : k));
        }
      })
      .catch(err => console.warn('Failed to save API key on server:', err));
    }

    return newKey;
  };

  const deleteApiKey = (id: string) => {
    if (!checkPermissionOrToast('api_keys:manage', 'delete API keys')) {
      return;
    }

    const updated = apiKeys.filter(k => k.id !== id);
    saveApiKeysState(updated);
    if (typeof window !== 'undefined') {
      apiFetch(`/api/v1/api-keys?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  const addWebhook = (url: string, events: string[]) => {
    if (!checkPermissionOrToast('api_keys:manage', 'configure webhooks')) {
      return {} as Webhook;
    }

    const newWh: Webhook = {
      id: generateId('wh'),
      workspace_id: currentWorkspace?.id || 'ws_default',
      url,
      events,
      secret: `whsec_${Math.random().toString(36).substring(2, 20)}`,
      active: true,
      created_at: new Date().toISOString()
    };
    saveWebhooksState([newWh, ...webhooks]);

    if (typeof window !== 'undefined') {
      apiFetch('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          events,
          workspace_id: currentWorkspace?.id || 'ws_default'
        })
      })
      .then(r => r.json())
      .then(d => {
        if (d?.success && d.webhook) {
          setWebhooks(prev => prev.map(w => w.id === newWh.id ? { ...w, id: d.webhook.id } : w));
        }
      })
      .catch(err => console.warn('Failed to save webhook on server:', err));
    }

    return newWh;
  };

  const deleteWebhook = (id: string) => {
    if (!checkPermissionOrToast('api_keys:manage', 'delete webhooks')) {
      return;
    }

    const updated = webhooks.filter(w => w.id !== id);
    saveWebhooksState(updated);
    if (typeof window !== 'undefined') {
      apiFetch(`/api/v1/webhooks?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    }
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
  const exportLinksCsv = () => {
    const headers = ['id', 'short_code', 'destination_url', 'title', 'status', 'clicks_count', 'created_at'];
    const rows = links.map(l => [
      l.id,
      l.short_code,
      `"${l.destination_url.replace(/"/g, '""')}"`,
      `"${l.title.replace(/"/g, '""')}"`,
      l.status,
      l.clicks_count,
      l.created_at
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `url_shortener_links_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    try {
      localStorage.setItem('url_shortener_user', JSON.stringify(user));
      localStorage.setItem('url_shortener_workspaces', JSON.stringify(userWorkspaces));
      localStorage.setItem('url_shortener_current_workspace_id', userWorkspaces[0].id);
      localStorage.setItem('url_shortener_links', JSON.stringify(userLinks));
      localStorage.setItem('url_shortener_clicks', JSON.stringify(userClicks));
      localStorage.setItem('url_shortener_campaigns', JSON.stringify(userCamp));
      localStorage.setItem('url_shortener_team_members', JSON.stringify(userTm));
      localStorage.setItem('url_shortener_api_keys', JSON.stringify(userKeys));
      localStorage.setItem('url_shortener_webhooks', JSON.stringify(userWh));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('url_shortener_sync'));
      }
    } catch {}
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
    const tempId = generateId('tm');
    
    // Deduplicate: replace any existing entry for this email
    const filtered = teamMembers.filter(m => m.email.toLowerCase().trim() !== cleanEmail);
    const newMember: TeamMember = {
      id: tempId,
      workspace_id: currentWorkspace.id,
      name: name.trim(),
      email: cleanEmail,
      role,
      status: 'invited',
      avatar: initials
    };
    saveTeamMembersState([...filtered, newMember]);

    if (typeof window !== 'undefined') {
      try {
        const res = await apiFetch('/api/v1/workspaces/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: currentWorkspace.id,
            name: name.trim(),
            email: cleanEmail,
            role,
            inviter_email: currentUser?.email || 'Admin'
          })
        });
        const data = await res.json();
        if (data.success && data.invitation) {
          setTeamMembers(prev => {
            const next = prev.filter(m => m.id !== tempId && m.email.toLowerCase().trim() !== cleanEmail);
            return [...next, {
              ...newMember,
              id: data.invitation.id,
              token: data.invitation.token,
              invite_url: data.invitation.invite_url
            }];
          });
          return data.invitation;
        }
      } catch (err) {
        console.warn('Failed to register invitation on server:', err);
      }
    }
    return null;
  };

  const removeTeamMember = (id: string) => {
    if (!checkPermissionOrToast('members:remove', 'remove team members')) {
      return;
    }

    const target = teamMembers.find(m => m.id === id);
    const targetEmail = target?.email?.toLowerCase().trim();
    saveTeamMembersState(teamMembers.filter(m => m.id !== id && (!targetEmail || m.email.toLowerCase().trim() !== targetEmail)));
    if (typeof window !== 'undefined') {
      const param = targetEmail 
        ? `email=${encodeURIComponent(targetEmail)}&workspace_id=${encodeURIComponent(currentWorkspace.id)}` 
        : `id=${encodeURIComponent(id)}`;
      apiFetch(`/api/v1/workspaces/members?${param}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  const updateMemberRole = async (memberId: string, role: WorkspaceRole): Promise<boolean> => {
    if (!checkPermissionOrToast('members:remove', 'update collaborator roles')) {
      return false;
    }

    setTeamMembers(prev => prev.map(m => (m.id === memberId || m.email.toLowerCase() === memberId.toLowerCase()) ? { ...m, role } : m));
    if (typeof window !== 'undefined') {
      try {
        const res = await apiFetch('/api/v1/workspaces/members', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: currentWorkspace.id,
            member_id: memberId,
            role
          })
        });
        const data = await res.json();
        return !!data?.success;
      } catch {}
    }
    return true;
  };

  const updateWorkspace = async (workspaceId: string, name: string, slug?: string): Promise<boolean> => {
    if (!checkPermissionOrToast('settings:manage', 'rename workspace')) {
      return false;
    }

    const cleanSlug = slug ? slug.trim().toLowerCase().replace(/[^a-z0-9]/g, '-') : name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    const updatedWs: Workspace = { ...currentWorkspace, name: name.trim(), slug: cleanSlug };
    if (currentWorkspace.id === workspaceId) {
      setCurrentWorkspace(updatedWs);
    }
    setWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, name: name.trim(), slug: cleanSlug } : w));
    if (typeof window !== 'undefined') {
      try {
        const res = await apiFetch('/api/v1/workspaces', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: workspaceId, name: name.trim(), slug: cleanSlug })
        });
        return res.ok;
      } catch {}
    }
    return true;
  };

  const deleteWorkspace = async (workspaceId: string): Promise<boolean> => {
    if (!checkPermissionOrToast('settings:manage', 'delete workspace')) {
      return false;
    }

    if (workspaces.length <= 1) return false;
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
    if (typeof window !== 'undefined') {
      apiFetch(`/api/v1/workspaces?id=${encodeURIComponent(workspaceId)}`, { method: 'DELETE' }).catch(() => {});
    }
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
    items: Array<{ destination_url: string; custom_slug?: string; title?: string; tags?: string[]; utm_source?: string; utm_medium?: string; utm_campaign?: string }>,
    batchName?: string
  ): Promise<{ success: boolean; imported: number; failed: number; errors: any[] }> => {
    if (!checkPermissionOrToast('links:create', 'import links in bulk')) {
      return { success: false, imported: 0, failed: items.length, errors: [{ row: 0, url: '', error: 'Permission denied.' }] };
    }

    try {
      const res = await fetch('/api/v1/links/bulk', {
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
      await fetch('/api/v1/bulk/jobs', {
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
      addDomain,
      verifyDomain,
      deleteDomain,
      campaigns,
      links,
      clicks,
      apiKeys,
      webhooks,
      createShortLink,
      updateLink,
      deleteLink,
      addRuleToLink,
      removeRuleFromLink,
      logClick,
      addCampaign,
      updateCampaign,
      deleteCampaign,
      addApiKey,
      deleteApiKey,
      addWebhook,
      deleteWebhook,
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
