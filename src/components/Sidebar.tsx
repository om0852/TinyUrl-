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
  Building2,
  X
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
  onOpenCreateModal,
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
    <aside className={`h-full w-full bg-surface-container-lowest flex flex-col justify-between py-[15px] select-none ${className}`}>
      
      {/* Top Section */}
      <div className="flex flex-col flex-1 min-h-0">
        
        {/* Brand Bar matching reference HTML */}
        <div className="h-[24px] mx-[13px] flex items-center justify-between gap-3 shrink-0">
          <div 
            onClick={() => handleNavClick('overview')}
            className="flex items-center gap-[7px] cursor-pointer group min-w-0"
          >
            <img 
              alt="TinyURL logo" 
              className="h-6 w-6 rounded-md object-contain" 
              src="/snip-logo.svg"
            />
            <span className="text-[16px] font-semibold text-on-surface truncate">
              TinyURL
            </span>
            <span className="text-[9px] uppercase font-semibold tracking-wider px-1.5 py-[1px] rounded-xs bg-primary-fixed text-on-secondary-container shrink-0">
              Pro
            </span>
          </div>

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition cursor-pointer shrink-0"
              title="Close navigation drawer"
              aria-label="Close navigation drawer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Workspace Switcher */}
        <div className="mx-[13px] mt-[12px] relative shrink-0">
          <button
            onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
            className={`w-full justify-between h-[34px] px-[7px] rounded-md border-[0.5px] ${workspaceMenuOpen ? "border-on-surface-variant" : "border-outline-variant"} bg-surface-container-low text-on-surface flex items-center text-left transition cursor-pointer group`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-full bg-outline text-white flex items-center justify-center text-[11px] font-medium uppercase shrink-0">
                {currentWorkspace.name.charAt(0) || 'W'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-on-surface truncate leading-tight">
                  {currentWorkspace?.name || "Workspace"}
                </p>
              </div>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-on-surface-variant group-hover:text-on-surface shrink-0 transition" />
          </button>

          {/* Workspace Dropdown */}
          {workspaceMenuOpen && (
            <div className="absolute top-[40px] left-0 right-0 bg-surface-container-lowest border-[0.5px] border-outline-variant rounded-xl shadow-md p-[6px] z-50 animate-fade-in">
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
                    className={`w-full px-[8px] py-[6px] rounded-md text-xs text-left text-on-surface flex items-center justify-between transition cursor-pointer ${ws.id === currentWorkspace.id ? "bg-primary-fixed/60" : "hover:bg-surface-container"}`}
                  >
                    <span className="truncate">{ws.name}</span>
                    {ws.id === currentWorkspace.id && (
                      <Check className="w-3.5 h-3.5 text-primary-ink shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-[6px] mt-[6px] border-t-[0.5px] border-outline-variant">
                <button
                  onClick={() => {
                    setWorkspaceMenuOpen(false);
                    setCreateWorkspaceOpen(true);
                  }}
                  className="w-full h-[30px] px-2.5 text-xs font-medium bg-inverse-surface text-white hover:bg-black rounded-md flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Workspace</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Primary action (Creatosaurus "Create New" position) */}
        <div className="mx-[13px] mt-[15px] mb-[5px] shrink-0">
          <button
            type="button"
            onClick={() => { onOpenCreateModal(); if (onCloseMobile) onCloseMobile(); }}
            className="w-full h-[34px] px-[10px] rounded-md bg-primary-container hover:bg-primary text-on-primary text-[13px] font-medium flex items-center gap-[10px] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create short link</span>
          </button>
        </div>

        {/* Scrollable Navigation List */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 min-h-0 pl-[13px] pr-[6px] mr-[3px] py-[5px] overflow-y-auto custom-scrollbar"
        >
          {/* Main Reference Tabs */}
          <nav className="flex flex-col gap-[6px]">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center justify-between h-[34px] px-[8px] rounded-md border-[0.5px] text-[13px] transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-primary-fixed/70 border-primary-strong/40 text-on-secondary-container font-medium'
                      : 'border-transparent text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-[10px] min-w-0">
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-primary-ink' : 'text-on-surface'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className={`text-[10px] px-[6px] py-[1px] rounded-full font-medium tabular-nums whitespace-nowrap shrink-0 ${
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
      <div className="mx-[13px] shrink-0 pt-[10px] border-t-[0.5px] border-outline-variant">
        <div className="px-[4px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-semibold text-xs shrink-0">
              {currentUser?.avatar || (currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U')}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-on-surface truncate">
                {currentUser?.name || "My Account"}
              </span>
              <span className="text-[10px] text-on-surface-variant truncate">
                {currentWorkspace?.plan ? `${currentWorkspace.plan.toUpperCase()} Plan` : 'Pro Plan'}
              </span>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Sign Out"
            className="size-[30px] grid place-items-center text-outline hover:text-error hover:bg-error-container transition-colors rounded-full cursor-pointer shrink-0"
            aria-label="Sign out"
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
