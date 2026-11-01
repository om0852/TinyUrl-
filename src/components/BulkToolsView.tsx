'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/storeContext';
import { SkeletonGenericView } from '@/components/ui';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  RefreshCw,
  Search,
  AlertCircle,
  FileText,
  Activity,
  FolderKanban
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

// "example.com/x" gets https://; anything that already names a scheme is left alone, so
// "ftp://x" is rejected instead of becoming "https://ftp://x"
function toDestinationUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return '';
  return url.includes('://') ? url : `https://${url}`;
}

function isValidDestination(raw: string): boolean {
  const url = toDestinationUrl(raw);
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    return new URL(url).hostname.includes('.');
  } catch {
    return false;
  }
}

function downloadCsv(filename: string, lines: string[]) {
  // A Blob keeps characters like "#" that a data: URI would cut the file at
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Line of the uploaded file each parsed row came from, for error messages
const LINE_KEY = '__line';
// Same cap as /api/v1/links/bulk
const MAX_ROWS = 1000;

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
    refreshLinks,
    refreshCampaigns,
    isInitialLoading,
    isLinksLoading
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
    skipped?: number;
  } | null>(null);

  // Real Database Jobs state
  const [jobs, setJobs] = useState<BulkJobRecord[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [jobPage, setJobPage] = useState(1);
  const jobsPerPage = 5;

  // Notification Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);


  useEffect(() => {
    setMounted(true);
    refreshLinks();
    refreshCampaigns();
  }, [refreshLinks, refreshCampaigns]);

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
    a.download = 'bulk_links_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Sample CSV downloaded');
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
      const allLines = text.split(/\r?\n/);
      const numbered = allLines.map((line, i) => ({ line, n: i + 1 })).filter(l => l.line.trim().length > 0);
      const lines = numbered.map(l => l.line);
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
          rowObj[LINE_KEY] = String(numbered[i].n);
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
      showToast(`${rows.length} rows loaded`);
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
      if (isValidDestination(row[columnMapping.destination_url] || '')) {
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
      showToast('Choose the destination URL column first');
      return;
    }

    setIsProcessing(true);
    setImportProgress(15);

    // Transform parsed rows into API payload items
    const validRows = parsedRows.filter(row => isValidDestination(row[columnMapping.destination_url] || ''));
    const skipped = parsedRows.length - validRows.length;
    const items = validRows.map(row => {
      const destUrl = toDestinationUrl(row[columnMapping.destination_url] || '');

      const slug = columnMapping.custom_slug ? (row[columnMapping.custom_slug] || '').trim() : undefined;
      const title = columnMapping.title ? (row[columnMapping.title] || '').trim() : undefined;
      
      const tagStr = columnMapping.tags ? (row[columnMapping.tags] || '').trim() : '';
      const tags = tagStr ? tagStr.split(/[,;|]/).map(t => t.trim()).filter(Boolean) : ['bulk_import'];

      const utm_source = columnMapping.utm_source ? (row[columnMapping.utm_source] || '').trim() : undefined;
      const utm_medium = columnMapping.utm_medium ? (row[columnMapping.utm_medium] || '').trim() : undefined;
      const utm_campaign = columnMapping.utm_campaign ? (row[columnMapping.utm_campaign] || '').trim() : undefined;

      return {
        row: Number(row[LINE_KEY]) || undefined,
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
      setImportResult({ ...result, skipped });
      fetchJobs();

      if (result.imported === 0) {
        showToast(result.failed > 0 ? `No links created. ${result.failed} rows failed.` : 'No links created.');
      } else if (result.failed > 0 || skipped > 0) {
        showToast(`${result.imported} created, ${result.failed + skipped} not created`);
      } else {
        showToast(`${result.imported} links created`);
      }
    } catch {
      setIsProcessing(false);
      showToast('Import failed. Check your connection and try again.');
    }
  };

  // Real Export Handlers
  const handleExportLinks = async () => {
    const count = await exportLinksCsv();
    await logExportJob('Links export', count);
    fetchJobs();
    showToast(`Exported ${count} links`);
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
      c.latency_ms ?? ''
    ]);

    downloadCsv(`snip_clicks_${new Date().toISOString().split('T')[0]}.csv`, [headers.join(','), ...rows.map(r => r.join(','))]);

    await logExportJob('Clicks export', clicks.length);
    fetchJobs();
    showToast(`Exported ${clicks.length} clicks`);
  };

  const handleExportCampaigns = async () => {
    const headers = ['Campaign Name', 'Target Clicks', 'Achieved Clicks', 'Completion %', 'Links', 'Created At'];
    const rows = campaigns.map(camp => {
      const campLinks = links.filter(l => l.campaign_id === camp.id);
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

    downloadCsv(`snip_campaigns_${new Date().toISOString().split('T')[0]}.csv`, [headers.join(','), ...rows.map(r => r.join(','))]);

    await logExportJob('Campaigns export', campaigns.length);
    fetchJobs();
    showToast(`Exported ${campaigns.length} campaigns`);
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

  if (!mounted || (isInitialLoading && links.length === 0)) {
    return <SkeletonGenericView title="Bulk links" />;
  }

  const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
  const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string; empty: string }[] = [
    { key: 'destination_url', label: 'Destination URL', empty: 'Choose a column' },
    { key: 'custom_slug', label: 'Slug', empty: 'Auto-generate' },
    { key: 'title', label: 'Title', empty: 'None' },
    { key: 'tags', label: 'Tags', empty: 'None' },
    { key: 'utm_source', label: 'UTM source', empty: 'None' },
    { key: 'utm_medium', label: 'UTM medium', empty: 'None' },
    { key: 'utm_campaign', label: 'UTM campaign', empty: 'None' },
  ];
  const EXPORTS = [
    { id: 'links', icon: <FileSpreadsheet className="w-4 h-4" />, label: 'Links', hint: `${plural(links.length, 'link')} with slugs, destinations and clicks`, onClick: handleExportLinks },
    { id: 'clicks', icon: <Activity className="w-4 h-4" />, label: 'Clicks', hint: `${plural(clicks.length, 'click')} with location, device and referrer`, onClick: handleExportTelemetry },
    { id: 'campaigns', icon: <FolderKanban className="w-4 h-4" />, label: 'Campaigns', hint: `${plural(campaigns.length, 'campaign')} with clicks against target`, onClick: handleExportCampaigns },
  ];
  const fmtWhen = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const jobStatus = (job: BulkJobRecord) => (
    <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant capitalize whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full ${job.status === 'completed' ? 'bg-emerald-500' : job.status === 'failed' ? 'bg-rose-500' : 'bg-amber-500'}`} />
      {job.status.replace('_', ' ')}
    </span>
  );
  const jobResult = (job: BulkJobRecord) => (
    <>
      {job.success_count.toLocaleString()} ok
      {job.error_count > 0 && <span className="text-error"> · {job.error_count.toLocaleString()} failed</span>}
    </>
  );

  return (
    <div className="flex flex-col w-full gap-[15px] text-on-surface animate-fade-in max-w-7xl mx-auto pb-16">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[15px] items-start">

        {/* Import */}
        <div className="lg:col-span-7 rounded-xl border-[0.5px] border-outline-variant p-[15px] flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-on-surface">Import links from CSV</h2>
            <button
              type="button"
              id="download-template-btn"
              onClick={handleDownloadTemplate}
              className="text-xs text-primary-ink hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sample CSV</span>
            </button>
          </div>

          <div
            id="drop-zone"
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) processUploadedFile(e.dataTransfer.files[0]);
            }}
            className={`cursor-pointer rounded-md border border-dashed px-4 py-6 flex flex-col items-center text-center transition-colors ${
              isDragging ? 'border-primary-strong bg-primary-fixed/40' : 'border-outline-variant hover:bg-surface-container-low'
            }`}
          >
            <input ref={fileInputRef} type="file" id="csv-file-input" accept=".csv, .tsv, .txt" onChange={handleFileChange} className="hidden" />
            {selectedFile ? (
              <>
                <FileText className="w-5 h-5 text-on-surface-variant" />
                <span className="mt-2 text-xs font-medium text-on-surface">{selectedFile.name}</span>
                <span className="text-[11px] text-outline">
                  {parsedRows.length.toLocaleString()} rows · {(selectedFile.size / 1024).toFixed(1)} KB · <span className="text-primary-ink">Replace</span>
                </span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-on-surface-variant" />
                <span className="mt-2 text-xs font-medium text-on-surface">Drop a CSV or TSV file, or <span className="text-primary-ink">browse</span></span>
                <span className="text-[11px] text-outline">One link per row</span>
              </>
            )}
          </div>

          {selectedFile && parsedHeaders.length > 0 && (
            <div className="flex flex-col gap-3 animate-fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2">
                {MAPPING_FIELDS.map(field => (
                  <label key={field.key} className="flex flex-col gap-1 min-w-0">
                    <span className="text-[11px] text-on-surface-variant">
                      {field.label}{field.key === 'destination_url' && <span className="text-error"> *</span>}
                    </span>
                    <select
                      value={columnMapping[field.key]}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="h-[30px] px-2 rounded-md bg-surface-container-lowest border-[0.5px] border-outline-variant text-xs text-on-surface outline-none focus:border-on-surface-variant cursor-pointer min-w-0"
                    >
                      <option value="">{field.empty}</option>
                      {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </label>
                ))}
              </div>

              {parsedRows.length > 0 && columnMapping.destination_url && (
                <div className="overflow-x-auto rounded-md border-[0.5px] border-outline-variant">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="bg-surface-container-low text-on-surface-variant border-b-[0.5px] border-outline-variant">
                        <th className="py-1.5 px-2.5 font-medium">Destination</th>
                        <th className="py-1.5 px-2.5 font-medium">Slug</th>
                        <th className="py-1.5 px-2.5 font-medium">Title</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 3).map((row, idx) => (
                        <tr key={idx} className="border-b-[0.5px] border-outline-variant last:border-b-0">
                          <td className="py-1.5 px-2.5 truncate max-w-[220px]" title={row[columnMapping.destination_url]}>{row[columnMapping.destination_url] || '—'}</td>
                          <td className="py-1.5 px-2.5 text-primary-ink whitespace-nowrap">
                            {columnMapping.custom_slug && row[columnMapping.custom_slug] ? `/${row[columnMapping.custom_slug]}` : <span className="text-outline">auto</span>}
                          </td>
                          <td className="py-1.5 px-2.5 truncate max-w-[140px]">{columnMapping.title && row[columnMapping.title] ? row[columnMapping.title] : <span className="text-outline">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRows.length > 3 && (
                    <p className="px-2.5 py-1.5 text-[11px] text-outline border-t-[0.5px] border-outline-variant">+ {(parsedRows.length - 3).toLocaleString()} more rows</p>
                  )}
                </div>
              )}
            </div>
          )}

          {preflightSummary && (
            <div className="pt-3 border-t-[0.5px] border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
              <p className="text-xs text-on-surface-variant">
                <span className="font-semibold text-on-surface">{preflightSummary.valid.toLocaleString()}</span> ready
                {preflightSummary.invalid > 0 && <span className="text-amber-700"> · {preflightSummary.invalid} without a valid URL (skipped)</span>}
                {preflightSummary.valid > MAX_ROWS && <span className="text-error"> · up to {MAX_ROWS.toLocaleString()} links per file</span>}
                {preflightSummary.slugDuplicates > 0 && <span className="text-amber-700"> · {plural(preflightSummary.slugDuplicates, 'repeated slug')}</span>}
              </p>
              <button
                type="button"
                id="process-batch-btn"
                disabled={isProcessing || preflightSummary.valid === 0 || preflightSummary.valid > MAX_ROWS}
                onClick={handleProcessBatch}
                className="h-[34px] px-4 rounded-md bg-primary-container text-on-primary text-xs font-medium hover:bg-primary transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>Creating… {importProgress}%</span></>
                  : <span>Create {plural(preflightSummary.valid, 'link')}</span>}
              </button>
            </div>
          )}

          {importResult && (
            <div className={`p-3 rounded-md border-[0.5px] text-xs animate-fade-in ${
              importResult.failed === 0 && !importResult.skipped ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'
            }`}>
              <div className="flex items-center gap-1.5 font-medium text-on-surface">
                {importResult.failed === 0 && !importResult.skipped ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                <span>
                  {importResult.imported.toLocaleString()} {importResult.imported === 1 ? 'link' : 'links'} created
                  {importResult.failed > 0 && `, ${importResult.failed.toLocaleString()} failed`}
                  {(importResult.skipped || 0) > 0 && `, ${importResult.skipped} skipped (no valid URL)`}
                </span>
              </div>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-2 space-y-0.5 text-[11px] text-error max-h-24 overflow-y-auto">
                  {importResult.errors.slice(0, 5).map((err, i) => <div key={i}>{err.row > 0 ? `Row ${err.row}: ` : ''}{err.error}</div>)}
                  {importResult.errors.length > 5 && <div className="text-outline">+ {importResult.errors.length - 5} more</div>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export */}
        <div className="lg:col-span-5 rounded-xl border-[0.5px] border-outline-variant p-[15px]">
          <h2 className="text-[14px] font-semibold text-on-surface">Export CSV</h2>
          <div className="mt-2 flex flex-col">
            {EXPORTS.map(item => (
              <div key={item.id} className="flex items-center gap-[10px] py-2.5 border-b-[0.5px] border-outline-variant last:border-b-0">
                <div className="grid size-[32px] place-items-center rounded-md bg-surface-container text-on-surface-variant shrink-0">{item.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-on-surface">{item.label}</div>
                  <div className="text-[11px] text-outline truncate">{item.hint}</div>
                </div>
                <button
                  type="button"
                  onClick={item.onClick}
                  title={`Download ${item.label.toLowerCase()} CSV`}
                  aria-label={`Download ${item.label.toLowerCase()} CSV`}
                  className="size-[30px] rounded-md grid place-items-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* History */}
      <div className="rounded-xl border-[0.5px] border-outline-variant overflow-hidden">
        <div className="px-[15px] py-3 flex items-center justify-between gap-3 border-b-[0.5px] border-outline-variant">
          <h2 className="text-[14px] font-semibold text-on-surface">History</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
              <input
                type="text"
                placeholder="Search"
                aria-label="Search history"
                value={jobSearch}
                onChange={(e) => { setJobSearch(e.target.value); setJobPage(1); }}
                className="w-40 sm:w-52 h-[30px] pl-9 pr-3 bg-surface-container-low rounded-full text-xs font-light text-on-surface border-[0.5px] border-outline-variant placeholder:text-outline outline-none focus:border-on-surface-variant"
              />
            </div>
            <button
              type="button"
              onClick={fetchJobs}
              disabled={loadingJobs}
              title="Refresh"
              aria-label="Refresh history"
              className="size-[30px] rounded-md border-[0.5px] border-outline-variant grid place-items-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingJobs ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <p className="py-8 px-6 text-center text-xs text-on-surface-variant">
            {loadingJobs ? 'Loading…' : jobSearch ? 'Nothing matches.' : 'Imports and exports will show up here.'}
          </p>
        ) : (
          <>
            <table className="hidden md:table w-full text-left text-xs">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant border-b-[0.5px] border-outline-variant">
                  <th className="py-2.5 px-[15px] font-medium">Name</th>
                  <th className="py-2.5 px-3 font-medium">Type</th>
                  <th className="py-2.5 px-3 font-medium text-right">Rows</th>
                  <th className="py-2.5 px-3 font-medium">Result</th>
                  <th className="py-2.5 px-3 font-medium">When</th>
                  <th className="py-2.5 px-[15px] font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedJobs.map((job) => (
                  <tr key={job.id} className="border-b-[0.5px] border-outline-variant last:border-b-0">
                    <td className="py-2.5 px-[15px] max-w-[280px]">
                      <div className="font-medium text-on-surface truncate" title={job.batch_name}>{job.batch_name}</div>
                    </td>
                    <td className="py-2.5 px-3 text-on-surface-variant">
                      <span className="inline-flex items-center gap-1 capitalize">
                        {job.operation === 'import' ? <Upload className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                        {job.operation}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{job.total_rows.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-on-surface-variant whitespace-nowrap">{jobResult(job)}</td>
                    <td className="py-2.5 px-3 text-on-surface-variant whitespace-nowrap">{fmtWhen(job.created_at)}</td>
                    <td className="py-2.5 px-[15px]">{jobStatus(job)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="md:hidden flex flex-col">
              {paginatedJobs.map((job) => (
                <div key={job.id} className="p-[15px] flex flex-col gap-1 border-b-[0.5px] border-outline-variant last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-on-surface truncate">{job.batch_name}</span>
                    {jobStatus(job)}
                  </div>
                  <div className="text-[11px] text-outline">
                    <span className="capitalize">{job.operation}</span> · {job.total_rows.toLocaleString()} rows · {jobResult(job)} · {fmtWhen(job.created_at)}
                  </div>
                </div>
              ))}
            </div>

            {totalJobPages > 1 && (
              <div className="px-[15px] py-2.5 flex items-center justify-between gap-2 border-t-[0.5px] border-outline-variant text-xs text-on-surface-variant">
                <span>
                  {(jobPage - 1) * jobsPerPage + 1}–{Math.min(filteredJobs.length, jobPage * jobsPerPage)} of {filteredJobs.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={jobPage <= 1}
                    onClick={() => setJobPage(p => Math.max(1, p - 1))}
                    className="h-[28px] px-3 rounded-md border-[0.5px] border-outline-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={jobPage >= totalJobPages}
                    onClick={() => setJobPage(p => Math.min(totalJobPages, p + 1))}
                    className="h-[28px] px-3 rounded-md border-[0.5px] border-outline-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Notification Toast */}
      {mounted && toastMessage && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-6 right-6 bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2.5 transition-all duration-200 z-[100] animate-fade-in border-[0.5px] border-outline-variant text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>,
        document.body
      )}

    </div>
  );
};
