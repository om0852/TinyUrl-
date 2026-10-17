'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';
import { InfoTooltip } from '@/components/ui';
import { ClientPortalAccount } from '@/lib/types';
import { 
  Building2, 
  Users, 
  UserPlus, 
  ExternalLink, 
  Copy, 
  Check, 
  Trash2, 
  Edit2, 
  Search, 
  Globe2, 
  ShieldCheck, 
  Link2, 
  Sparkles, 
  Clock, 
  Lock, 
  Unlock, 
  MoreVertical,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Target
} from 'lucide-react';
import { CreateClientModal } from './CreateClientModal';

interface ClientsViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({ onNavigateTab }) => {
  const { clients, clientMetrics, refreshClients, deleteClient, updateClient, links, campaigns, refreshData } = useStore();
  const { showToast } = useToast();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<ClientPortalAccount | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [copiedClientId, setCopiedClientId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    refreshClients();
    refreshData();
  }, [refreshClients, refreshData]);

  // Delete Confirm Modal
  const [clientToDelete, setClientToDelete] = useState<ClientPortalAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const originDomain = typeof window !== 'undefined' ? window.location.host : 'snip.to';

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshClients();
      showToast('success', 'Client accounts synchronized.');
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const handleCopyPortalLink = (client: ClientPortalAccount) => {
    const portalDomain = client.custom_domain || originDomain;
    const portalUrl = `https://${portalDomain}/portal/login?email=${encodeURIComponent(client.email)}`;
    navigator.clipboard.writeText(portalUrl).catch(() => {});
    setCopiedClientId(client.id);
    showToast('success', 'Client portal login URL copied to clipboard!');
    setTimeout(() => setCopiedClientId(null), 2000);
  };

  const handleToggleStatus = async (client: ClientPortalAccount) => {
    const newStatus = client.status === 'active' ? 'suspended' : 'active';
    const res = await updateClient(client.id, { status: newStatus });
    if (res.success) {
      showToast('success', `Client account marked as ${newStatus}.`);
    } else {
      showToast('error', res.error || 'Failed to update client status.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!clientToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteClient(clientToDelete.id);
      if (res.success) {
        showToast('success', `Client portal for "${clientToDelete.company_name}" revoked.`);
        setClientToDelete(null);
      } else {
        showToast('error', res.error || 'Failed to delete client account.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter clients by search query & status
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        c.name.toLowerCase().includes(q) || 
        c.company_name.toLowerCase().includes(q) || 
        c.email.toLowerCase().includes(q) ||
        (c.custom_domain && c.custom_domain.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [clients, searchQuery, statusFilter]);

  return (
    <div className="flex flex-col w-full space-y-6 pb-16 animate-fade-in text-on-surface">
      
      {/* 1. HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col max-w-2xl">
          <div className="flex items-center gap-2 text-on-surface-variant font-mono text-xs uppercase tracking-wider mb-1">
            <span>WORKSPACE</span>
            <span>/</span>
            <span className="text-primary-container font-semibold">CLIENT PORTALS</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
              Clients
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              <ShieldCheck className="w-3.5 h-3.5" /> Agency White-Label
            </span>
          </div>
          <p className="text-sm sm:text-base text-on-surface-variant mt-1 leading-relaxed">
            Create isolated, white-labeled client accounts. Clients can log in, view live analytics, and self-serve update their assigned short links without accessing your internal workspace.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 bg-surface-container-lowest text-on-surface text-xs font-semibold px-3 py-2 rounded-lg shadow-xs border border-outline-variant/40 hover:bg-surface-container-low transition cursor-pointer disabled:opacity-60"
            title="Synchronize client accounts"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary-container ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing…' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            id="add-client-btn"
            onClick={() => {
              setClientToEdit(null);
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-primary-container text-on-primary text-xs font-bold px-4 py-2 rounded-lg shadow-xs hover:bg-primary transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Client</span>
          </button>
        </div>
      </div>

      {/* 2. TOP ROW: 4 KPI SUMMARY CARDS (Matching Linko) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Total Clients */}
        <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-on-surface-variant font-semibold">Total Clients</span>
              <InfoTooltip text="Total number of client portal accounts created across this agency workspace." />
            </div>
            <div className="p-2 rounded-lg bg-surface-container-low text-primary-container flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold font-mono text-on-surface tracking-tight">
              {clientMetrics.total_clients}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700">
                <ShieldCheck className="w-3 h-3" /> Sandboxed
              </span>
              <span className="text-xs text-on-surface-variant font-medium">
                {clients.filter(c => c.status === 'active').length} active
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Active This Month */}
        <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-on-surface-variant font-semibold">Active This Month</span>
              <InfoTooltip text="Number of clients who have logged in or had active sessions in the current calendar month." />
            </div>
            <div className="p-2 rounded-lg bg-surface-container-low text-emerald-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold font-mono text-on-surface tracking-tight">
              {clientMetrics.active_this_month}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700">
                Live Engagement
              </span>
              <span className="text-xs text-on-surface-variant font-medium">
                {clientMetrics.total_clients > 0 ? `${Math.round((clientMetrics.active_this_month / clientMetrics.total_clients) * 100)}% retention` : '0%'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Total Logins */}
        <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-on-surface-variant font-semibold">Total Logins</span>
              <InfoTooltip text="Cumulative login count across all client accounts. Helps agencies measure if clients actually use their portals." />
            </div>
            <div className="p-2 rounded-lg bg-surface-container-low text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold font-mono text-on-surface tracking-tight">
              {clientMetrics.total_logins.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700">
                Client Sessions
              </span>
              <span className="text-xs text-on-surface-variant font-medium">
                Portal engagement
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Most Used Domain */}
        <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-on-surface-variant font-semibold">Most Used Domain</span>
              <InfoTooltip text="Which custom branded domain is hosting the most client portals." />
            </div>
            <div className="p-2 rounded-lg bg-surface-container-low text-purple-600 flex items-center justify-center">
              <Globe2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg font-extrabold font-mono text-on-surface tracking-tight truncate" title={clientMetrics.most_used_domain}>
              {clientMetrics.most_used_domain}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700">
                White-Label CNAME
              </span>
              <span className="text-xs text-on-surface-variant font-medium">
                SSL Active
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. FILTERING & QUOTA BAR */}
      <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="text"
              placeholder="Search clients by name, company, email, or domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low rounded-lg text-xs text-on-surface border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>

          {/* Status Filter */}
          <div className="inline-flex rounded-lg bg-surface-container-low p-0.5 text-xs font-medium border border-outline-variant/30 shrink-0">
            {(['all', 'active', 'suspended'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer capitalize ${
                  statusFilter === st
                    ? 'bg-surface-container-lowest text-primary-container font-bold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Quota Counter (0 / Unlimited) */}
        <div className="flex items-center gap-2 text-xs text-on-surface-variant font-medium self-start sm:self-auto shrink-0">
          <span>Client Quota:</span>
          <span className="inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded bg-surface-container-high text-primary-container">
            {clientMetrics.total_clients} / Unlimited
          </span>
          <InfoTooltip text="Agency subscription includes unlimited client portals with custom branding." />
        </div>
      </div>

      {/* 4. CLIENT ACCOUNTS TABLE */}
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/40">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-on-surface tracking-tight">
              Client Portal Accounts
            </h3>
            <p className="text-xs text-on-surface-variant">
              Manage client portal credentials, assigned link scopings, and white-label access links
            </p>
          </div>
          <span className="text-xs font-mono text-on-surface-variant">
            {filteredClients.length} of {clients.length} clients
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                <th className="py-3 px-4 rounded-l-lg">Client &amp; Brand</th>
                <th className="py-3 px-4">Assigned Resources</th>
                <th className="py-3 px-4">Permissions</th>
                <th className="py-3 px-4 text-center">Logins</th>
                <th className="py-3 px-4">Last Active</th>
                <th className="py-3 px-4">Portal Login URL</th>
                <th className="py-3 px-4 text-right rounded-r-lg">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-outline-variant/20">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-xl bg-surface-container-low text-primary-container flex items-center justify-center mb-3">
                        <Building2 className="w-6 h-6 text-outline" />
                      </div>
                      <h4 className="text-sm font-bold text-on-surface">No Client Accounts Yet</h4>
                      <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                        Create your first white-label client account to start securely sharing short links, campaigns, and live analytics.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setClientToEdit(null);
                          setCreateModalOpen(true);
                        }}
                        className="mt-4 px-4 py-2 rounded-lg bg-primary-container text-on-primary text-xs font-bold hover:bg-primary transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Create Client Account</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const directLinkIds = client.assigned_link_ids || [];
                  const assignedCampIds = client.assigned_campaign_ids || [];
                  const campaignAssociatedLinks = links.filter(l => 
                    l.campaign_id && assignedCampIds.includes(l.campaign_id)
                  );
                  const allResolvedLinkIds = Array.from(new Set([...directLinkIds, ...campaignAssociatedLinks.map(l => l.id)]));
                  const assignedLinksCount = Math.max(directLinkIds.length, allResolvedLinkIds.length);
                  const assignedCampaignsCount = assignedCampIds.length;
                  const isCopied = copiedClientId === client.id;
                  const portalDomain = client.custom_domain || originDomain;
                  const portalUrl = `https://${portalDomain}/portal/login?email=${encodeURIComponent(client.email)}`;

                  const avatarInitials = client.company_name
                    ? client.company_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                    : client.name.slice(0, 2).toUpperCase();

                  return (
                    <tr key={client.id} className="hover:bg-surface-container-low/50 transition-colors">
                      {/* Client & Brand */}
                      <td className="py-3 px-4 max-w-[220px]">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs"
                            style={{ backgroundColor: client.brand_color || '#4f46e5' }}
                          >
                            {avatarInitials}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-on-surface truncate">{client.company_name}</span>
                            <span className="text-[11px] text-on-surface-variant truncate">{client.name} &bull; {client.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Assigned Resources */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-container/10 text-primary-container font-mono">
                            <Link2 className="w-3 h-3" />
                            {assignedLinksCount} link{assignedLinksCount === 1 ? '' : 's'}
                          </span>
                          {assignedCampaignsCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 font-mono">
                              <Target className="w-3 h-3" />
                              {assignedCampaignsCount} campaign{assignedCampaignsCount === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Permissions */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {client.can_view_analytics && (
                            <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-surface-container text-on-surface">
                              Analytics
                            </span>
                          )}
                          {client.can_edit_destination_url ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Edit URLs
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-surface-container-high text-on-surface-variant">
                              Read-Only
                            </span>
                          )}
                          {client.can_create_links && (
                            <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-blue-50 text-blue-700">
                              Create ({client.max_links_quota} max)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Logins */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-xs text-on-surface whitespace-nowrap">
                        {(client.total_logins || 0).toLocaleString()}
                      </td>

                      {/* Last Active */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-on-surface-variant font-mono">
                        {client.last_login_at 
                          ? new Date(client.last_login_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'Never'}
                      </td>

                      {/* Portal Login URL */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 font-mono text-xs text-primary-container font-semibold">
                          <span className="truncate max-w-[160px]" title={portalUrl}>
                            {portalDomain}/portal
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyPortalLink(client)}
                            className="p-1 hover:bg-surface-container rounded transition cursor-pointer text-outline hover:text-on-surface"
                            title="Copy Client Login URL"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={`/portal/dashboard?client_id=${client.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 hover:bg-surface-container rounded transition cursor-pointer text-outline hover:text-primary-container"
                            title="Impersonate &amp; preview client portal"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setClientToEdit(client);
                              setCreateModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface transition cursor-pointer"
                            title="Edit client configuration &amp; scoping"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(client)}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              client.status === 'active' 
                                ? 'hover:bg-amber-50 text-outline hover:text-amber-700' 
                                : 'hover:bg-emerald-50 text-amber-600 hover:text-emerald-700'
                            }`}
                            title={client.status === 'active' ? 'Suspend client portal' : 'Activate client portal'}
                          >
                            {client.status === 'active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => setClientToDelete(client)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-outline hover:text-rose-700 transition cursor-pointer"
                            title="Revoke client account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create or Edit Client */}
      <CreateClientModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        clientToEdit={clientToEdit}
      />

      {/* Delete Confirmation Modal */}
      {clientToDelete && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setClientToDelete(null);
          }}
        >
          <div className="bg-surface-container-lowest rounded-xl max-w-md w-full p-6 shadow-2xl border border-outline-variant/40 text-on-surface">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Revoke Client Portal Account</h3>
                <p className="text-xs text-on-surface-variant">
                  {clientToDelete.company_name} ({clientToDelete.email})
                </p>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed mb-6">
              Are you sure you want to delete this client portal account? The client will immediately lose access to their dashboard. Their assigned short links will remain active in your agency workspace.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/20">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'Deleting…' : 'Confirm Revoke'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
