'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { AuthModal } from '@/components/AuthModal';

interface NavbarProps {
  onOpenCreateModal: () => void;
  onOpenCommandPalette?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCreateModal, onOpenCommandPalette }) => {
  const { currentUser, logout } = useStore();
  
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const handleOpenAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <header className="sticky top-0 right-0 z-20 w-full pl-60 bg-surface-container-lowest/80 backdrop-blur-md border-b border-outline-variant shadow-sm">
      <div className="flex items-center justify-between px-space-lg h-16 w-full">
        
        {/* Left: Global Search Command Bar (⌘K) */}
        <div className="flex items-center space-x-3 w-full max-w-lg">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              search
            </span>
            <input 
              type="text"
              onClick={onOpenCommandPalette}
              readOnly
              placeholder="Search links, tags, or domains... (⌘K / Ctrl+K)"
              className="w-full pl-9 pr-16 py-2 bg-surface rounded-lg border border-outline-variant/60 font-body-md text-body-md text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-xs cursor-pointer"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center space-x-0.5 pointer-events-none">
              <kbd className="font-code-sm text-[10px] px-1.5 py-0.5 bg-surface-container-low border border-outline-variant/70 rounded text-on-surface-variant shadow-xs">
                ⌘K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right: Telemetry, Actions & Profile */}
        <div className="flex items-center space-x-3">
          
          {/* Secondary Action: Health status pill */}
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-surface-container text-tertiary border border-outline-variant/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 animate-ping"></span>
            <span className="font-label-sm text-label-sm font-semibold">
              System Healthy: 42 domains
            </span>
          </div>

          {/* Trailing Icon Actions: Notifications */}
          <button 
            type="button" 
            onClick={onOpenCommandPalette}
            aria-label="Notifications"
            className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors relative"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-secondary-container"></span>
          </button>

          {/* Help Action */}
          <button 
            type="button" 
            onClick={() => handleOpenAuth('login')}
            aria-label="Help"
            className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">help</span>
          </button>

          {/* Divider */}
          <div className="h-5 w-[1px] bg-outline-variant/40"></div>

          {/* Primary CTA: + New Shortlink */}
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-primary-container text-on-primary rounded-lg font-label-md text-label-md font-semibold hover:bg-primary transition-all shadow-sm active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>New Shortlink</span>
            </button>
          </div>

          {/* User Profile Avatar with Online dot */}
          <div className="flex items-center pl-2 space-x-2 relative">
            {currentUser ? (
              <div>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="w-8 h-8 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center text-xs ring-2 ring-outline-variant/50 shadow-xs cursor-pointer"
                >
                  {currentUser.name.charAt(0)}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface-container-lowest"></span>
                </button>

                {userMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-52 bg-surface-container-lowest rounded-xl border border-outline-variant/60 p-2 shadow-xl z-50 space-y-1 text-xs">
                    <div className="px-3 py-2 border-b border-surface-container">
                      <p className="font-bold text-on-surface truncate font-headline-sm text-xs">{currentUser.name}</p>
                      <p className="text-[10px] text-on-surface-variant truncate font-body-sm">{currentUser.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-error hover:bg-error-container/20 font-medium flex items-center gap-2 transition"
                    >
                      <span className="material-symbols-outlined text-[16px]">logout</span>
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenAuth('login')}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg text-on-surface hover:bg-surface-container transition-all cursor-pointer"
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAuth('signup')}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-container text-on-primary hover:bg-primary transition-all shadow-xs cursor-pointer"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

      <AuthModal 
        isOpen={authModalOpen} 
        initialMode={authMode} 
        onClose={() => setAuthModalOpen(false)} 
      />
    </header>
  );
};
