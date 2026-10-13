'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/storeContext';
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
  CheckCircle2
} from 'lucide-react';

interface SettingsViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigateTab }) => {
  const { currentUser, currentWorkspace, domains, links, addDomain, verifyDomain } = useStore();

  // Active Settings Tab
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    'profile' | 'domains' | 'social' | 'api' | 'billing'
  >('profile');

  // Profile Form state
  const [displayName, setDisplayName] = useState(
    currentWorkspace?.name || currentUser?.name || 'My Workspace'
  );
  const [vanityHandle, setVanityHandle] = useState(
    currentUser?.name ? currentUser.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'workspace'
  );
  const [contactEmail, setContactEmail] = useState(
    currentUser?.email || ''
  );
  const [languageRegion, setLanguageRegion] = useState('en-US');

  // Keep state updated when currentUser or currentWorkspace changes
  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentWorkspace?.name || `${currentUser.name}'s Workspace`);
      setVanityHandle(currentUser.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'workspace');
      setContactEmail(currentUser.email);
    } else {
      setDisplayName(currentWorkspace?.name || 'My Workspace');
      setVanityHandle('myworkspace');
      setContactEmail('');
    }
  }, [currentUser, currentWorkspace]);

  // Social Integrations Toggles
  const [socialIntegrations, setSocialIntegrations] = useState({
    youtube: true,
    instagram: true,
    tiktok: true,
    twitter: true,
  });

  // Privacy & Tracking Preferences
  const [preferences, setPreferences] = useState({
    cookieless: true,
    utmAuto: true,
    alerts: true,
  });

  // Save changes state feedback
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);

  // Custom Domains state
  const [dnsTestStatus, setDnsTestStatus] = useState<string | null>(null);

  const originDomain = typeof window !== 'undefined' ? window.location.host : 'snip.to';

  const handleCopyHandle = () => {
    const fullUrl = `https://${originDomain}/${vanityHandle}`;
    navigator.clipboard.writeText(fullUrl).catch(() => {});
    setCopiedHandle(true);
    setTimeout(() => setCopiedHandle(false), 2000);
  };

  const handleSaveAll = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }, 500);
  };

  const handleTestDns = async () => {
    setDnsTestStatus('testing');
    const target = domains[0]?.id || originDomain;
    const ok = await verifyDomain(target);
    setDnsTestStatus(ok ? 'verified' : 'failed');
    setTimeout(() => setDnsTestStatus(null), 3000);
  };

  const handleAddCustomDomain = async () => {
    const input = window.prompt('Enter your custom domain or subdomain (e.g. go.yourbrand.com):');
    if (!input || !input.trim()) return;
    await addDomain(input.trim());
  };

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in text-on-surface">
      
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
              Settings
            </h1>
            <p className="text-sm sm:text-base text-on-surface-variant mt-1 max-w-2xl">
              Manage your creator profile, vanity custom domains, social integrations, and link privacy preferences.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-surface-container-high rounded-full text-xs text-on-surface font-semibold border border-outline-variant/30 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse" />
              <span>Pro Workspace Active</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. SETTINGS HORIZONTAL TABS */}
      <div className="bg-surface-container-low p-1.5 rounded-2xl flex items-center gap-1 overflow-x-auto shadow-xs border border-outline-variant/30">
        <button
          type="button"
          onClick={() => setActiveSettingsTab('profile')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'profile'
              ? 'bg-surface-container-lowest text-primary-container shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          }`}
        >
          General Profile
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('domains')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'domains'
              ? 'bg-surface-container-lowest text-primary-container shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          }`}
        >
          Branded Domains
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('social')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'social'
              ? 'bg-surface-container-lowest text-primary-container shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          }`}
        >
          Social Integrations
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab ? onNavigateTab('api') : setActiveSettingsTab('api')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'api'
              ? 'bg-surface-container-lowest text-primary-container shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          }`}
        >
          API &amp; Webhooks
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('billing')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'billing'
              ? 'bg-surface-container-lowest text-primary-container shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          }`}
        >
          Billing &amp; Plans
        </button>
      </div>

      {/* 3. SECTION 1: CREATOR PROFILE CARD */}
      {activeSettingsTab === 'profile' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/40 p-6 flex flex-col gap-6 transition-all">
          <div className="flex items-start justify-between pb-2 border-b border-outline-variant/20">
            <div>
              <h2 className="text-lg font-bold text-on-surface">Creator Profile</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Public presence details used across all generated bio links and landing cards.
              </p>
            </div>
            <span className="font-mono text-xs text-on-surface-variant bg-surface-container-low px-2.5 py-1 rounded-lg border border-outline-variant/30">
              ID: cr_89a3f290
            </span>
          </div>

          {/* Avatar Uploader & Info */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-4 rounded-xl bg-surface-container-low border border-outline-variant/30">
            <div className="relative group cursor-pointer shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden shadow-sm bg-primary-container text-on-primary flex items-center justify-center text-2xl font-bold border-2 border-surface-container-lowest">
                {currentUser?.avatar || (currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U')}
              </div>
              <span className="absolute -bottom-1 -right-1 bg-surface-container-lowest p-1 rounded-full shadow-xs text-primary-container border border-outline-variant/30">
                <CheckCircle2 className="w-4 h-4 text-primary-container" />
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-base font-bold text-on-surface">
                  {currentUser?.name || currentWorkspace?.name || 'Workspace Owner'}
                </span>
                <span className="px-2.5 py-0.5 bg-surface-container-high rounded-full text-xs text-primary-container font-semibold w-fit mx-auto sm:mx-0">
                  {currentWorkspace?.plan ? `${currentWorkspace.plan.toUpperCase()} Plan` : 'Pro Active'}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">Recommended size: 400&times;400px. JPG, PNG or WebP under 2MB.</p>
              
              <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                <button
                  type="button"
                  className="px-3 py-1.5 bg-surface-container-lowest text-xs font-semibold text-on-surface rounded-lg shadow-xs border border-outline-variant/40 hover:bg-surface-container transition-all cursor-pointer"
                >
                  Upload new photo
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          {/* Profile Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Workspace Display Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface flex items-center justify-between">
                <span>Workspace Display Name</span>
                <span className="text-[11px] text-on-surface-variant font-normal">Visible in link metadata</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary-container focus:bg-surface-container-lowest transition-all"
              />
            </div>

            {/* Default Vanity Handle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface flex items-center justify-between">
                <span>Default Vanity Handle</span>
                <span className="text-[11px] text-on-surface-variant font-normal">Shared bio URL</span>
              </label>
              <div className="flex rounded-xl bg-surface-container-low overflow-hidden border border-outline-variant/40 focus-within:ring-2 focus-within:ring-primary-container focus-within:bg-surface-container-lowest transition-all">
                <span className="px-3.5 py-2.5 font-mono text-xs text-on-surface-variant select-none bg-surface-container border-r border-outline-variant/30">
                  {originDomain}/
                </span>
                <input
                  type="text"
                  value={vanityHandle}
                  onChange={(e) => setVanityHandle(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-transparent font-mono text-xs text-primary-container font-semibold focus:outline-none"
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
              <label className="text-xs font-semibold text-on-surface">Contact &amp; Notification Email</label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-outline absolute left-3 pointer-events-none" />
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary-container focus:bg-surface-container-lowest transition-all"
                />
              </div>
            </div>

            {/* Primary Language & Region */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">Primary Language &amp; Region</label>
              <div className="relative flex items-center">
                <Globe2 className="w-4 h-4 text-outline absolute left-3 pointer-events-none" />
                <select
                  value={languageRegion}
                  onChange={(e) => setLanguageRegion(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-surface-container-low text-xs text-on-surface border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary-container focus:bg-surface-container-lowest appearance-none transition-all cursor-pointer"
                >
                  <option value="en-US">English (United States - en-US)</option>
                  <option value="en-GB">English (United Kingdom - en-GB)</option>
                  <option value="es-ES">Spanish (es-ES)</option>
                  <option value="de-DE">German (de-DE)</option>
                </select>
                <span className="pointer-events-none absolute right-3 text-outline text-[12px]">▼</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 4. SECTION 2: BRANDED CUSTOM DOMAINS CARD */}
      {(activeSettingsTab === 'domains' || activeSettingsTab === 'profile') && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/40 p-6 flex flex-col gap-6 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-outline-variant/20">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-on-surface">Branded Custom Domains</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant text-[11px] font-bold">
                  {domains.length} / 3 Used
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Connect your own root domain or subdomain to mask all shortened URLs and elevate link trustworthiness.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddCustomDomain}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold transition-all shadow-xs border border-outline-variant/30 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4 text-primary-container" />
              <span>Add Custom Domain</span>
            </button>
          </div>

          {/* Active Domain Block */}
          <div className="rounded-xl bg-surface-container-low p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-outline-variant/30">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary-container shrink-0 shadow-xs">
                <Server className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-on-surface">
                    {domains[0]?.hostname || originDomain}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-lowest text-on-surface text-[11px] font-semibold border border-outline-variant/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Active &amp; SSL Verified</span>
                  </span>
                  <span className="text-on-surface-variant text-[11px] font-medium">Primary</span>
                </div>
                <div className="flex items-center gap-2 text-on-surface-variant text-xs flex-wrap font-mono">
                  <span className="flex items-center gap-1">
                    <span className="text-outline">CNAME:</span>
                    <span className="text-on-surface bg-surface-container px-1.5 py-0.5 rounded text-[11px]">
                      cname.{originDomain}
                    </span>
                  </span>
                  <span>&bull;</span>
                  <span>Routing {links.length} active links</span>
                  <span>&bull;</span>
                  <span>Auto-renew: Sep 2026</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center">
              <button
                type="button"
                onClick={handleTestDns}
                className="px-3 py-1.5 bg-surface-container-lowest text-on-surface text-xs font-semibold rounded-lg hover:bg-surface-container transition-colors shadow-xs border border-outline-variant/30 cursor-pointer"
              >
                {dnsTestStatus === 'testing' ? 'Verifying...' : dnsTestStatus === 'verified' ? '✓ Verified!' : 'Test DNS'}
              </button>
            </div>
          </div>

          {/* Inline DNS Quick Info Notice */}
          <div className="p-3.5 rounded-xl bg-surface-container flex items-start gap-3 border border-outline-variant/30 text-xs">
            <Info className="w-4 h-4 text-primary-container shrink-0 mt-0.5" />
            <div className="text-on-surface leading-relaxed flex-1">
              <strong className="font-semibold">Quick setup guide:</strong> To route clicks under your custom domain, add a CNAME record at your DNS provider pointing host <code className="font-mono px-1.5 py-0.5 bg-surface-container-lowest rounded border border-outline-variant/20">links</code> to <code className="font-mono px-1.5 py-0.5 bg-surface-container-lowest rounded border border-outline-variant/20">cname.{originDomain}</code>. Provisioning certificates takes 5-15 minutes.
            </div>
          </div>
        </div>
      )}

      {/* 5. SECTION 3: SOCIAL CHANNEL INTEGRATIONS CARD */}
      {(activeSettingsTab === 'social' || activeSettingsTab === 'profile') && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/40 p-6 flex flex-col gap-6 transition-all">
          <div>
            <h2 className="text-lg font-bold text-on-surface">Social Channel Integrations</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Connect distribution channels for automated video description sync, link trees, and audience attribution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* YouTube Item */}
            <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between gap-4 border border-outline-variant/30">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-red-600 shrink-0 shadow-xs border border-outline-variant/20">
                  <Video className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-on-surface">YouTube</span>
                    <span className="font-mono text-[11px] text-on-surface-variant truncate">@{vanityHandle || 'creator'}</span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant truncate">Auto-sync video descriptions &amp; cards</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={socialIntegrations.youtube}
                  onChange={(e) => setSocialIntegrations(s => ({ ...s, youtube: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>

            {/* Instagram Item */}
            <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between gap-4 border border-outline-variant/30">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-pink-600 shrink-0 shadow-xs border border-outline-variant/20">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-on-surface">Instagram</span>
                    <span className="font-mono text-[11px] text-on-surface-variant truncate">@{vanityHandle || 'creator'}</span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant truncate">Bio link auto-updater active</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={socialIntegrations.instagram}
                  onChange={(e) => setSocialIntegrations(s => ({ ...s, instagram: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>

            {/* TikTok Item */}
            <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between gap-4 border border-outline-variant/30">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-on-surface shrink-0 shadow-xs border border-outline-variant/20">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-on-surface">TikTok</span>
                    <span className="font-mono text-[11px] text-on-surface-variant truncate">@{vanityHandle || 'creator'}</span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant truncate">Profile link click telemetry enabled</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={socialIntegrations.tiktok}
                  onChange={(e) => setSocialIntegrations(s => ({ ...s, tiktok: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>

            {/* X / Twitter Item */}
            <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between gap-4 border border-outline-variant/30">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-on-surface shrink-0 shadow-xs border border-outline-variant/20 font-bold text-base">
                  𝕏
                </div>
                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-on-surface">X / Twitter</span>
                    <span className="font-mono text-[11px] text-on-surface-variant truncate">@{vanityHandle || 'creator'}</span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant truncate">Pinned tweet auto-syncing</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={socialIntegrations.twitter}
                  onChange={(e) => setSocialIntegrations(s => ({ ...s, twitter: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>

          </div>
        </div>
      )}

      {/* 6. SECTION 4: TRACKING & PRIVACY PREFERENCES CARD */}
      {(activeSettingsTab === 'profile' || activeSettingsTab === 'social') && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/40 p-6 flex flex-col gap-6 transition-all">
          <div>
            <h2 className="text-lg font-bold text-on-surface">Tracking &amp; Privacy Preferences</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Standardize campaign analytics and respect viewer privacy guidelines.
            </p>
          </div>

          <div className="divide-y divide-outline-variant/20 flex flex-col text-xs">
            
            {/* Preference 1: Cookie-less */}
            <div className="py-4 first:pt-0 flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-on-surface text-xs">Cookie-less Analytics Processing</span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container-high font-semibold text-[10px] text-primary-container">
                    GDPR &amp; CCPA
                  </span>
                </div>
                <p className="text-on-surface-variant text-[11px] leading-relaxed">
                  Hash visitors IP addresses and utilize server-side tracking so end users are never subjected to intrusive cookie consent banners.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={preferences.cookieless}
                  onChange={(e) => setPreferences(p => ({ ...p, cookieless: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>

            {/* Preference 2: UTM auto population */}
            <div className="py-4 flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 max-w-xl">
                <span className="font-semibold text-on-surface text-xs">Default UTM Campaign Auto-population</span>
                <p className="text-on-surface-variant text-[11px] leading-relaxed">
                  Automatically inject source and campaign metadata into link destinations when clicks originate from supported social networks.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={preferences.utmAuto}
                  onChange={(e) => setPreferences(p => ({ ...p, utmAuto: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>

            {/* Preference 3: Expiration Alerts */}
            <div className="py-4 last:pb-0 flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 max-w-xl">
                <span className="font-semibold text-on-surface text-xs">Link Expiration &amp; Downtime Alerts</span>
                <p className="text-on-surface-variant text-[11px] leading-relaxed">
                  Receive email warnings 24 hours prior to temporary affiliate links expiring or if target URLs return 404/500 errors.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={preferences.alerts}
                  onChange={(e) => setPreferences(p => ({ ...p, alerts: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>

          </div>
        </div>
      )}

      {/* SECTION 5: BILLING & PLANS CARD */}
      {activeSettingsTab === 'billing' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/40 p-6 flex flex-col gap-6 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-outline-variant/20">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-on-surface">Billing &amp; Subscription</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant text-[11px] font-bold">
                  Pro Creator Plan
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Manage payment methods, billing cycle, receipts, and custom enterprise quotas.
              </p>
            </div>
            <div className="text-right sm:text-right">
              <span className="text-2xl font-black text-on-surface">$29</span>
              <span className="text-xs text-on-surface-variant"> / month</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <span className="text-xs text-on-surface-variant font-medium">Monthly Short Links</span>
                <div className="text-xl font-bold text-on-surface mt-1">Unlimited</div>
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-2">Active tier limit: Fair use</span>
            </div>
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <span className="text-xs text-on-surface-variant font-medium">Custom Branded Domains</span>
                <div className="text-xl font-bold text-on-surface mt-1">{domains.length} of 3 Used</div>
              </div>
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden mt-2">
                <div className="bg-primary-container h-full rounded-full" style={{ width: `${(domains.length / 3) * 100}%` }} />
              </div>
            </div>
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <span className="text-xs text-on-surface-variant font-medium">Renewal Date</span>
                <div className="text-xl font-bold text-on-surface mt-1">Nov 14, 2026</div>
              </div>
              <span className="text-[11px] text-on-surface-variant mt-2">Auto-renews via Stripe card •••• 4242</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-on-surface-variant">
              Next invoice generated automatically on your scheduled billing cycle.
            </div>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold border border-outline-variant/30 transition-all cursor-pointer shadow-xs"
            >
              Manage Payment Details
            </button>
          </div>
        </div>
      )}

      {/* 7. PERSISTENT STICKY BOTTOM ACTION BAR */}
      <div className="sticky bottom-4 z-30 bg-surface-container-lowest/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-outline-variant/40 flex items-center justify-between">
        <div className="flex items-center gap-2 text-on-surface-variant text-xs">
          <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse" />
          <span>All edits staged locally in creator workspace</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setDisplayName(currentWorkspace?.name || currentUser?.name || 'My Workspace');
              setVanityHandle(currentUser?.name ? currentUser.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'workspace');
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all cursor-pointer"
          >
            Discard changes
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

    </div>
  );
};
