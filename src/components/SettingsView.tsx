'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { Domain } from '@/lib/types';
import {
  Camera,
  Check,
  Copy,
  Server,
  Globe2,
  Info,
  Mail,
  Plus,
  RefreshCw,
  Smartphone,
  Video,
  CheckCircle2,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  X,
  Zap,
  SlidersHorizontal,
  Sparkles,
  Layers,
  Lock,
  User,
  Globe
} from 'lucide-react';

interface SettingsViewProps {
  onNavigateTab?: (tab: string) => void;
}

type SettingsTab = 'profile' | 'domains' | 'social' | 'privacy' | 'billing';

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigateTab }) => {
  const {
    currentUser,
    currentWorkspace,
    domains,
    links,
    teamMembers,
    addDomain,
    verifyDomain,
    updateDomainConfig,
    deleteDomain,
    updateWorkspace,
    checkPermissionOrToast
  } = useStore();

  const [mounted, setMounted] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('profile');

  // Profile Form state
  const [displayName, setDisplayName] = useState(
    currentWorkspace?.name || currentUser?.name || 'My Workspace'
  );
  const [vanityHandle, setVanityHandle] = useState('workspace');
  const [contactEmail, setContactEmail] = useState(currentUser?.email || '');
  const [languageRegion, setLanguageRegion] = useState('en-US');
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Social Channels state
  const [socialChannels, setSocialChannels] = useState({
    youtube: { handle: '', enabled: true },
    instagram: { handle: '', enabled: true },
    tiktok: { handle: '', enabled: true },
    twitter: { handle: '', enabled: true }
  });

  // Privacy & Tracking Preferences
  const [privacyPreferences, setPrivacyPreferences] = useState({
    cookieless: true,
    utmAuto: true,
    alerts: true,
  });

  // Save changes state feedback
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [copiedWsId, setCopiedWsId] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add Domain Modal & DNS Verification States
  const [addDomainModalOpen, setAddDomainModalOpen] = useState(false);
  const [newDomainHostname, setNewDomainHostname] = useState('');
  const [newDomainRootRedirect, setNewDomainRootRedirect] = useState('');
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const [expandedDnsDomainId, setExpandedDnsDomainId] = useState<string | null>(null);
  const [copiedTokenDomainId, setCopiedTokenDomainId] = useState<string | null>(null);
  const [copiedCnameDomainId, setCopiedCnameDomainId] = useState<string | null>(null);
  const [copiedIpDomainId, setCopiedIpDomainId] = useState<string | null>(null);

  const edgeProxyIp = process.env.NEXT_PUBLIC_EDGE_PROXY_IP || '159.54.139.45';
  const cnameTarget = process.env.NEXT_PUBLIC_CNAME_TARGET || 'creataurus.work.gd';

  // Upgrade Plan Modal
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const originDomain = typeof window !== 'undefined' ? window.location.host : 'tinyurl.dev';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load workspace-isolated settings from localStorage or defaults
  useEffect(() => {
    if (!currentWorkspace?.id) return;
    const storageKey = `workspace_settings_${currentWorkspace.id}`;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.vanityHandle) setVanityHandle(parsed.vanityHandle);
        if (parsed.contactEmail) setContactEmail(parsed.contactEmail);
        if (parsed.languageRegion) setLanguageRegion(parsed.languageRegion);
        if (parsed.customAvatar) setCustomAvatar(parsed.customAvatar);
        if (parsed.socialChannels) setSocialChannels(parsed.socialChannels);
        if (parsed.privacyPreferences) setPrivacyPreferences(parsed.privacyPreferences);
      } else {
        const defaultHandle = currentWorkspace.slug || (currentUser?.name ? currentUser.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'workspace');
        setVanityHandle(defaultHandle);
        setContactEmail(currentUser?.email || '');
      }
    } catch { }

    setDisplayName(currentWorkspace.name || 'My Workspace');
  }, [currentWorkspace?.id, currentUser?.email]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyHandle = () => {
    const fullUrl = `https://${originDomain}/${vanityHandle}`;
    navigator.clipboard.writeText(fullUrl).catch(() => { });
    setCopiedHandle(true);
    showToast(`Copied vanity URL: ${fullUrl}`);
    setTimeout(() => setCopiedHandle(false), 2000);
  };

  const handleCopyWsId = () => {
    if (!currentWorkspace?.id) return;
    navigator.clipboard.writeText(currentWorkspace.id).catch(() => { });
    setCopiedWsId(true);
    showToast(`Copied Workspace ID: ${currentWorkspace.id}`);
    setTimeout(() => setCopiedWsId(false), 2000);
  };

  // Avatar Upload Handler
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Image file must be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setCustomAvatar(result);
      showToast('Profile photo updated.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setCustomAvatar(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
    showToast('Profile photo removed.');
  };

  // Real Save Changes Action
  const handleSaveAll = async () => {
    if (!checkPermissionOrToast('settings:manage', 'save workspace settings')) {
      return;
    }

    setIsSaving(true);
    try {
      // 1. Update workspace in PostgreSQL and state
      if (currentWorkspace?.id && displayName.trim()) {
        await updateWorkspace(currentWorkspace.id, displayName.trim(), vanityHandle.trim());
      }

      // 2. Persist workspace settings in localStorage
      const storageKey = `workspace_settings_${currentWorkspace?.id || 'default'}`;
      const payload = {
        vanityHandle: vanityHandle.trim(),
        contactEmail: contactEmail.trim(),
        languageRegion,
        customAvatar,
        socialChannels,
        privacyPreferences,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));

      setSavedSuccess(true);
      showToast('Settings saved successfully.');
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.warn('Failed to save settings:', err);
      showToast('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // DNS Verification for Domain (Supports live DNS check and Developer Demo Simulation)
  const handleTestDomainDns = async (domainId: string, hostname: string, simulateBypass = false) => {
    setVerifyingDomainId(domainId);
    try {
      const res = await verifyDomain(domainId, simulateBypass);
      if (res.verified) {
        showToast(`Domain ${hostname} verified! Organization ownership (TXT) & Edge routing (CNAME) active.`);
      } else {
        showToast(res.message || `DNS verification pending for ${hostname}.`);
      }
    } catch {
      showToast(`DNS check failed for ${hostname}.`);
    } finally {
      setVerifyingDomainId(null);
    }
  };

  // Handle Add Domain
  const handleSaveNewDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainHostname.trim()) return;

    if (!checkPermissionOrToast('domains:manage', 'add custom domains')) {
      return;
    }

    setIsAddingDomain(true);
    try {
      const cleanHost = newDomainHostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      const created = await addDomain(cleanHost, false, newDomainRootRedirect.trim() || undefined);
      if (created) {
        showToast(`Registered ${cleanHost}. Please configure DNS records below to verify organization ownership.`);
        setNewDomainHostname('');
        setNewDomainRootRedirect('');
        setAddDomainModalOpen(false);
        setExpandedDnsDomainId(created.id);
      } else {
        showToast(`Domain registration failed.`);
      }
    } finally {
      setIsAddingDomain(false);
    }
  };

  // Handle Set Primary Domain
  const handleSetPrimaryDomain = async (domainId: string, hostname: string) => {
    if (!checkPermissionOrToast('domains:manage', 'configure custom domains')) {
      return;
    }
    const success = await updateDomainConfig(domainId, { is_primary: true });
    if (success) {
      showToast(`${hostname} set as default workspace domain.`);
    }
  };

  // Handle Delete Domain
  const handleDeleteDomain = async (domainId: string, hostname: string) => {
    if (!checkPermissionOrToast('domains:manage', 'delete custom domains')) {
      return;
    }
    await deleteDomain(domainId);
    showToast(`Domain ${hostname} removed.`);
  };

  // Active domains list for current workspace
  const displayDomains: Domain[] = useMemo(() => {
    return domains;
  }, [domains]);

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto space-y-6 pb-24 animate-fade-in text-on-surface">

      {/* 1. PAGE HEADER */}
      <div className="flex flex-col gap-1 pt-1">
        <div className="flex items-center gap-2 text-on-surface-variant font-mono text-xs uppercase tracking-wider">
          <span>WORKSPACE</span>
          <span>/</span>
          <span className="text-primary-container font-semibold">SETTINGS</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
              Settings &amp; Workspace Profile
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-2xl">
              Configure your workspace brand, custom branded domains, social channel handles, and link privacy preferences.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-surface-container-high rounded-full text-xs text-on-surface font-semibold border border-outline-variant/30 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{currentWorkspace?.plan ? `${currentWorkspace.plan.toUpperCase()} Plan` : 'Pro Active'}</span>
            </span>

            <button
              type="button"
              onClick={handleCopyWsId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface rounded-xl text-xs font-mono font-medium border border-outline-variant/30 transition cursor-pointer"
              title="Click to copy Workspace ID"
            >
              <span>{currentWorkspace?.id || 'ws_default'}</span>
              {copiedWsId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 2. SETTINGS HORIZONTAL TABS */}
      <div className="bg-surface-container-low p-1.5 rounded-2xl flex items-center gap-1 overflow-x-auto shadow-xs border border-outline-variant/30 text-xs font-bold">
        {[
          { id: 'profile', label: 'Workspace Profile', icon: User },
          { id: 'domains', label: `Branded Domains (${domains.length})`, icon: Globe },
          { id: 'social', label: 'Social Channels', icon: Video },
          { id: 'privacy', label: 'Tracking & Privacy', icon: ShieldCheck },
          { id: 'billing', label: 'Billing & Quotas', icon: Sparkles }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSettingsTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSettingsTab(tab.id as SettingsTab)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${isActive
                  ? 'bg-surface-container-lowest text-primary-container shadow-xs font-extrabold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. TAB 1: CREATOR & WORKSPACE PROFILE */}
      {activeSettingsTab === 'profile' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-outline-variant/30 p-6 flex flex-col gap-6 animate-fade-in">
          <div className="flex items-start justify-between pb-3 border-b border-outline-variant/20">
            <div>
              <h2 className="text-base font-bold text-on-surface">Workspace Brand &amp; Profile</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Public presence details used across all generated bio links, Open Graph cards, and landing pages.
              </p>
            </div>
            <span className="font-mono text-xs text-on-surface-variant bg-surface-container-low px-2.5 py-1 rounded-lg border border-outline-variant/30">
              ID: {currentWorkspace?.id || 'ws_default'}
            </span>
          </div>

          {/* Avatar Uploader & Info */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-5 rounded-xl bg-surface-container-low border border-outline-variant/30">
            <div className="relative group shrink-0">
              <input
                type="file"
                ref={avatarInputRef}
                onChange={handleAvatarFileChange}
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
              />
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="w-20 h-20 rounded-2xl overflow-hidden shadow-xs bg-primary-container text-on-primary flex items-center justify-center text-2xl font-bold border-2 border-surface-container-lowest cursor-pointer hover:opacity-90 transition relative"
                title="Click to change photo"
              >
                {customAvatar ? (
                  <img src={customAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : currentUser?.avatar ? (
                  currentUser.avatar
                ) : (
                  (currentUser?.name || 'W').charAt(0).toUpperCase()
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                  <Camera className="w-5 h-5" />
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 bg-surface-container-lowest p-1 rounded-full shadow-xs text-primary-container border border-outline-variant/30">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-base font-bold text-on-surface">
                  {displayName || currentWorkspace?.name || 'Workspace Owner'}
                </span>
                <span className="px-2.5 py-0.5 bg-surface-container-high rounded-full text-xs text-primary-container font-semibold w-fit mx-auto sm:mx-0">
                  {currentWorkspace?.plan ? `${currentWorkspace.plan.toUpperCase()} Plan` : 'Pro Active'}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">Recommended size: 400&times;400px. JPG, PNG or WebP under 2MB.</p>

              <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-3 py-1.5 bg-surface-container-lowest text-xs font-semibold text-on-surface rounded-xl shadow-xs border border-outline-variant/30 hover:bg-surface-container transition-all cursor-pointer"
                >
                  Upload new photo
                </button>
                {customAvatar && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Profile Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">

            {/* Workspace Display Name */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-on-surface flex items-center justify-between">
                <span>Workspace Display Name</span>
                <span className="text-[11px] text-on-surface-variant font-normal">Brand identity</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Acme Marketing Studio"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
              />
            </div>

            {/* Default Vanity Handle */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-on-surface flex items-center justify-between">
                <span>Default Vanity Slug / Alias</span>
                <span className="text-[11px] text-on-surface-variant font-normal">Bio hub URL prefix</span>
              </label>
              <div className="flex rounded-xl bg-surface-container-low overflow-hidden border border-outline-variant/30 focus-within:ring-2 focus-within:ring-primary-container transition-all">
                <span className="px-3.5 py-2.5 font-mono text-xs text-on-surface-variant select-none bg-surface-container border-r border-outline-variant/30">
                  {originDomain}/
                </span>
                <input
                  type="text"
                  value={vanityHandle}
                  onChange={(e) => setVanityHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  className="flex-1 px-3 py-2.5 bg-transparent font-mono text-xs text-primary-container font-bold focus:outline-none"
                  placeholder="brand-name"
                />
                <button
                  type="button"
                  onClick={handleCopyHandle}
                  className="px-3 text-on-surface-variant hover:text-primary-container transition-colors cursor-pointer"
                  title="Copy Vanity Link"
                >
                  {copiedHandle ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Contact & Notification Email */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-on-surface">Contact &amp; Notification Email</label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-outline absolute left-3 pointer-events-none" />
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@yourcompany.com"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
                />
              </div>
            </div>

            {/* Primary Language & Region */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-on-surface">Primary Language &amp; Region</label>
              <div className="relative flex items-center">
                <Globe2 className="w-4 h-4 text-outline absolute left-3 pointer-events-none" />
                <select
                  value={languageRegion}
                  onChange={(e) => setLanguageRegion(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary-container appearance-none transition-all cursor-pointer"
                >
                  <option value="en-US">English (United States - en-US)</option>
                  <option value="en-GB">English (United Kingdom - en-GB)</option>
                  <option value="es-ES">Spanish (es-ES)</option>
                  <option value="de-DE">German (de-DE)</option>
                  <option value="fr-FR">French (fr-FR)</option>
                  <option value="hi-IN">Hindi (India - hi-IN)</option>
                </select>
                <span className="pointer-events-none absolute right-3 text-outline text-[11px]">▼</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 4. TAB 2: BRANDED CUSTOM DOMAINS */}
      {activeSettingsTab === 'domains' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-outline-variant/30 p-6 flex flex-col gap-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant/20">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-on-surface">Branded Custom Domains</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant text-[11px] font-bold">
                  {domains.length} / 5 Connected
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Route short URLs using your organization&apos;s own branded domain (e.g. <code className="font-mono text-primary-container">go.yourbrand.com</code>) with automated SSL and ownership validation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddDomainModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-container text-on-primary hover:bg-primary text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Connect New Domain</span>
            </button>
          </div>

          {/* Domains Table / Cards */}
          <div className="space-y-4 text-xs">
            {displayDomains.length === 0 ? (
              <div className="rounded-2xl bg-surface-container-low p-8 border border-outline-variant/30 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-primary-container shadow-xs">
                  <Globe className="w-6 h-6" />
                </div>
                <div className="max-w-md">
                  <h3 className="text-sm font-bold text-on-surface">No Custom Domains Connected</h3>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    Connect your organization&apos;s custom domain (e.g. <span className="font-mono text-primary-container">links.yourbrand.com</span>) to route short links under your brand with automated Edge SSL certificates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddDomainModalOpen(true)}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-container text-on-primary hover:bg-primary text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Connect Your First Domain</span>
                </button>
              </div>
            ) : (
              displayDomains.map((dom) => {
                const isDefaultPrimary = dom.is_default || dom.id === 'dom_primary_default';
                const isExpanded = expandedDnsDomainId === dom.id;
                const subdomainHost = dom.hostname.includes('.') ? dom.hostname.split('.')[0] : '@';
                const txtToken = dom.verify_token || `tinyurl-verification=tiny_${dom.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;
                const cnameTarget = process.env.NEXT_PUBLIC_CNAME_TARGET || 'creataurus.work.gd';

                return (
                  <div
                    key={dom.id}
                    className="rounded-2xl bg-surface-container-low p-4 sm:p-5 flex flex-col gap-4 border border-outline-variant/30 transition-all shadow-xs"
                  >
                    {/* Card Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary-container shrink-0 shadow-xs">
                          <Globe className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-on-surface">
                              {dom.hostname}
                            </span>

                            {/* Ownership Badge */}
                            {dom.ownership_verified || dom.verified ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Ownership Verified</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Ownership Pending (TXT)</span>
                              </span>
                            )}

                            {/* Routing & SSL Badge */}
                            {dom.verified ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                <span>Edge TLS 1.3 Active</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant/40 text-[11px] font-medium">
                                <span>Routing Pending (CNAME)</span>
                              </span>
                            )}

                            {isDefaultPrimary && (
                              <span className="px-2 py-0.5 rounded-md bg-primary-container text-on-primary text-[10px] font-bold uppercase tracking-wider">
                                Default Primary
                              </span>
                            )}
                          </div>

                          {/* Root Redirect Info */}
                          <div className="flex items-center gap-2 text-on-surface-variant text-xs flex-wrap">
                            <span>Root Destination:</span>
                            <span className="font-mono font-medium text-on-surface bg-surface-container px-2 py-0.5 rounded text-[11px]">
                              {dom.root_redirect_url || `https://${dom.hostname} (Default)`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
                        {dom.id !== 'dom_platform' && (
                          <button
                            type="button"
                            onClick={() => setExpandedDnsDomainId(isExpanded ? null : dom.id)}
                            className="px-3 py-1.5 bg-surface-container text-on-surface text-xs font-semibold rounded-xl hover:bg-surface-container-high transition-colors shadow-xs border border-outline-variant/30 cursor-pointer"
                          >
                            {isExpanded ? 'Hide DNS Records' : 'View DNS Records'}
                          </button>
                        )}

                        {dom.id !== 'dom_platform' && (
                          <button
                            type="button"
                            disabled={verifyingDomainId === dom.id}
                            onClick={() => handleTestDomainDns(dom.id, dom.hostname, false)}
                            className="px-3.5 py-1.5 bg-primary-container text-on-primary text-xs font-bold rounded-xl hover:bg-primary transition-all shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            {verifyingDomainId === dom.id ? 'Checking DNS...' : 'Verify Live DNS'}
                          </button>
                        )}

                        {!dom.verified && dom.id !== 'dom_platform' && (
                          <button
                            type="button"
                            onClick={() => handleTestDomainDns(dom.id, dom.hostname, true)}
                            title="Simulate DNS verification instantly for testing or local demonstration"
                            className="px-2.5 py-1.5 bg-secondary-fixed text-on-secondary-fixed text-xs font-bold rounded-xl hover:bg-secondary-fixed-dim transition-colors shadow-xs cursor-pointer"
                          >
                            Demo Instant Verify
                          </button>
                        )}

                        {!isDefaultPrimary && dom.id !== 'dom_primary_default' && dom.id !== 'dom_platform' && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryDomain(dom.id, dom.hostname)}
                            className="px-2.5 py-1.5 bg-surface-container-lowest text-on-surface text-xs font-medium rounded-xl hover:bg-surface-container border border-outline-variant/30 transition cursor-pointer"
                          >
                            Set Primary
                          </button>
                        )}

                        {dom.id !== 'dom_primary_default' && dom.id !== 'dom_platform' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDomain(dom.id, dom.hostname)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition cursor-pointer"
                            title="Remove domain"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable DNS Records Drawer */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-outline-variant/20 flex flex-col gap-3 animate-fade-in bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-outline-variant/20">
                          <span className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                            <Server className="w-4 h-4 text-primary-container" />
                            <span>DNS Records Required for {dom.hostname}</span>
                          </span>
                          <span className="text-[11px] text-on-surface-variant">Configure in your DNS provider (Cloudflare, GoDaddy, Namecheap, Hostinger)</span>
                        </div>

                        {/* Apex vs Subdomain Quick Tip */}
                        <div className="p-2.5 rounded-lg bg-primary-container/10 border border-primary-container/20 text-[11px] text-on-surface leading-relaxed">
                          💡 <strong>DNS Guide:</strong> If using a <strong>Root/Apex domain</strong> (e.g. <span className="font-mono text-primary-container">{dom.hostname}</span>), add the <strong>A Record</strong> below. If using a <strong>Subdomain</strong> (e.g. <span className="font-mono text-primary-container">links.{dom.hostname}</span>), add the <strong>CNAME Record</strong>.
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">

                          {/* Record 1: A Record (Recommended for Root Domains) */}
                          <div className="p-3 rounded-xl bg-surface-container-low border border-emerald-200/60 dark:border-emerald-800/40 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-on-surface text-[11px] flex items-center gap-1">
                                <span>A Record</span>
                                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">A (Root @)</span>
                              </span>
                              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">For Apex Domain</span>
                            </div>
                            <div className="space-y-1 font-mono text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="text-outline">Host/Name:</span>
                                <span className="text-on-surface font-semibold bg-surface-container px-1.5 py-0.5 rounded">
                                  @
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-outline shrink-0">IP Target:</span>
                                <span className="text-primary-container font-semibold bg-surface-container px-1.5 py-0.5 rounded flex-1 text-right">
                                  {edgeProxyIp}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(edgeProxyIp);
                                    setCopiedIpDomainId(dom.id);
                                    setTimeout(() => setCopiedIpDomainId(null), 2000);
                                  }}
                                  className="p-1 hover:bg-surface-container rounded cursor-pointer text-outline hover:text-on-surface"
                                  title="Copy IP Address"
                                >
                                  {copiedIpDomainId === dom.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Record 2: CNAME Record (For Subdomains) */}
                          <div className="p-3 rounded-xl bg-surface-container-low border border-blue-200/60 dark:border-blue-800/40 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-on-surface text-[11px] flex items-center gap-1">
                                <span>CNAME Record</span>
                                <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold">CNAME</span>
                              </span>
                              <span className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">For Subdomain</span>
                            </div>
                            <div className="space-y-1 font-mono text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="text-outline">Host/Name:</span>
                                <span className="text-on-surface font-semibold bg-surface-container px-1.5 py-0.5 rounded">
                                  {subdomainHost}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-outline shrink-0">Target:</span>
                                <span className="text-primary-container font-semibold truncate bg-surface-container px-1.5 py-0.5 rounded flex-1 text-right">
                                  {cnameTarget}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(cnameTarget);
                                    setCopiedCnameDomainId(dom.id);
                                    setTimeout(() => setCopiedCnameDomainId(null), 2000);
                                  }}
                                  className="p-1 hover:bg-surface-container rounded cursor-pointer text-outline hover:text-on-surface"
                                  title="Copy CNAME target"
                                >
                                  {copiedCnameDomainId === dom.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Record 3: Ownership Challenge TXT */}
                          <div className="p-3 rounded-xl bg-surface-container-low border border-amber-200/60 dark:border-amber-800/40 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-on-surface text-[11px] flex items-center gap-1">
                                <span>Ownership TXT</span>
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold">TXT</span>
                              </span>
                              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Authorization</span>
                            </div>
                            <div className="space-y-1 font-mono text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="text-outline">Host/Name:</span>
                                <span className="text-on-surface font-semibold bg-surface-container px-1.5 py-0.5 rounded">
                                  _tinyurl-challenge
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-outline shrink-0">Value:</span>
                                <span className="text-primary-container font-semibold truncate bg-surface-container px-1.5 py-0.5 rounded flex-1 text-right">
                                  {txtToken}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(txtToken);
                                    setCopiedTokenDomainId(dom.id);
                                    setTimeout(() => setCopiedTokenDomainId(null), 2000);
                                  }}
                                  className="p-1 hover:bg-surface-container rounded cursor-pointer text-outline hover:text-on-surface"
                                  title="Copy TXT verification token"
                                >
                                  {copiedTokenDomainId === dom.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}
                  </div>
                );
              }))}
          </div>

          {/* Inline DNS Quick Info Notice */}
          <div className="p-4 rounded-xl bg-surface-container-low flex items-start gap-3 border border-outline-variant/30 text-xs">
            <Info className="w-4 h-4 text-primary-container shrink-0 mt-0.5" />
            <div className="text-on-surface leading-relaxed flex-1">
              <strong className="font-semibold">Enterprise Domain Verification:</strong> To guarantee security and prevent unauthorized domain hijacking, we verify that your organization controls the DNS zone via the <code className="font-mono px-1.5 py-0.5 bg-surface-container-lowest rounded border border-outline-variant/20">TXT</code> challenge before provisioning automated Edge TLS certificates.
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 3: SOCIAL CHANNELS & ATTRIBUTION */}
      {activeSettingsTab === 'social' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-outline-variant/30 p-6 flex flex-col gap-6 animate-fade-in">
          <div>
            <h2 className="text-base font-bold text-on-surface">Social Channel Integrations</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Connect your social distribution handles for automated video description sync, link trees, and audience attribution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">

            {/* YouTube */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600 shrink-0">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-on-surface block">YouTube Channel</span>
                    <span className="text-[11px] text-on-surface-variant">Auto-sync video descriptions &amp; cards</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={socialChannels.youtube.enabled}
                    onChange={(e) => setSocialChannels(s => ({ ...s, youtube: { ...s.youtube, enabled: e.target.checked } }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
                </label>
              </div>
              <input
                type="text"
                placeholder="@yourchannel or channel URL"
                value={socialChannels.youtube.handle}
                onChange={(e) => setSocialChannels(s => ({ ...s, youtube: { ...s.youtube, handle: e.target.value } }))}
                className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl border border-outline-variant/30 text-xs text-on-surface font-mono outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

            {/* Instagram */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-600 shrink-0">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-on-surface block">Instagram Bio</span>
                    <span className="text-[11px] text-on-surface-variant">Bio link auto-updater active</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={socialChannels.instagram.enabled}
                    onChange={(e) => setSocialChannels(s => ({ ...s, instagram: { ...s.instagram, enabled: e.target.checked } }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
                </label>
              </div>
              <input
                type="text"
                placeholder="@instagram_handle"
                value={socialChannels.instagram.handle}
                onChange={(e) => setSocialChannels(s => ({ ...s, instagram: { ...s.instagram, handle: e.target.value } }))}
                className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl border border-outline-variant/30 text-xs text-on-surface font-mono outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

            {/* TikTok */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-on-surface block">TikTok Profile</span>
                    <span className="text-[11px] text-on-surface-variant">Profile link click telemetry</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={socialChannels.tiktok.enabled}
                    onChange={(e) => setSocialChannels(s => ({ ...s, tiktok: { ...s.tiktok, enabled: e.target.checked } }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
                </label>
              </div>
              <input
                type="text"
                placeholder="@tiktok_creator"
                value={socialChannels.tiktok.handle}
                onChange={(e) => setSocialChannels(s => ({ ...s, tiktok: { ...s.tiktok, handle: e.target.value } }))}
                className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl border border-outline-variant/30 text-xs text-on-surface font-mono outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

            {/* X / Twitter */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-surface-container-lowest flex items-center justify-center text-on-surface font-bold text-sm shrink-0 border border-outline-variant/20">
                    𝕏
                  </div>
                  <div>
                    <span className="font-bold text-on-surface block">X / Twitter</span>
                    <span className="text-[11px] text-on-surface-variant">Pinned post auto-syncing</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={socialChannels.twitter.enabled}
                    onChange={(e) => setSocialChannels(s => ({ ...s, twitter: { ...s.twitter, enabled: e.target.checked } }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
                </label>
              </div>
              <input
                type="text"
                placeholder="@x_handle"
                value={socialChannels.twitter.handle}
                onChange={(e) => setSocialChannels(s => ({ ...s, twitter: { ...s.twitter, handle: e.target.value } }))}
                className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl border border-outline-variant/30 text-xs text-on-surface font-mono outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

          </div>
        </div>
      )}

      {/* 6. TAB 4: TRACKING & PRIVACY PREFERENCES */}
      {activeSettingsTab === 'privacy' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-outline-variant/30 p-6 flex flex-col gap-6 animate-fade-in">
          <div>
            <h2 className="text-base font-bold text-on-surface">Tracking &amp; Privacy Preferences</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Standardize campaign attribution and ensure compliance with GDPR, CCPA, and privacy frameworks.
            </p>
          </div>

          <div className="divide-y divide-outline-variant/20 flex flex-col text-xs">

            {/* Preference 1: Cookie-less */}
            <div className="py-4 first:pt-0 flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-on-surface text-xs">Cookie-less Analytics Processing</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-[10px]">
                    GDPR &amp; CCPA Compliant
                  </span>
                </div>
                <p className="text-on-surface-variant text-[11px] leading-relaxed">
                  Hash visitor IP addresses server-side so audience members are never tracked with invasive third-party cookie banners.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={privacyPreferences.cookieless}
                  onChange={(e) => setPrivacyPreferences(p => ({ ...p, cookieless: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>

            {/* Preference 2: UTM auto population */}
            <div className="py-4 flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 max-w-xl">
                <span className="font-bold text-on-surface text-xs">Default UTM Campaign Auto-population</span>
                <p className="text-on-surface-variant text-[11px] leading-relaxed">
                  Automatically append source, medium, and campaign metadata into link destinations when clicks originate from social channels.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={privacyPreferences.utmAuto}
                  onChange={(e) => setPrivacyPreferences(p => ({ ...p, utmAuto: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>

            {/* Preference 3: Expiration Alerts */}
            <div className="py-4 last:pb-0 flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 max-w-xl">
                <span className="font-bold text-on-surface text-xs">Link Expiration &amp; Downtime Alerts</span>
                <p className="text-on-surface-variant text-[11px] leading-relaxed">
                  Dispatches warnings whenever campaign links expire or remote sponsor endpoints throw 404 or SSL handshake errors.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={privacyPreferences.alerts}
                  onChange={(e) => setPrivacyPreferences(p => ({ ...p, alerts: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>

          </div>
        </div>
      )}

      {/* 7. TAB 5: BILLING & RESOURCE QUOTAS */}
      {activeSettingsTab === 'billing' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-outline-variant/30 p-6 flex flex-col gap-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-outline-variant/20">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-on-surface">Workspace Plan &amp; Quotas</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant text-[11px] font-bold">
                  {currentWorkspace?.plan ? `${currentWorkspace.plan.toUpperCase()} Plan` : 'PRO Plan'}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Workspace resources, usage limits, and collaborative permissions.
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-2xl font-black text-on-surface">$29</span>
              <span className="text-xs text-on-surface-variant"> / month</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Links Quota */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <span className="text-xs text-on-surface-variant font-medium">Active Short Links</span>
                <div className="text-xl font-bold text-on-surface mt-1">{links.length} Active</div>
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-2">Active tier limit: Unlimited</span>
            </div>

            {/* Custom Domains Quota */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <span className="text-xs text-on-surface-variant font-medium">Custom Branded Domains</span>
                <div className="text-xl font-bold text-on-surface mt-1">{domains.length} of 3 Used</div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden mt-2">
                <div className="bg-primary-container h-full rounded-full" style={{ width: `${Math.min(100, (domains.length / 3) * 100)}%` }} />
              </div>
            </div>

            {/* Team Collaborators Quota */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <span className="text-xs text-on-surface-variant font-medium">Team Collaborators</span>
                <div className="text-xl font-bold text-on-surface mt-1">{teamMembers.length} Members</div>
              </div>
              <span className="text-[11px] text-primary-container font-semibold mt-2">Role-based access enforced</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 flex-wrap gap-2 text-xs">
            <span className="text-on-surface-variant">
              Invoices are automatically generated and linked to your workspace billing account.
            </span>
            <button
              type="button"
              onClick={() => setUpgradeModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-bold hover:bg-primary transition shadow-xs cursor-pointer"
            >
              Manage Subscription Plan
            </button>
          </div>
        </div>
      )}

      {/* 8. PERSISTENT STICKY BOTTOM ACTION BAR */}
      <div className="sticky bottom-4 z-30 bg-surface-container-lowest/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-outline-variant/40 flex items-center justify-between">
        <div className="flex items-center gap-2 text-on-surface-variant text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Workspace: <strong className="text-on-surface">{currentWorkspace?.name || 'My Workspace'}</strong></span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setDisplayName(currentWorkspace?.name || 'My Workspace');
              setVanityHandle(currentWorkspace?.slug || 'workspace');
              showToast('Reset form to current saved state.');
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all cursor-pointer"
          >
            Reset
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveAll}
            className="px-5 py-2.5 rounded-xl text-xs bg-primary-container text-on-primary font-bold hover:bg-primary transition-all shadow-md shadow-primary-container/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 9. MODAL: ADD CUSTOM DOMAIN */}
      {addDomainModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddDomainModalOpen(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl border border-outline-variant/40 relative animate-fade-in">
            <button
              type="button"
              onClick={() => setAddDomainModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-5 h-5 text-primary-container" />
              <h3 className="text-base font-bold text-on-surface">Connect Branded Custom Domain</h3>
            </div>
            <p className="text-xs text-on-surface-variant mb-4">
              Connect your branded domain or subdomain to generate shortlinks under your company name with automated Edge SSL.
            </p>

            <form onSubmit={handleSaveNewDomain} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Domain Hostname <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. go.yourcompany.com or links.brand.org"
                  value={newDomainHostname}
                  onChange={(e) => setNewDomainHostname(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-xs font-mono text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1 flex items-center justify-between">
                  <span>Root URL Redirection (Optional)</span>
                  <span className="text-[10px] text-on-surface-variant font-normal">When visitors visit /</span>
                </label>
                <input
                  type="url"
                  placeholder="https://yourcompany.com"
                  value={newDomainRootRedirect}
                  onChange={(e) => setNewDomainRootRedirect(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                />
                <span className="text-[11px] text-on-surface-variant mt-1 block">
                  Redirects users who open the root domain directly without a short slug.
                </span>
              </div>

              <div className="p-3 bg-surface-container-low rounded-xl space-y-2 border border-outline-variant/30 text-xs">
                <span className="font-bold text-on-surface flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-primary-container" />
                  <span>DNS Setup Options to Route Traffic:</span>
                </span>
                <div className="space-y-1.5 text-[11px] font-mono">
                  <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/20">
                    <div>
                      <span className="font-bold text-emerald-700 mr-1.5">Option 1 (Root @):</span>
                      <span className="text-on-surface-variant font-sans">A Record pointing to</span>
                    </div>
                    <span className="font-bold text-primary-container">{edgeProxyIp}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/20">
                    <div>
                      <span className="font-bold text-blue-700 mr-1.5">Option 2 (Subdomain):</span>
                      <span className="text-on-surface-variant font-sans">CNAME pointing to</span>
                    </div>
                    <span className="font-bold text-primary-container">{cnameTarget}</span>
                  </div>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed pt-1">
                  Automated Edge SSL certificates are issued on-the-fly once either of these records is detected.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20 mt-4">
                <button
                  type="button"
                  onClick={() => setAddDomainModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingDomain}
                  className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer shadow-xs text-xs disabled:opacity-50"
                >
                  {isAddingDomain ? 'Registering...' : 'Register Domain'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 10. MODAL: UPGRADE / PLAN DETAILS */}
      {upgradeModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUpgradeModalOpen(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-outline-variant/40 relative animate-fade-in">
            <button
              type="button"
              onClick={() => setUpgradeModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1 text-primary-container">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-base font-bold text-on-surface">Subscription &amp; Enterprise Tiers</h3>
            </div>
            <p className="text-xs text-on-surface-variant mb-4">
              Current active tier: <strong>{currentWorkspace?.plan?.toUpperCase() || 'PRO CREATOR'}</strong>
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-primary-container/30 flex items-center justify-between">
                <div>
                  <span className="font-bold text-on-surface block text-sm">Pro Creator ($29/mo)</span>
                  <span className="text-on-surface-variant">Unlimited links, 3 custom domains, zero-trust shield</span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-primary-container text-on-primary font-bold text-[11px]">
                  Active
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                <div>
                  <span className="font-bold text-on-surface block text-sm">Enterprise Dedicated ($199/mo)</span>
                  <span className="text-on-surface-variant">Unlimited custom domains, dedicated IP pools, custom SLA</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUpgradeModalOpen(false);
                    showToast('Enterprise inquiry dispatched to support.');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high font-bold text-on-surface text-xs transition cursor-pointer"
                >
                  Contact Sales
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-outline-variant/20 mt-4">
              <button
                type="button"
                onClick={() => setUpgradeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 11. FLOATING NOTIFICATION TOAST */}
      {mounted && toastMessage && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-6 right-6 bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 transition-all duration-200 z-[100] animate-fade-in border border-outline-variant/30 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>,
        document.body
      )}

    </div>
  );
};
