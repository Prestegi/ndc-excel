import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpDown,
  RotateCcw,
  Download,
  FileSpreadsheet,
  Eye,
  CheckSquare,
  Square,
  Sparkles,
  Users,
} from 'lucide-react';
import type { PersonRecord } from '../types';

interface DataTableProps {
  records: PersonRecord[];
  onSelectRecord: (record: PersonRecord) => void;
  onExportExcel: (selectedOnly?: boolean) => void;
  onBatchApprove: (recordIds: string[]) => void;
  onClearAllRecords?: () => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  records,
  onSelectRecord,
  onExportExcel,
  onBatchApprove,
  onClearAllRecords,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_review' | 'approved' | 'flagged' | 'duplicates'>('all');
  const [wardFilter, setWardFilter] = useState<string>('all');
  const [photoFilter, setPhotoFilter] = useState<'all' | 'has_photo' | 'missing_photo'>('all');
  const [sortField, setSortField] = useState<'source' | 'ward_pu' | 'name'>('ward_pu');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Distinct wards for filtering
  const distinctWards = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.ward) set.add(r.ward);
    });
    return Array.from(set).sort();
  }, [records]);

  // Suspected duplicates check (checks duplicate phone, voter ID, or card numbers)
  const duplicateIdSet = useMemo(() => {
    const phones = new Map<string, string[]>();
    const voters = new Map<string, string[]>();
    const cards = new Map<string, string[]>();
    const dupes = new Set<string>();

    records.forEach((r) => {
      if (r.phoneNo && r.phoneNo.trim().length >= 8) {
        const list = phones.get(r.phoneNo.trim()) || [];
        list.push(r.id);
        phones.set(r.phoneNo.trim(), list);
      }
      if (r.votersCardNo && r.votersCardNo.trim().length >= 6) {
        const list = voters.get(r.votersCardNo.trim()) || [];
        list.push(r.id);
        voters.set(r.votersCardNo.trim(), list);
      }
      if (r.membershipNo && r.membershipNo.trim().length >= 5) {
        const list = cards.get(r.membershipNo.trim()) || [];
        list.push(r.id);
        cards.set(r.membershipNo.trim(), list);
      }
    });

    phones.forEach((ids) => {
      if (ids.length > 1) ids.forEach((id) => dupes.add(id));
    });
    voters.forEach((ids) => {
      if (ids.length > 1) ids.forEach((id) => dupes.add(id));
    });
    cards.forEach((ids) => {
      if (ids.length > 1) ids.forEach((id) => dupes.add(id));
    });

    return dupes;
  }, [records]);

  // Natural numerical sorting helper that preserves leading zeros
  const naturalCompare = (a: string = '', b: string = '') => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  };

  // Filter & Sort
  const processedRecords = useMemo(() => {
    return records
      .filter((rec) => {
        // Search term
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchName = rec.name?.toLowerCase().includes(q);
          const matchPhone = rec.phoneNo?.includes(q);
          const matchCard = rec.membershipNo?.toLowerCase().includes(q);
          const matchWard = rec.ward?.toLowerCase().includes(q);
          const matchPU = rec.pollingUnit?.toLowerCase().includes(q);
          const matchVoter = rec.votersCardNo?.toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchCard && !matchWard && !matchPU && !matchVoter) {
            return false;
          }
        }

        // Status Filter
        if (statusFilter === 'duplicates') {
          if (!duplicateIdSet.has(rec.id)) return false;
        } else if (statusFilter !== 'all' && rec.reviewStatus !== statusFilter) {
          return false;
        }

        // Ward Filter
        if (wardFilter !== 'all' && rec.ward !== wardFilter) {
          return false;
        }

        // Photo Filter
        if (photoFilter === 'has_photo' && !rec.hasPassportPhoto) return false;
        if (photoFilter === 'missing_photo' && rec.hasPassportPhoto) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortField === 'source') {
          // Return to original scan source order
          if (a.sourceFileName !== b.sourceFileName) {
            return naturalCompare(a.sourceFileName, b.sourceFileName);
          }
          if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
          return a.sectionIndex - b.sectionIndex;
        }

        if (sortField === 'ward_pu') {
          // Sort by Ward then Polling Unit numerically while preserving leading zeros
          const wardComp = naturalCompare(a.ward, b.ward);
          if (wardComp !== 0) return sortOrder === 'asc' ? wardComp : -wardComp;
          const puComp = naturalCompare(a.pollingUnit, b.pollingUnit);
          return sortOrder === 'asc' ? puComp : -puComp;
        }

        if (sortField === 'name') {
          const comp = naturalCompare(a.name, b.name);
          return sortOrder === 'asc' ? comp : -comp;
        }

        return 0;
      });
  }, [records, searchTerm, statusFilter, wardFilter, photoFilter, sortField, sortOrder]);

  const toggleSelectAll = () => {
    if (selectedIds.size === processedRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedRecords.map((r) => r.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const approvedCount = records.filter((r) => r.reviewStatus === 'approved').length;
  const pendingCount = records.filter((r) => r.reviewStatus === 'needs_review').length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      {/* Top Filter and Actions Toolbar */}
      <div className="border-b border-slate-200 bg-slate-50/70 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative min-w-[280px] max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, phone, card #, ward, or polling unit..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden"
            />
          </div>

          {/* Action Buttons: Batch Approve & Excel Export */}
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={() => onBatchApprove(Array.from(selectedIds))}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve Selected ({selectedIds.size})
              </button>
            )}

            <button
              onClick={() => onExportExcel(false)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition"
              title="Download formatted Excel workbook with embedded photos"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Download Excel ({approvedCount} Approved)
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <div className="flex items-center gap-1 text-slate-500 font-medium mr-1">
            <Filter className="h-3.5 w-3.5" /> Filters:
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-hidden font-medium"
          >
            <option value="all">All Statuses ({records.length})</option>
            <option value="needs_review">Needs Review ({pendingCount})</option>
            <option value="approved">Approved ({approvedCount})</option>
            <option value="flagged">Flagged ({records.filter((r) => r.reviewStatus === 'flagged').length})</option>
            {duplicateIdSet.size > 0 && (
              <option value="duplicates" className="font-bold text-rose-700">
                ⚠ Suspected Duplicates ({duplicateIdSet.size})
              </option>
            )}
          </select>

          {/* Ward Filter */}
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-hidden font-medium"
          >
            <option value="all">All Wards ({distinctWards.length})</option>
            {distinctWards.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>

          {/* Photo Status */}
          <select
            value={photoFilter}
            onChange={(e) => setPhotoFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-hidden font-medium"
          >
            <option value="all">All Photo States</option>
            <option value="has_photo">With Passport Photo</option>
            <option value="missing_photo">Blank / Missing Photo</option>
          </select>

          <div className="h-4 w-[1px] bg-slate-300 mx-1" />

          {/* Sorting controls */}
          <button
            onClick={() => {
              if (sortField === 'ward_pu') {
                setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
              } else {
                setSortField('ward_pu');
                setSortOrder('asc');
              }
            }}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium transition ${
              sortField === 'ward_pu'
                ? 'bg-blue-100 text-blue-800'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            Sort by Ward &amp; Polling Unit {sortField === 'ward_pu' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>

          <button
            onClick={() => setSortField('source')}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium transition ${
              sortField === 'source'
                ? 'bg-blue-100 text-blue-800'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
            title="Reset to original scanning order"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Source Order
          </button>

          {pendingCount > 0 && (
            <span className="ml-auto flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md text-[11px] font-semibold">
              <Clock className="h-3 w-3 text-amber-600" />
              {pendingCount} record{pendingCount > 1 ? 's' : ''} require review before export
            </span>
          )}
          {onClearAllRecords && records.length > 0 && (
            <button
              onClick={onClearAllRecords}
              className="ml-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-50 font-medium"
              title="Clear all currently loaded records to start fresh"
            >
              Clear Records
            </button>
          )}
        </div>

        {/* Duplicate Warning Alert Banner */}
        {duplicateIdSet.size > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>
                <strong>{duplicateIdSet.size} Suspected Duplicates Detected:</strong> Identical Phone Numbers, Voter Cards, or Membership Numbers detected across sections. In compliance with validation guidelines, these are flagged for review and are never automatically deleted.
              </span>
            </div>
            <button
              onClick={() => setStatusFilter('duplicates')}
              className="shrink-0 rounded-lg bg-rose-600 px-3 py-1 font-bold text-white hover:bg-rose-700 transition"
            >
              Filter Duplicates
            </button>
          </div>
        )}
      </div>

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          {/* Header Row Styled with NDC Blue theme */}
          <thead className="border-b border-blue-900 bg-[#0B3C5D] text-white">
            <tr>
              <th className="w-10 px-3 py-3.5 text-center">
                <button onClick={toggleSelectAll} className="cursor-pointer text-white">
                  {selectedIds.size === processedRecords.length && processedRecords.length > 0 ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4 opacity-75" />
                  )}
                </button>
              </th>
              <th className="w-12 px-3 py-3.5 text-center font-bold">S/N</th>
              <th className="w-20 px-3 py-3.5 text-center font-bold">Photo</th>
              <th className="px-4 py-3.5 font-bold">Name (Exact Order)</th>
              <th className="px-3 py-3.5 font-bold">Membership No.</th>
              <th className="px-4 py-3.5 font-bold">Ward</th>
              <th className="px-4 py-3.5 font-bold">Polling Unit</th>
              <th className="px-3 py-3.5 font-bold">Phone No.</th>
              <th className="px-3 py-3.5 font-bold">Voter’s Card No.</th>
              <th className="px-3 py-3.5 text-center font-bold">Status</th>
              <th className="w-24 px-3 py-3.5 text-center font-bold">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {processedRecords.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400">
                  <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No agent records found matching the active filters.
                </td>
              </tr>
            ) : (
              processedRecords.map((rec, index) => {
                const isSelected = selectedIds.has(rec.id);
                const isSuspectedDuplicate = duplicateIdSet.has(rec.id);
                const serialNumber = index + 1; // Consecutive S/N following active sort

                return (
                  <tr
                    key={rec.id}
                    className={`transition-colors hover:bg-slate-50/80 ${
                      isSelected ? 'bg-blue-50/50' : index % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => toggleSelectOne(rec.id)}
                        className="cursor-pointer text-slate-500 hover:text-blue-600"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Square className="h-4 w-4 opacity-50" />
                        )}
                      </button>
                    </td>

                    {/* S/N */}
                    <td className="px-3 py-3 text-center font-bold text-slate-700">
                      {serialNumber}
                    </td>

                    {/* Passport Photo Crop */}
                    <td className="px-3 py-2 text-center">
                      <div className="relative mx-auto flex h-14 w-11 items-center justify-center overflow-hidden rounded border border-slate-300 bg-slate-100 shadow-2xs">
                        {rec.hasPassportPhoto && rec.passportPhotoUrl ? (
                          <img
                            src={rec.passportPhotoUrl}
                            alt={rec.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-[9px] font-bold text-slate-400">
                            NO PHOTO
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Name & Flags */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{rec.name || '—'}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        {isSuspectedDuplicate && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-800">
                            Suspected Duplicate
                          </span>
                        )}
                        {rec.flags.map((f, i) => (
                          <span
                            key={i}
                            className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-medium text-amber-800"
                          >
                            {f.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Membership Card No */}
                    <td className="px-3 py-3 font-mono font-medium text-slate-700">
                      {rec.membershipNo || '—'}
                    </td>

                    {/* Ward */}
                    <td className="px-4 py-3 text-slate-800">{rec.ward || '—'}</td>

                    {/* Polling Unit */}
                    <td className="px-4 py-3 font-medium text-slate-800">{rec.pollingUnit || '—'}</td>

                    {/* Phone No */}
                    <td className="px-3 py-3 font-mono text-slate-800">
                      {rec.phoneNo || '—'}
                    </td>

                    {/* Voter Card No */}
                    <td className="px-3 py-3 font-mono text-slate-800">
                      {rec.votersCardNo || '—'}
                    </td>

                    {/* Review Status Badge */}
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          rec.reviewStatus === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rec.reviewStatus === 'flagged'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {rec.reviewStatus === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                        {rec.reviewStatus === 'flagged' && <AlertTriangle className="h-3 w-3" />}
                        {rec.reviewStatus === 'needs_review' && <Clock className="h-3 w-3" />}
                        {rec.reviewStatus === 'needs_review' ? 'Review' : rec.reviewStatus}
                      </span>
                    </td>

                    {/* Action Button */}
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => onSelectRecord(rec)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-blue-50 hover:text-blue-700 transition"
                      >
                        <Eye className="h-3 w-3" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer with Summary */}
      <div className="flex flex-wrap items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <div>
          Showing <span className="font-semibold text-slate-800">{processedRecords.length}</span> of{' '}
          <span className="font-semibold text-slate-800">{records.length}</span> total records
        </div>
        <div className="flex items-center gap-4">
          <span>
            Approved: <strong className="text-emerald-700">{approvedCount}</strong>
          </span>
          <span>
            Pending Review: <strong className="text-blue-700">{pendingCount}</strong>
          </span>
          <span>
            Flagged: <strong className="text-amber-700">{records.filter((r) => r.reviewStatus === 'flagged').length}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
