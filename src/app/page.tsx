'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/storeContext';
import { AuthView } from '@/components/AuthView';
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
import { CreateLinkModal } from '@/components/CreateLinkModal';
import { CommandPaletteModal } from '@/components/CommandPaletteModal';

const TAB_TITLES: Record<TabType, string> = {
  overview: 'Links & Overview',
  links: 'All Short Links',
  analytics: 'Usage & Analytics',
  routing: 'OpeninApp & Dynamic Routing',
  qr: 'QR Code Studio',
  security: 'Security Scanner & Zero-Trust',
  campaigns: 'Campaigns & UTM Tagging',
  ai: 'AI Slug & Traffic Insights',
  api: 'API & Developer Keys',
  bulk: 'Bulk Link Generation',
};

function DashboardContent() {
  const { currentUser, authLoaded } = useStore();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  if (!authLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground antialiased">
        <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-card border border-border/60 shadow-lg">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold tracking-tight">Initializing TinyURL Console...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen bg-muted/20 text-foreground transition-colors selection:bg-primary/20 selection:text-primary">
      
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
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="w-64 h-full bg-card shadow-2xl"
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
      <div className="lg:pl-64 flex flex-col min-h-screen">
        
        {/* Sticky Top Header Bar */}
        <DashboardHeader 
          activeTabTitle={TAB_TITLES[activeTab] || 'Overview'}
          onOpenCreateModal={() => setCreateModalOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
        />

        {/* Dynamic Main Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6 sm:space-y-8 animate-fade-in">
          {activeTab === 'overview' && (
            <OverviewView 
              onOpenCreateModal={() => setCreateModalOpen(true)} 
              onNavigateTab={(tab) => setActiveTab(tab)} 
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            />
          )}

          {activeTab === 'links' && (
            <LinksView onOpenCreateModal={() => setCreateModalOpen(true)} />
          )}

          {activeTab === 'analytics' && <AnalyticsView />}
          {activeTab === 'routing' && <SmartRoutingView />}
          {activeTab === 'qr' && <QrCodeView />}
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
    </div>
  );
}

export default function Home() {
  return <DashboardContent />;
}
