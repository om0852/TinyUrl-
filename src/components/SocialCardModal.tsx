'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/button';

interface SocialCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  linkTitle?: string;
  shortCode?: string;
}

export const SocialCardModal: React.FC<SocialCardModalProps> = ({
  isOpen,
  onClose,
  linkTitle = 'Enterprise Link Infrastructure',
  shortCode = 'spring-launch'
}) => {
  const [customTitle, setCustomTitle] = useState(linkTitle);
  const [theme, setTheme] = useState<'indigo' | 'emerald' | 'purple'>('indigo');
  const [previewPlatform, setPreviewPlatform] = useState<'x' | 'linkedin' | 'slack'>('x');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const originDomain = typeof window !== 'undefined' ? window.location.host : 'tinyurl.dev';
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tinyurl.dev';
  const ogUrl = `${appUrl}/api/og?title=${encodeURIComponent(customTitle)}&slug=${encodeURIComponent(originDomain)}/${encodeURIComponent(shortCode)}&theme=${theme}`;

  const handleCopyOgUrl = () => {
    navigator.clipboard.writeText(ogUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Portal to <body>: an ancestor with a transform or filter would otherwise trap this
  // fixed overlay inside the scrolling dashboard panel.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-card border-[0.5px] border-outline-variant w-full max-w-2xl rounded-xl p-5 shadow-2xl space-y-4 text-foreground z-10 max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary-ink flex items-center justify-center border border-primary-strong/20">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Dynamic OpenGraph Social Card Studio
              </h3>
              <p className="text-xs text-muted-foreground">
                Preview and customize social card for <code className="text-primary-ink font-mono font-semibold">/{shortCode}</code>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Customization Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-foreground font-semibold text-xs mb-1.5">Social Card Headline</label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full h-10 px-3 bg-background border-[0.5px] border-outline-variant focus:border-primary-strong rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-foreground font-semibold text-xs mb-1.5">Accent Color Palette</label>
            <div className="grid grid-cols-3 gap-2">
              {(['indigo', 'emerald', 'purple'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`h-10 rounded-lg border text-center font-bold capitalize text-xs transition cursor-pointer ${
                    theme === t
                      ? 'bg-primary text-primary-foreground border-primary-strong shadow-md shadow-primary/25'
                      : 'bg-muted/40 text-muted-foreground border-outline-variant hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Card Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span>Edge Rendering Preview</span>
            <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-lg border border-outline-variant">
              {(['x', 'linkedin', 'slack'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreviewPlatform(p)}
                  className={`px-2.5 py-0.5 rounded-md uppercase text-[10px] font-semibold transition cursor-pointer ${
                    previewPlatform === p
                      ? 'bg-card text-foreground shadow-2xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border-[0.5px] border-outline-variant overflow-hidden bg-background">
            <img
              src={ogUrl}
              alt="Social Card Preview"
              className="w-full h-auto aspect-[1200/630] object-cover"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            variant="outline"
            size="default"
            onClick={handleCopyOgUrl}
          >
            {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
            <span>{copied ? 'Copied URL' : 'Copy Image URL'}</span>
          </Button>

          <Button
            size="default"
            onClick={onClose}
          >
            Done
          </Button>
        </div>

      </div>
    </div>,
    document.body
  );
};
