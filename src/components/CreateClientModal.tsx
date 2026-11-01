'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';
import { ClientPortalAccount } from '@/lib/types';
import { 
  Building2, 
  Mail, 
  User, 
  Key, 
  Globe2, 
  Link2, 
  Target, 
  ShieldCheck, 
  Palette, 
  X, 
  Check, 
  Sliders, 
  Lock,
  Layers,
  Search,
  ChevronDown
} from 'lucide-react';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientToEdit?: ClientPortalAccount | null;
}

export const CreateClientModal: React.FC<CreateClientModalProps> = ({
  isOpen,
  onClose,
  clientToEdit
}) => {
  const { links, campaigns, domains, addClient, updateClient } = useStore();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [brandColor, setBrandColor] = useState('#65a30d');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');

  // Permissions
  const [canViewAnalytics, setCanViewAnalytics] = useState(true);
  const [canEditDestinationUrl, setCanEditDestinationUrl] = useState(false);
  const [canCreateLinks, setCanCreateLinks] = useState(false);
  const [maxLinksQuota, setMaxLinksQuota] = useState(10);

  // Scoping
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');

  const [activeTab, setActiveTab] = useState<'info' | 'scoping' | 'permissions' | 'branding'>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentHost = typeof window !== 'undefined' && window.location.host 
    ? window.location.host 
    : (process.env.NEXT_PUBLIC_CNAME_TARGET || 'creataurus.work.gd');

  // Ensure current host domain (localhost in dev or deployed domain in prod) is always present
  const availableDomains = useMemo(() => {
    const list = Array.isArray(domains) ? [...domains] : [];
    const hasHost = list.some(d => d.hostname && d.hostname.toLowerCase() === currentHost.toLowerCase());
    if (!hasHost) {
      list.unshift({
        id: 'dom_platform_host',
        workspace_id: 'ws_default',
        hostname: currentHost,
        verified: true,
        ssl_status: 'active',
        is_default: true,
        created_at: new Date().toISOString()
      });
    }
    return list;
  }, [domains, currentHost]);

  const primaryDomain = availableDomains.find(d => d.is_default || d.id === 'dom_platform' || d.id === 'dom_platform_host') || availableDomains[0];

  // Populate when editing
  useEffect(() => {
    const defaultHost = availableDomains.find(d => d.is_default)?.hostname || availableDomains[0]?.hostname || currentHost;
    if (clientToEdit) {
      setName(clientToEdit.name || '');
      setEmail(clientToEdit.email || '');
      setCompanyName(clientToEdit.company_name || '');
      setPassword('');
      setCustomDomain(clientToEdit.custom_domain || defaultHost);
      setBrandColor(clientToEdit.brand_color || '#65a30d');
      setBrandLogoUrl(clientToEdit.brand_logo_url || '');
      setCanViewAnalytics(clientToEdit.can_view_analytics !== false);
      setCanEditDestinationUrl(Boolean(clientToEdit.can_edit_destination_url));
      setCanCreateLinks(Boolean(clientToEdit.can_create_links));
      setMaxLinksQuota(clientToEdit.max_links_quota || 10);
      setSelectedLinkIds(clientToEdit.assigned_link_ids || []);
      setSelectedCampaignIds(clientToEdit.assigned_campaign_ids || []);
    } else {
      setName('');
      setEmail('');
      setCompanyName('');
      setPassword('');
      setCustomDomain(defaultHost);
      setBrandColor('#65a30d');
      setBrandLogoUrl('');
      setCanViewAnalytics(true);
      setCanEditDestinationUrl(false);
      setCanCreateLinks(false);
      setMaxLinksQuota(10);
      setSelectedLinkIds([]);
      setSelectedCampaignIds([]);
    }
  }, [clientToEdit, isOpen, availableDomains, currentHost]);

  if (!mounted || !isOpen) return null;

  const portalDisplayHost = customDomain || primaryDomain?.hostname || currentHost;

  const filteredLinks = links.filter(l => {
    const q = linkSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (l.title && l.title.toLowerCase().includes(q)) ||
      (l.short_code && l.short_code.toLowerCase().includes(q)) ||
      (l.custom_slug && l.custom_slug.toLowerCase().includes(q)) ||
      (l.destination_url && l.destination_url.toLowerCase().includes(q))
    );
  });

  const toggleLinkSelection = (linkId: string) => {
    setSelectedLinkIds(prev => 
      prev.includes(linkId) ? prev.filter(id => id !== linkId) : [...prev, linkId]
    );
  };

  const toggleCampaignSelection = (campId: string) => {
    setSelectedCampaignIds(prev => {
      const willSelect = !prev.includes(campId);
      const nextCampaignIds = willSelect ? [...prev, campId] : prev.filter(id => id !== campId);
      
      // Auto-select links belonging to this campaign
      const camp = campaigns.find(c => c.id === campId);
      if (camp && willSelect) {
        const campaignLinks = links.filter(l => 
          l.campaign_id === camp.id || 
          (Array.isArray(l.tags) && Array.isArray(camp.tags) && l.tags.some(t => camp.tags.includes(t)))
        );
        if (campaignLinks.length > 0) {
          setSelectedLinkIds(prevLinks => Array.from(new Set([...prevLinks, ...campaignLinks.map(l => l.id)])));
        }
      }
      return nextCampaignIds;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('error', 'Client name is required');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      showToast('error', 'A valid client email address is required');
      return;
    }
    if (!companyName.trim()) {
      showToast('error', 'Company or brand name is required');
      return;
    }
    if (!clientToEdit && !password.trim()) {
      showToast('error', 'Password is required for client portal login');
      return;
    }

    setIsSubmitting(true);
    try {
      // Gather all directly and campaign-associated link IDs
      const campaignLinkIds = links.filter(l => 
        l.campaign_id && selectedCampaignIds.includes(l.campaign_id)
      ).map(l => l.id);

      const allAssignedIds = Array.from(new Set([...selectedLinkIds, ...campaignLinkIds]));
      const assignedLinksPayload = links.filter(l => allAssignedIds.includes(l.id));

      if (clientToEdit) {
        const updates: any = {
          name: name.trim(),
          company_name: companyName.trim(),
          custom_domain: customDomain.trim() || undefined,
          brand_color: brandColor,
          brand_logo_url: brandLogoUrl.trim() || undefined,
          can_view_analytics: canViewAnalytics,
          can_edit_destination_url: canEditDestinationUrl,
          can_create_links: canCreateLinks,
          max_links_quota: Number(maxLinksQuota) || 10,
          assigned_link_ids: allAssignedIds,
          assigned_campaign_ids: selectedCampaignIds,
          assigned_links: assignedLinksPayload
        };
        if (password.trim()) {
          updates.password = password.trim();
        }
        const res = await updateClient(clientToEdit.id, updates);
        if (res.success) {
          showToast('success', 'Client portal updated successfully.');
          onClose();
        } else {
          showToast('error', res.error || 'Failed to update client.');
        }
      } else {
        const payload: any = {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          company_name: companyName.trim(),
          password: password.trim(),
          custom_domain: customDomain.trim() || undefined,
          brand_color: brandColor,
          brand_logo_url: brandLogoUrl.trim() || undefined,
          can_view_analytics: canViewAnalytics,
          can_edit_destination_url: canEditDestinationUrl,
          can_create_links: canCreateLinks,
          max_links_quota: Number(maxLinksQuota) || 10,
          assigned_link_ids: allAssignedIds,
          assigned_campaign_ids: selectedCampaignIds,
          assigned_links: assignedLinksPayload
        };
        const res = await addClient(payload);
        if (res.success) {
          showToast('success', 'Client portal account created successfully.');
          onClose();
        } else {
          showToast('error', res.error || 'Failed to create client.');
        }
      }
    } catch {
      showToast('error', 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border-[0.5px] border-outline-variant relative animate-fade-in max-h-[92vh] overflow-y-auto custom-scrollbar text-on-surface flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-on-surface">
                  {clientToEdit ? 'Edit client' : 'Add client'}
                </h2>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-Step Category Tabs */}
        <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-xl border-[0.5px] border-outline-variant my-4 text-xs overflow-x-auto">
          {[
            { id: 'info', label: 'Account', icon: User },
            { id: 'scoping', label: 'Links', icon: Link2, badge: selectedLinkIds.length + selectedCampaignIds.length },
            { id: 'permissions', label: 'Permissions', icon: ShieldCheck },
            { id: 'branding', label: 'Branding', icon: Palette }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-surface-container-lowest text-primary-ink shadow-xs font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary-container text-on-primary font-mono font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-4">
          
          {/* TAB 1: Account Credentials */}
          {activeTab === 'info' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <label className="text-xs font-bold text-on-surface">Contact name</label>
                  </div>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
                    <input
                      type="text"
                      placeholder="e.g. Sarah Connor"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-lg text-xs text-on-surface border-[0.5px] border-outline-variant outline-none focus:ring-2 focus:ring-primary-strong"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <label className="text-xs font-bold text-on-surface">Company</label>
                  </div>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
                    <input
                      type="text"
                      placeholder="e.g. Cyberdyne Systems"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-lg text-xs text-on-surface border-[0.5px] border-outline-variant outline-none focus:ring-2 focus:ring-primary-strong"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <label className="text-xs font-bold text-on-surface">Login email</label>
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
                    <input
                      type="email"
                      placeholder="client@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={Boolean(clientToEdit)}
                      required
                      className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-lg text-xs text-on-surface border-[0.5px] border-outline-variant outline-none focus:ring-2 focus:ring-primary-strong disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <label className="text-xs font-bold text-on-surface">
                      {clientToEdit ? 'New password (optional)' : 'Password'}
                    </label>
                  </div>
                  <div className="relative">
                    <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
                    <input
                      type="password"
                      placeholder={clientToEdit ? '••••••••' : 'Enter client password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={!clientToEdit}
                      className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-lg text-xs text-on-surface border-[0.5px] border-outline-variant outline-none focus:ring-2 focus:ring-primary-strong"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Resource Scoping */}
          {activeTab === 'scoping' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                    Links
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    {selectedLinkIds.length} selected
                  </p>
                </div>
              </div>

              {/* Search Links */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
                <input
                  type="text"
                  placeholder="Search links"
                  value={linkSearchQuery}
                  onChange={(e) => setLinkSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-surface-container-low rounded-lg text-xs text-on-surface border-[0.5px] border-outline-variant outline-none"
                />
              </div>

              {/* Links List */}
              <div className="max-h-44 overflow-y-auto space-y-1.5 border-[0.5px] border-outline-variant rounded-xl p-2 bg-surface-container-low/30 custom-scrollbar">
                {filteredLinks.length === 0 ? (
                  <div className="py-6 text-center text-xs text-on-surface-variant">
                    No matching short links found in this workspace.
                  </div>
                ) : (
                  filteredLinks.map(l => {
                    const isSelected = selectedLinkIds.includes(l.id);
                    return (
                      <div
                        key={l.id}
                        onClick={() => toggleLinkSelection(l.id)}
                        className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition text-xs ${
                          isSelected
                            ? 'bg-primary-container/15 border-primary-strong/40 text-on-surface font-semibold'
                            : 'bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${isSelected ? 'bg-primary-container text-on-primary border-primary-strong' : 'border-outline-variant'}`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-bold text-on-surface">{l.title || 'Untitled Link'}</span>
                            <span className="text-[10px] font-mono text-primary-ink truncate">/{l.custom_slug || l.short_code}</span>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] shrink-0 text-on-surface-variant">
                          {(l.clicks_count || 0).toLocaleString()} clicks
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Assign Campaigns */}
              <div className="pt-2 border-t border-outline-variant">
                <div className="flex items-center gap-1 mb-1.5">
                  <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                    Campaigns
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {campaigns.length === 0 ? (
                    <div className="col-span-2 py-3 text-center text-xs text-on-surface-variant">
                      No marketing campaigns created yet.
                    </div>
                  ) : (
                    campaigns.map(c => {
                      const isSelected = selectedCampaignIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleCampaignSelection(c.id)}
                          className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition text-xs ${
                            isSelected
                              ? 'bg-primary-container/15 border-primary-strong/40 text-on-surface font-semibold'
                              : 'bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${isSelected ? 'bg-primary-container text-on-primary border-primary-strong' : 'border-outline-variant'}`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span className="truncate">{c.name}</span>
                          </div>
                          <Target className="w-3.5 h-3.5 text-primary-ink shrink-0" />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Permissions */}
          {activeTab === 'permissions' && (
            <div className="space-y-4 animate-fade-in">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                The client can
              </span>

              {/* Permission 1: View Analytics Only */}
              <label className="p-3.5 bg-surface-container-low rounded-xl border-[0.5px] border-outline-variant flex items-start justify-between cursor-pointer hover:bg-surface-container transition">
                <div className="flex flex-col pr-4">
                  <span className="text-xs font-bold text-on-surface">View analytics</span>
                  <span className="text-[11px] text-on-surface-variant mt-0.5">
                    Clicks, locations, devices and referrers for their links.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={canViewAnalytics}
                  onChange={(e) => setCanViewAnalytics(e.target.checked)}
                  className="w-4 h-4 text-primary-ink rounded cursor-pointer mt-0.5"
                />
              </label>

              {/* Permission 2: Edit Destination URLs */}
              <label className="p-3.5 bg-surface-container-low rounded-xl border-[0.5px] border-outline-variant flex items-start justify-between cursor-pointer hover:bg-surface-container transition">
                <div className="flex flex-col pr-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-on-surface">Edit destination URLs</span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant mt-0.5">
                    Change where their links go. The short link stays the same.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={canEditDestinationUrl}
                  onChange={(e) => setCanEditDestinationUrl(e.target.checked)}
                  className="w-4 h-4 text-primary-ink rounded cursor-pointer mt-0.5"
                />
              </label>

              {/* Permission 3: Create New Links */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border-[0.5px] border-outline-variant space-y-3">
                <label className="flex items-start justify-between cursor-pointer">
                  <div className="flex flex-col pr-4">
                    <span className="text-xs font-bold text-on-surface">Create links</span>
                    <span className="text-[11px] text-on-surface-variant mt-0.5">
                      On their portal domain.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={canCreateLinks}
                    onChange={(e) => setCanCreateLinks(e.target.checked)}
                    className="w-4 h-4 text-primary-ink rounded cursor-pointer mt-0.5"
                  />
                </label>

                {canCreateLinks && (
                  <div className="pt-2 border-t-[0.5px] border-outline-variant flex items-center justify-between text-xs">
                    <span className="font-semibold text-on-surface">Link limit</span>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={maxLinksQuota}
                      onChange={(e) => setMaxLinksQuota(Number(e.target.value))}
                      className="w-24 px-2 py-1 bg-surface-container-lowest rounded-lg border-[0.5px] border-outline-variant text-xs font-mono text-right"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: White-Label Branding */}
          {activeTab === 'branding' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <label htmlFor="portalDomainSelect" className="text-xs font-bold text-on-surface">Portal domain</label>
                </div>
                <div className="relative">
                  <Globe2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
                  <select
                    id="portalDomainSelect"
                    value={customDomain || primaryDomain?.hostname || currentHost}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    className="w-full appearance-none pl-9 pr-8 py-2 bg-surface-container-low text-on-surface font-mono text-xs rounded-lg border-[0.5px] border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary-strong transition-all cursor-pointer font-medium"
                  >
                    {availableDomains.map((d) => (
                      <option key={d.id} value={d.hostname} disabled={!d.verified}>
                        {d.hostname} {d.is_default || d.id === 'dom_platform' || d.id === 'dom_platform_host' || d.hostname.toLowerCase() === currentHost.toLowerCase() ? '(Primary Host)' : (d.verified ? '' : '(Pending DNS)')}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant flex items-center">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <label className="text-xs font-bold text-on-surface">Brand color</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border-[0.5px] border-outline-variant cursor-pointer p-0.5 bg-surface-container-low"
                    />
                    <input
                      type="text"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="flex-1 px-3 py-2 bg-surface-container-low rounded-lg text-xs font-mono border-[0.5px] border-outline-variant outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <label className="text-xs font-bold text-on-surface">Logo URL <span className="font-normal text-outline">(optional)</span></label>
                  </div>
                  <input
                    type="url"
                    placeholder="https://client.com/logo.png"
                    value={brandLogoUrl}
                    onChange={(e) => setBrandLogoUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-xs text-on-surface border-[0.5px] border-outline-variant outline-none focus:ring-2 focus:ring-primary-strong"
                  />
                </div>
              </div>

              {/* Portal URL preview */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border-[0.5px] border-outline-variant text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Portal login
                  </span>
                </div>
                <div className="font-mono text-primary-ink font-semibold text-xs bg-surface-container-lowest px-3 py-2 rounded-lg border-[0.5px] border-outline-variant flex items-center gap-2 overflow-hidden">
                  <Globe2 className="w-3.5 h-3.5 text-primary-ink shrink-0" />
                  <span className="truncate">https://{portalDisplayHost}/portal/login</span>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="pt-4 border-t-[0.5px] border-outline-variant mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {activeTab !== 'branding' ? (
                <button
                  type="button"
                  onClick={() => {
                    const tabs = ['info', 'scoping', 'permissions', 'branding'];
                    const next = tabs[tabs.indexOf(activeTab) + 1];
                    if (next) setActiveTab(next as any);
                  }}
                  className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface text-xs font-semibold hover:bg-surface-container-highest transition cursor-pointer"
                >
                  Next
                </button>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-primary-container text-on-primary text-xs font-bold hover:bg-primary transition shadow-xs cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <span>Saving…</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{clientToEdit ? 'Save changes' : 'Create client'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>,
    document.body
  );
};
