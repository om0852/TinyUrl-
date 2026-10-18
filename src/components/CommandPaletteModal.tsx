'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/storeContext';
import { TabType } from './Sidebar';
import { 
  LayoutDashboard,
  Search, 
  Link2, 
  BarChart3, 
  Smartphone, 
  QrCode, 
  FolderKanban, 
  Sparkles, 
  Code2, 
  Layers, 
  Plus, 
  Copy, 
  Check, 
  ArrowRight,
  ShieldCheck,
  Settings,
  Users
} from 'lucide-react';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: TabType) => void;
  onOpenCreateModal: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenCreateModal
}) => {
  const { links, domains } = useStore();
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const navigationItems: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Workspace Overview (Dashboard)', icon: <LayoutDashboard className="w-4 h-4 text-primary" /> },
    { id: 'links', label: 'All Short Links (Directory)', icon: <Link2 className="w-4 h-4 text-primary" /> },
    { id: 'analytics', label: 'Usage & Analytics Engine', icon: <BarChart3 className="w-4 h-4 text-blue-500" /> },
    { id: 'routing', label: 'OpeninApp & Dynamic Routing', icon: <Smartphone className="w-4 h-4 text-emerald-500" /> },
    { id: 'qr', label: 'Dynamic QR Code Studio', icon: <QrCode className="w-4 h-4 text-primary" /> },
    { id: 'campaigns', label: 'Campaigns & UTM Tagging', icon: <FolderKanban className="w-4 h-4 text-amber-500" /> },
    { id: 'teams', label: 'Teams & Workspaces Collaboration', icon: <Users className="w-4 h-4 text-emerald-500" /> },
    { id: 'ai', label: 'AI Slug & Traffic Insights', icon: <Sparkles className="w-4 h-4 text-purple-400" /> },
    { id: 'security', label: 'Security & Zero-Phish Scanner', icon: <ShieldCheck className="w-4 h-4 text-emerald-500" /> },
    { id: 'settings', label: 'Workspace Settings & Profile', icon: <Settings className="w-4 h-4 text-indigo-500" /> },
    { id: 'api', label: 'API & Developer Keys', icon: <Code2 className="w-4 h-4 text-muted-foreground" /> },
    { id: 'bulk', label: 'Bulk Shortener', icon: <Layers className="w-4 h-4 text-primary" /> },
  ];

  const filteredNav = navigationItems.filter(item => 
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  const filteredLinks = links.filter(link => 
    link.title.toLowerCase().includes(query.toLowerCase()) ||
    link.short_code.toLowerCase().includes(query.toLowerCase()) ||
    link.destination_url.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);

  const handleCopy = (code: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const originHost = typeof window !== 'undefined' ? window.location.host : 'tinyurl.dev';
    const domain = domains[0]?.hostname || originHost;
    const full = `https://${domain}/${code}`;
    navigator.clipboard.writeText(full);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 px-3 sm:px-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />

      <div className="relative w-full max-w-xl bg-card border border-border/60 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[80vh] text-foreground">
        
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-border/40 gap-3 bg-muted/20">
          <Search className="w-4 h-4 text-primary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search links, or jump to view... (ESC to close)"
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted border border-border/60 rounded shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* Scrollable Results */}
        <div className="overflow-y-auto p-3 space-y-3 custom-scrollbar">
          
          {/* Quick Actions */}
          <div>
            <p className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Actions
            </p>
            <button
              onClick={() => {
                onClose();
                onOpenCreateModal();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-foreground hover:bg-muted transition group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="p-1 rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
                  <Plus className="w-3.5 h-3.5" />
                </span>
                <span>Create New Shortlink</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">⌘N</span>
            </button>
          </div>

          {/* Navigation Views */}
          {filteredNav.length > 0 && (
            <div>
              <p className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Navigate Console
              </p>
              <div className="space-y-0.5">
                {filteredNav.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigateTab(item.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-foreground hover:bg-muted transition text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matching Links */}
          {filteredLinks.length > 0 && (
            <div>
              <p className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Matching Resources
              </p>
              <div className="space-y-1">
                {filteredLinks.map((link) => {
                  const isCopied = copiedId === link.id;
                  return (
                    <div
                      key={link.id}
                      onClick={() => {
                        onNavigateTab('links');
                        onClose();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted transition text-left cursor-pointer group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {link.title}
                          </span>
                          <span className="font-mono text-[10px] text-primary">
                            /{link.short_code}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate font-mono">
                          {link.destination_url}
                        </p>
                      </div>

                      <button
                        onClick={(e) => handleCopy(link.short_code, link.id, e)}
                        className="px-2 py-1 rounded bg-muted/60 hover:bg-primary hover:text-primary-foreground text-[10px] font-mono text-muted-foreground transition shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
