'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Sun, 
  Moon, 
  Menu, 
  ShieldCheck, 
  Radio
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface DashboardHeaderProps {
  activeTabTitle: string;
  onOpenCreateModal: () => void;
  onOpenCommandPalette: () => void;
  onToggleMobileMenu?: () => void;
}

export function DashboardHeader({
  activeTabTitle,
  onOpenCreateModal,
  onOpenCommandPalette,
  onToggleMobileMenu,
}: DashboardHeaderProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Check saved theme or system preference
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'light') {
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  return (
    <header className="h-14 sticky top-0 z-40 px-4 sm:px-6 border-b border-border/40 bg-background/85 backdrop-blur-md flex items-center justify-between transition-colors">
      
      {/* Left: Mobile Toggle & Breadcrumb Title */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:inline">
            Console
          </span>
          <span className="text-muted-foreground/40 hidden sm:inline">/</span>
          <h2 className="text-sm sm:text-base font-bold text-foreground tracking-tight capitalize">
            {activeTabTitle}
          </h2>
        </div>
      </div>

      {/* Center: Command Palette Trigger Button (⌘K) */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
        <button
          onClick={onOpenCommandPalette}
          className="w-full h-9 px-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground text-xs flex items-center justify-between transition cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition" />
            <span>Search links, domains, campaigns, or routes...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted border border-border/60 rounded text-muted-foreground shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Operational Status, Theme Toggle, & Primary CTA */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Operational Status Dot */}
        <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>All Systems Operational</span>
        </div>

        {/* Theme Toggle (Light / Dark) */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="h-8 w-8 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-cyan-600" />
          )}
        </button>

        {/* Primary CTA Button */}
        <Button
          onClick={onOpenCreateModal}
          size="default"
          className="shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          <span className="text-xs font-bold">New Short Link</span>
        </Button>
      </div>

    </header>
  );
}
