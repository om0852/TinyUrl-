'use client';

import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base primitive Skeleton component with smooth shimmer wave animation.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div
      className={`skeleton-shimmer rounded-md ${className}`}
      {...props}
    />
  );
};

/**
 * KPI Metric Card Skeleton (e.g. Total Links, Clicks, Conversion Rate)
 */
export const SkeletonKpiCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`p-4 sm:p-5 rounded-xl border border-surface-container bg-surface-container-lowest/80 shadow-xs flex flex-col justify-between space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24 sm:w-28" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-20 sm:w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
};

/**
 * KPI Metric Card Grid (e.g. 4 or 5 KPI cards in a row)
 */
export const SkeletonKpiGrid: React.FC<{ count?: number; columns?: string }> = ({ 
  count = 4, 
  columns = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' 
}) => {
  return (
    <div className={`grid ${columns} gap-3 sm:gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonKpiCard key={i} />
      ))}
    </div>
  );
};

/**
 * Desktop Table Skeleton
 */
export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 5, 
  columns = 5 
}) => {
  return (
    <div className="w-full bg-surface-container-lowest rounded-xl border border-surface-container overflow-hidden shadow-xs">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-surface-container flex items-center justify-between gap-4 bg-surface-container-low/50">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-surface-container/60">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0 max-w-md">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>

            <div className="hidden md:flex items-center gap-6">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-4 w-12" />
            </div>

            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Mobile Card List Skeleton
 */
export const SkeletonMobileCards: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="space-y-3 block md:hidden">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-4 rounded-xl border border-surface-container bg-surface-container-lowest shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-surface-container/60">
            <Skeleton className="h-3 w-24" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Chart Skeleton Loader
 */
export const SkeletonChart: React.FC<{ height?: string; title?: string }> = ({ 
  height = 'h-64 sm:h-72',
  title
}) => {
  return (
    <div className="p-5 sm:p-6 rounded-xl border border-surface-container bg-surface-container-lowest shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          {title ? (
            <h3 className="text-sm font-semibold text-on-surface">{title}</h3>
          ) : (
            <Skeleton className="h-4 w-36" />
          )}
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-16 rounded-lg" />
          <Skeleton className="h-7 w-16 rounded-lg" />
        </div>
      </div>
      <div className={`w-full ${height} rounded-lg bg-surface-container-low/40 p-4 flex items-end gap-2 sm:gap-3`}>
        {Array.from({ length: 12 }).map((_, i) => {
          const heights = ['35%', '60%', '45%', '80%', '55%', '90%', '70%', '40%', '65%', '85%', '50%', '75%'];
          return (
            <div key={i} className="flex-1 flex flex-col justify-end items-center h-full">
              <Skeleton 
                className="w-full max-w-[28px] rounded-t-sm" 
                style={{ height: heights[i % heights.length] }} 
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Full Page Skeleton for LinksView
 */
export const SkeletonLinksView: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Action & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-surface-container bg-surface-container-lowest shadow-xs">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3.5 rounded-xl border border-surface-container bg-surface-container-lowest space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>

      {/* Table (Desktop) & Cards (Mobile) */}
      <div className="hidden md:block">
        <SkeletonTable rows={6} />
      </div>
      <SkeletonMobileCards count={5} />
    </div>
  );
};

/**
 * Full Page Skeleton for OverviewView
 */
export const SkeletonOverviewView: React.FC = () => {
  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Quick Shorten Bar Skeleton */}
      <div className="p-4 sm:p-6 rounded-2xl border border-surface-container bg-surface-container-lowest shadow-xs space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 w-full sm:w-36 rounded-xl" />
          <Skeleton className="h-12 w-full sm:w-28 rounded-xl" />
        </div>
      </div>

      {/* 4 KPI Cards */}
      <SkeletonKpiGrid count={4} columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />

      {/* Overview Analytics & Recent Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <SkeletonChart height="h-64" title="Traffic Velocity" />
        </div>
        <div className="p-5 rounded-xl border border-surface-container bg-surface-container-lowest shadow-xs space-y-4">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-surface-container/60 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Full Page Skeleton for AnalyticsView
 */
export const SkeletonAnalyticsView: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-surface-container bg-surface-container-lowest shadow-xs">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* 5 KPI Cards */}
      <SkeletonKpiGrid count={5} columns="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5" />

      {/* Main Velocity Chart */}
      <SkeletonChart height="h-72 sm:h-80" title="Click Velocity & Conversions" />

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-5 rounded-xl border border-surface-container bg-surface-container-lowest shadow-xs space-y-3">
            <Skeleton className="h-4 w-28" />
            <div className="space-y-2.5 pt-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-12" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Full Page Skeleton for ClientsView
 */
export const SkeletonClientsView: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* 4 KPI Cards */}
      <SkeletonKpiGrid count={4} columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />

      {/* Action / Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-surface-container bg-surface-container-lowest shadow-xs">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* Client Table / Cards */}
      <div className="hidden md:block">
        <SkeletonTable rows={5} />
      </div>
      <SkeletonMobileCards count={4} />
    </div>
  );
};

/**
 * Full Page Skeleton for TeamsView
 */
export const SkeletonTeamsView: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Workspace Selector Bar */}
      <div className="p-4 rounded-xl border border-surface-container bg-surface-container-lowest shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* 3 Metric Cards */}
      <SkeletonKpiGrid count={3} columns="grid-cols-1 sm:grid-cols-3" />

      {/* Members Roster Table */}
      <div className="hidden md:block">
        <SkeletonTable rows={4} />
      </div>
      <SkeletonMobileCards count={4} />
    </div>
  );
};

/**
 * Full Page Skeleton for CampaignsView
 */
export const SkeletonCampaignsView: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* 4 Metrics Cards */}
      <SkeletonKpiGrid count={4} columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-surface-container bg-surface-container-lowest shadow-xs">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* Campaign Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-5 rounded-xl border border-surface-container bg-surface-container-lowest shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Full Page Skeleton for SettingsView
 */
export const SkeletonSettingsView: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tabs Strip */}
      <div className="flex items-center gap-2 p-1.5 rounded-xl border border-surface-container bg-surface-container-lowest overflow-x-auto">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-lg shrink-0" />
        ))}
      </div>

      {/* Main Settings Card */}
      <div className="p-6 rounded-xl border border-surface-container bg-surface-container-lowest shadow-xs space-y-6">
        <div className="space-y-2 border-b border-surface-container pb-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3.5 w-72" />
        </div>

        <div className="space-y-4 max-w-xl">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>

        <div className="pt-4 flex items-center gap-3">
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

/**
 * Full Page Skeleton for SmartRouting / BulkTools / Security / QR / AI
 */
export const SkeletonGenericView: React.FC<{ title?: string }> = ({ title }) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="p-4 rounded-xl border border-surface-container bg-surface-container-lowest shadow-xs flex items-center justify-between">
        <div className="space-y-1">
          {title ? (
            <h2 className="text-base font-semibold text-on-surface">{title}</h2>
          ) : (
            <Skeleton className="h-5 w-40" />
          )}
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      <SkeletonKpiGrid count={3} columns="grid-cols-1 sm:grid-cols-3" />

      <div className="hidden md:block">
        <SkeletonTable rows={5} />
      </div>
      <SkeletonMobileCards count={4} />
    </div>
  );
};
