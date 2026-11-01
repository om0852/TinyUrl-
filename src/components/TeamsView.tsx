'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';
import { WorkspaceRole, WorkspaceInvitation, TeamMember } from '@/lib/types';
import { Permission, hasPermission } from '@/lib/rbac';
import {
  Users,
  UserPlus,
  Check,
  Copy,
  Trash2,
  Building2,
  Mail,
  AlertCircle,
  X,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Inbox
} from 'lucide-react';
import { InviteMemberModal } from './InviteMemberModal';
import { CreateTeamModal } from './CreateTeamModal';
import { SkeletonTeamsView } from '@/components/ui/Skeleton';

interface TeamsViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const TeamsView: React.FC<TeamsViewProps> = () => {
  const { 
    currentWorkspace, 
    workspaces, 
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
    currentUserRole,
    isTeamLoading,
    isInitialLoading
  } = useStore();

  const { showToast } = useToast();
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
        refreshTeamMembers(true),
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

    // Auto-poll members list only when tab is visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        refreshTeamMembers();
        refreshIncomingInvitations();
      }
    }, 20000);

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

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tinyurl.dev';
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
      const result = await acceptInvitationDirect(token);
      if (!result.success) showToast('error', 'Could not join', result.error || 'Please try again.');
      await refreshIncomingInvitations();
    } finally {
      setProcessingToken(null);
    }
  };

  const handleDeclineInvite = async (token: string) => {
    setProcessingToken(token);
    try {
      const result = await declineInvitationDirect(token);
      if (!result.success) showToast('error', 'Could not decline', result.error || 'Please try again.');
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
      if (await updateWorkspace(currentWorkspace.id, editWsName.trim(), editWsSlug.trim())) setEditWsModalOpen(false);
    } finally {
      setSavingWs(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (deletingWs) return;
    setDeletingWs(true);
    try {
      if (await deleteWorkspace(currentWorkspace.id)) setDeleteConfirmOpen(false);
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

  const activeMembersCount = Math.max(1, teamMembers.filter(m => m.status === 'active').length); // includes you
  const pendingMembersCount = teamMembers.filter(m => m.status === 'invited').length;

  const renderRoleBadge = (role: WorkspaceRole | string) => {
    const normRole = (role || 'editor').toLowerCase();
    return (
      <span className={`inline-flex items-center px-2 py-[1px] rounded-full text-[11px] font-medium capitalize ${
        normRole === 'owner' ? 'bg-primary-fixed text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'
      }`}>
        {normRole}
      </span>
    );
  };

  const historyStatus = (status: string) => (
    <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant capitalize whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'accepted' ? 'bg-emerald-500' : status === 'pending' ? 'bg-amber-500' : 'bg-rose-500'}`} />
      {status}
    </span>
  );

  if (!mounted || ((isInitialLoading || isTeamLoading) && teamMembers.length === 0)) {
    return (
      <div className="flex flex-col w-full gap-6 max-w-7xl mx-auto animate-fade-in">
        <SkeletonTeamsView />
      </div>
    );
  }

  const iconBtn = 'size-[30px] rounded-md grid place-items-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer';
  const selfEmail = (currentUser?.email || '').toLowerCase().trim();
  const otherMembers = filteredMembers.filter(m => !selfEmail || m.email.toLowerCase().trim() !== selfEmail);
  const statusDot = (pending: boolean) => (
    <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full ${pending ? 'bg-amber-500' : 'bg-emerald-500'}`} />
      {pending ? 'Invited' : 'Active'}
    </span>
  );
  const memberRole = (m: TeamMember, isPending: boolean) => {
    if (m.role !== 'owner' && isOwnerOrAdmin && !isPending) {
      return (
        <select
          value={m.role}
          onChange={(e) => updateMemberRole(m.id, e.target.value as WorkspaceRole)}
          aria-label={`Role for ${m.name}`}
          className="h-[28px] px-2 rounded-md text-xs capitalize border-[0.5px] border-outline-variant bg-surface-container-lowest text-on-surface outline-none focus:border-on-surface-variant cursor-pointer"
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      );
    }
    return renderRoleBadge(m.role);
  };
  const memberActions = (m: TeamMember, isPending: boolean, inviteLink: string) => (
    <>
      {isPending && inviteLink && (
        <button type="button" onClick={() => handleCopyLink(inviteLink, m.id)} title="Copy invite link" aria-label="Copy invite link" className={iconBtn}>
          {copiedToken === m.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}
      {m.role !== 'owner' && hasPermission(userRole, 'members:remove') && (
        <button
          type="button"
          onClick={() => removeTeamMember(m.id)}
          title={isPending ? 'Cancel invite' : 'Remove member'}
          aria-label={isPending ? 'Cancel invite' : 'Remove member'}
          className={`${iconBtn} hover:!text-error hover:!bg-error-container`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </>
  );
  const avatar = (label: string, self = false) => (
    <div className={`size-[32px] rounded-full grid place-items-center font-semibold text-[11px] shrink-0 ${self ? 'bg-primary-container text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
      {label}
    </div>
  );
  const ROLE_ROWS: { label: string; perm: Permission }[] = [
    { label: 'Create and edit links', perm: 'links:create' },
    { label: 'Delete links', perm: 'links:delete' },
    { label: 'Create campaigns', perm: 'campaigns:create' },
    { label: 'Delete campaigns', perm: 'campaigns:delete' },
    { label: 'Invite and remove members', perm: 'members:invite' },
    { label: 'Domains and API keys', perm: 'domains:manage' },
    { label: 'Client portals', perm: 'clients:manage' },
    { label: 'Workspace settings', perm: 'settings:manage' },
    { label: 'View analytics and export', perm: 'analytics:read' },
  ];

  return (
    <div className="flex flex-col w-full gap-[15px] max-w-7xl mx-auto pb-16 animate-fade-in text-on-surface">

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="grid size-[34px] place-items-center rounded-md bg-surface-container text-on-surface-variant shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h1 className="text-[14px] font-semibold text-on-surface truncate">{currentWorkspace.name}</h1>
              {hasPermission(userRole, 'settings:manage') && (
                <button type="button" onClick={() => setEditWsModalOpen(true)} title="Rename workspace" aria-label="Rename workspace" className={iconBtn}>
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {userRole === 'owner' && workspaces.length > 1 && (
                <button type="button" onClick={() => setDeleteConfirmOpen(true)} title="Delete workspace" aria-label="Delete workspace" className={`${iconBtn} hover:!text-error hover:!bg-error-container`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-outline truncate">/{currentWorkspace.slug} · You&rsquo;re {userRole === 'admin' || userRole === 'owner' ? 'an' : 'a'} {userRole}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="syncBtn"
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            title="Refresh"
            aria-label="Refresh"
            className="size-[34px] rounded-md border-[0.5px] border-outline-variant grid place-items-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            id="newWorkspaceBtn"
            type="button"
            onClick={() => setCreateWsModalOpen(true)}
            className="h-[34px] px-3 rounded-md border-[0.5px] border-outline-variant text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New workspace</span>
          </button>
          {isOwnerOrAdmin && (
            <button
              id="openInviteModalBtn"
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="h-[34px] px-4 rounded-md bg-primary-container text-on-primary text-xs font-medium hover:bg-primary transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-[15px]">
        {[
          { icon: <Users className="w-5 h-5" />, value: activeMembersCount, label: 'Members', hint: 'Active' },
          { icon: <Mail className="w-5 h-5" />, value: pendingMembersCount, label: 'Invites sent', hint: 'Not accepted yet' },
          { icon: <Inbox className="w-5 h-5" />, value: incomingInvitations.length, label: 'Invites for you', hint: 'From other teams' },
          { icon: <Building2 className="w-5 h-5" />, value: workspaces.length, label: 'Workspaces', hint: 'You can open' },
        ].map(card => (
          <div key={card.label} className="flex items-center gap-[10px] rounded-xl border-[0.5px] border-outline-variant p-[15px] min-w-0">
            <div className="grid size-[40px] place-items-center rounded-md bg-surface-container text-on-surface-variant shrink-0">{card.icon}</div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-on-surface">{card.value.toLocaleString()}</div>
              <p className="text-xs text-outline truncate">{card.label} · {card.hint}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Invitations to other workspaces */}
      {incomingInvitations.length > 0 && (
        <div className="rounded-xl border-[0.5px] border-amber-500/40 bg-amber-500/5 overflow-hidden animate-fade-in">
          <div className="px-[15px] py-3 border-b-[0.5px] border-amber-500/30">
            <h2 className="text-[14px] font-semibold text-on-surface">Invitations for you</h2>
          </div>
          {incomingInvitations.map((inv) => (
            <div key={inv.id} className="px-[15px] py-3 flex flex-col sm:flex-row sm:items-center gap-3 border-b-[0.5px] border-amber-500/20 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-on-surface truncate">{inv.workspace_name || 'Workspace'}</div>
                <div className="text-[11px] text-outline truncate">
                  {[`${inv.role} invite from ${inv.inviter_email || 'an admin'}`, inv.expires_at ? `expires ${new Date(inv.expires_at).toLocaleDateString()}` : ''].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={processingToken === inv.token}
                  onClick={() => handleDeclineInvite(inv.token)}
                  className="h-[30px] px-3 rounded-md text-xs text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
                >
                  Decline
                </button>
                <button
                  type="button"
                  disabled={processingToken === inv.token}
                  onClick={() => handleAcceptInvite(inv.token)}
                  className="h-[30px] px-3 rounded-md bg-primary-container text-on-primary text-xs font-medium hover:bg-primary transition-colors cursor-pointer disabled:opacity-50"
                >
                  {processingToken === inv.token ? 'Joining…' : 'Accept'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Members / history / roles */}
      <div className="rounded-xl border-[0.5px] border-outline-variant overflow-hidden">
        <div className="px-[15px] py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b-[0.5px] border-outline-variant">
          <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs self-start" role="tablist" aria-label="Team sections">
            {([
              { id: 'members', label: 'Members', count: teamMembers.length || 1 },
              { id: 'history', label: 'Invite history' },
              { id: 'matrix', label: 'Roles' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeSubTab === tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`h-[26px] px-3 rounded-[4px] transition-colors cursor-pointer whitespace-nowrap ${
                  activeSubTab === tab.id ? 'bg-surface-container-lowest text-on-surface font-medium shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.label}{'count' in tab && <span className="text-outline"> {tab.count}</span>}
              </button>
            ))}
          </div>

          {activeSubTab === 'members' && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative flex-1 md:w-56 min-w-0">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
                <input
                  id="memberSearch"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search members"
                  aria-label="Search members"
                  className="w-full h-[30px] pl-9 pr-3 bg-surface-container-low rounded-full text-xs font-light text-on-surface border-[0.5px] border-outline-variant placeholder:text-outline outline-none focus:border-on-surface-variant"
                />
              </div>
              <select
                id="roleTabGroup"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filter by role"
                className="h-[30px] px-2 rounded-md text-xs border-[0.5px] border-outline-variant bg-surface-container-lowest text-on-surface outline-none cursor-pointer shrink-0"
              >
                <option value="all">All roles</option>
                <option value="admin">Admins</option>
                <option value="editor">Editors</option>
                <option value="viewer">Viewers</option>
              </select>
            </div>
          )}
          {activeSubTab === 'history' && loadingHistory && <RefreshCw className="w-4 h-4 animate-spin text-outline" />}
        </div>

        {activeSubTab === 'members' && (
          <>
            {/* Desktop table */}
            <table className="hidden md:table w-full text-left text-xs" id="teamTable">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant border-b-[0.5px] border-outline-variant">
                  <th className="py-2.5 px-[15px] font-medium">Member</th>
                  <th className="py-2.5 px-3 font-medium">Role</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-[15px] font-medium text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b-[0.5px] border-outline-variant last:border-b-0">
                  <td className="py-2.5 px-[15px]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {avatar(currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'U', true)}
                      <div className="min-w-0">
                        <div className="font-medium text-on-surface truncate">{currentUser?.name || 'You'} <span className="text-outline font-normal">(you)</span></div>
                        <div className="text-[11px] text-outline truncate">{currentUser?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">{renderRoleBadge(userRole)}</td>
                  <td className="py-2.5 px-3">{statusDot(false)}</td>
                  <td className="py-2.5 px-[15px]" />
                </tr>
                {otherMembers.map((m) => {
                  const isPending = m.status === 'invited' && m.role !== 'owner';
                  const inviteLink = m.invite_url || (m.token ? `${originUrl}/invite/${m.token}` : '');
                  return (
                    <tr key={m.id} className="border-b-[0.5px] border-outline-variant last:border-b-0 hover:bg-surface-container-low transition-colors">
                      <td className="py-2.5 px-[15px]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {avatar(m.avatar || m.name.slice(0, 2).toUpperCase())}
                          <div className="min-w-0">
                            <div className="font-medium text-on-surface truncate">{m.name}</div>
                            <div className="text-[11px] text-outline truncate">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">{memberRole(m, isPending)}</td>
                      <td className="py-2.5 px-3">{statusDot(isPending)}</td>
                      <td className="py-2.5 px-[15px]">
                        <div className="flex items-center justify-end gap-0.5">{memberActions(m, isPending, inviteLink)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile list */}
            <div className="md:hidden flex flex-col">
              <div className="p-[15px] flex items-center justify-between gap-2 border-b-[0.5px] border-outline-variant">
                <div className="flex items-center gap-2.5 min-w-0">
                  {avatar(currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'U', true)}
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-on-surface truncate">{currentUser?.name || 'You'} <span className="text-outline font-normal">(you)</span></div>
                    <div className="text-[11px] text-outline truncate">{currentUser?.email}</div>
                  </div>
                </div>
                {renderRoleBadge(userRole)}
              </div>
              {otherMembers.map((m) => {
                const isPending = m.status === 'invited' && m.role !== 'owner';
                const inviteLink = m.invite_url || (m.token ? `${originUrl}/invite/${m.token}` : '');
                return (
                  <div key={m.id} className="p-[15px] flex flex-col gap-2 border-b-[0.5px] border-outline-variant last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {avatar(m.avatar || m.name.slice(0, 2).toUpperCase())}
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-on-surface truncate">{m.name}</div>
                          <div className="text-[11px] text-outline truncate">{m.email}</div>
                        </div>
                      </div>
                      {statusDot(isPending)}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {memberRole(m, isPending)}
                      <div className="flex items-center gap-0.5">{memberActions(m, isPending, inviteLink)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {otherMembers.length === 0 && (
              <div className="py-8 px-6 text-center border-t-[0.5px] border-outline-variant">
                <p className="text-xs text-on-surface-variant">
                  {searchQuery || roleFilter !== 'all' ? 'No members match.' : 'It’s just you so far.'}
                </p>
                {!searchQuery && roleFilter === 'all' && isOwnerOrAdmin && (
                  <button type="button" onClick={() => setInviteModalOpen(true)} className="mt-3 h-[30px] px-3 rounded-md bg-primary-container text-on-primary text-xs font-medium hover:bg-primary transition-colors cursor-pointer">
                    Invite a teammate
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {activeSubTab === 'history' && (
          historyLogs.length === 0 ? (
            <p className="py-8 px-6 text-center text-xs text-on-surface-variant">{loadingHistory ? 'Loading…' : 'No invites sent yet.'}</p>
          ) : (
            <>
              <table className="hidden md:table w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant border-b-[0.5px] border-outline-variant">
                    <th className="py-2.5 px-[15px] font-medium">Invitee</th>
                    <th className="py-2.5 px-3 font-medium">Role</th>
                    <th className="py-2.5 px-3 font-medium">Status</th>
                    <th className="py-2.5 px-3 font-medium">Sent by</th>
                    <th className="py-2.5 px-3 font-medium">Sent</th>
                    <th className="py-2.5 px-[15px] font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map((log) => (
                    <tr key={log.id} className="border-b-[0.5px] border-outline-variant last:border-b-0">
                      <td className="py-2.5 px-[15px]">
                        <div className="font-medium text-on-surface">{log.name}</div>
                        <div className="text-[11px] text-outline">{log.email}</div>
                      </td>
                      <td className="py-2.5 px-3">{renderRoleBadge(log.role)}</td>
                      <td className="py-2.5 px-3">{historyStatus(log.status)}</td>
                      <td className="py-2.5 px-3 text-on-surface-variant">{log.inviter_email || '—'}</td>
                      <td className="py-2.5 px-3 text-on-surface-variant whitespace-nowrap">{new Date(log.created_at).toLocaleDateString()}</td>
                      <td className="py-2.5 px-[15px] text-on-surface-variant whitespace-nowrap">{log.expires_at ? new Date(log.expires_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="md:hidden flex flex-col">
                {historyLogs.map((log) => (
                  <div key={log.id} className="p-[15px] flex items-center justify-between gap-2 border-b-[0.5px] border-outline-variant last:border-b-0">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-on-surface truncate">{log.name}</div>
                      <div className="text-[11px] text-outline truncate">{log.role} · sent {new Date(log.created_at).toLocaleDateString()}</div>
                    </div>
                    {historyStatus(log.status)}
                  </div>
                ))}
              </div>
            </>
          )
        )}

        {activeSubTab === 'matrix' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[480px]">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant border-b-[0.5px] border-outline-variant">
                  <th className="py-2.5 px-[15px] font-medium">Can</th>
                  {(['owner', 'admin', 'editor', 'viewer'] as WorkspaceRole[]).map(r => (
                    <th key={r} className="py-2.5 px-3 font-medium text-center capitalize">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLE_ROWS.map(row => (
                  <tr key={row.perm} className="border-b-[0.5px] border-outline-variant last:border-b-0">
                    <td className="py-2.5 px-[15px] text-on-surface">{row.label}</td>
                    {(['owner', 'admin', 'editor', 'viewer'] as WorkspaceRole[]).map(r => (
                      <td key={r} className="py-2.5 px-3 text-center">
                        {hasPermission(r, row.perm)
                          ? <Check className="w-3.5 h-3.5 inline text-primary-ink" aria-label="Yes" />
                          : <span className="text-outline" aria-label="No">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#00000A73] backdrop-blur-[5px] animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setEditWsModalOpen(false); }}
        >
          <div className="bg-surface-container-lowest border-[0.5px] border-outline-variant rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-on-surface">Rename workspace</h3>
              <button 
                onClick={() => setEditWsModalOpen(false)}
                className="p-1 rounded-md text-on-surface-variant hover:text-on-surface"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkspace} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={editWsName}
                  onChange={(e) => setEditWsName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-[0.5px] border-outline-variant text-xs text-on-surface focus:outline-none focus:border-primary-strong"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">URL slug</label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-surface-container-high border-[0.5px] border-r-0 border-outline-variant rounded-l-lg text-xs font-mono text-on-surface-variant">
                    /
                  </span>
                  <input
                    type="text"
                    required
                    value={editWsSlug}
                    onChange={(e) => setEditWsSlug(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-r-lg bg-surface-container-low border-[0.5px] border-outline-variant text-xs font-mono text-on-surface focus:outline-none focus:border-primary-strong"
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
                  {savingWs ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#00000A73] backdrop-blur-[5px] animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirmOpen(false); }}
        >
          <div className="bg-surface-container-lowest border border-red-500/30 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <span className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-on-surface">Delete workspace?</h3>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              <strong className="text-on-surface">{currentWorkspace.name}</strong> and all its links, domains, campaigns and members will be deleted for good.
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
                {deletingWs ? 'Deleting…' : 'Delete workspace'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
