'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  destructive?: boolean;
  active?: boolean;
  divider?: boolean;
  onClick?: () => void;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  title?: string;
  align?: 'left' | 'right';
  className?: string;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  title,
  align = 'right',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block ${className}`} ref={menuRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 z-50 w-56 rounded-xl bg-surface-container-lowest shadow-xl border border-outline-variant/40 p-1.5 flex flex-col gap-0.5 animate-fade-in ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {title && (
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant select-none">
              {title}
            </div>
          )}

          {items.map((item) => {
            if (item.divider) {
              return <div key={item.id} className="h-px bg-outline-variant/30 my-1" />;
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.onClick?.();
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer select-none text-left ${
                  item.active
                    ? 'bg-surface-container-high text-primary-container'
                    : item.destructive
                    ? 'text-error hover:bg-error-container/20'
                    : 'text-on-surface hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.shortcut && (
                    <span className="font-mono text-[10px] text-on-surface-variant opacity-75">
                      {item.shortcut}
                    </span>
                  )}
                  {item.active && <Check className="w-4 h-4 text-primary-container" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
