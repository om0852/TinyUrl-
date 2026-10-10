'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { Sparkles, Zap, ShieldCheck, ArrowRight, Check } from 'lucide-react';

export const AiSuiteView: React.FC = () => {
  const { aiSuggestSlugs, aiSummarizePerformance, scanUrlSecurity } = useStore();

  const [inputUrl, setInputUrl] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [slugs, setSlugs] = useState<string[]>([]);
  const [summaryText, setSummaryText] = useState('');

  const handleGenerateSlugs = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl) return;
    const res = aiSuggestSlugs(inputUrl, inputTitle);
    setSlugs(res);
  };

  const handleGenerateSummary = () => {
    const text = aiSummarizePerformance();
    setSummaryText(text);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" /> AI Marketing & Optimization Suite
        </h1>
        <p className="text-xs text-slate-400">Generative AI slug suggestions, performance summaries, campaign auto-tagging, and anomaly detection</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* AI Slug Generator */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-400" /> Smart AI Back-Half / Slug Generator
          </h3>

          <form onSubmit={handleGenerateSlugs} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Target Long URL</label>
              <input
                type="url"
                required
                placeholder="https://acme.com/products/wireless-headphones-pro"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Product / Campaign Context</label>
              <input
                type="text"
                placeholder="Wireless Headphones Launch Special"
                value={inputTitle}
                onChange={(e) => setInputTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 gradient-button text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <Sparkles className="w-4 h-4" /> Generate High-Conversion Slugs
            </button>
          </form>

          {slugs.length > 0 && (
            <div className="pt-3 border-t border-white/10 space-y-2 text-xs">
              <span className="font-semibold text-violet-300 block">Generated AI Slugs:</span>
              <div className="flex flex-wrap gap-2">
                {slugs.map((s, idx) => (
                  <div key={idx} className="px-3 py-1.5 bg-violet-600/20 border border-violet-500/40 rounded-xl font-mono text-violet-200">
                    /{s}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Performance Insights */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" /> AI Executive Campaign Performance Breakdown
          </h3>

          <p className="text-xs text-slate-400">
            Click below to generate a natural language summary of your platform traffic patterns, top regions, and unique visitor conversions.
          </p>

          <button
            onClick={handleGenerateSummary}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" /> Synthesize AI Traffic Report
          </button>

          {summaryText && (
            <div className="p-4 bg-slate-950/80 border border-indigo-500/30 rounded-xl text-xs text-slate-200 leading-relaxed">
              {summaryText}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
