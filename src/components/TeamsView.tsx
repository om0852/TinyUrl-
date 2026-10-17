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
  Edit2,
  ChevronRight,
  Key,
  Link2,
  BadgeCheck,
  MoreVertical,
  Inbox
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

  const activeMembersCount = Math.max(1, teamMembers.filter(m => m.status === 'active').length);
  const pendingMembersCount = teamMembers.filter(m => m.status === 'invited').length;
  const totalRosterCount = Math.max(1, teamMembers.length);
  const displayRosterCount = Math.max(1, filteredMembers.length);

  const renderRoleBadge = (role: WorkspaceRole | string) => {
    const normRole = (role || 'editor').toLowerCase();
    if (normRole === 'owner') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/25 shadow-2xs">
          <Key className="w-3 h-3 text-purple-600 dark:text-purple-400" />
          <span>Owner</span>
        </span>
      );
    }
    if (normRole === 'admin') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/25 shadow-2xs">
          <ShieldCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          <span>Admin</span>
        </span>
      );
    }
    if (normRole === 'editor') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shadow-2xs">
          <span>Editor</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/25 shadow-2xs">
        <span>Viewer</span>
      </span>
    );
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col w-full gap-6 max-w-7xl mx-auto animate-fade-in">
      
      {/* ── Section 1: Breadcrumb, Page Header & Top Bar Actions ── */}
      <div className="flex flex-col gap-2">
        <nav className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
          <span 
            onClick={() => onNavigateTab && onNavigateTab('overview')} 
            className="hover:text-primary-container cursor-pointer transition-colors"
          >
            Workspace
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-outline-variant" />
          <span 
            onClick={() => onNavigateTab && onNavigateTab('settings')} 
            className="hover:text-primary-container cursor-pointer transition-colors"
          >
            Settings
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-outline-variant" />
          <span className="text-on-surface font-semibold">Teams &amp; Workspaces</span>
        </nav>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          <div className="flex flex-col gap-1 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
              Teams &amp; Workspaces
            </h1>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Manage multi-tenant workspace members, role delegations, invitations, and collaborate seamlessly across teams.
            </p>
          </div>

          {/* Action Group */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Sync Button */}
            <button
              id="syncBtn"
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-surface-container-lowest text-on-surface text-xs font-semibold rounded-lg border border-outline-variant/60 shadow-xs hover:bg-surface-container-low transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 text-primary-container ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
            </button>

            {/* New Workspace Button (Primary) */}
            <button
              id="newWorkspaceBtn"
              type="button"
              onClick={() => setCreateWsModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary-container text-on-primary rounded-lg px-4 py-2 hover:bg-primary shadow-sm hover:shadow transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Workspace</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 2: Top Info / Stats / KPI Cards (Grid of 4) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        
        {/* Card 1: Current Workspace */}
        <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/50 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-on-surface-variant font-medium">
                Current Workspace
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl font-bold text-on-surface truncate max-w-[150px]">
                  {currentWorkspace.name}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 text-primary border border-primary/20 shadow-2xs">
                  <Sparkles className="w-2.5 h-2.5 text-primary" />
                  <span>{currentWorkspace.plan || 'pro'}</span>
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary-container shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 flex items-center justify-between border-t border-surface-container-low text-xs">
            <span className="font-mono text-primary-container font-medium truncate max-w-[140px]">
              /{currentWorkspace.slug}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider bg-surface-container-high text-on-surface-variant border border-outline-variant/30">
              <Key className="w-2.5 h-2.5 text-primary" />
              <span>{userRole}</span>
            </span>
          </div>
        </div>

        {/* Card 2: Active Collaborators */}
        <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/50 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-on-surface-variant font-medium">
                Active Collaborators
              </span>
              <span className="text-2xl font-bold text-on-surface mt-1">
                {activeMembersCount}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary-container shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container-low">
            <span className="text-xs text-on-surface-variant">
              Across {workspaces.length} total workspace{workspaces.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Card 3: Pending Invitations */}
        <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/50 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-on-surface-variant font-medium">
                Pending Invitations
              </span>
              <span className="text-2xl font-bold text-on-surface mt-1">
                {pendingMembersCount}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
              <Mail className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container-low">
            <span className="text-xs text-on-surface-variant">
              Awaiting collaborator acceptance
            </span>
          </div>
        </div>

        {/* Card 4: Incoming Invites */}
        <div className={`rounded-xl p-5 border shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
          incomingInvitations.length > 0 
            ? 'bg-amber-500/10 border-amber-500/30' 
            : 'bg-surface-container-lowest border-outline-variant/50'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-on-surface-variant font-medium">
                Incoming Invites
              </span>
              <span className="text-2xl font-bold text-on-surface mt-1">
                {incomingInvitations.length}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
              <Inbox className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container-low">
            <span className="text-xs text-on-surface-variant">
              {incomingInvitations.length > 0 ? `${incomingInvitations.length} awaiting response below` : 'No pending team invites'}
            </span>
          </div>
        </div>

      </div>

      {/* ── Section: Incoming Invitations Sent from Other Workspaces ── */}
      {incomingInvitations.length > 0 && (
        <div className="bg-surface-container-lowest border-2 border-amber-500/40 rounded-xl p-5 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-on-surface">Invitations Received from Other Teams</h3>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {incomingInvitations.map((inv) => (
              <div 
                key={inv.id}
                className="bg-surface-container-low/60 border border-outline-variant/30 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-amber-500/30 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-sm text-on-surface flex items-center gap-1.5 truncate">
                      <Building2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span className="truncate">{inv.workspace_name || 'Collaborative Workspace'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0">
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
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{processingToken === inv.token ? 'Joining...' : 'Accept & Join'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={processingToken === inv.token}
                    onClick={() => handleDeclineInvite(inv.token)}
                    className="py-1.5 px-3 rounded-lg text-xs font-semibold text-outline hover:text-red-500 hover:bg-surface-container transition cursor-pointer disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 3: Tab Navigation ── */}
      <div className="border-b border-surface-container-highest">
        <nav className="flex space-x-8 -mb-px">
          <button
            type="button"
            onClick={() => setActiveSubTab('members')}
            className={`inline-flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'members'
                ? 'border-primary-container text-primary-container'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Active &amp; Pending Members ({totalRosterCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            className={`inline-flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'history'
                ? 'border-primary-container text-primary-container'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Invitation History &amp; Audit Log</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('matrix')}
            className={`inline-flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'matrix'
                ? 'border-primary-container text-primary-container'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Role Permission Matrix</span>
          </button>
        </nav>
      </div>

      {/* ── Section 4 & 5: Tab 1 Content: Workspace Detail Subheader, Filter Controls & Collaborator Table ── */}
      {activeSubTab === 'members' && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 shadow-sm overflow-hidden flex flex-col">
          
          {/* Workspace Detail Subheader / Context Bar & Filter Controls */}
          <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-surface-container-low">
            
            {/* Workspace Detail Info */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-on-surface truncate">
                  {currentWorkspace.name}
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 text-primary border border-primary/20 shadow-2xs">
                  <Sparkles className="w-2.5 h-2.5 text-primary" />
                  <span>{currentWorkspace.plan || 'pro'}</span>
                </span>

                {isOwnerOrAdmin && (
                  <button
                    type="button"
                    onClick={() => setEditWsModalOpen(true)}
                    className="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition"
                    title="Rename Workspace"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {userRole === 'owner' && workspaces.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="p-1 rounded-md text-red-500 hover:bg-red-500/10 transition"
                    title="Delete Workspace"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <span className="font-mono font-medium text-primary-container truncate">
                  Slug: /{currentWorkspace.slug}
                </span>
                <span>•</span>
                <span>Created {new Date(currentWorkspace.created_at || Date.now()).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Filter Controls: Role Tabs and Search */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Role Filter Tabs */}
              <div className="inline-flex p-1 bg-surface-container-low rounded-lg" id="roleTabGroup">
                <button
                  type="button"
                  onClick={() => setRoleFilter('all')}
                  className={`px-3 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                    roleFilter === 'all'
                      ? 'font-semibold bg-surface-container-lowest text-primary-container shadow-xs'
                      : 'font-medium text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  All Roles
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('admin')}
                  className={`px-3 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                    roleFilter === 'admin'
                      ? 'font-semibold bg-surface-container-lowest text-primary-container shadow-xs'
                      : 'font-medium text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Admins
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('editor')}
                  className={`px-3 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                    roleFilter === 'editor'
                      ? 'font-semibold bg-surface-container-lowest text-primary-container shadow-xs'
                      : 'font-medium text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Editors
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('viewer')}
                  className={`px-3 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                    roleFilter === 'viewer'
                      ? 'font-semibold bg-surface-container-lowest text-primary-container shadow-xs'
                      : 'font-medium text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Viewers
                </button>
              </div>

              {/* Search Input */}
              <div className="relative w-48 sm:w-56">
                <Search className="w-4 h-4 text-outline-variant absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="memberSearch"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search collaborator..."
                  className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low rounded-lg text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
              </div>

              {/* Invite Button */}
              {isOwnerOrAdmin && (
                <button
                  id="openInviteModalBtn"
                  type="button"
                  onClick={() => setInviteModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-container text-on-primary rounded-lg text-xs font-semibold hover:bg-primary transition-colors shadow-2xs cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Invite</span>
                </button>
              )}
            </div>

          </div>

          {/* Collaborator Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm border-collapse" id="teamTable">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3 px-5">Collaborator</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Invitation Link</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-on-surface divide-y divide-surface-container-low text-xs">
                
                {/* Current Active User / Session Lead (Top Row) */}
                <tr className="hover:bg-surface-container-low/60 transition-colors group">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                        {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'U'}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-on-surface truncate">
                            {currentUser?.name || 'Workspace User'}
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                            You
                          </span>
                        </div>
                        <span className="font-mono text-xs text-on-surface-variant truncate">
                          {currentUser?.email || 'user@workspace.com'}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    {renderRoleBadge(userRole)}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-md font-medium shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Active</span>
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-xs">
                    <div className="flex items-center gap-1.5 text-on-surface-variant">
                      <Link2 className="w-4 h-4 text-primary-container shrink-0" />
                      <span className="font-medium text-on-surface">Primary Session</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-5 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant font-medium bg-surface-container-high/80 border border-outline-variant/40 px-2.5 py-1 rounded-md shadow-2xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary-container" />
                        <span>{userRole === 'owner' ? 'Workspace Owner' : userRole === 'admin' ? 'Workspace Admin' : 'Collaborator'}</span>
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Team Members List */}
                {filteredMembers
                  .filter(m => !currentUser?.email || m.email.toLowerCase().trim() !== currentUser.email.toLowerCase().trim())
                  .map((m) => {
                    const isMemberOwner = m.role === 'owner';
                    const isPending = m.status === 'invited' && !isMemberOwner;
                    const inviteLink = m.invite_url || (m.token ? `${originUrl}/invite/${m.token}` : '');

                    return (
                      <tr key={m.id} className="hover:bg-surface-container-low/60 transition-colors group">
                        
                        {/* Collaborator */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                              {m.avatar || m.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-on-surface truncate">{m.name}</span>
                              <span className="font-mono text-xs text-on-surface-variant truncate">{m.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Role Selector or Badge */}
                        <td className="py-3.5 px-4">
                          {isMemberOwner ? (
                            renderRoleBadge('owner')
                          ) : isOwnerOrAdmin && !isPending ? (
                            <select
                              value={m.role}
                              onChange={(e) => updateMemberRole(m.id, e.target.value as WorkspaceRole)}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold capitalize border border-outline-variant/40 bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container cursor-pointer shadow-2xs"
                            >
                              <option value="admin">Admin</option>
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          ) : (
                            renderRoleBadge(m.role)
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-md font-medium shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              <span>Pending</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-md font-medium shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>Active</span>
                            </span>
                          )}
                        </td>

                        {/* Invitation Link */}
                        <td className="py-3.5 px-4 text-xs">
                          {isMemberOwner ? (
                            <div className="flex items-center gap-1.5 text-on-surface-variant">
                              <BadgeCheck className="w-4 h-4 text-primary-container shrink-0" />
                              <span className="font-medium text-on-surface">Primary Lead</span>
                            </div>
                          ) : isPending && inviteLink ? (
                            <button
                              type="button"
                              onClick={() => handleCopyLink(inviteLink, m.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-surface-container-high hover:bg-surface-container text-primary-container transition cursor-pointer"
                            >
                              {copiedToken === m.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-600">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-on-surface-variant">Accepted</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            {isMemberOwner ? (
                              <span className="text-xs text-primary-container font-semibold bg-primary-fixed/60 px-2.5 py-0.5 rounded-full">
                                Workspace Owner
                              </span>
                            ) : hasPermission(userRole, 'members:remove') ? (
                              <button
                                type="button"
                                onClick={() => removeTeamMember(m.id)}
                                title={isPending ? 'Revoke Invitation' : 'Remove Member'}
                                className="p-1 rounded-lg text-on-surface-variant hover:text-red-600 hover:bg-red-500/10 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded">
                                Collaborator
                              </span>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })}

                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-on-surface-variant text-xs">
                      No collaborators found matching the current search query or role filter.
                    </td>
                  </tr>
                )}

              </tbody>
            </table>
          </div>

          {/* Table Footer / Roster Count */}
          <div className="px-5 py-3.5 bg-surface-container-low/30 border-t border-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-2 text-on-surface-variant text-xs">
            <span>Showing {displayRosterCount} of {totalRosterCount} registered workspace members</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs text-outline font-medium">Auto-syncing real-time roster</span>
            </div>
          </div>

        </div>
      )}

      {/* ── TAB 2: INVITATION HISTORY & AUDIT LOG ── */}
      {activeSubTab === 'history' && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-on-surface">Workspace Invitation Audit Log</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Trace chronological invitations issued, accepted, revoked, or expired.</p>
            </div>
            {loadingHistory && <RefreshCw className="w-4 h-4 animate-spin text-primary-container" />}
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/30 bg-surface-container-low text-on-surface-variant uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Invitee</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Sent By</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4">Expiry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low text-on-surface">
                {historyLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-on-surface block">{log.name}</span>
                      <span className="font-mono text-[11px] text-on-surface-variant">{log.email}</span>
                    </td>
                    <td className="py-3 px-4">
                      {renderRoleBadge(log.role)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize border shadow-2xs ${
                        log.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' :
                        log.status === 'pending' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' :
                        'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          log.status === 'accepted' ? 'bg-emerald-500' :
                          log.status === 'pending' ? 'bg-amber-500 animate-pulse' :
                          'bg-rose-500'
                        }`} />
                        <span>{log.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant font-mono text-[11px]">{log.inviter_email || 'Admin'}</td>
                    <td className="py-3 px-4 text-on-surface-variant">{new Date(log.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-on-surface-variant">
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
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 shadow-sm p-5 sm:p-6 space-y-6">
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
                <div key={roleKey} className="bg-surface-container-low/50 border border-outline-variant/40 rounded-xl p-4 flex flex-col justify-between">
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

                  <div className="space-y-2 pt-3 border-t border-outline-variant/20 text-xs">
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
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-on-surface">Rename Workspace</h3>
              <button 
                onClick={() => setEditWsModalOpen(false)}
                className="p-1 rounded-md text-on-surface-variant hover:text-on-surface"
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
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:border-primary-container"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Workspace URL Slug</label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-surface-container-high border border-r-0 border-outline-variant/40 rounded-l-lg text-xs font-mono text-on-surface-variant">
                    /
                  </span>
                  <input
                    type="text"
                    required
                    value={editWsSlug}
                    onChange={(e) => setEditWsSlug(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-r-lg bg-surface-container-low border border-outline-variant/40 text-xs font-mono text-on-surface focus:outline-none focus:border-primary-container"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditWsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingWs}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-primary-container text-on-primary hover:bg-primary transition shadow-xs disabled:opacity-50"
                >
                  {savingWs ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirmOpen(false); }}
        >
          <div className="bg-surface-container-lowest border border-red-500/30 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <span className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-on-surface">Delete Workspace?</h3>
                <p className="text-xs text-on-surface-variant">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Are you sure you want to delete <strong className="text-on-surface">{currentWorkspace.name}</strong>? All associated short links, custom domains, campaigns, and team members will be permanently removed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingWs}
                onClick={handleDeleteWorkspace}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition shadow-xs disabled:opacity-50"
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
