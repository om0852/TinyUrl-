'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/storeContext';
import { QRCodeSVG } from 'qrcode.react';
import { 
  X, 
  Link2, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldAlert, 
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Lock,
  CheckCircle2, 
  Smartphone, 
  Sliders, 
  Video,
  Camera,
  Music,
  Radio,
  HardDrive,
  Globe,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { detectAppDeepLink } from '@/lib/deepLink';
import { generateId } from '@/lib/db';

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateLinkModal: React.FC<CreateLinkModalProps> = ({ isOpen, onClose }) => {
  const { createShortLink, links, campaigns, domains } = useStore();

  const primaryDomain = domains.find(d => d.is_default && d.verified) || domains.find(d => d.verified) || domains[0];
  const [destinationUrl, setDestinationUrl] = useState('');
  const [title, setTitle] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState(primaryDomain?.id || 'dom_platform');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');

  // Domain SSL & Edge health check
  const [domainProbeStatus, setDomainProbeStatus] = useState<{
    domain: string;
    checking: boolean;
    ssl_active?: boolean;
    message?: string;
  } | null>(null);

  const selectedDomainObj = domains.find(d => d.id === selectedDomainId) || primaryDomain;

  const probeSelectedDomain = useCallback(async (hostname: string) => {
    if (!hostname) return;
    setDomainProbeStatus({ domain: hostname, checking: true });
    try {
      const res = await fetch(`/api/v1/domains/probe?domain=${encodeURIComponent(hostname)}`);
      const data = await res.json();
      setDomainProbeStatus({
        domain: hostname,
        checking: false,
        ssl_active: !!data.ssl_active,
        message: data.message
      });
    } catch {
      setDomainProbeStatus({
        domain: hostname,
        checking: false,
        ssl_active: false,
        message: 'Unable to check SSL status'
      });
    }
  }, []);

  useEffect(() => {
    if (selectedDomainObj?.hostname) {
      probeSelectedDomain(selectedDomainObj.hostname);
    }
  }, [selectedDomainObj?.hostname, probeSelectedDomain]);

  useEffect(() => {
    if ((!selectedDomainId || selectedDomainId === '') && primaryDomain?.id) {
      setSelectedDomainId(primaryDomain.id);
    }
  }, [domains, primaryDomain?.id, selectedDomainId]);
  const [placementTag, setPlacementTag] = useState<'youtube' | 'drive' | 'instagram' | 'tiktok' | 'x' | 'podcast' | 'direct'>('direct');
  
  // UTM params
  const [utmSource, setUtmSource] = useState('direct');
  const [utmMedium, setUtmMedium] = useState('web');
  const [utmCampaign, setUtmCampaign] = useState('summer_launch');
  const [neverExpires, setNeverExpires] = useState(true);

  // Smart Device Routing (iOS / Android)
  const [showDeviceRouting, setShowDeviceRouting] = useState(false);
  const [iosTargetUrl, setIosTargetUrl] = useState('');
  const [androidTargetUrl, setAndroidTargetUrl] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdResult, setCreatedResult] = useState<{
    id: string;
    slug: string;
    shortUrl: string;
    destinationUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-detect placement tag from Destination URL
  useEffect(() => {
    if (!destinationUrl.trim()) return;
    const url = destinationUrl.toLowerCase();
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
      setPlacementTag('drive');
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      setPlacementTag('youtube');
    } else if (url.includes('instagram.com')) {
      setPlacementTag('instagram');
    } else if (url.includes('tiktok.com')) {
      setPlacementTag('tiktok');
    } else if (url.includes('x.com') || url.includes('twitter.com')) {
      setPlacementTag('x');
    } else if (url.includes('spotify.com')) {
      setPlacementTag('podcast');
    } else {
      setPlacementTag('direct');
    }
  }, [destinationUrl]);

  // Sync UTM Source with placement tag
  useEffect(() => {
    setUtmSource(placementTag === 'drive' ? 'google_drive' : placementTag);
    if (placementTag === 'youtube') setUtmMedium('description');
    else if (placementTag === 'drive') setUtmMedium('cloud_share');
    else if (placementTag === 'instagram') setUtmMedium('bio');
    else if (placementTag === 'tiktok') setUtmMedium('profile');
    else if (placementTag === 'x') setUtmMedium('post');
    else if (placementTag === 'podcast') setUtmMedium('show_notes');
    else setUtmMedium('web');
  }, [placementTag]);

  if (!isOpen) return null;

  const originDomain = typeof window !== 'undefined' ? window.location.host : 'snip.to';
  const detectedApp = destinationUrl ? detectAppDeepLink(destinationUrl) : null;

  // Slug availability check
  const isSlugTaken = customSlug.trim() 
    ? links.some(l => (l.custom_slug || l.short_code).toLowerCase() === customSlug.trim().toLowerCase())
    : false;

  const handlePlacementChange = (p: 'youtube' | 'drive' | 'instagram' | 'tiktok' | 'x' | 'podcast' | 'direct') => {
    setPlacementTag(p);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!destinationUrl.trim()) {
      setErrorMsg('Please enter a destination URL.');
      return;
    }

    if (!destinationUrl.startsWith('http://') && !destinationUrl.startsWith('https://')) {
      setErrorMsg('Destination URL must start with http:// or https://');
      return;
    }

    if (isSlugTaken) {
      setErrorMsg(`Slug "${customSlug}" is already taken. Please choose another.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const tags = [placementTag === 'drive' ? 'google_drive' : placementTag];

      const linkRules = [];
      if (iosTargetUrl.trim()) {
        linkRules.push({
          id: generateId('rule_ios'),
          link_id: '',
          rule_type: 'device' as const,
          condition: 'ios',
          target_url: iosTargetUrl.trim().startsWith('http') || iosTargetUrl.trim().includes('://') 
            ? iosTargetUrl.trim() 
            : `https://${iosTargetUrl.trim()}`,
          weight: 100
        });
      }
      if (androidTargetUrl.trim()) {
        linkRules.push({
          id: generateId('rule_android'),
          link_id: '',
          rule_type: 'device' as const,
          condition: 'android',
          target_url: androidTargetUrl.trim().startsWith('http') || androidTargetUrl.trim().includes('://') 
            ? androidTargetUrl.trim() 
            : `https://${androidTargetUrl.trim()}`,
          weight: 100
        });
      }

      const res = createShortLink({
        destination_url: destinationUrl.trim(),
        title: title.trim() || undefined,
        custom_slug: customSlug.trim() ? customSlug.trim().toLowerCase() : undefined,
        domain_id: selectedDomainId || undefined,
        tags,
        campaign_id: selectedCampaignId || undefined,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        rules: linkRules.length > 0 ? linkRules : undefined,
        deep_link: detectedApp ? {
          enabled: true,
          app: detectedApp.app,
          app_name: detectedApp.appName,
          app_uri: detectedApp.iosUri,
          ios_uri: detectedApp.iosUri,
          android_intent: detectedApp.androidIntent,
          fallback_url: detectedApp.fallbackUrl
        } : undefined
      });

      if (res.error) {
        setErrorMsg(res.error);
        setIsSubmitting(false);
        return;
      }

      if (res.link) {
        const slug = res.link.custom_slug || res.link.short_code;
        const chosenDomain = domains.find(d => d.id === (res.link?.domain_id || selectedDomainId));
        const resolvedHost = chosenDomain?.hostname || (typeof window !== 'undefined' ? window.location.host : originDomain);
        const shortUrl = `https://${resolvedHost}/${slug}`;

        setCreatedResult({
          id: res.link.id,
          slug,
          shortUrl,
          destinationUrl: res.link.destination_url
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create link';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (!createdResult) return;
    navigator.clipboard.writeText(createdResult.shortUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetAndClose = () => {
    setDestinationUrl('');
    setTitle('');
    setCustomSlug('');
    setIosTargetUrl('');
    setAndroidTargetUrl('');
    setShowDeviceRouting(false);
    setErrorMsg('');
    setCreatedResult(null);
    onClose();
  };

  const previewSlug = customSlug.trim() || 'custom-alias';
  const previewShortUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${previewSlug}`
    : `${originDomain}/${previewSlug}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-all duration-200 animate-fade-in">
      <div 
        className="fixed inset-0"
        onClick={resetAndClose}
      />

      <div className="relative bg-surface-container-lowest rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-outline-variant/40 z-10 text-on-surface">
        
        {/* Modal Header (Fixed) */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-outline-variant/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high text-primary-container flex items-center justify-center shadow-xs shrink-0">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">Create new short link</h2>
              <p className="text-[11px] text-on-surface-variant">Instant redirection, branded slugs &amp; integrated QR creation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="p-1 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        {createdResult ? (
          <div className="px-5 py-4 text-center flex flex-col items-center gap-3 overflow-y-auto custom-scrollbar flex-1">
            <div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-200 shadow-xs shrink-0 mt-1">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            
            <div>
              <h3 className="text-base font-bold text-on-surface">Short Link Created!</h3>
              <p className="text-xs text-on-surface-variant mt-0.5 max-w-md mx-auto">
                Your short link is live and active with real-time analytics and mobile deep routing.
              </p>
            </div>

            {/* Short link box */}
            <div className="w-full p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/40 flex items-center justify-between gap-2.5 text-left">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-xs font-bold text-primary-container truncate block">
                  {createdResult.shortUrl}
                </span>
                <span className="text-[11px] text-on-surface-variant truncate block mt-0.5">
                  &rarr; {createdResult.destinationUrl}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 bg-surface-container-lowest hover:bg-surface-container text-on-surface rounded-lg text-xs font-semibold shadow-xs border border-outline-variant/40 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            {/* QR Preview in Success */}
            <div className="w-24 h-24 p-1.5 bg-surface-container-lowest rounded-lg shadow-xs border border-outline-variant/30 flex items-center justify-center shrink-0">
              <QRCodeSVG
                value={createdResult.shortUrl}
                size={80}
                level="H"
                fgColor="#141b2b"
                bgColor="#ffffff"
              />
            </div>

            <div className="w-full flex items-center gap-2 pt-1 mt-auto">
              <button
                type="button"
                onClick={() => {
                  setCreatedResult(null);
                  setDestinationUrl('');
                  setTitle('');
                  setCustomSlug('');
                }}
                className="flex-1 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold transition-colors cursor-pointer"
              >
                Create Another Link
              </button>
              <a
                href={createdResult.shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 rounded-lg bg-primary-container hover:bg-primary text-on-primary text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>Test Link</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            
            {/* Scrollable Form Body */}
            <div className="px-5 py-3.5 flex flex-col gap-3 text-xs overflow-y-auto custom-scrollbar flex-1">
              
              {errorMsg && (
                <div className="p-2.5 bg-error-container text-on-error-container rounded-lg flex items-center gap-2 font-medium text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-error" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Destination URL */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface flex items-center justify-between text-xs">
                  <span>Destination URL <span className="text-error">*</span></span>
                  <span className="text-on-surface-variant font-normal text-[11px]">Where users will land</span>
                </label>
                <div className="relative flex items-center">
                  <Link2 className="w-3.5 h-3.5 text-outline absolute left-3 pointer-events-none" />
                  <input
                    type="url"
                    required
                    value={destinationUrl}
                    onChange={(e) => setDestinationUrl(e.target.value)}
                    placeholder="https://yourstore.com/special-offer"
                    className="w-full pl-8 pr-3 py-2 bg-surface-container-lowest rounded-lg text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
                  />
                </div>

                {/* Real-time deep link indicator */}
                {detectedApp && (
                  <div className="mt-0.5 flex items-center gap-1.5 p-1.5 bg-surface-container-low rounded-lg text-[11px] font-medium text-on-surface">
                    <Smartphone className="w-3 h-3 text-primary-container shrink-0" />
                    <span>⚡ OpeninApp: Direct native launch for <strong>{detectedApp.appName}</strong></span>
                  </div>
                )}
              </div>

              {/* Title / Label */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface text-xs">
                  Link Title <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Summer Merch Launch, Instagram Link in Bio"
                  className="w-full px-3 py-2 bg-surface-container-lowest rounded-lg text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
                />
              </div>

              {/* Custom Domain & Back-Half Slug */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface flex items-center justify-between text-xs">
                  <span>Domain & Short Link Slug</span>
                  {customSlug.trim() && (
                    <span className={`text-[11px] font-semibold flex items-center gap-1 ${isSlugTaken ? 'text-error' : 'text-emerald-600'}`}>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{isSlugTaken ? 'Slug taken' : 'Available'}</span>
                    </span>
                  )}
                </label>
                <div className="flex flex-col sm:flex-row rounded-lg overflow-hidden bg-surface-container-low p-1 border border-outline-variant/40 gap-1">
                  {/* Domain Selector */}
                  <div className="flex items-center gap-1.5 bg-surface-container-lowest px-2.5 py-1 rounded-lg border border-outline-variant/30">
                    <Globe className="w-3.5 h-3.5 text-primary-container shrink-0" />
                    <select
                      value={selectedDomainId || primaryDomain?.id || 'dom_platform'}
                      onChange={(e) => setSelectedDomainId(e.target.value)}
                      className="bg-transparent font-mono text-xs text-on-surface font-semibold outline-none cursor-pointer pr-1"
                    >
                      {domains.map(d => (
                        <option key={d.id} value={d.id} disabled={!d.verified}>
                          {d.hostname} {d.is_default || d.id === 'dom_platform' ? '(Platform)' : (d.verified ? '✓' : '(Pending DNS)')}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex items-center flex-1 px-1">
                    <span className="text-on-surface-variant font-mono text-xs select-none pr-1">/</span>
                    <input
                      type="text"
                      value={customSlug}
                      onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                      placeholder="custom-slug"
                      className="flex-1 px-1 py-1 bg-transparent font-mono text-xs text-primary-container font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                {/* Real-time Domain SSL Health Status (Single line, small text, without box) */}
                {domainProbeStatus && (
                  <div className="mt-1.5 px-0.5">
                    {domainProbeStatus.checking ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-medium animate-pulse truncate">
                        <RefreshCw className="w-3 h-3 animate-spin text-primary-container shrink-0" />
                        <span className="truncate">Verifying Edge SSL &amp; DNS routing for <strong>{domainProbeStatus.domain}</strong>...</span>
                      </div>
                    ) : domainProbeStatus.ssl_active ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">
                          <strong>SSL Active &amp; Verified:</strong> Links created under <strong>{domainProbeStatus.domain}</strong> will load securely.
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span className="truncate">
                            <strong>SSL Pending:</strong> {domainProbeStatus.message || 'SSL certificate is still generating.'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => probeSelectedDomain(selectedDomainObj?.hostname || '')}
                          className="hover:underline font-bold text-amber-700 dark:text-amber-300 cursor-pointer shrink-0 transition"
                        >
                          Re-check
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Campaign Attribution Selector */}
              {campaigns.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface text-xs flex items-center justify-between">
                    <span>Attach to Campaign (Optional)</span>
                    <span className="text-[11px] text-on-surface-variant font-normal">Auto-links deliverable metrics</span>
                  </label>
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedCampaignId(newId);
                      const camp = campaigns.find(c => c.id === newId);
                      if (camp) {
                        setUtmCampaign(camp.name.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                      }
                    }}
                    className="w-full px-3 py-2 bg-surface-container-lowest rounded-lg text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary-container transition-all cursor-pointer"
                  >
                    <option value="">No Campaign (Direct Deliverable)</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.description || 'Campaign'})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Platform Pill Tags */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface text-xs">
                  Primary Placement Tag
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePlacementChange('drive')}
                    className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                      placementTag === 'drive'
                        ? 'bg-blue-100 text-blue-800 shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <HardDrive className="w-3 h-3 text-blue-600" />
                    <span>Google Drive</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlacementChange('youtube')}
                    className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                      placementTag === 'youtube'
                        ? 'bg-error-container text-on-error-container shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <Video className="w-3 h-3" />
                    <span>YouTube</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlacementChange('instagram')}
                    className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                      placementTag === 'instagram'
                        ? 'bg-primary-container text-on-primary shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <Camera className="w-3 h-3" />
                    <span>Instagram</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlacementChange('tiktok')}
                    className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                      placementTag === 'tiktok'
                        ? 'bg-inverse-surface text-inverse-on-surface shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <Music className="w-3 h-3" />
                    <span>TikTok</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlacementChange('x')}
                    className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                      placementTag === 'x'
                        ? 'bg-surface-container-highest text-on-surface font-bold shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="font-bold text-[11px] leading-none">𝕏</span>
                    <span>X</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlacementChange('podcast')}
                    className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                      placementTag === 'podcast'
                        ? 'bg-emerald-100 text-emerald-800 shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <Radio className="w-3 h-3" />
                    <span>Podcast</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlacementChange('direct')}
                    className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                      placementTag === 'direct'
                        ? 'bg-surface-container-high text-primary font-bold shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    <span>Direct / Web</span>
                  </button>
                </div>
              </div>

              {/* Two Column Extras: UTM & Instant QR Code Preview */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-0.5">
                
                {/* UTM Section (8 cols) */}
                <div className="md:col-span-8 flex flex-col gap-2 bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/30">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-on-surface flex items-center gap-1.5 text-[11px]">
                      <Sliders className="w-3 h-3 text-outline" />
                      <span>Automatic UTM Parameters</span>
                    </span>
                    <span className="text-[10px] font-semibold text-primary-container">Included</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-medium text-on-surface-variant uppercase">Source</span>
                      <input
                        type="text"
                        value={utmSource}
                        onChange={(e) => setUtmSource(e.target.value)}
                        className="font-mono text-[10px] px-1.5 py-1 bg-surface-container-lowest rounded-md text-on-surface border border-outline-variant/30 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-medium text-on-surface-variant uppercase">Medium</span>
                      <input
                        type="text"
                        value={utmMedium}
                        onChange={(e) => setUtmMedium(e.target.value)}
                        className="font-mono text-[10px] px-1.5 py-1 bg-surface-container-lowest rounded-md text-on-surface border border-outline-variant/30 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-medium text-on-surface-variant uppercase">Campaign</span>
                      <input
                        type="text"
                        value={utmCampaign}
                        onChange={(e) => setUtmCampaign(e.target.value)}
                        className="font-mono text-[10px] px-1.5 py-1 bg-surface-container-lowest rounded-md text-on-surface border border-outline-variant/30 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-outline-variant/20">
                    <span className="text-[10px] text-on-surface-variant">Expiration</span>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <span className="text-[10px] text-outline font-medium">Never expires</span>
                      <input
                        type="checkbox"
                        checked={neverExpires}
                        onChange={(e) => setNeverExpires(e.target.checked)}
                        className="rounded accent-primary-container w-3 h-3 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Instant QR Code Preview (4 cols) */}
                <div className="md:col-span-4 flex flex-col items-center justify-center p-2 bg-surface-container-low rounded-lg border border-outline-variant/30 gap-1 text-center">
                  <div className="w-14 h-14 bg-surface-container-lowest p-1 rounded-md shadow-xs flex items-center justify-center border border-outline-variant/30">
                    <QRCodeSVG
                      value={previewShortUrl}
                      size={48}
                      level="M"
                      fgColor="#141b2b"
                      bgColor="#ffffff"
                    />
                  </div>
                  <span className="text-[9px] text-on-surface-variant font-medium">Auto QR</span>
                  <span className="font-mono text-[9px] text-primary-container truncate max-w-[100px]">
                    /{previewSlug}
                  </span>
                </div>

              </div>

              {/* Smart Device Routing Accordion (iOS vs Android) */}
              <div className="bg-surface-container-low rounded-lg border border-outline-variant/30 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowDeviceRouting(!showDeviceRouting)}
                  className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-surface-container transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-3.5 h-3.5 text-primary-container" />
                    <span className="font-semibold text-xs text-on-surface">Smart Device Routing (iOS &amp; Android)</span>
                    {(iosTargetUrl.trim() || androidTargetUrl.trim()) && (
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        Active
                      </span>
                    )}
                  </div>
                  {showDeviceRouting ? <ChevronUp className="w-3.5 h-3.5 text-outline" /> : <ChevronDown className="w-3.5 h-3.5 text-outline" />}
                </button>

                {showDeviceRouting && (
                  <div className="p-3 pt-1 border-t border-outline-variant/20 space-y-2.5 text-xs">
                    <p className="text-[11px] text-on-surface-variant">
                      Redirect visitors automatically based on their device. Desktop &amp; web visitors will open the default destination URL above.
                    </p>

                    <div>
                      <label className="font-semibold text-on-surface text-[11px] block mb-1">
                        🍎 iOS Destination (iPhone &amp; iPad)
                      </label>
                      <input
                        type="url"
                        value={iosTargetUrl}
                        onChange={(e) => setIosTargetUrl(e.target.value)}
                        placeholder="e.g. https://apps.apple.com/app/id123456 or custom iOS link"
                        className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-xs font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-on-surface text-[11px] block mb-1">
                        🤖 Android Destination (Google Play)
                      </label>
                      <input
                        type="url"
                        value={androidTargetUrl}
                        onChange={(e) => setAndroidTargetUrl(e.target.value)}
                        placeholder="e.g. https://play.google.com/store/apps/details?id=com.app"
                        className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/30 text-xs font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
                      />
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Actions Footer (Fixed at bottom) */}
            <div className="px-5 py-3 flex items-center justify-end gap-2 border-t border-outline-variant/30 shrink-0 bg-surface-container-lowest">
              <button
                type="button"
                onClick={resetAndClose}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg text-xs bg-primary-container hover:bg-primary text-on-primary transition-all shadow-sm font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Creating...' : 'Create Link'}</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
