'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/storeContext';
import { WorkspaceRole, WorkspaceInvitation, TeamMember } from '@/lib/types';
import { ROLE_DESCRIPTIONS, hasPermission } from '@/lib/rbac';
import { 
  Users, 
  UserPlus, 
  Check, 
  Copy, 
  Trash2, 
  ShieldCheck, 
  Building2, 
  Mail, 
  Clock, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Plus, 
  ExternalLink,
  ChevronDown,
  Search,
  RefreshCw,
  FolderKanban,
  Edit2,
  AlertTriangle
} from 'lucide-react';
import { InviteMemberModal } from './InviteMemberModal';
import { CreateTeamModal } from './CreateTeamModal';

interface TeamsViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const TeamsView: React.FC<TeamsViewProps> = ({ onNavigateTab }) => {
  const { 
    currentWorkspace, 
    workspaces, 
    setCurrentWorkspace, 
    teamMembers, 
    refreshTeamMembers,
    removeTeamMember, 
    updateMemberRole,
    currentUser,
    incomingInvitations,
    refreshIncomingInvitations,
    acceptInvitationDirect,
    declineInvitationDirect,
    updateWorkspace,
    deleteWorkspace,
    currentUserRole
  } = useStore();

  const [mounted, setMounted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [createWsModalOpen, setCreateWsModalOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [activeSubTab, setActiveSubTab] = useState<'members' | 'history' | 'matrix'>('members');
  
  // History logs
  const [historyLogs, setHistoryLogs] = useState<WorkspaceInvitation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Edit Workspace Modal
  const [editWsModalOpen, setEditWsModalOpen] = useState(false);
  const [editWsName, setEditWsName] = useState(currentWorkspace?.name || '');
  const [editWsSlug, setEditWsSlug] = useState(currentWorkspace?.slug || '');
  const [savingWs, setSavingWs] = useState(false);
  
  // Delete Workspace Modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingWs, setDeletingWs] = useState(false);

  // Incoming invite action loading state
  const [processingToken, setProcessingToken] = useState<string | null>(null);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshTeamMembers(),
        refreshIncomingInvitations()
      ]);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  useEffect(() => {
    setMounted(true);
    refreshIncomingInvitations();
    refreshTeamMembers();

    // Auto-poll members list every 6 seconds so invite acceptances update live on inviter's screen
    const interval = setInterval(() => {
      refreshTeamMembers();
      refreshIncomingInvitations();
    }, 6000);

    return () => clearInterval(interval);
  }, [refreshIncomingInvitations, refreshTeamMembers]);


  useEffect(() => {
    if (currentWorkspace) {
      setEditWsName(currentWorkspace.name);
      setEditWsSlug(currentWorkspace.slug);
    }
  }, [currentWorkspace]);

  // Load history when history tab opens
  useEffect(() => {
    if (activeSubTab === 'history' && currentWorkspace?.id) {
      setLoadingHistory(true);
      fetch(`/api/v1/invitations?history=true&workspace_id=${encodeURIComponent(currentWorkspace.id)}`)
        .then(r => r.json())
        .then(d => {
          if (d?.success && Array.isArray(d.history)) {
            setHistoryLogs(d.history);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    }
  }, [activeSubTab, currentWorkspace?.id]);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tiny-url-self.vercel.app';
  const userRole: WorkspaceRole = currentUserRole;
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleAcceptInvite = async (token: string) => {
    setProcessingToken(token);
    try {
      await acceptInvitationDirect(token);
      await refreshIncomingInvitations();
    } finally {
      setProcessingToken(null);
    }
  };

  const handleDeclineInvite = async (token: string) => {
    setProcessingToken(token);
    try {
      await declineInvitationDirect(token);
      await refreshIncomingInvitations();
    } finally {
      setProcessingToken(null);
    }
  };

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWsName.trim() || savingWs) return;
    setSavingWs(true);
    try {
      await updateWorkspace(currentWorkspace.id, editWsName.trim(), editWsSlug.trim());
      setEditWsModalOpen(false);
    } finally {
      setSavingWs(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (deletingWs) return;
    setDeletingWs(true);
    try {
      await deleteWorkspace(currentWorkspace.id);
      setDeleteConfirmOpen(false);
    } finally {
      setDeletingWs(false);
    }
  };

  // Filter members list
  const filteredMembers = teamMembers.filter(m => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const activeMembersCount = teamMembers.filter(m => m.status === 'active').length + 1; // +1 for workspace owner/active user
  const pendingMembersCount = teamMembers.filter(m => m.status === 'invited').length;

  if (!mounted) return null;

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-7xl mx-auto">
      
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary-container">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">Teams &amp; Workspaces</h1>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant">
            Manage multi-tenant workspace members, role delegations, invitations, and collaborate seamlessly across teams.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-surface-container-high hover:bg-surface-container text-on-surface border border-outline-variant/30 transition shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh team members and invitations"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary-container ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateWsModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface-container-high hover:bg-surface-container text-on-surface border border-outline-variant/30 transition shadow-2xs cursor-pointer"
          >
            <Building2 className="w-4 h-4 text-primary-container" />
            <span>New Workspace</span>
          </button>

          {isOwnerOrAdmin && (
            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary-container hover:opacity-90 text-on-primary shadow-xs transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite Collaborator</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 4 KPI Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Workspace Active */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-3">
            <span className="text-xs font-semibold">Current Workspace</span>
            <Building2 className="w-4 h-4 text-primary-container" />
          </div>
          <div>
            <div className="text-base sm:text-lg font-bold text-on-surface truncate">
              {currentWorkspace.name}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[11px] font-mono text-on-surface-variant">/{currentWorkspace.slug}</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-primary-container/10 text-primary-container">
                {userRole}
              </span>
            </div>
          </div>
        </div>

        {/* Active Collaborators */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-3">
            <span className="text-xs font-semibold">Active Collaborators</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-on-surface">
              {activeMembersCount}
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Across {workspaces.length} total workspace{workspaces.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* Pending Invites */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-3">
            <span className="text-xs font-semibold">Pending Invitations</span>
            <Mail className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
              {pendingMembersCount}
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Awaiting collaborator acceptance
            </p>
          </div>
        </div>

        {/* Incoming Invitations Alert */}
        <div className={`border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all ${
          incomingInvitations.length > 0 
            ? 'bg-amber-500/10 border-amber-500/30' 
            : 'bg-surface-container-lowest border-outline-variant/30'
        }`}>
          <div className="flex items-center justify-between text-on-surface-variant mb-3">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <span>Incoming Invites</span>
              {incomingInvitations.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </span>
            <Sparkles className="w-4 h-4 text-primary-container" />
          </div>
          <div>
            <div className={`text-2xl sm:text-3xl font-black ${
              incomingInvitations.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-on-surface'
            }`}>
              {incomingInvitations.length}
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              {incomingInvitations.length > 0 ? 'Action required below' : 'No pending team invites'}
            </p>
          </div>
        </div>

      </div>

      {/* ── Section: Incoming Invitations Sent from Other Workspaces ── */}
      {incomingInvitations.length > 0 && (
        <div className="bg-surface-container-lowest border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-md space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-on-surface">Invitations Received from Other Teams</h3>
                <p className="text-xs text-on-surface-variant">You have been invited to collaborate on the following workspace(s):</p>
              </div>
            </div>
            <button
              onClick={() => refreshIncomingInvitations()}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition"
              title="Refresh Invitations"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
            {incomingInvitations.map((inv) => (
              <div 
                key={inv.id}
                className="bg-surface-container-low/60 border border-outline-variant/30 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-amber-500/30 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-sm text-on-surface flex items-center gap-1.5 truncate">
                      <Building2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span className="truncate">{inv.workspace_name || 'Collaborative Workspace'}</span>
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-primary-fixed text-primary-container shrink-0">
                      Role: {inv.role}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Invited by <strong className="text-on-surface">{inv.inviter_email || 'Workspace Admin'}</strong>
                  </p>
                  {inv.expires_at && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>Valid until {new Date(inv.expires_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/20">
                  <button
                    type="button"
                    disabled={processingToken === inv.token}
                    onClick={() => handleAcceptInvite(inv.token)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{processingToken === inv.token ? 'Joining...' : 'Accept & Join'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={processingToken === inv.token}
                    onClick={() => handleDeclineInvite(inv.token)}
                    className="py-1.5 px-3 rounded-xl text-xs font-semibold text-outline hover:text-red-500 hover:bg-surface-container transition cursor-pointer disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sub Navigation Tabs (Members / History / Role Matrix) ── */}
      <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-2">
        <button
          onClick={() => setActiveSubTab('members')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'members'
              ? 'bg-surface-container-high text-on-surface shadow-2xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
          }`}
        >
          Active &amp; Pending Members ({teamMembers.length + 1})
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'history'
              ? 'bg-surface-container-high text-on-surface shadow-2xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
          }`}
        >
          Invitation History &amp; Audit Log
        </button>

        <button
          onClick={() => setActiveSubTab('matrix')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'matrix'
              ? 'bg-surface-container-high text-on-surface shadow-2xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
          }`}
        >
          Role Permission Matrix
        </button>
      </div>

      {/* ── TAB 1: MEMBERS & WORKSPACE MANAGEMENT ── */}
      {activeSubTab === 'members' && (
        <div className="space-y-6">

          {/* Current Workspace Control Card */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary-container flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-on-surface truncate">{currentWorkspace.name}</h3>
                  <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.2 rounded bg-surface-container text-primary-container">
                    {currentWorkspace.plan || 'pro'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-0.5">
                  <span>Slug: <strong className="text-on-surface font-mono">/{currentWorkspace.slug}</strong></span>
                  <span>&bull;</span>
                  <span>Created {new Date(currentWorkspace.created_at || Date.now()).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isOwnerOrAdmin && (
                <button
                  type="button"
                  onClick={() => setEditWsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-container hover:bg-surface-container-high text-on-surface transition cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-on-surface-variant" />
                  <span>Rename Workspace</span>
                </button>
              )}

              {userRole === 'owner' && workspaces.length > 1 && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-500/10 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search member by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary-container"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs font-semibold text-on-surface focus:outline-none cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admins</option>
                <option value="editor">Editors</option>
                <option value="viewer">Viewers</option>
              </select>
            </div>
          </div>

          {/* Members Table */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/20 bg-surface-container-low/40 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    <th className="py-3 px-4">Collaborator</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Invitation Link</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 text-xs">
                  
                  {/* Current Active User (Always at top) */}
                  <tr className="hover:bg-surface-container-low/30 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary font-bold text-xs flex items-center justify-center ring-1 ring-outline-variant/30 shrink-0">
                          {currentUser?.avatar || (currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-on-surface truncate">{currentUser?.name || "Workspace Lead"}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant font-medium">You</span>
                          </div>
                          <span className="text-[11px] text-on-surface-variant truncate block">{currentUser?.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold capitalize ${
                        userRole === 'owner' 
                          ? 'bg-primary-fixed text-primary-container' 
                          : (ROLE_DESCRIPTIONS[userRole]?.badgeColor || 'bg-surface-container text-on-surface')
                      }`}>
                        {userRole}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant text-[11px]">
                      Primary Session
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-[11px] font-medium text-on-surface-variant">
                        {userRole === 'owner' ? 'Workspace Owner' : userRole === 'admin' ? 'Workspace Admin' : 'Collaborator'}
                      </span>
                    </td>
                  </tr>

                  {/* Other Team Members & Pending Invites */}
                  {filteredMembers
                    .filter(m => !currentUser?.email || m.email.toLowerCase().trim() !== currentUser.email.toLowerCase().trim())
                    .map((m) => {
                      const isMemberOwner = m.role === 'owner';
                      const isPending = m.status === 'invited' && !isMemberOwner;
                      const inviteLink = m.invite_url || (m.token ? `${originUrl}/invite/${m.token}` : '');
                      const roleConfig = ROLE_DESCRIPTIONS[m.role] || ROLE_DESCRIPTIONS.editor;

                      return (
                        <tr key={m.id} className="hover:bg-surface-container-low/30 transition group">
                          
                          {/* Collaborator */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface font-bold text-xs flex items-center justify-center ring-1 ring-outline-variant/30 shrink-0">
                                {m.avatar || m.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-on-surface block truncate">{m.name}</span>
                                <span className="text-[11px] text-on-surface-variant block truncate">{m.email}</span>
                              </div>
                            </div>
                          </td>

                          {/* Role Selector */}
                          <td className="py-3.5 px-4">
                            {isMemberOwner ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold capitalize bg-primary-fixed text-primary-container">
                                Owner
                              </span>
                            ) : isOwnerOrAdmin && !isPending ? (
                              <select
                                value={m.role}
                                onChange={(e) => updateMemberRole(m.id, e.target.value as WorkspaceRole)}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold capitalize border border-outline-variant/30 bg-surface-container-lowest focus:outline-none cursor-pointer ${roleConfig.badgeColor}`}
                              >
                                <option value="admin">Admin</option>
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                              </select>
                            ) : (
                              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${roleConfig.badgeColor}`}>
                                {m.role}
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            )}
                          </td>

                          {/* Invitation Link Action */}
                          <td className="py-3.5 px-4">
                            {isMemberOwner ? (
                              <span className="text-on-surface-variant text-[11px]">Primary Lead</span>
                            ) : isPending && inviteLink ? (
                              <button
                                type="button"
                                onClick={() => handleCopyLink(inviteLink, m.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-surface-container hover:bg-surface-container-high text-primary-container transition cursor-pointer"
                              >
                                {copiedToken === m.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copiedToken === m.id ? 'Copied' : 'Copy Link'}</span>
                              </button>
                            ) : (
                              <span className="text-on-surface-variant text-[11px]">Accepted</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            {isMemberOwner ? (
                              <span className="text-[11px] text-on-surface-variant font-medium">Workspace Owner</span>
                            ) : hasPermission(userRole, 'members:remove') ? (
                              <button
                                type="button"
                                onClick={() => removeTeamMember(m.id)}
                                title={isPending ? "Revoke Invitation" : "Remove Member"}
                                className="p-1.5 rounded-lg text-outline hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : null}
                          </td>

                        </tr>
                      );
                    })}

                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-on-surface-variant text-xs">
                        No team members matching your search filter.
                      </td>
                    </tr>
                  )}

                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ── TAB 2: INVITATION HISTORY & AUDIT LOG ── */}
      {activeSubTab === 'history' && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-on-surface">Workspace Invitation Audit Log</h3>
              <p className="text-xs text-on-surface-variant">Trace chronological invitations issued, accepted, revoked, or expired.</p>
            </div>
            {loadingHistory && <RefreshCw className="w-4 h-4 animate-spin text-primary-container" />}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/20 bg-surface-container-low/40 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  <th className="py-2.5 px-3">Invitee</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Sent By</th>
                  <th className="py-2.5 px-3">Created Date</th>
                  <th className="py-2.5 px-3">Resolved Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 text-xs">
                {historyLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-container-low/30 transition">
                    <td className="py-3 px-3">
                      <span className="font-bold text-on-surface block">{log.name}</span>
                      <span className="text-[11px] text-on-surface-variant">{log.email}</span>
                    </td>
                    <td className="py-3 px-3 capitalize font-semibold">{log.role}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                        log.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        log.status === 'pending' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-on-surface-variant text-[11px]">{log.inviter_email || 'Admin'}</td>
                    <td className="py-3 px-3 text-on-surface-variant text-[11px]">{new Date(log.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-3 text-on-surface-variant text-[11px]">
                      {log.expires_at ? new Date(log.expires_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}

                {historyLogs.length === 0 && !loadingHistory && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-on-surface-variant text-xs">
                      No past invitations found for this workspace.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: ROLE PERMISSIONS MATRIX ── */}
      {activeSubTab === 'matrix' && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-on-surface">Role-Based Access Control (RBAC) Matrix</h3>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              Every collaborator receives deterministic permissions to prevent unintended changes to campaign URLs and workspace configurations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['owner', 'admin', 'editor', 'viewer'] as WorkspaceRole[]).map((roleKey) => {
              const meta = ROLE_DESCRIPTIONS[roleKey];
              return (
                <div key={roleKey} className="bg-surface-container-low/50 border border-outline-variant/30 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-on-surface">{meta.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${meta.badgeColor}`}>
                        {roleKey}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
                      {meta.description}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-outline-variant/20 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Create Links &amp; QR:</span>
                      <span className="font-semibold">{roleKey !== 'viewer' ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Create Campaigns:</span>
                      <span className="font-semibold">{roleKey !== 'viewer' ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Delete Campaigns:</span>
                      <span className="font-semibold">{roleKey === 'owner' || roleKey === 'admin' ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Invite Members:</span>
                      <span className="font-semibold">{roleKey === 'owner' || roleKey === 'admin' ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Workspace Deletion:</span>
                      <span className="font-semibold">{roleKey === 'owner' ? 'Owner Only' : 'No'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Invite Member Modal ── */}
      <InviteMemberModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
      />

      {/* ── Create Workspace Modal ── */}
      <CreateTeamModal
        isOpen={createWsModalOpen}
        onClose={() => setCreateWsModalOpen(false)}
      />

      {/* ── Edit Workspace Modal ── */}
      {editWsModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setEditWsModalOpen(false); }}
        >
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-on-surface">Rename Workspace</h3>
              <button 
                onClick={() => setEditWsModalOpen(false)}
                className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkspace} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Workspace Name</label>
                <input
                  type="text"
                  required
                  value={editWsName}
                  onChange={(e) => setEditWsName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:border-primary-container"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">URL Identifier / Slug</label>
                <input
                  type="text"
                  value={editWsSlug}
                  onChange={(e) => setEditWsSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-mono text-on-surface focus:outline-none focus:border-primary-container"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditWsModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingWs || !editWsName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary-container hover:opacity-90 text-on-primary cursor-pointer disabled:opacity-50"
                >
                  {savingWs ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Workspace Confirmation Modal ── */}
      {deleteConfirmOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirmOpen(false); }}
        >
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <span className="p-2 rounded-xl bg-red-500/10">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <h3 className="text-base font-bold text-on-surface">Delete Workspace?</h3>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Are you sure you want to delete <strong className="text-on-surface">{currentWorkspace.name}</strong>? All associated links, campaigns, and collaborator settings will be permanently removed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingWs}
                onClick={handleDeleteWorkspace}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer disabled:opacity-50"
              >
                {deletingWs ? 'Deleting...' : 'Confirm Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
