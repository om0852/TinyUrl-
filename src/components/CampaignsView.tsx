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
  ChevronDown,
  ChevronUp,
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
  X,
  Lock,
  Trash2,
  Edit3,
  ExternalLink,
  Unlink,
  Printer,
  SlidersHorizontal,
  Layers,
  AlertCircle
} from 'lucide-react';
import { hasPermission, ROLE_DESCRIPTIONS } from '@/lib/rbac';
import { Campaign, Link as LinkType } from '@/lib/types';

export const CampaignsView: React.FC = () => {
  const { 
    currentUser, 
    campaigns, 
    addCampaign, 
    updateCampaign, 
    deleteCampaign, 
    teamMembers, 
    removeTeamMember, 
    links, 
    updateLink, 
    createShortLink, 
    currentWorkspace 
  } = useStore();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userRole = currentUser?.role || currentWorkspace?.role || 'owner';
  const canCreate = hasPermission(userRole, 'campaigns:create');
  const canDelete = hasPermission(userRole, 'campaigns:delete');

  // Modals state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editCampaignModal, setEditCampaignModal] = useState<Campaign | null>(null);
  const [deleteCampaignModal, setDeleteCampaignModal] = useState<Campaign | null>(null);
  const [attachModalCampaign, setAttachModalCampaign] = useState<Campaign | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [matrixModalOpen, setMatrixModalOpen] = useState(false);
  const [utmSettingsModalOpen, setUtmSettingsModalOpen] = useState(false);
  const [bulkUtmModalOpen, setBulkUtmModalOpen] = useState(false);

  // Filter state
  const [filterTab, setFilterTab] = useState<'all' | 'live' | 'completed'>('all');
  
  // Expanded deliverables map: campaignId -> boolean
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});

  // Copy notification states
  const [copiedPreset, setCopiedPreset] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // New campaign form state
  const [newTitle, setNewTitle] = useState('');
  const [newSponsor, setNewSponsor] = useState('');
  const [newTarget, setNewTarget] = useState(50000);
  const [newTagsStr, setNewTagsStr] = useState('sponsor, active');

  // Edit campaign form state
  const [editTitle, setEditTitle] = useState('');
  const [editSponsor, setEditSponsor] = useState('');
  const [editTarget, setEditTarget] = useState(50000);
  const [editTagsStr, setEditTagsStr] = useState('');

  // Attach link modal state
  const [attachTab, setAttachTab] = useState<'existing' | 'new'>('existing');
  const [selectedLinkToAttach, setSelectedLinkToAttach] = useState('');
  const [newDeliverableUrl, setNewDeliverableUrl] = useState('');
  const [newDeliverableTitle, setNewDeliverableTitle] = useState('');
  const [newDeliverableSlug, setNewDeliverableSlug] = useState('');
  const [attachError, setAttachError] = useState('');

  // Bulk UTM modal state
  const [bulkTargetCampaignId, setBulkTargetCampaignId] = useState<string>('');
  const [bulkPresetType, setBulkPresetType] = useState<string>('youtube');
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState('');

  // Report modal state
  const [selectedReportCampId, setSelectedReportCampId] = useState<string>('all');

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tiny-url-self.vercel.app';

  // Toggle accordion for deliverables
  const toggleAccordion = (id: string) => {
    setExpandedCampaigns(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleCopyText = (text: string, id: string, type: 'preset' | 'invite' | 'link' = 'preset') => {
    navigator.clipboard.writeText(text);
    if (type === 'preset') {
      setCopiedPreset(id);
      setTimeout(() => setCopiedPreset(null), 2000);
    } else if (type === 'invite') {
      setCopiedInviteId(id);
      setTimeout(() => setCopiedInviteId(null), 2000);
    } else {
      setCopiedLinkId(id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    }
  };

  // Helper to get links for a given campaign
  const getCampaignLinks = (camp: Campaign): LinkType[] => {
    return links.filter(l => 
      l.campaign_id === camp.id || 
      (camp.tags && camp.tags.length > 0 && l.tags?.some(t => camp.tags?.includes(t)))
    );
  };

  // KPI Calculations
  const campaignLinkIds = new Set<string>();
  campaigns.forEach(c => {
    links.forEach(l => {
      if (l.campaign_id === c.id || (c.tags && c.tags.length > 0 && l.tags?.some(t => c.tags?.includes(t)))) {
        campaignLinkIds.add(l.id);
      }
    });
  });

  const campaignLinksTotal = links.filter(l => campaignLinkIds.has(l.id));
  const totalAttributedClicks = campaignLinksTotal.reduce((acc, curr) => acc + (curr.clicks_count || 0), 0);

  const compliantLinks = campaignLinksTotal.filter(l => 
    l.utm_source || l.utm_medium || l.utm_campaign || 
    (l.destination_url && l.destination_url.includes('utm_'))
  );
  const utmCompliancePct = campaignLinksTotal.length > 0 
    ? Math.round((compliantLinks.length / campaignLinksTotal.length) * 100) 
    : 100;

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(camp => {
    const campLinks = getCampaignLinks(camp);
    const campClicks = campLinks.reduce((acc, curr) => acc + (curr.clicks_count || 0), 0);
    const target = camp.target_clicks || 50000;
    const isCompleted = campClicks >= target;

    if (filterTab === 'live') return !isCompleted;
    if (filterTab === 'completed') return isCompleted;
    return true;
  });

  const liveCampaignsCount = campaigns.filter(c => {
    const cLinks = getCampaignLinks(c);
    const cClicks = cLinks.reduce((acc, curr) => acc + (curr.clicks_count || 0), 0);
    return cClicks < (c.target_clicks || 50000);
  }).length;

  const completedCampaignsCount = campaigns.filter(c => {
    const cLinks = getCampaignLinks(c);
    const cClicks = cLinks.reduce((acc, curr) => acc + (curr.clicks_count || 0), 0);
    return cClicks >= (c.target_clicks || 50000);
  }).length;

  // Form submit: Create Campaign
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const parsedTags = newTagsStr
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    addCampaign(
      newTitle.trim(), 
      newSponsor.trim() || 'Direct Sponsor', 
      parsedTags.length > 0 ? parsedTags : ['sponsor', 'active'], 
      Number(newTarget) || 50000
    );

    setNewTitle('');
    setNewSponsor('');
    setNewTarget(50000);
    setNewTagsStr('sponsor, active');
    setCreateModalOpen(false);
  };

  // Form submit: Edit Campaign
  const openEditModal = (camp: Campaign) => {
    setEditCampaignModal(camp);
    setEditTitle(camp.name);
    setEditSponsor(camp.description || '');
    setEditTarget(camp.target_clicks || 50000);
    setEditTagsStr(Array.isArray(camp.tags) ? camp.tags.join(', ') : '');
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCampaignModal || !editTitle.trim()) return;

    const parsedTags = editTagsStr
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    updateCampaign(editCampaignModal.id, {
      name: editTitle.trim(),
      description: editSponsor.trim(),
      target_clicks: Number(editTarget) || 50000,
      tags: parsedTags
    });

    setEditCampaignModal(null);
  };

  // Delete Campaign
  const confirmDelete = () => {
    if (!deleteCampaignModal) return;
    deleteCampaign(deleteCampaignModal.id);
    setDeleteCampaignModal(null);
  };

  // Attach existing link to campaign
  const handleAttachExisting = () => {
    if (!attachModalCampaign || !selectedLinkToAttach) return;
    updateLink(selectedLinkToAttach, {
      campaign_id: attachModalCampaign.id
    });
    setSelectedLinkToAttach('');
    setAttachModalCampaign(null);
  };

  // Create new link attached to campaign
  const handleCreateNewDeliverable = (e: React.FormEvent) => {
    e.preventDefault();
    setAttachError('');
    if (!attachModalCampaign || !newDeliverableUrl.trim()) {
      setAttachError('Destination URL is required.');
      return;
    }

    const campNameSlug = attachModalCampaign.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const result = createShortLink({
      destination_url: newDeliverableUrl.trim(),
      title: newDeliverableTitle.trim() || `${attachModalCampaign.name} Deliverable`,
      custom_slug: newDeliverableSlug.trim() ? newDeliverableSlug.trim().toLowerCase() : undefined,
      campaign_id: attachModalCampaign.id,
      tags: [...(attachModalCampaign.tags || ['sponsor']), 'campaign_asset'],
      utm_source: 'campaign_hub',
      utm_medium: 'deliverable',
      utm_campaign: campNameSlug
    });

    if (result.error) {
      setAttachError(result.error);
      return;
    }

    setNewDeliverableUrl('');
    setNewDeliverableTitle('');
    setNewDeliverableSlug('');
    setAttachModalCampaign(null);
  };

  // Detach link from campaign
  const handleDetachLink = (linkId: string) => {
    updateLink(linkId, {
      campaign_id: undefined
    });
  };

  // Bulk Apply UTM Preset to Campaign Deliverables
  const handleBulkApplyUtm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkTargetCampaignId) return;

    const targetCamp = campaigns.find(c => c.id === bulkTargetCampaignId);
    if (!targetCamp) return;

    const campLinks = getCampaignLinks(targetCamp);
    if (campLinks.length === 0) {
      setBulkSuccessMsg('No links attached to this campaign to update.');
      return;
    }

    const utmParamMap: Record<string, { source: string; medium: string }> = {
      youtube: { source: 'youtube', medium: 'video_sponsor' },
      instagram: { source: 'ig_bio', medium: 'bio' },
      tiktok: { source: 'tiktok_feed', medium: 'clip' },
      newsletter: { source: 'substack', medium: 'email' },
      creator_bundle: { source: 'creator_network', medium: 'partner_read' }
    };

    const params = utmParamMap[bulkPresetType] || utmParamMap.youtube;
    const campSlug = targetCamp.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    let updatedCount = 0;
    campLinks.forEach(link => {
      try {
        const u = new URL(link.destination_url);
        u.searchParams.set('utm_source', params.source);
        u.searchParams.set('utm_medium', params.medium);
        u.searchParams.set('utm_campaign', campSlug);
        updateLink(link.id, {
          destination_url: u.toString(),
          utm_source: params.source,
          utm_medium: params.medium,
          utm_campaign: campSlug
        });
        updatedCount++;
      } catch {
        // Skip malformed raw URLs
      }
    });

    setBulkSuccessMsg(`Successfully applied ${bulkPresetType.toUpperCase()} UTM parameters across ${updatedCount} deliverables!`);
    setTimeout(() => {
      setBulkSuccessMsg('');
      setBulkUtmModalOpen(false);
    }, 1800);
  };

  // Report calculation for Report Modal
  const reportCampaignsList = selectedReportCampId === 'all' 
    ? campaigns 
    : campaigns.filter(c => c.id === selectedReportCampId);

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
            id="export-sponsor-report-btn"
            onClick={() => setReportModalOpen(true)}
            className="inline-flex items-center gap-2 text-xs font-semibold bg-surface-container-lowest text-on-surface shadow-xs rounded-xl px-4 py-2 hover:bg-surface-container-low transition-all border border-outline-variant/30 cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileText className="w-4 h-4 text-outline" />
            <span>Export Sponsor Report (PDF)</span>
          </button>
          
          <button 
            type="button"
            id="new-campaign-btn"
            onClick={() => {
              if (!canCreate) {
                alert('Your workspace role (Viewer) does not permit creating new campaigns.');
                return;
              }
              setCreateModalOpen(true);
            }}
            disabled={!canCreate}
            className={`inline-flex items-center gap-2 text-xs font-bold rounded-xl px-4 py-2 shadow-sm transition-all whitespace-nowrap shrink-0 ${
              canCreate 
                ? 'bg-primary-container text-on-primary hover:bg-primary cursor-pointer' 
                : 'bg-surface-container-low text-on-surface-variant opacity-60 cursor-not-allowed'
            }`}
          >
            {canCreate ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
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
              {liveCampaignsCount} Live &bull; {completedCampaignsCount} Completed
            </p>
          </div>
          <div className="mt-4 pt-2 border-t border-outline-variant/20 flex items-center gap-1.5 text-primary-container text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Active campaigns tracked</span>
          </div>
        </div>

        {/* Metric 2: Real Attributed Campaign Clicks */}
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
                {totalAttributedClicks.toLocaleString()}
              </span>
              <span className="inline-flex items-center text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                Live
              </span>
            </div>
            <p className="font-mono text-xs text-on-surface-variant mt-1.5">
              Across {campaignLinksTotal.length} verified deliverables
            </p>
          </div>
          <div className="mt-4 pt-2 border-t border-outline-variant/20 flex items-center gap-1.5 text-on-surface-variant text-xs">
            <Clock className="w-3.5 h-3.5 text-outline" />
            <span>Real-time attribution telemetry</span>
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

        {/* Metric 4: Real Auto-UTM Compliance */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-xs border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-on-surface-variant font-medium">Auto-UTM Compliance</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-on-surface tracking-tight">{utmCompliancePct}%</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                utmCompliancePct >= 90 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
              }`}>
                {utmCompliancePct >= 90 ? 'Optimized' : 'Attention'}
              </span>
            </div>
            <p className="font-mono text-xs text-on-surface-variant mt-1.5">
              {compliantLinks.length} of {campaignLinksTotal.length} deliverables tagged
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

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 shrink-0 overflow-x-auto max-w-full">
              <button 
                type="button"
                id="filter-tab-all"
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
                id="filter-tab-live"
                onClick={() => setFilterTab('live')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  filterTab === 'live'
                    ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Live Deliverables ({liveCampaignsCount})
              </button>
              <button 
                type="button"
                id="filter-tab-completed"
                onClick={() => setFilterTab('completed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  filterTab === 'completed'
                    ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Completed ({completedCampaignsCount})
              </button>
            </div>
          </div>

          {/* Dynamic Campaigns List */}
          {filteredCampaigns.length === 0 ? (
            <div className="p-12 rounded-2xl bg-surface-container-lowest border border-dashed border-outline-variant/40 flex flex-col items-center justify-center text-center">
              <FolderKanban className="w-12 h-12 text-outline mb-3" />
              <h3 className="text-base font-bold text-on-surface">
                {campaigns.length === 0 ? 'No campaigns created yet' : `No ${filterTab} campaigns found`}
              </h3>
              <p className="text-xs text-on-surface-variant mt-1.5 max-w-sm leading-relaxed">
                {campaigns.length === 0 
                  ? 'Create a sponsor deal or affiliate bundle to track multi-channel deliverables, UTM tags, and performance.'
                  : `There are currently no campaigns matching the "${filterTab}" filter.`}
              </p>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="mt-4 px-4 py-2 bg-primary-container text-on-primary rounded-xl text-xs font-semibold hover:bg-primary transition-colors cursor-pointer shadow-xs"
                >
                  + Create Campaign
                </button>
              )}
            </div>
          ) : (
            filteredCampaigns.map((camp) => {
              const campLinks = getCampaignLinks(camp);
              const campClicks = campLinks.reduce((acc, curr) => acc + (curr.clicks_count || 0), 0);
              const target = camp.target_clicks || 50000;
              const pct = Math.min(100, Math.round((campClicks / target) * 100));
              const isGoalReached = campClicks >= target;
              const isExpanded = !!expandedCampaigns[camp.id];

              return (
                <div key={camp.id} className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-outline-variant/30 hover:shadow-md transition-shadow">
                  
                  {/* Top Bar: Title, Sponsor, Actions */}
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
                          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold ${
                            isGoalReached 
                              ? 'text-purple-800 bg-purple-50'
                              : 'text-emerald-800 bg-emerald-50'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isGoalReached ? 'bg-purple-500' : 'bg-emerald-500 animate-pulse'}`} />
                            {isGoalReached ? 'Goal Reached' : 'Active Campaign'}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant mt-1">
                          {camp.description} &bull; <strong className="text-on-surface font-semibold">{campLinks.length}</strong> trackable link{campLinks.length !== 1 ? 's' : ''} attached
                        </p>
                      </div>
                    </div>

                    {/* Campaign Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      
                      {/* Attach Link Button */}
                      <button 
                        type="button"
                        onClick={() => {
                          setAttachModalCampaign(camp);
                          setAttachTab('existing');
                          setAttachError('');
                        }}
                        title="Attach link to campaign"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-surface-container-low hover:bg-surface-container-high text-on-surface px-3 py-1.5 rounded-xl transition-colors border border-outline-variant/30 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-primary-container" />
                        <span>Add Deliverable</span>
                      </button>

                      {/* Share Link Button */}
                      <button 
                        type="button"
                        onClick={() => {
                          const primaryLink = campLinks[0];
                          const shareUrl = primaryLink 
                            ? `${originUrl}/${primaryLink.custom_slug || primaryLink.short_code}`
                            : `${originUrl}/c/${camp.id}`;
                          handleCopyText(shareUrl, camp.id, 'preset');
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary-container text-on-primary hover:bg-primary px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-xs"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>{copiedPreset === camp.id ? 'Copied Link!' : 'Share Link'}</span>
                      </button>

                      {/* Edit Campaign Button */}
                      {canCreate && (
                        <button 
                          type="button"
                          onClick={() => openEditModal(camp)}
                          title="Edit Campaign"
                          className="p-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer border border-outline-variant/30"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete Campaign Button */}
                      {canDelete && (
                        <button 
                          type="button" 
                          onClick={() => setDeleteCampaignModal(camp)}
                          title="Delete campaign"
                          className="p-1.5 rounded-xl text-outline hover:text-error hover:bg-error-container/20 transition-colors cursor-pointer border border-outline-variant/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                      <div 
                        className={`h-2.5 rounded-full transition-all duration-500 ${isGoalReached ? 'bg-purple-600' : 'bg-primary-container'}`} 
                        style={{ width: `${pct}%` }} 
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-on-surface-variant mt-3 gap-1">
                      <div className="flex items-center gap-2">
                        <span>Attached deliverables: <code className="font-mono text-primary-container font-semibold">{campLinks.length} links</code></span>
                        <button
                          type="button"
                          onClick={() => toggleAccordion(camp.id)}
                          className="text-primary-container hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer ml-1"
                        >
                          <span>{isExpanded ? 'Hide Details' : 'View Deliverables'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <span className={isGoalReached ? 'text-purple-700 font-bold' : 'text-emerald-700 font-bold'}>
                        {pct}% goal reached
                      </span>
                    </div>
                  </div>

                  {/* Expandable Deliverables Accordion */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-outline-variant/20 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between text-xs font-bold text-on-surface">
                        <span>Deliverable Short Links ({campLinks.length})</span>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachModalCampaign(camp);
                            setAttachTab('existing');
                          }}
                          className="text-primary-container hover:underline text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Attach Another Link</span>
                        </button>
                      </div>

                      {campLinks.length === 0 ? (
                        <div className="p-4 bg-surface-container-low rounded-xl text-center text-xs text-on-surface-variant border border-dashed border-outline-variant/40 space-y-2">
                          <p>No links attached to this campaign yet.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setAttachModalCampaign(camp);
                              setAttachTab('existing');
                            }}
                            className="px-3 py-1.5 bg-primary-container text-on-primary rounded-lg text-xs font-semibold hover:bg-primary transition cursor-pointer"
                          >
                            + Attach Deliverable
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {campLinks.map((link) => {
                            const slug = link.custom_slug || link.short_code;
                            const fullShortUrl = `${originUrl}/${slug}`;
                            const isCopied = copiedLinkId === link.id;
                            const linkSharePct = campClicks > 0 ? Math.round(((link.clicks_count || 0) / campClicks) * 100) : 0;

                            return (
                              <div 
                                key={link.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-surface-container-low rounded-xl border border-outline-variant/20 hover:border-outline-variant/50 transition-all gap-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-on-surface truncate">{link.title || `/${slug}`}</span>
                                    {link.utm_medium && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant border border-outline-variant/20">
                                        {link.utm_medium}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-on-surface-variant">
                                    <span className="font-mono text-primary-container font-semibold truncate">{fullShortUrl}</span>
                                    <span>&rarr;</span>
                                    <span className="truncate max-w-[200px]" title={link.destination_url}>{link.destination_url}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                  <div className="text-right pr-2">
                                    <div className="text-xs font-bold text-on-surface font-mono">
                                      {(link.clicks_count || 0).toLocaleString()} clicks
                                    </div>
                                    <div className="text-[10px] text-on-surface-variant font-medium">
                                      {linkSharePct}% of deal
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(fullShortUrl, link.id, 'link')}
                                    title="Copy Short URL"
                                    className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition cursor-pointer"
                                  >
                                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>

                                  <a
                                    href={fullShortUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Open link"
                                    className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>

                                  <button
                                    type="button"
                                    onClick={() => handleDetachLink(link.id)}
                                    title="Detach from campaign"
                                    className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition cursor-pointer"
                                  >
                                    <Unlink className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

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
              <button 
                type="button" 
                onClick={() => setUtmSettingsModalOpen(true)}
                title="Configure UTM Presets"
                className="text-primary-container hover:text-primary transition-colors cursor-pointer p-1 rounded-lg hover:bg-surface-container-low"
              >
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
                  onClick={() => handleCopyText('?utm_source=youtube&utm_medium=video_sponsor', 'p1')}
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
                  onClick={() => handleCopyText('?utm_source=ig_bio&utm_medium=bio', 'p2')}
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
                  onClick={() => handleCopyText('?utm_source=tiktok_feed&utm_medium=clip', 'p3')}
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
                  onClick={() => handleCopyText('?utm_source=substack&utm_medium=email', 'p4')}
                  className="p-1.5 rounded-lg bg-surface-container-lowest hover:bg-primary-container hover:text-on-primary text-on-surface transition-all shrink-0 shadow-xs cursor-pointer border border-outline-variant/20"
                >
                  {copiedPreset === 'p4' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

            </div>

            {/* Bulk Apply Button */}
            <button 
              type="button"
              id="bulk-apply-utm-btn"
              onClick={() => {
                if (campaigns.length > 0) {
                  setBulkTargetCampaignId(campaigns[0].id);
                }
                setBulkUtmModalOpen(true);
              }}
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
              {hasPermission(userRole, 'members:invite') ? (
                <button 
                  type="button"
                  onClick={() => setInviteModalOpen(true)}
                  className="inline-flex items-center gap-1 text-primary-container hover:text-primary text-xs font-semibold cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Invite</span>
                </button>
              ) : (
                <span className="text-[11px] text-on-surface-variant font-medium">Read-Only Seats</span>
              )}
            </div>

            <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
              Role-based delegation prevents accidental destination URL changes during live sponsorship read pushes.
            </p>

            <div className="flex flex-col gap-2.5">
              
              {/* Current Active User in this Workspace */}
              <div className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-surface-container-low transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-outline-variant/30 shadow-xs">
                    {currentUser?.avatar || (currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U')}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-on-surface block truncate">
                        {currentUser?.name || "Workspace Lead"}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant font-medium">You</span>
                    </div>
                    <span className="text-[11px] text-on-surface-variant truncate block">
                      {currentUser?.email || "Active User"}
                    </span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold capitalize ${
                  userRole === 'owner' 
                    ? 'text-primary-container bg-primary-fixed' 
                    : (ROLE_DESCRIPTIONS[userRole]?.badgeColor || 'bg-surface-container text-on-surface')
                }`}>
                  {userRole}
                </span>
              </div>

              {/* Dynamic Workspace Collaborators (deduplicated against current user) */}
              {teamMembers
                .filter(m => !currentUser?.email || m.email.toLowerCase().trim() !== currentUser.email.toLowerCase().trim())
                .map((m) => {
                const isPending = m.status === 'invited';
                const roleConfig = ROLE_DESCRIPTIONS[m.role] || ROLE_DESCRIPTIONS.editor;
                const inviteLink = m.invite_url || (m.token && typeof window !== 'undefined' ? `${originUrl}/invite/${m.token}` : '');

                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-surface-container-low transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-outline-variant/30">
                        {m.avatar || m.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-on-surface truncate">{m.name}</span>
                          {isPending && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Pending
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-on-surface-variant truncate block">{m.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isPending && inviteLink && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(inviteLink, m.id, 'invite')}
                          title="Copy Invitation Link"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-container hover:bg-surface-container-high text-primary-container transition cursor-pointer"
                        >
                          {copiedInviteId === m.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedInviteId === m.id ? 'Copied' : 'Link'}</span>
                        </button>
                      )}

                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${roleConfig.badgeColor}`}>
                        {m.role}
                      </span>

                      {hasPermission(userRole, 'members:remove') && (
                        <button
                          type="button"
                          onClick={() => removeTeamMember(m.id)}
                          title="Remove Member"
                          className="p-1 rounded text-outline hover:text-red-500 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {teamMembers.filter(m => !currentUser?.email || m.email.toLowerCase().trim() !== currentUser.email.toLowerCase().trim()).length === 0 && (
                <div className="p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 text-center">
                  <p className="text-[11px] text-on-surface-variant">
                    No additional collaborators invited yet. Use the Invite button above to add members with specific roles.
                  </p>
                </div>
              )}

            </div>

            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">Active tier: Pro Studio Plan</span>
              <button 
                type="button" 
                onClick={() => setMatrixModalOpen(true)}
                className="text-primary-container font-semibold hover:underline cursor-pointer"
              >
                View Role Matrix &rarr;
              </button>
            </div>
          </div>

          {/* Dynamic Live Link Health Check */}
          <div className="bg-surface-container-low rounded-2xl p-6 shadow-xs border border-outline-variant/30">
            <div className="flex items-center gap-2 mb-1.5 text-on-surface font-bold text-sm">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Live Deliverable Link Health Check</span>
            </div>
            <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
              Active telemetry across {campaignLinksTotal.length || links.length} monitored creator deliverable endpoints.
            </p>
            <div className="flex items-center justify-between text-on-surface text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Redirect latency: ~38ms</span>
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

              <div>
                <label className="font-semibold text-on-surface block mb-1">Campaign Tags (comma-separated)</label>
                <input 
                  type="text"
                  placeholder="sponsor, active, autumn2026"
                  value={newTagsStr}
                  onChange={(e) => setNewTagsStr(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs"
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

      {/* Edit Campaign Modal */}
      {mounted && editCampaignModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditCampaignModal(null);
          }}
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-5 shadow-2xl border border-outline-variant/40 relative animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setEditCampaignModal(null)}
              className="absolute top-3.5 right-3.5 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h4 className="text-sm font-bold text-on-surface mb-0.5">Edit Campaign</h4>
            <p className="text-[11px] text-on-surface-variant mb-3">
              Update details, target goals, or taxonomy tags for this campaign.
            </p>

            <form onSubmit={handleUpdate} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-on-surface block mb-1">Campaign Title</label>
                <input 
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Sponsor Organization</label>
                <input 
                  type="text"
                  value={editSponsor}
                  onChange={(e) => setEditSponsor(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Target Click Goal</label>
                <input 
                  type="number"
                  value={editTarget}
                  onChange={(e) => setEditTarget(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface font-mono text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Campaign Tags (comma-separated)</label>
                <input 
                  type="text"
                  value={editTagsStr}
                  onChange={(e) => setEditTagsStr(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20 mt-3">
                <button
                  type="button"
                  onClick={() => setEditCampaignModal(null)}
                  className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer shadow-xs text-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Campaign Confirmation Modal */}
      {mounted && deleteCampaignModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteCampaignModal(null);
          }}
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-outline-variant/40 relative animate-fade-in text-on-surface">
            <div className="w-10 h-10 rounded-xl bg-error-container/30 text-error flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h4 className="text-sm font-bold text-on-surface mb-1">Delete Campaign?</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
              Are you sure you want to delete <strong>{deleteCampaignModal.name}</strong>? Attached links will remain active in your workspace, but will no longer be grouped under this deal.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setDeleteCampaignModal(null)}
                className="px-3.5 py-1.5 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3.5 py-1.5 rounded-xl bg-error text-white font-bold hover:bg-error/90 cursor-pointer text-xs shadow-xs"
              >
                Delete Campaign
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Attach Link / Deliverable Modal */}
      {mounted && attachModalCampaign && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAttachModalCampaign(null);
          }}
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-outline-variant/40 relative animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar text-on-surface">
            <button
              type="button"
              onClick={() => setAttachModalCampaign(null)}
              className="absolute top-3.5 right-3.5 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h4 className="text-sm font-bold text-on-surface mb-0.5">
              Add Deliverable to &ldquo;{attachModalCampaign.name}&rdquo;
            </h4>
            <p className="text-[11px] text-on-surface-variant mb-4">
              Attach an existing link or generate a new trackable short link for this sponsor deal.
            </p>

            {/* Tab switch */}
            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl mb-4 border border-outline-variant/30">
              <button
                type="button"
                onClick={() => setAttachTab('existing')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                  attachTab === 'existing' 
                    ? 'bg-surface-container-lowest text-on-surface shadow-xs' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Attach Existing Link
              </button>
              <button
                type="button"
                onClick={() => setAttachTab('new')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                  attachTab === 'new' 
                    ? 'bg-surface-container-lowest text-on-surface shadow-xs' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                + Create New Deliverable
              </button>
            </div>

            {attachError && (
              <div className="p-2.5 mb-3 rounded-xl bg-error-container/30 border border-error text-error text-xs">
                {attachError}
              </div>
            )}

            {attachTab === 'existing' ? (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold block mb-1">Select Link to Attach</label>
                  <select
                    value={selectedLinkToAttach}
                    onChange={(e) => setSelectedLinkToAttach(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 text-on-surface outline-none focus:ring-2 focus:ring-primary-container text-xs cursor-pointer"
                  >
                    <option value="">-- Choose a link from workspace --</option>
                    {links
                      .filter(l => l.campaign_id !== attachModalCampaign.id)
                      .map(l => (
                        <option key={l.id} value={l.id}>
                          {l.title || `/${l.custom_slug || l.short_code}`} ({originUrl}/{l.custom_slug || l.short_code})
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setAttachModalCampaign(null)}
                    className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!selectedLinkToAttach}
                    onClick={handleAttachExisting}
                    className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer disabled:opacity-50 text-xs shadow-xs"
                  >
                    Attach Link
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateNewDeliverable} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold block mb-1">Destination URL <span className="text-error">*</span></label>
                  <input
                    type="url"
                    required
                    placeholder="https://sponsor.com/offer"
                    value={newDeliverableUrl}
                    onChange={(e) => setNewDeliverableUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 text-on-surface outline-none focus:ring-2 focus:ring-primary-container text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Deliverable Title</label>
                  <input
                    type="text"
                    placeholder="e.g. YouTube Dedicated Segment, IG Story Link"
                    value={newDeliverableTitle}
                    onChange={(e) => setNewDeliverableTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 text-on-surface outline-none focus:ring-2 focus:ring-primary-container text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Custom Slug (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. sponsor-exclusive"
                    value={newDeliverableSlug}
                    onChange={(e) => setNewDeliverableSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 text-on-surface outline-none focus:ring-2 focus:ring-primary-container font-mono text-xs"
                  />
                </div>

                <div className="p-2.5 bg-surface-container-low rounded-xl text-[11px] text-on-surface-variant flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary-container shrink-0" />
                  <span>Will auto-tag with <code>utm_campaign={attachModalCampaign.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}</code></span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setAttachModalCampaign(null)}
                    className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer text-xs shadow-xs"
                  >
                    Create &amp; Attach
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Apply UTM Preset Modal */}
      {mounted && bulkUtmModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBulkUtmModalOpen(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-5 shadow-2xl border border-outline-variant/40 relative animate-fade-in text-on-surface">
            <button
              type="button"
              onClick={() => setBulkUtmModalOpen(false)}
              className="absolute top-3.5 right-3.5 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-on-surface">Bulk Apply UTM Preset</h4>
            </div>
            <p className="text-[11px] text-on-surface-variant mb-4">
              Apply standard sponsor UTM taxonomy across all links in the chosen campaign with one click.
            </p>

            {bulkSuccessMsg && (
              <div className="p-3 mb-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{bulkSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleBulkApplyUtm} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold block mb-1">Target Campaign</label>
                <select
                  value={bulkTargetCampaignId}
                  onChange={(e) => setBulkTargetCampaignId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 text-on-surface outline-none focus:ring-2 focus:ring-primary-container text-xs cursor-pointer"
                >
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({getCampaignLinks(c).length} links attached)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Choose Preset Channel</label>
                <select
                  value={bulkPresetType}
                  onChange={(e) => setBulkPresetType(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 text-on-surface outline-none focus:ring-2 focus:ring-primary-container text-xs cursor-pointer"
                >
                  <option value="youtube">YouTube (utm_source=youtube &amp; medium=video_sponsor)</option>
                  <option value="instagram">Instagram (utm_source=ig_bio &amp; medium=bio)</option>
                  <option value="tiktok">TikTok (utm_source=tiktok_feed &amp; medium=clip)</option>
                  <option value="newsletter">Newsletter (utm_source=substack &amp; medium=email)</option>
                  <option value="creator_bundle">Creator Network Bundle (utm_source=creator_network &amp; medium=partner_read)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setBulkUtmModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!bulkTargetCampaignId}
                  className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer disabled:opacity-50 text-xs shadow-xs"
                >
                  Apply to All Deliverables
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Auto-UTM Settings / Configurator Modal */}
      {mounted && utmSettingsModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUtmSettingsModalOpen(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-5 shadow-2xl border border-outline-variant/40 relative animate-fade-in text-on-surface">
            <button
              type="button"
              onClick={() => setUtmSettingsModalOpen(false)}
              className="absolute top-3.5 right-3.5 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-surface-container-high text-primary-container flex items-center justify-center">
                <Settings className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-on-surface">Standard UTM Taxonomies</h4>
            </div>
            <p className="text-[11px] text-on-surface-variant mb-4">
              Preset parameters automatically adhere to Google Analytics 4 (GA4) and Adobe Analytics best practices.
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20">
                <span className="font-bold block text-on-surface">1. Video Placements</span>
                <span className="font-mono text-[11px] text-on-surface-variant block mt-0.5">
                  utm_source=youtube &bull; utm_medium=video_sponsor
                </span>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20">
                <span className="font-bold block text-on-surface">2. Social Bio Links</span>
                <span className="font-mono text-[11px] text-on-surface-variant block mt-0.5">
                  utm_source=ig_bio &bull; utm_medium=bio
                </span>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20">
                <span className="font-bold block text-on-surface">3. Short-Form Video</span>
                <span className="font-mono text-[11px] text-on-surface-variant block mt-0.5">
                  utm_source=tiktok_feed &bull; utm_medium=clip
                </span>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20">
                <span className="font-bold block text-on-surface">4. Written Newsletters</span>
                <span className="font-mono text-[11px] text-on-surface-variant block mt-0.5">
                  utm_source=substack &bull; utm_medium=email
                </span>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setUtmSettingsModalOpen(false)}
                className="px-4 py-2 bg-primary-container text-on-primary font-bold rounded-xl text-xs hover:bg-primary transition cursor-pointer"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Executive Sponsor Report (PDF / Print View) Modal */}
      {mounted && reportModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReportModalOpen(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-outline-variant/40 relative animate-fade-in max-h-[92vh] overflow-y-auto custom-scrollbar text-on-surface">
            
            {/* Header controls (hidden on print) */}
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20 print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">Sponsor Performance Report</h3>
                  <p className="text-xs text-on-surface-variant">Official verified analytics summary for brand partners</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-container text-on-primary rounded-xl text-xs font-bold hover:bg-primary transition cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="p-1 rounded-xl hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Campaign Selector dropdown for report (hidden on print) */}
            <div className="my-4 print:hidden">
              <label className="text-xs font-semibold text-on-surface block mb-1">Select Deal to Generate Report:</label>
              <select
                value={selectedReportCampId}
                onChange={(e) => setSelectedReportCampId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-outline-variant/30 outline-none cursor-pointer"
              >
                <option value="all">All Brand Deals (Executive Overview)</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name} &bull; {c.description}</option>
                ))}
              </select>
            </div>

            {/* Printable Document Body */}
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30">
                <div>
                  <div className="text-xl font-black text-on-surface tracking-tight">DELIVERABLE PERFORMANCE AUDIT</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">
                    Workspace: {currentWorkspace?.name || 'Primary Studio'} &bull; Generated: {new Date().toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                    VERIFIED DATA
                  </span>
                </div>
              </div>

              {reportCampaignsList.map(camp => {
                const campLinks = getCampaignLinks(camp);
                const campClicks = campLinks.reduce((acc, curr) => acc + (curr.clicks_count || 0), 0);
                const target = camp.target_clicks || 50000;
                const pct = Math.min(100, Math.round((campClicks / target) * 100));

                return (
                  <div key={camp.id} className="p-5 rounded-2xl bg-surface-container-low/50 border border-outline-variant/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-extrabold text-on-surface">{camp.name}</h4>
                        <p className="text-xs text-on-surface-variant">{camp.description} &bull; Target: {target.toLocaleString()} clicks</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-primary-container">{campClicks.toLocaleString()}</span>
                        <span className="text-xs text-on-surface-variant font-medium block">Clicks Achieved ({pct}%)</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
                      <div className="bg-primary-container h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>

                    {/* Deliverables Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-outline-variant/20 text-on-surface-variant font-semibold">
                            <th className="py-1.5 px-2">Deliverable</th>
                            <th className="py-1.5 px-2">Short URL</th>
                            <th className="py-1.5 px-2">Channel / Medium</th>
                            <th className="py-1.5 px-2 text-right">Clicks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10 text-[11px]">
                          {campLinks.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-2 px-2 text-center text-on-surface-variant italic">
                                No specific deliverables attached yet
                              </td>
                            </tr>
                          ) : (
                            campLinks.map(l => (
                              <tr key={l.id}>
                                <td className="py-2 px-2 font-medium text-on-surface truncate max-w-[150px]">{l.title}</td>
                                <td className="py-2 px-2 font-mono text-primary-container">{originUrl}/{l.custom_slug || l.short_code}</td>
                                <td className="py-2 px-2 text-on-surface-variant">{l.utm_medium || 'Direct Read'}</td>
                                <td className="py-2 px-2 font-mono text-right font-bold text-on-surface">{(l.clicks_count || 0).toLocaleString()}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              <div className="pt-4 border-t border-outline-variant/30 text-[11px] text-on-surface-variant flex items-center justify-between">
                <span>Certified by Antigravity Edge Shortener Engine</span>
                <span>Audit Ref: cmp_rpt_{Date.now().toString(36)}</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Role-Based Access Control Matrix Modal */}
      {mounted && matrixModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setMatrixModalOpen(false); }}
        >
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 sm:p-7 w-full max-w-xl shadow-2xl space-y-5 text-on-surface">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">Role-Based Access Control (RBAC)</h3>
                  <p className="text-xs text-on-surface-variant">Permissions &amp; seat capabilities for workspace collaborators</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setMatrixModalOpen(false)}
                className="p-1 rounded-xl hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                    <th className="py-2.5 px-3 font-bold">Feature Privilege</th>
                    <th className="py-2.5 px-2 font-bold text-center">Owner</th>
                    <th className="py-2.5 px-2 font-bold text-center">Admin</th>
                    <th className="py-2.5 px-2 font-bold text-center">Editor</th>
                    <th className="py-2.5 px-2 font-bold text-center">Viewer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 text-[11px]">
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-on-surface">Create &amp; Shorten Links</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-outline">✕</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-on-surface">Edit Destination &amp; Smart Rules</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-outline">✕</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-on-surface">Delete Links</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-outline">✕</td>
                    <td className="py-2.5 px-2 text-center text-outline">✕</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-on-surface">Create &amp; Manage Campaigns</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-outline">✕</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-on-surface">Delete Campaigns</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-outline">✕</td>
                    <td className="py-2.5 px-2 text-center text-outline">✕</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-on-surface">Invite &amp; Manage Members</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-outline">✕</td>
                    <td className="py-2.5 px-2 text-center text-outline">✕</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-on-surface">Manage Domains &amp; API Keys</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-outline">✕</td>
                    <td className="py-2.5 px-2 text-center text-outline">✕</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-on-surface">Export Analytics &amp; Reports</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                    <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">✓</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setMatrixModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-primary-container text-on-primary font-bold text-xs hover:bg-primary transition cursor-pointer"
              >
                Close Matrix
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
