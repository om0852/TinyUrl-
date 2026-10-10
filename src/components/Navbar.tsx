'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { 
  Link2, 
  ChevronDown, 
  Plus, 
  ShieldCheck, 
  Layers, 
  Check, 
  Activity,
  Globe
} from 'lucide-react';

interface NavbarProps {
  onOpenCreateModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCreateModal }) => {
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="h-16 border-b border-[#0b3d56] bg-[#052536] sticky top-0 z-40 px-4 md:px-8 flex items-center justify-between shadow-md">
      
      {/* Left Brand Logo & Primary Nav Links */}
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2 cursor-pointer">
          <span className="font-black text-2xl tracking-tighter text-white uppercase font-sans">
            TINYURL
          </span>
          <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold bg-[#008296] text-white rounded">
            PRO
          </span>
        </div>

        {/* Navigation Items matching TinyURL screenshot */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-200">
          <a href="#plans" className="hover:text-cyan-400 transition">Plans</a>
          <a href="#features" className="hover:text-cyan-400 transition">Features</a>
          <a href="#domains" className="hover:text-cyan-400 transition">Domains</a>
          <a href="#resources" className="hover:text-cyan-400 transition">Resources</a>
        </nav>
      </div>

      {/* Center Workspace Switcher & Status */}
      <div className="hidden md:flex items-center gap-4">
        {/* Workspace Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#07334a] hover:bg-[#0a405c] border border-white/10 text-xs text-slate-100 transition"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold max-w-[120px] truncate">{currentWorkspace.name}</span>
            <span className="px-1.5 py-0.5 text-[9px] bg-[#008296] text-white rounded uppercase font-bold">{currentWorkspace.role}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-[#072e42] rounded-xl border border-white/15 p-2 shadow-2xl z-50">
              <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Switch Workspace</p>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setCurrentWorkspace(ws);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition ${
                    ws.id === currentWorkspace.id ? 'bg-[#008296] text-white font-bold' : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    <span>{ws.name}</span>
                  </div>
                  {ws.id === currentWorkspace.id && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>21ms Redis Latency</span>
        </div>
      </div>

      {/* Right Auth Buttons matching image */}
      <div className="flex items-center gap-3">
        <button className="text-sm font-semibold text-slate-200 hover:text-white px-2 py-1 transition hidden sm:block">
          Log In
        </button>

        <button className="tinyurl-btn-teal text-xs px-4 py-2 rounded-lg transition font-bold">
          Sign Up
        </button>

        <button
          onClick={onOpenCreateModal}
          className="tinyurl-btn-green text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Shorten Link</span>
        </button>
      </div>
    </header>
  );
};
