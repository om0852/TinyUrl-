'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/storeContext';
import { getShortUrlPrefix } from '@/lib/db';
import { QrCode, Download, Palette, Copy, Check, Plus, ExternalLink, Link2, Globe, AlertCircle, Info } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface QrCodeViewProps {
  onNavigateTab?: (tab: string) => void;
  onOpenCreateModal?: () => void;
}

export const QrCodeView: React.FC<QrCodeViewProps> = ({ onNavigateTab, onOpenCreateModal }) => {
  const { links, domains } = useStore();
  
  // Source mode: 'link' (short link from workspace) or 'custom' (any direct URL / text)
  const [sourceMode, setSourceMode] = useState<'link' | 'custom'>('link');
  const [selectedLinkId, setSelectedLinkId] = useState<string>(links[0]?.id || '');
  const [customUrl, setCustomUrl] = useState<string>('https://snip.to');
  
  // Customization state
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [size, setSize] = useState(200);
  const [copied, setCopied] = useState(false);

  // Sync selectedLinkId if links list updates
  useEffect(() => {
    if (links.length > 0 && (!selectedLinkId || !links.some(l => l.id === selectedLinkId))) {
      setSelectedLinkId(links[0].id);
    }
  }, [links, selectedLinkId]);

  const selectedLink = links.find(l => l.id === selectedLinkId) || links[0];
  
  // Computed target URL for QR code
  const activeQrValue = sourceMode === 'link' 
    ? (selectedLink ? `${getShortUrlPrefix(domains[0]?.hostname)}/${selectedLink.short_code}` : '')
    : customUrl;

  const handleCopy = () => {
    if (!activeQrValue) return;
    navigator.clipboard.writeText(activeQrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    const svgElement = document.getElementById('qr-code-svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `qr_${sourceMode === 'link' ? (selectedLink?.short_code || 'code') : 'custom'}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="space-y-8 animate-fade-in text-foreground">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" /> Vector QR Code Generator Studio
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Generate high-density custom QR codes with color accents, error correction, and instant vector SVG export.
          </p>
        </div>

        <Badge variant="primary" className="px-3 py-1 text-xs">
          High-Density Vector
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Settings Panel */}
        <Card className="p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">QR Customization</h3>
            </div>
          </div>

          {/* Mode Switcher: Short Link vs Custom URL */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Destination Source</label>
            <div className="grid grid-cols-2 p-1 bg-muted/60 rounded-xl border border-border/60 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSourceMode('link')}
                className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  sourceMode === 'link'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Short Link ({links.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceMode('custom')}
                className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  sourceMode === 'custom'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Custom URL</span>
              </button>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {sourceMode === 'link' ? (
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Select Short Link</label>
                <select
                  value={selectedLinkId}
                  onChange={(e) => setSelectedLinkId(e.target.value)}
                  disabled={links.length === 0}
                  className={`w-full h-10 px-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs outline-none transition ${
                    links.length === 0
                      ? 'opacity-70 cursor-not-allowed bg-muted/40 text-muted-foreground'
                      : 'cursor-pointer text-foreground'
                  }`}
                >
                  {links.length === 0 ? (
                    <option value="" disabled>
                      No links found in workspace
                    </option>
                  ) : (
                    links.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.title || 'Untitled'} (/{l.short_code || l.custom_slug})
                      </option>
                    ))
                  )}
                </select>

                {/* Helpful empty state card when links are empty */}
                {links.length === 0 && (
                  <div className="mt-2.5 p-3 rounded-xl bg-muted/40 border border-border/60 flex flex-col gap-2.5">
                    <div className="flex items-start gap-2 text-xs text-muted-foreground leading-snug">
                      <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>
                        No short links have been created yet. Create your first link or switch to Custom URL mode.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                      {onOpenCreateModal && (
                        <button
                          type="button"
                          onClick={onOpenCreateModal}
                          className="px-2.5 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Create Link
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSourceMode('custom')}
                        className="px-2.5 py-1 text-xs font-semibold bg-background border border-border/60 text-foreground rounded-lg hover:bg-muted transition cursor-pointer"
                      >
                        Enter Custom URL
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Direct URL or Custom Content
                </label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://yourbrand.com/promo or enter any text..."
                  className="w-full h-10 px-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground outline-none font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Enter any web address or plain text to generate a vector QR code instantly.
                </p>
              </div>
            )}

            {/* Color Selectors */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Foreground Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-border/60 cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-xs text-foreground font-semibold">{fgColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-border/60 cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-xs text-foreground font-semibold">{bgColor}</span>
                </div>
              </div>
            </div>

            {/* Dimension Resolution Slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1.5">
                <span>Dimension Resolution</span>
                <span className="font-mono text-primary font-bold">{size}px</span>
              </div>
              <input
                type="range"
                min="160"
                max="320"
                step="20"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        </Card>

        {/* Live Preview Panel */}
        <Card className="lg:col-span-2 shadow-sm p-8 flex flex-col items-center justify-center text-center space-y-5">
          {activeQrValue ? (
            <>
              <div
                className="p-5 rounded-2xl shadow-md border border-border/60 transition-all inline-block"
                style={{ backgroundColor: bgColor }}
              >
                <QRCodeSVG
                  id="qr-code-svg"
                  value={activeQrValue}
                  size={size}
                  fgColor={fgColor}
                  bgColor={bgColor}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="space-y-1.5 max-w-sm">
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono uppercase">
                    {sourceMode === 'link' ? 'Short Link' : 'Custom Target'}
                  </Badge>
                  {sourceMode === 'link' && selectedLink?.title && (
                    <h4 className="text-sm font-semibold text-foreground truncate max-w-[200px]">
                      {selectedLink.title}
                    </h4>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-xs text-primary font-bold truncate max-w-[240px]">
                    {activeQrValue}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
                    title="Copy Target URL"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <Button
                onClick={handleDownloadSvg}
                size="lg"
                className="text-xs font-bold"
              >
                <Download className="w-4 h-4 mr-2" /> Download SVG Vector
              </Button>
            </>
          ) : (
            <div className="p-8 flex flex-col items-center justify-center text-center max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-4">
                <QrCode className="w-8 h-8 opacity-40" />
              </div>
              <h3 className="text-base font-bold text-foreground">No QR Code Target Selected</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                No short links are available in this workspace yet. Create a short link or switch to Custom URL mode to generate your QR code.
              </p>
              <div className="flex items-center gap-3 mt-4">
                {onOpenCreateModal && (
                  <Button onClick={onOpenCreateModal} size="sm" className="text-xs font-semibold">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Create Short Link
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSourceMode('custom')}
                  className="text-xs font-semibold"
                >
                  Use Custom URL
                </Button>
              </div>
            </div>
          )}
        </Card>

      </div>

    </div>
  );
};
