'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';
import { hasPermission } from '@/lib/rbac';
import { Domain } from '@/lib/types';
import {
  Check,
  Copy,
  Globe2,
  Link2,
  Users,
  RefreshCw,
  Trash2,
  Edit3,
  Star,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { SkeletonSettingsView } from '@/components/ui/Skeleton';

interface SettingsViewProps {
  onNavigateTab?: (tab: string) => void;
}

type SettingsTab = 'general' | 'domains';

const EDGE_PROXY_IP = process.env.NEXT_PUBLIC_EDGE_PROXY_IP || '159.54.139.45';
const CNAME_TARGET = process.env.NEXT_PUBLIC_CNAME_TARGET || 'creataurus.work.gd';

const slugify = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const SettingsView: React.FC<SettingsViewProps> = () => {
  const {
    currentWorkspace,
    currentUserRole,
    domains,
    links,
    teamMembers,
    addDomain,
    verifyDomain,
    updateDomainConfig,
    deleteDomain,
    updateWorkspace,
    checkPermissionOrToast,
    refreshSettings,
    isInitialLoading,
    currentUser
  } = useStore();
  const { showToast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<SettingsTab>('general');
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  useEffect(() => {
    setMounted(true);
    refreshSettings();
  }, [refreshSettings]);

  const canEditWorkspace = hasPermission(currentUserRole, 'settings:manage');
  const canManageDomains = hasPermission(currentUserRole, 'domains:manage');

  // ── General ──
  const [name, setName] = useState(currentWorkspace?.name || '');
  const [slug, setSlug] = useState(currentWorkspace?.slug || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setName(currentWorkspace?.name || '');
    setSlug(currentWorkspace?.slug || '');
  }, [currentWorkspace?.id, currentWorkspace?.name, currentWorkspace?.slug]);
  const dirty = name.trim() !== (currentWorkspace?.name || '') || slugify(slug) !== (currentWorkspace?.slug || '');

  const saveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || !name.trim() || saving) return;
    if (!checkPermissionOrToast('settings:manage', 'change workspace settings')) return;
    setSaving(true);
    const ok = await updateWorkspace(currentWorkspace.id, name.trim(), slugify(slug) || slugify(name));
    setSaving(false);
    if (ok) showToast('success', 'Workspace saved');
  };

  // ── Domains ──
  const [newHost, setNewHost] = useState('');
  const [newRedirect, setNewRedirect] = useState('');
  const [adding, setAdding] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [openDnsId, setOpenDnsId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Domain | null>(null);
  const [editRedirect, setEditRedirect] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);
  const [toDelete, setToDelete] = useState<Domain | null>(null);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHost.trim() || adding) return;
    if (!checkPermissionOrToast('domains:manage', 'add custom domains')) return;
    setAdding(true);
    const host = newHost.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const created = await addDomain(host, false, newRedirect.trim() || undefined);
    setAdding(false);
    if (created) {
      setNewHost('');
      setNewRedirect('');
      setOpenDnsId(created.id);
      showToast('success', `${host} added`, 'Add the DNS records below, then check DNS.');
    }
  };

  const handleCheckDns = async (d: Domain) => {
    setCheckingId(d.id);
    try {
      const res = await verifyDomain(d.id);
      showToast(res.verified ? 'success' : 'error', res.verified ? `${d.hostname} is verified` : `${d.hostname} not verified yet`, res.message);
      if (res.verified) setOpenDnsId(prev => (prev === d.id ? null : prev));
    } finally {
      setCheckingId(null);
    }
  };

  const saveRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || savingDomain) return;
    setSavingDomain(true);
    // An empty value clears the redirect
    const ok = await updateDomainConfig(editing.id, { root_redirect_url: editRedirect.trim() });
    setSavingDomain(false);
    if (ok) {
      showToast('success', 'Domain updated', editing.hostname);
      setEditing(null);
    }
  };

  if (!mounted || (isInitialLoading && !currentUser)) {
    return <SkeletonSettingsView />;
  }

  const iconBtn = 'size-[30px] rounded-md grid place-items-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50';
  const input = 'h-[34px] px-3 bg-surface-container-low rounded-md text-xs text-on-surface border-[0.5px] border-outline-variant outline-none focus:border-on-surface-variant disabled:opacity-60';
  const primaryBtn = 'h-[34px] px-4 rounded-md bg-primary-container text-on-primary text-xs font-medium hover:bg-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  const verifiedCount = domains.filter(d => d.verified).length;

  const statusOf = (d: Domain): [string, string] => {
    if (d.verified) return ['bg-emerald-500', 'Verified'];
    if (d.routing_verified && !d.ownership_verified) return ['bg-amber-500', 'Needs TXT record'];
    if (d.ownership_verified && !d.routing_verified) return ['bg-amber-500', 'Needs A or CNAME record'];
    return ['bg-amber-500', 'Waiting for DNS'];
  };

  const dnsRow = (type: string, host: string, value: string, key: string, done?: boolean) => (
    <tr key={key} className="border-b-[0.5px] border-outline-variant last:border-b-0">
      <td className="py-2 px-3 font-mono">{type}</td>
      <td className="py-2 px-3 font-mono break-all">{host}</td>
      <td className="py-2 px-3 font-mono break-all">{value}</td>
      <td className="py-2 px-3 text-right whitespace-nowrap">
        {done && <Check className="w-3.5 h-3.5 inline text-emerald-600 mr-1" aria-label="Found" />}
        <button type="button" onClick={() => copy(value, key)} aria-label={`Copy ${type} value`} className="p-1 text-on-surface-variant hover:text-on-surface cursor-pointer">
          {copied === key ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </td>
    </tr>
  );

  return (
    <div className="flex flex-col w-full gap-[15px] pb-16 animate-fade-in text-on-surface">

      <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs self-start" role="tablist" aria-label="Settings sections">
        {([['general', 'General'], ['domains', `Domains`]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`h-[26px] px-3 rounded-[4px] transition-colors cursor-pointer ${tab === id ? 'bg-surface-container-lowest text-on-surface font-medium shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            {label}{id === 'domains' && <span className="text-outline"> {domains.length}</span>}
          </button>
        ))}
      </div>

      {/* ── General ── */}
      {tab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[15px] items-start">
          <form onSubmit={saveGeneral} className="lg:col-span-7 rounded-xl border-[0.5px] border-outline-variant p-[15px] flex flex-col gap-3">
            <h2 className="text-[14px] font-semibold text-on-surface">Workspace</h2>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-on-surface-variant">Name</span>
              <input type="text" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} disabled={!canEditWorkspace} className={input} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-on-surface-variant">URL slug</span>
              <input type="text" maxLength={48} value={slug} onChange={(e) => setSlug(e.target.value)} onBlur={() => setSlug(s => slugify(s))} disabled={!canEditWorkspace} className={`${input} font-mono`} />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-on-surface-variant">Workspace ID</span>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 h-[34px] px-3 flex items-center rounded-md bg-surface-container-low border-[0.5px] border-outline-variant text-xs font-mono text-on-surface-variant truncate">{currentWorkspace?.id}</code>
                <button type="button" onClick={() => copy(currentWorkspace?.id || '', 'wsid')} title="Copy workspace ID" aria-label="Copy workspace ID" className={iconBtn}>
                  {copied === 'wsid' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-[11px] text-outline">Used as <code>workspace_id</code> in API calls.</span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-outline">{canEditWorkspace ? '' : 'Only the owner can change these.'}</span>
              {canEditWorkspace && <button type="submit" disabled={!dirty || saving || !name.trim()} className={primaryBtn}>{saving ? 'Saving…' : 'Save'}</button>}
            </div>
          </form>

          <div className="lg:col-span-5 rounded-xl border-[0.5px] border-outline-variant p-[15px]">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-on-surface">Usage</h2>
              <span className="text-[11px] px-2 py-[1px] rounded-full bg-surface-container text-on-surface-variant capitalize">{currentWorkspace?.plan || 'free'} plan</span>
            </div>
            <div className="mt-2 flex flex-col">
              {[
                { icon: <Link2 className="w-4 h-4" />, label: 'Links', value: links.length },
                { icon: <Globe2 className="w-4 h-4" />, label: 'Custom domains', value: domains.length, hint: `${verifiedCount} verified` },
                { icon: <Users className="w-4 h-4" />, label: 'Members', value: Math.max(1, teamMembers.filter(m => m.status === 'active').length) },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-[10px] py-2.5 border-b-[0.5px] border-outline-variant last:border-b-0">
                  <div className="grid size-[32px] place-items-center rounded-md bg-surface-container text-on-surface-variant shrink-0">{row.icon}</div>
                  <span className="flex-1 text-xs text-on-surface">{row.label}{row.hint && <span className="text-outline"> · {row.hint}</span>}</span>
                  <span className="text-xs font-semibold tabular-nums text-on-surface">{row.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Domains ── */}
      {tab === 'domains' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[15px] items-start">
          {canManageDomains && (
            <form onSubmit={handleAddDomain} className="lg:col-span-4 rounded-xl border-[0.5px] border-outline-variant p-[15px] flex flex-col gap-3">
              <h2 className="text-[14px] font-semibold text-on-surface">Add domain</h2>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-on-surface-variant">Domain</span>
                <input type="text" required value={newHost} onChange={(e) => setNewHost(e.target.value)} placeholder="go.yourbrand.com" className={`${input} font-mono`} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-on-surface-variant">Root redirect <span className="text-outline">(optional)</span></span>
                <input type="url" value={newRedirect} onChange={(e) => setNewRedirect(e.target.value)} placeholder="https://yourbrand.com" className={input} />
                <span className="text-[11px] text-outline">Where the bare domain goes, without a slug.</span>
              </label>
              <button type="submit" disabled={adding} className={primaryBtn}>{adding ? 'Adding…' : 'Add domain'}</button>
            </form>
          )}

          <div className={`${canManageDomains ? 'lg:col-span-8' : 'lg:col-span-12'} rounded-xl border-[0.5px] border-outline-variant overflow-hidden`}>
            <div className="px-[15px] py-3 border-b-[0.5px] border-outline-variant flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-on-surface">Domains</h2>
              <span className="text-xs text-outline">{verifiedCount} of {domains.length} verified</span>
            </div>
            {domains.length === 0 ? (
              <p className="py-10 px-6 text-center text-xs text-on-surface-variant">No custom domains yet. Links use the main domain until you add one.</p>
            ) : (
              <div className="flex flex-col">
                {domains.map(d => {
                  const [dot, label] = statusOf(d);
                  const dnsOpen = openDnsId === d.id;
                  const isApex = d.hostname.split('.').length <= 2;
                  return (
                    <div key={d.id} className="border-b-[0.5px] border-outline-variant last:border-b-0">
                      <div className="px-[15px] py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-medium text-on-surface font-mono truncate">{d.hostname}</span>
                            {d.is_default && <span className="text-[10px] px-1.5 py-[1px] rounded-full bg-primary-fixed text-on-secondary-container">Default</span>}
                          </div>
                          <div className="text-[11px] text-outline truncate flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                            <span>{label}</span>
                            {d.root_redirect_url && <span className="truncate">· root → {d.root_redirect_url}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {!d.verified && (
                            <button type="button" onClick={() => setOpenDnsId(dnsOpen ? null : d.id)} aria-expanded={dnsOpen} className="h-[30px] px-2.5 rounded-md text-xs text-primary-ink hover:bg-surface-container inline-flex items-center gap-0.5 cursor-pointer">
                              DNS records {dnsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {canManageDomains && (
                            <>
                              <button type="button" onClick={() => handleCheckDns(d)} disabled={checkingId === d.id} title="Check DNS" aria-label="Check DNS" className={iconBtn}>
                                <RefreshCw className={`w-3.5 h-3.5 ${checkingId === d.id ? 'animate-spin' : ''}`} />
                              </button>
                              {!d.is_default && d.verified && (
                                <button type="button" onClick={async () => { if (await updateDomainConfig(d.id, { is_primary: true })) showToast('success', `${d.hostname} is now the default`); }} title="Make default" aria-label="Make default" className={iconBtn}>
                                  <Star className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button type="button" onClick={() => { setEditing(d); setEditRedirect(d.root_redirect_url || ''); }} title="Edit root redirect" aria-label="Edit root redirect" className={iconBtn}>
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => setToDelete(d)} title="Remove domain" aria-label="Remove domain" className={`${iconBtn} hover:!text-error hover:!bg-error-container`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {dnsOpen && !d.verified && (
                        <div className="px-[15px] pb-3 animate-fade-in">
                          <p className="text-[11px] text-on-surface-variant mb-2">
                            Add these at your DNS provider, then press Check DNS. Use the {isApex ? 'A' : 'CNAME'} record for {isApex ? 'a root domain' : 'a subdomain'}, plus the TXT record.
                          </p>
                          <div className="overflow-x-auto rounded-md border-[0.5px] border-outline-variant">
                            <table className="w-full text-left text-[11px] min-w-[460px]">
                              <thead>
                                <tr className="bg-surface-container-low text-on-surface-variant border-b-[0.5px] border-outline-variant">
                                  <th className="py-1.5 px-3 font-medium">Type</th>
                                  <th className="py-1.5 px-3 font-medium">Name</th>
                                  <th className="py-1.5 px-3 font-medium">Value</th>
                                  <th className="py-1.5 px-3" />
                                </tr>
                              </thead>
                              <tbody>
                                {isApex
                                  ? dnsRow('A', '@', EDGE_PROXY_IP, `a_${d.id}`, d.routing_verified)
                                  : dnsRow('CNAME', d.hostname.split('.')[0], CNAME_TARGET, `c_${d.id}`, d.routing_verified)}
                                {d.verify_token && dnsRow('TXT', `_tinyurl-challenge.${d.hostname}`, d.verify_token, `t_${d.id}`, d.ownership_verified)}
                              </tbody>
                            </table>
                          </div>
                          <p className="mt-1.5 text-[11px] text-outline">DNS changes can take a few minutes to an hour to show up.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit root redirect */}
      {editing && createPortal(
        <div className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-4 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <form onSubmit={saveRedirect} className="bg-surface-container-lowest rounded-xl max-w-md w-full p-6 shadow-2xl border-[0.5px] border-outline-variant flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-on-surface font-mono">{editing.hostname}</h3>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close" className={iconBtn}><X className="w-4 h-4" /></button>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-on-surface-variant">Root redirect</span>
              <input type="url" value={editRedirect} onChange={(e) => setEditRedirect(e.target.value)} placeholder="https://yourbrand.com" className={input} />
              <span className="text-[11px] text-outline">Leave empty to remove it.</span>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)} className="h-[34px] px-4 rounded-md text-xs text-on-surface-variant hover:bg-surface-container-low cursor-pointer">Cancel</button>
              <button type="submit" disabled={savingDomain} className={primaryBtn}>{savingDomain ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* Remove domain */}
      {toDelete && createPortal(
        <div className="fixed inset-0 z-50 bg-[#00000A73] backdrop-blur-[5px] flex items-center justify-center p-4 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setToDelete(null); }}>
          <div className="bg-surface-container-lowest rounded-xl max-w-sm w-full p-6 shadow-2xl border-[0.5px] border-outline-variant">
            <h3 className="text-base font-semibold text-on-surface">Remove {toDelete.hostname}?</h3>
            <p className="mt-1 text-xs text-on-surface-variant">Short links on this domain stop working. The links stay in your workspace.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setToDelete(null)} className="h-[34px] px-4 rounded-md text-xs text-on-surface-variant hover:bg-surface-container-low cursor-pointer">Cancel</button>
              <button
                type="button"
                onClick={async () => { const d = toDelete; setToDelete(null); if (await deleteDomain(d.id)) showToast('success', `${d.hostname} removed`); }}
                className="h-[34px] px-4 rounded-md bg-error text-on-error text-xs font-medium hover:opacity-90 cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
