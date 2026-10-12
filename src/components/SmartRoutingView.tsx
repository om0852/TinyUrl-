'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { 
  GitFork, 
  Trash2, 
  Check, 
  Sparkles,
  Link2,
  Smartphone
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export const SmartRoutingView: React.FC = () => {
  const { links, addRuleToLink, removeRuleFromLink } = useStore();
  const [selectedLinkId, setSelectedLinkId] = useState<string>(links[0]?.id || '');
  
  // Rule Form state
  const [ruleType, setRuleType] = useState<'device' | 'geo' | 'ab'>('device');
  const [condition, setCondition] = useState('iOS');
  const [targetUrl, setTargetUrl] = useState('');
  const [weight, setWeight] = useState(50);
  const [msg, setMsg] = useState('');

  const currentLink = links.find(l => l.id === selectedLinkId) || links[0];

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl || !currentLink) return;

    addRuleToLink(currentLink.id, {
      rule_type: ruleType,
      condition,
      target_url: targetUrl,
      weight: ruleType === 'ab' ? Number(weight) : undefined
    });

    setTargetUrl('');
    setMsg('Smart routing rule added successfully!');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="space-y-8 animate-fade-in text-foreground">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" /> OpeninApp &amp; Smart Routing Console
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Direct traffic dynamically based on device (iOS/Android), country geolocation, or weighted split testing.
          </p>
        </div>

        <Badge variant="primary" className="px-3 py-1 text-xs">
          Edge Routing Active
        </Badge>
      </div>

      {/* Target Link Selector Card */}
      <Card className="p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <label className="text-xs font-semibold text-foreground flex items-center gap-2 shrink-0">
          <Link2 className="w-4 h-4 text-primary" /> Select Link to Configure Rules:
        </label>
        
        <select
          value={selectedLinkId}
          onChange={(e) => setSelectedLinkId(e.target.value)}
          className="h-9 px-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs font-semibold text-foreground focus:outline-none cursor-pointer w-full sm:w-80 truncate"
        >
          {links.map((link) => (
            <option key={link.id} value={link.id}>
              {link.title} (/{link.short_code})
            </option>
          ))}
        </select>
      </Card>

      {currentLink && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Add Rule Form Card */}
          <Card className="p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border/40">
              <GitFork className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Add Dynamic Condition</h3>
            </div>

            {msg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4" /> {msg}
              </div>
            )}

            <form onSubmit={handleAddRule} className="space-y-4 text-xs">
              <div>
                <label className="block text-foreground font-semibold text-xs mb-1.5">Rule Strategy</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/30 border border-border/40 rounded-lg">
                  {(['device', 'geo', 'ab'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setRuleType(type);
                        if (type === 'device') setCondition('iOS');
                        if (type === 'geo') setCondition('US');
                        if (type === 'ab') setCondition('50/50 Split');
                      }}
                      className={`h-7 rounded-md text-[11px] font-semibold transition uppercase cursor-pointer ${
                        ruleType === type
                          ? 'bg-card text-foreground shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Condition Selector */}
              {ruleType === 'device' && (
                <div>
                  <label className="block text-foreground font-semibold text-xs mb-1.5">Target OS Platform</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full h-9 px-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground outline-none"
                  >
                    <option value="iOS">Apple iOS (iPhone/iPad)</option>
                    <option value="Android">Google Android Device</option>
                    <option value="Windows">Microsoft Windows</option>
                    <option value="macOS">Apple macOS</option>
                  </select>
                </div>
              )}

              {ruleType === 'geo' && (
                <div>
                  <label className="block text-foreground font-semibold text-xs mb-1.5">Country / Geolocation</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full h-9 px-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground outline-none"
                  >
                    <option value="US">United States (US)</option>
                    <option value="IN">India (IN)</option>
                    <option value="GB">United Kingdom (GB)</option>
                    <option value="DE">Germany (DE)</option>
                    <option value="CA">Canada (CA)</option>
                  </select>
                </div>
              )}

              {ruleType === 'ab' && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5 font-semibold text-foreground">
                    <span>A/B Traffic Allocation</span>
                    <span className="font-mono text-primary">{weight}% Variant</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="10"
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              )}

              <div>
                <label className="block text-foreground font-semibold text-xs mb-1.5">Destination Target URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://apps.apple.com/app/custom_link"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="w-full h-9 px-3 bg-background border border-border/60 focus:border-primary rounded-lg text-foreground text-xs placeholder:text-muted-foreground/60 outline-none transition"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full text-xs font-bold mt-2"
              >
                <GitFork className="w-3.5 h-3.5 mr-1.5" /> Save Smart Rule
              </Button>
            </form>
          </Card>

          {/* Active Rules List Card */}
          <Card className="p-6 shadow-sm lg:col-span-2 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/40">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-bold text-foreground truncate">
                    Active Routing Rules for <code className="text-primary font-mono font-semibold">/{currentLink.short_code}</code>
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate shrink-0 max-w-xs font-mono">
                  Fallback: <span className="text-foreground">{currentLink.destination_url}</span>
                </div>
              </div>

              {!currentLink.rules || currentLink.rules.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground text-xs bg-muted/10 rounded-xl border border-dashed border-border/50">
                  No active smart rules set for this link. All visitors will be directed to default URL.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {currentLink.rules.map((rule) => (
                    <div 
                      key={rule.id} 
                      className="p-3.5 bg-muted/20 border border-border/40 hover:border-border rounded-xl flex items-center justify-between gap-3 text-xs transition"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="primary" className="text-[9px]">
                            {rule.rule_type}
                          </Badge>
                          <span className="font-semibold text-foreground text-xs truncate">
                            Condition: {rule.condition}
                          </span>
                          {rule.weight && (
                            <span className="text-muted-foreground text-[11px] shrink-0 font-mono">
                              ({rule.weight}% traffic)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate max-w-md font-mono">
                          {rule.target_url}
                        </p>
                      </div>

                      <button
                        onClick={() => removeRuleFromLink(currentLink.id, rule.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition shrink-0 cursor-pointer"
                        title="Remove Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </Card>

        </div>
      )}

    </div>
  );
};
