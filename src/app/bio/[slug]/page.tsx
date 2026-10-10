'use client';

import React, { useState, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/storeContext';
import { ExternalLink, Zap, Book, Camera, Briefcase, Sparkles, Share2, Check } from 'lucide-react';

function BioPageInner() {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { bioPage, logClick } = useStore();
  const [copied, setCopied] = useState(false);

  // Theme styling configurations
  const themes = {
    dark: 'bg-[#090d16] text-white',
    cyberpunk: 'bg-gradient-to-b from-[#090d16] via-[#111827] to-[#0f172a] text-white',
    emerald: 'bg-gradient-to-b from-[#022c22] via-[#064e3b] to-[#090d16] text-white',
    sunset: 'bg-gradient-to-b from-[#450a0a] via-[#78350f] to-[#090d16] text-white'
  };

  const currentTheme = themes[bioPage.theme || 'cyberpunk'];

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'zap': return <Zap className="w-5 h-5 text-amber-400" />;
      case 'book': return <Book className="w-5 h-5 text-indigo-400" />;
      case 'instagram': return <Camera className="w-5 h-5 text-pink-400" />;
      case 'briefcase': return <Briefcase className="w-5 h-5 text-emerald-400" />;
      default: return <Sparkles className="w-5 h-5 text-cyan-400" />;
    }
  };

  const handleLinkClick = (url: string, title: string) => {
    logClick(`bio_${slug}`, { referrer: 'Link-in-Bio Page' });
    window.open(url, '_blank');
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`min-h-screen ${currentTheme} flex flex-col items-center justify-center p-4 transition-all duration-300`}>
      <div className="max-w-md w-full glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl relative">
        
        {/* Share Button */}
        <button
          onClick={handleShare}
          className="absolute top-4 right-4 p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-slate-300 transition"
          title="Share profile"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
        </button>

        {/* Profile Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-4">
            <img
              src={bioPage.avatar_url}
              alt={bioPage.title}
              className="w-24 h-24 rounded-full object-cover border-4 border-indigo-500/40 shadow-xl"
            />
            <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-indigo-500 to-violet-500 p-1.5 rounded-full text-white">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">{bioPage.title}</h1>
          <p className="text-slate-300 text-sm max-w-xs leading-relaxed">{bioPage.bio}</p>
        </div>

        {/* Link Tree Items */}
        <div className="space-y-3 mb-8">
          {bioPage.links.filter(l => l.active).map((item) => (
            <button
              key={item.id}
              onClick={() => handleLinkClick(item.url, item.title)}
              className="w-full group p-4 bg-slate-900/80 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/50 rounded-2xl flex items-center justify-between text-left transition-all duration-300 hover:scale-[1.02] shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 group-hover:border-indigo-500/30">
                  {getIcon(item.icon)}
                </div>
                <span className="font-semibold text-white text-sm group-hover:text-indigo-200 transition">
                  {item.title}
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition" />
            </button>
          ))}
        </div>

        {/* Footer Branding */}
        <div className="text-center border-t border-white/10 pt-4">
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
            Powered by <span className="font-semibold text-indigo-400">URL Shortener Platform</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BioPageView() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090d16] flex items-center justify-center text-white text-sm">Loading Bio Page...</div>}>
      <BioPageInner />
    </Suspense>
  );
}
