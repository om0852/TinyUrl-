'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

export interface InfoTooltipProps {
  /** The information content shown inside the tooltip bubble on hover */
  text: React.ReactNode;
  /** Optional title header displayed in bold at the top of the tooltip */
  title?: string;
  /** Position preference: 'top' | 'bottom' | 'auto' (default: 'auto') */
  position?: 'top' | 'bottom' | 'auto';
  /** Custom extra styling for the info icon button */
  className?: string;
  /** Icon size */
  size?: 'xs' | 'sm' | 'md';
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  text,
  title,
  position = 'auto',
  className = '',
  size = 'sm'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 260; // approximate width for clamp calculation
    const margin = 8;

    let placement: 'top' | 'bottom' = 'top';
    if (position === 'bottom') {
      placement = 'bottom';
    } else if (position === 'top') {
      placement = 'top';
    } else {
      // Auto: if too close to top edge (< 100px), place bottom
      placement = rect.top < 110 ? 'bottom' : 'top';
    }

    let top = 0;
    if (placement === 'top') {
      top = rect.top - margin;
    } else {
      top = rect.bottom + margin;
    }

    // Horizontal centering over icon, clamped within viewport bounds [12px, window.innerWidth - 12px]
    let left = rect.left + rect.width / 2;
    const halfWidth = tooltipWidth / 2;
    if (typeof window !== 'undefined') {
      if (left - halfWidth < 12) {
        left = halfWidth + 12;
      } else if (left + halfWidth > window.innerWidth - 12) {
        left = window.innerWidth - halfWidth - 12;
      }
    }

    setCoords({ top, left, placement });
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    setIsOpen(false);
  };

  // Re-calculate on scroll or resize if open
  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => {
      updatePosition();
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4'
  }[size];

  return (
    <span className="inline-flex items-center align-middle ml-1.5 shrink-0">
      <button
        ref={triggerRef}
        type="button"
        tabIndex={0}
        aria-label="Information"
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          updatePosition();
          setIsOpen(!isOpen);
        }}
        className={`inline-flex items-center justify-center text-on-surface-variant/60 hover:text-primary-ink transition-all duration-150 cursor-pointer focus:outline-none focus:text-primary-ink rounded-full p-0.5 hover:bg-surface-container-high/60 ${className}`}
      >
        <Info className={sizeClasses} />
      </button>

      {mounted && isOpen && coords && typeof document !== 'undefined' && createPortal(
        <div
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            transform: coords.placement === 'top' 
              ? 'translate(-50%, -100%)' 
              : 'translate(-50%, 0%)',
            zIndex: 99999
          }}
          className="pointer-events-none max-w-xs w-64 p-2.5 rounded-xl bg-neutral-900/95 dark:bg-neutral-950/95 text-neutral-100 text-[11px] leading-relaxed shadow-2xl backdrop-blur-md border border-neutral-700/60 transition-opacity animate-in fade-in zoom-in-95 duration-150"
        >
          {title && (
            <div className="font-bold text-white text-xs mb-1 flex items-center gap-1.5 border-b border-neutral-800 pb-1">
              <Info className="w-3 h-3 text-primary-ink" />
              <span>{title}</span>
            </div>
          )}
          <div className="text-neutral-300 font-normal">
            {text}
          </div>
          {/* Subtle Arrow Pointer */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              ...(coords.placement === 'top' 
                ? { bottom: '-4px', borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid rgb(23 23 23 / 0.95)' }
                : { top: '-4px', borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '4px solid rgb(23 23 23 / 0.95)' })
            }}
            className="w-0 h-0"
          />
        </div>,
        document.body
      )}
    </span>
  );
};
