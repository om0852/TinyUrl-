'use client';

import React from 'react';
import { StoreProvider } from '@/lib/storeContext';
import { ToastProvider } from '@/components/ui/ToastHub';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <StoreProvider>
        {children}
      </StoreProvider>
    </ToastProvider>
  );
}
