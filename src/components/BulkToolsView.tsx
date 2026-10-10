'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { FileSpreadsheet, Upload, Download, Check, Sparkles } from 'lucide-react';

export const BulkToolsView: React.FC = () => {
  const { importLinksCsv, exportLinksCsv } = useStore();
  const [csvContent, setCsvContent] = useState('');
  const [importCount, setImportCount] = useState<number | null>(null);

  const sampleCsv = `destination_url,title,custom_slug
https://acme.com/promo-1,Black Friday Deal,bfdeal26
https://acme.com/promo-2,Cyber Monday Special,cyber26
https://acme.com/blog/guide,SaaS Marketing Guide,saasguide`;

  const handleDownloadSample = () => {
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + sampleCsv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'url_shortener_sample_bulk.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent) return;

    const count = importLinksCsv(csvContent);
    setImportCount(count);
    setCsvContent('');
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-indigo-400" /> Bulk CSV Import & Export Tools
        </h1>
        <p className="text-xs text-slate-400">Batch generate hundreds of short links at once via CSV spreadsheet or export link analytics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Bulk Import */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-400" /> Import Short Links via CSV
            </h3>
            <button
              onClick={handleDownloadSample}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Sample CSV
            </button>
          </div>

          {importCount !== null && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" /> Successfully imported {importCount} short links into workspace!
            </div>
          )}

          <form onSubmit={handleImport} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Paste CSV Contents</label>
              <textarea
                rows={6}
                placeholder={sampleCsv}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-[11px] resize-none placeholder-slate-600"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 gradient-button text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <Upload className="w-4 h-4" /> Process & Bulk Create Links
            </button>
          </form>
        </div>

        {/* Bulk Export */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
              <Download className="w-4 h-4 text-cyan-400" /> Export All Workspace Links
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Export all active short links, click counts, security status, and creation timestamps to a formatted CSV file compatible with Excel, Google Sheets, and CRM tools.
            </p>
          </div>

          <button
            onClick={exportLinksCsv}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Export Workspace Links to CSV
          </button>
        </div>

      </div>

    </div>
  );
};
