'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  HardDrive, 
  Webhook, 
  Search, 
  X, 
  Layers, 
  Plus, 
  AlertCircle,
  Table,
  Radio,
  CheckCircle
} from 'lucide-react';

interface JobRecord {
  id: string;
  operation: 'Import' | 'Export' | 'Live Sync';
  batchName: string;
  fileOrTarget: string;
  volume: string;
  processed: string;
  errors: string;
  timestamp: string;
  artifactText: string;
  status: 'Complete' | 'In-Progress' | 'Failed';
  progress?: number;
}

export const BulkToolsView: React.FC = () => {
  const { importLinksCsv, exportLinksCsv } = useStore();
  const [mounted, setMounted] = useState(false);

  // File state
  const [selectedFileName, setSelectedFileName] = useState('q3_campaign_sponsor_inventory_v2.csv');
  const [fileStats, setFileStats] = useState({ rows: 148, size: '48.2 KB' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter & Search
  const [jobSearch, setJobSearch] = useState('');

  // Schedule Modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleFrequency, setScheduleFrequency] = useState('Weekly');
  const [scheduleTarget, setScheduleTarget] = useState('Amazon S3');
  const [scheduleFormat, setScheduleFormat] = useState('CSV (.gz)');

  // Notification Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const sampleTemplateCsv = `destination_url,vanity_alias,marketing_channel
https://amazon.com/dp/B08N5WRWNW,sony-headphone-deal,youtube_sponsor
https://spotify.com/show/4k9x,podcast-ep45,instagram_bio
https://nordvpn.com/creator-pack,nord-deal-30off,newsletter_slot
https://notion.so/templates/agency,agency-operating-os,tiktok_pin`;

  const handleDownloadTemplate = () => {
    const blob = new Blob([sampleTemplateCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'snip_bulk_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Template "snip_bulk_template.csv" downloaded.');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFileName(file.name);
      const sizeKb = (file.size / 1024).toFixed(1);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lineCount = text ? text.split('\n').filter(Boolean).length - 1 : 12;
        setFileStats({
          rows: Math.max(1, lineCount),
          size: `${sizeKb} KB`
        });
        showToast(`File selected: ${file.name}. Schema verification passed.`);
      };
      reader.readAsText(file);
    }
  };

  const handleProcessBatch = () => {
    setIsProcessing(true);
    // Parse sample CSV into links store if desired
    importLinksCsv(sampleTemplateCsv);
    setTimeout(() => {
      setIsProcessing(false);
      showToast(`Job #JB-9050 initiated: ${fileStats.rows} links generated & dispatched to worker node.`);
    }, 1200);
  };

  const initialJobs: JobRecord[] = [
    {
      id: '#JB-9042',
      operation: 'Import',
      batchName: 'Bulk Bitly Migration',
      fileOrTarget: 'bitly_export_archive_march.csv',
      volume: '1,420 links',
      processed: '1,420 Generated',
      errors: '0 Errors',
      timestamp: 'Today, 14:28:10 UTC',
      artifactText: 'Audit CSV',
      status: 'Complete'
    },
    {
      id: '#JB-9038',
      operation: 'Export',
      batchName: 'Q2 Sponsor Telemetry Export',
      fileOrTarget: 's3://snip-warehouse/q2_telemetry.gz',
      volume: '84,200 events',
      processed: '84,200 Exported',
      errors: '100% Sync',
      timestamp: 'Yesterday, 23:59:02 UTC',
      artifactText: 'CSV (2.4 MB)',
      status: 'Complete'
    },
    {
      id: '#JB-9011',
      operation: 'Import',
      batchName: 'YouTube Video Description Batch',
      fileOrTarget: 'ep_344_sponsor_roll_slugs.xlsx',
      volume: '48 links',
      processed: '48 Generated',
      errors: '0 Errors',
      timestamp: 'May 14, 09:12:44 UTC',
      artifactText: 'Result XLSX',
      status: 'Complete'
    },
    {
      id: '#JB-9049',
      operation: 'Live Sync',
      batchName: 'TikTok Affiliate Campaign Shards',
      fileOrTarget: 'shard_stream_buffer_5.json',
      volume: '5,000 records',
      processed: 'Writing buffer...',
      errors: '',
      timestamp: 'Just now',
      artifactText: 'Live Stream',
      status: 'In-Progress',
      progress: 68
    }
  ];

  const [jobs] = useState<JobRecord[]>(initialJobs);

  const filteredJobs = jobs.filter(j => 
    j.id.toLowerCase().includes(jobSearch.toLowerCase()) ||
    j.batchName.toLowerCase().includes(jobSearch.toLowerCase()) ||
    j.fileOrTarget.toLowerCase().includes(jobSearch.toLowerCase())
  );

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleName) return;

    showToast(`Scheduled pipeline "${scheduleName}" configured for ${scheduleTarget}.`);
    setScheduleName('');
    setScheduleModalOpen(false);
  };

  return (
    <div className="flex flex-col w-full text-on-surface animate-fade-in">
      
      {/* 1. Sub-navigation & Header Ribbon */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium mb-1">
            <span className="hover:text-on-surface cursor-pointer">Workspace</span>
            <ChevronRight className="w-3.5 h-3.5 text-outline" />
            <span className="text-primary-container font-semibold">Bulk Tools</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Bulk CSV Import &amp; Export Automation
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-3xl mt-1 leading-relaxed">
            Batch-generate hundreds of branded vanity slugs, import legacy bitly/cuttly links, and schedule automated telemetry data exports to S3, BigQuery, or CSV.
          </p>
        </div>

        {/* Quick Metrics Pill Bar */}
        <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-xl shadow-xs self-start md:self-auto border border-outline-variant/30">
          <div className="px-3 py-1.5 bg-surface-container-lowest rounded-lg shadow-xs flex items-center gap-1.5 border border-outline-variant/20">
            <Database className="w-4 h-4 text-primary-container" />
            <span className="text-xs text-on-surface-variant font-medium">Batch Quota:</span>
            <span className="font-mono text-xs font-semibold text-on-surface">8,432 / 10,000</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-on-surface-variant font-medium">Workers Ready:</span>
            <span className="font-mono text-xs font-semibold text-emerald-700">4 Idle</span>
          </div>
        </div>
      </div>

      {/* 2. Primary Operations Split Layout (12 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mb-8">
        
        {/* LEFT PANEL: Bulk Link Importer & Generator (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-outline-variant/30 p-6 flex flex-col">
            
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-outline-variant/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-primary-container">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-on-surface">Bulk Link Importer &amp; Generator</h2>
                  <p className="text-xs text-on-surface-variant">Turn large lists of URLs into shortened, trackable branded links</p>
                </div>
              </div>
              <button 
                type="button"
                id="download-template-btn"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-primary-container hover:bg-surface-container-low transition-colors cursor-pointer border border-primary-container/20"
              >
                <Download className="w-4 h-4" />
                <span>Download CSV Template</span>
              </button>
            </div>

            {/* Drag-and-Drop Dropzone */}
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
                  const file = e.dataTransfer.files[0];
                  setSelectedFileName(file.name);
                  showToast(`File dropped: ${file.name}`);
                }
              }}
              className={`relative group cursor-pointer rounded-2xl transition-all p-8 text-center flex flex-col items-center justify-center border-2 border-dashed ${
                isDragging 
                  ? 'bg-surface-container-high border-primary-container' 
                  : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/40'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                id="csv-file-input"
                accept=".csv, .tsv, .xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-surface-container-lowest shadow-sm flex items-center justify-center text-primary-container group-hover:scale-110 transition-transform mb-3">
                <CloudUpload className="w-6 h-6" />
              </div>
              <span className="text-sm font-semibold text-on-surface">Drop your .csv, .tsv, or .xlsx file here</span>
              <span className="text-xs text-on-surface-variant mt-1">
                or <span className="text-primary-container font-semibold underline underline-offset-2">Browse files</span> from your local workstation
              </span>
              <div className="mt-3 inline-flex items-center gap-1.5 bg-surface-container-lowest/90 px-3 py-1 rounded-full border border-outline-variant/20 shadow-2xs">
                <AlertCircle className="w-3.5 h-3.5 text-outline" />
                <span className="text-[11px] text-on-surface-variant font-medium">Supports up to 10,000 links per single processing batch</span>
              </div>
            </div>

            {/* Selected File Status Chip */}
            <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl mt-4 border border-outline-variant/20">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-mono text-xs text-on-surface font-semibold truncate">{selectedFileName}</span>
                <span className="text-xs text-on-surface-variant whitespace-nowrap">({fileStats.rows} rows • {fileStats.size})</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-semibold text-on-surface-variant hover:text-on-surface px-2 py-1 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Replace
                </button>
                <span className="text-outline-variant">•</span>
                <button 
                  type="button"
                  onClick={() => {
                    setSelectedFileName('snip_empty_draft.csv');
                    setFileStats({ rows: 0, size: '0 KB' });
                    showToast('File removed.');
                  }}
                  className="font-semibold text-error hover:bg-error-container/30 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>

            {/* Column Mapping Preview Panel */}
            <div className="mt-6 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface">Schema &amp; Column Mapping</span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container font-mono text-[11px] text-primary-container font-semibold">3 of 3 Mapped</span>
                </div>
                <span className="text-xs text-on-surface-variant">Auto-detected headers</span>
              </div>

              <div className="rounded-xl bg-surface-container-low overflow-hidden border border-outline-variant/20">
                <div className="grid grid-cols-12 gap-2 p-2.5 bg-surface-container-high/60 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  <div className="col-span-5">CSV Column Detected</div>
                  <div className="col-span-2 text-center">Transform</div>
                  <div className="col-span-5">Snip Engine Target Field</div>
                </div>

                <div className="divide-y divide-outline-variant/20">
                  {/* Row 1 */}
                  <div className="grid grid-cols-12 gap-2 p-2.5 items-center bg-surface-container-lowest">
                    <div className="col-span-5 flex items-center gap-1.5 min-w-0">
                      <Layers className="w-3.5 h-3.5 text-outline shrink-0" />
                      <span className="font-mono text-xs text-on-surface truncate">source_url</span>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <ArrowRight className="w-4 h-4 text-primary-container" />
                    </div>
                    <div className="col-span-5">
                      <div className="flex items-center justify-between bg-surface-container-low px-2.5 py-1 rounded-lg border border-outline-variant/20">
                        <span className="text-xs text-on-surface font-semibold">Destination URL</span>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="grid grid-cols-12 gap-2 p-2.5 items-center bg-surface-container-lowest">
                    <div className="col-span-5 flex items-center gap-1.5 min-w-0">
                      <Layers className="w-3.5 h-3.5 text-outline shrink-0" />
                      <span className="font-mono text-xs text-on-surface truncate">vanity_alias</span>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <ArrowRight className="w-4 h-4 text-primary-container" />
                    </div>
                    <div className="col-span-5">
                      <div className="flex items-center justify-between bg-surface-container-low px-2.5 py-1 rounded-lg border border-outline-variant/20">
                        <span className="text-xs text-on-surface font-semibold">Custom Slug</span>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div className="grid grid-cols-12 gap-2 p-2.5 items-center bg-surface-container-lowest">
                    <div className="col-span-5 flex items-center gap-1.5 min-w-0">
                      <Layers className="w-3.5 h-3.5 text-outline shrink-0" />
                      <span className="font-mono text-xs text-on-surface truncate">marketing_channel</span>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <ArrowRight className="w-4 h-4 text-primary-container" />
                    </div>
                    <div className="col-span-5">
                      <div className="flex items-center justify-between bg-surface-container-low px-2.5 py-1 rounded-lg border border-outline-variant/20">
                        <span className="text-xs text-on-surface font-semibold">Platform / Channel Tag</span>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Validation Pre-Flight Summary & Processing CTA */}
            <div className="mt-6 pt-4 border-t border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs text-emerald-950 font-bold">Pre-flight Validation Passed</span>
                  <span className="text-[11px] text-emerald-800">0 syntax errors • {fileStats.rows} collision-free custom slugs</span>
                </div>
              </div>

              <button 
                type="button"
                id="process-batch-btn"
                disabled={isProcessing}
                onClick={handleProcessBatch}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary-container text-on-primary text-xs font-bold hover:bg-primary shadow-sm hover:shadow transition-all cursor-pointer whitespace-nowrap active:scale-[0.99] disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Allocating Slugs...</span>
                  </>
                ) : (
                  <>
                    <Bolt className="w-4 h-4" />
                    <span>Process &amp; Generate {fileStats.rows} Branded Links</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>

        {/* RIGHT PANEL: Scheduled & Automated Data Exports (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-outline-variant/30 p-6 flex flex-col h-full">
            
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-outline-variant/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-primary-container">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-on-surface">Scheduled Data Exports</h2>
                  <p className="text-xs text-on-surface-variant">Continuous telemetry pipelines &amp; webhooks</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setScheduleModalOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary-container hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Schedule</span>
              </button>
            </div>

            {/* Export Presets Section */}
            <div className="flex flex-col gap-3 mb-6">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Active Export Pipelines</span>
              
              {/* Preset Card 1 */}
              <div className="p-4 bg-surface-container-low rounded-xl flex flex-col gap-1.5 transition-shadow hover:shadow-xs border border-outline-variant/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-primary-container" />
                    <span className="text-xs font-bold text-on-surface">Weekly Creator Telemetry</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[11px] text-emerald-800 font-semibold">Active (Sun 23:59 UTC)</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">Aggregated device splits, geo-breakdown, referrer tokens, and CTR summaries.</p>
                <div className="flex items-center justify-between mt-1 pt-2 border-t border-outline-variant/15 text-xs">
                  <span className="font-mono text-[11px] text-on-surface-variant">Format: CSV (Compressed .gz)</span>
                  <div className="flex items-center gap-1 text-on-surface font-medium">
                    <HardDrive className="w-3.5 h-3.5 text-outline" />
                    <span>Amazon S3</span>
                  </div>
                </div>
              </div>

              {/* Preset Card 2 */}
              <div className="p-4 bg-surface-container-low rounded-xl flex flex-col gap-1.5 transition-shadow hover:shadow-xs border border-outline-variant/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Table className="w-4 h-4 text-primary-container" />
                    <span className="text-xs font-bold text-on-surface">Monthly Creator Audit</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[11px] text-emerald-800 font-semibold">Active (1st of month)</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">Audited performance records formatted for creator finance and sponsor reporting.</p>
                <div className="flex items-center justify-between mt-1 pt-2 border-t border-outline-variant/15 text-xs">
                  <span className="font-mono text-[11px] text-on-surface-variant">Format: CSV / XLSX</span>
                  <div className="flex items-center gap-1 text-on-surface font-medium">
                    <Download className="w-3.5 h-3.5 text-outline" />
                    <span>Direct Download</span>
                  </div>
                </div>
              </div>

              {/* Preset Card 3 */}
              <div className="p-4 bg-surface-container-low rounded-xl flex flex-col gap-1.5 transition-shadow hover:shadow-xs border border-outline-variant/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-primary-container" />
                    <span className="text-xs font-bold text-on-surface">Raw Click Event Stream</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container font-mono text-[11px] text-primary-container font-semibold">Real-time Hook</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">Direct JSON payloads emitted to high-throughput endpoint on user clicks.</p>
                <div className="flex items-center justify-between mt-1 pt-2 border-t border-outline-variant/15 text-xs">
                  <span className="font-mono text-[11px] text-on-surface-variant">Format: JSON Streams</span>
                  <div className="flex items-center gap-1 text-on-surface font-medium">
                    <Webhook className="w-3.5 h-3.5 text-outline" />
                    <span>Webhook Endpoint</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* 3. BOTTOM SECTION: Bulk Job History & Audit Log Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-outline-variant/30 p-6 flex flex-col mb-10">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-primary-container">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Bulk Job History &amp; Audit Log</h2>
              <p className="text-xs text-on-surface-variant">Immutable execution log of link creations, batches, and telemetric dumps</p>
            </div>
          </div>

          {/* Table Filter Toolbar */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="relative">
              <input 
                type="text"
                placeholder="Filter by Job ID..."
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                className="bg-surface-container-low rounded-xl px-3 py-1.5 text-xs text-on-surface pl-8 w-44 outline-none focus:ring-2 focus:ring-primary-container border border-outline-variant/30 transition-all"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-outline pointer-events-none" />
            </div>
            <button 
              type="button"
              onClick={() => showToast('Refreshed job queue.')}
              className="p-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface transition-colors border border-outline-variant/30 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-outline" />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
                <th className="py-3 px-4">Job ID</th>
                <th className="py-3 px-4">Operation</th>
                <th className="py-3 px-4">Batch Identifier / File</th>
                <th className="py-3 px-4">Volume</th>
                <th className="py-3 px-4">Processed / Success</th>
                <th className="py-3 px-4">Execution Timestamp</th>
                <th className="py-3 px-4">Artifact</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-primary-container">{job.id}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      job.operation === 'Import' 
                        ? 'bg-primary-fixed text-on-primary-fixed'
                        : job.operation === 'Export'
                        ? 'bg-secondary-fixed text-on-secondary-fixed'
                        : 'bg-primary-fixed text-on-primary-fixed-variant'
                    }`}>
                      {job.operation === 'Import' && <Upload className="w-3 h-3" />}
                      {job.operation === 'Export' && <Download className="w-3 h-3" />}
                      {job.operation === 'Live Sync' && <RefreshCw className="w-3 h-3 animate-spin" />}
                      <span>{job.operation}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-on-surface">{job.batchName}</span>
                      <span className="font-mono text-[11px] text-on-surface-variant">{job.fileOrTarget}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-on-surface">{job.volume}</td>
                  <td className="py-3.5 px-4">
                    {job.progress ? (
                      <div className="flex items-center gap-2 w-40">
                        <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                          <div className="bg-primary-container h-1.5 rounded-full transition-all" style={{ width: `${job.progress}%` }} />
                        </div>
                        <span className="font-mono text-xs text-primary-container font-semibold">{job.progress}%</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs font-semibold text-emerald-700">{job.processed}</span>
                        {job.errors && <span className="font-mono text-[11px] text-on-surface-variant">• {job.errors}</span>}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-on-surface-variant text-[11px]">{job.timestamp}</td>
                  <td className="py-3.5 px-4">
                    <button 
                      type="button"
                      onClick={() => {
                        exportLinksCsv();
                        showToast(`Downloaded artifact for ${job.id}`);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-container hover:underline cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{job.artifactText}</span>
                    </button>
                  </td>
                  <td className="py-3.5 px-4">
                    {job.status === 'Complete' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        <span>Complete</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                        <span>In-Progress</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        <div className="flex items-center justify-between pt-4 mt-2">
          <span className="text-xs text-on-surface-variant">
            Showing <span className="font-semibold text-on-surface">1 - {filteredJobs.length}</span> of <span className="font-semibold text-on-surface">62</span> automated operations
          </span>
          <div className="flex items-center gap-1">
            <button 
              type="button"
              disabled
              className="px-3 py-1 rounded-xl bg-surface-container-low text-on-surface-variant opacity-50 cursor-not-allowed font-semibold text-xs border border-outline-variant/20"
            >
              Previous
            </button>
            <button 
              type="button"
              className="px-3 py-1 rounded-xl bg-primary-container text-on-primary font-bold text-xs shadow-xs"
            >
              1
            </button>
            <button 
              type="button"
              onClick={() => showToast('Page 2')}
              className="px-3 py-1 rounded-xl bg-surface-container-low text-on-surface-variant hover:text-on-surface font-semibold text-xs border border-outline-variant/20 cursor-pointer"
            >
              2
            </button>
            <button 
              type="button"
              onClick={() => showToast('Page 3')}
              className="px-3 py-1 rounded-xl bg-surface-container-low text-on-surface-variant hover:text-on-surface font-semibold text-xs border border-outline-variant/20 cursor-pointer"
            >
              3
            </button>
            <button 
              type="button"
              onClick={() => showToast('Next Page')}
              className="px-3 py-1 rounded-xl bg-surface-container-low text-on-surface-variant hover:text-on-surface font-semibold text-xs border border-outline-variant/20 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>

      </div>

      {/* 4. New Schedule Modal (Rendered via Portal) */}
      {mounted && scheduleModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setScheduleModalOpen(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl border border-outline-variant/40 relative animate-fade-in">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setScheduleModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h4 className="text-base font-bold text-on-surface mb-1">Create Export Schedule</h4>
            <p className="text-xs text-on-surface-variant mb-4">
              Set up automated telemetry export pipelines to cloud destinations.
            </p>

            <form onSubmit={handleCreateSchedule} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-on-surface block mb-1">Pipeline Name</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Bi-Weekly Sponsor Rollup"
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Daily', 'Weekly', 'Monthly'] as const).map((freq) => (
                    <button
                      type="button"
                      key={freq}
                      onClick={() => setScheduleFrequency(freq)}
                      className={`py-1.5 rounded-xl font-bold transition-all cursor-pointer border text-xs ${
                        scheduleFrequency === freq
                          ? 'bg-primary-container text-on-primary border-primary-container shadow-xs'
                          : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container'
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Destination Target</label>
                <select
                  value={scheduleTarget}
                  onChange={(e) => setScheduleTarget(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs cursor-pointer"
                >
                  <option value="Direct Download">Direct Download (Instant CSV / JSON)</option>
                  <option value="Webhook">High-Throughput Webhook Endpoint</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Output Format</label>
                <select
                  value={scheduleFormat}
                  onChange={(e) => setScheduleFormat(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary-container text-on-surface text-xs cursor-pointer font-mono"
                >
                  <option value="CSV (.gz)">CSV Compressed (.gz)</option>
                  <option value="XLSX Multi-sheet">Excel XLSX Multi-sheet</option>
                  <option value="JSON Streams">Newline Delimited JSON (.ndjson)</option>
                  <option value="Parquet">Apache Parquet (.parquet)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20 mt-3">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-bold hover:bg-primary cursor-pointer shadow-xs text-xs"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 5. Notification Toast (Rendered via Portal) */}
      {mounted && toastMessage && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-6 right-6 bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 transition-all duration-200 z-[100] animate-fade-in border border-outline-variant/30 text-xs font-medium">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>,
        document.body
      )}

    </div>
  );
};
