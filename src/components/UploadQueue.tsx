import React, { useState, useRef } from 'react';
import {
  Upload,
  Camera,
  FileText,
  AlertCircle,
  Play,
  RotateCw,
  Sparkles,
  Zap,
  CheckCircle,
  FileSpreadsheet,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { processUploadedFile } from '../utils/pdfUtils';
import type { ScannedPageQueueItem, BatchStats } from '../types';

interface UploadQueueProps {
  queue: ScannedPageQueueItem[];
  stats: BatchStats;
  isProcessing: boolean;
  onAddPagesToQueue: (pages: ScannedPageQueueItem[]) => void;
  onStartProcessing: () => void;
  onRetryFailed: () => void;
  onLoadOfficialSample: () => void;
  onSimulateLargeBatch: (pageCount: number) => void;
}

export const UploadQueue: React.FC<UploadQueueProps> = ({
  queue,
  stats,
  isProcessing,
  onAddPagesToQueue,
  onStartProcessing,
  onRetryFailed,
  onLoadOfficialSample,
  onSimulateLargeBatch,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadNotice('Reading and parsing scanned pages...');

    const newPages: ScannedPageQueueItem[] = [];
    const batchId = `batch_${Date.now()}`;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 50 * 1024 * 1024) {
        alert(`File ${file.name} exceeds 50MB limit.`);
        continue;
      }

      try {
        const pages = await processUploadedFile(file);
        pages.forEach((p, idx) => {
          newPages.push({
            id: `page_${Date.now()}_${i}_${idx}`,
            batchId,
            pageNumber: p.pageNumber,
            fileName: p.fileName,
            dataUrl: p.dataUrl,
            status: 'queued',
          });
        });
      } catch (err) {
        console.error('Error parsing file:', file.name, err);
        setUploadNotice(`Failed to parse ${file.name}`);
      }
    }

    if (newPages.length > 0) {
      onAddPagesToQueue(newPages);
      setUploadNotice(`Added ${newPages.length} scanned page(s) to processing queue.`);
      setTimeout(() => setUploadNotice(null), 4000);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const uncompletedCount = queue.filter((p) => p.status === 'queued' || p.status === 'failed').length;

  return (
    <div className="space-y-4">
      {/* Batch Stats KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Queued Pages</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{stats.queued}</div>
          <div className="text-[11px] text-slate-400">Waiting for OCR</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Processing</span>
            <RotateCw className={`h-4 w-4 text-indigo-500 ${isProcessing ? 'animate-spin' : ''}`} />
          </div>
          <div className="mt-1 text-2xl font-bold text-indigo-600">{stats.processing}</div>
          <div className="text-[11px] text-slate-400">Active worker tasks</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Needs Review</span>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{stats.needsReview}</div>
          <div className="text-[11px] text-slate-400">Pending human audit</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Approved</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{stats.approved}</div>
          <div className="text-[11px] text-slate-400">Ready for Excel export</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Failed Pages</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-1 text-2xl font-bold text-rose-600">{stats.failed}</div>
          <div className="text-[11px] text-slate-400">Eligible for retry</div>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
          isDragging
            ? 'border-blue-600 bg-blue-50/70'
            : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50'
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 mb-3">
          <Upload className="h-6 w-6" />
        </div>

        <h3 className="text-sm font-bold text-slate-900">
          Upload Scanned NDC Agent Data Collection Forms
        </h3>
        <p className="mt-1 text-xs text-slate-500 max-w-lg">
          Drag &amp; drop multipage <strong>PDF, JPG, or PNG</strong> files here, or use the camera to scan pages directly. Queue handles up to <strong>1,000 scanned pages</strong> per batch.
        </p>

        {/* Buttons: Browse & Camera */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFiles(e.target.files)}
            multiple
            accept=".pdf,image/jpeg,image/png"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition"
          >
            <FileText className="h-4 w-4" />
            Select Files (PDF/Images)
          </button>

          <input
            type="file"
            ref={cameraInputRef}
            onChange={(e) => handleFiles(e.target.files)}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <Camera className="h-4 w-4 text-slate-600" />
            Phone Camera Scan
          </button>

          <button
            onClick={onLoadOfficialSample}
            className="flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
            title="Load 3-section NDC simulated reference form (2 photos + 1 blank box)"
          >
            <Sparkles className="h-4 w-4 text-emerald-600" />
            Load Demo Form (Simulated)
          </button>

          <button
            onClick={() => onSimulateLargeBatch(1000)}
            className="flex items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50/60 px-3.5 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 transition"
            title="Simulate 1,000 page batch queue without incurring live OCR charges"
          >
            <Zap className="h-4 w-4 text-indigo-600" />
            Simulate 1,000-Page Queue
          </button>
        </div>

        <div className="mt-3 text-[11px] text-slate-400">
          Max file size: 50MB per scan &bull; Supports leading zero preservation &bull; Permanent photo ID binding
        </div>

        {uploadNotice && (
          <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-800">
            {uploadNotice}
          </div>
        )}
      </div>

      {/* Processing Queue Action Bar */}
      {queue.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-700">
                {queue.length}
              </span>
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Batch Queue Status: {isProcessing ? 'Processing in progress...' : `${uncompletedCount} page(s) pending`}
                </div>
                <p className="text-[11px] text-slate-500">
                  Processing occurs sequentially through the worker queue with deduplication and failure retry guards.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {stats.failed > 0 && !isProcessing && (
                <button
                  onClick={onRetryFailed}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Retry Failed ({stats.failed})
                </button>
              )}

              <button
                onClick={() => {
                  if (uncompletedCount > 10) {
                    setShowConfirmModal(true);
                  } else {
                    onStartProcessing();
                  }
                }}
                disabled={isProcessing || uncompletedCount === 0}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" />
                    Processing Queue...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Process {uncompletedCount} Page{uncompletedCount > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Queue Item Breakdown List */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
              <span>Scanned Pages in Queue</span>
              <span>Status</span>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
              {queue.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 px-1">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-800 truncate max-w-sm">{item.fileName}</span>
                    <span className="text-[11px] text-slate-400">p.{item.pageNumber}</span>
                  </div>

                  <div>
                    {item.status === 'queued' && (
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        Queued
                      </span>
                    )}
                    {item.status === 'processing' && (
                      <span className="flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                        <RotateCw className="h-3 w-3 animate-spin" /> Extracting OCR...
                      </span>
                    )}
                    {item.status === 'done' && (
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        Completed ({item.personCount || 0} agents)
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <div className="text-right">
                        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                          Failed
                        </span>
                        {item.errorMessage && (
                          <p className="text-[10px] text-rose-600 max-w-xs truncate">{item.errorMessage}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Large Live OCR Batches */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h4 className="text-base font-bold text-slate-900">Confirm Live Batch Processing</h4>
            <p className="mt-2 text-xs text-slate-600">
              You are about to process <strong className="text-slate-900">{uncompletedCount} scanned pages</strong> using the server-side Gemini Vision OCR engine.
            </p>
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              Estimated sections: ~{uncompletedCount * 3} candidate records.
              Leading zeros and passport photos will be preserved.
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  onStartProcessing();
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                Confirm &amp; Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
