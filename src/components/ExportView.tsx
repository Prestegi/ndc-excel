import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import type { PersonRecord, ReviewLogItem } from '../types';
import { generateNdcAgentExcel } from '../utils/excelExport';

interface ExportViewProps {
  records: PersonRecord[];
  reviewLogs: ReviewLogItem[];
  currentUserEmail?: string;
}

export const ExportView: React.FC<ExportViewProps> = ({
  records,
  reviewLogs,
  currentUserEmail,
}) => {
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [onlyApproved, setOnlyApproved] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [unreviewedAcknowledged, setUnreviewedAcknowledged] = useState(false);

  const approvedRecords = records.filter((r) => r.reviewStatus === 'approved');
  const pendingRecords = records.filter((r) => r.reviewStatus !== 'approved');

  const recordsToExport = onlyApproved ? approvedRecords : records;
  const isExportDisabled =
    isExporting ||
    recordsToExport.length === 0 ||
    (!onlyApproved && pendingRecords.length > 0 && !unreviewedAcknowledged);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setLogoBase64(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDownloadExcel = async () => {
    if (recordsToExport.length === 0) {
      alert('No approved records available. Please review and approve records before exporting.');
      return;
    }

    try {
      setIsExporting(true);
      const blob = await generateNdcAgentExcel({
        records: recordsToExport,
        reviewLogs,
        logoBase64: logoBase64 || undefined,
        batchName: 'NDC_Accredited_Agents_Register',
        onlyApproved,
      });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NDC_Agent_Register_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate Excel:', err);
      alert('Failed to generate Excel workbook: ' + String(err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-900 to-[#0B3C5D] p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-400/30">
                ExcelJS Powered
              </span>
              <span className="text-xs text-blue-200">Real Embedded Images</span>
            </div>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight">
              Export Formatted NDC Agent Register (.xlsx)
            </h2>
            <p className="mt-1 text-xs text-blue-100 max-w-xl">
              Generates an Excel workbook with embedded passport photographs, blue headers, borders, wrapped text, frozen panes, and text-formatted identifiers to retain leading zeros.
            </p>
          </div>

          <button
            onClick={handleDownloadExcel}
            disabled={isExportDisabled}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg hover:bg-emerald-400 disabled:opacity-50 transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            {isExporting
              ? 'Generating Workbook...'
              : recordsToExport.length === 0
              ? 'No Approved Records'
              : `Download Workbook (${recordsToExport.length})`}
          </button>
        </div>
      </div>

      {/* Review Gate Notice */}
      {pendingRecords.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">
              {pendingRecords.length} Record{pendingRecords.length > 1 ? 's' : ''} Still Pending Manual Review
            </div>
            <p className="text-amber-800">
              Per requirements, extracted handwriting and photos must be reviewed in the workbench before final distribution. Only approved records will be included in the accredited agents workbook.
            </p>
          </div>
        </div>
      )}

      {/* Two Column Layout: Settings & Sheet Structure Preview */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left: Configuration & NDC Logo Upload */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900">Export Settings &amp; Review Gate</h3>

          {/* Filter options */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Record Inclusion</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="exportFilter"
                  checked={onlyApproved}
                  onChange={() => setOnlyApproved(true)}
                  className="text-blue-600"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-800">
                    Approved Records Only ({approvedRecords.length})
                  </div>
                  <div className="text-slate-500">
                    Strict Requirement: Guarantees every candidate was manually verified
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="exportFilter"
                  checked={!onlyApproved}
                  onChange={() => setOnlyApproved(false)}
                  className="text-blue-600"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-800">
                    Export All Scanned Records ({records.length})
                  </div>
                  <div className="text-slate-500">
                    Includes pending records; requires manual override confirmation
                  </div>
                </div>
              </label>
            </div>

            {!onlyApproved && pendingRecords.length > 0 && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 mt-2">
                <label className="flex items-start gap-2 cursor-pointer text-xs text-rose-900">
                  <input
                    type="checkbox"
                    checked={unreviewedAcknowledged}
                    onChange={(e) => setUnreviewedAcknowledged(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-rose-300 text-rose-600"
                  />
                  <span>
                    <strong>Review Override:</strong> I acknowledge that {pendingRecords.length} records have not yet been manually audited and may contain OCR handwriting ambiguities.
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* NDC Logo Insertion */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Optional Party Logo (NDC Emblem)
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              Upload an authentic NDC logo (PNG/JPG) to embed at the top of the workbook.
            </p>

            <div className="flex items-center gap-3">
              {logoBase64 ? (
                <div className="relative flex h-14 w-14 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 p-1">
                  <img src={logoBase64} alt="NDC Logo" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}

              <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition">
                <Upload className="mr-1.5 inline h-3.5 w-3.5" />
                {logoBase64 ? 'Change Logo' : 'Upload NDC Logo'}
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>

              {logoBase64 && (
                <button
                  onClick={() => setLogoBase64(null)}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Structure of Generated Sheets */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900">Workbook Structure (3 Sheets)</h3>

          <div className="space-y-3 text-xs">
            {/* Sheet 1 */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
              <div className="flex items-center justify-between font-bold text-blue-900">
                <span className="flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-blue-700" />
                  Sheet 1: NDC Agents Register
                </span>
                <span className="rounded bg-blue-200 px-1.5 py-0.2 text-[10px] text-blue-800">
                  Main Register
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600">
                Columns in exact specified order:
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1 font-mono text-[10px]">
                {[
                  'S/N',
                  'Name',
                  'Membership Card No.',
                  'Ward',
                  'Polling Unit',
                  'Phone No.',
                  'Voter’s Card No.',
                  'Passport Photograph',
                ].map((col, i) => (
                  <span key={i} className="rounded bg-white px-1.5 py-0.5 border border-slate-200 text-slate-700">
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {/* Sheet 2 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-slate-600" />
                  Sheet 2: Additional Details
                </span>
                <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] text-slate-700">
                  Metadata
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600">
                Captures State, LGA, Collation Checkboxes, Designation Role, Source File, Page No., and System Flags.
              </p>
            </div>

            {/* Sheet 3 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  Sheet 3: Review Log &amp; Audit Trail
                </span>
                <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] text-slate-700">
                  Audit Trail
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600">
                Preserves timestamps, previous values, corrected values, and reviewer identity.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
