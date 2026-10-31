'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'sync';
  title: string;
  description?: string;
  latency?: string;
}

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (type: 'success' | 'error' | 'sync', title: string, description?: string, latency?: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: 'success' | 'error' | 'sync', title: string, description?: string, latency?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { id, type, title, description, latency };
    setToasts((prev) => [...prev.slice(-3), newToast]);

    setTimeout(() => {
      dismissToast(id);
    }, 4000);
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      {/* Floating Stacked Toasts Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl bg-surface-container-lowest shadow-xl border-[0.5px] border-outline-variant flex items-start justify-between gap-3 animate-fade-in transition-all ${
              toast.type === 'success'
                ? 'border-l-4 border-l-emerald-500'
                : toast.type === 'error'
                ? 'border-l-4 border-l-error'
                : 'border-l-4 border-l-primary-container'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="shrink-0 mt-0.5">
                {toast.type === 'success' && (
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
                {toast.type === 'error' && (
                  <div className="w-7 h-7 rounded-full bg-error-container text-error flex items-center justify-center">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                )}
                {toast.type === 'sync' && (
                  <div className="w-7 h-7 rounded-full bg-surface-container-high text-primary-ink flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-on-surface leading-tight">{toast.title}</span>
                {toast.description && (
                  <span className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">{toast.description}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {toast.latency && (
                <span className="font-mono text-[10px] font-bold text-primary-ink px-1.5 py-0.5 rounded bg-surface-container">
                  {toast.latency}
                </span>
              )}
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-low transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toasts: [],
      showToast: () => {},
      dismissToast: () => {}
    };
  }
  return context;
}
