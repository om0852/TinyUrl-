import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  title,
  description,
  disabled = false,
  className = ''
}) => {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 ${className}`}>
      {(title || description) && (
        <div className="flex flex-col pr-4 min-w-0">
          {title && <span className="text-xs font-bold text-on-surface leading-tight">{title}</span>}
          {description && <span className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">{description}</span>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`w-11 h-6 rounded-full p-0.5 flex items-center transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? 'bg-primary-container justify-end' : 'bg-surface-container-highest justify-start'
        }`}
      >
        <div className={`w-5 h-5 rounded-full shadow-sm transition-transform ${
          checked ? 'bg-on-primary' : 'bg-on-surface-variant'
        }`} />
      </button>
    </div>
  );
};
