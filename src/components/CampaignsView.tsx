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
  Trash2,
  Building2
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

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
    <div className="space-y-8 animate-fade-in text-foreground">
      
      {/* Header */}
      <Card className="p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-primary" /> Campaigns &amp; Workspace Operations
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Active Workspace: <strong className="text-foreground font-semibold">{currentWorkspace.name}</strong> ({currentWorkspace.plan.toUpperCase()} Tier)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="default"
            onClick={() => setInviteModalOpen(true)}
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Invite Member
          </Button>
          
          <Button
            variant="outline"
            size="default"
            onClick={() => setCreateTeamModalOpen(true)}
          >
            <Building2 className="w-3.5 h-3.5 mr-1.5 text-primary" /> New Workspace
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Create Campaign */}
        <Card className="p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border/40">
            <Plus className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Create Workspace Campaign</h3>
          </div>

          {msg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 text-xs flex items-center gap-2 font-medium">
              <Check className="w-4 h-4" /> {msg}
            </div>
          )}

          <form onSubmit={handleCreateCampaign} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Campaign Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Q4 Security Sprint"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Goals &amp; Attribution</label>
              <textarea
                rows={2}
                placeholder="Attribution goals and marketing UTM parameters"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full p-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none resize-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Target Click Goal</label>
              <input
                type="number"
                value={targetClicks}
                onChange={(e) => setTargetClicks(Number(e.target.value))}
                className="w-full h-10 px-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs font-mono text-foreground outline-none transition"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full text-xs font-bold mt-2"
            >
              <FolderKanban className="w-4 h-4 mr-2" /> Add Campaign to Workspace
            </Button>
          </form>
        </Card>

        {/* Active Campaigns & Team Members */}
        <Card className="lg:col-span-2 shadow-sm p-6 space-y-6">
          
          {/* Active Campaigns */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> Active Workspace Campaigns ({activeWorkspaceCampaigns.length})
              </h3>
              <span className="text-xs text-muted-foreground font-mono">
                {links.length} short links tracked
              </span>
            </div>

            <div className="space-y-2.5">
              {activeWorkspaceCampaigns.map((camp) => {
                const assignedLinks = links.filter(l => l.campaign_id === camp.id).length;
                return (
                  <div key={camp.id} className="p-4 bg-muted/20 border border-border/40 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-foreground">{camp.name}</h4>
                          <Badge variant="primary" className="text-[9px]">
                            {assignedLinks} Links Assigned
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{camp.description}</p>
                      </div>
                      <Badge variant="success">
                        Goal: {camp.target_clicks.toLocaleString()}
                      </Badge>
                    </div>

                    <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full w-[55%] rounded-full shadow-xs"></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team Members List */}
          <div className="pt-4 border-t border-border/40 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Workspace Members ({teamMembers.length})
              </h3>
              <button
                onClick={() => setInviteModalOpen(true)}
                className="text-xs text-primary hover:underline font-semibold cursor-pointer"
              >
                + Add Seat
              </button>
            </div>

            <div className="divide-y divide-border/30">
              {teamMembers.map((member) => (
                <div key={member.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs">
                      {member.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{member.name}</p>
                      <p className="text-muted-foreground font-mono text-[11px]">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={member.role === 'owner' ? 'primary' : 'outline'} className="capitalize">
                      {member.role}
                    </Badge>
                    {member.role !== 'owner' && (
                      <button
                        onClick={() => removeTeamMember(member.id)}
                        className="p-1 text-muted-foreground hover:text-destructive rounded transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </Card>

      </div>

      <InviteMemberModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
      />

      <CreateTeamModal
        isOpen={createTeamModalOpen}
        onClose={() => setCreateTeamModalOpen(false)}
      />

    </div>
  );
};
