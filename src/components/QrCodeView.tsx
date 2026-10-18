'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/storeContext';
import { getShortUrlPrefix } from '@/lib/db';
import { 
  QrCode, 
  Download, 
  Palette, 
  Copy, 
  Check, 
  Link2, 
  Globe, 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Wand2, 
  Sparkles, 
  Layout, 
  Layers, 
  Smartphone, 
  Printer, 
  ShieldCheck, 
  Sliders, 
  RefreshCw 
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { SkeletonGenericView } from './ui/Skeleton';
import { 
  PRESET_BRAND_LOGOS, 
  QR_THEME_PRESETS, 
  QrFrameStyle, 
  PresetBrandLogo, 
  QrThemePreset, 
  extractColorsFromImage 
} from '@/lib/qrPresets';

interface QrCodeViewProps {
  onNavigateTab?: (tab: string) => void;
  onOpenCreateModal?: () => void;
}

export const QrCodeView: React.FC<QrCodeViewProps> = () => {
  const { links, domains, refreshLinks, refreshDomains, isInitialLoading, isLinksLoading } = useStore();
  const originDomain = typeof window !== 'undefined' ? window.location.host : 'tinyurl.com';
  const defaultDomainUrl = `https://${domains[0]?.hostname || originDomain}`;

  useEffect(() => {
    refreshLinks();
    refreshDomains();
  }, [refreshLinks, refreshDomains]);

  // Source selection
  const [sourceMode, setSourceMode] = useState<'link' | 'custom'>(links.length > 0 ? 'link' : 'custom');
  const [selectedLinkId, setSelectedLinkId] = useState<string>(links[0]?.id || '');
  const [customUrl, setCustomUrl] = useState<string>(defaultDomainUrl);

  // Active Tab in Studio Control panel
  const [activeStudioTab, setActiveStudioTab] = useState<'design' | 'logo' | 'frame'>('design');

  // Customization - Design & Colors
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [selectedThemeId, setSelectedThemeId] = useState<string>('classic-pure');
  const [qrSize, setQrSize] = useState(240);
  const [errorLevel, setErrorLevel] = useState<'L' | 'M' | 'Q' | 'H'>('H'); // Default H (30%) for logo tolerance

  // Customization - Logo & Image
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [logoSizePercent, setLogoSizePercent] = useState<number>(24); // 24% of QR width
  const [excavateLogo, setExcavateLogo] = useState<boolean>(true);
  const [isExtractingColor, setIsExtractingColor] = useState<boolean>(false);
  const [colorExtractedToast, setColorExtractedToast] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Customization - Frame & Poster
  const [frameStyle, setFrameStyle] = useState<QrFrameStyle>('none');
  const [frameCtaText, setFrameCtaText] = useState<string>('SCAN ME');

  // Interactive feedback
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);

  // Sync selected link if links load
  useEffect(() => {
    if (links.length > 0 && (!selectedLinkId || !links.some(l => l.id === selectedLinkId))) {
      setSelectedLinkId(links[0].id);
    }
  }, [links, selectedLinkId]);

  const selectedLink = links.find(l => l.id === selectedLinkId) || links[0];

  // Target URL value encoded in QR
  const activeQrValue = sourceMode === 'link'
    ? (selectedLink ? `${getShortUrlPrefix(domains[0]?.hostname)}/${selectedLink.custom_slug || selectedLink.short_code}` : defaultDomainUrl)
    : (customUrl.trim() || defaultDomainUrl);

  // Calculated logo dimensions
  const calculatedLogoSize = Math.round((qrSize * logoSizePercent) / 100);

  // Apply Theme Preset
  const handleApplyTheme = (theme: QrThemePreset) => {
    setSelectedThemeId(theme.id);
    setFgColor(theme.fgColor);
    setBgColor(theme.bgColor);
  };

  // Apply Preset Brand Logo
  const handleApplyPresetLogo = (preset: PresetBrandLogo) => {
    setLogoSrc(preset.svgDataUri);
    setLogoName(preset.name);
    // Suggest matching theme colors
    setFgColor(preset.suggestedFg);
    setBgColor(preset.suggestedBg);
    setSelectedThemeId('custom');
  };

  // Process and upload user image (PNG, JPEG, SVG)
  const processImageFile = async (file: File) => {
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.svg')) {
      alert('Please upload a valid image file (PNG, JPG, JPEG, or SVG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setLogoSrc(dataUrl);
      setLogoName(file.name);

      // Auto-extract colors from the uploaded logo
      setIsExtractingColor(true);
      try {
        const extracted = await extractColorsFromImage(dataUrl);
        setFgColor(extracted.primary);
        setBgColor(extracted.background);
        setSelectedThemeId('custom');
        setColorExtractedToast(true);
        setTimeout(() => setColorExtractedToast(false), 3000);
      } catch (err) {
        console.warn('Could not extract colors from image:', err);
      } finally {
        setIsExtractingColor(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Re-run color matching from current logo
  const handleMatchColorsFromLogo = async () => {
    if (!logoSrc) return;
    setIsExtractingColor(true);
    try {
      const extracted = await extractColorsFromImage(logoSrc);
      setFgColor(extracted.primary);
      setBgColor(extracted.background);
      setSelectedThemeId('custom');
      setColorExtractedToast(true);
      setTimeout(() => setColorExtractedToast(false), 3000);
    } catch {
      // Fallback
    } finally {
      setIsExtractingColor(false);
    }
  };

  const handleClearLogo = () => {
    setLogoSrc(null);
    setLogoName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Copy target URL
  const handleCopyUrl = () => {
    if (!activeQrValue) return;
    navigator.clipboard.writeText(activeQrValue);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Download Vector SVG
  const handleDownloadSvg = () => {
    const svgElement = document.getElementById('qr-code-svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    const baseName = sourceMode === 'link' ? (selectedLink?.short_code || 'code') : 'custom';
    downloadLink.download = `qr_${baseName}_vector.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
  };

  // Download High-Res PNG (Includes Frame and Text if active)
  const handleDownloadPng = async (multiplier: number = 4) => {
    setIsDownloading(true);
    try {
      const qrCanvas = document.getElementById('hidden-qr-canvas') as HTMLCanvasElement;
      if (!qrCanvas) return;

      const exportCanvas = document.createElement('canvas');
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      const padding = 32 * multiplier;
      const qrPixelSize = qrSize * multiplier;

      let totalWidth = qrPixelSize + padding * 2;
      let totalHeight = qrPixelSize + padding * 2;

      // Adjust height for framed styles
      if (frameStyle === 'bottom-badge') {
        totalHeight += 56 * multiplier;
      } else if (frameStyle === 'top-header') {
        totalHeight += 48 * multiplier;
      } else if (frameStyle === 'phone-mockup') {
        totalHeight += 90 * multiplier;
        totalWidth += 24 * multiplier;
      } else if (frameStyle === 'glass-card') {
        totalHeight += 64 * multiplier;
      }

      exportCanvas.width = totalWidth;
      exportCanvas.height = totalHeight;

      // Background Card
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      // Frame styling
      if (frameStyle === 'phone-mockup') {
        ctx.strokeStyle = fgColor;
        ctx.lineWidth = 4 * multiplier;
        ctx.strokeRect(12 * multiplier, 12 * multiplier, totalWidth - 24 * multiplier, totalHeight - 24 * multiplier);
      }

      // Draw Header Text if top-header frame
      let qrOffsetY = padding;
      if (frameStyle === 'top-header') {
        ctx.fillStyle = fgColor;
        ctx.font = `bold ${14 * multiplier}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(frameCtaText || 'SCAN WITH CAMERA', totalWidth / 2, padding);
        qrOffsetY += 28 * multiplier;
      }

      // Draw QR Code
      const qrOffsetX = (totalWidth - qrPixelSize) / 2;
      ctx.drawImage(qrCanvas, qrOffsetX, qrOffsetY, qrPixelSize, qrPixelSize);

      // Draw Footer Badge if bottom-badge frame
      if (frameStyle === 'bottom-badge') {
        const badgeY = qrOffsetY + qrPixelSize + 16 * multiplier;
        const badgeHeight = 36 * multiplier;
        const badgeWidth = Math.min(totalWidth - 32 * multiplier, 220 * multiplier);
        const badgeX = (totalWidth - badgeWidth) / 2;

        ctx.fillStyle = fgColor;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 18 * multiplier);
        ctx.fill();

        ctx.fillStyle = bgColor;
        ctx.font = `bold ${13 * multiplier}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(frameCtaText || 'SCAN ME', totalWidth / 2, badgeY + badgeHeight / 2);
      }

      // Export Blob & Trigger download
      exportCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const baseName = sourceMode === 'link' ? (selectedLink?.short_code || 'code') : 'custom';
        a.download = `qr_${baseName}_highres.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (err) {
      console.error('PNG export failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Copy PNG image to clipboard
  const handleCopyImageToClipboard = async () => {
    try {
      const qrCanvas = document.getElementById('hidden-qr-canvas') as HTMLCanvasElement;
      if (!qrCanvas) return;

      qrCanvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopiedImage(true);
          setTimeout(() => setCopiedImage(false), 2000);
        } catch {
          handleCopyUrl();
        }
      });
    } catch {
      handleCopyUrl();
    }
  };

  if (isInitialLoading && links.length === 0) {
    return <SkeletonGenericView title="Vector QR Code Studio & Logo Designer" />;
  }

  return (
    <div className="space-y-8 animate-fade-in text-foreground">
      
      {/* Hidden high-res canvas for crystal clear raster exports */}
      <div className="hidden">
        <QRCodeCanvas
          id="hidden-qr-canvas"
          value={activeQrValue}
          size={qrSize * 4}
          fgColor={fgColor}
          bgColor={bgColor}
          level={errorLevel}
          marginSize={2}
          imageSettings={
            logoSrc
              ? {
                  src: logoSrc,
                  height: calculatedLogoSize * 4,
                  width: calculatedLogoSize * 4,
                  excavate: excavateLogo,
                }
              : undefined
          }
        />
      </div>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-primary/10 text-primary">
                <QrCode className="w-6 h-6" />
              </span>
              Vector QR Code Studio &amp; Logo Designer
            </h1>
            <Badge variant="primary" className="text-[10px]">PRO STUDIO</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">
            Create high-density, custom-branded QR codes. Upload your company logo (PNG, JPG, SVG), match colors automatically, choose framing cards, and export razor-sharp vector SVGs or print-ready PNGs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="success" className="px-3 py-1 text-xs font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>30% Error Tolerance (Level H)</span>
          </Badge>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Studio Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* 1. Destination Source Card */}
          <Card className="p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">1. Destination Content</h3>
              </div>
              <span className="text-[11px] text-muted-foreground">What does this QR code open?</span>
            </div>

            <div className="grid grid-cols-2 p-1 bg-muted/60 rounded-lg border border-border/60 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSourceMode('link')}
                className={`py-2 px-3 rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  sourceMode === 'link'
                    ? 'bg-background text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Short Link ({links.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceMode('custom')}
                className={`py-2 px-3 rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  sourceMode === 'custom'
                    ? 'bg-background text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Custom URL or Text</span>
              </button>
            </div>

            {sourceMode === 'link' ? (
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Select Short Link from Workspace</label>
                {links.length > 0 ? (
                  <select
                    value={selectedLinkId}
                    onChange={(e) => setSelectedLinkId(e.target.value)}
                    className="w-full h-10 px-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground outline-none transition cursor-pointer font-medium"
                  >
                    {links.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.title || 'Untitled'} (/{l.custom_slug || l.short_code}) → {l.destination_url.slice(0, 40)}...
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-xs text-muted-foreground">
                    No short links found in this workspace. Switch to Custom URL or create a link first.
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Direct Destination URL or Custom Text</label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://yourbrand.com/app or any text..."
                  className="w-full h-10 px-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground outline-none font-mono"
                />
              </div>
            )}
          </Card>

          {/* 2. Studio Tabs (Design / Logo / Framing) */}
          <Card className="p-5 shadow-xs space-y-5">
            
            {/* Studio Navigation Bar */}
            <div className="flex items-center gap-2 p-1 bg-muted/60 rounded-lg border border-border/60">
              <button
                type="button"
                onClick={() => setActiveStudioTab('logo')}
                className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  activeStudioTab === 'logo'
                    ? 'bg-background text-primary shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Logo &amp; Brand</span>
                {logoSrc && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveStudioTab('design')}
                className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  activeStudioTab === 'design'
                    ? 'bg-background text-primary shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Color Themes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveStudioTab('frame')}
                className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  activeStudioTab === 'frame'
                    ? 'bg-background text-primary shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layout className="w-3.5 h-3.5" />
                <span>Card Frames</span>
              </button>
            </div>

            {/* TAB CONTENT: LOGO & BRANDING */}
            {activeStudioTab === 'logo' && (
              <div className="space-y-5 animate-fade-in text-xs">
                
                {/* Upload Image Dropzone */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-foreground">Upload Custom Logo (PNG, JPG, SVG)</label>
                    <span className="text-[10px] text-muted-foreground">Vector SVG or High-Res Raster</span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {logoSrc ? (
                    <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-background border border-border/60 p-1 flex items-center justify-center shrink-0 shadow-xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={logoSrc} alt="Uploaded logo" className="max-w-full max-h-full object-contain" />
                        </div>
                        <div>
                          <div className="font-bold text-foreground truncate max-w-[200px]">{logoName || 'Custom Logo'}</div>
                          <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                            <Check className="w-3 h-3" />
                            <span>Embedded in QR center</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleMatchColorsFromLogo}
                          disabled={isExtractingColor}
                          className="text-[11px] font-semibold"
                          title="Extract and apply color palette from this logo"
                        >
                          <Wand2 className="w-3.5 h-3.5 mr-1 text-primary" />
                          <span>{isExtractingColor ? 'Matching…' : 'Match Palette'}</span>
                        </Button>

                        <button
                          type="button"
                          onClick={handleClearLogo}
                          className="p-2 text-muted-foreground hover:text-error hover:bg-error/10 rounded-lg transition cursor-pointer"
                          title="Remove logo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-6 rounded-lg border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 cursor-pointer text-center ${
                        isDragOver
                          ? 'border-primary bg-primary/10 scale-[1.01]'
                          : 'border-border/80 bg-muted/30 hover:bg-muted/60 hover:border-primary/50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="font-bold text-foreground">Click to upload or drag &amp; drop</div>
                        <div className="text-[11px] text-muted-foreground">PNG, JPG, JPEG, SVG or WEBP (up to 5MB)</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Color Extracted Notification Toast */}
                {colorExtractedToast && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                    <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Palette matched! QR code foreground and background updated to match your logo.</span>
                  </div>
                )}

                {/* Quick-Pick Popular Brand Logos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-semibold text-foreground">Or pick a popular brand icon</label>
                    <span className="text-[10px] text-muted-foreground">One-click icons</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {PRESET_BRAND_LOGOS.map((brand) => (
                      <button
                        type="button"
                        key={brand.id}
                        onClick={() => handleApplyPresetLogo(brand)}
                        className={`p-2 rounded-lg border flex items-center gap-2 transition cursor-pointer text-left ${
                          logoName === brand.name
                            ? 'border-primary bg-primary/10 text-foreground font-bold shadow-xs'
                            : 'border-border/60 bg-background hover:bg-muted/60 text-muted-foreground'
                        }`}
                      >
                        <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={brand.svgDataUri} alt={brand.name} className="w-4 h-4 object-contain" />
                        </div>
                        <span className="text-[11px] truncate">{brand.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logo Customization Sliders (only visible when logo is present) */}
                {logoSrc && (
                  <div className="p-4 rounded-lg bg-muted/40 border border-border/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Logo Proportion</span>
                      <span className="font-mono text-primary font-bold">{logoSizePercent}% of QR code</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="32"
                      value={logoSizePercent}
                      onChange={(e) => setLogoSizePercent(Number(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <label className="text-[11px] text-muted-foreground flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={excavateLogo}
                          onChange={(e) => setExcavateLogo(e.target.checked)}
                          className="rounded text-primary accent-primary"
                        />
                        <span>Excavate Background (Clears QR pixels behind logo for clarity)</span>
                      </label>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* TAB CONTENT: COLOR THEMES & PRESETS */}
            {activeStudioTab === 'design' && (
              <div className="space-y-5 animate-fade-in text-xs">
                
                {/* Amazing Preset Themes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-semibold text-foreground">Curated Amazing Themes</label>
                    <span className="text-[10px] text-muted-foreground">High-contrast tested</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {QR_THEME_PRESETS.map((preset) => {
                      const isSelected = selectedThemeId === preset.id;
                      return (
                        <button
                          type="button"
                          key={preset.id}
                          onClick={() => handleApplyTheme(preset)}
                          className={`p-3 rounded-lg border text-left transition-all cursor-pointer relative ${
                            isSelected
                              ? 'border-primary ring-2 ring-primary/30 shadow-xs'
                              : 'border-border/60 hover:border-primary/40'
                          }`}
                          style={{ backgroundColor: preset.bgColor }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span 
                              className="text-[10px] font-bold uppercase tracking-wider"
                              style={{ color: preset.fgColor }}
                            >
                              {preset.name}
                            </span>
                            <div 
                              className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                              style={{ backgroundColor: preset.fgColor }}
                            />
                          </div>
                          <div 
                            className="text-[9px] line-clamp-1 opacity-80"
                            style={{ color: preset.fgColor }}
                          >
                            {preset.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fine-Tuned Color Pickers */}
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="p-3.5 rounded-lg bg-muted/40 border border-border/40">
                    <label className="block text-xs font-semibold text-foreground mb-2">QR Code Modules (Foreground)</label>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="color"
                        value={fgColor}
                        onChange={(e) => {
                          setFgColor(e.target.value);
                          setSelectedThemeId('custom');
                        }}
                        className="w-9 h-9 rounded-lg border border-border/60 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={fgColor}
                        onChange={(e) => {
                          setFgColor(e.target.value);
                          setSelectedThemeId('custom');
                        }}
                        className="w-24 px-2 py-1 bg-background border border-border/60 rounded-md font-mono text-xs uppercase text-foreground"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-muted/40 border border-border/40">
                    <label className="block text-xs font-semibold text-foreground mb-2">Background Canvas</label>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => {
                          setBgColor(e.target.value);
                          setSelectedThemeId('custom');
                        }}
                        className="w-9 h-9 rounded-lg border border-border/60 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={bgColor}
                        onChange={(e) => {
                          setBgColor(e.target.value);
                          setSelectedThemeId('custom');
                        }}
                        className="w-24 px-2 py-1 bg-background border border-border/60 rounded-md font-mono text-xs uppercase text-foreground"
                      />
                    </div>
                  </div>
                </div>

                {/* Error Correction Level */}
                <div className="p-3.5 rounded-lg bg-muted/40 border border-border/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Error Correction Level</span>
                    <Badge variant="primary" className="text-[10px]">
                      {errorLevel === 'H' ? '30% (Best with Logo)' : errorLevel === 'Q' ? '25%' : errorLevel === 'M' ? '15%' : '7%'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(['L', 'M', 'Q', 'H'] as const).map(lvl => (
                      <button
                        type="button"
                        key={lvl}
                        onClick={() => setErrorLevel(lvl)}
                        className={`py-1.5 rounded-lg font-bold text-xs border transition cursor-pointer ${
                          errorLevel === lvl
                            ? 'bg-primary text-on-primary border-primary shadow-xs'
                            : 'bg-background text-muted-foreground border-border/60 hover:text-foreground'
                        }`}
                      >
                        {lvl} {lvl === 'H' && '★'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Level H provides up to 30% error recovery, ensuring your QR remains easily scannable even with an image placed in the center.
                  </p>
                </div>

              </div>
            )}

            {/* TAB CONTENT: CARD FRAMING */}
            {activeStudioTab === 'frame' && (
              <div className="space-y-5 animate-fade-in text-xs">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-semibold text-foreground">Call-to-Action Frames</label>
                    <span className="text-[10px] text-muted-foreground">Print &amp; display styles</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: 'none', label: 'No Frame (Clean)', icon: QrCode },
                      { id: 'bottom-badge', label: 'Bottom "SCAN ME"', icon: Layers },
                      { id: 'top-header', label: 'Top Header Banner', icon: Layout },
                      { id: 'phone-mockup', label: 'Smartphone Mockup', icon: Smartphone },
                      { id: 'glass-card', label: 'Glass Poster Card', icon: Sparkles }
                    ].map(f => {
                      const Icon = f.icon;
                      const isSelected = frameStyle === f.id;
                      return (
                        <button
                          type="button"
                          key={f.id}
                          onClick={() => setFrameStyle(f.id as QrFrameStyle)}
                          className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-2 text-center transition cursor-pointer ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                              : 'border-border/60 bg-background hover:bg-muted/60 text-muted-foreground'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-[11px]">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {frameStyle !== 'none' && (
                  <div className="p-4 rounded-lg bg-muted/40 border border-border/40 space-y-2">
                    <label className="font-semibold text-foreground block">Call-to-Action Banner Text</label>
                    <input
                      type="text"
                      value={frameCtaText}
                      onChange={(e) => setFrameCtaText(e.target.value)}
                      placeholder="e.g. SCAN ME or ORDER NOW"
                      className="w-full h-10 px-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs font-bold uppercase tracking-wider text-foreground outline-none"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] text-muted-foreground self-center mr-1">Quick text:</span>
                      {['SCAN ME', 'SCAN FOR MENU', 'ORDER NOW', 'JOIN WIFI', 'CONNECT WITH US'].map(txt => (
                        <button
                          type="button"
                          key={txt}
                          onClick={() => setFrameCtaText(txt)}
                          className="px-2 py-0.5 rounded-md bg-background border border-border/60 hover:bg-muted text-[10px] font-medium text-foreground transition cursor-pointer"
                        >
                          {txt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </Card>

        </div>

        {/* Right Column: Live Interactive Preview & Export Studio (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6 shadow-sm flex flex-col items-center justify-center text-center space-y-6 sticky top-6">
            
            <div className="w-full flex items-center justify-between pb-3 border-b border-border/40">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Live Interactive Preview</span>
              </span>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Size:</span>
                <span className="font-mono text-xs text-primary font-bold">{qrSize}px</span>
              </div>
            </div>

            {/* Framed QR Code Stage */}
            <div className="w-full flex items-center justify-center py-4 overflow-hidden">
              
              {/* Card Container based on selected Frame */}
              <div 
                id="qr-preview-container"
                className={`transition-all relative flex flex-col items-center justify-center max-w-full ${
                  frameStyle === 'none'
                    ? 'p-5 rounded-xl shadow-lg border border-border/60'
                    : frameStyle === 'bottom-badge'
                    ? 'p-6 rounded-xl shadow-xl border border-border/60 space-y-4'
                    : frameStyle === 'top-header'
                    ? 'p-6 rounded-xl shadow-xl border border-border/60 space-y-4'
                    : frameStyle === 'phone-mockup'
                    ? 'p-6 rounded-xl shadow-2xl border-4 space-y-4'
                    : 'p-6 rounded-xl shadow-xl backdrop-blur-md border border-border/60 space-y-3'
                }`}
                style={{
                  backgroundColor: bgColor,
                  borderColor: frameStyle === 'phone-mockup' ? fgColor : undefined
                }}
              >
                {/* Phone Mockup Speaker Pill */}
                {frameStyle === 'phone-mockup' && (
                  <div 
                    className="w-16 h-2 rounded-full mb-1 opacity-60" 
                    style={{ backgroundColor: fgColor }} 
                  />
                )}

                {/* Top Header CTA Banner */}
                {frameStyle === 'top-header' && (
                  <div 
                    className="text-xs font-black uppercase tracking-wider px-4 py-1 rounded-full shadow-xs max-w-full truncate"
                    style={{ backgroundColor: fgColor, color: bgColor }}
                  >
                    {frameCtaText || 'SCAN WITH CAMERA'}
                  </div>
                )}

                {/* SVG Rendered QR Code */}
                <div className="relative inline-block max-w-full overflow-hidden [&>svg]:max-w-full [&>svg]:h-auto">
                  <QRCodeSVG
                    id="qr-code-svg"
                    value={activeQrValue}
                    size={qrSize}
                    fgColor={fgColor}
                    bgColor={bgColor}
                    level={errorLevel}
                    marginSize={1}
                    imageSettings={
                      logoSrc
                        ? {
                            src: logoSrc,
                            height: calculatedLogoSize,
                            width: calculatedLogoSize,
                            excavate: excavateLogo,
                          }
                        : undefined
                    }
                  />
                </div>

                {/* Bottom Badge CTA Banner */}
                {frameStyle === 'bottom-badge' && (
                  <div 
                    className="px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest shadow-md transition-all"
                    style={{ backgroundColor: fgColor, color: bgColor }}
                  >
                    {frameCtaText || 'SCAN ME'}
                  </div>
                )}

                {/* Glass Card Footer Details */}
                {frameStyle === 'glass-card' && (
                  <div className="pt-1 text-center">
                    <div className="text-xs font-bold tracking-tight" style={{ color: fgColor }}>
                      {sourceMode === 'link' ? (selectedLink?.title || 'TinyURL Link') : 'Direct QR Scan'}
                    </div>
                    <div className="text-[10px] opacity-75 font-mono truncate max-w-[200px]" style={{ color: fgColor }}>
                      {activeQrValue}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Target Value & Quick Copy Bar */}
            <div className="w-full max-w-sm p-2.5 rounded-lg bg-muted/50 border border-border/40 flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-primary font-bold truncate max-w-[240px]">
                {activeQrValue}
              </span>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition cursor-pointer shrink-0"
                title="Copy Destination URL"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Resolution Slider */}
            <div className="w-full space-y-1.5 text-xs text-left">
              <div className="flex items-center justify-between text-muted-foreground font-semibold">
                <span>Preview Display Scale</span>
                <span>{qrSize}px</span>
              </div>
              <input
                type="range"
                min="180"
                max="320"
                step="20"
                value={qrSize}
                onChange={(e) => setQrSize(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            {/* Multi-Format Export Action Buttons */}
            <div className="w-full space-y-2.5 pt-2">
              <Button
                type="button"
                onClick={() => handleDownloadPng(4)}
                size="lg"
                disabled={isDownloading}
                className="w-full text-xs font-bold py-2.5 shadow-md flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>{isDownloading ? 'Rendering High-Res PNG…' : 'Download High-Res PNG (Print Ready)'}</span>
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadSvg}
                  className="text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5 mr-1 text-primary" />
                  <span>Vector SVG</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyImageToClipboard}
                  className="text-xs font-semibold"
                >
                  {copiedImage ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1 text-primary" />
                      <span>Copy Image</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

          </Card>
        </div>

      </div>

    </div>
  );
};
