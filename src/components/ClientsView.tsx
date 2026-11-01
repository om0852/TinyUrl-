'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';
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
  Clock, 
  Lock, 
  Unlock, 
  Activity,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { CreateClientModal } from './CreateClientModal';
import { SkeletonClientsView } from '@/components/ui/Skeleton';

interface ClientsViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = () => {
  const { 
    clients, 
    clientMetrics, 
    refreshClients, 
    deleteClient, 
    updateClient, 
    links, 
    isClientsLoading,
    isInitialLoading
  } = useStore();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<ClientPortalAccount | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [copiedClientId, setCopiedClientId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setMounted(true);
    refreshClients();
  }, [refreshClients]);

  // Delete Confirm Modal
  const [clientToDelete, setClientToDelete] = useState<ClientPortalAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const originDomain = typeof window !== 'undefined' ? window.location.host : 'tinyurl.dev';

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

  if (!mounted || ((isInitialLoading || isClientsLoading) && clients.length === 0)) {
    return (
      <div className="flex flex-col w-full space-y-6 pb-16 animate-fade-in text-on-surface">
        <SkeletonClientsView />
      </div>
    );
  }

  const openCreate = () => {
    setClientToEdit(null);
    setCreateModalOpen(true);
  };
  const activeClientsCount = clients.filter(c => c.status === 'active').length;
  // Most common custom domain among clients; clients without one use the main domain
  const topDomain = (() => {
    const counts = new Map<string, number>();
    clients.forEach(c => { if (c.custom_domain) counts.set(c.custom_domain, (counts.get(c.custom_domain) || 0) + 1); });
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : null;
  })();
  const iconBtn = 'size-[30px] rounded-md grid place-items-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer';
  const clientAccess = (client: ClientPortalAccount) => {
    const directLinkIds = client.assigned_link_ids || [];
    const assignedCampIds = client.assigned_campaign_ids || [];
    const campaignLinkIds = links.filter(l => l.campaign_id && assignedCampIds.includes(l.campaign_id)).map(l => l.id);
    const linksCount = new Set([...directLinkIds, ...campaignLinkIds]).size;
    const parts = [`${linksCount} ${linksCount === 1 ? 'link' : 'links'}`];
    if (assignedCampIds.length) parts.push(`${assignedCampIds.length} ${assignedCampIds.length === 1 ? 'campaign' : 'campaigns'}`);
    const perms = [
      client.can_view_analytics ? 'Analytics' : '',
      client.can_edit_destination_url ? 'Edit URLs' : 'Read-only',
      client.can_create_links ? `Create (max ${client.max_links_quota})` : '',
    ].filter(Boolean);
    return { summary: parts.join(' · '), perms };
  };
  const initialsFor = (client: ClientPortalAccount) => (client.company_name
    ? client.company_name.split(' ').map(w => w[0]).join('').slice(0, 2)
    : client.name.slice(0, 2)).toUpperCase();
  const lastActive = (client: ClientPortalAccount) => client.last_login_at
    ? new Date(client.last_login_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Never';
  const clientActions = (client: ClientPortalAccount) => (
    <>
      <button type="button" onClick={() => handleCopyPortalLink(client)} title="Copy portal login link" aria-label="Copy portal login link" className={iconBtn}>
        {copiedClientId === client.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <a href={`/api/v1/portal/preview?client_id=${encodeURIComponent(client.id)}`} target="_blank" rel="noreferrer" title="Preview portal" aria-label="Preview portal" className={iconBtn}>
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
      <button type="button" onClick={() => { setClientToEdit(client); setCreateModalOpen(true); }} title="Edit client" aria-label="Edit client" className={iconBtn}>
        <Edit2 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => handleToggleStatus(client)}
        title={client.status === 'active' ? 'Suspend access' : 'Restore access'}
        aria-label={client.status === 'active' ? 'Suspend access' : 'Restore access'}
        className={iconBtn}
      >
        {client.status === 'active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
      </button>
      <button type="button" onClick={() => setClientToDelete(client)} title="Delete client" aria-label="Delete client" className={`${iconBtn} hover:!text-error hover:!bg-error-container`}>
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </>
  );
  const statusPill = (client: ClientPortalAccount) => (
    <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full ${client.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {client.status === 'active' ? 'Active' : 'Suspended'}
    </span>
  );

  return (
    <div className="flex flex-col w-full gap-[15px] pb-16 animate-fade-in text-on-surface">

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0 max-w-xl">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
            <input
              type="text"
              placeholder="Search clients"
              aria-label="Search clients"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[34px] pl-9 pr-3 bg-surface-container-low rounded-full text-xs font-light text-on-surface border-[0.5px] border-outline-variant placeholder:text-outline outline-none focus:border-on-surface-variant"
            />
          </div>
          <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs shrink-0" role="tablist" aria-label="Filter by status">
            {(['all', 'active', 'suspended'] as const).map((st) => (
              <button
                key={st}
                type="button"
                role="tab"
                aria-selected={statusFilter === st}
                onClick={() => setStatusFilter(st)}
                className={`h-[26px] px-2.5 rounded-[4px] capitalize transition-colors cursor-pointer ${
                  statusFilter === st ? 'bg-surface-container-lowest text-on-surface font-medium shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Refresh"
            aria-label="Refresh"
            className="size-[34px] rounded-md border-[0.5px] border-outline-variant grid place-items-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            id="add-client-btn"
            onClick={openCreate}
            className="h-[34px] px-4 rounded-md bg-primary-container text-on-primary text-xs font-medium hover:bg-primary transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add client</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-[15px]">
        {[
          { icon: <Users className="w-5 h-5" />, value: clientMetrics.total_clients.toLocaleString(), label: 'Clients', hint: `${activeClientsCount} active` },
          { icon: <Activity className="w-5 h-5" />, value: clientMetrics.active_this_month.toLocaleString(), label: 'Active this month', hint: 'Logged in' },
          { icon: <Clock className="w-5 h-5" />, value: clientMetrics.total_logins.toLocaleString(), label: 'Logins', hint: 'All time' },
          { icon: <Globe2 className="w-5 h-5" />, value: topDomain || '—', label: 'Top domain', hint: topDomain ? 'Most client portals' : 'Clients use your main domain' },
        ].map(card => (
          <div key={card.label} className="flex items-center gap-[10px] rounded-xl border-[0.5px] border-outline-variant p-[15px] min-w-0">
            <div className="grid size-[40px] place-items-center rounded-md bg-surface-container text-on-surface-variant shrink-0">{card.icon}</div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-on-surface truncate" title={card.value}>{card.value}</div>
              <p className="text-xs text-outline truncate">{card.label} · {card.hint}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Clients */}
      <div className="rounded-xl border-[0.5px] border-outline-variant overflow-hidden">
        <div className="px-[15px] py-3 flex items-center justify-between border-b-[0.5px] border-outline-variant">
          <h2 className="text-[14px] font-semibold text-on-surface">Clients</h2>
          <span className="text-xs text-outline">{filteredClients.length} of {clients.length}</span>
        </div>

        {filteredClients.length === 0 ? (
          <div className="py-12 px-6 flex flex-col items-center text-center">
            <div className="grid size-[40px] place-items-center rounded-full bg-primary-fixed text-on-secondary-container">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="mt-3 text-[14px] font-semibold text-on-surface">
              {clients.length === 0 ? 'No clients yet' : 'No matching clients'}
            </h3>
            <p className="mt-1 text-xs text-on-surface-variant max-w-xs">
              {clients.length === 0 ? 'Give a client their own login to see the links and stats you share with them.' : 'Try another search or filter.'}
            </p>
            {clients.length === 0 && (
              <button type="button" onClick={openCreate} className="mt-4 h-[34px] px-4 rounded-md bg-primary-container text-on-primary text-xs font-medium hover:bg-primary transition-colors cursor-pointer">
                Add client
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden md:table w-full text-left text-xs">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant border-b-[0.5px] border-outline-variant">
                  <th className="py-2.5 px-[15px] font-medium">Client</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium">Access</th>
                  <th className="py-2.5 px-3 font-medium text-right">Logins</th>
                  <th className="py-2.5 px-3 font-medium">Last active</th>
                  <th className="py-2.5 px-[15px] font-medium text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const access = clientAccess(client);
                  return (
                    <tr key={client.id} className="border-b-[0.5px] border-outline-variant last:border-b-0 hover:bg-surface-container-low transition-colors">
                      <td className="py-2.5 px-[15px] max-w-[260px]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-[32px] rounded-md text-white grid place-items-center font-semibold text-[11px] shrink-0" style={{ backgroundColor: client.brand_color || '#65a30d' }}>
                            {initialsFor(client)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-on-surface truncate">{client.company_name}</div>
                            <div className="text-[11px] text-outline truncate">{client.name} · {client.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">{statusPill(client)}</td>
                      <td className="py-2.5 px-3">
                        <div className="text-on-surface whitespace-nowrap">{access.summary}</div>
                        <div className="text-[11px] text-outline whitespace-nowrap">{access.perms.join(' · ')}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-on-surface">{(client.total_logins || 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-on-surface-variant whitespace-nowrap">{lastActive(client)}</td>
                      <td className="py-2.5 px-[15px]">
                        <div className="flex items-center justify-end gap-0.5">{clientActions(client)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden flex flex-col">
              {filteredClients.map((client) => {
                const access = clientAccess(client);
                return (
                  <div key={client.id} className="p-[15px] flex flex-col gap-2 border-b-[0.5px] border-outline-variant last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-[32px] rounded-md text-white grid place-items-center font-semibold text-[11px] shrink-0" style={{ backgroundColor: client.brand_color || '#65a30d' }}>
                          {initialsFor(client)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-on-surface truncate">{client.company_name}</div>
                          <div className="text-[11px] text-outline truncate">{client.email}</div>
                        </div>
                      </div>
                      {statusPill(client)}
                    </div>
                    <div className="text-[11px] text-on-surface-variant">
                      {access.summary} · {access.perms.join(' · ')} · {(client.total_logins || 0).toLocaleString()} logins · {lastActive(client)}
                    </div>
                    <div className="flex items-center gap-0.5 -ml-1.5">{clientActions(client)}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
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
          className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setClientToDelete(null);
          }}
        >
          <div className="bg-surface-container-lowest rounded-xl max-w-md w-full p-6 shadow-2xl border-[0.5px] border-outline-variant text-on-surface">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Delete client?</h3>
                <p className="text-xs text-on-surface-variant">
                  {clientToDelete.company_name} ({clientToDelete.email})
                </p>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed mb-6">
              They lose access to their portal right away. Their links keep working.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant">
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
                <span>{isDeleting ? 'Deleting…' : 'Delete client'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
