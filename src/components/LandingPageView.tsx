'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/storeContext';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Link2, 
  Wand2, 
  Copy, 
  Check, 
  QrCode, 
  Edit3, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  BarChart3, 
  Globe2, 
  Smartphone, 
  Download, 
  X, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck,
  TrendingUp,
  LayoutDashboard,
  ExternalLink
} from 'lucide-react';

interface LandingPageViewProps {
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onGoToDashboard?: () => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenAuth,
  onGoToDashboard,
}) => {
  const { currentUser, createShortLink, updateLink, links } = useStore();

  // Shortener form state
  const [urlInput, setUrlInput] = useState(
    'https://amazon.com/dp/B09XYZ123?tag=creatorhub-20&ref=creator_hub_sp'
  );
  const [currentLink, setCurrentLink] = useState<{
    id?: string;
    slug: string;
    fullUrl: string;
    originalUrl: string;
  } | null>({
    slug: 'creator-gear',
    fullUrl: 'snip.to/creator-gear',
    originalUrl: 'https://amazon.com/dp/B09XYZ123?tag=creatorhub-20&ref=creator_hub_sp',
  });
  const [isShortening, setIsShortening] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [aliasDrawerOpen, setAliasDrawerOpen] = useState(false);
  const [aliasInput, setAliasInput] = useState('creator-gear');

  // QR Modal State
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Origin domain computation
  const originDomain = typeof window !== 'undefined' ? window.location.host : 'snip.to';

  const handleShorten = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsShortening(true);

    try {
      // Call actual platform link creation
      const res = createShortLink({
        destination_url: urlInput.trim(),
        title: 'Quick Short Link',
      });

      if (res.link) {
        const created = res.link;
        const slug = created.custom_slug || created.short_code;
        const fullUrl = typeof window !== 'undefined' 
          ? `${window.location.origin}/${slug}`
          : `${originDomain}/${slug}`;

        setCurrentLink({
          id: created.id,
          slug,
          fullUrl,
          originalUrl: urlInput.trim(),
        });
        setAliasInput(slug);
      } else {
        throw new Error(res.error || 'Failed to shorten');
      }
    } catch {
      // Fallback local slug if backend is offline
      const fallbackCode = 'link-' + Math.floor(100 + Math.random() * 900);
      setCurrentLink({
        slug: fallbackCode,
        fullUrl: `${originDomain}/${fallbackCode}`,
        originalUrl: urlInput.trim(),
      });
      setAliasInput(fallbackCode);
    } finally {
      setIsShortening(false);
    }
  };

  const handleCopy = () => {
    if (!currentLink) return;
    navigator.clipboard.writeText(currentLink.fullUrl).catch(() => {});
    setCopied(true);
    setShowToast(true);
    setTimeout(() => setCopied(false), 2500);
    setTimeout(() => setShowToast(false), 3500);
  };

  const handleSaveAlias = () => {
    if (!aliasInput.trim() || !currentLink) return;
    const cleanSlug = aliasInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    
    if (currentLink.id) {
      updateLink(currentLink.id, { custom_slug: cleanSlug });
    }

    const fullUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/${cleanSlug}`
      : `${originDomain}/${cleanSlug}`;

    setCurrentLink(prev => prev ? { ...prev, slug: cleanSlug, fullUrl } : null);
    setAliasDrawerOpen(false);
  };

  const toggleFaq = (idx: number) => {
    setOpenFaq(prev => (prev === idx ? null : idx));
  };

  const downloadQr = (format: 'svg' | 'png') => {
    const svgEl = document.getElementById('landing-qr-code') as SVGSVGElement | null;
    if (!svgEl) return;

    if (format === 'svg') {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = svgUrl;
      downloadLink.download = `${currentLink?.slug || 'qr'}-code.svg`;
      downloadLink.click();
      URL.revokeObjectURL(svgUrl);
    } else {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 400, 400);
          ctx.drawImage(img, 20, 20, 360, 360);
          const pngUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = `${currentLink?.slug || 'qr'}-code.png`;
          downloadLink.click();
        }
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }
  };

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface antialiased font-sans selection:bg-primary-container/20 selection:text-primary-container">
      
      {/* 1. FIXED TOP NAVBAR */}
      <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-outline-variant/30">
        <div className="h-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          
          {/* Logo & Navigation */}
          <div className="flex items-center gap-6 sm:gap-8">
            <a href="#" className="flex items-center gap-2.5 group">
              <img 
                src="/senior_brand_identity_designer._1024x1024_production_app_store_icon_for_snip.png"
                alt="Snip Creator Logo" 
                className="w-9 h-9 rounded-xl object-contain shadow-sm group-hover:scale-105 transition-transform"
              />
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-on-surface leading-tight">Snip</span>
                <span className="text-[10px] text-outline tracking-wider uppercase font-semibold">Link Ops</span>
              </div>
            </a>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-on-surface-variant">
              <a href="#features" className="hover:text-on-surface transition-colors">Features</a>
              <a href="#analytics" className="hover:text-on-surface transition-colors">Analytics</a>
              <a href="#pricing" className="hover:text-on-surface transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-on-surface transition-colors">FAQ</a>
            </nav>
          </div>

          {/* User Status / Auth Actions */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-semibold text-on-surface">{currentUser.name}</span>
                  <span className="text-[11px] text-outline">{currentUser.email}</span>
                </div>
                <button
                  onClick={onGoToDashboard}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-container hover:bg-primary text-on-primary rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Go to Console</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenAuth('login')}
                  className="px-3.5 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                >
                  Log in
                </button>
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="inline-flex items-center justify-center text-xs font-semibold bg-primary-container text-on-primary rounded-lg px-4 py-2 hover:bg-primary transition-all shadow-sm cursor-pointer"
                >
                  Sign up free
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* 2. MAIN CONTENT WRAPPER */}
      <main className="w-full pt-16">
        
        {/* Top Notification Announcement Bar */}
        <section className="w-full bg-surface-container-low py-2 text-center border-b border-outline-variant/30">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-2 text-xs">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-container text-on-primary">
              New
            </span>
            <span className="text-on-surface font-medium">Dynamic QR Code generator 2.0 & OpeninApp routing are now live</span>
            <a href="#features" className="text-primary-container hover:underline font-semibold ml-1 inline-flex items-center gap-0.5">
              Learn more <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </section>

        {/* 3. HERO SECTION */}
        <section className="w-full bg-surface-container-lowest pt-14 pb-16 lg:pt-20 lg:pb-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
            
            {/* Creator Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container-high mb-6 shadow-xs border border-outline-variant/30">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
              <span className="text-xs text-on-surface-variant font-semibold">Built for modern creators & influencers</span>
            </div>

            {/* Headline & Subtitle */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl leading-[1.12] tracking-tight font-extrabold text-on-surface mb-5 max-w-3xl">
              Short links that look like you.
            </h1>
            <p className="text-base sm:text-lg text-on-surface-variant max-w-2xl mb-10 leading-relaxed">
              Turn long, messy sponsor links into memorable branded URLs with real-time analytics across your social channels.
            </p>

            {/* Interactive Shorten Card */}
            <div className="w-full max-w-3xl bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-4 sm:p-6 text-left">
              <form onSubmit={handleShorten} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline">
                    <Link2 className="w-5 h-5 text-outline" />
                  </span>
                  <input
                    type="url"
                    required
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Paste your long link (e.g., https://youtube.com/watch?v=...)"
                    className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest rounded-xl text-sm font-medium text-on-surface placeholder:text-outline border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary-container shadow-inner transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isShortening}
                  className="inline-flex items-center justify-center px-6 py-3 bg-primary-container hover:bg-primary text-on-primary text-sm font-semibold rounded-xl transition-all shadow-sm whitespace-nowrap cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  <span>{isShortening ? 'Shortening...' : 'Shorten Link'}</span>
                </button>
              </form>

              {/* Instant Output Result Card */}
              {currentLink && (
                <div className="mt-4 p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary-container shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-primary-container truncate">
                            {currentLink.fullUrl}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800">
                            Active
                          </span>
                        </div>
                        <p className="font-mono text-xs text-on-surface-variant truncate max-w-sm sm:max-w-md mt-0.5">
                          {currentLink.originalUrl}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high text-xs font-semibold shadow-xs border border-outline-variant/40 transition-all cursor-pointer"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        <span>{copied ? 'Copied!' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrModalOpen(true)}
                        title="Download QR code"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high text-xs font-semibold shadow-xs border border-outline-variant/40 transition-all cursor-pointer"
                      >
                        <QrCode className="w-4 h-4" />
                        <span className="hidden sm:inline">QR</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAliasDrawerOpen(prev => !prev)}
                        title="Edit alias slug"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high text-xs font-semibold shadow-xs border border-outline-variant/40 transition-all cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span className="hidden sm:inline">Alias</span>
                      </button>
                    </div>
                  </div>

                  {/* Edit Alias Drawer */}
                  {aliasDrawerOpen && (
                    <div className="pt-3 bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/40 mt-1">
                      <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                        Customize URL Back-half:
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-outline">{originDomain}/</span>
                        <input
                          type="text"
                          value={aliasInput}
                          onChange={(e) => setAliasInput(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg bg-surface-container-low text-on-surface border border-outline-variant/40 focus:outline-none focus:ring-1 focus:ring-primary-container"
                        />
                        <button
                          type="button"
                          onClick={handleSaveAlias}
                          className="px-3.5 py-1.5 bg-primary-container text-on-primary text-xs rounded-lg font-semibold hover:bg-primary transition-colors cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Copy Toast Banner */}
              {showToast && (
                <div className="mt-3 px-3.5 py-2.5 bg-inverse-surface text-inverse-on-surface rounded-xl text-xs font-medium flex items-center justify-between shadow-lg animate-fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Copied to clipboard! Ready to paste into your bio.</span>
                  </div>
                  <span className="font-mono text-[11px] text-surface-container-highest">1.4k clicks predicted</span>
                </div>
              )}
            </div>

            {/* Works Wherever You Share: Platforms Row */}
            <div className="mt-14 w-full flex flex-col items-center">
              <span className="text-xs uppercase tracking-wider text-outline font-semibold mb-5">
                Works seamlessly wherever you share
              </span>
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-4xl">
                
                {/* YouTube */}
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-container-low border border-outline-variant/30 shadow-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                  <span className="text-xs text-on-surface font-semibold">YouTube</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-surface-container-lowest text-on-surface-variant font-mono">1.2M+</span>
                </div>

                {/* Instagram */}
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-container-low border border-outline-variant/30 shadow-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-600"></span>
                  <span className="text-xs text-on-surface font-semibold">Instagram</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-surface-container-lowest text-on-surface-variant font-mono">Bio & Stories</span>
                </div>

                {/* TikTok */}
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-container-low border border-outline-variant/30 shadow-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-black dark:bg-white"></span>
                  <span className="text-xs text-on-surface font-semibold">TikTok</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-surface-container-lowest text-on-surface-variant font-mono">Profile</span>
                </div>

                {/* X / Twitter */}
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-container-low border border-outline-variant/30 shadow-xs">
                  <span className="text-xs font-bold text-on-surface">𝕏</span>
                  <span className="text-xs text-on-surface font-semibold">X / Twitter</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-surface-container-lowest text-on-surface-variant font-mono">Posts</span>
                </div>

                {/* Twitch */}
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-container-low border border-outline-variant/30 shadow-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                  <span className="text-xs text-on-surface font-semibold">Twitch</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-surface-container-lowest text-on-surface-variant font-mono">Panels</span>
                </div>

                {/* Substack */}
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-container-low border border-outline-variant/30 shadow-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                  <span className="text-xs text-on-surface font-semibold">Substack</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-surface-container-lowest text-on-surface-variant font-mono">Newsletters</span>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* 4. CORE FEATURES SECTION */}
        <section className="w-full bg-surface-container-low py-16 lg:py-24 border-t border-outline-variant/20" id="features">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto text-center mb-14">
              <span className="text-xs uppercase tracking-wider text-primary-container font-bold">
                Purpose-Built Architecture
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface mt-2 mb-4 tracking-tight">
                Everything creators need to command their audience journey
              </h2>
              <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
                Built with Notion&apos;s clarity and Stripe&apos;s reliability. Never drop an affiliate lead or obscure sponsor metric again.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Feature 1 */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between border border-outline-variant/40">
                <div>
                  <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-primary-container mb-5">
                    <Globe2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-on-surface mb-2">
                    Branded Custom Links
                  </h3>
                  <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                    Use your own vanity domain or custom back-half (<span className="font-mono text-primary-container text-xs">snip.to/yourname</span>) that followers trust and recognize instantly.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-outline-variant/30">
                  <span className="inline-flex items-center text-xs font-semibold text-primary-container gap-1">
                    Zero DNS headaches <Check className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between border border-outline-variant/40">
                <div>
                  <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-primary-container mb-5">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-on-surface mb-2">
                    Click Analytics by Platform
                  </h3>
                  <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                    See exactly where traffic originates—Instagram bio, YouTube description, TikTok stories, or X posts—without cookie banners.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-outline-variant/30">
                  <span className="inline-flex items-center text-xs font-semibold text-primary-container gap-1">
                    Native in-app tracking <TrendingUp className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between border border-outline-variant/40">
                <div>
                  <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-primary-container mb-5">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-on-surface mb-2">
                    Dynamic QR Codes
                  </h3>
                  <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                    Generate high-resolution vector QR codes with customizable colors and download formats ready for print merch or video overlays.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-outline-variant/30">
                  <span className="inline-flex items-center text-xs font-semibold text-primary-container gap-1">
                    SVG, PNG & PDF exports <Download className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between border border-outline-variant/40">
                <div>
                  <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-primary-container mb-5">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-on-surface mb-2">
                    OpeninApp Deep Routing
                  </h3>
                  <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                    Automatically launch YouTube, Instagram, Spotify, and TikTok native mobile apps directly, bypassing restricted in-app webviews.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-outline-variant/30">
                  <span className="inline-flex items-center text-xs font-semibold text-primary-container gap-1">
                    Direct app launches <Sparkles className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 4.5 OFFICIAL APP STORE PRODUCT SHOWCASE */}
        <section className="w-full bg-surface-container-lowest py-16 lg:py-20 border-t border-outline-variant/20 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <span className="text-xs uppercase tracking-wider text-primary-container font-bold">
                Platform Experience
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface mt-2 mb-4 tracking-tight">
                Designed for high-output creator operations
              </h2>
              <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
                Take a look at the official production interfaces for deep link routing, zero-trust analytics, and brand sponsor campaign deliverables.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {/* Screenshot 1 */}
              <div className="group rounded-3xl bg-surface-container-low p-3 border border-outline-variant/30 shadow-md hover:shadow-xl transition-all flex flex-col">
                <div className="overflow-hidden rounded-2xl bg-surface-container-lowest aspect-4/3 flex items-center justify-center border border-outline-variant/20">
                  <img 
                    src="/official_app_store_marketing_screenshot_1_title_card_the_hook_for_snip_creator.png"
                    alt="Snip Creator - The Hook Title Card"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                  />
                </div>
                <div className="p-4 pt-3 flex flex-col">
                  <span className="text-[11px] font-bold text-primary-container uppercase tracking-wider">Command Center</span>
                  <h4 className="text-sm font-bold text-on-surface mt-1">Direct Intent &amp; Routing Hook</h4>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">Bypass trapped webviews with one-tap deep linking into native apps.</p>
                </div>
              </div>

              {/* Screenshot 2 */}
              <div className="group rounded-3xl bg-surface-container-low p-3 border border-outline-variant/30 shadow-md hover:shadow-xl transition-all flex flex-col">
                <div className="overflow-hidden rounded-2xl bg-surface-container-lowest aspect-4/3 flex items-center justify-center border border-outline-variant/20">
                  <img 
                    src="/official_app_store_marketing_screenshot_2_key_feature_for_snip_creator_app..png"
                    alt="Key Feature Deep Dive"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                  />
                </div>
                <div className="p-4 pt-3 flex flex-col">
                  <span className="text-[11px] font-bold text-primary-container uppercase tracking-wider">Key Utilities</span>
                  <h4 className="text-sm font-bold text-on-surface mt-1">Real-Time Performance Engine</h4>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">Aggregated metrics, automated UTM tags, and high-velocity link generation.</p>
                </div>
              </div>

              {/* Screenshot 3 */}
              <div className="group rounded-3xl bg-surface-container-low p-3 border border-outline-variant/30 shadow-md hover:shadow-xl transition-all flex flex-col">
                <div className="overflow-hidden rounded-2xl bg-surface-container-lowest aspect-4/3 flex items-center justify-center border border-outline-variant/20">
                  <img 
                    src="/official_app_store_marketing_screenshot_3_visual_polish_utilities_for_snip.png"
                    alt="Visual Polish & Utilities"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                  />
                </div>
                <div className="p-4 pt-3 flex flex-col">
                  <span className="text-[11px] font-bold text-primary-container uppercase tracking-wider">Enterprise Reliability</span>
                  <h4 className="text-sm font-bold text-on-surface mt-1">Zero-Trust Threat Shield</h4>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">Automatic 404 killswitches, bot filtering, and verified SSL health inspection.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. CREATOR ANALYTICS PREVIEW SECTION */}
        <section className="w-full bg-surface-container-lowest py-16 lg:py-24" id="analytics">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Section Header */}
            <div className="max-w-3xl mb-12">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-primary-container text-xs font-bold mb-3 border border-outline-variant/30">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Zero Guesswork</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight mb-3">
                Analytics that actually make sense.
              </h2>
              <p className="text-sm sm:text-base text-on-surface-variant">
                No complex spreadsheets. Just clean, instant insights on what your community clicks, when they click it, and where the sponsor conversions happen.
              </p>
            </div>

            {/* Dashboard Mockup Card */}
            <div className="bg-surface-container-lowest rounded-3xl shadow-xl border border-outline-variant/40 p-6 lg:p-8 overflow-hidden">
              
              {/* Mockup Top Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 gap-4 border-b border-outline-variant/20">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm shadow-xs">
                    SC
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-on-surface">Sarah Connor Media</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container text-primary-container">
                        Pro Creator
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">Campaign: Sony A7IV Gear Showcase (Active 14 Days)</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-xl bg-surface-container-low text-on-surface text-xs font-semibold flex items-center gap-1.5 border border-outline-variant/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Tracking
                  </span>
                  <div className="px-3 py-1.5 rounded-xl bg-surface-container-lowest text-on-surface-variant text-xs font-semibold border border-outline-variant/40 shadow-xs">
                    Last 14 Days
                  </div>
                </div>
              </div>

              {/* 4 Metric Cards Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-8">
                <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20">
                  <span className="text-xs text-on-surface-variant font-semibold">Total Clicks</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-extrabold font-mono text-on-surface">48,250</span>
                    <span className="text-xs font-bold text-emerald-600 flex items-center">
                      <TrendingUp className="w-3 h-3 mr-0.5" /> +14.2%
                    </span>
                  </div>
                  <span className="text-[11px] text-outline mt-1 block">vs. previous period</span>
                </div>

                <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20">
                  <span className="text-xs text-on-surface-variant font-semibold">Top Traffic Origin</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-extrabold text-on-surface">YouTube</span>
                    <span className="text-xs font-bold text-primary-container">52.0%</span>
                  </div>
                  <span className="text-[11px] text-outline mt-1 block">Main video description</span>
                </div>

                <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20">
                  <span className="text-xs text-on-surface-variant font-semibold">Mobile Device Ratio</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-extrabold font-mono text-on-surface">84.0%</span>
                    <span className="text-xs font-medium text-on-surface-variant">40.5k users</span>
                  </div>
                  <span className="text-[11px] text-outline mt-1 block">iOS: 62% • Android: 22%</span>
                </div>

                <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20">
                  <span className="text-xs text-on-surface-variant font-semibold">Conversion Rate</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-extrabold font-mono text-on-surface">18.6%</span>
                    <span className="text-xs font-bold text-emerald-600">High intent</span>
                  </div>
                  <span className="text-[11px] text-outline mt-1 block">Destination affiliate ping</span>
                </div>
              </div>

              {/* Chart & Channel Breakdown Split Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Main Timeline Chart (7 cols) */}
                <div className="lg:col-span-7 bg-surface-container-low p-5 rounded-2xl border border-outline-variant/20">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h5 className="text-sm font-bold text-on-surface">Click Velocity (14-Day Timeline)</h5>
                      <p className="text-xs text-on-surface-variant">Aggregated direct and in-app referrals</p>
                    </div>
                    <span className="font-mono text-xs text-primary-container font-bold bg-surface-container-lowest px-2.5 py-1 rounded-lg border border-outline-variant/30 shadow-xs">
                      Peak: 4,920 clicks / day
                    </span>
                  </div>

                  {/* Clean SVG Area & Line Chart */}
                  <div className="w-full h-56 relative flex items-end">
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 600 200">
                      {/* Gridlines */}
                      <line x1="0" y1="20" x2="600" y2="20" stroke="#dce2f7" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="0" y1="70" x2="600" y2="70" stroke="#dce2f7" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="0" y1="120" x2="600" y2="120" stroke="#dce2f7" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="0" y1="170" x2="600" y2="170" stroke="#dce2f7" strokeWidth="1" />
                      
                      {/* Area Fill */}
                      <path
                        d="M 0,160 Q 40,150 80,130 T 160,110 T 240,60 T 320,40 T 400,90 T 480,30 T 560,75 L 600,65 L 600,170 L 0,170 Z"
                        fill="#4f46e5"
                        fillOpacity="0.12"
                      />
                      
                      {/* Line Curve */}
                      <path
                        d="M 0,160 Q 40,150 80,130 T 160,110 T 240,60 T 320,40 T 400,90 T 480,30 T 560,75 L 600,65"
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      
                      {/* Peak Marker Dot */}
                      <circle cx="480" cy="30" r="5" fill="#4f46e5" stroke="#ffffff" strokeWidth="2.5" />
                    </svg>

                    {/* Tooltip Pill */}
                    <div className="absolute left-[78%] top-1 -translate-x-1/2 bg-on-surface text-surface-container-lowest px-2.5 py-1.5 rounded-lg text-xs font-mono shadow-md">
                      Day 12: 4,920 clicks
                    </div>
                  </div>

                  {/* X-Axis Labels */}
                  <div className="flex justify-between font-mono text-[11px] text-outline mt-3 px-1">
                    <span>Day 1</span>
                    <span>Day 4</span>
                    <span>Day 7 (Upload)</span>
                    <span>Day 10</span>
                    <span>Day 12 (Peak)</span>
                    <span>Today</span>
                  </div>
                </div>

                {/* Breakdown by Platform Column (5 cols) */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/20">
                    <h5 className="text-sm font-bold text-on-surface mb-4">Traffic by Channel</h5>
                    <div className="space-y-4">
                      
                      {/* YouTube */}
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-semibold text-on-surface flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> YouTube
                          </span>
                          <span className="font-mono text-on-surface-variant font-semibold">25,090 (52%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
                          <div className="h-full bg-red-600 rounded-full" style={{ width: '52%' }}></div>
                        </div>
                      </div>

                      {/* Instagram */}
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-semibold text-on-surface flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-pink-600"></span> Instagram
                          </span>
                          <span className="font-mono text-on-surface-variant font-semibold">13,510 (28%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
                          <div className="h-full bg-pink-600 rounded-full" style={{ width: '28%' }}></div>
                        </div>
                      </div>

                      {/* TikTok */}
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-semibold text-on-surface flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-black dark:bg-white"></span> TikTok
                          </span>
                          <span className="font-mono text-on-surface-variant font-semibold">6,755 (14%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
                          <div className="h-full bg-black dark:bg-white rounded-full" style={{ width: '14%' }}></div>
                        </div>
                      </div>

                      {/* X / Twitter */}
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-semibold text-on-surface flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> X (Twitter)
                          </span>
                          <span className="font-mono text-on-surface-variant font-semibold">2,895 (6%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: '6%' }}></div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Geography Pill */}
                  <div className="bg-surface-container-low p-5 rounded-2xl flex items-center justify-between border border-outline-variant/20">
                    <div>
                      <span className="text-xs text-on-surface-variant font-medium">Top Countries</span>
                      <p className="text-xs sm:text-sm font-bold text-on-surface mt-0.5">🇺🇸 US 46% • 🇬🇧 UK 24% • 🇨🇦 CA 14%</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-on-surface-variant font-medium">Mobile share</span>
                      <p className="font-mono font-bold text-on-surface text-sm">84%</p>
                    </div>
                  </div>

                </div>

              </div>

            </div>

          </div>
        </section>

        {/* 6. PRICING SECTION */}
        <section className="w-full bg-surface-container-low py-16 lg:py-24 border-t border-outline-variant/20" id="pricing">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <span className="text-xs uppercase tracking-wider text-primary-container font-bold">
                Fair & Scalable
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight mt-2 mb-3">
                Simple, transparent pricing for every creator.
              </h2>
              <p className="text-sm sm:text-base text-on-surface-variant">
                Start for free, upgrade when your audience scales. No hidden lock-ins or surprise tier upgrades.
              </p>
            </div>

            {/* 3 Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
              
              {/* Free Tier */}
              <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-xs border border-outline-variant/40 flex flex-col justify-between">
                <div>
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-on-surface">Free</h3>
                    <p className="text-xs text-on-surface-variant mt-1">For budding creators getting started.</p>
                  </div>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-extrabold font-mono text-on-surface">$0</span>
                    <span className="text-xs text-on-surface-variant">/month</span>
                  </div>
                  <ul className="space-y-3.5 mb-8 text-xs text-on-surface">
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span>100 short links / month</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span>Standard <strong className="font-mono">{originDomain}</strong> links</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span>Basic 30-day analytics</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span>1 Dynamic QR code</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-on-surface-variant">
                      <Check className="w-4 h-4 text-outline shrink-0" />
                      <span>Community forum support</span>
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="w-full py-3 px-4 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold text-center transition-colors cursor-pointer"
                >
                  Get started free
                </button>
              </div>

              {/* Creator Tier (Featured) */}
              <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-xl border-2 border-primary-container flex flex-col justify-between relative transform lg:-translate-y-2">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary-container text-on-primary rounded-full text-[11px] font-bold tracking-wide uppercase shadow-sm">
                  Most popular
                </div>
                <div>
                  <div className="mb-6 pt-2">
                    <h3 className="text-xl font-bold text-on-surface">Creator</h3>
                    <p className="text-xs text-on-surface-variant mt-1">For active influencers & YouTubers.</p>
                  </div>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-extrabold font-mono text-on-surface">$12</span>
                    <span className="text-xs text-on-surface-variant">/month</span>
                  </div>
                  <ul className="space-y-3.5 mb-8 text-xs text-on-surface">
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span className="font-semibold">Unlimited short links</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span>3 custom branded vanity domains</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span>Real-time social origin breakdown</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span>Unlimited vector QR codes</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span>OpeninApp native deep routing</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span>Priority support</span>
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="w-full py-3.5 px-4 rounded-xl bg-primary-container hover:bg-primary text-on-primary text-xs font-bold text-center shadow-md transition-colors cursor-pointer"
                >
                  Start 14-day free trial
                </button>
              </div>

              {/* Business Tier */}
              <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-xs border border-outline-variant/40 flex flex-col justify-between">
                <div>
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-on-surface">Business</h3>
                    <p className="text-xs text-on-surface-variant mt-1">For creator agencies & podcast studios.</p>
                  </div>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-extrabold font-mono text-on-surface">$39</span>
                    <span className="text-xs text-on-surface-variant">/month</span>
                  </div>
                  <ul className="space-y-3.5 mb-8 text-xs text-on-surface">
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span>Everything in Creator, plus:</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span>10 team seats with role permissions</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span>10 custom branded domains</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span>UTM campaign batch builder</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span>Developer API & Webhooks</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span>Dedicated account manager</span>
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="w-full py-3 px-4 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold text-center transition-colors cursor-pointer"
                >
                  Contact sales
                </button>
              </div>

            </div>
          </div>
        </section>

        {/* 7. FAQ ACCORDION SECTION */}
        <section className="w-full bg-surface-container-lowest py-16 lg:py-24 border-t border-outline-variant/20" id="faq">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="text-xs uppercase tracking-wider text-primary-container font-bold">
                Got Questions?
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight mt-2 mb-3">
                Frequently asked questions
              </h2>
              <p className="text-sm text-on-surface-variant">
                Everything you need to know about link lifespans, custom domains, and platform telemetry.
              </p>
            </div>

            <div className="space-y-4">
              
              {/* Item 1 */}
              <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 transition-all">
                <button
                  type="button"
                  onClick={() => toggleFaq(1)}
                  className="w-full flex items-center justify-between text-left font-bold text-sm sm:text-base text-on-surface cursor-pointer"
                >
                  <span>Can I connect my own custom domain?</span>
                  {openFaq === 1 ? <ChevronUp className="w-5 h-5 text-outline" /> : <ChevronDown className="w-5 h-5 text-outline" />}
                </button>
                {openFaq === 1 && (
                  <div className="mt-3 pt-3 text-xs sm:text-sm text-on-surface-variant border-t border-outline-variant/20 leading-relaxed animate-fade-in">
                    Yes! You can connect your custom domain like <code className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded">links.yourbrand.com</code> in less than 2 minutes via standard CNAME records. We provision automatic, auto-renewing SSL certificates instantly.
                  </div>
                )}
              </div>

              {/* Item 2 */}
              <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 transition-all">
                <button
                  type="button"
                  onClick={() => toggleFaq(2)}
                  className="w-full flex items-center justify-between text-left font-bold text-sm sm:text-base text-on-surface cursor-pointer"
                >
                  <span>Will my links work forever even if I cancel?</span>
                  {openFaq === 2 ? <ChevronUp className="w-5 h-5 text-outline" /> : <ChevronDown className="w-5 h-5 text-outline" />}
                </button>
                {openFaq === 2 && (
                  <div className="mt-3 pt-3 text-xs sm:text-sm text-on-surface-variant border-t border-outline-variant/20 leading-relaxed animate-fade-in">
                    Free links remain active indefinitely. You never have to worry about broken links in your old YouTube descriptions or evergreen podcast show notes. If you downgrade from a paid tier, your existing links continue routing seamlessly.
                  </div>
                )}
              </div>

              {/* Item 3 */}
              <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 transition-all">
                <button
                  type="button"
                  onClick={() => toggleFaq(3)}
                  className="w-full flex items-center justify-between text-left font-bold text-sm sm:text-base text-on-surface cursor-pointer"
                >
                  <span>How does OpeninApp platform detection work?</span>
                  {openFaq === 3 ? <ChevronUp className="w-5 h-5 text-outline" /> : <ChevronDown className="w-5 h-5 text-outline" />}
                </button>
                {openFaq === 3 && (
                  <div className="mt-3 pt-3 text-xs sm:text-sm text-on-surface-variant border-t border-outline-variant/20 leading-relaxed animate-fade-in">
                    Snip automatically analyzes destination links (YouTube, Instagram, Spotify, etc.) and dispatches native mobile intents and URI schemes. On mobile, visitors launch straight into the native app with their logged-in Google or Instagram accounts, bypassing restricted in-app browser webviews!
                  </div>
                )}
              </div>

              {/* Item 4 */}
              <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-5 transition-all">
                <button
                  type="button"
                  onClick={() => toggleFaq(4)}
                  className="w-full flex items-center justify-between text-left font-bold text-sm sm:text-base text-on-surface cursor-pointer"
                >
                  <span>Can I change the destination URL after sharing?</span>
                  {openFaq === 4 ? <ChevronUp className="w-5 h-5 text-outline" /> : <ChevronDown className="w-5 h-5 text-outline" />}
                </button>
                {openFaq === 4 && (
                  <div className="mt-3 pt-3 text-xs sm:text-sm text-on-surface-variant border-t border-outline-variant/20 leading-relaxed animate-fade-in">
                    Yes, dynamic redirects allow you to update where a link points at any time without changing the short URL. If a brand changes their promo page or you swap out an affiliate link, you update it once in your dashboard and all past shares redirect instantly.
                  </div>
                )}
              </div>

            </div>
          </div>
        </section>

        {/* 8. CREATOR TESTIMONIAL & FINAL CTA */}
        <section className="w-full bg-surface-container-low py-16 lg:py-24 border-t border-outline-variant/20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
            
            {/* Testimonial Card */}
            <div className="w-full bg-surface-container-lowest rounded-3xl p-8 sm:p-12 shadow-sm border border-outline-variant/40 mb-16 text-center max-w-3xl">
              <div className="flex justify-center mb-6 gap-1 text-amber-500">
                {'★'.repeat(5)}
              </div>
              <blockquote className="text-base sm:text-xl sm:leading-relaxed text-on-surface font-semibold mb-6">
                “I used to stress about dead Amazon affiliate links in my old YouTube descriptions. Snip gives me complete peace of mind, and the in-app Instagram tracking helped me double my sponsor rates because I had verifiable click proof.”
              </blockquote>
              <div className="flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-container border border-outline-variant/40">
                  <img
                    alt="Sarah Connor"
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-on-surface">Sarah Connor</div>
                  <div className="text-xs text-on-surface-variant">Tech & Lifestyle Creator (840k subscribers)</div>
                </div>
              </div>
            </div>

            {/* Final CTA Banner */}
            <div className="w-full bg-primary-container text-on-primary rounded-3xl p-8 sm:p-12 text-center shadow-xl">
              <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
                Ready to simplify your links?
              </h3>
              <p className="text-sm sm:text-base text-primary-fixed mb-8 max-w-xl mx-auto">
                Join thousands of creators using Snip to build brand trust and measure genuine community clicks.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-surface-container-lowest text-primary-container hover:bg-surface-container-low text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  Sign up free
                </button>
                <a
                  href="#features"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-primary text-on-primary hover:bg-opacity-80 text-xs font-semibold transition-all cursor-pointer"
                >
                  Explore features
                </a>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-primary-fixed font-medium">
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Free forever tier included
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> 2-min setup
                </span>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* 9. FOOTER */}
      <footer className="w-full bg-surface-container-lowest border-t border-outline-variant/20 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img 
              src="/senior_brand_identity_designer._1024x1024_production_app_store_icon_for_snip.png"
              alt="Snip Logo"
              className="w-6 h-6 rounded-lg object-contain shadow-2xs"
            />
            <span className="text-xs text-on-surface-variant font-medium">
              © {new Date().getFullYear()} Snip Technologies, Inc. Built for modern content creators.
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-on-surface-variant font-medium">
            <a href="#features" className="hover:text-on-surface transition-colors">Features</a>
            <a href="#pricing" className="hover:text-on-surface transition-colors">Pricing</a>
            <Link href="/privacy" className="hover:text-on-surface transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-on-surface transition-colors">Terms</Link>
          </div>
        </div>
      </footer>

      {/* 10. QR CODE MODAL */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-outline-variant/40 relative">
            <button
              type="button"
              onClick={() => setQrModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition"
            >
              <X className="w-5 h-5" />
            </button>
            <h4 className="text-base font-bold text-on-surface mb-1">Dynamic QR Code</h4>
            <p className="text-xs text-on-surface-variant mb-4">
              Print-ready vector QR for <span className="font-mono text-primary-container font-semibold">{currentLink?.fullUrl}</span>
            </p>

            {/* Dynamic QR Code Graphic */}
            <div className="w-48 h-48 mx-auto p-4 bg-surface-container-lowest rounded-xl shadow-xs border border-outline-variant/30 flex items-center justify-center mb-5">
              <QRCodeSVG
                id="landing-qr-code"
                value={currentLink?.fullUrl || 'https://snip.to'}
                size={160}
                level="H"
                fgColor="#141b2b"
                bgColor="#ffffff"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadQr('svg')}
                className="flex-1 py-2.5 px-3 rounded-xl bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download SVG
              </button>
              <button
                type="button"
                onClick={() => downloadQr('png')}
                className="py-2.5 px-3 rounded-xl bg-surface-container-high text-on-surface text-xs font-semibold hover:bg-surface-container-highest transition-colors cursor-pointer border border-outline-variant/30"
              >
                PNG (Hi-Res)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
