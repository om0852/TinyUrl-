'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/storeContext';
import { getShortUrlPrefix } from '@/lib/db';
import {
  QrCode,
  Download,
  Copy,
  Check,
  Upload,
  Trash2,
  Wand2,
  Layout,
  Layers,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
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

  // The link's own verified domain; links on the platform (or an unverified domain) use this host.
  // domains[0] was used before, which put a custom domain in the QR of platform links.
  const linkHost = (l: typeof links[0]) =>
    domains.find(d => d.id === l.domain_id && d.verified && d.id !== 'dom_platform')?.hostname || originDomain;

  // Target URL value encoded in QR
  const activeQrValue = sourceMode === 'link'
    ? (selectedLink ? `${getShortUrlPrefix(linkHost(selectedLink))}/${selectedLink.custom_slug || selectedLink.short_code}` : defaultDomainUrl)
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
        totalHeight += 48 * multiplier;
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
      // Top banner: a filled pill like the preview
      if (frameStyle === 'top-header') {
        const label = frameCtaText || 'SCAN WITH CAMERA';
        ctx.font = `bold ${13 * multiplier}px sans-serif`;
        const pillW = Math.min(totalWidth - 32 * multiplier, ctx.measureText(label).width + 36 * multiplier);
        const pillH = 30 * multiplier;
        ctx.fillStyle = fgColor;
        ctx.beginPath();
        ctx.roundRect((totalWidth - pillW) / 2, padding - 12 * multiplier, pillW, pillH, pillH / 2);
        ctx.fill();
        ctx.fillStyle = bgColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, totalWidth / 2, padding - 12 * multiplier + pillH / 2);
        qrOffsetY += 30 * multiplier;
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

      // Glass card: title and URL under the code, like the preview
      if (frameStyle === 'glass-card') {
        const textY = qrOffsetY + qrPixelSize + 20 * multiplier;
        ctx.fillStyle = fgColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${13 * multiplier}px sans-serif`;
        ctx.fillText(sourceMode === 'link' ? (selectedLink?.title || 'Scan to open') : 'Scan to open', totalWidth / 2, textY, totalWidth - 32 * multiplier);
        ctx.globalAlpha = 0.7;
        ctx.font = `${10 * multiplier}px monospace`;
        ctx.fillText(activeQrValue.replace(/^https?:\/\//, ''), totalWidth / 2, textY + 18 * multiplier, totalWidth - 32 * multiplier);
        ctx.globalAlpha = 1;
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
    return <SkeletonGenericView title="QR codes" />;
  }

  const segmented = (active: boolean) => `h-[26px] px-3 rounded-[4px] whitespace-nowrap transition-colors cursor-pointer inline-flex items-center gap-1.5 ${active ? 'bg-surface-container-lowest text-on-surface font-medium shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`;
  const input = 'w-full h-[34px] px-3 bg-surface-container-low rounded-md text-xs text-on-surface border-[0.5px] border-outline-variant outline-none focus:border-on-surface-variant';
  const label = 'block text-xs font-medium text-on-surface mb-1.5';
  const tile = (active: boolean) => `rounded-md border-[0.5px] transition-colors cursor-pointer ${active ? 'border-on-surface ring-1 ring-on-surface' : 'border-outline-variant hover:border-on-surface-variant'}`;
  const outlineBtn = 'h-[34px] px-3 rounded-md border-[0.5px] border-outline-variant text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-50';

  const SIZES = [{ px: 200, label: 'S' }, { px: 240, label: 'M' }, { px: 300, label: 'L' }];
  const FRAMES: { id: QrFrameStyle; label: string; icon: React.ElementType }[] = [
    { id: 'none', label: 'None', icon: QrCode },
    { id: 'bottom-badge', label: 'Badge', icon: Layers },
    { id: 'top-header', label: 'Banner', icon: Layout },
    { id: 'phone-mockup', label: 'Phone', icon: Smartphone },
    { id: 'glass-card', label: 'Card', icon: Sparkles },
  ];

  return (
    <div className="flex flex-col w-full gap-[15px] pb-16 animate-fade-in text-on-surface">

      {/* Hidden high-res canvas for raster exports */}
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
              ? { src: logoSrc, height: calculatedLogoSize * 4, width: calculatedLogoSize * 4, excavate: excavateLogo }
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[15px] items-start">

        {/* ── Controls ── */}
        <div className="lg:col-span-7 flex flex-col gap-[15px]">

          {/* Content */}
          <div className="rounded-xl border-[0.5px] border-outline-variant p-[15px] flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-semibold text-on-surface">Content</h2>
              <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs" role="tablist" aria-label="QR content">
                <button type="button" role="tab" aria-selected={sourceMode === 'link'} onClick={() => setSourceMode('link')} className={segmented(sourceMode === 'link')}>
                  Short link
                </button>
                <button type="button" role="tab" aria-selected={sourceMode === 'custom'} onClick={() => setSourceMode('custom')} className={segmented(sourceMode === 'custom')}>
                  URL or text
                </button>
              </div>
            </div>

            {sourceMode === 'link' ? (
              links.length > 0 ? (
                <select value={selectedLinkId} onChange={(e) => setSelectedLinkId(e.target.value)} aria-label="Short link" className={`${input} cursor-pointer`}>
                  {links.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.title || 'Untitled'} · /{l.custom_slug || l.short_code}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-on-surface-variant">No links yet. Use a URL instead, or create a link first.</p>
              )
            ) : (
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://example.com or any text"
                aria-label="URL or text"
                className={`${input} font-mono`}
              />
            )}
            {sourceMode === 'link' && selectedLink && (
              <p className="text-[11px] text-outline truncate" title={selectedLink.destination_url}>→ {selectedLink.destination_url}</p>
            )}
          </div>

          {/* Style */}
          <div className="rounded-xl border-[0.5px] border-outline-variant p-[15px] flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-semibold text-on-surface">Style</h2>
              <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs" role="tablist" aria-label="Style options">
                {([['design', 'Colors'], ['logo', 'Logo'], ['frame', 'Frame']] as const).map(([id, text]) => (
                  <button key={id} type="button" role="tab" aria-selected={activeStudioTab === id} onClick={() => setActiveStudioTab(id)} className={segmented(activeStudioTab === id)}>
                    {text}
                    {id === 'logo' && logoSrc && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            {activeStudioTab === 'design' && (
              <div className="flex flex-col gap-4 text-xs">
                <div>
                  <span className={label}>Theme</span>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {QR_THEME_PRESETS.map(preset => (
                      <button
                        type="button"
                        key={preset.id}
                        onClick={() => handleApplyTheme(preset)}
                        title={preset.name}
                        aria-label={preset.name}
                        aria-pressed={selectedThemeId === preset.id}
                        className={`${tile(selectedThemeId === preset.id)} aspect-square grid place-items-center`}
                        style={{ backgroundColor: preset.bgColor }}
                      >
                        <QrCode className="w-5 h-5" style={{ color: preset.fgColor }} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([['Code color', fgColor, setFgColor], ['Background', bgColor, setBgColor]] as const).map(([name, value, set]) => (
                    <div key={name}>
                      <span className={label}>{name}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={value}
                          onChange={(e) => { set(e.target.value); setSelectedThemeId('custom'); }}
                          aria-label={name}
                          className="size-[34px] rounded-md border-[0.5px] border-outline-variant cursor-pointer bg-transparent p-0.5"
                        />
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => { set(e.target.value); setSelectedThemeId('custom'); }}
                          aria-label={`${name} hex`}
                          className={`${input} font-mono uppercase`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-on-surface">Error correction</span>
                    <span className="text-[11px] text-outline">
                      {errorLevel === 'H' ? '30% · best with a logo' : errorLevel === 'Q' ? '25%' : errorLevel === 'M' ? '15%' : '7% · smallest code'}
                    </span>
                  </div>
                  <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs" role="tablist" aria-label="Error correction">
                    {(['L', 'M', 'Q', 'H'] as const).map(lvl => (
                      <button key={lvl} type="button" role="tab" aria-selected={errorLevel === lvl} onClick={() => setErrorLevel(lvl)} className={`${segmented(errorLevel === lvl)} w-10 justify-center`}>
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Logo */}
            {activeStudioTab === 'logo' && (
              <div className="flex flex-col gap-4 text-xs">
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" onChange={handleFileChange} className="hidden" />

                {logoSrc ? (
                  <div className="flex items-center gap-3 rounded-md border-[0.5px] border-outline-variant p-3">
                    <div className="size-[40px] rounded-md bg-surface-container-lowest border-[0.5px] border-outline-variant p-1 grid place-items-center shrink-0">
                      <img src={logoSrc} alt="" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-on-surface truncate">{logoName || 'Logo'}</div>
                      <div className="text-[11px] text-outline">In the center of the code</div>
                    </div>
                    <button type="button" onClick={handleMatchColorsFromLogo} disabled={isExtractingColor} className={outlineBtn} title="Use the logo's colors">
                      <Wand2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{isExtractingColor ? 'Matching…' : 'Match colors'}</span>
                    </button>
                    <button type="button" onClick={handleClearLogo} aria-label="Remove logo" title="Remove logo" className="size-[34px] rounded-md grid place-items-center text-on-surface-variant hover:text-error hover:bg-error-container transition-colors cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full py-6 rounded-md border border-dashed flex flex-col items-center gap-2 cursor-pointer transition-colors ${isDragOver ? 'border-on-surface bg-surface-container' : 'border-outline-variant hover:bg-surface-container-low'}`}
                  >
                    <Upload className="w-5 h-5 text-on-surface-variant" />
                    <span className="font-medium text-on-surface">Upload a logo</span>
                    <span className="text-[11px] text-outline">PNG, JPG, SVG or WEBP · drop it here or click</span>
                  </button>
                )}

                {colorExtractedToast && (
                  <p className="text-[11px] text-emerald-700 flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Colors matched to your logo.</p>
                )}

                <div>
                  <span className={label}>Or use an icon</span>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_BRAND_LOGOS.map(brand => (
                      <button
                        type="button"
                        key={brand.id}
                        onClick={() => handleApplyPresetLogo(brand)}
                        title={brand.name}
                        aria-label={brand.name}
                        aria-pressed={logoName === brand.name}
                        className={`${tile(logoName === brand.name)} size-[38px] grid place-items-center bg-surface-container-lowest`}
                      >
                        <img src={brand.svgDataUri} alt="" className="w-5 h-5 object-contain" />
                      </button>
                    ))}
                  </div>
                </div>

                {logoSrc && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-on-surface">Logo size</span>
                      <span className="text-[11px] text-outline tabular-nums">{logoSizePercent}%</span>
                    </div>
                    <input type="range" min="15" max="32" value={logoSizePercent} onChange={(e) => setLogoSizePercent(Number(e.target.value))} aria-label="Logo size" className="w-full accent-[var(--color-primary-strong)] cursor-pointer" />
                    <label className="flex items-center gap-2 text-[11px] text-on-surface-variant cursor-pointer">
                      <input type="checkbox" checked={excavateLogo} onChange={(e) => setExcavateLogo(e.target.checked)} className="w-3.5 h-3.5 accent-[var(--color-primary-strong)]" />
                      Clear the code behind the logo
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Frame */}
            {activeStudioTab === 'frame' && (
              <div className="flex flex-col gap-4 text-xs">
                <div className="grid grid-cols-5 gap-2">
                  {FRAMES.map(f => {
                    const Icon = f.icon;
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => setFrameStyle(f.id)}
                        aria-pressed={frameStyle === f.id}
                        className={`${tile(frameStyle === f.id)} py-3 flex flex-col items-center gap-1.5 bg-surface-container-lowest ${frameStyle === f.id ? 'text-on-surface font-medium' : 'text-on-surface-variant'}`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px]">{f.label}</span>
                      </button>
                    );
                  })}
                </div>

                {frameStyle !== 'none' && frameStyle !== 'glass-card' && (
                  <div>
                    <span className={label}>Frame text</span>
                    <input type="text" value={frameCtaText} onChange={(e) => setFrameCtaText(e.target.value)} placeholder="SCAN ME" aria-label="Frame text" className={`${input} uppercase`} />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {['SCAN ME', 'SCAN FOR MENU', 'ORDER NOW', 'JOIN WIFI'].map(txt => (
                        <button type="button" key={txt} onClick={() => setFrameCtaText(txt)} className={`h-[24px] px-2 rounded-full text-[11px] transition-colors cursor-pointer ${frameCtaText === txt ? 'bg-on-surface text-surface' : 'bg-surface-container text-on-surface-variant hover:text-on-surface'}`}>
                          {txt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Preview & export ── */}
        <div className="lg:col-span-5 lg:sticky lg:top-4 rounded-xl border-[0.5px] border-outline-variant overflow-hidden">
          <div className="px-[15px] py-3 flex items-center justify-between border-b-[0.5px] border-outline-variant">
            <h2 className="text-[14px] font-semibold text-on-surface">Preview</h2>
            <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs" role="tablist" aria-label="Size">
              {SIZES.map(sz => (
                <button key={sz.px} type="button" role="tab" aria-selected={qrSize === sz.px} onClick={() => setQrSize(sz.px)} title={`${sz.px}px`} className={`${segmented(qrSize === sz.px)} w-8 justify-center`}>
                  {sz.label}
                </button>
              ))}
            </div>
          </div>

          {/* Checkerboard-free neutral stage so light and dark codes both read */}
          <div className="bg-surface-container-low px-4 py-8 flex items-center justify-center overflow-hidden">
            <div
              id="qr-preview-container"
              className={`relative flex flex-col items-center gap-3 max-w-full shadow-sm ${frameStyle === 'phone-mockup' ? 'p-5 rounded-[22px] border-4' : 'p-5 rounded-xl'}`}
              style={{ backgroundColor: bgColor, borderColor: frameStyle === 'phone-mockup' ? fgColor : undefined }}
            >
              {frameStyle === 'phone-mockup' && <div className="w-14 h-1.5 rounded-full opacity-60" style={{ backgroundColor: fgColor }} />}

              {frameStyle === 'top-header' && (
                <div className="text-xs font-bold uppercase tracking-wider px-4 py-1 rounded-full max-w-full truncate" style={{ backgroundColor: fgColor, color: bgColor }}>
                  {frameCtaText || 'SCAN WITH CAMERA'}
                </div>
              )}

              <div className="relative inline-block max-w-full [&>svg]:max-w-full [&>svg]:h-auto">
                <QRCodeSVG
                  id="qr-code-svg"
                  value={activeQrValue}
                  size={qrSize}
                  fgColor={fgColor}
                  bgColor={bgColor}
                  level={errorLevel}
                  marginSize={1}
                  imageSettings={logoSrc ? { src: logoSrc, height: calculatedLogoSize, width: calculatedLogoSize, excavate: excavateLogo } : undefined}
                />
              </div>

              {frameStyle === 'bottom-badge' && (
                <div className="px-5 py-1.5 rounded-full font-bold text-xs uppercase tracking-widest max-w-full truncate" style={{ backgroundColor: fgColor, color: bgColor }}>
                  {frameCtaText || 'SCAN ME'}
                </div>
              )}

              {frameStyle === 'glass-card' && (
                <div className="text-center max-w-[220px]">
                  <div className="text-xs font-bold truncate" style={{ color: fgColor }}>
                    {sourceMode === 'link' ? (selectedLink?.title || 'Scan to open') : 'Scan to open'}
                  </div>
                  <div className="text-[10px] opacity-70 font-mono truncate" style={{ color: fgColor }}>
                    {activeQrValue.replace(/^https?:\/\//, '')}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-[15px] flex flex-col gap-3 border-t-[0.5px] border-outline-variant">
            <div className="flex items-center gap-2 h-[34px] px-3 rounded-md bg-surface-container-low border-[0.5px] border-outline-variant">
              <span className="flex-1 min-w-0 text-xs font-mono text-on-surface truncate" title={activeQrValue}>{activeQrValue}</span>
              <button type="button" onClick={handleCopyUrl} aria-label="Copy URL" title="Copy URL" className="p-1 rounded text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0">
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleDownloadPng(4)}
              disabled={isDownloading}
              className="h-[38px] rounded-md bg-primary-container text-on-primary text-xs font-medium hover:bg-primary transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {isDownloading ? 'Preparing…' : 'Download PNG'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={handleDownloadSvg} className={outlineBtn}>
                <Download className="w-3.5 h-3.5" /> SVG
              </button>
              <button type="button" onClick={handleCopyImageToClipboard} className={outlineBtn}>
                {copiedImage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedImage ? 'Copied' : 'Copy image'}
              </button>
            </div>
            <p className="text-[11px] text-outline text-center">PNG is print quality and includes the frame. SVG is the code only.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
