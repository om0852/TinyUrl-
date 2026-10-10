'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { Smartphone, Plus, Trash2, ExternalLink, Sparkles, Copy, Check, Eye } from 'lucide-react';

export const LinkInBioView: React.FC = () => {
  const { bioPage, updateBioPage } = useStore();

  const [title, setTitle] = useState(bioPage.title);
  const [bio, setBio] = useState(bioPage.bio);
  const [avatarUrl, setAvatarUrl] = useState(bioPage.avatar_url);
  const [theme, setTheme] = useState(bioPage.theme);
  
  // New Link Item state
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newIcon, setNewIcon] = useState('zap');
  const [copied, setCopied] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateBioPage({
      title,
      bio,
      avatar_url: avatarUrl,
      theme
    });
  };

  const handleAddLinkItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newUrl) return;

    const newItem = {
      id: `bl_${Date.now()}`,
      title: newTitle,
      url: newUrl,
      icon: newIcon,
      active: true
    };

    updateBioPage({
      links: [...bioPage.links, newItem]
    });

    setNewTitle('');
    setNewUrl('');
  };

  const handleRemoveLinkItem = (id: string) => {
    updateBioPage({
      links: bioPage.links.filter(l => l.id !== id)
    });
  };

  const handleToggleLinkActive = (id: string) => {
    updateBioPage({
      links: bioPage.links.map(l => l.id === id ? { ...l, active: !l.active } : l)
    });
  };

  const handleCopyBioUrl = () => {
    const full = `${window.location.origin}/bio/${bioPage.slug}`;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-indigo-400" /> Link-in-Bio Page Builder
          </h1>
          <p className="text-xs text-slate-400">Design mobile-optimized social landing pages with custom themes and real-time click tracking</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyBioUrl}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-2 transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied Bio Link' : 'Copy Bio URL'}
          </button>
          <a
            href={`/bio/${bioPage.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 gradient-button text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            <Eye className="w-4 h-4" /> Live Preview
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Profile Editor Panel */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-6 lg:col-span-2">
          
          {/* Profile Form */}
          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" /> Profile Customization
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Page Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Avatar Image URL</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Bio Description</label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white resize-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Color Theme</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
              >
                <option value="cyberpunk">Cyberpunk Neon Dark</option>
                <option value="dark">Classic Dark Glass</option>
                <option value="emerald">Minimal Emerald Forest</option>
                <option value="sunset">Sunset Deep Crimson</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs"
            >
              Save Profile Changes
            </button>
          </form>

          {/* Add Link Item */}
          <div className="pt-4 border-t border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" /> Add Link Tree Item
            </h3>

            <form onSubmit={handleAddLinkItem} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <input
                  type="text"
                  required
                  placeholder="Button Label (e.g. 50% Off Sale)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div>
                <input
                  type="url"
                  required
                  placeholder="Target URL (https://...)"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <button
                type="submit"
                className="py-2 gradient-button text-white font-semibold rounded-xl"
              >
                Add Button Link
              </button>
            </form>
          </div>

          {/* Links List */}
          <div className="space-y-2 text-xs">
            {bioPage.links.map((item) => (
              <div key={item.id} className="p-3 bg-slate-900/80 border border-white/10 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={item.active}
                    onChange={() => handleToggleLinkActive(item.id)}
                    className="rounded accent-indigo-500"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{item.title}</p>
                    <p className="font-mono text-[10px] text-slate-400 truncate">{item.url}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveLinkItem(item.id)}
                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

        </div>

        {/* Mobile Device Frame Preview */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col items-center justify-center">
          <div className="w-full max-w-[280px] bg-black rounded-[36px] p-4 border-4 border-slate-700 shadow-2xl relative">
            <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-4"></div>
            
            {/* Live Mobile Profile Screen */}
            <div className="space-y-4 text-center py-2">
              <img
                src={avatarUrl}
                alt={title}
                className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-indigo-500"
              />
              <div>
                <h4 className="text-xs font-bold text-white">{title}</h4>
                <p className="text-[10px] text-slate-400 line-clamp-2 px-2 mt-0.5">{bio}</p>
              </div>

              <div className="space-y-2">
                {bioPage.links.filter(l => l.active).map(l => (
                  <div key={l.id} className="p-2.5 bg-slate-900 border border-white/10 rounded-xl text-[10px] font-semibold text-white truncate shadow">
                    {l.title}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
