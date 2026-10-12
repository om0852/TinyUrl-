'use client';

import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

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

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const ogUrl = `${appUrl}/api/og?title=${encodeURIComponent(customTitle)}&slug=lmk.to/${encodeURIComponent(shortCode)}&theme=${theme}&clicks=24.8k`;

  const handleCopyOgUrl = () => {
    navigator.clipboard.writeText(ogUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-card border border-border/60 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-5 text-foreground z-10 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Dynamic OpenGraph Social Card Studio
              </h3>
              <p className="text-xs text-muted-foreground">
                Preview and customize social card for <code className="text-primary font-mono font-semibold">/{shortCode}</code>
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
              className="w-full h-10 px-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
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
                      ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25'
                      : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted'
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
            <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-lg border border-border/40">
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

          <div className="rounded-xl border border-border/60 overflow-hidden bg-background">
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
    </div>
  );
};
