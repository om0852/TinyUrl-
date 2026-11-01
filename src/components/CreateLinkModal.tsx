'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  CheckCircle2,
  Smartphone,
  ChevronDown,
  QrCode,
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
import { generateId, generateBase62Code, buildUtmUrl, normalizeUrl } from '@/lib/db';
import { resolveDisplayImageUrl, compressImageForUpload } from '@/lib/blobStorage';

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SectionId = 'details' | 'tracking' | 'social' | 'protection' | 'redirect';

interface GeneratedItem {
  id: string;
  slug: string;
  shortUrl: string;
  destinationUrl: string;
  title: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
}

export const CreateLinkModal: React.FC<CreateLinkModalProps> = ({ isOpen, onClose }) => {
  const { createShortLink, links, campaigns, domains, currentWorkspace } = useStore();

  const originDomain = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
  const availableDomains = useMemo(() => {
    const list = Array.isArray(domains) ? [...domains] : [];
    const hasHost = list.some(d => d.hostname && d.hostname.toLowerCase() === originDomain.toLowerCase());
    if (!hasHost) {
      list.unshift({
        id: 'dom_platform',
        workspace_id: 'ws_default',
        hostname: originDomain,
        verified: true,
        ssl_status: 'active',
        is_default: true,
        created_at: new Date().toISOString()
      });
    }
    return list;
  }, [domains, originDomain]);

  const primaryDomain = availableDomains.find(d => d.is_default && d.verified) || availableDomains.find(d => d.verified) || availableDomains[0];

  // Mode: Single vs Batch (multiple)
  const [mode, setMode] = useState<'single' | 'multiple'>('single');

  // Input URLs
  const [destinationUrl, setDestinationUrl] = useState('');
  const [multipleUrls, setMultipleUrls] = useState('');
  const [title, setTitle] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState(primaryDomain?.id || 'dom_platform');

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
      alert('File size exceeds the 10MB limit.');
      return;
    }

    setIsUploadingOgImage(true);
    try {
      // Compress to high-res 1200x630 JPEG under 200KB for instant upload and WhatsApp compatibility
      const file = await compressImageForUpload(rawFile);
      const formData = new FormData();
      formData.append('file', file);

      // The server checks upload permission in this workspace; without the header it fell back
      // to the shared ws_default workspace, which nobody belongs to, and answered 403
      const res = await fetch('/api/v1/upload', {
        method: 'POST',
        headers: { 'x-workspace-id': currentWorkspace?.id || '' },
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.url) {
        setOgImageUrl(data.url);
        setUploadStorageType(data.storage === 'vercel_blob' ? 'vercel_blob' : 'inline');
      } else {
        alert(data.error || 'Failed to upload image.');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      alert(err.message || 'Error uploading image.');
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

  // Results State
  const [generatedResults, setGeneratedResults] = useState<GeneratedItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [activeQrModalUrl, setActiveQrModalUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Domain SSL & Edge health check
  const [domainProbeStatus, setDomainProbeStatus] = useState<{
    domain: string;
    checking: boolean;
    ssl_active?: boolean;
    message?: string;
  } | null>(null);

  const selectedDomainObj = availableDomains.find(d => d.id === selectedDomainId) || primaryDomain;
  const resolvedHost = selectedDomainObj?.hostname || originDomain;

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

  // Count parsed multiple URLs
  const parsedMultipleUrls = useMemo(() => {
    return multipleUrls
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }, [multipleUrls]);

  // Auto-detect placement tag and suggest meta title
  useEffect(() => {
    if (!destinationUrl.trim()) return;

    // Auto-suggest meta title if empty
    if (!ogTitle && !title) {
      try {
        const u = new URL(destinationUrl.startsWith('http') ? destinationUrl : `https://${destinationUrl}`);
        const cleanHost = u.hostname.replace('www.', '');
        const pathPart = u.pathname.split('/').filter(Boolean).pop();
        if (pathPart) {
          const autoSuggested = pathPart.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          setTitle(`${autoSuggested} - ${cleanHost}`);
          setOgTitle(`${autoSuggested} - ${cleanHost}`);
        } else {
          setTitle(`Exclusive Link - ${cleanHost}`);
          setOgTitle(`Exclusive Link - ${cleanHost}`);
        }
      } catch {}
    }
  }, [destinationUrl, ogTitle, title]);

  // Quick 1-click UTM preset application
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
    const campObj = campaigns.find(c => c.id === selectedCampaignId);
    const campName = campObj ? campObj.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : (utmCampaign || 'promo');
    setUtmCampaign(campName);

    if (preset === 'youtube') {
      setUtmSource('youtube');
      setUtmMedium('description');
      setChannel('YouTube');
    } else if (preset === 'instagram') {
      setUtmSource('instagram');
      setUtmMedium('bio');
      setChannel('Instagram');
    } else if (preset === 'tiktok') {
      setUtmSource('tiktok');
      setUtmMedium('profile');
      setChannel('TikTok');
    } else if (preset === 'twitter') {
      setUtmSource('twitter');
      setUtmMedium('post');
      setChannel('X (Twitter)');
    } else if (preset === 'whatsapp') {
      setUtmSource('whatsapp');
      setUtmMedium('chat');
      setChannel('WhatsApp');
    } else if (preset === 'email') {
      setUtmSource('newsletter');
      setUtmMedium('email');
    } else if (preset === 'google_ads') {
      setUtmSource('google');
      setUtmMedium('cpc');
    }
  };

  // Real-time preview of Destination URL with UTM Parameters
  const previewWithUtm = useMemo(() => {
    if (!destinationUrl.trim()) return '';
    const norm = normalizeUrl(destinationUrl.trim());
    if (!enableUtm && !utmSource.trim() && !utmMedium.trim() && !utmCampaign.trim()) {
      return norm;
    }
    return buildUtmUrl(norm, {
      source: utmSource.trim() || undefined,
      medium: utmMedium.trim() || undefined,
      campaign: utmCampaign.trim() || undefined,
      term: utmTerm.trim() || undefined,
      content: utmContent.trim() || undefined
    });
  }, [destinationUrl, enableUtm, utmSource, utmMedium, utmCampaign, utmTerm, utmContent]);

  // Auto-switch away from 'direct' if password is set
  useEffect(() => {
    if (password.trim() && redirectType === 'direct') {
      setRedirectType('splash');
    }
  }, [password, redirectType]);

  // Without a custom slug the server generates one, so the preview shows a placeholder
  const livePreviewSlug = customSlug.trim();
  const liveShortUrl = `https://${resolvedHost}/${livePreviewSlug}`;

  // Slug availability check
  const isSlugTaken = customSlug.trim() 
    ? links.some(l => (l.custom_slug || l.short_code).toLowerCase() === customSlug.trim().toLowerCase())
    : false;

  const generateMagicSlug = () => {
    const words = ['quick', 'promo', 'drop', 'creator', 'deal', 'vip', 'boost', 'launch'];
    const randWord = words[Math.floor(Math.random() * words.length)];
    const randNum = Math.floor(100 + Math.random() * 900);
    const newSlug = `${randWord}-${randNum}`;
    setCustomSlug(newSlug);
  };

  const handlePaste = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          if (mode === 'single') {
            setDestinationUrl(text.trim());
          } else {
            setMultipleUrls(prev => prev ? `${prev}\n${text.trim()}` : text.trim());
          }
        }
      }
    } catch {
      const el = document.getElementById('destinationUrl');
      if (el) el.focus();
    }
  };

  const handleCopyPreview = () => {
    navigator.clipboard?.writeText(liveShortUrl).catch(() => {});
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 2000);
  };

  const handleCopySingle = (shortUrl: string, id: string) => {
    navigator.clipboard?.writeText(shortUrl).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    if (generatedResults.length === 0) return;
    const allLinks = generatedResults.map(r => r.shortUrl).join('\n');
    navigator.clipboard?.writeText(allLinks).catch(() => {});
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const resetAndClose = () => {
    setDestinationUrl('');
    setMultipleUrls('');
    setTitle('');
    setCustomSlug('');
    setOgTitle('');
    setOgDescription('');
    setOgImageUrl('');
    setPassword('');
    setLinkNotes('');
    setShieldProtection(true);
    setHideReferrer(false);
    setSelectedCampaignId('');
    setChannel('Direct');
    setIosTargetUrl('');
    setAndroidTargetUrl('');
    setUtmSource('');
    setUtmMedium('');
    setUtmCampaign('');
    setUtmTerm('');
    setUtmContent('');
    setEnableUtm(false);
    setOpenSection(null);
    setErrorMsg('');
    setGeneratedResults([]);
    setActiveQrModalUrl(null);
    onClose();
  };

  const handleGenerateDynamicOg = () => {
    const fallbackTitle = ogTitle.trim() || title.trim() || 'Exclusive Short Link';
    const dynamicOgUrl = `/api/og?title=${encodeURIComponent(fallbackTitle)}&slug=${encodeURIComponent(resolvedHost)}`;
    setOgImageUrl(dynamicOgUrl);
  };

  // Map redirection engine value to backend settings
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

  const executeShorten = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

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

    // ─── Single Mode ───
    if (mode === 'single') {
      let dest = destinationUrl.trim();
      if (!dest) {
        setErrorMsg('Please enter a destination URL.');
        return;
      }
      if (!/^https?:\/\//i.test(dest)) {
        dest = `https://${dest}`;
      }

      if (isSlugTaken) {
        setErrorMsg(`Slug "${customSlug}" is already taken. Please choose another.`);
        return;
      }

      setIsSubmitting(true);
      try {
        const app = detectAppDeepLink(dest);
        const tags = [];
        if (channel && channel !== 'Direct' && channel !== 'None') {
          tags.push(channel.toLowerCase().replace(/[^a-z0-9]/g, '_'));
        }

        const res = createShortLink({
          destination_url: dest,
          title: title.trim() || undefined,
          custom_slug: customSlug.trim() ? customSlug.trim().toLowerCase() : undefined,
          domain_id: selectedDomainId || undefined,
          tags,
          campaign_id: selectedCampaignId || undefined,
          password: password.trim() || undefined,
          redirect_type: redirectType,
          http_status_code: headerCode,
          notes: linkNotes.trim() || undefined,
          shield_protection: shieldProtection,
          hide_referrer: hideReferrer,
          channel: channel !== 'None' ? channel : undefined,
          og_title: ogTitle.trim() || (title.trim() || undefined),
          og_description: ogDescription.trim() || undefined,
          og_image_url: ogImageUrl.trim() || undefined,
          expires_at: !neverExpires && expiresAt ? expiresAt : undefined,
          max_clicks: maxClicks.trim() ? parseInt(maxClicks, 10) : undefined,
          utm_source: (enableUtm || utmSource.trim()) ? utmSource.trim() || undefined : undefined,
          utm_medium: (enableUtm || utmMedium.trim()) ? utmMedium.trim() || undefined : undefined,
          utm_campaign: (enableUtm || utmCampaign.trim()) ? utmCampaign.trim() || undefined : undefined,
          utm_term: utmTerm.trim() || undefined,
          utm_content: utmContent.trim() || undefined,
          rules: linkRules.length > 0 ? linkRules : undefined,
          deep_link: app ? {
            enabled: true,
            app: app.app,
            app_name: app.appName,
            app_uri: app.iosUri,
            ios_uri: app.iosUri,
            android_intent: app.androidIntent,
            fallback_url: app.fallbackUrl
          } : undefined
        });

        if (res.error) {
          setErrorMsg(res.error);
          setIsSubmitting(false);
          return;
        }

        if (res.link) {
          const slug = res.link.custom_slug || res.link.short_code;
          const shortUrl = `https://${resolvedHost}/${slug}`;
          const newItem: GeneratedItem = {
            id: res.link.id,
            slug,
            shortUrl,
            destinationUrl: res.link.destination_url,
            title: res.link.title,
            ogTitle: res.link.og_title,
            ogDescription: res.link.og_description,
            ogImageUrl: res.link.og_image_url
          };
          setGeneratedResults([newItem, ...generatedResults]);
          setDestinationUrl('');
          setTitle('');
          setCustomSlug('');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create short link';
        setErrorMsg(msg);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // ─── Multiple Mode ───
    if (parsedMultipleUrls.length === 0) {
      setErrorMsg('Please paste at least one destination URL (one per line).');
      return;
    }

    setIsSubmitting(true);
    const newItems: GeneratedItem[] = [];
    const errors: string[] = [];

    try {
      for (let i = 0; i < parsedMultipleUrls.length; i++) {
        let rawUrl = parsedMultipleUrls[i];
        if (!/^https?:\/\//i.test(rawUrl)) {
          rawUrl = `https://${rawUrl}`;
        }

        const tags = ['batch'];
        if (channel && channel !== 'Direct' && channel !== 'None') {
          tags.push(channel.toLowerCase().replace(/[^a-z0-9]/g, '_'));
        }

        const res = createShortLink({
          destination_url: rawUrl,
          title: `Bulk Link #${i + 1}`,
          domain_id: selectedDomainId || undefined,
          tags,
          campaign_id: selectedCampaignId || undefined,
          password: password.trim() || undefined,
          redirect_type: redirectType,
          http_status_code: headerCode,
          notes: linkNotes.trim() || undefined,
          shield_protection: shieldProtection,
          hide_referrer: hideReferrer,
          channel: channel !== 'None' ? channel : undefined,
          og_title: ogTitle.trim() || undefined,
          og_description: ogDescription.trim() || undefined,
          og_image_url: ogImageUrl.trim() || undefined,
          expires_at: !neverExpires && expiresAt ? expiresAt : undefined,
          max_clicks: maxClicks.trim() ? parseInt(maxClicks, 10) : undefined,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          rules: linkRules.length > 0 ? linkRules : undefined
        });

        if (res.error) {
          errors.push(`Line ${i + 1}: ${res.error}`);
        } else if (res.link) {
          const slug = res.link.custom_slug || res.link.short_code;
          const shortUrl = `https://${resolvedHost}/${slug}`;
          newItems.push({
            id: res.link.id,
            slug,
            shortUrl,
            destinationUrl: res.link.destination_url,
            title: res.link.title,
            ogTitle: res.link.og_title,
            ogDescription: res.link.og_description,
            ogImageUrl: res.link.og_image_url
          });
        }
      }

      if (newItems.length > 0) {
        setGeneratedResults([...newItems, ...generatedResults]);
        setMultipleUrls('');
      }

      if (errors.length > 0) {
        setErrorMsg(errors.slice(0, 3).join(' | '));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error generating bulk links';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const detectedApp = destinationUrl ? detectAppDeepLink(destinationUrl) : null;
  const previewOgImage = resolveDisplayImageUrl(ogImageUrl);

  if (!isOpen) return null;

  const fieldCls = 'w-full h-[34px] px-3 bg-surface-container-lowest text-on-surface text-xs rounded-md border-[0.5px] border-outline-variant placeholder:text-outline focus:outline-none focus:border-primary-strong focus:ring-2 focus:ring-primary-strong/20 transition-colors';
  const selectCls = `${fieldCls} appearance-none pr-8 cursor-pointer`;
  const labelCls = 'block text-xs font-medium text-on-surface mb-1';

  const redirectLabels: Record<string, string> = {
    '301': 'Direct (301)',
    '302': 'Temporary (302)',
    mask: 'Masked frame',
    splash: 'Splash screen',
  };
  const sectionSummaries: Record<SectionId, string> = {
    details: [title.trim(), campaigns.find(c => c.id === selectedCampaignId)?.name, linkNotes.trim() ? 'Note' : '']
      .filter(Boolean).join(' · ') || 'Title, campaign, note',
    tracking: utmSource.trim() || utmMedium.trim() || utmCampaign.trim()
      ? `UTM ${[utmSource, utmMedium].filter(s => s.trim()).join(' / ')}`
      : channel !== 'Direct' ? channel : 'Off',
    social: ogImageUrl ? 'Custom image' : ogDescription.trim() ? 'Custom text' : 'Default',
    protection: [password.trim() ? 'Password' : '', shieldProtection ? 'Bot shield' : '', hideReferrer ? 'Hide referrer' : '']
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
      <div className="fixed inset-0" onClick={resetAndClose} />

      <div className="relative w-full max-w-[560px] mx-auto bg-surface-container-lowest rounded-xl shadow-2xl overflow-hidden border-[0.5px] border-outline-variant flex flex-col max-h-[90vh] z-10 text-on-surface">

        {/* Header */}
        <div className="h-[56px] px-5 flex items-center justify-between gap-3 border-b-[0.5px] border-outline-variant shrink-0">
          <h2 className="text-[15px] font-semibold text-on-surface">New short link</h2>
          <div className="flex items-center gap-2">
            <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs" role="tablist" aria-label="Link mode">
              {(['single', 'multiple'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`h-[26px] px-3 rounded-[4px] transition-colors cursor-pointer ${
                    mode === m ? 'bg-surface-container-lowest text-on-surface font-medium shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {m === 'single' ? 'Single' : 'Bulk'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={resetAndClose}
              aria-label="Close"
              className="size-[30px] rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form
          id="createLinkForm"
          onSubmit={(e) => { e.preventDefault(); executeShorten(); }}
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
              <label className="text-xs font-medium text-on-surface" htmlFor="destinationUrl">
                {mode === 'single' ? 'Destination URL' : 'Destination URLs'}
              </label>
              <button
                type="button"
                onClick={handlePaste}
                className="text-xs text-primary-ink hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Paste</span>
              </button>
            </div>

            {mode === 'single' ? (
              <input
                id="destinationUrl"
                type="url"
                required
                autoFocus
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="https://example.com/your-long-link"
                className={`${fieldCls} h-[40px] text-[13px]`}
              />
            ) : (
              <>
                <textarea
                  id="destinationUrl"
                  rows={5}
                  value={multipleUrls}
                  onChange={(e) => setMultipleUrls(e.target.value)}
                  placeholder={'One URL per line\nhttps://example.com/a\nhttps://example.com/b'}
                  className="w-full p-3 bg-surface-container-lowest text-on-surface text-xs font-mono rounded-md border-[0.5px] border-outline-variant placeholder:text-outline focus:outline-none focus:border-primary-strong focus:ring-2 focus:ring-primary-strong/20 custom-scrollbar resize-y"
                />
                <p className="mt-1 text-[11px] text-outline">
                  {parsedMultipleUrls.length} {parsedMultipleUrls.length === 1 ? 'link' : 'links'} detected · slugs are generated automatically
                </p>
              </>
            )}

            {detectedApp && (
              <p className="mt-1.5 text-[11px] text-on-surface-variant flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-primary-ink shrink-0" />
                <span>Opens in the {detectedApp.appName} app on phones</span>
              </p>
            )}
          </div>

          {/* 2. Short link (single only) */}
          {mode === 'single' && (
            <div>
              <label className={labelCls} htmlFor="slugInput">Short link</label>
              <div className="flex items-stretch h-[34px] rounded-md border-[0.5px] border-outline-variant bg-surface-container-lowest focus-within:border-primary-strong focus-within:ring-2 focus-within:ring-primary-strong/20 transition-colors">
                <div className="relative shrink-0 max-w-[48%]">
                  <select
                    id="domainSelect"
                    aria-label="Domain"
                    value={selectedDomainId || primaryDomain?.id || 'dom_platform'}
                    onChange={(e) => setSelectedDomainId(e.target.value)}
                    className="h-full w-full appearance-none pl-3 pr-7 bg-surface-container text-on-surface text-xs rounded-l-md border-r-[0.5px] border-outline-variant focus:outline-none cursor-pointer truncate"
                  >
                    {availableDomains.map(d => (
                      <option key={d.id} value={d.id} disabled={!d.verified}>
                        {d.hostname}{d.verified ? '' : ' (pending DNS)'}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-outline" />
                </div>
                <span className="pl-2 flex items-center text-xs text-outline select-none">/</span>
                <input
                  id="slugInput"
                  type="text"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                  placeholder="auto-generated"
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
              {customSlug.trim() && (
                <p className={`mt-1 text-[11px] flex items-center gap-1 ${isSlugTaken ? 'text-error' : 'text-emerald-700'}`}>
                  {isSlugTaken ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{isSlugTaken ? 'This slug is already taken' : 'Available'}</span>
                </p>
              )}
            </div>
          )}

          {/* 3. Optional settings */}
          <div>
            <p className="text-[11px] font-medium text-outline uppercase tracking-wider mb-0.5">Optional</p>
            <div className="border-y-[0.5px] border-outline-variant">
              {renderSection('details', <FileText className="w-3.5 h-3.5" />, 'Details', (
                <>
                  <div>
                    <label className={labelCls} htmlFor="linkTitle">Title</label>
                    <input id="linkTitle" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Shown in your links list" className={fieldCls} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls} htmlFor="campaignSelect">Campaign</label>
                      <div className="relative">
                        <select
                          id="campaignSelect"
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
                      <label className={labelCls} htmlFor="linkNotes">Note</label>
                      <input id="linkNotes" type="text" value={linkNotes} onChange={(e) => setLinkNotes(e.target.value)} placeholder="Only your team sees this" className={fieldCls} />
                    </div>
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
                    <label className={labelCls} htmlFor="linkPassword">Password</label>
                    <input
                      id="linkPassword"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Leave empty for a public link"
                      className={fieldCls}
                    />
                    {password.trim() && (
                      <p className="mt-1 text-[11px] text-on-surface-variant">Visitors enter this password on a splash page before being redirected.</p>
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
                      <label className={labelCls} htmlFor="redirectType">Redirect type</label>
                      <div className="relative">
                        <select
                          id="redirectType"
                          value={currentRedirectionValue}
                          onChange={(e) => handleRedirectionEngineChange(e.target.value)}
                          className={selectCls}
                        >
                          <option value="301" disabled={!!password.trim()}>Direct (301)</option>
                          <option value="302" disabled={!!password.trim()}>Temporary (302)</option>
                          <option value="mask">Masked frame</option>
                          <option value="splash">Splash screen</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-outline" />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="maxClicks">Click limit</label>
                      <input id="maxClicks" type="number" min="1" value={maxClicks} onChange={(e) => setMaxClicks(e.target.value)} placeholder="Unlimited" className={fieldCls} />
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
                      <label className={labelCls} htmlFor="iosTarget">iPhone destination</label>
                      <input id="iosTarget" type="url" value={iosTargetUrl} onChange={(e) => setIosTargetUrl(e.target.value)} placeholder="https://apps.apple.com/…" className={fieldCls} />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="androidTarget">Android destination</label>
                      <input id="androidTarget" type="url" value={androidTargetUrl} onChange={(e) => setAndroidTargetUrl(e.target.value)} placeholder="https://play.google.com/…" className={fieldCls} />
                    </div>
                  </div>
                </>
              ))}
            </div>
          </div>

          {/* Results after creating */}
          {generatedResults.length > 0 && (
            <div className="rounded-lg border-[0.5px] border-primary-strong/50 bg-primary-fixed/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-secondary-container flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {generatedResults.length === 1 ? 'Link created' : `${generatedResults.length} links created`}
                </span>
                <div className="flex items-center gap-3">
                  {generatedResults.length > 1 && (
                    <button type="button" onClick={handleCopyAll} className="text-[11px] text-primary-ink hover:underline cursor-pointer">
                      {copiedAll ? 'Copied' : 'Copy all'}
                    </button>
                  )}
                  <button type="button" onClick={() => setGeneratedResults([])} className="text-[11px] text-outline hover:text-on-surface cursor-pointer">
                    Clear
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                {generatedResults.map((item) => (
                  <div key={item.id} className="h-[40px] px-2.5 bg-surface-container-lowest rounded-md border-[0.5px] border-outline-variant flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-primary-ink truncate">{item.shortUrl}</span>
                      <span className="block text-[10px] text-outline truncate">{item.destinationUrl}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopySingle(item.shortUrl, item.id)}
                      className="h-[28px] px-2.5 rounded-md border-[0.5px] border-outline-variant text-[11px] flex items-center gap-1 hover:bg-surface-container cursor-pointer"
                    >
                      {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveQrModalUrl(activeQrModalUrl === item.shortUrl ? null : item.shortUrl)}
                      aria-label="Show QR code"
                      className="size-[28px] rounded-md border-[0.5px] border-outline-variant flex items-center justify-center hover:bg-surface-container cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={item.shortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open link"
                      className="size-[28px] rounded-md border-[0.5px] border-outline-variant flex items-center justify-center hover:bg-surface-container"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
              {activeQrModalUrl && (
                <div className="p-2.5 bg-surface-container-lowest rounded-md border-[0.5px] border-outline-variant flex items-center gap-3">
                  <QRCodeSVG value={activeQrModalUrl} size={64} level="M" fgColor="#1a1a1a" bgColor="#ffffff" />
                  <span className="flex-1 min-w-0 text-[11px] text-on-surface-variant truncate">{activeQrModalUrl}</span>
                  <button type="button" onClick={() => setActiveQrModalUrl(null)} aria-label="Hide QR code" className="size-[28px] rounded-full flex items-center justify-center text-outline hover:text-on-surface cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer: always visible */}
        <div className="px-5 py-3 border-t-[0.5px] border-outline-variant flex items-center gap-3 shrink-0 bg-surface-container-lowest">
          <div className="flex-1 min-w-0 text-xs">
            {mode === 'single' && (
              livePreviewSlug ? (
                <button
                  type="button"
                  onClick={handleCopyPreview}
                  title="Copy"
                  className="max-w-full flex items-center gap-1.5 text-primary-ink truncate cursor-pointer hover:underline"
                >
                  {copiedPreview ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Link2 className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{resolvedHost}/{livePreviewSlug}</span>
                </button>
              ) : (
                <span className="flex items-center gap-1.5 text-outline truncate">
                  <Link2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{resolvedHost}/…</span>
                </span>
              )
            )}
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="h-[34px] px-4 rounded-md border-[0.5px] border-outline-variant text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            {generatedResults.length > 0 ? 'Done' : 'Cancel'}
          </button>
          <button
            type="submit"
            form="createLinkForm"
            disabled={isSubmitting || (mode === 'single' ? !destinationUrl.trim() || isSlugTaken : parsedMultipleUrls.length === 0)}
            className="h-[34px] px-5 rounded-md bg-primary-container hover:bg-primary text-on-primary text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>
              {isSubmitting
                ? 'Creating…'
                : mode === 'single' ? 'Create link' : parsedMultipleUrls.length ? `Create ${parsedMultipleUrls.length} links` : 'Create links'}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
