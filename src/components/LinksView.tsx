'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { 
  Link2, 
  Search, 
  Copy, 
  Check, 
  QrCode, 
  Trash2, 
  ExternalLink, 
  ShieldAlert, 
  Lock, 
  Clock, 
  Tag, 
  Filter,
  FileSpreadsheet,
  Plus,
  GitFork,
  Sparkles
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface LinksViewProps {
  onOpenCreateModal: () => void;
}

export const LinksView: React.FC<LinksViewProps> = ({ onOpenCreateModal }) => {
  const { links, deleteLink, domains, exportLinksCsv } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // QR modal state
  const [selectedQrLink, setSelectedQrLink] = useState<{ url: string; title: string } | null>(null);

  const filteredLinks = links.filter((link) => {
    const matchesSearch = link.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.short_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.destination_url.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || link.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleCopy = (code: string, id: string) => {
    const domain = domains[0]?.hostname || 'short.link';
    const fullUrl = `https://${domain}/r/${code}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-400" /> Link Management
          </h1>
          <p className="text-xs text-slate-400">Search, edit, inspect analytics, and manage short URL aliases</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportLinksCsv}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-2 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export CSV
          </button>
          <button
            onClick={onOpenCreateModal}
            className="px-4 py-2 gradient-button text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" /> Create Link
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel p-4 rounded-xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search titles, short codes, destination URLs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-700 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
          >
            <option value="all">All Links ({links.length})</option>
            <option value="active">Active Only</option>
            <option value="flagged">Flagged / Phishing</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      {/* Links Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-white/10 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Link Details</th>
                <th className="p-4">Short URL & Slug</th>
                <th className="p-4">Destination URL</th>
                <th className="p-4">Clicks</th>
                <th className="p-4">Status & Protection</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No links found matching your search filters.
                  </td>
                </tr>
              ) : (
                filteredLinks.map((link) => {
                  const fullShortUrl = `https://${domains[0]?.hostname || 'short.link'}/r/${link.short_code}`;
                  return (
                    <tr key={link.id} className="hover:bg-white/[0.02] transition">
                      
                      {/* Link Title & Tags */}
                      <td className="p-4">
                        <p className="font-bold text-white text-sm">{link.title}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {link.tags.map((tag, idx) => (
                            <span key={idx} className="px-2 py-0.5 text-[9px] bg-slate-800 text-slate-300 rounded border border-white/5 font-mono">
                              #{tag}
                            </span>
                          ))}
                          {link.rules && link.rules.length > 0 && (
                            <span className="px-2 py-0.5 text-[9px] bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30 flex items-center gap-1">
                              <GitFork className="w-2.5 h-2.5" /> {link.rules.length} Rules
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Short URL */}
                      <td className="p-4 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-400 font-semibold">/r/{link.short_code}</span>
                          <button
                            onClick={() => handleCopy(link.short_code, link.id)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                            title="Copy Short Link"
                          >
                            {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Destination URL */}
                      <td className="p-4 max-w-xs">
                        <a
                          href={link.destination_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-300 hover:text-indigo-300 font-mono truncate block flex items-center gap-1"
                        >
                          <span className="truncate">{link.destination_url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>

                      {/* Clicks */}
                      <td className="p-4">
                        <p className="font-bold text-white">{link.clicks_count.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400">total clicks</p>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        {link.is_flagged ? (
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full flex items-center gap-1 w-max">
                            <ShieldAlert className="w-3 h-3" /> Flagged Phishing
                          </span>
                        ) : link.password_hash ? (
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full flex items-center gap-1 w-max">
                            <Lock className="w-3 h-3" /> Protected
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1 w-max">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedQrLink({ url: fullShortUrl, title: link.title })}
                            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition"
                            title="Generate QR Code"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`/r/${link.short_code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition"
                            title="Test Link Redirect"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => deleteLink(link.id)}
                            className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition"
                            title="Delete Short Link"
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

      {/* QR Code Quick Modal */}
      {selectedQrLink && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-sm w-full p-6 rounded-2xl border border-white/10 text-center space-y-4">
            <h3 className="text-base font-bold text-white">{selectedQrLink.title}</h3>
            <div className="p-4 bg-white rounded-xl inline-block shadow-xl">
              <QRCodeSVG value={selectedQrLink.url} size={180} />
            </div>
            <p className="font-mono text-xs text-indigo-400">{selectedQrLink.url}</p>
            <button
              onClick={() => setSelectedQrLink(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
            >
              Close QR Preview
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
