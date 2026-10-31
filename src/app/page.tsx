'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';
import { hasPermission, ROLE_DESCRIPTIONS } from '@/lib/rbac';
import { LandingPageView } from '@/components/LandingPageView';
import { AuthModal } from '@/components/AuthModal';
import { Sidebar, TabType } from '@/components/Sidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { OverviewView } from '@/components/OverviewView';
import { LinksView } from '@/components/LinksView';
import { AnalyticsView } from '@/components/AnalyticsView';
import { SmartRoutingView } from '@/components/SmartRoutingView';
import { QrCodeView } from '@/components/QrCodeView';
import { SecurityView } from '@/components/SecurityView';
import { CampaignsView } from '@/components/CampaignsView';
import { TeamsView } from '@/components/TeamsView';
import { AiSuiteView } from '@/components/AiSuiteView';
import { ApiDocsView } from '@/components/ApiDocsView';
import { BulkToolsView } from '@/components/BulkToolsView';
import { ClientsView } from '@/components/ClientsView';
import { SettingsView } from '@/components/SettingsView';
import { CreateLinkModal } from '@/components/CreateLinkModal';
import { CommandPaletteModal } from '@/components/CommandPaletteModal';

const TAB_TITLES: Record<TabType, string> = {
  overview: 'Workspace Overview',
  links: 'All Short Links',
  analytics: 'Usage & Analytics',
  routing: 'OpeninApp & Dynamic Routing',
  qr: 'QR Code Studio',
  security: 'Security Scanner & Zero-Trust',
  campaigns: 'Campaigns & UTM Tagging',
  clients: 'Clients Portal',
  teams: 'Teams & Workspaces',
  ai: 'AI Slug & Traffic Insights',
  api: 'API & Developer Keys',
  bulk: 'Bulk Link Generation',
  settings: 'Workspace Settings',
};

export default function Home() {
  const { 
    currentUser, 
    currentUserRole, 
    refreshLinks, 
    refreshAnalytics, 
    refreshCampaigns, 
    refreshClients, 
    refreshTeamMembers, 
    refreshSettings 
  } = useStore();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'landing' | 'dashboard'>('landing');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');

  const handleOpenCreateModal = () => {
    if (!hasPermission(currentUserRole, 'links:create')) {
      const roleName = ROLE_DESCRIPTIONS[currentUserRole]?.title || currentUserRole;
      showToast(
        'error',
        'Permission Denied',
        `Your role (${roleName}) does not have permission to create links.`
      );
      return;
    }
    setCreateModalOpen(true);
  };

  const [activeTab, setActiveTabState] = useState<TabType>('overview');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('snip_active_tab', tab);
      } catch {}
    }
  };

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      try {
        const savedTab = localStorage.getItem('snip_active_tab') as TabType;
        if (savedTab && TAB_TITLES[savedTab]) {
          setActiveTabState(savedTab);
        }
      } catch {}
    }
  }, []);

  // When user logs in or out, sync viewMode
  useEffect(() => {
    if (currentUser) {
      setViewMode('dashboard');
    } else {
      setViewMode('landing');
    }
  }, [currentUser]);

  // Target data loading specifically to what the active tab requires (Zero redundant multi-API fetches)
  useEffect(() => {
    if (mounted && currentUser && viewMode === 'dashboard') {
      switch (activeTab) {
        case 'overview':
          refreshLinks();
          refreshAnalytics();
          break;
        case 'links':
        case 'routing':
        case 'qr':
        case 'security':
        case 'bulk':
        case 'ai':
          refreshLinks();
          break;
        case 'analytics':
          refreshAnalytics();
          refreshLinks();
          break;
        case 'campaigns':
          refreshCampaigns();
          break;
        case 'clients':
          refreshClients();
          break;
        case 'teams':
          refreshTeamMembers();
          break;
        case 'settings':
        case 'api':
          refreshSettings();
          break;
      }
    }
  }, [
    activeTab, 
    mounted, 
    currentUser, 
    viewMode, 
    refreshLinks, 
    refreshAnalytics, 
    refreshCampaigns, 
    refreshClients, 
    refreshTeamMembers, 
    refreshSettings
  ]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K: Toggle Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
      // Cmd/Ctrl + N: Open New Link Modal
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleOpenCreateModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // If not mounted yet (SSR / initial hydration), not logged in, or explicitly toggled to view landing page
  if (!mounted || !currentUser || viewMode === 'landing') {
    return (
      <>
        <LandingPageView
          onOpenAuth={(mode) => {
            setAuthInitialMode(mode);
            setAuthModalOpen(true);
          }}
          onGoToDashboard={() => setViewMode('dashboard')}
        />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialMode={authInitialMode}
        />
      </>
    );
  }

  // Authenticated Console / Workspace
  return (
    <div className="h-screen flex overflow-hidden bg-canvas text-on-surface selection:bg-primary-container/40 selection:text-on-primary">

      {/* 1. Desktop Sidebar: floating white card on the tinted canvas */}
      <div className="hidden lg:flex lg:w-[270px] lg:shrink-0 lg:flex-col lg:py-[10px] lg:pl-[10px]">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenCreateModal={handleOpenCreateModal}
          className="rounded-xl"
        />
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-[#00000A73] backdrop-blur-[5px] z-50 lg:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-[260px] max-w-[85vw] h-full p-[10px]"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              onOpenCreateModal={() => {
                setMobileMenuOpen(false);
                handleOpenCreateModal();
              }}
              onCloseMobile={() => setMobileMenuOpen(false)}
              className="rounded-xl"
            />
          </div>
        </div>
      )}

      {/* 2. Main Workspace: one white card; header stays put, content scrolls inside */}
      <div className="flex-1 min-w-0 p-[10px]">
        <div className="h-full flex flex-col min-w-0 overflow-hidden rounded-xl bg-surface-container-lowest">

        <DashboardHeader
          activeTabTitle={TAB_TITLES[activeTab] || 'Overview'}
          onOpenCreateModal={handleOpenCreateModal}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
          onViewLandingPage={() => setViewMode('landing')}
        />

        {/* Dynamic Main Canvas */}
        <main className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <div className="p-[15px] sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto space-y-6 animate-fade-in min-w-0">
          {activeTab === 'overview' && (
            <OverviewView 
              onOpenCreateModal={handleOpenCreateModal} 
              onNavigateTab={(tab) => setActiveTab(tab as TabType)} 
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            />
          )}

          {activeTab === 'links' && (
            <LinksView 
              onOpenCreateModal={handleOpenCreateModal} 
              onNavigateTab={(tab) => setActiveTab(tab as TabType)} 
            />
          )}

          {activeTab === 'analytics' && <AnalyticsView onNavigateTab={(tab) => setActiveTab(tab as TabType)} />}
          {activeTab === 'settings' && <SettingsView onNavigateTab={(tab) => setActiveTab(tab as TabType)} />}
          {activeTab === 'routing' && <SmartRoutingView />}
          {activeTab === 'qr' && (
            <QrCodeView 
              onNavigateTab={(tab) => setActiveTab(tab as TabType)} 
              onOpenCreateModal={() => setCreateModalOpen(true)} 
            />
          )}
          {activeTab === 'security' && <SecurityView />}
          {activeTab === 'campaigns' && <CampaignsView onNavigateTab={(tab) => setActiveTab(tab as TabType)} />}
          {activeTab === 'clients' && <ClientsView onNavigateTab={(tab) => setActiveTab(tab as TabType)} />}
          {activeTab === 'teams' && <TeamsView onNavigateTab={(tab) => setActiveTab(tab as TabType)} />}
          {activeTab === 'ai' && <AiSuiteView />}
          {activeTab === 'api' && <ApiDocsView />}
          {activeTab === 'bulk' && <BulkToolsView />}
          </div>
        </main>
        </div>
      </div>

      {/* Global Create Short Link Modal */}
      <CreateLinkModal 
        isOpen={createModalOpen} 
        onClose={() => setCreateModalOpen(false)} 
      />

      {/* Global Command Palette Modal (Cmd+K) */}
      <CommandPaletteModal
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onOpenCreateModal={() => setCreateModalOpen(true)}
      />

      {/* Auth Modal if triggered */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authInitialMode}
      />
    </div>
  );
}
