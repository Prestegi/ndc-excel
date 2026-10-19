import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Image as ImageIcon,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  History,
} from 'lucide-react';
import type { PersonRecord } from '../types';
import { cropImageFromBox, loadImage } from '../utils/cropUtils';

interface ReviewModalProps {
  record: PersonRecord | null;
  allRecords: PersonRecord[];
  onClose: () => void;
  onSaveRecord: (updatedRecord: PersonRecord, logAction?: string) => void;
  onSelectRecord: (record: PersonRecord) => void;
  currentUserEmail?: string;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  record,
  allRecords,
  onClose,
  onSaveRecord,
  onSelectRecord,
  currentUserEmail = 'Reviewer',
}) => {
  if (!record) return null;

  const [formData, setFormData] = useState<PersonRecord>({ ...record });
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showFullPage, setShowFullPage] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'fields' | 'photo' | 'history'>('fields');
  const [rotation, setRotation] = useState<number>(record.passportRotation || 0);

  // Sync state when record changes
  useEffect(() => {
    setFormData({ ...record });
    setRotation(record.passportRotation || 0);
  }, [record.id]);

  const currentIndex = allRecords.findIndex((r) => r.id === record.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < allRecords.length - 1;

  const handleFieldChange = (field: keyof PersonRecord, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRotate = async (deltaDegrees: number) => {
    const newRot = (rotation + deltaDegrees + 360) % 360;
    setRotation(newRot);

    // If source full page is available, re-crop with rotation
    if (formData.sourceFullPageUrl && formData.passportBox) {
      try {
        const img = await loadImage(formData.sourceFullPageUrl);
        const newCrop = cropImageFromBox(img, formData.passportBox, newRot);
        setFormData((prev) => ({
          ...prev,
          passportPhotoUrl: newCrop,
          passportRotation: newRot,
        }));
      } catch (err) {
        console.warn('Re-cropping with rotation failed:', err);
      }
    }
  };

  const handleApprove = () => {
    const updated: PersonRecord = {
      ...formData,
      reviewStatus: 'approved',
      reviewedBy: currentUserEmail,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveRecord(updated, 'Record Approved');
    if (hasNext) {
      onSelectRecord(allRecords[currentIndex + 1]);
    } else {
      onClose();
    }
  };

  const handleFlag = (reason: string) => {
    const updated: PersonRecord = {
      ...formData,
      reviewStatus: 'flagged',
      flags: Array.from(new Set([...formData.flags, reason])),
      reviewedBy: currentUserEmail,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveRecord(updated, `Flagged: ${reason}`);
  };

  const handleSaveEdits = () => {
    // Determine which fields changed to append to correction history
    const changes: PersonRecord['correctionHistory'] = [...formData.correctionHistory];
    const original = allRecords.find((r) => r.id === record.id);

    if (original) {
      const trackableKeys: (keyof PersonRecord)[] = [
        'name',
        'membershipNo',
        'ward',
        'pollingUnit',
        'phoneNo',
        'votersCardNo',
        'state',
        'lga',
      ];

      trackableKeys.forEach((key) => {
        if (formData[key] !== original[key]) {
          changes.push({
            field: key,
            oldValue: String(original[key] || ''),
            newValue: String(formData[key] || ''),
            changedAt: new Date().toLocaleString(),
            changedBy: currentUserEmail,
          });
        }
      });
    }

    const updated: PersonRecord = {
      ...formData,
      correctionHistory: changes,
      updatedAt: new Date().toISOString(),
    };

    onSaveRecord(updated, 'Manual Edits Saved');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="flex h-[94vh] w-full max-w-7xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-sm font-bold text-white">
              {currentIndex + 1}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{formData.name || 'Unnamed Agent'}</h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    formData.reviewStatus === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : formData.reviewStatus === 'flagged'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {formData.reviewStatus.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Source: {formData.sourceFileName} (Page {formData.pageNumber}, Section {formData.sectionIndex + 1}) | Record ID: {formData.id.slice(0, 8)}
              </p>
            </div>
          </div>

          {/* Quick Navigation and Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => hasPrev && onSelectRecord(allRecords[currentIndex - 1])}
              disabled={!hasPrev}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-40"
              title="Previous Record"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="text-xs text-slate-500 font-medium">
              {currentIndex + 1} of {allRecords.length}
            </span>
            <button
              onClick={() => hasNext && onSelectRecord(allRecords[currentIndex + 1])}
              disabled={!hasNext}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-40"
              title="Next Record"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="ml-2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Warning Flags Bar */}
        {formData.flags.length > 0 && (
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="font-semibold">Review Alerts:</span>
            <div className="flex flex-wrap gap-1.5">
              {formData.flags.map((flag, idx) => (
                <span
                  key={idx}
                  className="rounded-md bg-amber-200/70 px-2 py-0.5 font-medium text-amber-900"
                >
                  {flag.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Main Body: Side-by-Side (Source Document Left, Fields Right) */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12">
          {/* LEFT: Source Document Inspector */}
          <div className="relative flex flex-col border-r border-slate-200 bg-slate-900 p-4 lg:col-span-6 overflow-hidden">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
              <span className="font-medium text-slate-200">
                {showFullPage ? 'Full Scanned Page View' : 'Extracted Section Crop'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFullPage(!showFullPage)}
                  className="flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-slate-300 hover:bg-slate-700"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  {showFullPage ? 'Show Section Only' : 'Show Full Page'}
                </button>
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                  className="rounded bg-slate-800 p-1 text-slate-300 hover:bg-slate-700"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="text-[11px] text-slate-400">{Math.round(zoomLevel * 100)}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3.0, z + 0.2))}
                  className="rounded bg-slate-800 p-1 text-slate-300 hover:bg-slate-700"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Document Image Viewer with Pan & Zoom */}
            <div className="relative flex-1 overflow-auto rounded-lg border border-slate-800 bg-black/40 flex items-center justify-center p-2">
              {showFullPage && formData.sourceFullPageUrl ? (
                <img
                  src={formData.sourceFullPageUrl}
                  alt="Full Scan Page"
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                  className="max-w-full transition-transform duration-150"
                />
              ) : formData.sectionSnippetUrl ? (
                <img
                  src={formData.sectionSnippetUrl}
                  alt="Extracted Section Crop"
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                  className="max-w-full rounded shadow transition-transform duration-150"
                />
              ) : formData.sourceFullPageUrl ? (
                <img
                  src={formData.sourceFullPageUrl}
                  alt="Source Scan"
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                  className="max-w-full transition-transform duration-150"
                />
              ) : (
                <div className="text-center text-slate-500 text-sm">
                  <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  Original scan snippet not loaded
                </div>
              )}
            </div>

            {/* Passport Photo Preview inside Source Viewer */}
            <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-800/80 p-3">
              <div className="flex items-center gap-3">
                <div className="relative flex h-16 w-14 items-center justify-center overflow-hidden rounded border border-slate-600 bg-slate-950">
                  {formData.hasPassportPhoto && formData.passportPhotoUrl ? (
                    <img
                      src={formData.passportPhotoUrl}
                      alt="Crop Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-center text-slate-400 font-semibold px-1">
                      NO PHOTO
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    {formData.hasPassportPhoto ? 'Passport Photo Crop' : 'Empty Passport Box'}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {formData.hasPassportPhoto
                      ? 'Original crop bound to Record ID'
                      : 'Marked missing from original paper scan'}
                  </p>
                </div>
              </div>

              {formData.hasPassportPhoto && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleRotate(-90)}
                    className="flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600"
                    title="Rotate 90° counter-clockwise"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> -90°
                  </button>
                  <button
                    onClick={() => handleRotate(90)}
                    className="flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600"
                    title="Rotate 90° clockwise"
                  >
                    <RotateCw className="h-3.5 w-3.5" /> +90°
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Editable Extracted Fields & Controls */}
          <div className="flex flex-col bg-white lg:col-span-6 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 px-6 pt-3">
              <button
                onClick={() => setActiveTab('fields')}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'fields'
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Extracted Fields
              </button>
              <button
                onClick={() => setActiveTab('photo')}
                className={`ml-6 pb-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'photo'
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Passport Photo Management
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`ml-6 pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="h-3.5 w-3.5" />
                Review Log ({formData.correctionHistory?.length || 0})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {activeTab === 'fields' && (
                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Full Name (in exact written order)
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-hidden"
                      placeholder="e.g. Kofi Emmanuel Mensah"
                    />
                  </div>

                  {/* Membership No & Phone No */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Membership Card No. <span className="text-slate-400 font-normal">(Preserve 0s)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.membershipNo}
                        onChange={(e) => handleFieldChange('membershipNo', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-hidden"
                        placeholder="e.g. 020491823"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Phone Number <span className="text-slate-400 font-normal">(Preserve 0s)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.phoneNo}
                        onChange={(e) => handleFieldChange('phoneNo', e.target.value)}
                        className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-hidden ${
                          formData.phoneNo && !formData.phoneNo.startsWith('0')
                            ? 'border-amber-400 bg-amber-50/50 text-slate-900'
                            : 'border-slate-300 text-slate-900 focus:border-blue-600'
                        }`}
                        placeholder="e.g. 0244192834"
                      />
                    </div>
                  </div>

                  {/* Ward & Polling Unit */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Ward
                      </label>
                      <input
                        type="text"
                        value={formData.ward}
                        onChange={(e) => handleFieldChange('ward', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden"
                        placeholder="e.g. Ayawaso Central 04"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Polling Unit Code &amp; Name
                      </label>
                      <input
                        type="text"
                        value={formData.pollingUnit}
                        onChange={(e) => handleFieldChange('pollingUnit', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden"
                        placeholder="e.g. PU-01029 Kotobabi Basic School"
                      />
                    </div>
                  </div>

                  {/* Voter's Card No */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Voter's Card Number (Voter ID)
                    </label>
                    <input
                      type="text"
                      value={formData.votersCardNo}
                      onChange={(e) => handleFieldChange('votersCardNo', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-hidden"
                      placeholder="e.g. 9182736450"
                    />
                  </div>

                  {/* State / Region & LGA */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        State / Region
                      </label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => handleFieldChange('state', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden"
                        placeholder="e.g. Greater Accra"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        LGA / Constituency
                      </label>
                      <input
                        type="text"
                        value={formData.lga}
                        onChange={(e) => handleFieldChange('lga', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden"
                        placeholder="e.g. Ayawaso Central"
                      />
                    </div>
                  </div>

                  {/* Collation Agent Role & Checkbox */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isCollationAgent}
                        onChange={(e) => handleFieldChange('isCollationAgent', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        Designated as Collation Agent on Form
                      </span>
                    </label>

                    <div className="mt-2">
                      <input
                        type="text"
                        value={formData.collationAgentRole}
                        onChange={(e) => handleFieldChange('collationAgentRole', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-hidden"
                        placeholder="Role Designation (e.g. Polling Station Agent, Constituency Agent)"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'photo' && (
                <div className="space-y-5">
                  <div className="flex items-start gap-4 rounded-xl border border-slate-200 p-4">
                    <div className="relative flex h-28 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-slate-100">
                      {formData.hasPassportPhoto && formData.passportPhotoUrl ? (
                        <img
                          src={formData.passportPhotoUrl}
                          alt="Passport Crop"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-center text-xs font-semibold text-slate-400">
                          NO PHOTO
                        </span>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        Passport Photograph Verification
                      </h4>
                      <p className="text-xs text-slate-600">
                        Per NDC guidelines, original crops must come directly from the scan without artificial retouching, face synthesis, or aspect ratio distortion.
                      </p>

                      <label className="flex items-center gap-2 pt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!formData.hasPassportPhoto}
                          onChange={(e) => {
                            const isBlank = e.target.checked;
                            setFormData((prev) => ({
                              ...prev,
                              hasPassportPhoto: !isBlank,
                              passportPhotoUrl: isBlank ? undefined : prev.passportPhotoUrl,
                              flags: isBlank
                                ? Array.from(new Set([...prev.flags, 'missing_photo']))
                                : prev.flags.filter((f) => f !== 'missing_photo'),
                            }));
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-semibold text-slate-800">
                          Confirm passport photo box was BLANK on paper form (Missing Photo)
                        </span>
                      </label>
                    </div>
                  </div>

                  {formData.hasPassportPhoto && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-slate-700 uppercase">Crop Alignment &amp; Border Trimming</h5>
                        <span className="text-[10px] text-slate-500 font-medium">Rotation: {rotation}°</span>
                      </div>

                      {/* Rotation Controls */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleRotate(-90)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <RotateCcw className="h-4 w-4" /> Rotate -90°
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotate(90)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <RotateCw className="h-4 w-4" /> Rotate +90°
                        </button>
                      </div>

                      {/* Crop Border Trimming (Trim surrounding form lines) */}
                      <div className="pt-2 border-t border-slate-200">
                        <div className="text-[11px] font-semibold text-slate-700 mb-1.5">
                          Trim Surrounding Form Borders / Lines:
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!formData.sourceFullPageUrl || !formData.passportBox) return;
                              const box = { ...formData.passportBox, ymin: Math.min(formData.passportBox.ymax - 20, formData.passportBox.ymin + 10) };
                              const img = await loadImage(formData.sourceFullPageUrl);
                              const newCrop = cropImageFromBox(img, box, rotation, 0);
                              setFormData((prev) => ({ ...prev, passportBox: box, passportPhotoUrl: newCrop }));
                            }}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-100 text-[11px]"
                          >
                            Trim Top Border (+1%)
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!formData.sourceFullPageUrl || !formData.passportBox) return;
                              const box = { ...formData.passportBox, ymax: Math.max(formData.passportBox.ymin + 20, formData.passportBox.ymax - 10) };
                              const img = await loadImage(formData.sourceFullPageUrl);
                              const newCrop = cropImageFromBox(img, box, rotation, 0);
                              setFormData((prev) => ({ ...prev, passportBox: box, passportPhotoUrl: newCrop }));
                            }}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-100 text-[11px]"
                          >
                            Trim Bottom Border (-1%)
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!formData.sourceFullPageUrl || !formData.passportBox) return;
                              const box = { ...formData.passportBox, xmin: Math.min(formData.passportBox.xmax - 20, formData.passportBox.xmin + 10) };
                              const img = await loadImage(formData.sourceFullPageUrl);
                              const newCrop = cropImageFromBox(img, box, rotation, 0);
                              setFormData((prev) => ({ ...prev, passportBox: box, passportPhotoUrl: newCrop }));
                            }}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-100 text-[11px]"
                          >
                            Trim Left Border (+1%)
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!formData.sourceFullPageUrl || !formData.passportBox) return;
                              const box = { ...formData.passportBox, xmax: Math.max(formData.passportBox.xmin + 20, formData.passportBox.xmax - 10) };
                              const img = await loadImage(formData.sourceFullPageUrl);
                              const newCrop = cropImageFromBox(img, box, rotation, 0);
                              setFormData((prev) => ({ ...prev, passportBox: box, passportPhotoUrl: newCrop }));
                            }}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-100 text-[11px]"
                          >
                            Trim Right Border (-1%)
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500">
                        Permanent Record Binding: This photo crop is anchored to Record ID <code className="font-mono text-blue-600">{formData.id}</code>. Sorting or reordering will never mismatch candidates and photos.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase">
                    Audit Trail &amp; Field Correction History
                  </h4>
                  {formData.correctionHistory && formData.correctionHistory.length > 0 ? (
                    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {formData.correctionHistory.map((item, idx) => (
                        <div key={idx} className="p-3 text-xs">
                          <div className="flex items-center justify-between text-slate-500">
                            <span className="font-semibold text-slate-800">Field: {item.field}</span>
                            <span>{item.changedAt}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-red-600 line-through">"{item.oldValue}"</span>
                            <span className="text-slate-400">→</span>
                            <span className="font-medium text-emerald-700">"{item.newValue}"</span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400">By: {item.changedBy}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No manual corrections recorded yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
                >
                  <Save className="h-4 w-4" /> Save Edits
                </button>
                <button
                  type="button"
                  onClick={() => handleFlag('Unclear handwriting needs verification')}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Flag Issue
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve &amp; Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
