'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/lib/storeContext';
import { 
  LayoutDashboard,
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
  LogOut,
  Users,
  Building2
} from 'lucide-react';
import { CreateTeamModal } from './CreateTeamModal';

export type TabType = 
  | 'overview' 
  | 'links' 
  | 'analytics' 
  | 'routing' 
  | 'qr' 
  | 'security' 
  | 'campaigns' 
  | 'clients'
  | 'teams'
  | 'ai' 
  | 'api' 
  | 'bulk'
  | 'settings';

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
  onOpenCreateModal: _onOpenCreateModal,
  className = '',
  onCloseMobile
}) => {
  const { currentWorkspace, workspaces, setCurrentWorkspace, links, clients, currentUser, incomingInvitations, logout } = useStore();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);

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

  const primaryNavItems: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string | number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'links', label: 'Links', icon: Link2, badge: links.length },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'qr', label: 'QR Codes', icon: QrCode },
    { id: 'routing', label: 'Routing', icon: Smartphone, badge: 'Smart' },
    { id: 'campaigns', label: 'Campaigns', icon: FolderKanban },
    { id: 'clients', label: 'Clients', icon: Building2, badge: clients.length > 0 ? clients.length : undefined },
    { id: 'teams', label: 'Teams & Workspaces', icon: Users, badge: incomingInvitations.length > 0 ? `${incomingInvitations.length} new` : undefined },
    { id: 'bulk', label: 'Bulk Tools', icon: Layers },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'ai', label: 'AI Slugs & Bio', icon: Sparkles },
    { id: 'api', label: 'API & Webhooks', icon: Code2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className={`fixed left-0 top-0 h-full w-64 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-outline-variant/30 z-50 flex flex-col justify-between py-4 select-none ${className}`}>
      
      {/* Top Section */}
      <div className="flex flex-col flex-1 min-h-0">
        
        {/* Brand Bar matching reference HTML */}
        <div 
          onClick={() => handleNavClick('overview')}
          className="h-14 px-6 flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <img 
            alt="Snip Creator Logo" 
            className="h-8 w-8 rounded-lg object-contain transition-transform group-hover:scale-105 shadow-2xs" 
            src="/senior_brand_identity_designer._1024x1024_production_app_store_icon_for_snip.png"
          />
          <span className="text-xl font-bold tracking-tight text-on-surface">
            Snip
          </span>
          <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-surface-container-high text-primary-container">
            Pro
          </span>
        </div>

        {/* Workspace Switcher */}
        <div className="px-4 py-2 relative shrink-0">
          <button
            onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
            className="w-full justify-between h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center text-left transition cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-md bg-surface-container-highest text-primary-container flex items-center justify-center text-[11px] font-bold shrink-0">
                {currentWorkspace.name.charAt(0) || 'W'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-on-surface truncate leading-tight">
                  {currentWorkspace?.name || "Workspace"}
                </p>
              </div>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-on-surface-variant group-hover:text-on-surface shrink-0 transition" />
          </button>

          {/* Workspace Dropdown */}
          {workspaceMenuOpen && (
            <div className="absolute top-[50px] left-4 right-4 bg-surface-container-lowest border border-outline-variant/40 rounded-lg shadow-xl py-1.5 z-50 animate-fade-in">
              <div className="px-3 py-1 text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
                Switch Workspace
              </div>
              <div className="max-h-40 overflow-y-auto">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      setCurrentWorkspace(ws);
                      setWorkspaceMenuOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-surface-container-low text-on-surface flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="truncate">{ws.name}</span>
                    {ws.id === currentWorkspace.id && (
                      <Check className="w-3.5 h-3.5 text-primary-container shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-1 mt-1 border-t border-outline-variant/20 px-1">
                <button
                  onClick={() => {
                    setWorkspaceMenuOpen(false);
                    setCreateWorkspaceOpen(true);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold text-primary-container hover:bg-surface-container-low rounded-lg flex items-center gap-2 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Workspace</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Navigation List */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 min-h-0 px-4 py-2 overflow-y-auto space-y-4"
        >
          {/* Main Reference Tabs */}
          <nav className="flex flex-col gap-1">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                    isActive
                      ? 'bg-surface-container-high text-primary-container font-semibold shadow-xs'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary-container' : 'text-on-surface-variant'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono font-semibold whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-primary-container text-on-primary'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Footer Profile Pill matching reference HTML */}
      <div className="px-4 shrink-0 pt-2">
        <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between gap-3 border border-outline-variant/30 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-outline-variant/40 shadow-xs">
              {currentUser?.avatar || (currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U')}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-on-surface truncate">
                {currentUser?.name || "My Account"}
              </span>
              <span className="text-[11px] text-on-surface-variant truncate">
                {currentWorkspace?.plan ? `${currentWorkspace.plan.toUpperCase()} Plan` : 'Pro Plan'}
              </span>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Sign Out"
            className="p-1.5 text-on-surface-variant hover:text-error hover:bg-surface-container transition-colors rounded-lg cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Create Workspace Modal */}
      <CreateTeamModal
        isOpen={createWorkspaceOpen}
        onClose={() => setCreateWorkspaceOpen(false)}
      />

    </aside>
  );
};
