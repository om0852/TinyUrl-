'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';
import { Link as LinkType } from '@/lib/types';
import { 
  X, 
  Link2, 
  Globe, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  FileText, 
  EyeOff, 
  FolderKanban, 
  Share2, 
  Code2, 
  Lock, 
  ShieldCheck, 
  Sparkles, 
  Image as ImageIcon,
  MessageCircle,
  CheckCheck,
  Check,
  Save,
  Tag,
  AlertCircle,
  Activity
} from 'lucide-react';
import { normalizeUrl } from '@/lib/db';

interface EditLinkModalProps {
  isOpen: boolean;
  link: LinkType | null;
  onClose: () => void;
}

export const EditLinkModal: React.FC<EditLinkModalProps> = ({ isOpen, link, onClose }) => {
  const { updateLink, campaigns, domains, links } = useStore();
  const { showToast } = useToast();

  const [destinationUrl, setDestinationUrl] = useState('');
  const [title, setTitle] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [status, setStatus] = useState<'active' | 'disabled' | 'expired'>('active');
  const [tagsStr, setTagsStr] = useState('');

  // Social Preview Meta Tags
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [socialPreviewTab, setSocialPreviewTab] = useState<'whatsapp' | 'twitter'>('whatsapp');
  const [showMetaSettings, setShowMetaSettings] = useState(false);

  // Two-column options
  const [redirectType, setRedirectType] = useState<'direct' | 'frame' | 'splash'>('direct');
  const [password, setPassword] = useState('');
  const [clearPassword, setClearPassword] = useState(false);
  const [headerCode, setHeaderCode] = useState<301 | 302 | 307 | 308>(301);
  const [linkNotes, setLinkNotes] = useState('');
  const [shieldProtection, setShieldProtection] = useState(false);
  const [hideReferrer, setHideReferrer] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [channel, setChannel] = useState('None');

  // Advanced section
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmTerm, setUtmTerm] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxClicks, setMaxClicks] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate state whenever a link is selected or modal opens
  useEffect(() => {
    if (link && isOpen) {
      setDestinationUrl(link.destination_url || '');
      setTitle(link.title || '');
      setCustomSlug(link.custom_slug || link.short_code || '');
      setSelectedDomainId(link.domain_id || 'dom_platform');
      setStatus((link.status === 'flagged' ? 'active' : link.status) as 'active' | 'disabled' | 'expired' || 'active');
      setTagsStr(Array.isArray(link.tags) ? link.tags.join(', ') : '');

      setOgTitle(link.og_title || '');
      setOgDescription(link.og_description || '');
      setOgImageUrl(link.og_image_url || '');
      setShowMetaSettings(Boolean(link.og_title || link.og_description || link.og_image_url));

      setRedirectType(link.redirect_type || 'direct');
      setHeaderCode((link.http_status_code as 301 | 302 | 307 | 308) || 301);
      setPassword('');
      setClearPassword(false);
      setLinkNotes(link.notes || '');
      setShieldProtection(Boolean(link.shield_protection));
      setHideReferrer(Boolean(link.hide_referrer));
      setSelectedCampaignId(link.campaign_id || '');
      setChannel(link.channel || 'None');

      setUtmSource(link.utm_source || '');
      setUtmMedium(link.utm_medium || '');
      setUtmCampaign(link.utm_campaign || '');
      setUtmTerm(link.utm_term || '');
      setUtmContent(link.utm_content || '');
      setExpiresAt(link.expires_at ? link.expires_at.slice(0, 16) : '');
      setMaxClicks(link.max_clicks ? String(link.max_clicks) : '');

      setShowAdvanced(Boolean(link.utm_source || link.utm_medium || link.utm_campaign || link.expires_at || link.max_clicks));
      setErrorMsg('');
    }
  }, [link, isOpen]);

  // Selected domain host
  const selectedDomainObj = useMemo(() => {
    return domains.find(d => d.id === selectedDomainId) || domains[0];
  }, [domains, selectedDomainId]);

  const resolvedHost = useMemo(() => {
    if (selectedDomainObj && selectedDomainObj.hostname) {
      return selectedDomainObj.hostname;
    }
    if (typeof window !== 'undefined') {
      return window.location.host;
    }
    return 'tinyurl.dev';
  }, [selectedDomainObj]);

  const previewOgTitle = ogTitle || title || 'Explore Exclusive Link Content';
  const previewOgDescription = ogDescription || (destinationUrl ? `Direct access to ${destinationUrl}` : 'Click to discover rich content and personalized recommendations.');
  const previewOgImage = ogImageUrl;

  const handleGenerateDynamicOg = () => {
    const safeTitle = encodeURIComponent(previewOgTitle.slice(0, 60));
    setOgImageUrl(`https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=630&fit=crop&q=80#${safeTitle}`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link) return;
    setErrorMsg('');

    // Validation
    const cleanDest = destinationUrl.trim();
    if (!cleanDest) {
      setErrorMsg('Destination URL is required.');
      return;
    }
    if (!/^https?:\/\//i.test(cleanDest)) {
      setErrorMsg('Destination URL must begin with http:// or https://');
      return;
    }

    const cleanSlug = customSlug.trim();
    if (!cleanSlug) {
      setErrorMsg('Custom slug is required.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]{2,64}$/.test(cleanSlug)) {
      setErrorMsg('Custom slug must be 2-64 characters and contain only letters, numbers, hyphens, and underscores.');
      return;
    }

    // Check for collision with another link
    const collision = links.find(l => 
      l.id !== link.id && 
      (l.short_code?.toLowerCase() === cleanSlug.toLowerCase() || (l.custom_slug && l.custom_slug.toLowerCase() === cleanSlug.toLowerCase()))
    );
    if (collision) {
      setErrorMsg(`Slug "${cleanSlug}" is already in use by another link. Please choose a different slug.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedTags = tagsStr
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);

      const updates: Partial<LinkType> = {
        title: title.trim() || `Short Link /${cleanSlug}`,
        destination_url: cleanDest,
        custom_slug: cleanSlug,
        short_code: cleanSlug,
        domain_id: selectedDomainId || link.domain_id || 'dom_platform',
        status,
        tags: parsedTags,
        campaign_id: selectedCampaignId || undefined,
        redirect_type: redirectType,
        http_status_code: headerCode,
        notes: linkNotes.trim() || undefined,
        shield_protection: shieldProtection,
        hide_referrer: hideReferrer,
        channel: channel === 'None' ? undefined : channel,
        og_title: ogTitle.trim() || undefined,
        og_description: ogDescription.trim() || undefined,
        og_image_url: ogImageUrl.trim() || undefined,
        utm_source: utmSource.trim() || undefined,
        utm_medium: utmMedium.trim() || undefined,
        utm_campaign: utmCampaign.trim() || undefined,
        utm_term: utmTerm.trim() || undefined,
        utm_content: utmContent.trim() || undefined,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        max_clicks: maxClicks && Number(maxClicks) > 0 ? Number(maxClicks) : undefined
      };

      if (clearPassword) {
        updates.password_hash = undefined;
      } else if (password.trim()) {
        updates.password_hash = password.trim();
      }

      updateLink(link.id, updates);

      showToast(
        'success',
        'Link Updated',
        `Link "/${cleanSlug}" has been successfully updated.`
      );

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update link';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !link) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="relative w-full max-w-3xl bg-surface rounded-2xl shadow-2xl border border-outline-variant/40 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-on-surface">Edit Short Link</h3>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-mono font-semibold">
                  /{link.custom_slug || link.short_code}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Modify destination, slug, social media card preview and security rules
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-4 flex flex-col gap-4 text-xs overflow-y-auto custom-scrollbar flex-1">
            
            {errorMsg && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2 font-medium text-xs border border-red-200 dark:border-red-900/40">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Destination URL */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                <span>Destination URL</span>
                <span className="text-primary font-bold">*</span>
              </label>
              <input
                type="url"
                required
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="https://example.com/target-landing-page"
                className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono"
              />
            </div>

            {/* Title & Custom Slug Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface text-xs">Link Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q4 Growth Promo"
                  className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface text-xs flex items-center gap-1">
                  <span>Custom Slug</span>
                  <span className="text-primary font-bold">*</span>
                </label>
                <div className="flex items-center">
                  <span className="px-2.5 py-2 bg-surface-container-low border border-r-0 border-outline-variant/60 rounded-l-xl text-on-surface-variant font-mono text-[11px]">
                    {resolvedHost}/
                  </span>
                  <input
                    type="text"
                    required
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="custom-slug"
                    className="w-full px-3 py-2 bg-surface-container-lowest rounded-r-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Tags & Status Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-primary" />
                  <span>Tags (comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  placeholder="marketing, promo, sponsor"
                  className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  <span>Link Status</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'disabled' | 'expired')}
                  className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="active">Active (Serving Clicks &amp; Redirects)</option>
                  <option value="disabled">Disabled (Temporarily Inactive)</option>
                  <option value="expired">Expired (Block Redirection)</option>
                </select>
              </div>
            </div>

            {/* ─── Social Media Meta Tags & WhatsApp Card ─── */}
            <div className="p-3.5 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-2xl border border-primary/20 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <Share2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-on-surface block">Social Media Meta Tags &amp; WhatsApp Card</span>
                    <span className="text-[10px] text-on-surface-variant">Control thumbnail, title, and description displayed when shared on WhatsApp, Twitter, FB</span>
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

              {showMetaSettings && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-primary/15 animate-fade-in">
                  
                  {/* Left: Meta Inputs */}
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
                        placeholder="e.g. Exclusive Launch Deal"
                        className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-on-surface text-[11px]">Meta Description (og:description)</label>
                      <textarea
                        rows={2}
                        value={ogDescription}
                        onChange={(e) => setOgDescription(e.target.value)}
                        placeholder="e.g. Click to claim your exclusive discount."
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

                  {/* Right: Social Share Preview */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-on-surface">Live Social Preview</span>
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

            {/* ─── Two-Column Options Grid ─── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              {/* Left Column */}
              <div className="flex flex-col gap-3.5">
                
                {/* Domain Selector */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Domain</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedDomainId}
                      onChange={(e) => setSelectedDomainId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium cursor-pointer appearance-none pr-8"
                    >
                      {domains.map(d => (
                        <option key={d.id} value={d.id}>
                          https://{d.hostname} {d.is_default || d.id === 'dom_platform' ? '(Primary)' : (d.verified ? '' : '(Pending DNS)')}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Password Protection */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-purple-600" />
                      <span>Password Protection</span>
                    </label>
                    {link.password_hash && (
                      <span className="text-[10px] text-amber-600 font-semibold">Currently Protected</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (e.target.value) setClearPassword(false);
                    }}
                    placeholder={link.password_hash ? 'Type new password to change' : 'Set password to restrict access'}
                    className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {link.password_hash && (
                    <label className="flex items-center gap-1.5 text-[11px] text-on-surface-variant mt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clearPassword}
                        onChange={(e) => {
                          setClearPassword(e.target.checked);
                          if (e.target.checked) setPassword('');
                        }}
                        className="rounded text-primary focus:ring-primary"
                      />
                      <span>Remove password protection from this link</span>
                    </label>
                  )}
                </div>

                {/* Header Codes */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-teal-600" />
                    <span>Header Codes</span>
                  </label>
                  <div className="relative">
                    <select
                      value={headerCode}
                      onChange={(e) => setHeaderCode(Number(e.target.value) as 301 | 302 | 307 | 308)}
                      className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono cursor-pointer appearance-none pr-8"
                    >
                      <option value={301}>301 - Permanent Redirect (Recommended)</option>
                      <option value={302}>302 - Temporary Redirect (Found)</option>
                      <option value={307}>307 - Temporary Redirect (Preserves Method)</option>
                      <option value={308}>308 - Permanent Redirect (Preserves Method)</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Shield Protection */}
                <div className="flex items-center justify-between gap-3 p-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/30">
                  <div className="flex flex-col gap-0.5">
                    <div className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Shield Protection</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-tight">
                      Block crawlers &amp; bots from destination.
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

              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-3.5">
                
                {/* Redirect Type */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
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

                {/* Campaign Selector */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                    <FolderKanban className="w-3.5 h-3.5 text-amber-600" />
                    <span>Campaign</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCampaignId}
                      onChange={(e) => setSelectedCampaignId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer appearance-none pr-8"
                    >
                      <option value="">None (Unassigned)</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.description || 'Campaign'})</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Channel Selector */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-primary" />
                    <span>Channel</span>
                  </label>
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

                {/* Hide Referrer */}
                <div className="flex items-center justify-between gap-3 p-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/30">
                  <div className="flex flex-col gap-0.5">
                    <div className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                      <EyeOff className="w-3.5 h-3.5 text-purple-600" />
                      <span>Hide Referrer</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-tight">
                      Strip referrer header on destination redirect.
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

              </div>

            </div>

            {/* Link Notes */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-on-surface text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Link Notes &amp; Comments</span>
              </label>
              <input
                type="text"
                value={linkNotes}
                onChange={(e) => setLinkNotes(e.target.value)}
                placeholder="Optional internal notes to remember this link's purpose"
                className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* ─── Advanced Accordion (UTM & Limits) ─── */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full py-2.5 px-3 bg-primary/10 hover:bg-primary/15 text-primary rounded-xl font-bold text-xs flex items-center justify-between transition-colors cursor-pointer border border-primary/20"
            >
              <div className="flex items-center gap-2">
                <span>Advanced UTM Parameters &amp; Click Limits</span>
              </div>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/30 flex flex-col gap-3 animate-fade-in">
                
                {/* UTM Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-on-surface text-[11px]">utm_source</label>
                    <input
                      type="text"
                      value={utmSource}
                      onChange={(e) => setUtmSource(e.target.value)}
                      placeholder="google, newsletter, twitter"
                      className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-on-surface text-[11px]">utm_medium</label>
                    <input
                      type="text"
                      value={utmMedium}
                      onChange={(e) => setUtmMedium(e.target.value)}
                      placeholder="cpc, banner, email"
                      className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-on-surface text-[11px]">utm_campaign</label>
                    <input
                      type="text"
                      value={utmCampaign}
                      onChange={(e) => setUtmCampaign(e.target.value)}
                      placeholder="spring_sale"
                      className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-on-surface text-[11px]">utm_term</label>
                    <input
                      type="text"
                      value={utmTerm}
                      onChange={(e) => setUtmTerm(e.target.value)}
                      placeholder="paid keywords"
                      className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-on-surface text-[11px]">utm_content</label>
                    <input
                      type="text"
                      value={utmContent}
                      onChange={(e) => setUtmContent(e.target.value)}
                      placeholder="hero_cta vs footer_cta"
                      className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                {/* Expiration & Max Clicks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-outline-variant/30">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-on-surface text-[11px]">Expiration Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-on-surface text-[11px]">Max Clicks Limit</label>
                    <input
                      type="number"
                      min={0}
                      value={maxClicks}
                      onChange={(e) => setMaxClicks(e.target.value)}
                      placeholder="Unlimited if empty"
                      className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Modal Footer */}
          <div className="px-5 py-3.5 bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Saving Changes...</span>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
