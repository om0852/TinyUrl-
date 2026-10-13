'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  maxWidth = 'max-w-[540px]'
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="fixed inset-0" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      <div className={`relative w-full ${maxWidth} rounded-2xl bg-surface-container-lowest shadow-2xl border border-outline-variant/40 flex flex-col overflow-hidden z-10 max-h-[90vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-outline-variant/30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <div className="w-8 h-8 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary-container shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-on-surface truncate">{title}</h3>
              {description && (
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">{description}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3 text-xs overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-outline-variant/30 shrink-0 bg-surface-container-lowest">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

interface DangerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  targetItem?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
}

export const DangerConfirmDialog: React.FC<DangerDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  targetItem,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  isLoading = false
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      
      <div className="relative w-full max-w-[480px] rounded-2xl bg-surface-container-lowest shadow-2xl border border-outline-variant/40 p-6 flex flex-col gap-4 z-10">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-error-container/40 flex items-center justify-center text-error shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <h3 className="text-base font-bold text-on-surface">{title}</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">{description}</p>
            {targetItem && (
              <span className="mt-1 font-mono text-xs font-bold text-error break-all">
                {targetItem}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant/30">
          <Button
            type="button"
            variant="secondary"
            size="default"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="default"
            loading={isLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
