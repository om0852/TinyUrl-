'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { getShortUrlPrefix } from '@/lib/db';
import { QrCode, Download, Palette, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export const QrCodeView: React.FC = () => {
  const { links, domains } = useStore();
  const [selectedLinkId, setSelectedLinkId] = useState<string>(links[0]?.id || '');
  
  // Customization state
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [size, setSize] = useState(200);
  const [copied, setCopied] = useState(false);

  const selectedLink = links.find(l => l.id === selectedLinkId) || links[0];
  const shortUrl = selectedLink ? `${getShortUrlPrefix(domains[0]?.hostname)}/${selectedLink.short_code}` : getShortUrlPrefix(domains[0]?.hostname);

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl);
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
    downloadLink.download = `qr_${selectedLink?.short_code || 'code'}.svg`;
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
        <Card className="p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border/40">
            <Palette className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">QR Customization Options</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Select Short Link</label>
              <select
                value={selectedLinkId}
                onChange={(e) => setSelectedLinkId(e.target.value)}
                className="w-full h-10 px-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground outline-none cursor-pointer"
              >
                {links.map(l => (
                  <option key={l.id} value={l.id}>{l.title} (/{l.short_code})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Foreground</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-border/60 cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-xs text-foreground">{fgColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Background</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-border/60 cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-xs text-foreground">{bgColor}</span>
                </div>
              </div>
            </div>

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
          <div className="p-5 rounded-2xl shadow-md border border-border/60 transition-all inline-block" style={{ backgroundColor: bgColor }}>
            <QRCodeSVG
              id="qr-code-svg"
              value={shortUrl}
              size={size}
              fgColor={fgColor}
              bgColor={bgColor}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="space-y-1 max-w-sm">
            <h4 className="text-sm font-semibold text-foreground truncate">{selectedLink?.title}</h4>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-xs text-primary font-bold truncate">{shortUrl}</span>
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
                title="Copy Link"
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
        </Card>

      </div>

    </div>
  );
};
