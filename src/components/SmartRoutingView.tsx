'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { 
  GitFork, 
  Plus, 
  Smartphone, 
  Globe, 
  Percent, 
  Trash2, 
  Check, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

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
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <GitFork className="w-5 h-5 text-indigo-400" /> Smart Routing & A/B Traffic Splitter
        </h1>
        <p className="text-xs text-slate-400">Direct traffic dynamically based on device (iOS/Android), country, or weighted split testing</p>
      </div>

      {/* Target Link Selector */}
      <div className="glass-panel p-4 rounded-xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <label className="text-xs font-semibold text-slate-300">Select Link to Configure Rules:</label>
        <select
          value={selectedLinkId}
          onChange={(e) => setSelectedLinkId(e.target.value)}
          className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none w-full sm:w-80 font-mono"
        >
          {links.map(l => (
            <option key={l.id} value={l.id}>{l.title} (/r/{l.short_code})</option>
          ))}
        </select>
      </div>

      {currentLink && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Add Rule Form */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-400" /> Add Routing Rule
            </h3>

            {msg && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4" /> {msg}
              </div>
            )}

            <form onSubmit={handleAddRule} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Rule Engine Type</label>
                <select
                  value={ruleType}
                  onChange={(e) => {
                    const t = e.target.value as any;
                    setRuleType(t);
                    if (t === 'device') setCondition('iOS');
                    else if (t === 'geo') setCondition('US');
                    else setCondition('A/B Split');
                  }}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                >
                  <option value="device">Device Targeting (iOS / Android / Desktop)</option>
                  <option value="geo">Geo Location (US / UK / IN / DE)</option>
                  <option value="ab">A/B Split Testing (% Traffic Split)</option>
                </select>
              </div>

              {ruleType === 'device' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Device OS</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="iOS">Apple iOS (iPhone / iPad)</option>
                    <option value="Android">Google Android</option>
                    <option value="Desktop">Desktop (Windows / macOS / Linux)</option>
                  </select>
                </div>
              )}

              {ruleType === 'geo' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Country Code</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="US">United States (US)</option>
                    <option value="UK">United Kingdom (UK)</option>
                    <option value="IN">India (IN)</option>
                    <option value="DE">Germany (DE)</option>
                    <option value="JP">Japan (JP)</option>
                  </select>
                </div>
              )}

              {ruleType === 'ab' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Traffic Weight Allocation ({weight}%)</label>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="10"
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Destination Target URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://apps.apple.com/app/custom-link"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 gradient-button text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                <GitFork className="w-4 h-4" /> Save Smart Rule
              </button>
            </form>
          </div>

          {/* Active Rules List */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" /> Active Routing Rules for <code className="text-indigo-400">/r/{currentLink.short_code}</code>
              </span>
              <span className="text-xs text-slate-400 font-normal">Default Fallback: {currentLink.destination_url}</span>
            </h3>

            {!currentLink.rules || currentLink.rules.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-white/5">
                No active smart rules set for this link. All visitors will be directed to default URL.
              </div>
            ) : (
              <div className="space-y-3">
                {currentLink.rules.map((rule) => (
                  <div key={rule.id} className="p-4 bg-slate-900/80 border border-white/10 rounded-xl flex items-center justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 font-bold uppercase text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">
                          {rule.rule_type}
                        </span>
                        <span className="font-semibold text-white">Condition: {rule.condition}</span>
                        {rule.weight && <span className="text-slate-400 font-mono">({rule.weight}% traffic)</span>}
                      </div>
                      <p className="font-mono text-slate-400 text-[11px] truncate max-w-md">{rule.target_url}</p>
                    </div>

                    <button
                      onClick={() => removeRuleFromLink(currentLink.id, rule.id)}
                      className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition"
                      title="Remove Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
