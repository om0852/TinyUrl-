'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';
import { InviteMemberModal } from '@/components/InviteMemberModal';
import { 
  FolderKanban, 
  Plus, 
  FileText, 
  Check, 
  Copy, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Sparkles, 
  UserPlus, 
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
  AlertCircle,
  Users,
  BarChart3,
  Tag,
  Share2
} from 'lucide-react';
import { hasPermission, ROLE_DESCRIPTIONS } from '@/lib/rbac';
import { Campaign, Link as LinkType } from '@/lib/types';
import { SkeletonCampaignsView } from '@/components/ui/Skeleton';

interface CampaignsViewProps {
  onNavigateTab?: (tab: string) => void;
}

const UTM_PRESETS = [
  { id: 'p1', label: 'YouTube video', query: 'utm_source=youtube&utm_medium=video_sponsor' },
  { id: 'p2', label: 'Instagram bio', query: 'utm_source=ig_bio&utm_medium=bio' },
  { id: 'p3', label: 'TikTok bio', query: 'utm_source=tiktok_feed&utm_medium=clip' },
  { id: 'p4', label: 'Newsletter', query: 'utm_source=substack&utm_medium=email' },
];

export const CampaignsView: React.FC<CampaignsViewProps> = ({ onNavigateTab }) => {
  const { 
    currentUser, 
    campaigns, 
    addCampaign, 
    updateCampaign, 
    deleteCampaign, 
    teamMembers, 
    removeTeamMember, 
    links, 
    clicks,
    updateLink, 
    createShortLink, 
    currentWorkspace,
    currentUserRole,
    refreshCampaigns,
    scanBrokenLinks,
    isCampaignsLoading,
    isInitialLoading
  } = useStore();
  const { showToast } = useToast();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    refreshCampaigns();
  }, [refreshCampaigns]);

  const userRole = currentUserRole;
  const canCreate = hasPermission(userRole, 'campaigns:create');
  const canDelete = hasPermission(userRole, 'campaigns:delete');

  const activeCollaboratorsCount = useMemo(() => {
    return teamMembers.filter(m => m.status === 'active').length;
  }, [teamMembers]);

  // Modals state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editCampaignModal, setEditCampaignModal] = useState<Campaign | null>(null);
  const [deleteCampaignModal, setDeleteCampaignModal] = useState<Campaign | null>(null);
  const [attachModalCampaign, setAttachModalCampaign] = useState<Campaign | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [matrixModalOpen, setMatrixModalOpen] = useState(false);
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
  const [newTarget, setNewTarget] = useState(10000);
  const [newTagsStr, setNewTagsStr] = useState('');

  // Edit campaign form state
  const [editTitle, setEditTitle] = useState('');
  const [editSponsor, setEditSponsor] = useState('');
  const [editTarget, setEditTarget] = useState(10000);
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
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tinyurl.dev';

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
    // Attached links only. Matching on shared tags counted unrelated links ("sponsor" is a
    // default tag), counted one link in several campaigns, and made detach impossible.
    return links.filter(l => l.campaign_id === camp.id);
  };

  // Helper to get true clicks for link (taking max of clicks_count and telemetry click_events)
  const getLinkClicks = (l: LinkType) => {
    const eventsCount = clicks.filter(c => c.link_id === l.id || (c.short_code && l.short_code && c.short_code.toLowerCase() === l.short_code.toLowerCase())).length;
    return Math.max(l.clicks_count || 0, eventsCount);
  };

  // KPI Calculations
  const campaignLinkIds = new Set<string>();
  campaigns.forEach(c => {
    links.forEach(l => {
      if (l.campaign_id === c.id) {
        campaignLinkIds.add(l.id);
      }
    });
  });

  const campaignLinksTotal = links.filter(l => campaignLinkIds.has(l.id));
  const totalAttributedClicks = campaignLinksTotal.reduce((acc, curr) => acc + getLinkClicks(curr), 0);

  const compliantLinks = campaignLinksTotal.filter(l => 
    l.utm_source || l.utm_medium || l.utm_campaign || 
    (l.destination_url && l.destination_url.includes('utm_'))
  );
  const utmCompliancePct: number | null = campaignLinksTotal.length > 0
    ? Math.round((compliantLinks.length / campaignLinksTotal.length) * 100)
    : null;
  const brokenCampaignLinks = campaignLinksTotal.filter(l => l.status === 'broken' || (typeof l.broken_code === 'number' && l.broken_code >= 400));
  const lastHealthCheck = campaignLinksTotal
    .map(l => l.last_health_check)
    .filter((d): d is string => !!d)
    .sort()
    .pop();

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(camp => {
    const campLinks = getCampaignLinks(camp);
    const campClicks = campLinks.reduce((acc, curr) => acc + getLinkClicks(curr), 0);
    const target = camp.target_clicks || 10000;
    const isCompleted = campClicks >= target;

    if (filterTab === 'live') return !isCompleted;
    if (filterTab === 'completed') return isCompleted;
    return true;
  });

  const liveCampaignsCount = campaigns.filter(c => {
    const cLinks = getCampaignLinks(c);
    const cClicks = cLinks.reduce((acc, curr) => acc + getLinkClicks(curr), 0);
    return cClicks < (c.target_clicks || 10000);
  }).length;

  const completedCampaignsCount = campaigns.filter(c => {
    const cLinks = getCampaignLinks(c);
    const cClicks = cLinks.reduce((acc, curr) => acc + getLinkClicks(curr), 0);
    return cClicks >= (c.target_clicks || 10000);
  }).length;

  // One place for the "your role can't do this" message
  const allowOrToast = (allowed: boolean, action: string) => {
    if (allowed) return true;
    const roleName = ROLE_DESCRIPTIONS[userRole]?.title || userRole;
    showToast('error', 'Permission denied', `Your role (${roleName}) can't ${action}.`);
    return false;
  };

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
      newSponsor.trim(), 
      parsedTags, 
      Number(newTarget) || 10000
    );

    setNewTitle('');
    setNewSponsor('');
    setNewTarget(10000);
    setNewTagsStr('');
    setCreateModalOpen(false);
  };

  // Form submit: Edit Campaign
  const openEditModal = (camp: Campaign) => {
    setEditCampaignModal(camp);
    setEditTitle(camp.name);
    setEditSponsor(camp.description || '');
    setEditTarget(camp.target_clicks || 10000);
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
      target_clicks: Number(editTarget) || 10000,
      tags: parsedTags
    });

    showToast(
      'success',
      'Campaign Updated',
      `Campaign "${editTitle.trim()}" has been updated successfully.`
    );

    setEditCampaignModal(null);
  };

  // Delete Campaign
  const confirmDelete = () => {
    if (!deleteCampaignModal) return;
    if (!canDelete) {
      const roleName = ROLE_DESCRIPTIONS[userRole]?.title || userRole;
      showToast(
        'error',
        'Permission Denied',
        `Your role (${roleName}) does not have permission to delete campaigns.`
      );
      setDeleteCampaignModal(null);
      return;
    }
    deleteCampaign(deleteCampaignModal.id);
    setDeleteCampaignModal(null);
  };

  // Attach existing link to campaign
  const handleAttachExisting = () => {
    if (!attachModalCampaign || !selectedLinkToAttach) return;
    if (!canCreate) {
      const roleName = ROLE_DESCRIPTIONS[userRole]?.title || userRole;
      showToast(
        'error',
        'Permission Denied',
        `Your role (${roleName}) does not have permission to attach deliverables.`
      );
      return;
    }
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
    if (!canCreate) {
      const roleName = ROLE_DESCRIPTIONS[userRole]?.title || userRole;
      showToast(
        'error',
        'Permission Denied',
        `Your role (${roleName}) does not have permission to create deliverables.`
      );
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
    if (!canCreate) {
      const roleName = ROLE_DESCRIPTIONS[userRole]?.title || userRole;
      showToast(
        'error',
        'Permission Denied',
        `Your role (${roleName}) does not have permission to detach deliverables.`
      );
      return;
    }
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

  if (!mounted || ((isInitialLoading || isCampaignsLoading) && campaigns.length === 0)) {
    return (
      <div className="flex flex-col w-full gap-8 animate-fade-in text-on-surface">
        <SkeletonCampaignsView />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-8 animate-fade-in text-on-surface">
      
      {/* 1. Sub-header Breadcrumb & Operational Action Bar */}
      <div className="flex items-center justify-end gap-2">
        {/* Quick Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button 
            type="button"
            id="export-sponsor-report-btn"
            onClick={() => setReportModalOpen(true)}
            className="inline-flex items-center gap-2 text-xs font-semibold bg-surface-container-lowest text-on-surface shadow-xs rounded-xl px-4 py-2 hover:bg-surface-container-low transition-all border-[0.5px] border-outline-variant cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileText className="w-4 h-4 text-outline" />
            <span>Sponsor report</span>
          </button>
          
          <button 
            type="button"
            id="new-campaign-btn"
            onClick={() => {
              if (!canCreate) {
                const roleName = ROLE_DESCRIPTIONS[userRole]?.title || userRole;
                showToast(
                  'error',
                  'Permission Denied',
                  `Your role (${roleName}) does not have permission to create campaigns.`
                );
                return;
              }
              setCreateModalOpen(true);
            }}
            title={canCreate ? "New Campaign" : "New Campaign (Requires Editor, Admin, or Owner permissions)"}
            className={`inline-flex items-center gap-2 text-xs font-bold rounded-xl px-4 py-2 shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              canCreate 
                ? 'bg-primary-container text-on-primary hover:bg-primary' 
                : 'bg-surface-container-low text-on-surface-variant/60'
            }`}
          >
            {canCreate ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4 text-outline" />}
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {/* Stats (computed from attached links) */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-[15px]">
        {[
          { icon: <FolderKanban className="w-5 h-5" />, value: campaigns.length.toLocaleString(), label: 'Campaigns', hint: `${liveCampaignsCount} live · ${completedCampaignsCount} completed` },
          { icon: <Link2 className="w-5 h-5" />, value: campaignLinksTotal.length.toLocaleString(), label: 'Campaign links', hint: 'Attached to a campaign' },
          { icon: <BarChart3 className="w-5 h-5" />, value: totalAttributedClicks.toLocaleString(), label: 'Clicks', hint: 'On campaign links' },
          {
            icon: <Tag className="w-5 h-5" />,
            value: utmCompliancePct === null ? '—' : `${utmCompliancePct}%`,
            label: 'UTM tagged',
            hint: utmCompliancePct === null ? 'No campaign links yet' : `${compliantLinks.length} of ${campaignLinksTotal.length} links`,
          },
        ].map(card => (
          <div key={card.label} className="flex items-center gap-[10px] rounded-xl border-[0.5px] border-outline-variant p-[15px]">
            <div className="grid size-[40px] place-items-center rounded-md bg-surface-container text-on-surface-variant shrink-0">{card.icon}</div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-on-surface">{card.value}</div>
              <p className="text-xs text-outline truncate">{card.label} · {card.hint}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Campaign list + side panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[15px]">

        <div className="lg:col-span-8 flex flex-col gap-[15px]">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-[14px] font-semibold text-on-surface">Campaigns</h2>
            <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs" role="tablist" aria-label="Filter campaigns">
              {([
                { id: 'all', label: 'All', count: campaigns.length },
                { id: 'live', label: 'Live', count: liveCampaignsCount },
                { id: 'completed', label: 'Completed', count: completedCampaignsCount },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`filter-tab-${tab.id}`}
                  aria-selected={filterTab === tab.id}
                  onClick={() => setFilterTab(tab.id)}
                  className={`h-[26px] px-3 rounded-[4px] transition-colors cursor-pointer whitespace-nowrap ${
                    filterTab === tab.id ? 'bg-surface-container-lowest text-on-surface font-medium shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label} <span className="text-outline">{tab.count}</span>
                </button>
              ))}
            </div>
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="py-12 px-6 rounded-xl border-[0.5px] border-dashed border-outline-variant flex flex-col items-center text-center">
              <div className="grid size-[40px] place-items-center rounded-full bg-primary-fixed text-on-secondary-container">
                <FolderKanban className="w-5 h-5" />
              </div>
              <h3 className="mt-3 text-[14px] font-semibold text-on-surface">
                {campaigns.length === 0 ? 'No campaigns yet' : `No ${filterTab} campaigns`}
              </h3>
              <p className="mt-1 text-xs text-on-surface-variant max-w-xs">
                {campaigns.length === 0 ? 'Group the links for a sponsor or launch and track their clicks together.' : 'Try another filter.'}
              </p>
              {campaigns.length === 0 && (
                <button
                  type="button"
                  onClick={() => allowOrToast(canCreate, 'create campaigns') && setCreateModalOpen(true)}
                  className="mt-4 h-[34px] px-4 rounded-md bg-primary-container text-on-primary text-xs font-medium hover:bg-primary transition-colors cursor-pointer"
                >
                  New campaign
                </button>
              )}
            </div>
          ) : (
            filteredCampaigns.map((camp) => {
              const campLinks = getCampaignLinks(camp);
              const campClicks = campLinks.reduce((acc, curr) => acc + getLinkClicks(curr), 0);
              const target = camp.target_clicks || 10000;
              const pct = Math.min(100, Math.round((campClicks / target) * 100));
              const isGoalReached = campClicks >= target;
              const isExpanded = !!expandedCampaigns[camp.id];
              const iconBtn = 'size-[30px] rounded-md grid place-items-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer';

              return (
                <div key={camp.id} className="rounded-xl border-[0.5px] border-outline-variant p-[15px]">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[14px] font-semibold text-on-surface truncate">{camp.name}</h3>
                        <span className={`text-[10px] px-2 py-[1px] rounded-full font-medium ${isGoalReached ? 'bg-primary-fixed text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'}`}>
                          {isGoalReached ? 'Goal reached' : 'Live'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-on-surface-variant truncate">
                        {[camp.description, `${campLinks.length} ${campLinks.length === 1 ? 'link' : 'links'}`, ...(camp.tags || []).map(t => `#${t}`)]
                          .filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (!allowOrToast(canCreate, 'add links to campaigns')) return;
                          setAttachModalCampaign(camp);
                          setAttachTab('existing');
                          setAttachError('');
                        }}
                        className="h-[30px] px-2.5 mr-1 rounded-md border-[0.5px] border-outline-variant text-xs text-on-surface hover:bg-surface-container flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add link</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyText(`${originUrl}/c/${camp.id}`, camp.id, 'preset')}
                        title="Copy campaign page link"
                        aria-label="Copy campaign page link"
                        className={iconBtn}
                      >
                        {copiedPreset === camp.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => allowOrToast(canCreate, 'edit campaigns') && openEditModal(camp)}
                        title="Edit campaign"
                        aria-label="Edit campaign"
                        className={iconBtn}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => allowOrToast(canDelete, 'delete campaigns') && setDeleteCampaignModal(camp)}
                        title="Delete campaign"
                        aria-label="Delete campaign"
                        className={`${iconBtn} hover:!text-error hover:!bg-error-container`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mt-3">
                    <div className="w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${isGoalReached ? 'bg-secondary' : 'bg-primary-container'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-on-surface-variant">
                      <span>
                        <span className="font-semibold text-on-surface tabular-nums">{campClicks.toLocaleString()}</span> / {target.toLocaleString()} clicks · {pct}%
                      </span>
                      {campLinks.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleAccordion(camp.id)}
                          aria-expanded={isExpanded}
                          className="text-primary-ink hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          {isExpanded ? 'Hide links' : `Show links (${campLinks.length})`}
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Links */}
                  {isExpanded && campLinks.length > 0 && (
                    <div className="mt-3 pt-3 border-t-[0.5px] border-outline-variant flex flex-col gap-1.5 animate-fade-in">
                      {campLinks.map((link) => {
                        const slug = link.custom_slug || link.short_code;
                        const fullShortUrl = `${originUrl}/${slug}`;
                        const isCopied = copiedLinkId === link.id;
                        const linkClicks = getLinkClicks(link);
                        return (
                          <div key={link.id} className="flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-surface-container-low transition-colors">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-on-surface truncate">{link.title || `/${slug}`}</div>
                              <div className="text-[11px] text-outline truncate" title={link.destination_url}>
                                <span className="text-primary-ink">/{slug}</span> → {link.destination_url}
                              </div>
                            </div>
                            <span className="text-[11px] text-on-surface-variant tabular-nums whitespace-nowrap">{linkClicks.toLocaleString()} clicks</span>
                            <button type="button" onClick={() => handleCopyText(fullShortUrl, link.id, 'link')} title="Copy short link" aria-label="Copy short link" className={iconBtn}>
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <a href={fullShortUrl} target="_blank" rel="noreferrer" title="Open link" aria-label="Open link" className={iconBtn}>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button type="button" onClick={() => handleDetachLink(link.id)} title="Remove from campaign" aria-label="Remove from campaign" className={`${iconBtn} hover:!text-error hover:!bg-error-container`}>
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="lg:col-span-4 flex flex-col gap-[15px]">
          {/* UTM presets */}
          <div className="rounded-xl p-[15px] border-[0.5px] border-outline-variant">
            <h3 className="text-[14px] font-semibold text-on-surface">UTM presets</h3>
            <div className="mt-2 flex flex-col">
              {UTM_PRESETS.map(p => (
                <div key={p.id} className="flex items-center gap-2 py-2 border-b-[0.5px] border-outline-variant last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-on-surface truncate">{p.label}</div>
                    <div className="font-mono text-[10px] text-outline truncate">{p.query}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(`?${p.query}`, p.id)}
                    title="Copy parameters"
                    aria-label={`Copy ${p.label} parameters`}
                    className="size-[28px] rounded-md grid place-items-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer shrink-0"
                  >
                    {copiedPreset === p.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              id="bulk-apply-utm-btn"
              disabled={campaigns.length === 0}
              onClick={() => {
                if (campaigns.length > 0) setBulkTargetCampaignId(campaigns[0].id);
                setBulkUtmModalOpen(true);
              }}
              className="w-full mt-2 h-[32px] rounded-md border-[0.5px] border-outline-variant text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply a preset to a campaign
            </button>
          </div>

          {/* Team */}
          <div className="rounded-xl px-[15px] py-3 border-[0.5px] border-outline-variant flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 min-w-0">
              <Users className="w-4 h-4 text-on-surface-variant shrink-0" />
              <span className="text-[14px] font-semibold text-on-surface">Team</span>
              <span className="text-xs text-outline truncate">
                {activeCollaboratorsCount === 0 ? 'Just you' : `${activeCollaboratorsCount} member${activeCollaboratorsCount === 1 ? '' : 's'}`}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab ? onNavigateTab('teams') : null}
              className="text-xs text-primary-ink hover:underline cursor-pointer shrink-0"
            >
              Manage
            </button>
          </div>

          {/* Link health (results of the broken-link scanner) */}
          <div className="rounded-xl p-[15px] border-[0.5px] border-outline-variant">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-on-surface">
                <Activity className="w-4 h-4 text-on-surface-variant" />
                Link health
              </span>
              <button
                type="button"
                disabled={isCheckingHealth || campaignLinksTotal.length === 0}
                onClick={async () => {
                  setIsCheckingHealth(true);
                  const result = await scanBrokenLinks();
                  setIsCheckingHealth(false);
                  if (!result.success) showToast('error', 'Health check failed', result.error || 'Please try again.');
                }}
                className="h-[28px] px-2.5 rounded-md border-[0.5px] border-outline-variant text-[11px] text-on-surface hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isCheckingHealth ? 'Checking…' : 'Check now'}
              </button>
            </div>
            <p className="mt-2 text-xs text-on-surface-variant">
              {campaignLinksTotal.length === 0
                ? 'No campaign links to check yet.'
                : brokenCampaignLinks.length === 0
                  ? `All ${campaignLinksTotal.length} campaign links are working.`
                  : `${brokenCampaignLinks.length} of ${campaignLinksTotal.length} campaign links are broken.`}
            </p>
            <p className="mt-0.5 text-[11px] text-outline">
              {lastHealthCheck ? `Last checked ${new Date(lastHealthCheck).toLocaleString()}` : 'Not checked yet'}
            </p>
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
          className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateModalOpen(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-xl max-w-md w-full p-5 shadow-2xl border-[0.5px] border-outline-variant relative animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-3.5 right-3.5 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h4 className="text-[15px] font-semibold text-on-surface mb-4">New campaign</h4>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-on-surface mb-1 flex items-center">
                  <span>Name</span>
                </label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Autumn Gear Sponsor"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border-[0.5px] border-outline-variant outline-none focus:ring-2 focus:ring-primary-strong text-on-surface text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface mb-1 flex items-center">
                  <span>Sponsor</span>
                </label>
                <input 
                  type="text"
                  placeholder="e.g. Sony, NordVPN, Adobe"
                  value={newSponsor}
                  onChange={(e) => setNewSponsor(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border-[0.5px] border-outline-variant outline-none focus:ring-2 focus:ring-primary-strong text-on-surface text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface mb-1 flex items-center">
                  <span>Click target</span>
                </label>
                <input 
                  type="number"
                  value={newTarget}
                  onChange={(e) => setNewTarget(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border-[0.5px] border-outline-variant outline-none focus:ring-2 focus:ring-primary-strong text-on-surface font-mono text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface mb-1 flex items-center">
                  <span>Tags</span>
                </label>
                <input 
                  type="text"
                  placeholder="e.g. spring, video"
                  value={newTagsStr}
                  onChange={(e) => setNewTagsStr(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border-[0.5px] border-outline-variant outline-none focus:ring-2 focus:ring-primary-strong text-on-surface text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t-[0.5px] border-outline-variant mt-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer shadow-xs text-xs"
                >
                  Create campaign
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
          className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditCampaignModal(null);
          }}
        >
          <div className="bg-surface-container-lowest rounded-xl max-w-md w-full p-5 shadow-2xl border-[0.5px] border-outline-variant relative animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setEditCampaignModal(null)}
              className="absolute top-3.5 right-3.5 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h4 className="text-[15px] font-semibold text-on-surface mb-4">Edit campaign</h4>

            <form onSubmit={handleUpdate} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-on-surface block mb-1">Name</label>
                <input 
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border-[0.5px] border-outline-variant outline-none focus:ring-2 focus:ring-primary-strong text-on-surface text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Sponsor</label>
                <input 
                  type="text"
                  value={editSponsor}
                  onChange={(e) => setEditSponsor(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border-[0.5px] border-outline-variant outline-none focus:ring-2 focus:ring-primary-strong text-on-surface text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Click target</label>
                <input 
                  type="number"
                  value={editTarget}
                  onChange={(e) => setEditTarget(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border-[0.5px] border-outline-variant outline-none focus:ring-2 focus:ring-primary-strong text-on-surface font-mono text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Tags</label>
                <input 
                  type="text"
                  value={editTagsStr}
                  onChange={(e) => setEditTagsStr(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border-[0.5px] border-outline-variant outline-none focus:ring-2 focus:ring-primary-strong text-on-surface text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t-[0.5px] border-outline-variant mt-3">
                <button
                  type="button"
                  onClick={() => setEditCampaignModal(null)}
                  className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer shadow-xs text-xs"
                >
                  Save changes
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
          className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteCampaignModal(null);
          }}
        >
          <div className="bg-surface-container-lowest rounded-xl max-w-sm w-full p-5 shadow-2xl border-[0.5px] border-outline-variant relative animate-fade-in text-on-surface">
            <div className="w-10 h-10 rounded-lg bg-error-container/30 text-error flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h4 className="text-sm font-bold text-on-surface mb-1">Delete Campaign?</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
              Are you sure you want to delete <strong>{deleteCampaignModal.name}</strong>? Attached links will remain active in your workspace, but will no longer be grouped under this deal.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
              <button
                type="button"
                onClick={() => setDeleteCampaignModal(null)}
                className="px-3.5 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3.5 py-1.5 rounded-lg bg-error text-white font-bold hover:bg-error/90 cursor-pointer text-xs shadow-xs"
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
          className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAttachModalCampaign(null);
          }}
        >
          <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-5 shadow-2xl border-[0.5px] border-outline-variant relative animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar text-on-surface">
            <button
              type="button"
              onClick={() => setAttachModalCampaign(null)}
              className="absolute top-3.5 right-3.5 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h4 className="text-sm font-bold text-on-surface mb-0.5">
              Add link to &ldquo;{attachModalCampaign.name}&rdquo;
            </h4>

            {/* Tab switch */}
            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg mb-4 border border-outline-variant">
              <button
                type="button"
                onClick={() => setAttachTab('existing')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
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
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                  attachTab === 'new' 
                    ? 'bg-surface-container-lowest text-on-surface shadow-xs' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                + Create New Deliverable
              </button>
            </div>

            {attachError && (
              <div className="p-2.5 mb-3 rounded-lg bg-error-container/30 border border-error text-error text-xs">
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
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg border-[0.5px] border-outline-variant text-on-surface outline-none focus:ring-2 focus:ring-primary-strong text-xs cursor-pointer"
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

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant">
                  <button
                    type="button"
                    onClick={() => setAttachModalCampaign(null)}
                    className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!selectedLinkToAttach}
                    onClick={handleAttachExisting}
                    className="px-4 py-2 rounded-lg bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer disabled:opacity-50 text-xs shadow-xs"
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
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg border-[0.5px] border-outline-variant text-on-surface outline-none focus:ring-2 focus:ring-primary-strong text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Deliverable Title</label>
                  <input
                    type="text"
                    placeholder="e.g. YouTube Dedicated Segment, IG Story Link"
                    value={newDeliverableTitle}
                    onChange={(e) => setNewDeliverableTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg border-[0.5px] border-outline-variant text-on-surface outline-none focus:ring-2 focus:ring-primary-strong text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Custom Slug (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. sponsor-exclusive"
                    value={newDeliverableSlug}
                    onChange={(e) => setNewDeliverableSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg border-[0.5px] border-outline-variant text-on-surface outline-none focus:ring-2 focus:ring-primary-strong font-mono text-xs"
                  />
                </div>

                <div className="p-2.5 bg-surface-container-low rounded-lg text-[11px] text-on-surface-variant flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary-ink shrink-0" />
                  <span>Will auto-tag with <code>utm_campaign={attachModalCampaign.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}</code></span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant">
                  <button
                    type="button"
                    onClick={() => setAttachModalCampaign(null)}
                    className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer text-xs shadow-xs"
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
          className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBulkUtmModalOpen(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-xl max-w-md w-full p-5 shadow-2xl border-[0.5px] border-outline-variant relative animate-fade-in text-on-surface">
            <button
              type="button"
              onClick={() => setBulkUtmModalOpen(false)}
              className="absolute top-3.5 right-3.5 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-on-surface">Apply UTM preset</h4>
            </div>

            {bulkSuccessMsg && (
              <div className="p-3 mb-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
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
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border-[0.5px] border-outline-variant text-on-surface outline-none focus:ring-2 focus:ring-primary-strong text-xs cursor-pointer"
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
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border-[0.5px] border-outline-variant text-on-surface outline-none focus:ring-2 focus:ring-primary-strong text-xs cursor-pointer"
                >
                  <option value="youtube">YouTube video</option>
                  <option value="instagram">Instagram bio</option>
                  <option value="tiktok">TikTok bio</option>
                  <option value="newsletter">Newsletter</option>
                  <option value="creator_bundle">Creator network</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setBulkUtmModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!bulkTargetCampaignId}
                  className="px-4 py-2 rounded-lg bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer disabled:opacity-50 text-xs shadow-xs"
                >
                  Apply to All Deliverables
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Executive Sponsor Report (PDF / Print View) Modal */}
      {mounted && reportModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReportModalOpen(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border-[0.5px] border-outline-variant relative animate-fade-in max-h-[92vh] overflow-y-auto custom-scrollbar text-on-surface">
            
            {/* Header controls (hidden on print) */}
            <div className="flex items-center justify-between pb-4 border-b-[0.5px] border-outline-variant print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">Sponsor report</h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-container text-on-primary rounded-lg text-xs font-bold hover:bg-primary transition cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Campaign Selector dropdown for report (hidden on print) */}
            <div className="my-4 print:hidden">
              <label className="text-xs font-semibold text-on-surface block mb-1">Campaign</label>
              <select
                value={selectedReportCampId}
                onChange={(e) => setSelectedReportCampId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-xs text-on-surface border-[0.5px] border-outline-variant outline-none cursor-pointer"
              >
                <option value="all">All campaigns</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name} &bull; {c.description}</option>
                ))}
              </select>
            </div>

            {/* Printable Document Body */}
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant">
                <div>
                  <div className="text-xl font-black text-on-surface tracking-tight">DELIVERABLE PERFORMANCE AUDIT</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">
                    Workspace: {currentWorkspace?.name || 'Primary Studio'} &bull; Generated: {new Date().toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                    VERIFIED DATA
                  </span>
                </div>
              </div>

              {reportCampaignsList.map(camp => {
                const campLinks = getCampaignLinks(camp);
                const campClicks = campLinks.reduce((acc, curr) => acc + getLinkClicks(curr), 0);
                const target = camp.target_clicks || 10000;
                const pct = Math.min(100, Math.round((campClicks / target) * 100));

                return (
                  <div key={camp.id} className="p-5 rounded-lg bg-surface-container-low/50 border-[0.5px] border-outline-variant space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-extrabold text-on-surface">{camp.name}</h4>
                        <p className="text-xs text-on-surface-variant">{camp.description} &bull; Target: {target.toLocaleString()} clicks</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-primary-ink">{campClicks.toLocaleString()}</span>
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
                          <tr className="border-b border-outline-variant text-on-surface-variant font-semibold">
                            <th className="py-1.5 px-2">Deliverable</th>
                            <th className="py-1.5 px-2">Short URL</th>
                            <th className="py-1.5 px-2">Channel / Medium</th>
                            <th className="py-1.5 px-2 text-right">Clicks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant text-[11px]">
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
                                <td className="py-2 px-2 font-mono text-primary-ink">{originUrl}/{l.custom_slug || l.short_code}</td>
                                <td className="py-2 px-2 text-on-surface-variant">{l.utm_medium || 'Direct Read'}</td>
                                <td className="py-2 px-2 font-mono text-right font-bold text-on-surface">{getLinkClicks(l).toLocaleString()}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              <div className="pt-4 border-t-[0.5px] border-outline-variant text-[11px] text-on-surface-variant flex items-center justify-between">
                <span>Generated {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Role-Based Access Control Matrix Modal */}
      {mounted && matrixModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setMatrixModalOpen(false); }}
        >
          <div className="bg-surface-container-lowest border-[0.5px] border-outline-variant rounded-xl p-6 sm:p-7 w-full max-w-xl shadow-2xl space-y-5 text-on-surface">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">Roles &amp; permissions</h3>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setMatrixModalOpen(false)}
                className="p-1 rounded-lg hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant">
                    <th className="py-2.5 px-3 font-bold">Feature Privilege</th>
                    <th className="py-2.5 px-2 font-bold text-center">Owner</th>
                    <th className="py-2.5 px-2 font-bold text-center">Admin</th>
                    <th className="py-2.5 px-2 font-bold text-center">Editor</th>
                    <th className="py-2.5 px-2 font-bold text-center">Viewer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-[11px]">
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
                className="px-5 py-2.5 rounded-lg bg-primary-container text-on-primary font-bold text-xs hover:bg-primary transition cursor-pointer"
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
