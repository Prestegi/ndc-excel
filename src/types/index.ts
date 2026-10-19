export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface CropCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // 0, 90, 180, 270
}

export interface CorrectionHistoryItem {
  field: string;
  oldValue: string;
  newValue: string;
  changedAt: string;
  changedBy: string;
  reason?: string;
}

export interface PersonRecord {
  id: string; // Permanent unique ID
  batchId: string;
  pageId?: string;
  userId: string;
  pageNumber: number;
  sectionIndex: number;
  sourceFileName: string;
  
  // Extracted fields
  name: string;
  membershipNo: string;
  ward: string;
  pollingUnit: string;
  phoneNo: string;
  votersCardNo: string;
  state: string;
  lga: string;
  isCollationAgent: boolean;
  collationAgentRole: string;

  // Passport photo handling
  hasPassportPhoto: boolean;
  passportPhotoUrl?: string; // High-res base64 or storage URL
  passportBox?: BoundingBox;
  passportRotation?: number; // 0, 90, 180, 270
  
  // Section source image
  sectionBox?: BoundingBox;
  sectionSnippetUrl?: string; // Snapshot of the section for side-by-side review
  sourceFullPageUrl?: string;

  // Review & Verification
  reviewStatus: 'needs_review' | 'approved' | 'flagged';
  flags: string[]; // e.g., 'unclear_handwriting', 'missing_photo', 'invalid_phone', 'suspected_duplicate'
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  confirmedMissingFields?: string[]; // user explicitly confirms "missing from original"
  correctionHistory: CorrectionHistoryItem[];

  createdAt: string;
  updatedAt: string;
}

export interface BatchStats {
  queued: number;
  processing: number;
  needsReview: number;
  approved: number;
  failed: number;
}

export interface BatchItem {
  id: string;
  userId: string;
  name: string;
  totalPages: number;
  processedPages: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  stats: BatchStats;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScannedPageQueueItem {
  id: string;
  batchId: string;
  pageNumber: number;
  fileName: string;
  dataUrl: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  errorMessage?: string;
  personCount?: number;
}

export interface ReviewLogItem {
  id: string;
  recordId: string;
  personName: string;
  userId: string;
  action: string;
  details: string;
  timestamp: string;
}
