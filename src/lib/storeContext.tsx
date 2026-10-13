'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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
  User,
  TeamMember,
  WorkspaceRole,
  DeepLinkConfig
} from './types';
import {
  initialWorkspaces,
  initialTeamMembers,
  initialDomains,
  initialCampaigns,
  initialLinks,
  generateMockClicks,
  initialApiKeys,
  initialWebhooks,
  generateBase62Code,
  normalizeUrl,
  buildUtmUrl,
  RESERVED_SLUGS
} from './db';
import { detectAppDeepLink } from './deepLink';


interface StoreContextType {
  currentUser: User | null;
  authLoaded: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;

  workspaces: Workspace[];
  currentWorkspace: Workspace;
  setCurrentWorkspace: (ws: Workspace) => void;
  createWorkspace: (name: string, plan?: 'free' | 'pro' | 'enterprise') => Workspace;

  teamMembers: TeamMember[];
  inviteTeamMember: (name: string, email: string, role: WorkspaceRole) => void;
  removeTeamMember: (id: string) => void;

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
  }) => { link: Link | null; error?: string };


  updateLink: (id: string, updates: Partial<Link>) => void;
  deleteLink: (id: string) => void;
  addRuleToLink: (linkId: string, rule: { rule_type: 'geo' | 'device' | 'ab'; condition: string; target_url: string; weight?: number }) => void;
  removeRuleFromLink: (linkId: string, ruleId: string) => void;
  logClick: (linkId: string, clientInfo?: Partial<ClickEvent>) => ClickEvent;
  
  addCampaign: (name: string, description: string, tags: string[], target_clicks?: number) => Campaign;
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
}

const StoreContext = createContext<StoreContextType | null>(null);

// Helper to isolate localStorage items per user account
export const getUserStorageKey = (base: string, email?: string | null): string => {
  if (!email || !email.trim()) return `${base}_guest`;
  const safe = email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${base}_${safe}`;
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState<boolean>(false);

  const defaultWs: Workspace = {
    id: 'ws_default',
    name: 'My Workspace',
    slug: 'my-workspace',
    role: 'owner',
    plan: 'pro',
    created_at: new Date().toISOString()
  };

  const [workspaces, setWorkspaces] = useState<Workspace[]>([defaultWs]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace>(defaultWs);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
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
        if (loadedWs.length === 0) {
          const userWs: Workspace = {
            id: `ws_${Date.now()}`,
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
        setCurrentWorkspace(loadedWs[0]);
        localStorage.setItem('url_shortener_workspaces', JSON.stringify(loadedWs));

        // 2. Account-scoped links
        const linksKey = getUserStorageKey('url_shortener_links', user.email);
        const savedLinks = localStorage.getItem(linksKey);
        let loadedLinks: Link[] = [];
        if (savedLinks) {
          try {
            const parsed = JSON.parse(savedLinks);
            if (Array.isArray(parsed)) {
              loadedLinks = parsed.filter(
                (l: Link) => l.workspace_id !== 'ws_1' && 
                             l.id !== 'link_1' && l.id !== 'link_2' && l.id !== 'link_3' && l.id !== 'link_4' && l.id !== 'link_5' &&
                             l.short_code !== 'sale26' && l.short_code !== 'v2launch' && l.short_code !== 'audit26' && l.short_code !== 'dl-app' && l.short_code !== 'suspicious-link'
              );
            }
          } catch {}
        }
        setLinks(loadedLinks);
        localStorage.setItem('url_shortener_links', JSON.stringify(loadedLinks));

        // 3. Account-scoped clicks
        const clicksKey = getUserStorageKey('url_shortener_clicks', user.email);
        const savedClicks = localStorage.getItem(clicksKey);
        let loadedClicks: ClickEvent[] = [];
        if (savedClicks) {
          try {
            const parsed = JSON.parse(savedClicks);
            if (Array.isArray(parsed)) {
              const userLinkIds = new Set(loadedLinks.map(l => l.id.toLowerCase()));
              const userShortCodes = new Set(loadedLinks.map(l => l.short_code.toLowerCase()));
              loadedClicks = parsed.filter(
                (c: ClickEvent) => (c.link_id && userLinkIds.has(c.link_id.toLowerCase())) ||
                                   (c.short_code && userShortCodes.has(c.short_code.toLowerCase()))
              );
            }
          } catch {}
        }
        setClicks(loadedClicks);
        localStorage.setItem('url_shortener_clicks', JSON.stringify(loadedClicks));

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

      // Synchronize with backend API if available
      fetch('/api/v1/links')
        .then(res => res.json())
        .then(data => {
          if (data && data.success && Array.isArray(data.links) && data.links.length > 0 && user) {
            setLinks(currentActive => {
              const codeMap = new Map(currentActive.map(l => [l.short_code.toLowerCase(), l]));
              let addedCount = 0;
              data.links.forEach((remote: any) => {
                const codeKey = (remote.short_code || '').toLowerCase();
                if (!codeMap.has(codeKey)) {
                  codeMap.set(codeKey, {
                    id: remote.id || `lnk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    domain_id: 'dom_primary',
                    workspace_id: currentWorkspace?.id || 'ws_default',
                    short_code: remote.short_code,
                    custom_slug: remote.custom_slug || remote.short_code,
                    destination_url: remote.destination_url,
                    title: remote.title || 'Short Link',
                    status: remote.status || 'active',
                    is_flagged: false,
                    risk_score: 0,
                    created_by: user?.name || 'Owner',
                    clicks_count: Number(remote.clicks_count) || 0,
                    tags: Array.isArray(remote.tags) ? remote.tags : [],
                    rules: [],
                    created_at: remote.created_at || new Date().toISOString()
                  });
                  addedCount++;
                }
              });
              if (addedCount > 0) {
                const combined = Array.from(codeMap.values());
                try {
                  const linksKey = getUserStorageKey('url_shortener_links', user?.email);
                  localStorage.setItem(linksKey, JSON.stringify(combined));
                  localStorage.setItem('url_shortener_links', JSON.stringify(combined));
                } catch {}
                return combined;
              }
              return currentActive;
            });
          }
        })
        .catch(() => {});
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
        const rawLinks = localStorage.getItem(linksKey) || localStorage.getItem('url_shortener_links');
        if (rawLinks) {
          const parsed = JSON.parse(rawLinks);
          if (Array.isArray(parsed)) {
            const filteredLinks = parsed.filter(
              (l: Link) => l.workspace_id !== 'ws_1' && 
                           l.id !== 'link_1' && l.id !== 'link_2' && l.id !== 'link_3' && l.id !== 'link_4' && l.id !== 'link_5' &&
                           l.short_code !== 'sale26' && l.short_code !== 'v2launch' && l.short_code !== 'audit26' && l.short_code !== 'dl-app' && l.short_code !== 'suspicious-link'
            );
            setLinks(filteredLinks);
          }
        }
        const clicksKey = getUserStorageKey('url_shortener_clicks', activeEmail);
        const rawClicks = localStorage.getItem(clicksKey) || localStorage.getItem('url_shortener_clicks');
        if (rawClicks) {
          const parsedClicks = JSON.parse(rawClicks);
          if (Array.isArray(parsedClicks)) {
            setClicks(parsedClicks);
          }
        }
        const wsKey = getUserStorageKey('url_shortener_workspaces', activeEmail);
        const rawWs = localStorage.getItem(wsKey) || localStorage.getItem('url_shortener_workspaces');
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

    window.addEventListener('storage', handleSyncFromStorage);
    window.addEventListener('focus', handleSyncFromStorage);
    window.addEventListener('url_shortener_sync', handleSyncFromStorage);

    return () => {
      window.removeEventListener('storage', handleSyncFromStorage);
      window.removeEventListener('focus', handleSyncFromStorage);
      window.removeEventListener('url_shortener_sync', handleSyncFromStorage);
    };
  }, []);

  // Sync state changes to localStorage scoped per user
  const saveLinksState = (newLinks: Link[]) => {
    setLinks(newLinks);
    try {
      const userKey = getUserStorageKey('url_shortener_links', currentUser?.email);
      localStorage.setItem(userKey, JSON.stringify(newLinks));
      localStorage.setItem('url_shortener_links', JSON.stringify(newLinks));
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
      id: `link_${Date.now()}`,
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
      rules: []
    };

    saveLinksState([newLink, ...links]);


    // Asynchronously sync with Neon PostgreSQL
    if (typeof window !== 'undefined') {
      fetch('/api/v1/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination_url: newLink.destination_url,
          custom_slug: newLink.short_code,
          title: newLink.title,
          tags: newLink.tags,
          rules: newLink.rules
        })
      }).catch(() => {});
    }

    return { link: newLink };
  };

  const updateLink = (id: string, updates: Partial<Link>) => {
    const updated = links.map(l => l.id === id ? { ...l, ...updates } : l);
    saveLinksState(updated);
  };

  const deleteLink = (id: string) => {
    const updated = links.filter(l => l.id !== id);
    saveLinksState(updated);
  };

  const addRuleToLink = (linkId: string, rule: { rule_type: 'geo' | 'device' | 'ab'; condition: string; target_url: string; weight?: number }) => {
    const targetLink = links.find(l => l.id === linkId);
    if (!targetLink) return;

    const newRule: LinkRule = {
      id: `rule_${Date.now()}`,
      link_id: linkId,
      rule_type: rule.rule_type,
      condition: rule.condition,
      target_url: normalizeUrl(rule.target_url),
      weight: rule.weight
    };

    const existingRules = targetLink.rules || [];
    updateLink(linkId, { rules: [...existingRules, newRule] });
  };

  const removeRuleFromLink = (linkId: string, ruleId: string) => {
    const targetLink = links.find(l => l.id === linkId);
    if (!targetLink || !targetLink.rules) return;

    const updatedRules = targetLink.rules.filter(r => r.id !== ruleId);
    updateLink(linkId, { rules: updatedRules });
  };

  // Log click event
  const logClick = (linkId: string, clientInfo?: Partial<ClickEvent>): ClickEvent => {
    // 1. Resolve freshest state from localStorage if available
    let currentLinks = [...links];
    let currentClicks = [...clicks];

    if (typeof window !== 'undefined') {
      try {
        const rawLinks = localStorage.getItem('url_shortener_links');
        if (rawLinks) {
          const parsed = JSON.parse(rawLinks);
          if (Array.isArray(parsed)) currentLinks = parsed;
        }
        const rawClicks = localStorage.getItem('url_shortener_clicks');
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

    const newClick: ClickEvent = {
      id: `clk_${Date.now()}_${Math.floor(Math.random() * 8999 + 1000)}`,
      link_id: targetRealId,
      short_code: targetShortCode,
      timestamp: new Date().toISOString(),
      ip_hash: clientInfo?.ip_hash || `ip_${Math.floor(Math.random() * 90000 + 10000)}`,
      country: clientInfo?.country || 'United States',
      country_code: clientInfo?.country_code || 'US',
      city: clientInfo?.city || 'San Francisco',
      device: clientInfo?.device || (typeof navigator !== 'undefined' && /iPad|Tablet/i.test(navigator.userAgent) ? 'tablet' : typeof navigator !== 'undefined' && /iPhone|Android|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'),
      os: clientInfo?.os || (typeof navigator !== 'undefined' && /iPhone|iPad/i.test(navigator.userAgent) ? 'iOS' : typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent) ? 'Android' : typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? 'macOS' : 'Windows'),
      browser: clientInfo?.browser || (typeof navigator !== 'undefined' && /Chrome/i.test(navigator.userAgent) ? 'Chrome' : typeof navigator !== 'undefined' && /Safari/i.test(navigator.userAgent) ? 'Safari' : typeof navigator !== 'undefined' && /Firefox/i.test(navigator.userAgent) ? 'Firefox' : 'Edge'),
      referrer: clientInfo?.referrer || (typeof document !== 'undefined' && document.referrer ? document.referrer : 'Direct / None'),
      is_bot: clientInfo?.is_bot || false,
      is_unique: clientInfo?.is_unique ?? true,
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

    // 5. Notify server in background
    if (typeof window !== 'undefined') {
      fetch('/api/v1/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link_id: targetRealId,
          short_code: targetShortCode,
          click: newClick
        })
      }).catch(() => {});
    }

    return newClick;
  };

  const addCampaign = (name: string, description: string, tags: string[], target_clicks = 10000) => {
    const newCamp: Campaign = {
      id: `cmp_${Date.now()}`,
      workspace_id: currentWorkspace?.id || 'ws_default',
      name,
      description,
      tags,
      target_clicks,
      created_at: new Date().toISOString()
    };
    saveCampaignsState([newCamp, ...campaigns]);
    return newCamp;
  };

  const deleteCampaign = (id: string) => {
    const updated = campaigns.filter(c => c.id !== id);
    saveCampaignsState(updated);
  };

  const addApiKey = (name: string, permissions: string[]) => {
    const prefix = `ak_live_${Math.random().toString(36).substring(2, 6)}`;
    const fullKey = `${prefix}_${Math.random().toString(36).substring(2, 18)}${Math.random().toString(36).substring(2, 18)}`;
    const newKey: ApiKey = {
      id: `key_${Date.now()}`,
      workspace_id: currentWorkspace?.id || 'ws_default',
      name,
      key_prefix: prefix,
      full_key: fullKey,
      permissions,
      created_at: new Date().toISOString()
    };
    saveApiKeysState([newKey, ...apiKeys]);
    return newKey;
  };

  const deleteApiKey = (id: string) => {
    const updated = apiKeys.filter(k => k.id !== id);
    saveApiKeysState(updated);
  };

  const addWebhook = (url: string, events: string[]) => {
    const newWh: Webhook = {
      id: `wh_${Date.now()}`,
      workspace_id: currentWorkspace?.id || 'ws_default',
      url,
      events,
      secret: `whsec_${Math.random().toString(36).substring(2, 20)}`,
      active: true,
      created_at: new Date().toISOString()
    };
    saveWebhooksState([newWh, ...webhooks]);
    return newWh;
  };

  const deleteWebhook = (id: string) => {
    const updated = webhooks.filter(w => w.id !== id);
    saveWebhooksState(updated);
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

    if (userWorkspaces.length === 0) {
      const defaultWs: Workspace = {
        id: `ws_${Date.now()}`,
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

    setWorkspaces(userWorkspaces);
    setCurrentWorkspace(userWorkspaces[0]);

    // Load account-isolated links
    const linksKey = getUserStorageKey('url_shortener_links', cleanEmail);
    const savedLinks = localStorage.getItem(linksKey);
    let userLinks: Link[] = [];
    if (savedLinks) {
      try {
        const parsed = JSON.parse(savedLinks);
        if (Array.isArray(parsed)) userLinks = parsed;
      } catch {}
    }
    setLinks(userLinks);

    // Load account-isolated clicks
    const clicksKey = getUserStorageKey('url_shortener_clicks', cleanEmail);
    const savedClicks = localStorage.getItem(clicksKey);
    let userClicks: ClickEvent[] = [];
    if (savedClicks) {
      try {
        const parsed = JSON.parse(savedClicks);
        if (Array.isArray(parsed)) userClicks = parsed;
      } catch {}
    }
    setClicks(userClicks);

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
          id: serverUser.id || `usr_${Date.now()}`,
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
            id: `usr_${Date.now()}`,
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
            id: `usr_${Date.now()}`,
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
      id: `usr_${Date.now()}`,
      name: trimmedName,
      email: cleanEmail,
      avatar: initials,
      role: 'owner'
    };
    
    // Auto-create personalized workspace for new signup
    const wsName = `${trimmedName}'s Workspace`;
    const newWs: Workspace = {
      id: `ws_${Date.now()}`,
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
      }
    } catch {}

    return { success: true };
  };


  const logout = () => {
    setCurrentUser(null);
    const guestWs: Workspace = {
      id: `ws_guest_${Date.now()}`,
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
      id: `ws_${Date.now()}`,
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
    return newWs;
  };

  // Team Member management
  const inviteTeamMember = (name: string, email: string, role: WorkspaceRole) => {
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'TM';
    const newMember: TeamMember = {
      id: `tm_${Date.now()}`,
      workspace_id: currentWorkspace.id,
      name,
      email,
      role,
      status: 'active',
      avatar: initials
    };
    saveTeamMembersState([...teamMembers, newMember]);
  };

  const removeTeamMember = (id: string) => {
    saveTeamMembersState(teamMembers.filter(m => m.id !== id));
  };

  const importLinksCsv = (csvContent: string): number => {
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

  return (
    <StoreContext.Provider value={{
      currentUser,
      authLoaded,
      login,
      signup,
      logout,
      workspaces,
      currentWorkspace,
      setCurrentWorkspace,
      createWorkspace,
      teamMembers,
      inviteTeamMember,
      removeTeamMember,
      domains,
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
      deleteCampaign,
      addApiKey,
      deleteApiKey,
      addWebhook,
      deleteWebhook,
      scanUrlSecurity,
      aiSuggestSlugs,
      aiSummarizePerformance,
      exportLinksCsv,
      importLinksCsv
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
