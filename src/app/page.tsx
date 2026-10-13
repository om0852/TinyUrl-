'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/storeContext';
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
import { AiSuiteView } from '@/components/AiSuiteView';
import { ApiDocsView } from '@/components/ApiDocsView';
import { BulkToolsView } from '@/components/BulkToolsView';
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
  ai: 'AI Slug & Traffic Insights',
  api: 'API & Developer Keys',
  bulk: 'Bulk Link Generation',
  settings: 'Workspace Settings',
};

export default function Home() {
  const { currentUser } = useStore();
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'landing' | 'dashboard'>('landing');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');

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
        setCreateModalOpen(true);
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
    <div className="min-h-screen bg-surface text-on-surface selection:bg-primary-container/20 selection:text-primary-container">
      
      {/* 1. Desktop Sidebar (Fixed) */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col z-50">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onOpenCreateModal={() => setCreateModalOpen(true)}
          className="w-64"
        />
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="w-64 h-full bg-surface-container-lowest shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              onOpenCreateModal={() => {
                setMobileMenuOpen(false);
                setCreateModalOpen(true);
              }}
              onCloseMobile={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* 2. Main Workspace (Offset by sidebar width) */}
      <div className="lg:pl-64 flex flex-col min-h-screen bg-surface min-w-0">
        
        {/* Sticky Top Header Bar */}
        <DashboardHeader 
          activeTabTitle={TAB_TITLES[activeTab] || 'Overview'}
          onOpenCreateModal={() => setCreateModalOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
          onViewLandingPage={() => setViewMode('landing')}
        />

        {/* Dynamic Main Canvas */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6 sm:space-y-8 animate-fade-in min-w-0">
          {activeTab === 'overview' && (
            <OverviewView 
              onOpenCreateModal={() => setCreateModalOpen(true)} 
              onNavigateTab={(tab) => setActiveTab(tab as TabType)} 
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            />
          )}

          {activeTab === 'links' && (
            <LinksView 
              onOpenCreateModal={() => setCreateModalOpen(true)} 
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
          {activeTab === 'campaigns' && <CampaignsView />}
          {activeTab === 'ai' && <AiSuiteView />}
          {activeTab === 'api' && <ApiDocsView />}
          {activeTab === 'bulk' && <BulkToolsView />}
        </main>
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
