'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { 
  Link2, 
  Search, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Trash2, 
  Filter, 
  Lock, 
  ShieldAlert, 
  Plus, 
  Smartphone,
  FileSpreadsheet
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';

export const LinksView: React.FC<{ onOpenCreateModal: () => void }> = ({ onOpenCreateModal }) => {
  const { links, domains, deleteLink } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedQrLink, setSelectedQrLink] = useState<{ url: string; title: string } | null>(null);

  const resolvePrefix = (customDomain?: string) => {
    if (typeof window !== 'undefined') {
      const host = customDomain || window.location.host;
      const protocol = window.location.protocol;
      return `${protocol}//${host}`;
    }
    return 'http://localhost:3000';
  };

  const handleCopy = (shortCode: string, id: string) => {
    const fullUrl = `${resolvePrefix(domains[0]?.hostname)}/${shortCode}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLinks = links.filter((link) => {
    const matchesSearch = 
      link.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.short_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.destination_url.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'active') return matchesSearch && link.status === 'active';
    if (statusFilter === 'protected') return matchesSearch && !!link.password_hash;
    if (statusFilter === 'flagged') return matchesSearch && link.is_flagged;
    if (statusFilter === 'disabled') return matchesSearch && link.status === 'disabled';
    return matchesSearch;
  });

  const exportLinksCsv = () => {
    const headers = ['ID', 'Title', 'Short Code', 'Destination URL', 'Clicks', 'Status', 'Created At'];
    const rows = filteredLinks.map(l => [
      l.id,
      `"${l.title.replace(/"/g, '""')}"`,
      l.short_code,
      `"${l.destination_url.replace(/"/g, '""')}"`,
      l.clicks_count || 0,
      l.status,
      l.created_at
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tinyurl_links_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in text-foreground">
      
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" /> Links Directory
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your branded slugs, OpeninApp deep routing, and edge metrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="default"
            onClick={exportLinksCsv}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> Export CSV
          </Button>
          <Button
            onClick={onOpenCreateModal}
            size="default"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Link
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-3.5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search links, aliases, destination URLs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 h-9 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Filter:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 bg-background border border-border/60 focus:border-primary rounded-lg text-xs text-foreground outline-none cursor-pointer"
          >
            <option value="all">All Links ({links.length})</option>
            <option value="active">Active Only</option>
            <option value="protected">Password Protected</option>
            <option value="flagged">Flagged Phishing</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </Card>

      {/* Links Table */}
      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/30 border-b border-border/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Link Details</th>
                <th className="py-3 px-4">Short Code</th>
                <th className="py-3 px-4">Destination Target</th>
                <th className="py-3 px-4">Clicks</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 text-foreground">
              {filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Link2 className="w-8 h-8 text-muted-foreground/60 mx-auto" />
                      <p className="font-semibold text-foreground text-sm">No links found</p>
                      <p className="text-xs text-muted-foreground">Try adjusting your search filters or create your first short link.</p>
                      <Button
                        onClick={onOpenCreateModal}
                        size="sm"
                        className="mt-2"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Create Link
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLinks.map((link) => {
                  const fullUrl = `${resolvePrefix(domains[0]?.hostname)}/${link.short_code}`;
                  const isCopied = copiedId === link.id;

                  return (
                    <tr key={link.id} className="hover:bg-muted/20 transition group">
                      
                      {/* Title */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          {link.password_hash && <Lock className="w-3 h-3 text-amber-500" />}
                          <span className="truncate max-w-[200px]">{link.title || 'Untitled'}</span>
                          {link.deep_link?.enabled && (
                            <Badge variant="success" className="text-[9px] py-0">
                              OpeninApp
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(link.created_at).toLocaleDateString()}
                        </span>
                      </td>

                      {/* Code */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-primary font-semibold">
                          <a
                            href={`/${link.short_code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline flex items-center gap-1 text-primary hover:text-cyan-300 transition-colors"
                            title="Click to test & open short link"
                          >
                            <span>/{link.short_code}</span>
                            <ExternalLink className="w-3 h-3 opacity-60 hover:opacity-100" />
                          </a>
                          <button
                            onClick={() => handleCopy(link.short_code, link.id)}
                            className="p-1 text-muted-foreground hover:text-foreground rounded transition cursor-pointer"
                            title="Copy short URL"
                          >
                            {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>

                      {/* Destination */}
                      <td className="py-3 px-4 max-w-xs truncate">
                        <a
                          href={link.destination_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground font-mono text-[11px] hover:underline flex items-center gap-1 truncate"
                        >
                          <span className="truncate">{link.destination_url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>

                      {/* Clicks */}
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {(link.clicks_count || 0).toLocaleString()}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {link.is_flagged ? (
                          <Badge variant="destructive">Phish Flag</Badge>
                        ) : link.status === 'active' ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="outline">Disabled</Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedQrLink({ url: fullUrl, title: link.title })}
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </Button>
                          <button
                            onClick={() => deleteLink(link.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition cursor-pointer"
                            title="Delete Link"
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
      </Card>

      {/* QR Code Dialog */}
      {selectedQrLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="fixed inset-0" onClick={() => setSelectedQrLink(null)} />
          <div className="bg-card border border-border/60 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative z-10 text-center space-y-4">
            <h3 className="text-base font-bold text-foreground">{selectedQrLink.title || 'QR Code'}</h3>
            <div className="p-4 bg-white rounded-xl inline-block shadow-md">
              <QRCodeSVG value={selectedQrLink.url} size={180} />
            </div>
            <p className="text-xs font-mono text-muted-foreground break-all">{selectedQrLink.url}</p>
            <Button onClick={() => setSelectedQrLink(null)} className="w-full">
              Close Preview
            </Button>
          </div>
        </div>
      )}

    </div>
  );
};
