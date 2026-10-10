'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { QrCode, Download, Palette, Sparkles, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export const QrCodeView: React.FC = () => {
  const { links, domains } = useStore();
  const [selectedLinkId, setSelectedLinkId] = useState<string>(links[0]?.id || '');
  
  // Customization state
  const [fgColor, setFgColor] = useState('#0f172a');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [size, setSize] = useState(240);
  const [copied, setCopied] = useState(false);

  const selectedLink = links.find(l => l.id === selectedLinkId) || links[0];
  const shortUrl = selectedLink ? `https://${domains[0]?.hostname || 'short.link'}/r/${selectedLink.short_code}` : 'https://short.link';

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
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <QrCode className="w-5 h-5 text-indigo-400" /> Vector QR Code Generator Studio
        </h1>
        <p className="text-xs text-slate-400">Generate high-density custom QR codes with color accents, brand logos, and instant vector SVG export</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Settings Panel */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Palette className="w-4 h-4 text-indigo-400" /> QR Customization Options
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Select Short Link</label>
              <select
                value={selectedLinkId}
                onChange={(e) => setSelectedLinkId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
              >
                {links.map(l => (
                  <option key={l.id} value={l.id}>{l.title} (/r/{l.short_code})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Foreground Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-slate-300">{fgColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-slate-300">{bgColor}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Resolution Dimension ({size}px)</label>
              <input
                type="range"
                min="160"
                max="360"
                step="20"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Live Preview Panel */}
        <div className="glass-panel p-8 rounded-2xl border border-white/10 lg:col-span-2 flex flex-col items-center justify-center text-center space-y-6">
          
          <div className="p-6 rounded-2xl shadow-2xl transition-all" style={{ backgroundColor: bgColor }}>
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

          <div className="space-y-1">
            <h4 className="text-base font-bold text-white">{selectedLink?.title}</h4>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-xs text-indigo-400 font-semibold">{shortUrl}</span>
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadSvg}
              className="px-6 py-2.5 gradient-button text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <Download className="w-4 h-4" /> Download SVG Vector
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
