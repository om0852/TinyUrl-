'use client';

import React, { useEffect } from 'react';
import { X, ExternalLink, QrCode, ArrowUpRight } from 'lucide-react';
import { Button } from './button';
import { StatusBadge } from './StatusBadge';
import { Link as LinkType } from '@/lib/types';

interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  link: LinkType | null;
  onDownloadQr?: () => void;
  onConfigureRules?: () => void;
}

export const SlideOver: React.FC<SlideOverProps> = ({
  isOpen,
  onClose,
  link,
  onDownloadQr,
  onConfigureRules,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !link) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#00000A73] backdrop-blur-[5px] transition-opacity animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <aside className="w-screen max-w-md bg-surface-container-lowest shadow-2xl p-6 flex flex-col justify-between border-l-[0.5px] border-outline-variant overflow-y-auto animate-slide-left">
          
          <div className="flex flex-col gap-6">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant">
              <div className="flex items-center gap-2.5">
                <StatusBadge variant="active" dot>200 OK</StatusBadge>
                <span className="font-semibold text-sm text-on-surface font-mono truncate max-w-[200px]">
                  {link.custom_slug || link.short_code}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={link.destination_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                  title="Open destination"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                  title="Close inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Destination & Latency Cards */}
            <div className="grid grid-cols-1 gap-3">
              <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-1 border border-outline-variant">
                <span className="text-xs text-on-surface-variant font-medium">Redirect Destination</span>
                <a 
                  href={link.destination_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-primary-ink truncate font-semibold hover:underline flex items-center gap-1"
                >
                  <span className="truncate">{link.destination_url}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                </a>
                <span className="text-[11px] text-on-surface-variant mt-0.5">301 Permanent Redirect</span>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-1 border border-outline-variant">
                <span className="text-xs text-on-surface-variant font-medium">Latency at Edge</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-primary-ink tracking-tight">12.4 ms</span>
                  <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">p99 optimal</span>
                </div>
                <span className="text-[11px] text-on-surface-variant">Global Edge Point Routing</span>
              </div>
            </div>

            {/* Telemetry Mini Chart */}
            <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-3 border border-outline-variant">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface">Live Click Velocity</span>
                <span className="font-mono text-xs text-primary-ink font-medium">
                  {link.clicks_count || 0} total clicks
                </span>
              </div>
              
              <div className="h-24 w-full flex items-end">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 400 80">
                  <defs>
                    <linearGradient id="chartGradientDrawer" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#65A30D" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#65A30D" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M 0,60 Q 50,75 100,50 T 200,30 T 300,45 T 400,10 L 400,80 L 0,80 Z" fill="url(#chartGradientDrawer)" />
                  <path d="M 0,60 Q 50,75 100,50 T 200,30 T 300,45 T 400,10" fill="none" stroke="#65A30D" strokeWidth="2.5" />
                </svg>
              </div>

              <div className="flex items-center justify-between font-mono text-[11px] text-on-surface-variant">
                <span>00:00 UTC</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span className="text-primary-ink font-bold">Live</span>
              </div>
            </div>

            {/* Link Metadata details */}
            <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-2 border-[0.5px] border-outline-variant text-xs">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Created</span>
                <span className="font-mono text-on-surface">{new Date(link.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Status</span>
                <span className="capitalize font-semibold text-emerald-600">{link.status}</span>
              </div>
              {link.tags && link.tags.length > 0 && (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {link.tags.map((t: string) => (
                    <span key={t} className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant font-mono text-[10px]">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Drawer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t-[0.5px] border-outline-variant mt-6">
            {onDownloadQr && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onDownloadQr}
              >
                <QrCode className="w-3.5 h-3.5 mr-1.5" />
                QR Code
              </Button>
            )}
            {onConfigureRules && (
              <Button
                variant="primary"
                size="sm"
                onClick={onConfigureRules}
              >
                Configure Fallback Rules
              </Button>
            )}
          </div>

        </aside>
      </div>
    </div>
  );
};
