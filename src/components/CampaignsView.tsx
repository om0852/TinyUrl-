'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { InviteMemberModal } from '@/components/InviteMemberModal';
import { 
  FolderKanban, 
  Plus, 
  FileText, 
  Check, 
  Copy, 
  ChevronRight, 
  Video, 
  ShieldCheck, 
  Sparkles, 
  Settings, 
  UserPlus, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  Link2,
  Activity,
  X
} from 'lucide-react';

export const CampaignsView: React.FC = () => {
  const { currentUser, campaigns, addCampaign, deleteCampaign, teamMembers, links } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Modals & form state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'live' | 'completed'>('all');
  const [copiedPreset, setCopiedPreset] = useState<string | null>(null);

  // New campaign modal form
  const [newTitle, setNewTitle] = useState('');
  const [newSponsor, setNewSponsor] = useState('');
  const [newTarget, setNewTarget] = useState(50000);

  const handleCopyPreset = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPreset(id);
    setTimeout(() => setCopiedPreset(null), 2000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;
    addCampaign(newTitle, newSponsor || 'Direct Sponsor', ['sponsor', 'active'], Number(newTarget));
    setNewTitle('');
    setNewSponsor('');
    setCreateModalOpen(false);
  };

  return (
    <div className="flex flex-col w-full gap-8 animate-fade-in text-on-surface">
      
      {/* 1. Sub-header Breadcrumb & Operational Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mb-1 font-medium">
            <span className="hover:text-on-surface cursor-pointer transition-colors">Workspace</span>
            <ChevronRight className="w-3.5 h-3.5 text-outline" />
            <span className="text-on-surface font-semibold">Campaigns &amp; Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Campaigns &amp; Workspace Operations
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-3xl leading-relaxed">
            Manage multi-channel brand deals, automated UTM bundles, creator team permissions, and real-time sponsor deliverable links.
          </p>
        </div>

        {/* Quick Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button 
            type="button"
            onClick={() => {
              window.print();
            }}
            className="inline-flex items-center gap-2 text-xs font-semibold bg-surface-container-lowest text-on-surface shadow-xs rounded-xl px-4 py-2 hover:bg-surface-container-low transition-all border border-outline-variant/30 cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileText className="w-4 h-4 text-outline" />
            <span>Export Sponsor Report (PDF)</span>
          </button>
          
          <button 
            type="button"
            id="new-campaign-btn"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 text-xs font-bold bg-primary-container text-on-primary rounded-xl px-4 py-2 hover:bg-primary shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {/* 2. Key Operations KPI Row (4 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* Metric 1 */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-xs border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-on-surface-variant font-medium">Active Creator Campaigns</span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-primary-container">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface tracking-tight">{campaigns.length}</span>
              <span className="text-xs text-on-surface-variant font-medium">Active Deals</span>
            </div>
            <p className="font-mono text-xs text-on-surface-variant mt-1.5">
              Across verified creator sponsors
            </p>
          </div>
          <div className="mt-4 pt-2 border-t border-outline-variant/20 flex items-center gap-1.5 text-primary-container text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Active campaigns tracked</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-xs border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-on-surface-variant font-medium">Attributed Campaign Clicks</span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-primary-container">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface tracking-tight">
                {links.reduce((acc, curr) => acc + (curr.clicks_count || 0), 0).toLocaleString()}
              </span>
              <span className="inline-flex items-center text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                Live
              </span>
            </div>
            <p className="font-mono text-xs text-on-surface-variant mt-1.5">
              Live across {links.length} deliverables
            </p>
          </div>
          <div className="mt-4 pt-2 border-t border-outline-variant/20 flex items-center gap-1.5 text-on-surface-variant text-xs">
            <Clock className="w-3.5 h-3.5 text-outline" />
            <span>Real-time telemetry</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-xs border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-on-surface-variant font-medium">Workspace Collaborators</span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-low flex items-center justify-center text-primary-container">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface tracking-tight">{teamMembers.length + 1}</span>
              <span className="text-xs text-on-surface-variant font-medium">Active Members</span>
            </div>
            <p className="font-mono text-xs text-on-surface-variant mt-1.5">
              Owner and workspace collaborators
            </p>
          </div>
          <div className="mt-4 pt-2 border-t border-outline-variant/20 flex items-center gap-1.5 text-on-surface-variant text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Full seat concurrency</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-xs border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-on-surface-variant font-medium">Auto-UTM Compliance</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface tracking-tight">100%</span>
              <span className="text-xs text-emerald-700 font-bold">Perfect</span>
            </div>
            <p className="font-mono text-xs text-on-surface-variant mt-1.5">
              Zero missing parameters
            </p>
          </div>
          <div className="mt-4 pt-2 border-t border-outline-variant/20 flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Standardized taxonomy active</span>
          </div>
        </div>

      </div>

      {/* 3. Primary Content Layout: 8 cols Campaigns, 4 cols Utilities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Active Brand Deals & Campaigns List (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Section Header with Filter Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 flex-wrap">
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <h2 className="text-lg font-bold text-on-surface whitespace-nowrap">Active Brand Deals &amp; Campaigns</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary-container text-xs font-bold whitespace-nowrap shrink-0 inline-flex items-center">
                {campaigns.length} Active
              </span>
            </div>

            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 shrink-0 overflow-x-auto max-w-full">
              <button 
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  filterTab === 'all'
                    ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                All ({campaigns.length})
              </button>
              <button 
                type="button"
                onClick={() => setFilterTab('live')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  filterTab === 'live'
                    ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Live Deliverables
              </button>
              <button 
                type="button"
                onClick={() => setFilterTab('completed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  filterTab === 'completed'
                    ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Completed
              </button>
            </div>
          </div>

          {/* Dynamic Campaigns List */}
          {campaigns.length === 0 ? (
            <div className="p-12 rounded-2xl bg-surface-container-lowest border border-dashed border-outline-variant/40 flex flex-col items-center justify-center text-center">
              <FolderKanban className="w-12 h-12 text-outline mb-3" />
              <h3 className="text-base font-bold text-on-surface">No campaigns created yet</h3>
              <p className="text-xs text-on-surface-variant mt-1.5 max-w-sm leading-relaxed">
                Create a sponsor deal or affiliate bundle to track multi-channel deliverables, UTM tags, and performance.
              </p>
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="mt-4 px-4 py-2 bg-primary-container text-on-primary rounded-xl text-xs font-semibold hover:bg-primary transition-colors cursor-pointer shadow-xs"
              >
                + Create Campaign
              </button>
            </div>
          ) : (
            campaigns.map((camp) => {
              const campLinks = links.filter(l => l.campaign_id === camp.id || l.tags?.some(t => camp.tags?.includes(t)));
              const campClicks = campLinks.reduce((acc, curr) => acc + (curr.clicks_count || 0), 0);
              const target = camp.target_clicks || 50000;
              const pct = Math.min(100, Math.round((campClicks / target) * 100));

              return (
                <div key={camp.id} className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-outline-variant/30 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-surface-container-low flex items-center justify-center text-primary-container shrink-0">
                        <Video className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-base font-bold text-on-surface truncate">
                            {camp.name}
                          </h3>
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active Campaign
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant mt-1">
                          {camp.description} &bull; {campLinks.length} trackable links attached
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        type="button"
                        onClick={() => handleCopyPreset(`https://snip.to/c/${camp.id}`, camp.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-surface-container-low hover:bg-surface-container-high text-on-surface px-3 py-1.5 rounded-xl transition-colors border border-outline-variant/30 cursor-pointer"
                      >
                        <Link2 className="w-3.5 h-3.5 text-primary-container" />
                        <span>{copiedPreset === camp.id ? 'Copied!' : 'Share Link'}</span>
                      </button>
                      <button 
                        type="button" 
                        onClick={() => deleteCampaign(camp.id)}
                        title="Delete campaign"
                        className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Deliverable Tags */}
                  {camp.tags && camp.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      {camp.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1.5 text-xs font-medium bg-surface-container-low text-on-surface px-3 py-1 rounded-full border border-outline-variant/20">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Progress and Metrics Split */}
                  <div className="mt-5 pt-4 bg-surface-container-low/60 p-4 rounded-xl border border-outline-variant/20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs mb-2 font-medium gap-1">
                      <span className="text-on-surface font-semibold">Deliverable Clicks Performance</span>
                      <span className="font-mono text-on-surface">
                        <strong className="text-primary-container font-bold">{campClicks.toLocaleString()}</strong> / {target.toLocaleString()} Target ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-surface-container-highest rounded-full h-2.5 overflow-hidden">
                      <div className="bg-primary-container h-2.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-on-surface-variant mt-3 gap-1">
                      <span>Attached deliverables: <code className="font-mono text-primary-container font-semibold">{campLinks.length} links</code></span>
                      <span className="text-emerald-700 font-bold">{pct}% goal reached</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}

        </div>

        {/* Right Column: Operations, Team Permissions & Auto UTM Presets (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Automated UTM Tagging Presets Module */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-outline-variant/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-surface-container-low text-primary-container flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-on-surface">Auto-UTM Preset Bundles</h3>
              </div>
              <button type="button" className="text-primary-container hover:text-primary transition-colors cursor-pointer">
                <Settings className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
              Generate compliant sponsor tracking parameters instantaneously with workspace standardized schema.
            </p>

            <div className="flex flex-col gap-2">
              
              {/* Preset 1 */}
              <div className="p-3 bg-surface-container-low hover:bg-surface-container-high rounded-xl flex items-center justify-between transition-colors border border-outline-variant/20">
                <div className="min-w-0 pr-2">
                  <span className="text-xs text-on-surface font-semibold block truncate">YouTube Video Integrated Read</span>
                  <span className="font-mono text-[11px] text-on-surface-variant truncate block">utm_medium=video_sponsor</span>
                </div>
                <button 
                  type="button"
                  onClick={() => handleCopyPreset('?utm_source=youtube&utm_medium=video_sponsor', 'p1')}
                  className="p-1.5 rounded-lg bg-surface-container-lowest hover:bg-primary-container hover:text-on-primary text-on-surface transition-all shrink-0 shadow-xs cursor-pointer border border-outline-variant/20"
                >
                  {copiedPreset === 'p1' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Preset 2 */}
              <div className="p-3 bg-surface-container-low hover:bg-surface-container-high rounded-xl flex items-center justify-between transition-colors border border-outline-variant/20">
                <div className="min-w-0 pr-2">
                  <span className="text-xs text-on-surface font-semibold block truncate">Instagram Bio Link</span>
                  <span className="font-mono text-[11px] text-on-surface-variant truncate block">utm_source=ig_bio&amp;utm_medium=bio</span>
                </div>
                <button 
                  type="button"
                  onClick={() => handleCopyPreset('?utm_source=ig_bio&utm_medium=bio', 'p2')}
                  className="p-1.5 rounded-lg bg-surface-container-lowest hover:bg-primary-container hover:text-on-primary text-on-surface transition-all shrink-0 shadow-xs cursor-pointer border border-outline-variant/20"
                >
                  {copiedPreset === 'p2' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Preset 3 */}
              <div className="p-3 bg-surface-container-low hover:bg-surface-container-high rounded-xl flex items-center justify-between transition-colors border border-outline-variant/20">
                <div className="min-w-0 pr-2">
                  <span className="text-xs text-on-surface font-semibold block truncate">TikTok Pinned Bio</span>
                  <span className="font-mono text-[11px] text-on-surface-variant truncate block">utm_source=tiktok_feed&amp;medium=clip</span>
                </div>
                <button 
                  type="button"
                  onClick={() => handleCopyPreset('?utm_source=tiktok_feed&utm_medium=clip', 'p3')}
                  className="p-1.5 rounded-lg bg-surface-container-lowest hover:bg-primary-container hover:text-on-primary text-on-surface transition-all shrink-0 shadow-xs cursor-pointer border border-outline-variant/20"
                >
                  {copiedPreset === 'p3' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Preset 4 */}
              <div className="p-3 bg-surface-container-low hover:bg-surface-container-high rounded-xl flex items-center justify-between transition-colors border border-outline-variant/20">
                <div className="min-w-0 pr-2">
                  <span className="text-xs text-on-surface font-semibold block truncate">Newsletter Sponsor Slot</span>
                  <span className="font-mono text-[11px] text-on-surface-variant truncate block">utm_source=substack&amp;utm_medium=email</span>
                </div>
                <button 
                  type="button"
                  onClick={() => handleCopyPreset('?utm_source=substack&utm_medium=email', 'p4')}
                  className="p-1.5 rounded-lg bg-surface-container-lowest hover:bg-primary-container hover:text-on-primary text-on-surface transition-all shrink-0 shadow-xs cursor-pointer border border-outline-variant/20"
                >
                  {copiedPreset === 'p4' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

            </div>

            <button 
              type="button"
              onClick={() => handleCopyPreset('utm_campaign=creator_master_bundle', 'all')}
              className="w-full mt-4 py-2.5 bg-surface-container-high hover:bg-primary-container hover:text-on-primary text-primary-container font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>One-Click Bulk Apply UTM Preset</span>
            </button>
          </div>

          {/* Workspace Team & Roles Panel */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-outline-variant/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-surface-container-low text-primary-container flex items-center justify-center">
                  <FolderKanban className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-on-surface">Workspace Team Seats</h3>
              </div>
              <button 
                type="button"
                onClick={() => setInviteModalOpen(true)}
                className="inline-flex items-center gap-1 text-primary-container hover:text-primary text-xs font-semibold cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
              Role-based delegation prevents accidental destination URL changes during live sponsorship read pushes.
            </p>

            <div className="flex flex-col gap-2.5">
              
              {/* Workspace Owner */}
              <div className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-surface-container-low transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-outline-variant/30 shadow-xs">
                    {currentUser?.avatar || (currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U')}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-on-surface block truncate">
                      {currentUser?.name || "Workspace Owner"}
                    </span>
                    <span className="text-[11px] text-on-surface-variant truncate block">
                      {currentUser?.email || "Primary Lead · Owner"}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-primary-container text-[11px] font-bold bg-primary-fixed shrink-0">
                  Owner
                </span>
              </div>

              {/* Dynamic Workspace Team Members */}
              {teamMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-surface-container-low transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-outline-variant/30">
                      {m.avatar || m.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-on-surface block truncate">{m.name}</span>
                      <span className="text-[11px] text-on-surface-variant truncate block">{m.email}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-surface-container text-on-surface shrink-0 capitalize">
                    {m.role}
                  </span>
                </div>
              ))}

              {teamMembers.length === 0 && (
                <div className="p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 text-center">
                  <p className="text-[11px] text-on-surface-variant">
                    No additional team members invited yet. Use the Invite button above to delegate campaign links.
                  </p>
                </div>
              )}

            </div>

            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">Active tier: Pro Studio Plan</span>
              <button 
                type="button" 
                onClick={() => setInviteModalOpen(true)}
                className="text-primary-container font-semibold hover:underline cursor-pointer"
              >
                Manage Matrix &rarr;
              </button>
            </div>
          </div>

          {/* Real-Time Deliverable Status Summary */}
          <div className="bg-surface-container-low rounded-2xl p-6 shadow-xs border border-outline-variant/30">
            <div className="flex items-center gap-2 mb-1.5 text-on-surface font-bold text-sm">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Live Link Health Check</span>
            </div>
            <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
              Zero 404 or dead ends detected across 24 monitored sponsor destinations.
            </p>
            <div className="flex items-center justify-between text-on-surface text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Redirect latency: 42ms</span>
              </span>
              <span className="font-mono text-on-surface-variant font-normal">Global Edge CDN</span>
            </div>
          </div>

        </div>

      </div>

      {/* Invite Member Modal */}
      <InviteMemberModal 
        isOpen={inviteModalOpen} 
        onClose={() => setInviteModalOpen(false)} 
      />

      {/* Create Campaign Modal */}
      {mounted && createModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateModalOpen(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-5 shadow-2xl border border-outline-variant/40 relative animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-3.5 right-3.5 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h4 className="text-sm font-bold text-on-surface mb-0.5">Create New Campaign</h4>
            <p className="text-[11px] text-on-surface-variant mb-3">
              Launch a new creator campaign, sponsor track, or partner deliverable.
            </p>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-on-surface block mb-1">Campaign Title</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Autumn Gear Sponsor"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Sponsor Organization</label>
                <input 
                  type="text"
                  placeholder="e.g. Sony, NordVPN, Adobe"
                  value={newSponsor}
                  onChange={(e) => setNewSponsor(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Target Click Goal</label>
                <input 
                  type="number"
                  value={newTarget}
                  onChange={(e) => setNewTarget(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20 mt-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer shadow-xs text-xs"
                >
                  Create Deal
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
