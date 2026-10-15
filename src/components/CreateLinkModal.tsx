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
  Globe, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  FileText, 
  EyeOff, 
  FolderKanban, 
  Share2, 
  Code2, 
  QrCode, 
  Sparkles, 
  Image as ImageIcon,
  MessageCircle,
  CheckCheck
} from 'lucide-react';
import { detectAppDeepLink } from '@/lib/deepLink';
import { generateId, generateBase62Code } from '@/lib/db';

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

  const primaryDomain = domains.find(d => d.is_default && d.verified) || domains.find(d => d.verified) || domains[0];

  // Mode: Single vs Multiple
  const [mode, setMode] = useState<'single' | 'multiple'>('single');

  // Input URLs
  const [destinationUrl, setDestinationUrl] = useState('');
  const [multipleUrls, setMultipleUrls] = useState('');
  const [title, setTitle] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState(primaryDomain?.id || 'dom_platform');

  // Open Graph & Social Media Preview Meta Tags
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [socialPreviewTab, setSocialPreviewTab] = useState<'whatsapp' | 'twitter'>('whatsapp');
  const [showMetaSettings, setShowMetaSettings] = useState(false);

  // Two-column options matching screenshot
  const [redirectType, setRedirectType] = useState<'direct' | 'frame' | 'splash'>('direct');
  const [password, setPassword] = useState('');
  const [headerCode, setHeaderCode] = useState<301 | 302 | 307 | 308>(301);
  const [linkNotes, setLinkNotes] = useState('');
  const [shieldProtection, setShieldProtection] = useState(false);
  const [hideReferrer, setHideReferrer] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [channel, setChannel] = useState('None');

  // Advanced accordion state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [placementTag, setPlacementTag] = useState<'youtube' | 'drive' | 'instagram' | 'tiktok' | 'x' | 'podcast' | 'direct'>('direct');
  const [utmSource, setUtmSource] = useState('direct');
  const [utmMedium, setUtmMedium] = useState('web');
  const [utmCampaign, setUtmCampaign] = useState('summer_launch');
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

  const originDomain = typeof window !== 'undefined' ? window.location.host : 'tinyurl.dev';
  const detectedApp = destinationUrl ? detectAppDeepLink(destinationUrl) : null;
  const currentDomain = domains.find(d => d.id === selectedDomainId) || primaryDomain;
  const resolvedHost = currentDomain?.hostname || (typeof window !== 'undefined' ? window.location.host : originDomain);

  // Slug availability check
  const isSlugTaken = customSlug.trim() 
    ? links.some(l => (l.custom_slug || l.short_code).toLowerCase() === customSlug.trim().toLowerCase())
    : false;

  const handleRandomizeSlug = () => {
    const code = generateBase62Code(6);
    setCustomSlug(code);
  };

  const handleCopySingle = (shortUrl: string, id: string) => {
    navigator.clipboard.writeText(shortUrl).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    if (generatedResults.length === 0) return;
    const allLinks = generatedResults.map(r => r.shortUrl).join('\n');
    navigator.clipboard.writeText(allLinks).catch(() => {});
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
    setShowMetaSettings(false);
    setPassword('');
    setLinkNotes('');
    setShieldProtection(false);
    setHideReferrer(false);
    setSelectedCampaignId('');
    setChannel('None');
    setIosTargetUrl('');
    setAndroidTargetUrl('');
    setShowAdvanced(false);
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
        const tags = [placementTag === 'drive' ? 'google_drive' : placementTag];
        if (channel && channel !== 'None') tags.push(channel.toLowerCase().replace(/[^a-z0-9]/g, '_'));

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
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
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
        if (channel && channel !== 'None') tags.push(channel.toLowerCase().replace(/[^a-z0-9]/g, '_'));

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

  // Preview computed values
  const previewOgTitle = ogTitle.trim() || title.trim() || 'Exclusive Short Link Preview';
  const previewOgDescription = ogDescription.trim() || 'Click to view the verified destination link. Fast, safe and secure routing.';
  const previewOgImage = ogImageUrl.trim() || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs transition-all duration-200 animate-fade-in">
      <div 
        className="fixed inset-0"
        onClick={resetAndClose}
      />

      <div className="relative bg-surface-container-lowest rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-outline-variant/40 z-10 text-on-surface">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-outline-variant/30 shrink-0 bg-surface-container-low/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shadow-xs shrink-0 font-bold">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">Create Short Links</h2>
              <p className="text-[11px] text-on-surface-variant">Single &amp; multi-link batch generator with social meta previews</p>
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

        {/* Modal Scrollable Body */}
        <div className="px-5 py-4 flex flex-col gap-4 text-xs overflow-y-auto custom-scrollbar flex-1">
          
          {errorMsg && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2 font-medium text-xs border border-red-200 dark:border-red-900/40">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ─── Top Section: URL Input / Textarea & Shorten Action ─── */}
          <div className="flex flex-col gap-2">
            
            {/* Top Bar with Mode Switcher Pills */}
            <div className="flex items-center justify-between">
              <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                <span>{mode === 'single' ? 'Destination URL' : 'Multiple Destination URLs (One per line)'}</span>
                <span className="text-primary font-bold">*</span>
              </label>

              {/* Single / Multiple Pills matching theme */}
              <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant/40">
                <button
                  type="button"
                  onClick={() => setMode('single')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    mode === 'single'
                      ? 'bg-primary text-white shadow-xs font-bold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Single</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('multiple')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    mode === 'multiple'
                      ? 'bg-primary text-white shadow-xs font-bold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Multiple</span>
                </button>
              </div>
            </div>

            {/* Input Element based on Mode */}
            {mode === 'single' ? (
              <div className="flex flex-col gap-2">
                <div className="relative flex items-center">
                  <input
                    type="url"
                    value={destinationUrl}
                    onChange={(e) => setDestinationUrl(e.target.value)}
                    placeholder="https://example.com/your-destination-page"
                    className="w-full pl-3 pr-28 py-2.5 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono"
                  />
                  <div className="absolute right-1.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleRandomizeSlug}
                      title="Generate random custom slug"
                      className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => executeShorten()}
                      disabled={isSubmitting}
                      className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Shorten</span>
                      )}
                    </button>
                  </div>
                </div>

                {detectedApp && (
                  <div className="flex items-center gap-1.5 p-1.5 bg-surface-container-low rounded-lg text-[11px] font-medium text-on-surface">
                    <Smartphone className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>OpeninApp: Direct native launch enabled for <strong>{detectedApp.appName}</strong></span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <textarea
                    rows={4}
                    value={multipleUrls}
                    onChange={(e) => setMultipleUrls(e.target.value)}
                    placeholder={`https://example.com/page-1\nhttps://example.com/page-2\nhttps://example.com/page-3`}
                    className="w-full p-3 pb-12 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono custom-scrollbar resize-y"
                  />
                  <div className="absolute right-2.5 bottom-2.5 flex items-center gap-2">
                    <span className="text-[11px] font-medium text-on-surface-variant bg-surface-container-low px-2 py-1 rounded-md">
                      {parsedMultipleUrls.length} {parsedMultipleUrls.length === 1 ? 'URL' : 'URLs'} detected
                    </span>
                    <button
                      type="button"
                      onClick={() => executeShorten()}
                      disabled={isSubmitting || parsedMultipleUrls.length === 0}
                      className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Shorten ({parsedMultipleUrls.length || 0})</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── Instant Generated Short URLs Results Section ─── */}
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
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {generatedResults.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-surface-container-lowest rounded-lg border border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left hover:border-primary/40 transition-colors"
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
                            <span>OG Meta Active</span>
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
                    <span className="text-[11px] font-bold text-on-surface block">Dynamic QR Code</span>
                    <span className="text-[10px] text-on-surface-variant font-mono truncate block">{activeQrModalUrl}</span>
                    <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">High precision print-ready scan matrix</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveQrModalUrl(null)}
                    className="p-1 text-on-surface-variant hover:text-on-surface rounded-md"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─── Social Media Meta Tags & WhatsApp/Twitter Live Preview (Requested Feature) ─── */}
          <div className="p-3.5 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-2xl border border-primary/20 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Share2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-xs text-on-surface block">Social Media Meta Tags &amp; WhatsApp Card</span>
                  <span className="text-[10px] text-on-surface-variant">Customize title, description, and thumbnail shown on WhatsApp, Twitter/X, Facebook &amp; LinkedIn</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowMetaSettings(!showMetaSettings)}
                className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high text-primary font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>{showMetaSettings ? 'Hide Settings' : 'Customize Preview'}</span>
                {showMetaSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Meta Tags Inputs (Toggled or inline) */}
            {showMetaSettings && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-primary/15 animate-fade-in">
                
                {/* Left: Input Fields */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-on-surface text-[11px]">Meta Title (og:title)</label>
                      {title && !ogTitle && (
                        <button
                          type="button"
                          onClick={() => setOgTitle(title)}
                          className="text-[10px] text-primary hover:underline font-semibold"
                        >
                          Use Link Title
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={ogTitle}
                      onChange={(e) => setOgTitle(e.target.value)}
                      placeholder="e.g. 50% Off Launch Deal - Exclusive Access"
                      className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-on-surface text-[11px]">Meta Description (og:description)</label>
                    <textarea
                      rows={2}
                      value={ogDescription}
                      onChange={(e) => setOgDescription(e.target.value)}
                      placeholder="e.g. Discover our top collection and redeem special discounts today."
                      className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-on-surface text-[11px] flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-primary" />
                        <span>Thumbnail Image URL (og:image)</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateDynamicOg}
                        className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-0.5"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Auto-Generate Card</span>
                      </button>
                    </div>
                    <input
                      type="url"
                      value={ogImageUrl}
                      onChange={(e) => setOgImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/... or /api/og?title=..."
                      className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono text-[11px]"
                    />
                  </div>
                </div>

                {/* Right: Live Interactive Card Preview */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-on-surface">Live Social Share Preview</span>
                    <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded-lg border border-outline-variant/30">
                      <button
                        type="button"
                        onClick={() => setSocialPreviewTab('whatsapp')}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-all ${
                          socialPreviewTab === 'whatsapp'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <MessageCircle className="w-2.5 h-2.5" />
                        <span>WhatsApp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSocialPreviewTab('twitter')}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-all ${
                          socialPreviewTab === 'twitter'
                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-xs'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <span>X / Facebook</span>
                      </button>
                    </div>
                  </div>

                  {socialPreviewTab === 'whatsapp' ? (
                    /* WhatsApp Chat Bubble Mockup */
                    <div className="bg-[#e7fedb] dark:bg-[#005c4b]/30 p-2.5 rounded-xl border border-emerald-500/20 shadow-xs flex flex-col gap-1.5 text-left">
                      {previewOgImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewOgImage}
                          alt="Thumbnail preview"
                          className="w-full h-28 object-cover rounded-lg border border-emerald-500/20"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-20 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-300 gap-1.5 text-[11px] font-medium">
                          <ImageIcon className="w-4 h-4 opacity-60" />
                          <span>Thumbnail Image Preview</span>
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-xs text-gray-900 dark:text-gray-100 line-clamp-1 block">
                          {previewOgTitle}
                        </span>
                        <p className="text-[10px] text-gray-600 dark:text-gray-300 line-clamp-2 mt-0.5 leading-snug">
                          {previewOgDescription}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-emerald-800 dark:text-emerald-400 font-mono pt-1 border-t border-emerald-600/15">
                        <span className="truncate">https://{resolvedHost}/{customSlug || 'link'}</span>
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      </div>
                    </div>
                  ) : (
                    /* Twitter / Facebook Large Summary Card Mockup */
                    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 overflow-hidden shadow-xs text-left">
                      {previewOgImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewOgImage}
                          alt="Twitter card thumbnail"
                          className="w-full h-28 object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-24 bg-primary/10 flex items-center justify-center text-primary gap-1.5 text-[11px] font-medium">
                          <ImageIcon className="w-4 h-4 opacity-60" />
                          <span>Twitter 16:9 Large Image Preview</span>
                        </div>
                      )}
                      <div className="p-2.5 flex flex-col gap-0.5">
                        <span className="text-[10px] text-on-surface-variant font-mono uppercase">
                          {resolvedHost}
                        </span>
                        <span className="font-bold text-xs text-on-surface line-clamp-1">
                          {previewOgTitle}
                        </span>
                        <p className="text-[10px] text-on-surface-variant line-clamp-2 leading-snug">
                          {previewOgDescription}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* ─── Two-Column Options Grid (Matching Screenshot Layout) ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            
            {/* ═══ Left Column ═══ */}
            <div className="flex flex-col gap-3.5">
              
              {/* 1. Domain */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <Globe className="w-3 h-3" />
                  </div>
                  <span>Domain</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedDomainId || primaryDomain?.id || 'dom_platform'}
                    onChange={(e) => setSelectedDomainId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium cursor-pointer appearance-none pr-8"
                  >
                    {domains.map(d => (
                      <option key={d.id} value={d.id} disabled={!d.verified}>
                        https://{d.hostname} {d.is_default || d.id === 'dom_platform' ? '(Primary)' : (d.verified ? '' : '(Pending DNS)')}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant absolute right-3 top-3 pointer-events-none" />
                </div>

                {/* Real-time Domain SSL Health Status (Single line, small text, without box) */}
                {domainProbeStatus && (
                  <div className="px-0.5 pt-0.5">
                    {domainProbeStatus.checking ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-medium animate-pulse truncate">
                        <RefreshCw className="w-3 h-3 animate-spin text-primary shrink-0" />
                        <span className="truncate">Verifying Edge SSL for {domainProbeStatus.domain}...</span>
                      </div>
                    ) : domainProbeStatus.ssl_active ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">
                          <strong>SSL Active:</strong> Links created under {domainProbeStatus.domain} will load securely.
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span className="truncate">{domainProbeStatus.message || 'SSL certificate is still generating.'}</span>
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

              {/* 2. Password Protection */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center">
                    <Lock className="w-3 h-3" />
                  </div>
                  <span>Password Protection</span>
                </label>
                <p className="text-[11px] text-on-surface-variant">
                  By adding a password, you can restrict the access.
                </p>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Type your password here"
                  className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* 3. Header Codes (100% Free Plan, No Pro Tag) */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center">
                    <Code2 className="w-3 h-3" />
                  </div>
                  <span>Header Codes</span>
                </label>
                <p className="text-[11px] text-on-surface-variant">
                  You can define custom header codes here.
                </p>
                <div className="relative">
                  <select
                    value={headerCode}
                    onChange={(e) => setHeaderCode(Number(e.target.value) as 301 | 302 | 307 | 308)}
                    className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono cursor-pointer appearance-none pr-8"
                  >
                    <option value={301}>301 - Permanent Redirect (Recommended for SEO)</option>
                    <option value={302}>302 - Temporary Redirect (Found)</option>
                    <option value={307}>307 - Temporary Redirect (Preserves Method)</option>
                    <option value={308}>308 - Permanent Redirect (Preserves Method)</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* 4. Shield Protection (100% Free Plan, No Starter Tag) */}
              <div className="flex items-center justify-between gap-3 p-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/30">
                <div className="flex flex-col gap-0.5">
                  <div className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <ShieldCheck className="w-3 h-3" />
                    </div>
                    <span>Shield Protection</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-tight">
                    Block bots, crawlers and suspicious traffic. Filtered visitors get a neutral page instead of your destination, helping reduce shadowban risk on strict platforms.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={shieldProtection}
                  onClick={() => setShieldProtection(!shieldProtection)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 shrink-0 ${
                    shieldProtection ? 'bg-emerald-500' : 'bg-surface-container-highest border border-outline-variant/40'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      shieldProtection ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 5. Campaign (100% Free Plan, No Pro Tag) */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <FolderKanban className="w-3 h-3" />
                  </div>
                  <span>Campaign</span>
                </label>
                <p className="text-[11px] text-on-surface-variant">
                  Assign link to a campaign.
                </p>
                <div className="relative">
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
                    className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer appearance-none pr-8"
                  >
                    <option value="">None</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.description || 'Campaign'})</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

            </div>

            {/* ═══ Right Column ═══ */}
            <div className="flex flex-col gap-3.5">
              
              {/* 1. Redirect Type */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <Layers className="w-3 h-3" />
                  </div>
                  <span>Redirect Type</span>
                </label>
                <div className="relative">
                  <select
                    value={redirectType}
                    onChange={(e) => setRedirectType(e.target.value as 'direct' | 'frame' | 'splash')}
                    className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium cursor-pointer appearance-none pr-8"
                  >
                    <option value="direct">Direct (Standard Redirection)</option>
                    <option value="frame">Frame / Masked (Keep domain in address bar)</option>
                    <option value="splash">Splash / Interstitial Page</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* 2. Link Notes */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-slate-500/10 text-slate-500 flex items-center justify-center">
                    <FileText className="w-3 h-3" />
                  </div>
                  <span>Link Notes</span>
                </label>
                <p className="text-[11px] text-on-surface-variant">
                  This can be used to identify URLs on your account.
                </p>
                <input
                  type="text"
                  value={linkNotes}
                  onChange={(e) => setLinkNotes(e.target.value)}
                  placeholder="Type your description here"
                  className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* 3. Hide Referrer (100% Free Plan, No Starter Tag) */}
              <div className="flex items-center justify-between gap-3 p-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/30">
                <div className="flex flex-col gap-0.5">
                  <div className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center">
                      <EyeOff className="w-3 h-3" />
                    </div>
                    <span>Hide Referrer</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-tight">
                    Enable this option to hide the referrer.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={hideReferrer}
                  onClick={() => setHideReferrer(!hideReferrer)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 shrink-0 ${
                    hideReferrer ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/40'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      hideReferrer ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 4. Channel */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Share2 className="w-3 h-3" />
                  </div>
                  <span>Channel</span>
                </label>
                <p className="text-[11px] text-on-surface-variant">
                  Assign link to a channel.
                </p>
                <div className="relative">
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer appearance-none pr-8"
                  >
                    <option value="None">None</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Email">Email</option>
                    <option value="YouTube">YouTube</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Instagram">Instagram</option>
                    <option value="X / Twitter">X / Twitter</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Paid Ads">Paid Ads</option>
                    <option value="Podcast">Podcast</option>
                    <option value="Affiliate / Influencer">Affiliate / Influencer</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

            </div>

          </div>

          {/* ─── Bottom Purple "Advanced" Button matching Theme ─── */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full py-2.5 rounded-xl text-white font-bold bg-primary hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer text-xs"
          >
            <span>Advanced Settings</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* ─── Advanced Accordion Content ─── */}
          {showAdvanced && (
            <div className="flex flex-col gap-3.5 p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/30 animate-fade-in">
              
              {/* Custom Back-half Slug (Single Mode) */}
              {mode === 'single' && (
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface text-xs flex items-center justify-between">
                    <span>Custom Back-Half Slug</span>
                    {customSlug.trim() && (
                      <span className={`text-[11px] font-semibold flex items-center gap-1 ${isSlugTaken ? 'text-red-500' : 'text-emerald-600'}`}>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{isSlugTaken ? 'Slug taken' : 'Available'}</span>
                      </span>
                    )}
                  </label>
                  <div className="flex items-center rounded-xl bg-surface-container-lowest px-3 py-1.5 border border-outline-variant/60">
                    <span className="text-on-surface-variant font-mono text-xs select-none pr-1">/</span>
                    <input
                      type="text"
                      value={customSlug}
                      onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                      placeholder="custom-alias"
                      className="flex-1 bg-transparent font-mono text-xs text-primary font-bold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleRandomizeSlug}
                      className="text-[11px] text-on-surface-variant hover:text-primary font-medium"
                    >
                      Randomize
                    </button>
                  </div>
                </div>
              )}

              {/* Smart Device Routing */}
              <div className="flex flex-col gap-2">
                <span className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-primary" />
                  <span>Smart Device Targeting (iOS &amp; Android Deep Routing)</span>
                </span>
                <p className="text-[11px] text-on-surface-variant">
                  Optionally route mobile visitors to app-specific destinations while web visitors use default.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-[11px] text-on-surface block mb-0.5">🍎 iOS Destination</label>
                    <input
                      type="url"
                      value={iosTargetUrl}
                      onChange={(e) => setIosTargetUrl(e.target.value)}
                      placeholder="https://apps.apple.com/app/..."
                      className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/60 font-mono text-[11px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[11px] text-on-surface block mb-0.5">🤖 Android Destination</label>
                    <input
                      type="url"
                      value={androidTargetUrl}
                      onChange={(e) => setAndroidTargetUrl(e.target.value)}
                      placeholder="https://play.google.com/store/apps/..."
                      className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/60 font-mono text-[11px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Automatic UTM Parameters */}
              <div className="flex flex-col gap-2 pt-1 border-t border-outline-variant/20">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-primary" />
                    <span>Automatic UTM Parameters</span>
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">Free Included</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] font-medium text-on-surface-variant uppercase">Source</span>
                    <input
                      type="text"
                      value={utmSource}
                      onChange={(e) => setUtmSource(e.target.value)}
                      className="w-full font-mono text-[11px] px-2 py-1 bg-surface-container-lowest rounded-md text-on-surface border border-outline-variant/60 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-on-surface-variant uppercase">Medium</span>
                    <input
                      type="text"
                      value={utmMedium}
                      onChange={(e) => setUtmMedium(e.target.value)}
                      className="w-full font-mono text-[11px] px-2 py-1 bg-surface-container-lowest rounded-md text-on-surface border border-outline-variant/60 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-on-surface-variant uppercase">Campaign</span>
                    <input
                      type="text"
                      value={utmCampaign}
                      onChange={(e) => setUtmCampaign(e.target.value)}
                      className="w-full font-mono text-[11px] px-2 py-1 bg-surface-container-lowest rounded-md text-on-surface border border-outline-variant/60 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Expiration and Limits */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1 border-t border-outline-variant/20">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={neverExpires}
                      onChange={(e) => setNeverExpires(e.target.checked)}
                      className="rounded accent-primary w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-on-surface">Never expires</span>
                  </label>
                  {!neverExpires && (
                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="px-2 py-1 bg-surface-container-lowest rounded-md border border-outline-variant/60 text-[11px] text-on-surface"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-on-surface-variant">Max Clicks Limit:</span>
                  <input
                    type="number"
                    min="1"
                    value={maxClicks}
                    onChange={(e) => setMaxClicks(e.target.value)}
                    placeholder="Unlimited"
                    className="w-24 px-2 py-1 bg-surface-container-lowest rounded-md border border-outline-variant/60 text-[11px] text-on-surface font-mono"
                  />
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Actions Footer */}
        <div className="px-5 py-3 flex items-center justify-between border-t border-outline-variant/30 shrink-0 bg-surface-container-low/40">
          <span className="text-[11px] text-on-surface-variant">
            {generatedResults.length > 0 
              ? `${generatedResults.length} short URL(s) created in this session`
              : 'All options free & unlocked on your workspace'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => executeShorten()}
              disabled={isSubmitting}
              className="px-5 py-1.5 rounded-xl text-xs bg-primary hover:bg-primary/90 text-white transition-all shadow-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Shorten URL</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
