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
  activeTabTitle,
  onOpenCreateModal,
  onOpenCommandPalette,
  onToggleMobileMenu,
  onViewLandingPage,
}: DashboardHeaderProps) {
  const { currentUser, logout } = useStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="h-[60px] shrink-0 relative z-40 mx-[15px] sm:mx-5 lg:mx-6 bg-surface-container-lowest border-b-[0.5px] border-outline-variant flex items-center justify-between">
      
      {/* Left: Mobile Toggle + Search Bar */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 mr-2 sm:mr-4">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden size-[34px] grid place-items-center text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container transition cursor-pointer shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <h1 className="hidden md:block text-[16px] font-semibold text-on-surface whitespace-nowrap mr-2">{activeTabTitle}</h1>

        {/* Command search pill */}
        <div className="relative w-full max-w-[190px] sm:max-w-xs md:max-w-[320px] flex items-center min-w-0">
          <Search className="w-4 h-4 absolute left-3 text-outline pointer-events-none shrink-0" />
          <input
            type="text"
            onClick={onOpenCommandPalette}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onOpenCommandPalette();
            }}
            placeholder="Search links, tags, campaigns..."
            className="w-full h-[34px] pl-9 pr-8 sm:pr-12 bg-surface-container-low border-[0.5px] border-outline-variant rounded-full text-xs font-light text-on-surface placeholder:text-outline focus:outline-none focus:border-on-surface-variant transition-colors cursor-pointer truncate"
            readOnly
          />
          <kbd className="absolute right-2.5 px-1.5 py-[1px] text-[10px] font-mono text-outline bg-surface-container-lowest border-[0.5px] border-outline-variant rounded-full pointer-events-none hidden sm:inline-block">
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
            className="h-[34px] px-3 rounded-full bg-surface-container-lowest hover:bg-surface-container border-[0.5px] border-outline-variant text-on-surface text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Globe className="w-3.5 h-3.5 text-primary-ink" />
            <span className="hidden sm:inline">Landing Page</span>
          </button>
        )}

        {/* Reference Create Link button */}
        <button
          onClick={onOpenCreateModal}
          type="button"
          className="lg:hidden inline-flex items-center gap-1.5 h-[34px] text-xs font-medium bg-primary-container text-on-primary rounded-md px-3 hover:bg-primary transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
            className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-primary-strong/30 transition cursor-pointer"
            aria-label="User account menu"
          >
            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-semibold text-xs">
              {currentUser?.avatar || (currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U')}
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-surface-container-lowest shadow-md border-[0.5px] border-outline-variant p-[6px] z-50 animate-fade-in text-xs">
              <div className="p-3 bg-surface-container rounded-md mb-1.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs ring-1 ring-outline-variant/40 shrink-0">
                  {currentUser?.avatar || (currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U')}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-on-surface truncate block">
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-on-surface hover:bg-surface-container transition cursor-pointer text-left"
                >
                  <Globe className="w-4 h-4 text-outline" />
                  <span>Public Landing Page</span>
                </button>
              </div>

              <div className="h-[0.5px] bg-outline-variant my-1" />

              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                  if (onViewLandingPage) onViewLandingPage();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-error hover:bg-error-container font-medium transition cursor-pointer text-left"
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
