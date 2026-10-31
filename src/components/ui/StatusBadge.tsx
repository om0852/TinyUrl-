import React from 'react';
import { ShieldCheck, AlertTriangle, RefreshCw, Check } from 'lucide-react';

export type StatusBadgeVariant = 
  | 'active' 
  | 'hardened' 
  | 'warning' 
  | 'error' 
  | 'sync' 
  | 'neutral' 
  | 'pro'
  | 'success';

interface StatusBadgeProps {
  variant?: StatusBadgeVariant;
  children?: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant = 'active',
  children,
  className = '',
  dot = true
}) => {
  const styles: Record<StatusBadgeVariant, { bg: string; dotColor?: string; defaultIcon?: React.ReactNode; defaultText: string }> = {
    active: {
      bg: 'bg-emerald-100 text-emerald-800',
      dotColor: 'bg-emerald-600',
      defaultText: 'Active'
    },
    success: {
      bg: 'bg-emerald-100 text-emerald-800',
      defaultIcon: <Check className="w-3.5 h-3.5 text-emerald-700" />,
      defaultText: 'Verified'
    },
    hardened: {
      bg: 'bg-primary-container/10 text-primary-ink',
      defaultIcon: <ShieldCheck className="w-3.5 h-3.5" />,
      defaultText: 'Hardened Edge'
    },
    warning: {
      bg: 'bg-amber-100 text-amber-800',
      defaultIcon: <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />,
      defaultText: 'Rate Limited'
    },
    error: {
      bg: 'bg-error-container text-error',
      dotColor: 'bg-error',
      defaultText: 'Quarantined'
    },
    sync: {
      bg: 'bg-surface-container text-on-surface-variant',
      defaultIcon: <RefreshCw className="w-3.5 h-3.5" />,
      defaultText: 'Live Sync'
    },
    neutral: {
      bg: 'bg-surface-container-low text-on-surface-variant',
      defaultText: 'Default'
    },
    pro: {
      bg: 'bg-surface-container-high text-primary-ink font-bold',
      defaultText: 'PRO'
    }
  };

  const current = styles[variant] || styles.active;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold select-none ${current.bg} ${className}`}
    >
      {current.defaultIcon && <span className="shrink-0">{current.defaultIcon}</span>}
      {dot && current.dotColor && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dotColor}`} />
      )}
      <span>{children || current.defaultText}</span>
    </span>
  );
};
