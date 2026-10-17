'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Check, 
  ChevronRight, 
  Database, 
  CloudUpload, 
  CheckCircle2, 
  ArrowRight, 
  Bolt, 
  RefreshCw, 
  Calendar, 
  Search, 
  X, 
  Layers, 
  AlertCircle, 
  FileText,
  Activity,
  QrCode,
  FolderKanban,
  Sparkles,
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';

interface BulkJobRecord {
  id: string;
  workspace_id: string;
  user_email?: string;
  operation: 'import' | 'export';
  batch_name: string;
  total_rows: number;
  success_count: number;
  error_count: number;
  error_details?: Array<{ row: number; url: string; error: string }>;
  status: 'completed' | 'failed' | 'in_progress';
  created_at: string;
}

interface ParsedRow {
  [key: string]: string;
}

interface ColumnMapping {
  destination_url: string;
  custom_slug: string;
  title: string;
  tags: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
}

// Robust CSV Line Parser (handles quotes and commas)
function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export const BulkToolsView: React.FC = () => {
  const { 
    currentWorkspace, 
    currentUser,
    links, 
    clicks, 
    campaigns, 
    exportLinksCsv, 
    importLinksBatch, 
    logExportJob,
    refreshData 
  } = useStore();

  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Uploaded File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Column Mapping state
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    destination_url: '',
    custom_slug: '',
    title: '',
    tags: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: ''
  });

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported: number;
    failed: number;
    errors: Array<{ row: number; url: string; error: string }>;
  } | null>(null);

  // Real Database Jobs state
  const [jobs, setJobs] = useState<BulkJobRecord[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [jobPage, setJobPage] = useState(1);
  const jobsPerPage = 5;

  // Notification Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Export Modal state
  const [exportModalType, setExportModalType] = useState<'links' | 'telemetry' | 'campaigns' | 'qr' | null>(null);

  useEffect(() => {
    setMounted(true);
    refreshData();
  }, [refreshData]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Fetch real jobs from backend database
  const fetchJobs = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoadingJobs(true);
    try {
      const headers: Record<string, string> = {};
      if (currentUser?.email) headers['x-user-email'] = currentUser.email;
      if (currentWorkspace.id) headers['x-workspace-id'] = currentWorkspace.id;

      const res = await fetch(`/api/v1/bulk/jobs?workspace_id=${encodeURIComponent(currentWorkspace.id)}`, { headers });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.jobs)) {
        setJobs(data.jobs);
      }
    } catch {
      // Fallback empty
    } finally {
      setLoadingJobs(false);
    }
  }, [currentWorkspace?.id, currentUser?.email]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // CSV Template Download
  const handleDownloadTemplate = () => {
    const template = `destination_url,custom_slug,title,tags,utm_source,utm_medium,utm_campaign
https://amazon.com/dp/B08N5WRWNW,sony-deal,Sony Headphones Deal,youtube_sponsor,youtube,video_desc,autumn_deal
https://spotify.com/show/4k9x,podcast-ep45,Podcast Episode 45,instagram_bio,instagram,story_sticker,sponsor_roll
https://nordvpn.com/creator-pack,nord-deal-30,NordVPN Creator 30% Off,newsletter,substack,sponsor_slot,october_growth
https://notion.so/templates/agency,agency-os,Agency Operating System,tiktok_bio,tiktok,bio_link,creator_pack`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'snip_bulk_links_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded official CSV template: "snip_bulk_links_template.csv"');
  };

  // Parse Uploaded File
  const processUploadedFile = (file: File) => {
    setSelectedFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      setFileContent(text);
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length === 0) {
        showToast('Uploaded file is empty.');
        return;
      }

      // Detect delimiter (, or \t)
      const firstLine = lines[0];
      const delimiter = firstLine.includes('\t') ? '\t' : ',';
      const headers = parseCsvLine(firstLine, delimiter).map(h => h.toLowerCase().trim());
      setParsedHeaders(headers);

      // Parse data rows
      const rows: ParsedRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i], delimiter);
        if (values.length > 0 && values.some(v => v.length > 0)) {
          const rowObj: ParsedRow = {};
          headers.forEach((h, idx) => {
            rowObj[h] = values[idx] || '';
          });
          rows.push(rowObj);
        }
      }
      setParsedRows(rows);

      // Smart Auto-Mapping
      const mapping: ColumnMapping = {
        destination_url: '',
        custom_slug: '',
        title: '',
        tags: '',
        utm_source: '',
        utm_medium: '',
        utm_campaign: ''
      };

      headers.forEach(h => {
        if (!mapping.destination_url && (h.includes('destination') || h.includes('url') || h.includes('link') || h.includes('target') || h.includes('long'))) {
          mapping.destination_url = h;
        } else if (!mapping.custom_slug && (h.includes('slug') || h.includes('alias') || h.includes('vanity') || h.includes('code') || h.includes('short'))) {
          mapping.custom_slug = h;
        } else if (!mapping.title && (h.includes('title') || h.includes('name') || h.includes('label'))) {
          mapping.title = h;
        } else if (!mapping.tags && (h.includes('tag') || h.includes('channel') || h.includes('platform') || h.includes('marketing'))) {
          mapping.tags = h;
        } else if (!mapping.utm_source && h.includes('source')) {
          mapping.utm_source = h;
        } else if (!mapping.utm_medium && h.includes('medium')) {
          mapping.utm_medium = h;
        } else if (!mapping.utm_campaign && h.includes('campaign')) {
          mapping.utm_campaign = h;
        }
      });

      // Fallback: If no destination_url matched, pick the first column
      if (!mapping.destination_url && headers.length > 0) {
        mapping.destination_url = headers[0];
      }

      setColumnMapping(mapping);
      showToast(`Analyzed ${rows.length} rows from "${file.name}". Columns auto-mapped.`);
    };

    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  // Pre-flight Validation Calculation
  const preflightSummary = useMemo(() => {
    if (!selectedFile || parsedRows.length === 0 || !columnMapping.destination_url) {
      return null;
    }

    let validCount = 0;
    let invalidCount = 0;
    const slugs = new Set<string>();
    let slugDuplicates = 0;

    parsedRows.forEach(row => {
      const url = (row[columnMapping.destination_url] || '').trim();
      const hasHttp = /^https?:\/\//i.test(url) || url.includes('.');
      if (url && hasHttp) {
        validCount++;
      } else {
        invalidCount++;
      }

      if (columnMapping.custom_slug) {
        const slug = (row[columnMapping.custom_slug] || '').trim().toLowerCase();
        if (slug) {
          if (slugs.has(slug)) {
            slugDuplicates++;
          } else {
            slugs.add(slug);
          }
        }
      }
    });

    return {
      total: parsedRows.length,
      valid: validCount,
      invalid: invalidCount,
      slugDuplicates
    };
  }, [selectedFile, parsedRows, columnMapping]);

  // Execute Real Batch Import
  const handleProcessBatch = async () => {
    if (!selectedFile || parsedRows.length === 0 || !columnMapping.destination_url) {
      showToast('Please select a file and ensure the Destination URL column is mapped.');
      return;
    }

    setIsProcessing(true);
    setImportProgress(15);

    // Transform parsed rows into API payload items
    const items = parsedRows.map(row => {
      const rawUrl = (row[columnMapping.destination_url] || '').trim();
      let destUrl = rawUrl;
      if (destUrl && !/^https?:\/\//i.test(destUrl)) {
        destUrl = `https://${destUrl}`;
      }

      const slug = columnMapping.custom_slug ? (row[columnMapping.custom_slug] || '').trim() : undefined;
      const title = columnMapping.title ? (row[columnMapping.title] || '').trim() : undefined;
      
      const tagStr = columnMapping.tags ? (row[columnMapping.tags] || '').trim() : '';
      const tags = tagStr ? tagStr.split(/[,;|]/).map(t => t.trim()).filter(Boolean) : ['bulk_import'];

      const utm_source = columnMapping.utm_source ? (row[columnMapping.utm_source] || '').trim() : undefined;
      const utm_medium = columnMapping.utm_medium ? (row[columnMapping.utm_medium] || '').trim() : undefined;
      const utm_campaign = columnMapping.utm_campaign ? (row[columnMapping.utm_campaign] || '').trim() : undefined;

      return {
        destination_url: destUrl,
        custom_slug: slug || undefined,
        title: title || undefined,
        tags: tags.length > 0 ? tags : undefined,
        utm_source: utm_source || undefined,
        utm_medium: utm_medium || undefined,
        utm_campaign: utm_campaign || undefined
      };
    });

    setImportProgress(45);

    try {
      const result = await importLinksBatch(items, selectedFile.name);
      setImportProgress(100);
      setIsProcessing(false);
      setImportResult(result);

      if (result.success) {
        showToast(`Batch completed: ${result.imported} links generated successfully!`);
        fetchJobs();
      } else {
        showToast(`Batch encountered errors: ${result.failed} rows failed.`);
      }
    } catch {
      setIsProcessing(false);
      showToast('Network error while processing bulk import.');
    }
  };

  // Real Export Handlers
  const handleExportLinks = async () => {
    exportLinksCsv();
    await logExportJob('Full Links Inventory CSV Export', links.length);
    fetchJobs();
    showToast(`Exported ${links.length} active workspace links to CSV.`);
  };

  const handleExportTelemetry = async () => {
    const headers = ['Timestamp', 'Short Code', 'Country', 'Region', 'City', 'Device', 'Browser', 'OS', 'Referrer', 'Latency (ms)'];
    const rows = clicks.map(c => [
      c.timestamp || new Date().toISOString(),
      c.short_code || '',
      c.country || 'Unknown',
      c.region || '',
      c.city || '',
      c.device || 'desktop',
      c.browser || 'Unknown',
      c.os || 'Unknown',
      `"${(c.referrer || 'Direct').replace(/"/g, '""')}"`,
      c.latency_ms || 20
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const a = document.createElement('a');
    a.href = encoded;
    a.download = `snip_click_telemetry_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    await logExportJob('Raw Click Telemetry Event Log', clicks.length);
    fetchJobs();
    showToast(`Exported ${clicks.length} raw telemetry click events.`);
  };

  const handleExportCampaigns = async () => {
    const headers = ['Campaign Name', 'Target Clicks', 'Achieved Clicks', 'Completion %', 'Deliverables Count', 'Created At'];
    const rows = campaigns.map(camp => {
      const campLinks = links.filter(l => l.campaign_id === camp.id || (camp.tags && l.tags?.some(t => camp.tags?.includes(t))));
      const campClicks = campLinks.reduce((acc, l) => acc + (l.clicks_count || 0), 0);
      const target = camp.target_clicks || 10000;
      const pct = Math.min(100, Math.round((campClicks / target) * 100));
      return [
        `"${camp.name.replace(/"/g, '""')}"`,
        target,
        campClicks,
        `${pct}%`,
        campLinks.length,
        camp.created_at || new Date().toISOString()
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const a = document.createElement('a');
    a.href = encoded;
    a.download = `snip_campaign_deliverables_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    await logExportJob('Sponsor Campaign Deliverables Report', campaigns.length);
    fetchJobs();
    showToast(`Exported ${campaigns.length} campaigns and sponsor assets.`);
  };

  // Filtered & Paginated Jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(j => 
      j.id.toLowerCase().includes(jobSearch.toLowerCase()) ||
      j.batch_name.toLowerCase().includes(jobSearch.toLowerCase()) ||
      j.operation.toLowerCase().includes(jobSearch.toLowerCase())
    );
  }, [jobs, jobSearch]);

  const totalJobPages = Math.max(1, Math.ceil(filteredJobs.length / jobsPerPage));
  const paginatedJobs = useMemo(() => {
    const start = (jobPage - 1) * jobsPerPage;
    return filteredJobs.slice(start, start + jobsPerPage);
  }, [filteredJobs, jobPage]);

  if (!mounted) return null;

  return (
    <div className="flex flex-col w-full text-on-surface animate-fade-in max-w-7xl mx-auto pb-16">
      
      {/* 1. Header Ribbon & Live Status */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium mb-1">
            <span className="hover:text-on-surface cursor-pointer">Workspace</span>
            <ChevronRight className="w-3.5 h-3.5 text-outline-variant" />
            <span className="text-primary font-semibold">Bulk Automation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Bulk CSV Import &amp; Export Automation
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-3xl mt-1 leading-relaxed">
            Batch-generate hundreds of branded vanity slugs from CSV or spreadsheet files, auto-map columns, and export verified telemetry logs for sponsors and analytics.
          </p>
        </div>

        {/* Real Status Badge Pills */}
        <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-xl shadow-xs self-start md:self-auto border border-outline-variant/30">
          <div className="px-3 py-1.5 bg-surface-container-lowest rounded-lg shadow-xs flex items-center gap-1.5 border border-outline-variant/20">
            <Database className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-on-surface-variant font-medium">Active Links:</span>
            <span className="font-mono text-xs font-bold text-on-surface">{links.length.toLocaleString()}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-on-surface-variant font-medium">Engine Status:</span>
            <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ready</span>
          </div>
        </div>
      </div>

      {/* 2. Operations Split: Left 7 cols (Import), Right 5 cols (Real Exports) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mb-8">
        
        {/* LEFT PANEL: Bulk Link Importer & Generator (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-xs border border-outline-variant/30 p-5 sm:p-6 flex flex-col">
            
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-outline-variant/20 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-on-surface">Bulk Link Importer &amp; Generator</h2>
                  <p className="text-xs text-on-surface-variant">Transform spreadsheets of destination URLs into shortened links</p>
                </div>
              </div>
              <button 
                type="button"
                id="download-template-btn"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-surface-container-low transition-colors cursor-pointer border border-primary/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample CSV</span>
              </button>
            </div>

            {/* Drag & Drop Dropzone */}
            <div 
              id="drop-zone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  processUploadedFile(e.dataTransfer.files[0]);
                }
              }}
              className={`relative group cursor-pointer rounded-lg transition-all p-7 text-center flex flex-col items-center justify-center border-2 border-dashed ${
                isDragging 
                  ? 'bg-primary/5 border-primary scale-[1.01]' 
                  : selectedFile
                  ? 'bg-emerald-500/5 border-emerald-500/40 hover:bg-emerald-500/10'
                  : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/40'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                id="csv-file-input"
                accept=".csv, .tsv, .txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-lg bg-surface-container-lowest shadow-xs flex items-center justify-center text-primary group-hover:scale-110 transition-transform mb-3 border border-outline-variant/30">
                <CloudUpload className="w-6 h-6" />
              </div>

              {selectedFile ? (
                <>
                  <span className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{selectedFile.name}</span>
                  </span>
                  <span className="text-xs text-on-surface-variant mt-1">
                    {parsedRows.length} rows loaded &bull; {(selectedFile.size / 1024).toFixed(1)} KB &bull; <span className="text-primary underline font-semibold">Click to replace file</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm font-semibold text-on-surface">Drop your .csv or .tsv file here</span>
                  <span className="text-xs text-on-surface-variant mt-1">
                    or <span className="text-primary font-semibold underline underline-offset-2">browse files</span> from your local computer
                  </span>
                  <div className="mt-3 inline-flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1 rounded-md border border-outline-variant/30 text-[11px] text-on-surface-variant font-medium">
                    <AlertCircle className="w-3.5 h-3.5 text-outline" />
                    <span>Supports Bitly migrations, UTM sheets, and up to 1,000 links per batch</span>
                  </div>
                </>
              )}
            </div>

            {/* Dynamic Column Mapping Controls */}
            {selectedFile && parsedHeaders.length > 0 && (
              <div className="mt-6 flex flex-col gap-3 animate-fade-in">
                <div className="flex items-center justify-between pb-1 border-b border-outline-variant/20">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-on-surface">Interactive Column Mapping</span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant font-mono">
                    {parsedHeaders.length} columns detected in file
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-container-low p-4 rounded-lg border border-outline-variant/25 text-xs">
                  {/* Destination URL */}
                  <div>
                    <label className="font-semibold text-on-surface block mb-1 flex items-center justify-between">
                      <span>Destination URL <strong className="text-red-500">*</strong></span>
                      <span className="text-[10px] text-emerald-600 font-mono font-bold">Required</span>
                    </label>
                    <select
                      value={columnMapping.destination_url}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, destination_url: e.target.value }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-mono outline-none focus:ring-1 focus:ring-primary cursor-pointer text-xs"
                    >
                      <option value="">-- Choose Column --</option>
                      {parsedHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Custom Slug */}
                  <div>
                    <label className="font-semibold text-on-surface block mb-1 flex items-center justify-between">
                      <span>Custom Slug / Vanity Alias</span>
                      <span className="text-[10px] text-on-surface-variant font-mono">Optional</span>
                    </label>
                    <select
                      value={columnMapping.custom_slug}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, custom_slug: e.target.value }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-mono outline-none focus:ring-1 focus:ring-primary cursor-pointer text-xs"
                    >
                      <option value="">-- Auto-generate unique 6-char code --</option>
                      {parsedHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Title / Label */}
                  <div>
                    <label className="font-semibold text-on-surface block mb-1">Link Title / Label</label>
                    <select
                      value={columnMapping.title}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-mono outline-none focus:ring-1 focus:ring-primary cursor-pointer text-xs"
                    >
                      <option value="">-- None (Use short slug as title) --</option>
                      {parsedHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Channel / Platform Tag */}
                  <div>
                    <label className="font-semibold text-on-surface block mb-1">Tags / Platform Channel</label>
                    <select
                      value={columnMapping.tags}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, tags: e.target.value }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-mono outline-none focus:ring-1 focus:ring-primary cursor-pointer text-xs"
                    >
                      <option value="">-- None (Default 'bulk_import') --</option>
                      {parsedHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Live Preview of First 3 Rows */}
                {parsedRows.length > 0 && columnMapping.destination_url && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                      Transformation Preview (First {Math.min(3, parsedRows.length)} rows)
                    </span>
                    <div className="overflow-x-auto rounded-lg border border-outline-variant/20 bg-surface-container-low text-[11px]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-outline-variant/20 bg-surface-container-high/60 text-on-surface-variant font-semibold">
                            <th className="py-1.5 px-3">#</th>
                            <th className="py-1.5 px-3">Destination URL</th>
                            <th className="py-1.5 px-3">Allocated Slug</th>
                            <th className="py-1.5 px-3">Title</th>
                            <th className="py-1.5 px-3">Tag</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/15 text-on-surface font-mono">
                          {parsedRows.slice(0, 3).map((row, idx) => (
                            <tr key={idx} className="hover:bg-surface-container-lowest/60">
                              <td className="py-2 px-3 text-on-surface-variant font-sans">{idx + 1}</td>
                              <td className="py-2 px-3 truncate max-w-[200px]" title={row[columnMapping.destination_url]}>
                                {row[columnMapping.destination_url] || '—'}
                              </td>
                              <td className="py-2 px-3 text-primary font-bold">
                                {columnMapping.custom_slug && row[columnMapping.custom_slug] 
                                   ? `/${row[columnMapping.custom_slug]}` 
                                   : '/[auto]'}
                              </td>
                              <td className="py-2 px-3 truncate max-w-[120px]">
                                {columnMapping.title && row[columnMapping.title] ? row[columnMapping.title] : 'Untitled'}
                              </td>
                              <td className="py-2 px-3 font-sans">
                                <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px]">
                                  {columnMapping.tags && row[columnMapping.tags] ? row[columnMapping.tags] : 'bulk'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pre-Flight Validation Bar & Execution Button */}
            {preflightSummary && (
              <div className="mt-6 pt-4 border-t border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                <div className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-xs ${
                  preflightSummary.invalid > 0 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300' 
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <div className="flex flex-col">
                    <span className="font-bold">
                      {preflightSummary.valid} valid links verified
                    </span>
                    <span className="text-[11px] opacity-80">
                      {preflightSummary.invalid > 0 && `${preflightSummary.invalid} invalid rows skipped • `}
                      {preflightSummary.slugDuplicates > 0 && `${preflightSummary.slugDuplicates} internal slug duplicates • `}
                      Ready to generate in workspace
                    </span>
                  </div>
                </div>

                <button 
                  type="button"
                  id="process-batch-btn"
                  disabled={isProcessing || preflightSummary.valid === 0}
                  onClick={handleProcessBatch}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary-container text-on-primary text-xs font-bold hover:bg-primary shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-[0.99] disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importing ({importProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Bolt className="w-4 h-4" />
                      <span>Process &amp; Generate {preflightSummary.valid} Links</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Import Result Notification */}
            {importResult && (
              <div className={`mt-4 p-4 rounded-lg border text-xs space-y-2 animate-fade-in ${
                importResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                  : 'bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Import Completed: {importResult.imported} links generated!</span>
                  </div>
                  <span className="font-mono text-[11px]">
                    {importResult.failed > 0 ? `${importResult.failed} failed` : '0 errors'}
                  </span>
                </div>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="pt-2 border-t border-outline-variant/20 space-y-1 text-[11px] font-mono max-h-24 overflow-y-auto">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <div key={i} className="text-red-600 dark:text-red-400">
                        Row {err.row}: {err.error}
                      </div>
                    ))}
                    {importResult.errors.length > 5 && (
                      <div className="text-on-surface-variant italic">
                        ...and {importResult.errors.length - 5} more error(s) recorded in audit log.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* RIGHT PANEL: Real Creator Data Export Utilities (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-xs border border-outline-variant/30 p-5 sm:p-6 flex flex-col h-full">
            
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-outline-variant/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-on-surface">Data Exports &amp; Auditing</h2>
                  <p className="text-xs text-on-surface-variant">Export live inventory, raw telemetry, &amp; campaigns</p>
                </div>
              </div>
            </div>

            {/* Real Export Cards */}
            <div className="flex flex-col gap-3">
              
              {/* Export Utility 1: Links Inventory */}
              <div className="p-4 bg-surface-container-low rounded-lg flex flex-col gap-2 border border-outline-variant/20 hover:border-outline-variant/50 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-on-surface">Workspace Links Inventory</span>
                  </div>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant font-semibold">
                    {links.length} Links
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Full registry with vanity slugs, destination targets, true click counters, and creation metadata.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/15 text-xs">
                  <span className="font-mono text-[11px] text-on-surface-variant">Format: CSV</span>
                  <button
                    type="button"
                    onClick={handleExportLinks}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-primary font-semibold border border-outline-variant/30 cursor-pointer text-xs shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* Export Utility 2: Raw Telemetry Click Events */}
              <div className="p-4 bg-surface-container-low rounded-lg flex flex-col gap-2 border border-outline-variant/20 hover:border-outline-variant/50 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-on-surface">Raw Telemetry Click Logs</span>
                  </div>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 font-semibold">
                    {clicks.length} Events
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Granular click event streams: country splits, city locations, device models, referrers, and timestamps.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/15 text-xs">
                  <span className="font-mono text-[11px] text-on-surface-variant">Format: CSV</span>
                  <button
                    type="button"
                    onClick={handleExportTelemetry}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-blue-600 font-semibold border border-outline-variant/30 cursor-pointer text-xs shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Telemetry</span>
                  </button>
                </div>
              </div>

              {/* Export Utility 3: Campaigns & Sponsor Deliverables */}
              <div className="p-4 bg-surface-container-low rounded-lg flex flex-col gap-2 border border-outline-variant/20 hover:border-outline-variant/50 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-on-surface">Sponsor Deals &amp; Deliverables</span>
                  </div>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 font-semibold">
                    {campaigns.length} Campaigns
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Campaign rollups: targeted click benchmarks, achieved click counts, and deliverable pacing.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/15 text-xs">
                  <span className="font-mono text-[11px] text-on-surface-variant">Format: CSV</span>
                  <button
                    type="button"
                    onClick={handleExportCampaigns}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-purple-600 font-semibold border border-outline-variant/30 cursor-pointer text-xs shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Report</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>

      {/* 3. BOTTOM SECTION: Real Bulk Job History & Audit Log Table (from PostgreSQL) */}
      <div className="bg-surface-container-lowest rounded-xl shadow-xs border border-outline-variant/30 p-5 sm:p-6 flex flex-col">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Bulk Job History &amp; Audit Log</h2>
              <p className="text-xs text-on-surface-variant">Database records of batch link creations and export dumps</p>
            </div>
          </div>

          {/* Table Filter Toolbar */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="relative">
              <input 
                type="text"
                placeholder="Filter by Job ID or Name..."
                value={jobSearch}
                onChange={(e) => {
                  setJobSearch(e.target.value);
                  setJobPage(1);
                }}
                className="bg-surface-container-low rounded-lg px-3 py-1.5 text-xs text-on-surface pl-8 w-48 sm:w-56 outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30 transition-all"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-outline pointer-events-none" />
            </div>
            <button 
              type="button"
              onClick={fetchJobs}
              disabled={loadingJobs}
              className="p-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface transition-colors border border-outline-variant/30 cursor-pointer disabled:opacity-50"
              title="Refresh Audit Log"
            >
              <RefreshCw className={`w-4 h-4 text-outline ${loadingJobs ? 'animate-spin text-primary' : ''}`} />
            </button>
          </div>
        </div>

        {/* Desktop Data Table */}
        <div className="hidden md:block overflow-x-auto rounded-lg border border-outline-variant/20">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
                <th className="py-3 px-4">Job ID</th>
                <th className="py-3 px-4">Operation</th>
                <th className="py-3 px-4">Batch Name</th>
                <th className="py-3 px-4">Total Rows</th>
                <th className="py-3 px-4">Success / Errors</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {paginatedJobs.map((job) => (
                <tr key={job.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-primary">
                    #{job.id.slice(0, 14)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider ${
                      job.operation === 'import' 
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                    }`}>
                      {job.operation === 'import' ? <Upload className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                      <span>{job.operation}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-on-surface block truncate max-w-xs">{job.batch_name}</span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-on-surface">
                    {job.total_rows.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{job.success_count} ok</span>
                    {job.error_count > 0 && (
                      <span className="text-red-600 dark:text-red-400 font-bold ml-1.5">&bull; {job.error_count} err</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-on-surface-variant text-[11px]">
                    {new Date(job.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold border ${
                      job.status === 'completed' 
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${job.status === 'completed' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="capitalize">{job.status}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={handleExportLinks}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </td>
                </tr>
              ))}

              {filteredJobs.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-on-surface-variant text-xs">
                    {loadingJobs 
                      ? 'Loading job audit history...' 
                      : 'No bulk import or export operations recorded yet. Upload a CSV to get started.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (Phones & Small Tablets) */}
        <div className="block md:hidden divide-y divide-outline-variant/20 rounded-lg border border-outline-variant/20 bg-surface-container-lowest overflow-hidden">
          {paginatedJobs.map((job) => (
            <div key={job.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-primary">#{job.id.slice(0, 14)}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                    job.operation === 'import' 
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                  }`}>
                    {job.operation === 'import' ? <Upload className="w-2.5 h-2.5" /> : <Download className="w-2.5 h-2.5" />}
                    <span>{job.operation}</span>
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    job.status === 'completed' 
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' 
                      : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${job.status === 'completed' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="capitalize">{job.status}</span>
                  </span>
                </div>
              </div>

              <div>
                <span className="text-sm font-bold text-on-surface block break-words">{job.batch_name}</span>
                <span className="text-[11px] text-on-surface-variant font-mono mt-0.5 block">
                  {new Date(job.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/15 flex-wrap">
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-on-surface-variant font-medium">
                    Rows: <strong className="text-on-surface">{job.total_rows.toLocaleString()}</strong>
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">{job.success_count} ok</span>
                  {job.error_count > 0 && (
                    <span className="text-red-600 dark:text-red-400 font-bold">{job.error_count} err</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleExportLinks}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer ml-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          ))}

          {filteredJobs.length === 0 && (
            <div className="py-8 px-4 text-center text-on-surface-variant text-xs">
              {loadingJobs 
                ? 'Loading job audit history...' 
                : 'No bulk import or export operations recorded yet. Upload a CSV to get started.'}
            </div>
          )}
        </div>

        {/* Real Table Pagination */}
        {filteredJobs.length > 0 && (
          <div className="flex items-center justify-between pt-4 mt-2 flex-wrap gap-2">
            <span className="text-xs text-on-surface-variant">
              Showing <span className="font-semibold text-on-surface">{Math.min(filteredJobs.length, (jobPage - 1) * jobsPerPage + 1)} - {Math.min(filteredJobs.length, jobPage * jobsPerPage)}</span> of <span className="font-semibold text-on-surface">{filteredJobs.length}</span> operations
            </span>
            <div className="flex items-center gap-1">
              <button 
                type="button"
                disabled={jobPage <= 1}
                onClick={() => setJobPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg bg-surface-container-low text-on-surface-variant disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs border border-outline-variant/20 hover:bg-surface-container transition cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: totalJobPages }, (_, i) => i + 1).map(pageNum => (
                <button 
                  key={pageNum}
                  type="button"
                  onClick={() => setJobPage(pageNum)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    jobPage === pageNum 
                      ? 'bg-primary-container text-on-primary shadow-xs' 
                      : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-outline-variant/20'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button 
                type="button"
                disabled={jobPage >= totalJobPages}
                onClick={() => setJobPage(p => Math.min(totalJobPages, p + 1))}
                className="px-3 py-1 rounded-lg bg-surface-container-low text-on-surface-variant disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs border border-outline-variant/20 hover:bg-surface-container transition cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Floating Notification Toast */}
      {mounted && toastMessage && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-6 right-6 bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2.5 transition-all duration-200 z-[100] animate-fade-in border border-outline-variant/30 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>,
        document.body
      )}

    </div>
  );
};
