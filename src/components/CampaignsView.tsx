'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { InviteMemberModal } from '@/components/InviteMemberModal';
import { CreateTeamModal } from '@/components/CreateTeamModal';
import { 
  FolderKanban, 
  Plus, 
  Users, 
  Target, 
  Check, 
  UserPlus, 
  Layers, 
  Trash2,
  Building2,
  ShieldCheck,
  Link2
} from 'lucide-react';

export const CampaignsView: React.FC = () => {
  const { campaigns, addCampaign, currentWorkspace, teamMembers, removeTeamMember, links } = useStore();
  
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [targetClicks, setTargetClicks] = useState(25000);
  const [msg, setMsg] = useState('');

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    addCampaign(name, desc, ['campaign', 'team'], Number(targetClicks));

    setName('');
    setDesc('');
    setMsg('Campaign created and assigned to active workspace!');
    setTimeout(() => setMsg(''), 3000);
  };

  const activeWorkspaceCampaigns = campaigns.filter(c => c.workspace_id === currentWorkspace.id || true);

  return (
    <div className="space-y-6 selection:bg-[#008296]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#072e42] p-5 rounded-2xl border border-[#0b4566] shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2 font-sans">
            <FolderKanban className="w-5 h-5 text-cyan-400" /> Campaigns & Workspace Team Access
          </h1>
          <p className="text-xs text-slate-300">
            Active Workspace: <strong className="text-cyan-300 font-semibold">{currentWorkspace.name}</strong> ({currentWorkspace.plan.toUpperCase()} Tier)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setInviteModalOpen(true)}
            className="tinyurl-btn-teal text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold shadow-md"
          >
            <UserPlus className="w-4 h-4" /> Invite Team Member
          </button>
          
          <button
            onClick={() => setCreateTeamModalOpen(true)}
            className="bg-[#052536] hover:bg-[#07334a] text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold text-slate-100 border border-white/10 transition"
          >
            <Building2 className="w-4 h-4 text-cyan-400" /> New Workspace
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Create Campaign */}
        <div className="bg-[#072e42] p-5 rounded-2xl border border-[#0b4566] shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-cyan-400" /> Create Workspace Campaign
          </h3>

          {msg && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2 font-semibold">
              <Check className="w-4 h-4" /> {msg}
            </div>
          )}

          <form onSubmit={handleCreateCampaign} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Campaign Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Q4 Product Launch Sprint"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#052536] border border-white/15 focus:border-[#008296] rounded-xl text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Campaign Description</label>
              <textarea
                rows={2}
                placeholder="Marketing strategy & attribution goals"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#052536] border border-white/15 focus:border-[#008296] rounded-xl text-white outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Target Click Goal</label>
              <input
                type="number"
                value={targetClicks}
                onChange={(e) => setTargetClicks(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#052536] border border-white/15 focus:border-[#008296] rounded-xl text-white font-mono outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 tinyurl-btn-teal text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md text-xs"
            >
              <FolderKanban className="w-4 h-4" /> Add Campaign to Team
            </button>
          </form>
        </div>

        {/* Active Campaigns & Team Members */}
        <div className="bg-[#072e42] p-5 rounded-2xl border border-[#0b4566] shadow-xl lg:col-span-2 space-y-6">
          
          {/* Active Campaigns */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400" /> Active Team Campaigns ({activeWorkspaceCampaigns.length})
              </h3>
              <span className="text-[11px] text-slate-300 font-mono">
                {links.length} total short links tracked
              </span>
            </div>

            <div className="space-y-3">
              {activeWorkspaceCampaigns.map((camp) => {
                const assignedLinks = links.filter(l => l.campaign_id === camp.id).length;
                return (
                  <div key={camp.id} className="p-4 bg-[#052536] border border-white/10 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{camp.name}</h4>
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-[#008296]/20 text-cyan-300 border border-cyan-500/30 rounded uppercase">
                            {assignedLinks} Links Assigned
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">{camp.description}</p>
                      </div>
                      <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                        Target: {camp.target_clicks.toLocaleString()} clicks
                      </span>
                    </div>

                    <div className="w-full bg-[#072e42] h-2 rounded-full overflow-hidden border border-white/5">
                      <div className="bg-gradient-to-r from-[#008296] to-emerald-400 h-full w-[55%] rounded-full"></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team Members List */}
          <div className="pt-5 border-t border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" /> Workspace Team Roles ({currentWorkspace.name})
              </h4>

              <button
                onClick={() => setInviteModalOpen(true)}
                className="text-xs text-cyan-300 hover:text-white font-bold flex items-center gap-1 transition"
              >
                <UserPlus className="w-3.5 h-3.5" /> Invite Member
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {teamMembers.map((m) => (
                <div key={m.id} className="p-3 bg-[#052536] border border-white/10 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#008296] text-white font-bold flex items-center justify-center text-xs shadow-md">
                      {m.avatar || m.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-white">{m.name}</p>
                      <p className="text-[10px] text-slate-400">{m.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                      m.role === 'owner' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      m.role === 'admin' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {m.role}
                    </span>

                    {m.role !== 'owner' && (
                      <button
                        onClick={() => removeTeamMember(m.id)}
                        className="text-slate-500 hover:text-red-400 p-1 transition"
                        title="Remove Team Member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Modals */}
      <InviteMemberModal isOpen={inviteModalOpen} onClose={() => setInviteModalOpen(false)} />
      <CreateTeamModal isOpen={createTeamModalOpen} onClose={() => setCreateTeamModalOpen(false)} />

    </div>
  );
};
