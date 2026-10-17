'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ChevronDown, 
  ChevronUp, 
  EyeOff, 
  Share2, 
  QrCode, 
  Sparkles, 
  Image as ImageIcon,
  MessageCircle,
  CheckCheck,
  Clipboard,
  Zap,
  UploadCloud,
  Loader2,
  Trash2,
  Cloud
} from 'lucide-react';
import { InfoTooltip } from '@/components/ui';
import { detectAppDeepLink } from '@/lib/deepLink';
import { generateId, generateBase62Code, buildUtmUrl, normalizeUrl } from '@/lib/db';
import { resolveDisplayImageUrl, isVercelBlobUrl, compressImageForUpload } from '@/lib/blobStorage';

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
  const { createShortLink, links, campaigns, domains } = useStore();

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
      alert('File size exceeds the 10MB limit.');
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
    setShowUtmBuilder(true);
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

  // Characters saved calculation
  const livePreviewSlug = customSlug.trim() || 'launch-om';
  const liveShortUrl = `https://${resolvedHost}/${livePreviewSlug}`;

  const charsSaved = useMemo(() => {
    if (!destinationUrl.trim()) return 42;
    const destLen = destinationUrl.trim().length;
    const shortLen = liveShortUrl.length;
    return Math.max(0, destLen - shortLen);
  }, [destinationUrl, liveShortUrl]);

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
    setShowUtmBuilder(false);
    setShowAdvancedRouting(false);
    setErrorMsg('');
    setGeneratedResults([]);
    setActiveQrModalUrl(null);
    onClose();
  };

  const handleGenerateDynamicOg = () => {
    const fallbackTitle = ogTitle.trim() || title.trim() || 'Exclusive Short Link';
    const dynamicOgUrl = `/api/og?title=${encodeURIComponent(fallbackTitle)}&slug=${encodeURIComponent(resolvedHost)}&theme=purple`;
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
  const previewOgTitle = ogTitle.trim() || title.trim() || 'Launch Om — Creator Growth Kit & Masterclass';
  const previewOgDescription = ogDescription.trim() || 'Get 20+ automated conversion workflows, custom link analytics, and dedicated support.';
  const previewOgImage = resolveDisplayImageUrl(ogImageUrl) || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-on-surface/40 backdrop-blur-sm transition-all duration-200 animate-fade-in">
      <div 
        className="fixed inset-0"
        onClick={resetAndClose}
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
              <h2 className="font-bold text-lg text-on-surface tracking-tight">Create Short Link</h2>
            </div>
          </div>

          {/* Mode Switcher Pill & Close */}
          <div className="flex items-center justify-between md:justify-end gap-2">
            <div className="inline-flex bg-surface-container rounded-lg text-xs font-semibold py-0.5 px-1" id="modeSelector">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`px-3 py-1 rounded-md transition-all duration-150 cursor-pointer ${
                  mode === 'single'
                    ? 'bg-primary text-white shadow-sm font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Single Link
              </button>
              <button
                type="button"
                onClick={() => setMode('multiple')}
                className={`px-3 py-1 rounded-md transition-all duration-150 cursor-pointer ${
                  mode === 'multiple'
                    ? 'bg-primary text-white shadow-sm font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Batch Mode
              </button>
            </div>

            <button
              type="button"
              onClick={resetAndClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              title="Close Dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <form 
          onSubmit={(e) => { e.preventDefault(); executeShorten(); }}
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
                <label className="font-semibold text-xs text-on-surface flex items-center gap-1.5" htmlFor="destinationUrl">
                  <span>Destination URL</span>
                  <span className="text-red-500 font-bold">*</span>
                  <InfoTooltip text="The target web address where visitors will be routed" />
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant flex items-center gap-1" id="urlValidationStatus">
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

              {mode === 'single' ? (
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center pointer-events-none text-on-surface-variant">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <input
                    id="destinationUrl"
                    type="url"
                    required
                    value={destinationUrl}
                    onChange={(e) => setDestinationUrl(e.target.value)}
                    placeholder="https://yourbrand.com/products/summer-sale-2025"
                    className="w-full pl-10 pr-24 py-2.5 bg-surface-container-lowest text-on-surface text-xs rounded-lg shadow-sm border border-outline-variant/40 placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={generateMagicSlug}
                      title="Auto-generate AI magic slug"
                      className="px-2.5 py-1 bg-surface-container text-primary hover:bg-surface-container-high rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Auto</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <textarea
                    id="destinationUrl"
                    rows={4}
                    value={multipleUrls}
                    onChange={(e) => setMultipleUrls(e.target.value)}
                    placeholder="Paste multiple links separated by comma or new lines..."
                    className="w-full p-3 pb-8 bg-surface-container-lowest text-on-surface text-xs rounded-lg shadow-sm border border-outline-variant/40 placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono custom-scrollbar resize-y"
                  />
                  <div className="absolute right-2.5 bottom-2 flex items-center gap-2">
                    <span className="text-[11px] font-medium text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-md border border-outline-variant/30">
                      {parsedMultipleUrls.length} {parsedMultipleUrls.length === 1 ? 'URL' : 'URLs'} detected
                    </span>
                  </div>
                </div>
              )}

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
                    id="domainSelect"
                    value={selectedDomainId || primaryDomain?.id || 'dom_platform'}
                    onChange={(e) => setSelectedDomainId(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2 bg-surface-container-lowest text-on-surface font-mono text-xs rounded-lg shadow-sm border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer font-medium"
                  >
                    {availableDomains.map(d => (
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
                    id="slugInput"
                    type="text"
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
                    <label className="flex items-center gap-1.5 font-semibold text-xs text-on-surface mb-1" htmlFor="campaignSelect">
                      <span>Campaign Tag</span>
                      <InfoTooltip text="Assign this link to an active marketing campaign or sponsor" />
                    </label>
                    <div className="relative">
                      <select
                        id="campaignSelect"
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
                    <label className="flex items-center gap-1.5 font-semibold text-xs text-on-surface mb-1" htmlFor="redirectType">
                      <span>Redirection Engine</span>
                      <InfoTooltip text="Choose HTTP redirect status code: 301 permanent or 302/307 temporary" />
                    </label>
                    <div className="relative">
                      <select
                        id="redirectType"
                        value={currentRedirectionValue}
                        onChange={(e) => handleRedirectionEngineChange(e.target.value)}
                        className="w-full appearance-none pl-3 pr-8 py-2 bg-surface-container-low text-on-surface text-xs rounded-lg shadow-sm border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer font-medium"
                      >
                        <option value="301" disabled={!!password.trim()}>
                          Direct (301 Permanent - Fast) {password.trim() ? '(Disabled with Password)' : ''}
                        </option>
                        <option value="302" disabled={!!password.trim()}>
                          Temporary (302 Found) {password.trim() ? '(Disabled with Password)' : ''}
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

                {password.trim() && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    🔒 Direct redirection is disabled because a password is set. Choose Splash or Frame to prompt visitors for the password.
                  </p>
                )}
                {redirectType === 'frame' && (destinationUrl.toLowerCase().includes('google.com') || destinationUrl.toLowerCase().includes('youtube.com') || destinationUrl.toLowerCase().includes('twitter.com') || destinationUrl.toLowerCase().includes('x.com')) && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ Note: Google Docs/Drive and social sites block iframe embedding (X-Frame-Options: SAMEORIGIN) and will show a 403 error. Splash or Direct redirect is recommended for this domain.
                  </p>
                )}

                {/* Internal Search Note */}
                <div>
                  <label className="flex items-center gap-1.5 font-semibold text-xs text-on-surface mb-1" htmlFor="linkNotes">
                    <span>Internal Reference Note</span>
                    <InfoTooltip text="Internal private note for your team or organization" />
                  </label>
                  <input
                    id="linkNotes"
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
                      <label className="font-bold text-sm text-on-surface flex items-center gap-1.5" htmlFor="linkPassword">
                        <span>Passcode Gate (Optional)</span>
                        <InfoTooltip text="Require visitors to enter a secret password before redirecting" />
                      </label>
                    </div>
                    <span className="text-xs text-on-surface-variant">Only visitors with this password can redirect</span>
                  </div>
                  <input
                    id="linkPassword"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank for public access"
                    className="w-full px-3 py-2 bg-surface-container-lowest text-on-surface text-xs rounded-lg shadow-sm border border-outline-variant/40 placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {password.trim() && (
                    <p className="text-[11px] text-primary font-medium">
                      🔒 Passcode gate enabled: Visitors will be prompted to enter this passcode on a secure interstitial gate before redirecting.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Live Generated Preview Bar */}
          <div className="p-2.5 px-3.5 bg-surface-container rounded-lg flex items-center justify-between text-xs font-medium border border-outline-variant/20">
            <div className="flex items-center gap-2 min-w-0">
              <Link2 className="w-4 h-4 text-primary shrink-0" />
              <span className="text-on-surface-variant shrink-0">Ready URL:</span>
              <span className="font-mono text-primary font-bold truncate" id="liveUrlPreview">
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

          {/* Instant Generated Short URLs Results Section */}
          {generatedResults.length > 0 && (
            <div className="flex flex-col gap-2 p-3.5 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                    <Check className="w-3 h-3" />
                  </div>
                  <span className="font-bold text-xs text-on-surface">
                    {generatedResults.length === 1 
                      ? 'Instant Short URL Generated' 
                      : `${generatedResults.length} Short URLs Generated`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {generatedResults.length > 1 && (
                    <button
                      type="button"
                      onClick={handleCopyAll}
                      className="px-2.5 py-1 bg-surface-container-lowest hover:bg-surface-container text-on-surface rounded-lg text-[11px] font-semibold shadow-xs border border-outline-variant/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedAll ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedAll ? 'All Copied!' : 'Copy All Links'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setGeneratedResults([])}
                    className="text-[11px] text-on-surface-variant hover:text-red-500 font-medium transition-colors cursor-pointer"
                  >
                    Clear List
                  </button>
                </div>
              </div>

              {/* Scrollable Generated Links List */}
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {generatedResults.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left hover:border-primary/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-primary truncate">
                          {item.shortUrl}
                        </span>
                        <span className="text-[10px] text-on-surface-variant px-1.5 py-0.2 rounded bg-surface-container font-mono">
                          /{item.slug}
                        </span>
                        {item.ogTitle && (
                          <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                            <Share2 className="w-2.5 h-2.5" />
                            <span>OG Meta</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-on-surface-variant truncate block mt-0.5">
                        &rarr; {item.destinationUrl}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleCopySingle(item.shortUrl, item.id)}
                        className="px-2.5 py-1 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-md text-[11px] font-semibold border border-outline-variant/30 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600 font-bold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveQrModalUrl(activeQrModalUrl === item.shortUrl ? null : item.shortUrl)}
                        title="Show QR Code"
                        className="p-1 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-md border border-outline-variant/30 transition-colors cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>

                      <a
                        href={item.shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-md border border-outline-variant/30 transition-colors flex items-center justify-center cursor-pointer"
                        title="Test Short Link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dynamic QR Code Popup if clicked */}
              {activeQrModalUrl && (
                <div className="mt-2 p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/40 flex items-center gap-4 animate-fade-in">
                  <div className="p-1.5 bg-white rounded-md shadow-xs border border-outline-variant/30 shrink-0">
                    <QRCodeSVG
                      value={activeQrModalUrl}
                      size={64}
                      level="M"
                      fgColor="#141b2b"
                      bgColor="#ffffff"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-on-surface block">Dynamic QR Code</span>
                    <span className="text-[11px] text-on-surface-variant font-mono truncate block">{activeQrModalUrl}</span>
                    <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">High precision print-ready scan matrix</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveQrModalUrl(null)}
                    className="p-1 text-on-surface-variant hover:text-on-surface rounded-md cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

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
                onClick={resetAndClose}
                className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeShorten()}
                disabled={isSubmitting}
                className="px-5 py-2 bg-primary hover:bg-secondary active:scale-[0.99] text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>{mode === 'single' ? 'Shorten Link' : `Shorten Links (${parsedMultipleUrls.length || 0})`}</span>
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
