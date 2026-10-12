'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/storeContext';
import { FileSpreadsheet, Upload, Download, Check } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export const BulkToolsView: React.FC = () => {
  const { importLinksCsv, exportLinksCsv } = useStore();
  const [csvContent, setCsvContent] = useState('');
  const [importCount, setImportCount] = useState<number | null>(null);

  const sampleCsv = `destination_url,title,custom_slug
https://example.com/promo-1,Black Friday Deal,bfdeal26
https://example.com/promo-2,Cyber Monday Special,cyber26
https://example.com/blog/guide,SaaS Marketing Guide,saasguide`;

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
    <div className="space-y-8 animate-fade-in text-foreground">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" /> Bulk CSV Import &amp; Export Automation
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Batch generate hundreds of short links at once via CSV spreadsheet or export link analytics into reports.
          </p>
        </div>

        <Badge variant="primary" className="px-3 py-1 text-xs">
          High-Throughput Batch
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Bulk Import */}
        <Card className="p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" /> Import Short Links via CSV
            </h3>
            <button
              onClick={handleDownloadSample}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Sample CSV Template
            </button>
          </div>

          {importCount !== null && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs rounded-xl flex items-center gap-2 font-medium">
              <Check className="w-4 h-4" /> Successfully imported {importCount} short links into workspace!
            </div>
          )}

          <form onSubmit={handleImport} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Paste CSV Rows (destination_url, title, custom_slug)
              </label>
              <textarea
                rows={6}
                required
                placeholder={sampleCsv}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                className="w-full p-3 bg-background border border-border/60 focus:border-primary rounded-xl text-xs font-mono text-foreground placeholder:text-muted-foreground/60 outline-none resize-none transition"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full text-xs font-bold"
            >
              <Upload className="w-4 h-4 mr-2" /> Start Batch Ingestion
            </Button>
          </form>
        </Card>

        {/* Bulk Export & Instructions */}
        <Card className="p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border/40">
              <Download className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Export All Workspace Links</h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Export all links, current click counts, creation timestamps, and target destinations in a standard UTF-8 CSV spreadsheet compatible with Excel, Google Sheets, and data pipelines.
            </p>

            <Button
              variant="outline"
              size="lg"
              onClick={exportLinksCsv}
              className="w-full text-xs font-bold"
            >
              <Download className="w-4 h-4 mr-2" /> Download Full Workspace Export (.csv)
            </Button>
          </div>

          <div className="p-4 bg-muted/20 border border-border/40 rounded-xl space-y-2 text-xs">
            <span className="font-semibold text-foreground block">Format Specifications:</span>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px]">
              <li>Columns: <code className="text-primary font-mono">destination_url, title, custom_slug</code></li>
              <li>URLs must include protocol (<code className="text-foreground font-mono">https://</code>)</li>
              <li>Custom slugs are checked for collisions automatically</li>
            </ul>
          </div>
        </Card>

      </div>

    </div>
  );
};
