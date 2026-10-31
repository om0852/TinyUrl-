'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';
import { Link as LinkType } from '@/lib/types';
import {
  X,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Lock,
  Smartphone,
  ChevronDown,
  Sparkles,
  Image as ImageIcon,
  Clipboard,
  UploadCloud,
  Loader2,
  Trash2,
  FileText,
  BarChart3,
  Settings2
} from 'lucide-react';
import { detectAppDeepLink } from '@/lib/deepLink';
import { generateId, buildUtmUrl, normalizeUrl } from '@/lib/db';
import { resolveDisplayImageUrl, compressImageForUpload } from '@/lib/blobStorage';

type SectionId = 'details' | 'tracking' | 'social' | 'protection' | 'redirect';

interface EditLinkModalProps {
  isOpen: boolean;
  link: LinkType | null;
  onClose: () => void;
}

export const EditLinkModal: React.FC<EditLinkModalProps> = ({ isOpen, link, onClose }) => {
  const { updateLink, campaigns, domains, links } = useStore();
  const { showToast } = useToast();

  const primaryDomain = domains.find(d => d.is_default && d.verified) || domains.find(d => d.verified) || domains[0];

  // Core Link State
  const [destinationUrl, setDestinationUrl] = useState('');
  const [title, setTitle] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState(primaryDomain?.id || 'dom_platform');
  const [status, setStatus] = useState<'active' | 'disabled' | 'expired'>('active');
  const [tagsStr, setTagsStr] = useState('');

  // Tab State: Channel & Routing, Social Preview (OG), Shield & Access
  // Optional settings live in collapsed sections; only one is open at a time
  const [openSection, setOpenSection] = useState<SectionId | null>(null);

  // Open Graph & Social Media Preview Meta Tags
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [isUploadingOgImage, setIsUploadingOgImage] = useState(false);
  const [uploadStorageType, setUploadStorageType] = useState<'vercel_blob' | 'inline' | null>(null);
  const ogFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleOgImageUpload = async (rawFile: File) => {
    if (!rawFile) return;
    if (rawFile.size > 10 * 1024 * 1024) {
      showToast('error', 'Upload Failed', 'File size exceeds 10MB limit.');
      return;
    }

    setIsUploadingOgImage(true);
    try {
      // Compress to high-res 1200x630 JPEG under 200KB for instant upload and WhatsApp compatibility
      const file = await compressImageForUpload(rawFile);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/v1/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.url) {
        setOgImageUrl(data.url);
        const isBlob = data.storage === 'vercel_blob';
        setUploadStorageType(isBlob ? 'vercel_blob' : 'inline');
        showToast(
          'success', 
          isBlob ? 'Image Uploaded' : 'Image Ready', 
          isBlob ? 'Image uploaded and optimized for social sharing' : 'Image loaded successfully'
        );
      } else {
        showToast('error', 'Upload Error', data.error || 'Failed to upload image.');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      showToast('error', 'Upload Error', err.message || 'Error uploading image.');
    } finally {
      setIsUploadingOgImage(false);
      if (ogFileInputRef.current) {
        ogFileInputRef.current.value = '';
      }
    }
  };

  // Core redirection & protection settings
  const [redirectType, setRedirectType] = useState<'direct' | 'frame' | 'splash'>('direct');
  const [headerCode, setHeaderCode] = useState<301 | 302 | 307 | 308>(301);
  const [password, setPassword] = useState('');
  const [clearPassword, setClearPassword] = useState(false);
  const [hasExistingPassword, setHasExistingPassword] = useState(false);
  const [linkNotes, setLinkNotes] = useState('');
  const [shieldProtection, setShieldProtection] = useState(true);
  const [hideReferrer, setHideReferrer] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [channel, setChannel] = useState('Direct');

  // Advanced accordion state inside Channel & Routing
  const [enableUtm, setEnableUtm] = useState(false);
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmTerm, setUtmTerm] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [neverExpires, setNeverExpires] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');
  const [maxClicks, setMaxClicks] = useState('');

  // Smart Device Routing (iOS / Android)
  const [iosTargetUrl, setIosTargetUrl] = useState('');
  const [androidTargetUrl, setAndroidTargetUrl] = useState('');

  // UI & Feedback state
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate state whenever link opens
  useEffect(() => {
    if (link && isOpen) {
      setDestinationUrl(link.destination_url || '');
      setTitle(link.title || '');
      setCustomSlug(link.custom_slug || link.short_code || '');
      setSelectedDomainId(link.domain_id || primaryDomain?.id || 'dom_platform');
      setStatus((link.status === 'flagged' ? 'active' : link.status) as 'active' | 'disabled' | 'expired' || 'active');
      setTagsStr(Array.isArray(link.tags) ? link.tags.join(', ') : '');

      setOgTitle(link.og_title || '');
      setOgDescription(link.og_description || '');
      setOgImageUrl(link.og_image_url || '');

      setRedirectType(link.redirect_type || 'direct');
      setHeaderCode((link.http_status_code as 301 | 302 | 307 | 308) || 301);
      
      const hasPass = Boolean((link as any).password_hash || (link as any).has_password);
      setHasExistingPassword(hasPass);
      setPassword('');
      setClearPassword(false);

      setLinkNotes(link.notes || '');
      setShieldProtection(link.shield_protection ?? true);
      setHideReferrer(link.hide_referrer ?? false);
      setSelectedCampaignId(link.campaign_id || '');
      setChannel(link.channel || 'Direct');

      setUtmSource(link.utm_source || '');
      setUtmMedium(link.utm_medium || '');
      setUtmCampaign(link.utm_campaign || '');
      setUtmTerm(link.utm_term || '');
      setUtmContent(link.utm_content || '');
      const hasAnyUtm = Boolean(link.utm_source || link.utm_medium || link.utm_campaign || link.utm_term || link.utm_content);
      setEnableUtm(hasAnyUtm);

      if (link.expires_at) {
        setNeverExpires(false);
        try {
          const d = new Date(link.expires_at);
          setExpiresAt(d.toISOString().slice(0, 16));
        } catch {
          setExpiresAt('');
        }
      } else {
        setNeverExpires(true);
        setExpiresAt('');
      }

      setMaxClicks(link.max_clicks ? String(link.max_clicks) : '');

      // Parse rules
      const rules = typeof link.rules === 'string' ? JSON.parse(link.rules) : (Array.isArray(link.rules) ? link.rules : []);
      const iosRule = rules.find((r: any) => r.condition === 'ios' || (r.rule_type === 'device' && String(r.condition).includes('ios')));
      const androidRule = rules.find((r: any) => r.condition === 'android' || (r.rule_type === 'device' && String(r.condition).includes('android')));
      setIosTargetUrl(iosRule?.target_url || '');
      setAndroidTargetUrl(androidRule?.target_url || '');

      setErrorMsg('');
      setOpenSection(null);
    }
  }, [link, isOpen, primaryDomain?.id]);

  // Resolve hostname
  const resolvedHost = useMemo(() => {
    const selected = domains.find(d => d.id === selectedDomainId);
    if (selected && selected.verified) return selected.hostname;
    if (primaryDomain) return primaryDomain.hostname;
    return typeof window !== 'undefined' ? window.location.host : 'snip.to';
  }, [domains, selectedDomainId, primaryDomain]);

  // Live preview slug & URL
  const livePreviewSlug = customSlug.trim() || link?.short_code || 'link-edit';
  const liveShortUrl = `https://${resolvedHost}/${livePreviewSlug}`;


  // Slug availability check (excluding this current link)
  const isSlugTaken = useMemo(() => {
    if (!customSlug.trim() || !link) return false;
    const clean = customSlug.trim().toLowerCase();
    const originalSlug = (link.custom_slug || link.short_code || '').toLowerCase();
    if (clean === originalSlug) return false; // Allowed to keep own slug
    return links.some(l => l.id !== link.id && (l.custom_slug || l.short_code).toLowerCase() === clean);
  }, [customSlug, link, links]);

  const generateMagicSlug = () => {
    const words = ['quick', 'promo', 'drop', 'creator', 'deal', 'vip', 'boost', 'launch'];
    const randWord = words[Math.floor(Math.random() * words.length)];
    const randNum = Math.floor(100 + Math.random() * 900);
    setCustomSlug(`${randWord}-${randNum}`);
  };

  const handlePaste = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) setDestinationUrl(text.trim());
      }
    } catch {
      const el = document.getElementById('editDestinationUrl');
      if (el) el.focus();
    }
  };

  const handleCopyPreview = () => {
    navigator.clipboard?.writeText(liveShortUrl).catch(() => {});
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 2000);
  };

  const handleGenerateDynamicOg = () => {
    const fallbackTitle = ogTitle.trim() || title.trim() || 'Exclusive Short Link';
    const dynamicOgUrl = `/api/og?title=${encodeURIComponent(fallbackTitle)}&slug=${encodeURIComponent(resolvedHost)}`;
    setOgImageUrl(dynamicOgUrl);
  };

  // Map redirection engine value
  const currentRedirectionValue = redirectType === 'frame' 
    ? 'mask' 
    : redirectType === 'splash' 
      ? 'splash' 
      : headerCode === 302 
        ? '302' 
        : '301';

  const handleRedirectionEngineChange = (val: string) => {
    if (val === '301') {
      setRedirectType('direct');
      setHeaderCode(301);
    } else if (val === '302') {
      setRedirectType('direct');
      setHeaderCode(302);
    } else if (val === 'mask') {
      setRedirectType('frame');
    } else if (val === 'splash') {
      setRedirectType('splash');
    }
  };

  // UTM Presets
  const applyUtmPreset = (preset: 'youtube' | 'instagram' | 'tiktok' | 'twitter' | 'whatsapp' | 'email' | 'google_ads' | 'clear') => {
    if (preset === 'clear') {
      setUtmSource('');
      setUtmMedium('');
      setUtmCampaign('');
      setUtmTerm('');
      setUtmContent('');
      setEnableUtm(false);
      return;
    }
    setEnableUtm(true);
    if (preset === 'youtube') {
      setUtmSource('youtube');
      setUtmMedium('video_desc');
      if (!utmCampaign && selectedCampaignId) {
        const camp = campaigns.find(c => c.id === selectedCampaignId);
        if (camp) setUtmCampaign(camp.name.toLowerCase().replace(/[^a-z0-9]/g, '_'));
      }
    } else if (preset === 'instagram') {
      setUtmSource('instagram');
      setUtmMedium('bio');
    } else if (preset === 'tiktok') {
      setUtmSource('tiktok');
      setUtmMedium('bio');
    } else if (preset === 'twitter') {
      setUtmSource('twitter');
      setUtmMedium('post');
    } else if (preset === 'whatsapp') {
      setUtmSource('whatsapp');
      setUtmMedium('chat');
    } else if (preset === 'email') {
      setUtmSource('newsletter');
      setUtmMedium('email');
    } else if (preset === 'google_ads') {
      setUtmSource('google');
      setUtmMedium('cpc');
    }
  };

  const previewWithUtm = useMemo(() => {
    if (!destinationUrl.trim()) return '';
    try {
      return buildUtmUrl(destinationUrl.trim(), {
        source: utmSource.trim() || undefined,
        medium: utmMedium.trim() || undefined,
        campaign: utmCampaign.trim() || undefined,
        term: utmTerm.trim() || undefined,
        content: utmContent.trim() || undefined,
      });
    } catch {
      return destinationUrl;
    }
  }, [destinationUrl, utmSource, utmMedium, utmCampaign, utmTerm, utmContent]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!link) return;
    setErrorMsg('');

    let dest = destinationUrl.trim();
    if (!dest) {
      setErrorMsg('Please enter a destination URL.');
      return;
    }
    if (!/^https?:\/\//i.test(dest)) {
      dest = `https://${dest}`;
    }

    if (isSlugTaken) {
      setErrorMsg(`Slug "${customSlug}" is already taken by another link. Please choose another.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const linkRules: any[] = [];
      if (iosTargetUrl.trim()) {
        linkRules.push({
          id: generateId('rule_ios'),
          link_id: link.id,
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
          link_id: link.id,
          rule_type: 'device' as const,
          condition: 'android',
          target_url: androidTargetUrl.trim().startsWith('http') || androidTargetUrl.trim().includes('://') 
            ? androidTargetUrl.trim() 
            : `https://${androidTargetUrl.trim()}`,
          weight: 100
        });
      }

      const parsedTags = tagsStr
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const updates: any = {
        destination_url: dest,
        title: title.trim() || undefined,
        custom_slug: customSlug.trim() ? customSlug.trim().toLowerCase() : undefined,
        domain_id: selectedDomainId || undefined,
        status,
        tags: parsedTags,
        campaign_id: selectedCampaignId || undefined,
        redirect_type: redirectType,
        http_status_code: headerCode,
        notes: linkNotes.trim() || undefined,
        shield_protection: shieldProtection,
        hide_referrer: hideReferrer,
        channel: channel !== 'None' ? channel : undefined,
        og_title: ogTitle.trim() || undefined,
        og_description: ogDescription.trim() || undefined,
        og_image_url: ogImageUrl.trim() || undefined,
        utm_source: utmSource.trim() || undefined,
        utm_medium: utmMedium.trim() || undefined,
        utm_campaign: utmCampaign.trim() || undefined,
        utm_term: utmTerm.trim() || undefined,
        utm_content: utmContent.trim() || undefined,
        expires_at: !neverExpires && expiresAt ? new Date(expiresAt).toISOString() : undefined,
        max_clicks: maxClicks && Number(maxClicks) > 0 ? Number(maxClicks) : undefined,
        rules: linkRules.length > 0 ? linkRules : undefined
      };

      if (clearPassword) {
        updates.password = '';
        updates.password_hash = null;
      } else if (password.trim()) {
        updates.password = password.trim();
        updates.password_hash = password.trim();
      }

      await updateLink(link.id, updates);

      showToast(
        'success',
        'Link Updated',
        `Link "/${customSlug.trim() || link.short_code}" was updated successfully.`
      );

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update link';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const detectedApp = destinationUrl ? detectAppDeepLink(destinationUrl) : null;
  const previewOgImage = resolveDisplayImageUrl(ogImageUrl);

  if (!isOpen || !link) return null;

  const fieldCls = 'w-full h-[34px] px-3 bg-surface-container-lowest text-on-surface text-xs rounded-md border-[0.5px] border-outline-variant placeholder:text-outline focus:outline-none focus:border-primary-strong focus:ring-2 focus:ring-primary-strong/20 transition-colors';
  const selectCls = `${fieldCls} appearance-none pr-8 cursor-pointer`;
  const labelCls = 'block text-xs font-medium text-on-surface mb-1';

  const redirectLabels: Record<string, string> = {
    '301': 'Direct (301)',
    '302': 'Temporary (302)',
    mask: 'Masked frame',
    splash: 'Splash screen',
  };
  const tagCount = tagsStr.split(',').map(t => t.trim()).filter(Boolean).length;
  const passwordOn = (hasExistingPassword && !clearPassword) || !!password.trim();
  const sectionSummaries: Record<SectionId, string> = {
    details: [
      status !== 'active' ? status.charAt(0).toUpperCase() + status.slice(1) : '',
      campaigns.find(c => c.id === selectedCampaignId)?.name,
      tagCount ? `${tagCount} ${tagCount === 1 ? 'tag' : 'tags'}` : '',
      linkNotes.trim() ? 'Note' : '',
    ].filter(Boolean).join(' · ') || 'Status, campaign, tags, note',
    tracking: utmSource.trim() || utmMedium.trim() || utmCampaign.trim()
      ? `UTM ${[utmSource, utmMedium].filter(s => s.trim()).join(' / ')}`
      : channel !== 'Direct' ? channel : 'Off',
    social: ogImageUrl ? 'Custom image' : ogDescription.trim() ? 'Custom text' : 'Default',
    protection: [passwordOn ? 'Password' : '', shieldProtection ? 'Bot shield' : '', hideReferrer ? 'Hide referrer' : '']
      .filter(Boolean).join(' · ') || 'Off',
    redirect: [
      redirectLabels[currentRedirectionValue],
      !neverExpires && expiresAt ? 'Expires' : '',
      maxClicks ? `${maxClicks} clicks max` : '',
      iosTargetUrl.trim() || androidTargetUrl.trim() ? 'Device targets' : '',
    ].filter(Boolean).join(' · '),
  };

  const renderSection = (id: SectionId, icon: React.ReactNode, label: string, body: React.ReactNode) => {
    const isOpenSection = openSection === id;
    return (
      <div className="border-b-[0.5px] border-outline-variant last:border-b-0">
        <button
          type="button"
          onClick={() => setOpenSection(isOpenSection ? null : id)}
          aria-expanded={isOpenSection}
          className="w-full h-[44px] flex items-center gap-3 px-1 text-left cursor-pointer group"
        >
          <span className="w-7 h-7 rounded-md bg-surface-container text-on-surface-variant group-hover:text-on-surface flex items-center justify-center shrink-0">
            {icon}
          </span>
          <span className="text-[13px] font-medium text-on-surface shrink-0">{label}</span>
          <span className="flex-1 min-w-0 text-right text-xs text-outline truncate">{sectionSummaries[id]}</span>
          <ChevronDown className={`w-4 h-4 text-outline shrink-0 transition-transform ${isOpenSection ? 'rotate-180' : ''}`} />
        </button>
        {isOpenSection && <div className="pb-4 pt-1 px-1 space-y-3 animate-fade-in">{body}</div>}
      </div>
    );
  };

  const renderToggle = (checked: boolean, onChange: (v: boolean) => void, label: string, hint: string) => (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <span className="min-w-0">
        <span className="block text-xs font-medium text-on-surface">{label}</span>
        <span className="block text-[11px] text-outline">{hint}</span>
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <span className="w-[40px] h-[22px] rounded-full bg-surface-dim peer-checked:bg-primary-container transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary-strong/40" />
        <span className="absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-[18px]" />
      </span>
    </label>
  );

  // Portal to <body>: an ancestor with a transform or filter would otherwise trap this
  // fixed overlay inside the scrolling dashboard panel.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#00000A73] backdrop-blur-[5px] animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-[560px] mx-auto bg-surface-container-lowest rounded-xl shadow-2xl overflow-hidden border-[0.5px] border-outline-variant flex flex-col max-h-[90vh] z-10 text-on-surface">

        {/* Header */}
        <div className="h-[56px] px-5 flex items-center justify-between gap-3 border-b-[0.5px] border-outline-variant shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-[15px] font-semibold text-on-surface shrink-0">Edit link</h2>
            <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-mono truncate">
              /{link.custom_slug || link.short_code}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="size-[30px] rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form
          id="editLinkForm"
          onSubmit={handleSave}
          className="px-5 py-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1 min-h-0"
        >
          {errorMsg && (
            <div className="px-3 py-2 bg-error-container text-on-error-container rounded-md flex items-center gap-2 text-xs border-[0.5px] border-error/30">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Destination */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-on-surface" htmlFor="editDestinationUrl">Destination URL</label>
              <button
                type="button"
                onClick={handlePaste}
                className="text-xs text-primary-ink hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Paste</span>
              </button>
            </div>
            <input
              id="editDestinationUrl"
              type="url"
              required
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              placeholder="https://example.com/your-long-link"
              className={`${fieldCls} h-[40px] text-[13px]`}
            />
            {detectedApp && (
              <p className="mt-1.5 text-[11px] text-on-surface-variant flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-primary-ink shrink-0" />
                <span>Opens in the {detectedApp.appName} app on phones</span>
              </p>
            )}
          </div>

          {/* 2. Short link */}
          <div>
            <label className={labelCls} htmlFor="editSlugInput">Short link</label>
            <div className="flex items-stretch h-[34px] rounded-md border-[0.5px] border-outline-variant bg-surface-container-lowest focus-within:border-primary-strong focus-within:ring-2 focus-within:ring-primary-strong/20 transition-colors">
              <div className="relative shrink-0 max-w-[48%]">
                <select
                  id="editDomainSelect"
                  aria-label="Domain"
                  value={selectedDomainId || primaryDomain?.id || 'dom_platform'}
                  onChange={(e) => setSelectedDomainId(e.target.value)}
                  className="h-full w-full appearance-none pl-3 pr-7 bg-surface-container text-on-surface text-xs rounded-l-md border-r-[0.5px] border-outline-variant focus:outline-none cursor-pointer truncate"
                >
                  {domains.map(d => (
                    <option key={d.id} value={d.id} disabled={!d.verified}>
                      {d.hostname}{d.verified ? '' : ' (pending DNS)'}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-outline" />
              </div>
              <span className="pl-2 flex items-center text-xs text-outline select-none">/</span>
              <input
                id="editSlugInput"
                type="text"
                required
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                placeholder="custom-slug"
                className="flex-1 min-w-0 px-1 bg-transparent text-xs text-on-surface placeholder:text-outline focus:outline-none"
              />
              <button
                type="button"
                onClick={generateMagicSlug}
                title="Suggest a slug"
                className="px-2.5 flex items-center gap-1 text-[11px] text-primary-ink hover:bg-surface-container rounded-r-md cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Suggest</span>
              </button>
            </div>
            {isSlugTaken && (
              <p className="mt-1 text-[11px] text-error flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>This slug is already taken</span>
              </p>
            )}
          </div>

          {/* 3. Optional settings */}
          <div>
            <p className="text-[11px] font-medium text-outline uppercase tracking-wider mb-0.5">More settings</p>
            <div className="border-y-[0.5px] border-outline-variant">
              {renderSection('details', <FileText className="w-3.5 h-3.5" />, 'Details', (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className={labelCls} htmlFor="editLinkTitle">Title</label>
                      <input id="editLinkTitle" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Shown in your links list" className={fieldCls} />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="editLinkStatus">Status</label>
                      <div className="relative">
                        <select
                          id="editLinkStatus"
                          value={status}
                          onChange={(e) => setStatus(e.target.value as 'active' | 'disabled' | 'expired')}
                          className={selectCls}
                        >
                          <option value="active">Active</option>
                          <option value="disabled">Disabled</option>
                          <option value="expired">Expired</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-outline" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls} htmlFor="editCampaignSelect">Campaign</label>
                      <div className="relative">
                        <select
                          id="editCampaignSelect"
                          value={selectedCampaignId}
                          onChange={(e) => {
                            const newId = e.target.value;
                            setSelectedCampaignId(newId);
                            const camp = campaigns.find(c => c.id === newId);
                            if (camp) setUtmCampaign(camp.name.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                          }}
                          className={selectCls}
                        >
                          <option value="">None</option>
                          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-outline" />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="editTags">Tags</label>
                      <input id="editTags" type="text" value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="promo, bio, launch" className={fieldCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="editLinkNotes">Note</label>
                    <input id="editLinkNotes" type="text" value={linkNotes} onChange={(e) => setLinkNotes(e.target.value)} placeholder="Only your team sees this" className={fieldCls} />
                  </div>
                </>
              ))}

              {renderSection('tracking', <BarChart3 className="w-3.5 h-3.5" />, 'UTM tracking', (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'youtube', label: 'YouTube', source: 'youtube' },
                      { key: 'instagram', label: 'Instagram', source: 'instagram' },
                      { key: 'tiktok', label: 'TikTok', source: 'tiktok' },
                      { key: 'twitter', label: 'X', source: 'twitter' },
                      { key: 'whatsapp', label: 'WhatsApp', source: 'whatsapp' },
                      { key: 'email', label: 'Email', source: 'newsletter' },
                      { key: 'google_ads', label: 'Google Ads', source: 'google' },
                    ].map(p => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => applyUtmPreset(p.key as Parameters<typeof applyUtmPreset>[0])}
                        className={`h-[26px] px-2.5 rounded-full text-[11px] border-[0.5px] transition-colors cursor-pointer ${
                          utmSource === p.source
                            ? 'bg-primary-fixed border-primary-strong text-on-secondary-container font-medium'
                            : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                    {(utmSource || utmMedium || utmCampaign) && (
                      <button type="button" onClick={() => applyUtmPreset('clear')} className="h-[26px] px-2 text-[11px] text-error hover:underline cursor-pointer">
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Source', value: utmSource, set: setUtmSource, ph: 'youtube' },
                      { label: 'Medium', value: utmMedium, set: setUtmMedium, ph: 'social' },
                      { label: 'Campaign', value: utmCampaign, set: setUtmCampaign, ph: 'summer_sale' },
                    ].map(f => (
                      <div key={f.label}>
                        <label className="block text-[11px] text-on-surface-variant mb-0.5">{f.label}</label>
                        <input
                          type="text"
                          value={f.value}
                          onChange={(e) => { f.set(e.target.value); setEnableUtm(true); }}
                          placeholder={f.ph}
                          className={`${fieldCls} h-[30px] font-mono`}
                        />
                      </div>
                    ))}
                  </div>
                  {previewWithUtm && (
                    <p className="text-[11px] font-mono text-on-surface-variant truncate" title={previewWithUtm}>{previewWithUtm}</p>
                  )}
                </>
              ))}

              {renderSection('social', <ImageIcon className="w-3.5 h-3.5" />, 'Social preview', (
                <>
                  <input
                    ref={ogFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleOgImageUpload(file);
                    }}
                  />
                  <div className="rounded-lg border-[0.5px] border-outline-variant overflow-hidden">
                    <div
                      onClick={() => !isUploadingOgImage && ogFileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleOgImageUpload(file);
                      }}
                      className="relative h-36 bg-surface-container flex items-center justify-center overflow-hidden cursor-pointer group"
                      title="Click or drop an image"
                    >
                      {isUploadingOgImage ? (
                        <Loader2 className="w-5 h-5 text-primary-ink animate-spin" />
                      ) : (
                        <>
                          {previewOgImage ? (
                            <img
                              src={previewOgImage}
                              alt="Link preview"
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                          ) : (
                            <span className="flex flex-col items-center gap-1 text-outline text-[11px]">
                              <ImageIcon className="w-5 h-5" />
                              No image · click or drop to upload
                            </span>
                          )}
                          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium flex items-center gap-1.5">
                              <UploadCloud className="w-4 h-4" />
                              {ogImageUrl ? 'Replace image' : 'Upload image'}
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                    <div className="px-3 py-2.5 border-t-[0.5px] border-outline-variant space-y-0.5">
                      <span className="block text-[10px] text-outline uppercase tracking-wider">{resolvedHost}</span>
                      <input
                        type="text"
                        value={ogTitle || title}
                        onChange={(e) => setOgTitle(e.target.value)}
                        placeholder="Preview title"
                        aria-label="Preview title"
                        className="w-full bg-transparent text-[13px] font-semibold text-on-surface placeholder:text-outline focus:outline-none"
                      />
                      <input
                        type="text"
                        value={ogDescription}
                        onChange={(e) => setOgDescription(e.target.value)}
                        placeholder="Preview description"
                        aria-label="Preview description"
                        className="w-full bg-transparent text-xs text-on-surface-variant placeholder:text-outline focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ogImageUrl}
                      onChange={(e) => { setOgImageUrl(e.target.value); setUploadStorageType(null); }}
                      placeholder="…or paste an image URL"
                      className={`${fieldCls} font-mono`}
                    />
                    <button
                      type="button"
                      onClick={handleGenerateDynamicOg}
                      className="h-[34px] px-3 shrink-0 rounded-md border-[0.5px] border-outline-variant text-xs text-on-surface hover:bg-surface-container flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-primary-ink" />
                      <span>Generate</span>
                    </button>
                    {ogImageUrl && (
                      <button
                        type="button"
                        onClick={() => { setOgImageUrl(''); setUploadStorageType(null); }}
                        aria-label="Remove image"
                        className="size-[34px] shrink-0 rounded-md flex items-center justify-center text-outline hover:text-error hover:bg-error-container cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {ogImageUrl && uploadStorageType === 'inline' && (
                    <p className="text-[11px] text-amber-700">Stored inline because cloud upload was unavailable.</p>
                  )}
                </>
              ))}

              {renderSection('protection', <ShieldCheck className="w-3.5 h-3.5" />, 'Protection', (
                <>
                  <div>
                    <label className={labelCls} htmlFor="editLinkPassword">Password</label>
                    {hasExistingPassword && !clearPassword ? (
                      <div className="h-[34px] px-3 flex items-center justify-between rounded-md border-[0.5px] border-outline-variant bg-surface-container-low">
                        <span className="text-xs text-on-surface flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-primary-ink" />
                          Password is set
                        </span>
                        <button type="button" onClick={() => setClearPassword(true)} className="text-[11px] text-error hover:underline cursor-pointer">
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          id="editLinkPassword"
                          type="password"
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (clearPassword && e.target.value) setClearPassword(false);
                          }}
                          placeholder={clearPassword ? 'Type a new password, or leave empty' : 'Leave empty for a public link'}
                          className={fieldCls}
                        />
                        {clearPassword && !password && (
                          <p className="mt-1 text-[11px] text-amber-700">The password will be removed when you save.</p>
                        )}
                      </>
                    )}
                  </div>
                  {renderToggle(shieldProtection, setShieldProtection, 'Bot shield', 'Filter scrapers and bots from your clicks')}
                  {renderToggle(hideReferrer, setHideReferrer, 'Hide referrer', 'Don’t tell the destination where visitors came from')}
                </>
              ))}

              {renderSection('redirect', <Settings2 className="w-3.5 h-3.5" />, 'Redirect & limits', (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls} htmlFor="editRedirectType">Redirect type</label>
                      <div className="relative">
                        <select
                          id="editRedirectType"
                          value={currentRedirectionValue}
                          onChange={(e) => handleRedirectionEngineChange(e.target.value)}
                          className={selectCls}
                        >
                          <option value="301" disabled={passwordOn}>Direct (301)</option>
                          <option value="302" disabled={passwordOn}>Temporary (302)</option>
                          <option value="mask">Masked frame</option>
                          <option value="splash">Splash screen</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-outline" />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="editMaxClicks">Click limit</label>
                      <input id="editMaxClicks" type="number" min="1" value={maxClicks} onChange={(e) => setMaxClicks(e.target.value)} placeholder="Unlimited" className={fieldCls} />
                    </div>
                  </div>
                  {redirectType === 'frame' && /google\.com|youtube\.com|twitter\.com|x\.com/i.test(destinationUrl) && (
                    <p className="text-[11px] text-amber-700">This site blocks being shown in a frame. Use Direct or Splash instead.</p>
                  )}
                  <div>
                    <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                      <input type="checkbox" checked={!neverExpires} onChange={(e) => setNeverExpires(!e.target.checked)} className="w-3.5 h-3.5 accent-[#65a30d] cursor-pointer" />
                      <span>Expires on a date</span>
                    </label>
                    {!neverExpires && (
                      <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} aria-label="Expiry date" className={`${fieldCls} mt-2`} />
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls} htmlFor="editIosTarget">iPhone destination</label>
                      <input id="editIosTarget" type="url" value={iosTargetUrl} onChange={(e) => setIosTargetUrl(e.target.value)} placeholder="https://apps.apple.com/…" className={fieldCls} />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="editAndroidTarget">Android destination</label>
                      <input id="editAndroidTarget" type="url" value={androidTargetUrl} onChange={(e) => setAndroidTargetUrl(e.target.value)} placeholder="https://play.google.com/…" className={fieldCls} />
                    </div>
                  </div>
                </>
              ))}
            </div>
          </div>
        </form>

        {/* Footer: always visible */}
        <div className="px-5 py-3 border-t-[0.5px] border-outline-variant flex items-center gap-3 shrink-0 bg-surface-container-lowest">
          <div className="flex-1 min-w-0 text-xs">
            <button
              type="button"
              onClick={handleCopyPreview}
              title="Copy"
              className="max-w-full flex items-center gap-1.5 text-primary-ink truncate cursor-pointer hover:underline"
            >
              {copiedPreview ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">{resolvedHost}/{livePreviewSlug}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-[34px] px-4 rounded-md border-[0.5px] border-outline-variant text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="editLinkForm"
            disabled={isSubmitting || !destinationUrl.trim() || !customSlug.trim() || isSlugTaken}
            className="h-[34px] px-5 rounded-md bg-primary-container hover:bg-primary text-on-primary text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{isSubmitting ? 'Saving…' : 'Save changes'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
