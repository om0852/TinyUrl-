'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { getShortUrlPrefix } from '@/lib/db';
import { 
  Link2, 
  MousePointerClick, 
  Users, 
  Zap, 
  ShieldCheck, 
  FolderKanban, 
  TrendingUp, 
  Copy, 
  Check, 
  ArrowUpRight, 
  QrCode,
  Pencil,
  Globe,
  Send,
  ExternalLink
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface OverviewViewProps {
  onOpenCreateModal: () => void;
  onNavigateTab: (tab: any) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onOpenCreateModal, onNavigateTab }) => {
  const { links, clicks, campaigns, domains, createShortLink } = useStore();
  
  const [activeFormTab, setActiveFormTab] = useState<'shorten' | 'qr'>('shorten');
  const [longUrl, setLongUrl] = useState('');
  const [selectedDomain, setSelectedDomain] = useState(domains[0]?.hostname || 'localhost:3000');
  const [alias, setAlias] = useState('');
  const [createdResult, setCreatedResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    if (domains.length > 0 && (!selectedDomain || selectedDomain === 'tinyurl.com')) {
      setSelectedDomain(domains[0].hostname);
    }
  }, [domains]);

  const totalClicks = clicks.length + links.reduce((sum, l) => sum + l.clicks_count, 0);
  const totalUnique = clicks.filter(c => c.is_unique).length;
  const uniqueRatio = clicks.length > 0 ? Math.round((totalUnique / clicks.length) * 100) : 74;

  const handleShortenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!longUrl) return;

    if (alias && alias.length < 5) {
      setErrorMsg('Alias must be at least 5 characters');
      return;
    }

    const domainObj = domains.find(d => d.hostname === selectedDomain);
    const res = createShortLink({
      destination_url: longUrl,
      custom_slug: alias || undefined,
      domain_id: domainObj?.id
    });

    if (res.error) {
      setErrorMsg(res.error);
    } else if (res.link) {
      const prefix = getShortUrlPrefix(selectedDomain);
      const fullUrl = `${prefix}/${res.link.short_code}`;
      setCreatedResult(fullUrl);
      setLongUrl('');
      setAlias('');
    }
  };

  const handleCopy = () => {
    if (createdResult) {
      navigator.clipboard.writeText(createdResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Mock trend data for chart
  const chartData = [
    { day: 'Oct 03', clicks: 1200, unique: 940 },
    { day: 'Oct 04', clicks: 2100, unique: 1650 },
    { day: 'Oct 05', clicks: 1800, unique: 1320 },
    { day: 'Oct 06', clicks: 3400, unique: 2700 },
    { day: 'Oct 07', clicks: 4200, unique: 3100 },
    { day: 'Oct 08', clicks: 3900, unique: 2950 },
    { day: 'Oct 09', clicks: 5800, unique: 4400 }
  ];

  return (
    <div className="space-y-8">
      
      {/* TinyURL Hero Section matching exact uploaded image layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2 pb-6">
        
        {/* Hero Left Content */}
        <div className="lg:col-span-6 space-y-5">
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            URL Shortener, Branded Short Links &amp; Analytics
          </h1>
          
          <p className="text-slate-200 text-sm md:text-base leading-relaxed font-medium">
            Welcome to the original link shortener — simplifying the Internet through the power of the URL since 2002.
          </p>

          <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
            You can use branded domains for fully custom links, track link analytics, and enjoy other powerful features with our paid plans.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button 
              onClick={() => onNavigateTab('campaigns')}
              className="tinyurl-btn-white px-6 py-3 rounded-lg text-sm font-bold shadow-lg"
            >
              View Plans
            </button>
            <button 
              onClick={onOpenCreateModal}
              className="tinyurl-btn-teal px-6 py-3 rounded-lg text-sm font-bold shadow-lg"
            >
              Create Free Account
            </button>
          </div>
        </div>

        {/* Hero Right Floating Tabbed Shortener Widget */}
        <div className="lg:col-span-6">
          <div className="bg-white text-[#0c2333] rounded-xl shadow-2xl overflow-hidden border border-white/20">
            
            {/* Widget Tabs Header */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setActiveFormTab('shorten')}
                className={`flex-1 py-3.5 px-4 font-bold text-sm flex items-center justify-center gap-2 transition ${
                  activeFormTab === 'shorten'
                    ? 'bg-white text-[#0c2333] border-b-2 border-transparent'
                    : 'bg-[#008296] text-white hover:bg-[#007284]'
                }`}
              >
                <Link2 className="w-4 h-4 transform -rotate-45" />
                <span>Shorten a Link</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveFormTab('qr');
                  onNavigateTab('qr');
                }}
                className={`flex-1 py-3.5 px-4 font-bold text-sm flex items-center justify-center gap-2 transition ${
                  activeFormTab === 'qr'
                    ? 'bg-white text-[#0c2333]'
                    : 'bg-[#008296] text-white hover:bg-[#007284]'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Generate QR Code</span>
              </button>
            </div>

            {/* Widget Form Body */}
            <form onSubmit={handleShortenSubmit} className="p-6 space-y-4">
              
              {/* Field 1: Long URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#0c2333] flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-[#008296]" />
                  <span>Long URL</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="Paste long URL here"
                  value={longUrl}
                  onChange={(e) => setLongUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-[#008296] focus:bg-white rounded-lg text-sm text-[#0c2333] placeholder-slate-400 focus:outline-none transition shadow-sm"
                />
              </div>

              {/* Custom Alias Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#0c2333] flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5 text-[#008296]" />
                  <span>Custom Alias (optional)</span>
                </label>
                <div className="flex items-center">
                  <span className="px-3.5 py-2.5 bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg text-xs font-mono font-bold text-slate-600 select-none">
                    {domains[0]?.hostname || 'localhost:3000'}/
                  </span>
                  <input
                    type="text"
                    placeholder="Add alias here"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 focus:border-[#008296] focus:bg-white rounded-r-lg text-sm text-[#0c2333] font-mono placeholder-slate-400 focus:outline-none transition shadow-sm"
                  />
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Must be at least 5 characters if specified</p>
              </div>

              {/* Error Message if any */}
              {errorMsg && (
                <p className="text-red-600 text-xs font-semibold">{errorMsg}</p>
              )}

              {/* Created Result Banner */}
              {createdResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-bold text-emerald-800 truncate">{createdResult}</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="tinyurl-btn-green px-3 py-1 rounded text-xs flex items-center gap-1 shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}

              {/* Green Submit Button */}
              <button
                type="submit"
                className="w-full py-3.5 tinyurl-btn-green text-white font-bold text-sm rounded-lg shadow-md transition transform active:scale-[0.99] flex items-center justify-center gap-2"
              >
                Shorten Link
              </button>

              {/* Legal Disclaimer */}
              <p className="text-[11px] text-slate-500 text-center leading-snug pt-1">
                By clicking Shorten Link, you agree with our{' '}
                <a href="/terms" className="text-[#008296] underline hover:text-[#006878]">Terms of Service</a>,{' '}
                <a href="/privacy" className="text-[#008296] underline hover:text-[#006878]">Privacy Policy</a>, and{' '}
                <span className="text-[#008296] cursor-pointer underline">Use of Cookies</span>.
              </p>
            </form>
          </div>
        </div>

      </div>

      {/* Section Subhead: Your Recent Links & Dashboard Performance */}
      <div className="space-y-4 pt-4 border-t border-[#0c3d59]">
        
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white tracking-tight">
            Your Recent Links &amp; Analytics Overview
          </h2>
          <button
            onClick={() => onNavigateTab('links')}
            className="text-xs font-bold text-cyan-300 hover:text-white flex items-center gap-1 bg-[#07334a] px-3 py-1.5 rounded-lg border border-white/10"
          >
            Manage All Links <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          
          <div className="bg-[#072e42] p-4 rounded-xl border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-xs font-semibold">Total Links</span>
              <Link2 className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-black text-white">{links.length}</p>
            <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +14% this month
            </p>
          </div>

          <div className="bg-[#072e42] p-4 rounded-xl border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-xs font-semibold">Total Clicks</span>
              <MousePointerClick className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-white">{totalClicks.toLocaleString()}</p>
            <p className="text-[10px] text-emerald-400 font-bold">Real-time pipeline</p>
          </div>

          <div className="bg-[#072e42] p-4 rounded-xl border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-xs font-semibold">Unique Ratio</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-black text-white">{uniqueRatio}%</p>
            <p className="text-[10px] text-slate-300 font-medium">Hashed Visitors</p>
          </div>

          <div className="bg-[#072e42] p-4 rounded-xl border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-xs font-semibold">Avg Latency</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black text-emerald-400">21ms</p>
            <p className="text-[10px] text-slate-300 font-medium">Redis Cache Hit</p>
          </div>

          <div className="bg-[#072e42] p-4 rounded-xl border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-xs font-semibold">Safe Browsing</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-white">100%</p>
            <p className="text-[10px] text-slate-300 font-medium">Malware Shield</p>
          </div>

          <div className="bg-[#072e42] p-4 rounded-xl border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-xs font-semibold">Campaigns</span>
              <FolderKanban className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-black text-white">{campaigns.length}</p>
            <p className="text-[10px] text-cyan-300 font-medium">Active tracking</p>
          </div>

        </div>

        {/* Graph & Top Links Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          
          {/* Click Trends Chart */}
          <div className="bg-[#072e42] p-5 rounded-xl border border-white/10 lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" /> Traffic &amp; Redirect Click Analytics
                </h3>
                <p className="text-xs text-slate-300">Asynchronous non-blocking event log execution</p>
              </div>
              <button
                onClick={() => onNavigateTab('analytics')}
                className="text-xs text-cyan-300 hover:text-white font-bold flex items-center gap-1"
              >
                Detailed Report <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#008296" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#008296" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorUnique" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e8a4c" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#1e8a4c" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="#85a4b5" fontSize={11} tickLine={false} />
                  <YAxis stroke="#85a4b5" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#052536', borderColor: '#0b3d56', borderRadius: '8px', fontSize: '12px', color: '#ffffff' }} 
                    labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="clicks" name="Total Clicks" stroke="#008296" strokeWidth={3} fillOpacity={1} fill="url(#colorClicks)" />
                  <Area type="monotone" dataKey="unique" name="Unique Visitors" stroke="#1e8a4c" strokeWidth={2} fillOpacity={1} fill="url(#colorUnique)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Short Links List */}
          <div className="bg-[#072e42] p-5 rounded-xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Link2 className="w-4 h-4 text-cyan-400" /> Recent Short Links
              </h3>
              <button
                onClick={() => onNavigateTab('links')}
                className="text-xs text-cyan-300 hover:text-white font-bold"
              >
                View All
              </button>
            </div>

            <div className="space-y-3">
              {links.slice(0, 4).map((link) => (
                <div key={link.id} className="p-3 bg-[#052536] hover:bg-[#093750] border border-white/10 rounded-lg flex items-center justify-between gap-3 text-xs transition">
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{link.title}</p>
                    <p className="font-mono text-[11px] text-cyan-300 truncate">/r/{link.short_code}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-white">{link.clicks_count.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400">clicks</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
