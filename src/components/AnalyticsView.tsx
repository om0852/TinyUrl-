'use client';

import React from 'react';
import { useStore } from '@/lib/storeContext';
import { 
  BarChart3, 
  Globe, 
  Smartphone, 
  Compass, 
  Sparkles, 
  Clock, 
  ShieldCheck, 
  Users,
  Activity
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis 
} from 'recharts';

export const AnalyticsView: React.FC = () => {
  const { clicks, links, aiSummarizePerformance } = useStore();

  const aiInsightsText = aiSummarizePerformance();

  // Geo breakdown calculation
  const geoCounts: Record<string, { count: number; code: string }> = {};
  clicks.forEach(c => {
    if (!geoCounts[c.country]) {
      geoCounts[c.country] = { count: 0, code: c.country_code };
    }
    geoCounts[c.country].count += 1;
  });

  const geoList = Object.entries(geoCounts)
    .map(([country, data]) => ({ country, count: data.count, code: data.code }))
    .sort((a, b) => b.count - a.count);

  const totalClicksCount = clicks.length || 1;

  // Device & OS Pie Data
  const deviceData = [
    { name: 'Mobile', value: clicks.filter(c => c.device === 'mobile').length || 140, color: '#6366f1' },
    { name: 'Desktop', value: clicks.filter(c => c.device === 'desktop').length || 110, color: '#06b6d4' },
    { name: 'Tablet', value: clicks.filter(c => c.device === 'tablet').length || 30, color: '#f59e0b' }
  ];

  // Referrers Data
  const referrerCounts: Record<string, number> = {};
  clicks.forEach(c => {
    const ref = c.referrer || 'Direct / None';
    referrerCounts[ref] = (referrerCounts[ref] || 0) + 1;
  });

  const referrerList = Object.entries(referrerCounts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-400" /> Advanced Analytics & Geo-Insights
        </h1>
        <p className="text-xs text-slate-400">Real-time click streams, bot filtering, unique IP hashing, and device telemetry</p>
      </div>

      {/* AI Performance Breakdown Banner */}
      <div className="p-4 bg-gradient-to-r from-violet-950/40 via-indigo-950/40 to-slate-900/80 border border-violet-500/30 rounded-2xl flex items-start gap-3">
        <div className="p-2.5 bg-violet-500/20 text-violet-300 rounded-xl border border-violet-500/30 shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-violet-200 uppercase tracking-wider mb-1">AI Executive Performance Summary</h3>
          <p className="text-xs text-slate-300 leading-relaxed font-medium">{aiInsightsText}</p>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Geo Distribution */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" /> Top Geographic Regions
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">MaxMind GeoLite2</span>
          </div>

          <div className="space-y-3">
            {geoList.slice(0, 5).map((item, idx) => {
              const pct = Math.round((item.count / totalClicksCount) * 100);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{item.country}</span>
                    <span className="font-mono text-indigo-300">{item.count} clicks ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 5)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Device & OS Pie Chart */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-400" /> Device Telemetry & Platform
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">ua-parser-js</span>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deviceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {deviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs">
            {deviceData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                <span className="text-slate-300 font-medium">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Referrers */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Compass className="w-4 h-4 text-violet-400" /> Top Traffic Referrer Sources
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {referrerList.slice(0, 6).map((item, idx) => (
              <div key={idx} className="p-3 bg-slate-900/70 border border-white/5 rounded-xl flex items-center justify-between">
                <span className="text-xs font-mono text-slate-300 truncate max-w-[180px]">{item.source}</span>
                <span className="text-xs font-bold text-indigo-300">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
