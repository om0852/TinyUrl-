'use client';

import React, { useState } from 'react';
import { StoreProvider } from '@/lib/storeContext';
import { Navbar } from '@/components/Navbar';
import { Sidebar, TabType } from '@/components/Sidebar';
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

function DashboardContent() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Top Header */}
      <Navbar onOpenCreateModal={() => setCreateModalOpen(true)} />

      {/* Main Body */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        
        {/* Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {activeTab === 'overview' && (
            <OverviewView 
              onOpenCreateModal={() => setCreateModalOpen(true)} 
              onNavigateTab={(tab) => setActiveTab(tab)} 
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
    </div>
  );
}

export default function Home() {
  return <DashboardContent />;
}
