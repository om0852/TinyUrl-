'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/lib/storeContext';
import { 
  Link2, 
  BarChart3, 
  Smartphone, 
  QrCode, 
  FolderKanban, 
  Sparkles, 
  ShieldCheck, 
  Code2, 
  Layers, 
  Plus, 
  ChevronsUpDown, 
  Check, 
  Settings, 
  Headphones, 
  LogOut, 
  Sun, 
  Moon,
  Radio,
  Server
} from 'lucide-react';
import { CreateTeamModal } from './CreateTeamModal';
import { Badge } from './ui/badge';

export type TabType = 
  | 'overview' 
  | 'links' 
  | 'analytics' 
  | 'routing' 
  | 'qr' 
  | 'security' 
  | 'campaigns' 
  | 'ai' 
  | 'api' 
  | 'bulk';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenCreateModal: () => void;
  className?: string;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  onOpenCreateModal,
  className = '',
  onCloseMobile
}) => {
  const { currentWorkspace, workspaces, setCurrentWorkspace, links, currentUser, logout } = useStore();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Scroll state preservation
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  const handleNavClick = (tab: TabType) => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
    setActiveTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  useEffect(() => {
    if (scrollContainerRef.current && scrollPositionRef.current) {
      scrollContainerRef.current.scrollTop = scrollPositionRef.current;
    }
  }, [activeTab]);

  const navGroups = [
    {
      label: 'Platform',
      items: [
        { id: 'overview', label: 'Links & Overview', icon: Link2, badge: links.length },
        { id: 'routing', label: 'OpeninApp & Routing', icon: Smartphone, badge: 'Smart' },
        { id: 'qr', label: 'QR Code Studio', icon: QrCode },
        { id: 'campaigns', label: 'Campaigns & UTM', icon: FolderKanban },
        { id: 'bulk', label: 'Bulk Shortener', icon: Layers },
      ]
    },
    {
      label: 'Security & Intelligence',
      items: [
        { id: 'security', label: 'Security & Scanner', icon: ShieldCheck, badge: 'Zero-Phish' },
        { id: 'ai', label: 'AI Slug & Insights', icon: Sparkles },
        { id: 'analytics', label: 'Usage & Analytics', icon: BarChart3 },
      ]
    },
    {
      label: 'Configuration & Dev',
      items: [
        { id: 'api', label: 'API & Developer', icon: Code2 },
      ]
    }
  ];

  return (
    <aside className={`w-64 h-full bg-card border-r border-border/40 flex flex-col justify-between select-none ${className}`}>
      
      {/* 1. Brand Bar (h-14 flex items-center px-6 border-b border-border/40) */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-border/40 shrink-0">
        <div 
          onClick={() => handleNavClick('overview')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-md shadow-primary/25 transition-transform group-hover:scale-105">
            <Link2 className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold tracking-tight text-foreground">
              TinyURL<span className="text-primary">.app</span>
            </span>
            <Badge variant="primary" className="text-[9px] px-1.5 py-0 font-mono">
              V2
            </Badge>
          </div>
        </div>
      </div>

      {/* 2. Workspace Switcher (p-4 pb-2) */}
      <div className="p-4 pb-2 relative shrink-0">
        <button
          onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
          className="w-full justify-between h-10 px-3 rounded-lg border border-border/60 bg-background/50 hover:bg-background text-foreground flex items-center text-left transition cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-md bg-muted border border-border/40 text-foreground flex items-center justify-center text-xs font-bold shrink-0">
              {currentWorkspace.name.charAt(0) || 'W'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate leading-tight">
                {currentWorkspace.name || "Default Workspace"}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider leading-tight">
                {currentWorkspace.plan || "PRO"} TIER
              </p>
            </div>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0 transition" />
        </button>

        {/* Dropdown Popover */}
        {workspaceMenuOpen && (
          <div className="absolute top-[54px] left-4 right-4 bg-card border border-border/60 rounded-xl shadow-xl py-1.5 z-50 animate-fade-in backdrop-blur-xl">
            <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Switch Workspace
            </div>
            <div className="max-h-48 overflow-y-auto">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setCurrentWorkspace(ws);
                    setWorkspaceMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-muted text-foreground flex items-center justify-between transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-primary/60 shrink-0" />
                    <span className="truncate">{ws.name}</span>
                  </div>
                  {ws.id === currentWorkspace.id && (
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>

            <div className="pt-1.5 mt-1 border-t border-border/40 px-1">
              <button
                onClick={() => {
                  setWorkspaceMenuOpen(false);
                  setCreateWorkspaceOpen(true);
                }}
                className="w-full px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-md flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Workspace</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Button */}
      <div className="px-4 pb-2 shrink-0">
        <button
          onClick={onOpenCreateModal}
          className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Short Link</span>
        </button>
      </div>

      {/* 3. Scrollable Navigation Area (flex-1 min-h-0 px-4 py-2) */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 min-h-0 px-4 py-2 overflow-y-auto space-y-4"
      >
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <h4 className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {group.label}
            </h4>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id as TabType)}
                    className={`w-full h-8.5 px-3 rounded-md text-sm font-medium flex items-center justify-between transition text-left cursor-pointer ${
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-semibold tracking-wide ${
                        isActive
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted/60 text-muted-foreground'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 4. User Footer Bar (p-4 border-t border-border/40 bg-zinc-50/50 dark:bg-zinc-900/50) */}
      <div className="p-4 border-t border-border/40 bg-muted/20 shrink-0 relative">
        {currentUser ? (
          <div className="flex items-center justify-between gap-2">
            <div 
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1 group"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                {currentUser.avatar || currentUser.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate leading-tight group-hover:text-primary transition">
                  {currentUser.name}
                </p>
                <p className="text-xs text-muted-foreground truncate leading-tight font-mono">
                  {currentUser.email}
                </p>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Guest Session</p>
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      <CreateTeamModal
        isOpen={createWorkspaceOpen}
        onClose={() => setCreateWorkspaceOpen(false)}
      />

    </aside>
  );
};
