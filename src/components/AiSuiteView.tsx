'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { Sparkles, Zap, Check } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export const AiSuiteView: React.FC = () => {
  const { aiSuggestSlugs, aiSummarizePerformance } = useStore();

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
    <div className="space-y-8 animate-fade-in text-foreground">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> AI Intelligence &amp; Traffic Optimization Suite
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Generative AI slug suggestions, executive performance summaries, campaign auto-tagging, and anomaly detection.
          </p>
        </div>

        <Badge variant="primary" className="px-3 py-1 text-xs">
          Neural Intelligence Active
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* AI Slug Generator */}
        <Card className="p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border/40">
            <Zap className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Smart AI Slug Generator</h3>
          </div>

          <form onSubmit={handleGenerateSlugs} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Target Long URL</label>
              <input
                type="url"
                required
                placeholder="https://acme.com/products/wireless-headphones-pro"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="w-full h-10 px-3.5 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Context or Campaign Title (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Black Friday Special Promo"
                value={inputTitle}
                onChange={(e) => setInputTitle(e.target.value)}
                className="w-full h-10 px-3.5 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full text-xs font-bold"
            >
              <Sparkles className="w-4 h-4 mr-2" /> Generate Branded Slug Ideas
            </Button>
          </form>

          {slugs.length > 0 && (
            <div className="pt-3 border-t border-border/40 space-y-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">Generated High-CTR Slugs:</span>
              <div className="flex flex-wrap gap-2">
                {slugs.map((s, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-muted/40 text-foreground border border-border/60 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 text-primary" /> /{s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* AI Performance Summary */}
        <Card className="p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border/40">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">AI Executive Traffic Briefing</h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Analyzes multi-region click timestamps, top referring domains, and anomaly patterns to draft an executive narrative briefing.
            </p>

            <Button
              variant="outline"
              size="default"
              onClick={handleGenerateSummary}
              className="w-full"
            >
              <Sparkles className="w-4 h-4 mr-2 text-primary" /> Run Anomaly &amp; Performance Audit
            </Button>

            {summaryText && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl space-y-2 animate-fade-in text-xs">
                <span className="font-bold text-primary block text-xs">Executive Summary Generated:</span>
                <p className="text-foreground leading-relaxed font-medium">
                  {summaryText}
                </p>
              </div>
            )}
          </div>
        </Card>

      </div>

    </div>
  );
};
