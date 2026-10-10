'use client';

import React from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Link2, 
  BarChart3, 
  GitFork, 
  QrCode, 
  Smartphone, 
  ShieldAlert, 
  FolderKanban, 
  Sparkles, 
  Code2, 
  FileSpreadsheet,
  FileText,
  ShieldCheck
} from 'lucide-react';

export type TabType = 
  | 'overview' 
  | 'links' 
  | 'analytics' 
  | 'routing' 
  | 'qr' 
  | 'bio' 
  | 'security' 
  | 'campaigns' 
  | 'ai' 
  | 'api' 
  | 'bulk';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems: { id: TabType; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'links', label: 'Link Management', icon: <Link2 className="w-4 h-4" /> },
    { id: 'analytics', label: 'Advanced Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'routing', label: 'Smart Rules & A/B', icon: <GitFork className="w-4 h-4" /> },
    { id: 'qr', label: 'QR Code Studio', icon: <QrCode className="w-4 h-4" /> },
    { id: 'bio', label: 'Link-in-Bio Page', icon: <Smartphone className="w-4 h-4" /> },
    { id: 'security', label: 'Security & Safety', icon: <ShieldAlert className="w-4 h-4" />, badge: 'Safe' },
    { id: 'campaigns', label: 'Campaigns & Workspaces', icon: <FolderKanban className="w-4 h-4" /> },
    { id: 'ai', label: 'AI Marketing Suite', icon: <Sparkles className="w-4 h-4 text-cyan-400" />, badge: 'AI' },
    { id: 'api', label: 'Developer API & Webhooks', icon: <Code2 className="w-4 h-4" /> },
    { id: 'bulk', label: 'Bulk CSV Tools', icon: <FileSpreadsheet className="w-4 h-4" /> }
  ];

  return (
    <aside className="w-64 border-r border-[#0b3d56] bg-[#052536] p-4 hidden md:flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="space-y-1">
        <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Main Navigation</p>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition duration-150 ${
                isActive
                  ? 'bg-[#008296] text-white font-bold shadow-md'
                  : 'text-slate-200 hover:text-white hover:bg-[#07334a]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-white' : 'text-slate-300'}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                  item.badge === 'AI' 
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30' 
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Infrastructure & Legal Links */}
      <div className="space-y-3 mt-6">
        <div className="bg-[#072e42] p-3.5 rounded-xl border border-white/10 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">Domain Status</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active SSL
            </span>
          </div>
          <p className="text-[11px] text-slate-200 font-mono">short.link</p>
        </div>

        <div className="flex items-center justify-between px-2 text-[11px] text-slate-400">
          <Link href="/privacy" className="hover:text-white transition flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-white transition flex items-center gap-1">
            <FileText className="w-3 h-3" /> Terms
          </Link>
        </div>
      </div>
    </aside>
  );
};
