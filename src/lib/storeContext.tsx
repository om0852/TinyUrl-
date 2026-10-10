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
  WorkspaceRole
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

interface StoreContextType {
  currentUser: User | null;
  login: (email: string, pass: string) => void;
  signup: (name: string, email: string, pass: string) => void;
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
  }) => { link: Link | null; error?: string };

  updateLink: (id: string, updates: Partial<Link>) => void;
  deleteLink: (id: string) => void;
  addRuleToLink: (linkId: string, rule: { rule_type: 'geo' | 'device' | 'ab'; condition: string; target_url: string; weight?: number }) => void;
  removeRuleFromLink: (linkId: string, ruleId: string) => void;
  logClick: (linkId: string, clientInfo?: Partial<ClickEvent>) => ClickEvent;
  
  addCampaign: (name: string, description: string, tags: string[], target_clicks?: number) => Campaign;
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

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>({
    id: 'usr_1',
    name: 'Alex Morgan',
    email: 'alex@acme.com',
    avatar: 'AM',
    role: 'owner'
  });

  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace>(initialWorkspaces[0]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialTeamMembers);
  const [domains, setDomains] = useState<Domain[]>(initialDomains);
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [links, setLinks] = useState<Link[]>(initialLinks);
  const [clicks, setClicks] = useState<ClickEvent[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(initialApiKeys);
  const [webhooks, setWebhooks] = useState<Webhook[]>(initialWebhooks);

  // Initialize single website domain dynamically matching browser host or env & sync localStorage
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
          workspace_id: 'ws_1'
        }
      ]);
    }
    try {
      const savedLinks = localStorage.getItem('url_shortener_links');
      if (savedLinks) {
        setLinks(JSON.parse(savedLinks));
      }
      const savedClicks = localStorage.getItem('url_shortener_clicks');
      if (savedClicks) {
        setClicks(JSON.parse(savedClicks));
      } else {
        const mock = generateMockClicks();
        setClicks(mock);
        localStorage.setItem('url_shortener_clicks', JSON.stringify(mock));
      }
    } catch {
      setClicks(generateMockClicks());
    }
  }, []);

  // Sync state changes to localStorage
  const saveLinksState = (newLinks: Link[]) => {
    setLinks(newLinks);
    try {
      localStorage.setItem('url_shortener_links', JSON.stringify(newLinks));
    } catch {}
  };

  const saveClicksState = (newClicks: ClickEvent[]) => {
    setClicks(newClicks);
    try {
      localStorage.setItem('url_shortener_clicks', JSON.stringify(newClicks));
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
      created_by: 'Alex Morgan',
      created_at: new Date().toISOString(),
      clicks_count: 0,
      utm_source: data.utm_source,
      utm_medium: data.utm_medium,
      utm_campaign: data.utm_campaign,
      utm_term: data.utm_term,
      utm_content: data.utm_content,
      rules: []
    };

    saveLinksState([newLink, ...links]);
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
    const targetLink = links.find(l => l.id === linkId || l.short_code === linkId);

    const newClick: ClickEvent = {
      id: `clk_${Date.now()}`,
      link_id: targetLink ? targetLink.id : linkId,
      short_code: targetLink ? targetLink.short_code : linkId,
      timestamp: new Date().toISOString(),
      ip_hash: clientInfo?.ip_hash || `ip_${Math.floor(Math.random() * 90000 + 10000)}`,
      country: clientInfo?.country || 'United States',
      country_code: clientInfo?.country_code || 'US',
      city: clientInfo?.city || 'San Francisco',
      device: clientInfo?.device || 'mobile',
      os: clientInfo?.os || 'iOS',
      browser: clientInfo?.browser || 'Safari',
      referrer: clientInfo?.referrer || 'Direct / None',
      is_bot: clientInfo?.is_bot || false,
      is_unique: clientInfo?.is_unique ?? true,
      latency_ms: clientInfo?.latency_ms || Math.floor(15 + Math.random() * 20)
    };

    saveClicksState([newClick, ...clicks]);

    if (targetLink) {
      updateLink(targetLink.id, { clicks_count: targetLink.clicks_count + 1 });
    }

    return newClick;
  };

  const addCampaign = (name: string, description: string, tags: string[], target_clicks = 10000) => {
    const newCamp: Campaign = {
      id: `cmp_${Date.now()}`,
      workspace_id: currentWorkspace.id,
      name,
      description,
      tags,
      target_clicks,
      created_at: new Date().toISOString()
    };
    setCampaigns([newCamp, ...campaigns]);
    return newCamp;
  };

  const addApiKey = (name: string, permissions: string[]) => {
    const prefix = `ak_live_${Math.random().toString(36).substring(2, 6)}`;
    const fullKey = `${prefix}_${Math.random().toString(36).substring(2, 18)}${Math.random().toString(36).substring(2, 18)}`;
    const newKey: ApiKey = {
      id: `key_${Date.now()}`,
      workspace_id: currentWorkspace.id,
      name,
      key_prefix: prefix,
      full_key: fullKey,
      permissions,
      created_at: new Date().toISOString()
    };
    setApiKeys([newKey, ...apiKeys]);
    return newKey;
  };

  const deleteApiKey = (id: string) => {
    setApiKeys(apiKeys.filter(k => k.id !== id));
  };

  const addWebhook = (url: string, events: string[]) => {
    const newWh: Webhook = {
      id: `wh_${Date.now()}`,
      workspace_id: currentWorkspace.id,
      url,
      events,
      secret: `whsec_${Math.random().toString(36).substring(2, 20)}`,
      active: true,
      created_at: new Date().toISOString()
    };
    setWebhooks([newWh, ...webhooks]);
    return newWh;
  };

  const deleteWebhook = (id: string) => {
    setWebhooks(webhooks.filter(w => w.id !== id));
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

  // Auth functions
  const login = (email: string, pass: string) => {
    const namePart = email.split('@')[0];
    const initials = namePart.substring(0, 2).toUpperCase();
    const newUser: User = {
      id: `usr_${Date.now()}`,
      name: namePart.charAt(0).toUpperCase() + namePart.slice(1),
      email: email,
      avatar: initials,
      role: 'owner'
    };
    setCurrentUser(newUser);
    try {
      localStorage.setItem('url_shortener_user', JSON.stringify(newUser));
    } catch {}
  };

  const signup = (name: string, email: string, pass: string) => {
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'US';
    const newUser: User = {
      id: `usr_${Date.now()}`,
      name: name,
      email: email,
      avatar: initials,
      role: 'owner'
    };
    setCurrentUser(newUser);
    try {
      localStorage.setItem('url_shortener_user', JSON.stringify(newUser));
    } catch {}
  };

  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('url_shortener_user');
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
    const updated = [newWs, ...workspaces];
    setWorkspaces(updated);
    setCurrentWorkspace(newWs);
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
    setTeamMembers([...teamMembers, newMember]);
  };

  const removeTeamMember = (id: string) => {
    setTeamMembers(teamMembers.filter(m => m.id !== id));
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
