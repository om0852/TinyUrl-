'use client';

import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Menu, 
  Globe,
  LogOut
} from 'lucide-react';
import { useStore } from '@/lib/storeContext';

interface DashboardHeaderProps {
  activeTabTitle: string;
  onOpenCreateModal: () => void;
  onOpenCommandPalette: () => void;
  onToggleMobileMenu?: () => void;
  onViewLandingPage?: () => void;
}

export function DashboardHeader({
  activeTabTitle: _activeTabTitle,
  onOpenCreateModal,
  onOpenCommandPalette,
  onToggleMobileMenu,
  onViewLandingPage,
}: DashboardHeaderProps) {
  const { currentUser, logout } = useStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="h-16 sticky top-0 z-40 px-4 sm:px-6 lg:px-8 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-outline-variant/30 flex items-center justify-between transition-colors">
      
      {/* Left: Mobile Toggle + Search Bar */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 mr-2 sm:mr-4">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container-low transition cursor-pointer shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Reference Search Bar */}
        <div className="relative w-full max-w-[190px] sm:max-w-xs md:max-w-md flex items-center min-w-0">
          <Search className="w-4 h-4 absolute left-3 text-outline pointer-events-none shrink-0" />
          <input
            type="text"
            onClick={onOpenCommandPalette}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onOpenCommandPalette();
            }}
            placeholder="Search links, tags, campaigns..."
            className="w-full pl-9 pr-8 sm:pr-12 py-2 bg-surface-container-low rounded-lg text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary-container transition-all cursor-pointer truncate"
            readOnly
          />
          <kbd className="absolute right-2 px-1.5 py-0.5 text-[10px] font-mono text-on-surface-variant/80 bg-surface-container-lowest border border-outline-variant/40 rounded shadow-2xs pointer-events-none hidden sm:inline-block">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Actions: Public Page, Create link CTA, User Avatar */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {onViewLandingPage && (
          <button
            onClick={onViewLandingPage}
            title="View Public Landing Page"
            className="h-9 px-2.5 sm:px-3 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border border-outline-variant/20 whitespace-nowrap shrink-0"
          >
            <Globe className="w-3.5 h-3.5 text-primary-container" />
            <span className="hidden sm:inline">Landing Page</span>
          </button>
        )}

        {/* Reference Create Link button */}
        <button
          onClick={onOpenCreateModal}
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary-container text-on-primary rounded-lg px-2.5 sm:px-3.5 py-2 hover:bg-primary transition-all shadow-sm cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Create link</span>
          <span className="inline sm:hidden">Create</span>
        </button>

        {/* User Profile Avatar with Interactive Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-primary-container/30 transition cursor-pointer"
            aria-label="User account menu"
          >
            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs ring-2 ring-primary-container/20 shadow-xs">
              {currentUser?.avatar || (currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U')}
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-surface-container-lowest shadow-2xl border border-outline-variant/40 p-2 z-50 animate-fade-in text-xs">
              <div className="p-3 bg-surface-container-low rounded-lg mb-1.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs ring-1 ring-outline-variant/40 shrink-0">
                  {currentUser?.avatar || (currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U')}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-on-surface truncate block">
                    {currentUser?.name || "My Account"}
                  </span>
                  <span className="text-[11px] text-on-surface-variant truncate block">
                    {currentUser?.email || "No email"}
                  </span>
                </div>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onViewLandingPage?.();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-on-surface hover:bg-surface-container-low transition cursor-pointer text-left"
                >
                  <Globe className="w-4 h-4 text-outline" />
                  <span>Public Landing Page</span>
                </button>
              </div>

              <div className="h-px bg-outline-variant/30 my-1" />

              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                  if (onViewLandingPage) onViewLandingPage();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-error hover:bg-error-container/20 font-semibold transition cursor-pointer text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

    </header>
  );
}
