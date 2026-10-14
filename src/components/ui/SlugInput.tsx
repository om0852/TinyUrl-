import React from 'react';
import { AlertCircle, Check } from 'lucide-react';

interface SlugInputProps {
  value: string;
  onChange: (val: string) => void;
  prefix?: string;
  label?: string;
  placeholder?: string;
  error?: string;
  onCheck?: () => void;
  checkStatus?: 'available' | 'taken' | null;
  disabled?: boolean;
  className?: string;
}

export const SlugInput: React.FC<SlugInputProps> = ({
  value,
  onChange,
  prefix,
  label,
  placeholder = 'custom-slug',
  error,
  onCheck,
  checkStatus,
  disabled = false,
  className = ''
}) => {
  const dynamicHost = typeof window !== 'undefined' ? `${window.location.host}/` : 'tinyurl.com/';
  const displayPrefix = prefix !== undefined ? prefix : dynamicHost;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-on-surface">
          {label}
        </label>
      )}
      <div className={`flex rounded-xl shadow-xs overflow-hidden bg-surface-container-lowest border transition-colors ${
        error ? 'border-error ring-2 ring-error/20' : 'border-outline-variant/50 focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/20'
      }`}>
        {displayPrefix && (
          <span className="px-3.5 py-2.5 bg-surface-container text-on-surface-variant font-mono text-xs flex items-center select-none border-r border-outline-variant/30">
            {displayPrefix}
          </span>
        )}
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
          placeholder={placeholder}
          className="flex-1 px-3.5 py-2.5 text-on-surface font-mono text-xs font-semibold focus:outline-none bg-transparent placeholder:text-on-surface-variant/50"
        />
        {onCheck && (
          <button
            type="button"
            onClick={onCheck}
            disabled={!value || disabled}
            className="px-3 py-2 bg-surface-container-low text-primary-container hover:bg-surface-container font-semibold text-xs border-l border-outline-variant/30 transition-colors cursor-pointer disabled:opacity-40"
          >
            {checkStatus === 'available' ? (
              <span className="flex items-center gap-1 text-emerald-600">
                <Check className="w-3.5 h-3.5" />
                Available
              </span>
            ) : checkStatus === 'taken' ? (
              <span className="text-error font-bold">Taken</span>
            ) : (
              'Check'
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-error mt-0.5 flex items-center gap-1 font-medium animate-fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
