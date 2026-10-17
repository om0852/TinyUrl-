'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';
import { InfoTooltip } from '@/components/ui';
import { Link as LinkType } from '@/lib/types';
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
  Unlock,
  CheckCircle2, 
  Smartphone, 
  Sliders, 
  ChevronDown, 
  ChevronUp, 
  EyeOff, 
  Share2, 
  Sparkles, 
  Image as ImageIcon,
  MessageCircle,
  CheckCheck,
  Clipboard,
  Zap,
  Tag,
  Activity,
  Save,
  UploadCloud,
  Loader2,
  Trash2,
  Cloud
} from 'lucide-react';
import { detectAppDeepLink } from '@/lib/deepLink';
import { generateId, buildUtmUrl, normalizeUrl } from '@/lib/db';
import { resolveDisplayImageUrl, isVercelBlobUrl, compressImageForUpload } from '@/lib/blobStorage';

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
  const [activeTab, setActiveTab] = useState<'targeting' | 'social' | 'security'>('targeting');

  // Open Graph & Social Media Preview Meta Tags
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [socialPreviewTab, setSocialPreviewTab] = useState<'whatsapp' | 'twitter'>('twitter');
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
          isBlob ? 'Uploaded to Vercel Blob' : 'Image Ready', 
          isBlob ? 'Image uploaded to high-speed Vercel Blob CDN' : 'Image loaded successfully'
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
  const [showUtmBuilder, setShowUtmBuilder] = useState(false);
  const [enableUtm, setEnableUtm] = useState(false);
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmTerm, setUtmTerm] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [showAdvancedRouting, setShowAdvancedRouting] = useState(false);
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
      setShowUtmBuilder(hasAnyUtm);

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
      if (iosRule || androidRule || link.expires_at || link.max_clicks) {
        setShowAdvancedRouting(true);
      }

      setErrorMsg('');
      setActiveTab('targeting');
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

  // Characters saved
  const charsSaved = useMemo(() => {
    if (!destinationUrl.trim()) return 0;
    const destLen = destinationUrl.trim().length;
    const shortLen = liveShortUrl.length;
    return Math.max(0, destLen - shortLen);
  }, [destinationUrl, liveShortUrl]);

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
    const dynamicOgUrl = `/api/og?title=${encodeURIComponent(fallbackTitle)}&slug=${encodeURIComponent(resolvedHost)}&theme=purple`;
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
    setShowUtmBuilder(true);
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
  const previewOgTitle = ogTitle.trim() || title.trim() || 'Link Preview Card';
  const previewOgDescription = ogDescription.trim() || 'Interactive click tracking and dynamic redirection powered by Linko.';
  const previewOgImage = resolveDisplayImageUrl(ogImageUrl) || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80';

  if (!isOpen || !link) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-on-surface/40 backdrop-blur-sm transition-all duration-200 animate-fade-in">
      <div 
        className="fixed inset-0"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl mx-auto bg-surface-container-lowest rounded-xl shadow-xl overflow-hidden transition-all duration-200 border border-outline-variant/30 flex flex-col max-h-[92vh] z-10 text-on-surface">
        
        {/* Top Decorative Subtle Accent */}
        <div className="h-1 w-full bg-gradient-to-r from-primary to-secondary shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface-container-lowest shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shadow-sm shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-on-surface tracking-tight">Edit Short Link</h2>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-mono font-semibold">
                  /{link.custom_slug || link.short_code}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Modify target destination, custom slug, social media preview, and security rules
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer self-end md:self-center"
            title="Close Dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form 
          onSubmit={handleSave}
          className="p-4 sm:p-5 pt-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1"
        >
          {errorMsg && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2 font-medium text-xs border border-red-200 dark:border-red-900/40">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* HERO ZONE (80/20 Rule: Main Destination URL & Slug) */}
          <div className="bg-surface-container-low p-4 rounded-xl space-y-3.5 border border-outline-variant/30">
            {/* Destination URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-xs text-on-surface flex items-center gap-1.5" htmlFor="editDestinationUrl">
                  <span>Destination URL</span>
                  <span className="text-red-500 font-bold">*</span>
                  <InfoTooltip text="The target web address where visitors will be routed" />
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
                    <span>SSL Autodetect</span>
                  </span>
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="text-xs font-semibold text-primary hover:text-secondary flex items-center gap-0.5 cursor-pointer"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                    <span>Paste</span>
                  </button>
                </div>
              </div>

              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none text-on-surface-variant">
                  <Link2 className="w-4 h-4" />
                </div>
                <input
                  id="editDestinationUrl"
                  type="url"
                  required
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://yourbrand.com/products/summer-sale-2025"
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest text-on-surface text-xs rounded-lg shadow-sm border border-outline-variant/40 placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                />
              </div>

              {detectedApp && (
                <div className="flex items-center gap-1.5 p-1.5 mt-2 bg-surface-container-lowest rounded-lg text-xs font-medium text-on-surface border border-outline-variant/30">
                  <Smartphone className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>OpeninApp: Direct native launch enabled for <strong>{detectedApp.appName}</strong></span>
                </div>
              )}
            </div>

            {/* Custom Domain + Slug Assembly */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-on-surface mb-1.5">
                <span>Shortened Routing Link</span>
                <InfoTooltip text="Your custom branded domain and vanity slug" />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                {/* Domain Selector */}
                <div className="md:col-span-5 relative">
                  <select
                    id="editDomainSelect"
                    value={selectedDomainId || primaryDomain?.id || 'dom_platform'}
                    onChange={(e) => setSelectedDomainId(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2 bg-surface-container-lowest text-on-surface font-mono text-xs rounded-lg shadow-sm border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer font-medium"
                  >
                    {domains.map(d => (
                      <option key={d.id} value={d.id} disabled={!d.verified}>
                        {d.hostname} {d.is_default || d.id === 'dom_platform' ? '(Primary)' : (d.verified ? '' : '(Pending DNS)')}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant flex items-center">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>

                {/* Custom Slug Input */}
                <div className="md:col-span-7 relative flex items-center">
                  <div className="absolute left-3 text-on-surface-variant font-mono text-xs pointer-events-none select-none">/</div>
                  <input
                    id="editSlugInput"
                    type="text"
                    required
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                    placeholder="custom-slug"
                    className="w-full pl-6 pr-20 py-2 bg-surface-container-lowest text-primary font-mono text-xs font-bold rounded-lg shadow-sm border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <div className="absolute right-2.5 flex items-center gap-1">
                    {customSlug.trim() ? (
                      isSlugTaken ? (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                          <span className="text-[11px] font-semibold text-red-500 font-mono">Taken</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-[11px] font-semibold text-emerald-600 font-mono">Valid</span>
                        </>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={generateMagicSlug}
                        className="text-[11px] text-on-surface-variant hover:text-primary font-medium"
                      >
                        Auto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sub-bar: SSL edge note + chars saved */}
              <div className="flex items-center justify-between mt-1.5 text-xs text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>SSL verified on custom edge network</span>
                </span>
                <span className="font-mono text-xs text-on-surface-variant font-medium">
                  {charsSaved} chars saved
                </span>
              </div>
            </div>

            {/* Link Title, Status & Tags Row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1 border-t border-outline-variant/20">
              <div className="sm:col-span-5">
                <label className="text-[11px] font-semibold text-on-surface block mb-1">Link Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q4 Growth Campaign"
                  className="w-full px-2.5 py-1.5 bg-surface-container-lowest text-on-surface text-xs rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] font-semibold text-on-surface block mb-1">Status</label>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'active' | 'disabled' | 'expired')}
                    className="w-full appearance-none pl-2.5 pr-7 py-1.5 bg-surface-container-lowest text-on-surface text-xs rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-1 focus:ring-primary font-medium cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                    <option value="expired">Expired</option>
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="text-[11px] font-semibold text-on-surface block mb-1 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-primary" />
                  <span>Tags (comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  placeholder="promo, bio, launch"
                  className="w-full px-2.5 py-1.5 bg-surface-container-lowest text-on-surface text-xs rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Sub-bar: SSL edge note + chars saved + Quick Upload Link */}
              <div className="flex items-center justify-between mt-1.5 text-xs text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>SSL verified on edge</span>
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('social')}
                    className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer bg-primary/10 px-2 py-0.5 rounded-md"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload Social Image</span>
                  </button>
                  <span className="font-mono text-xs text-on-surface-variant font-medium">
                    {charsSaved} chars saved
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Progressive Disclosure: Segmented Settings Tabs */}
          <div className="space-y-3">
            {/* Tab Navigation Bar */}
            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
              <button
                type="button"
                onClick={() => setActiveTab('targeting')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'targeting'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Channel &amp; Routing</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('social')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'social'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5 text-primary" />
                <span>Social Card &amp; Image (Vercel Blob)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('security')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'security'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Shield &amp; Access</span>
              </button>
            </div>

            {/* TAB CONTENT 1: Channel & Routing */}
            {activeTab === 'targeting' && (
              <div className="space-y-3.5 animate-fade-in">
                {/* Target Platform Channel Pills */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-xs text-on-surface flex items-center gap-1.5">
                      <span>Target Platform Channel</span>
                      <InfoTooltip text="Select target channel for deep-linking and attribution" />
                    </label>
                    <span className="text-xs text-on-surface-variant">App deep-links enabled</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'General', val: 'Direct' },
                      { label: 'YouTube', val: 'YouTube' },
                      { label: 'TikTok', val: 'TikTok' },
                      { label: 'Instagram', val: 'Instagram' },
                      { label: 'X (Twitter)', val: 'X (Twitter)' },
                      { label: 'WhatsApp', val: 'WhatsApp' },
                      { label: 'Affiliate / Bio', val: 'Affiliate' },
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setChannel(item.val)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                          channel === item.val
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2-Column: Campaign Tag & Redirection Engine */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Campaign Tag */}
                  <div>
                    <label className="flex items-center gap-1.5 font-semibold text-xs text-on-surface mb-1" htmlFor="editCampaignSelect">
                      <span>Campaign Tag</span>
                      <InfoTooltip text="Assign this link to an active marketing campaign or sponsor" />
                    </label>
                    <div className="relative">
                      <select
                        id="editCampaignSelect"
                        value={selectedCampaignId}
                        onChange={(e) => {
                          const newId = e.target.value;
                          setSelectedCampaignId(newId);
                          const camp = campaigns.find(c => c.id === newId);
                          if (camp) {
                            setUtmCampaign(camp.name.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                          }
                        }}
                        className="w-full appearance-none pl-3 pr-8 py-2 bg-surface-container-low text-on-surface text-xs rounded-lg shadow-sm border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer font-medium"
                      >
                        <option value="">None (General Link)</option>
                        {campaigns.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.description || 'Campaign'})</option>
                        ))}
                      </select>
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant flex items-center">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Redirection Engine */}
                  <div>
                    <label className="flex items-center gap-1.5 font-semibold text-xs text-on-surface mb-1" htmlFor="editRedirectType">
                      <span>Redirection Engine</span>
                      <InfoTooltip text="Choose HTTP redirect status code: 301 permanent or 302/307 temporary" />
                    </label>
                    <div className="relative">
                      <select
                        id="editRedirectType"
                        value={currentRedirectionValue}
                        onChange={(e) => handleRedirectionEngineChange(e.target.value)}
                        className="w-full appearance-none pl-3 pr-8 py-2 bg-surface-container-low text-on-surface text-xs rounded-lg shadow-sm border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer font-medium"
                      >
                        <option value="301" disabled={!!password.trim() || (hasExistingPassword && !clearPassword)}>
                          Direct (301 Permanent - Fast) {(password.trim() || (hasExistingPassword && !clearPassword)) ? '(Disabled with Password)' : ''}
                        </option>
                        <option value="302" disabled={!!password.trim() || (hasExistingPassword && !clearPassword)}>
                          Temporary (302 Found) {(password.trim() || (hasExistingPassword && !clearPassword)) ? '(Disabled with Password)' : ''}
                        </option>
                        <option value="mask">iFrame / Masked Title</option>
                        <option value="splash">Branded Splash Screen (2s)</option>
                      </select>
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant flex items-center">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Internal Search Note */}
                <div>
                  <label className="flex items-center gap-1.5 font-semibold text-xs text-on-surface mb-1" htmlFor="editLinkNotes">
                    <span>Internal Reference Note</span>
                    <InfoTooltip text="Internal private note for your team or organization" />
                  </label>
                  <input
                    id="editLinkNotes"
                    type="text"
                    value={linkNotes}
                    onChange={(e) => setLinkNotes(e.target.value)}
                    placeholder="e.g. Bio link placement for Sarah's vlog series"
                    className="w-full px-3 py-2 bg-surface-container-low text-on-surface text-xs rounded-lg shadow-sm border border-outline-variant/30 placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Campaign UTM Builder Accordion */}
                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-primary" />
                      <span className="font-semibold text-xs text-on-surface">Campaign UTM Builder &amp; Tracking</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUtmBuilder(!showUtmBuilder);
                        if (!enableUtm && !showUtmBuilder) setEnableUtm(true);
                      }}
                      className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showUtmBuilder ? 'Hide UTMs' : 'Customize UTMs'}</span>
                      {showUtmBuilder ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-outline-variant/20">
                    <span className="text-[11px] text-on-surface-variant font-medium mr-1">Presets:</span>
                    {[
                      { key: 'youtube', label: 'YouTube' },
                      { key: 'instagram', label: 'Instagram' },
                      { key: 'tiktok', label: 'TikTok' },
                      { key: 'twitter', label: 'X / Twitter' },
                      { key: 'whatsapp', label: 'WhatsApp' },
                      { key: 'email', label: 'Email' },
                      { key: 'google_ads', label: 'Google Ads' }
                    ].map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => applyUtmPreset(p.key as any)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                          utmSource === (p.key === 'twitter' ? 'twitter' : p.key === 'email' ? 'newsletter' : p.key === 'google_ads' ? 'google' : p.key)
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border-outline-variant/40'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                    {(utmSource || utmMedium || utmCampaign) && (
                      <button
                        type="button"
                        onClick={() => applyUtmPreset('clear')}
                        className="text-[10px] text-red-500 font-semibold hover:underline ml-auto cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {showUtmBuilder && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 animate-fade-in">
                      <div>
                        <label className="text-[11px] font-semibold text-on-surface block mb-0.5">UTM Source</label>
                        <input
                          type="text"
                          value={utmSource}
                          onChange={(e) => { setUtmSource(e.target.value); setEnableUtm(true); }}
                          placeholder="google, youtube"
                          className="w-full px-2 py-1.5 bg-surface-container-lowest rounded-md border border-outline-variant/40 font-mono text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-on-surface block mb-0.5">UTM Medium</label>
                        <input
                          type="text"
                          value={utmMedium}
                          onChange={(e) => { setUtmMedium(e.target.value); setEnableUtm(true); }}
                          placeholder="cpc, bio, social"
                          className="w-full px-2 py-1.5 bg-surface-container-lowest rounded-md border border-outline-variant/40 font-mono text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-on-surface block mb-0.5">UTM Campaign</label>
                        <input
                          type="text"
                          value={utmCampaign}
                          onChange={(e) => { setUtmCampaign(e.target.value); setEnableUtm(true); }}
                          placeholder="summer_sale"
                          className="w-full px-2 py-1.5 bg-surface-container-lowest rounded-md border border-outline-variant/40 font-mono text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      {previewWithUtm && (
                        <div className="col-span-1 sm:col-span-3 p-1.5 bg-surface-container-lowest rounded-md border border-outline-variant/30 text-[10px] font-mono text-primary truncate">
                          Final Target: {previewWithUtm}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Smart Device Targeting & Limits Accordion */}
                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5 text-primary" />
                      <span className="font-semibold text-xs text-on-surface">Smart Device Targeting &amp; Limits</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedRouting(!showAdvancedRouting)}
                      className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showAdvancedRouting ? 'Hide Details' : 'Configure'}</span>
                      {showAdvancedRouting ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {showAdvancedRouting && (
                    <div className="space-y-2.5 pt-1 border-t border-outline-variant/20 animate-fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-on-surface block mb-0.5">🍎 iOS Destination</label>
                          <input
                            type="url"
                            value={iosTargetUrl}
                            onChange={(e) => setIosTargetUrl(e.target.value)}
                            placeholder="https://apps.apple.com/app/..."
                            className="w-full px-2 py-1.5 bg-surface-container-lowest rounded-md border border-outline-variant/40 font-mono text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-on-surface block mb-0.5">🤖 Android Destination</label>
                          <input
                            type="url"
                            value={androidTargetUrl}
                            onChange={(e) => setAndroidTargetUrl(e.target.value)}
                            placeholder="https://play.google.com/store/apps/..."
                            className="w-full px-2 py-1.5 bg-surface-container-lowest rounded-md border border-outline-variant/40 font-mono text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1 border-t border-outline-variant/20">
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={neverExpires}
                              onChange={(e) => setNeverExpires(e.target.checked)}
                              className="rounded accent-primary w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-xs font-semibold text-on-surface">Never expires</span>
                          </label>
                          {!neverExpires && (
                            <input
                              type="datetime-local"
                              value={expiresAt}
                              onChange={(e) => setExpiresAt(e.target.value)}
                              className="px-2 py-1 bg-surface-container-lowest rounded-md border border-outline-variant/40 text-xs text-on-surface"
                            />
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-on-surface-variant">Max Clicks Limit:</span>
                          <input
                            type="number"
                            min="1"
                            value={maxClicks}
                            onChange={(e) => setMaxClicks(e.target.value)}
                            placeholder="Unlimited"
                            className="w-24 px-2 py-1 bg-surface-container-lowest rounded-md border border-outline-variant/40 text-xs text-on-surface font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: Social Media Meta (OG) Preview */}
            {activeTab === 'social' && (
              <div className="space-y-3.5 animate-fade-in">
                <div className="bg-surface-container-low p-4 rounded-xl space-y-3.5 border border-outline-variant/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-on-surface">Interactive Open Graph Preview</h3>
                      <p className="text-xs text-on-surface-variant">Customize how your link looks when shared on Twitter, WhatsApp, iMessage, and Slack.</p>
                    </div>
                    <span className="text-xs font-semibold text-primary bg-surface-container px-2.5 py-1 rounded-md">Live Sync</span>
                  </div>

                  {/* Platform Switcher */}
                  <div className="flex items-center justify-center gap-1 bg-surface-container-lowest p-1 rounded-lg border border-outline-variant/30 max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={() => setSocialPreviewTab('twitter')}
                      className={`flex-1 py-1 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        socialPreviewTab === 'twitter'
                          ? 'bg-primary text-white shadow-xs font-bold'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      X / Facebook / Slack
                    </button>
                    <button
                      type="button"
                      onClick={() => setSocialPreviewTab('whatsapp')}
                      className={`flex-1 py-1 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        socialPreviewTab === 'whatsapp'
                          ? 'bg-emerald-600 text-white shadow-xs font-bold'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>WhatsApp</span>
                    </button>
                  </div>

                  {/* Social Card Mockup */}
                  {socialPreviewTab === 'twitter' ? (
                    <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm max-w-lg mx-auto border border-outline-variant/40">
                      <div className="relative h-36 bg-surface-container-high overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          className="w-full h-full object-cover" 
                          src={previewOgImage} 
                          alt="Open Graph preview" 
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => ogFileInputRef.current?.click()}
                            className="px-2.5 py-1 bg-primary hover:bg-primary/90 text-white rounded text-xs font-semibold flex items-center gap-1 backdrop-blur-sm transition-all cursor-pointer shadow-sm"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>Upload Image</span>
                          </button>
                          <button 
                            type="button"
                            onClick={handleGenerateDynamicOg}
                            className="px-2.5 py-1 bg-black/70 hover:bg-black text-white rounded text-xs font-medium flex items-center gap-1 backdrop-blur-sm transition-all cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-primary-fixed" />
                            <span>Auto-Generate</span>
                          </button>
                        </div>
                      </div>
                      <div className="p-3 bg-surface-container-lowest space-y-1">
                        <span className="font-mono text-xs text-on-surface-variant uppercase tracking-wider block font-medium">
                          {resolvedHost}
                        </span>
                        <input
                          type="text"
                          value={ogTitle || title}
                          onChange={(e) => setOgTitle(e.target.value)}
                          placeholder="Card Title"
                          className="font-bold text-sm text-on-surface w-full bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
                        />
                        <input
                          type="text"
                          value={ogDescription}
                          onChange={(e) => setOgDescription(e.target.value)}
                          placeholder="Card Description"
                          className="text-xs text-on-surface-variant w-full bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
                        />
                      </div>
                    </div>
                  ) : (
                    /* WhatsApp Chat Bubble Mockup */
                    <div className="bg-[#e7fedb] dark:bg-[#005c4b]/30 p-3 rounded-xl border border-emerald-500/20 shadow-xs flex flex-col gap-1.5 text-left max-w-lg mx-auto">
                      <div className="relative group overflow-hidden rounded-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewOgImage}
                          alt="Thumbnail preview"
                          className="w-full h-28 object-cover rounded-lg border border-emerald-500/20"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute top-2 right-2 flex items-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => ogFileInputRef.current?.click()}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1 backdrop-blur-sm transition-all cursor-pointer shadow-sm"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>Upload Image</span>
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={ogTitle || title}
                        onChange={(e) => setOgTitle(e.target.value)}
                        placeholder="Card Title"
                        className="font-bold text-xs text-gray-900 dark:text-gray-100 w-full bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
                      />
                      <input
                        type="text"
                        value={ogDescription}
                        onChange={(e) => setOgDescription(e.target.value)}
                        placeholder="Card Description"
                        className="text-[11px] text-gray-600 dark:text-gray-300 w-full bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
                      />
                      <div className="flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-400 font-mono pt-1 border-t border-emerald-600/15">
                        <span className="truncate">https://{resolvedHost}/{livePreviewSlug}</span>
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      </div>
                    </div>
                  )}

                  {/* Upload Image to Vercel Blob or Enter URL */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-primary" />
                        <span>Card Thumbnail Image (og:image)</span>
                        <InfoTooltip text="Upload to Vercel Blob CDN or enter custom image URL. 1200x630px recommended for high-resolution WhatsApp and Twitter cards." />
                      </label>
                      {ogImageUrl && (
                        <button
                          type="button"
                          onClick={() => { setOgImageUrl(''); setUploadStorageType(null); }}
                          className="text-[11px] text-red-500 hover:text-red-600 flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    {/* Hidden file input */}
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

                    {/* Drag & Drop / Click Upload Box */}
                    <div
                      onClick={() => !isUploadingOgImage && ogFileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleOgImageUpload(file);
                      }}
                      className={`relative border-2 border-dashed rounded-xl p-3 text-center transition-all cursor-pointer ${
                        ogImageUrl 
                          ? 'border-primary/40 bg-primary/5' 
                          : 'border-outline-variant/50 hover:border-primary/60 bg-surface-container-lowest hover:bg-surface-container-low'
                      }`}
                    >
                      {isUploadingOgImage ? (
                        <div className="py-2 flex flex-col items-center justify-center gap-1.5">
                          <Loader2 className="w-5 h-5 text-primary animate-spin" />
                          <span className="text-xs font-medium text-primary">Uploading image to Vercel Blob...</span>
                        </div>
                      ) : ogImageUrl ? (
                        <div className="flex items-center justify-between gap-3 text-left">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={resolveDisplayImageUrl(ogImageUrl)}
                              alt="Thumbnail"
                              className="w-12 h-9 object-cover rounded-md border border-outline-variant/40 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-on-surface">Image Ready</span>
                                {isVercelBlobUrl(ogImageUrl) || uploadStorageType === 'vercel_blob' ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                    <Cloud className="w-2.5 h-2.5" />
                                    <span>Vercel Blob</span>
                                  </span>
                                ) : ogImageUrl.startsWith('data:') ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                                    Inline Buffer
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                                    External URL
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-on-surface-variant truncate font-mono mt-0.5 max-w-[240px]">
                                {ogImageUrl}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              ogFileInputRef.current?.click();
                            }}
                            className="px-2 py-1 text-[11px] bg-surface-container hover:bg-surface-container-high text-on-surface rounded-md border border-outline-variant/40 font-medium shrink-0 cursor-pointer"
                          >
                            Replace
                          </button>
                        </div>
                      ) : (
                        <div className="py-2 flex flex-col items-center justify-center gap-1 text-on-surface-variant">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-0.5">
                            <UploadCloud className="w-4 h-4" />
                          </div>
                          <div className="text-xs font-semibold text-on-surface">
                            Click to upload image or drag &amp; drop
                          </div>
                          <div className="text-[10px] text-on-surface-variant flex items-center gap-1.5">
                            <span>PNG, JPG, WebP up to 10MB</span>
                            <span>&bull;</span>
                            <span className="text-primary font-medium flex items-center gap-0.5">
                              <Cloud className="w-3 h-3" />
                              <span>Vercel Blob Storage</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Direct Image URL input */}
                    <div className="pt-0.5">
                      <input
                        type="text"
                        value={ogImageUrl}
                        onChange={(e) => {
                          setOgImageUrl(e.target.value);
                          setUploadStorageType(null);
                        }}
                        placeholder="Or paste external image URL (https://...)"
                        className="w-full px-3 py-1.5 bg-surface-container-lowest text-on-surface text-xs rounded-lg border border-outline-variant/40 font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 text-xs text-on-surface-variant">
                    <InfoTooltip text="Edge CDN caches generated cards for fast delivery" />
                    <span>Rich previews are cached at edge nodes for 48 hours</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: Shield & Security */}
            {activeTab === 'security' && (
              <div className="space-y-3 animate-fade-in">
                {/* Bot Shield Crawlers Toggle */}
                <div className="p-4 bg-surface-container-low rounded-xl flex items-center justify-between gap-4 border border-outline-variant/30">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-surface-container text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-on-surface">Bot Shield &amp; Cloaking</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                          Recommended
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant">Bypass malicious scrapers, verify real humans, and safeguard your ad accounts.</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={shieldProtection}
                      onChange={(e) => setShieldProtection(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                  </label>
                </div>

                {/* Hide Referrer */}
                <div className="p-4 bg-surface-container-low rounded-xl flex items-center justify-between gap-4 border border-outline-variant/30">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-surface-container text-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <EyeOff className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-on-surface">Anonymize Referrer Header</span>
                      <p className="text-xs text-on-surface-variant">Strips outbound document.referrer metadata to keep origin sources confidential.</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={hideReferrer}
                      onChange={(e) => setHideReferrer(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                  </label>
                </div>

                {/* Password Protection Field */}
                <div className="p-4 bg-surface-container-low rounded-xl space-y-2 border border-outline-variant/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-on-surface-variant" />
                      <label className="font-bold text-sm text-on-surface flex items-center gap-1.5" htmlFor="editLinkPassword">
                        <span>Passcode Gate</span>
                        <InfoTooltip text="Require visitors to enter a secret password before redirecting" />
                      </label>
                    </div>
                    {hasExistingPassword && !clearPassword ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Password Currently Set
                      </span>
                    ) : (
                      <span className="text-xs text-on-surface-variant">Optional security gate</span>
                    )}
                  </div>

                  {hasExistingPassword && !clearPassword ? (
                    <div className="flex items-center justify-between p-2.5 bg-surface-container-lowest rounded-lg border border-outline-variant/40">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-medium text-on-surface">•••••••••••• (Encrypted Passcode)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setClearPassword(true)}
                          className="px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors cursor-pointer"
                        >
                          Remove Password
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <input
                        id="editLinkPassword"
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (clearPassword && e.target.value) setClearPassword(false);
                        }}
                        placeholder={clearPassword ? 'Password removed. Type new password to set...' : 'Leave blank for public access'}
                        className="w-full px-3 py-2 bg-surface-container-lowest text-on-surface text-xs rounded-lg shadow-sm border border-outline-variant/40 placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {clearPassword && (
                        <p className="text-[11px] text-amber-600 mt-1 font-medium">
                          ⚠️ Password protection will be removed when you save this link.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Live Generated Preview Bar */}
          <div className="p-2.5 px-3.5 bg-surface-container rounded-lg flex items-center justify-between text-xs font-medium border border-outline-variant/20">
            <div className="flex items-center gap-2 min-w-0">
              <Link2 className="w-4 h-4 text-primary shrink-0" />
              <span className="text-on-surface-variant shrink-0">Live URL:</span>
              <span className="font-mono text-primary font-bold truncate">
                {liveShortUrl}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyPreview}
              className="text-xs text-on-surface-variant hover:text-on-surface flex items-center gap-1 shrink-0 font-medium cursor-pointer transition-colors"
            >
              {copiedPreview ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPreview ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          {/* Modal Footer */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest border-t border-outline-variant/30 shrink-0">
            {/* Status Indicator */}
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs">All workspace links auto-synced with analytics</span>
            </div>

            {/* Action Controls */}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-primary hover:bg-secondary active:scale-[0.99] text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
