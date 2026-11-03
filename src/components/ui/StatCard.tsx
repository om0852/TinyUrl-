import React from 'react';
import { InfoTooltip } from './InfoTooltip';

export interface StatCardProps {
  label: string;
  /** Explains the metric in a tooltip next to the label */
  info?: React.ReactNode;
  /** Small icon on the right of the label row */
  icon?: React.ReactNode;
  value: React.ReactNode;
  /** Numbers render large; words (a slug, a country) render smaller so they fit */
  kind?: 'number' | 'text';
  valueClassName?: string;
  /** Short text right after the value, e.g. "+12%" or "/ 50 limit" */
  suffix?: React.ReactNode;
  /** One line under the value; the row is kept even when empty so cards in a row line up */
  note?: React.ReactNode;
  /** Extra content pinned to the bottom of the card, e.g. a distribution bar */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Metric card with fixed rows (label, value, note), so a row of cards lines up whatever
 * each one shows.
 */
export function StatCard({ label, info, icon, value, kind = 'number', valueClassName = '', suffix, note, footer, className = '' }: StatCardProps) {
  return (
    <div className={`flex min-w-0 flex-col rounded-xl border-[0.5px] border-outline-variant bg-surface-container-lowest p-4 sm:p-5 shadow-sm ${className}`}>
      <div className="flex h-5 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">{label}</span>
          {info && <InfoTooltip text={info} />}
        </div>
        {icon && <span className="shrink-0 text-outline [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
      </div>

      <div className="mt-3 flex h-9 min-w-0 items-center gap-2">
        <span className={`min-w-0 truncate font-semibold leading-none ${kind === 'number' ? 'text-[28px]' : 'text-xl'} ${valueClassName || 'text-on-surface'}`}>
          {value}
        </span>
        {suffix && <span className="shrink-0 text-xs font-medium text-on-surface-variant">{suffix}</span>}
      </div>

      <div className="mt-1 min-h-[18px] truncate text-xs leading-[18px] text-on-surface-variant">{note}</div>

      {footer && <div className="mt-auto pt-3">{footer}</div>}
    </div>
  );
}
