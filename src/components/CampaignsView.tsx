'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { FolderKanban, Plus, Users, Target, Shield, Check } from 'lucide-react';

export const CampaignsView: React.FC = () => {
  const { campaigns, addCampaign, currentWorkspace } = useStore();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [tagsInput, setTagsInput] = useState('promo, saas');
  const [targetClicks, setTargetClicks] = useState(25000);
  const [msg, setMsg] = useState('');

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    addCampaign(name, desc, tags, Number(targetClicks));

    setName('');
    setDesc('');
    setMsg('Campaign created successfully!');
    setTimeout(() => setMsg(''), 3000);
  };

  const teamMembers = [
    { name: 'Alex Morgan', email: 'alex@acme.com', role: 'Owner', avatar: 'AM' },
    { name: 'Sarah Jenkins', email: 'sarah@acme.com', role: 'Admin', avatar: 'SJ' },
    { name: 'Dave Miller', email: 'dave@acme.com', role: 'Editor', avatar: 'DM' },
    { name: 'Client Analyst', email: 'analyst@client.com', role: 'Viewer', avatar: 'CA' }
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FolderKanban className="w-5 h-5 text-indigo-400" /> Campaigns & Workspace Team Access
        </h1>
        <p className="text-xs text-slate-400">Group short links into marketing campaigns and manage role permissions (Owner, Admin, Editor, Viewer)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Create Campaign */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-400" /> Create New Campaign
          </h3>

          {msg && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" /> {msg}
            </div>
          )}

          <form onSubmit={handleCreateCampaign} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Campaign Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Q4 Growth Sprint"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Description</label>
              <textarea
                rows={2}
                placeholder="Campaign goals & retargeting strategy"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white resize-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Target Clicks Goal</label>
              <input
                type="number"
                value={targetClicks}
                onChange={(e) => setTargetClicks(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 gradient-button text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <FolderKanban className="w-4 h-4" /> Create Campaign Folder
            </button>
          </form>
        </div>

        {/* Active Campaigns List */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-violet-400" /> Active Workspace Campaigns ({campaigns.length})
          </h3>

          <div className="space-y-4">
            {campaigns.map((camp) => (
              <div key={camp.id} className="p-4 bg-slate-900/80 border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">{camp.name}</h4>
                    <p className="text-xs text-slate-400">{camp.description}</p>
                  </div>
                  <span className="px-2.5 py-1 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                    Target: {camp.target_clicks.toLocaleString()} clicks
                  </span>
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full w-[45%] rounded-full"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Team Roles */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" /> Workspace Team Roles ({currentWorkspace.name})
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {teamMembers.map((m, idx) => (
                <div key={idx} className="p-3 bg-slate-900/70 border border-white/5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 text-indigo-300 font-bold flex items-center justify-center text-[10px]">
                      {m.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{m.name}</p>
                      <p className="text-[10px] text-slate-400">{m.email}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-800 text-slate-300 rounded uppercase">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
