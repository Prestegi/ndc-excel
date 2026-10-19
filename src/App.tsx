/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  auth,
  googleProvider,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase/config';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  collection,
  query,
  getDocs,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';

import type {
  PersonRecord,
  ScannedPageQueueItem,
  BatchStats,
  ReviewLogItem,
} from './types';
import { Navbar } from './components/Navbar';
import { UploadQueue } from './components/UploadQueue';
import { DataTable } from './components/DataTable';
import { ReviewModal } from './components/ReviewModal';
import { ExportView } from './components/ExportView';
import { ValidationSuite } from './components/ValidationSuite';
import { generateSampleFormImage } from './utils/sampleGenerator';
import { cropImageFromBox, loadImage } from './utils/cropUtils';
import type { ExtractedPersonSection } from './server/extractor';
import { AlertCircle, CheckCircle2, Cloud, CloudOff, RefreshCw, X } from 'lucide-react';

const LOCAL_STORAGE_RECORDS_KEY = 'ndc_scanner_persisted_records_v2';
const LOCAL_STORAGE_QUEUE_KEY = 'ndc_scanner_persisted_queue_v2';

export default function App() {
  // Restore persistent state immediately from localStorage so refresh NEVER wipes data!
  const [records, setRecords] = useState<PersonRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_RECORDS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [queue, setQueue] = useState<ScannedPageQueueItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_QUEUE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [user, setUser] = useState<{
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL?: string | null;
    isFirebaseAuthenticated: boolean;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'queue' | 'table' | 'export' | 'validation'>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_RECORDS_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return parsed.length > 0 ? 'table' : 'queue';
    } catch {
      return 'queue';
    }
  });

  const [reviewLogs, setReviewLogs] = useState<ReviewLogItem[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<PersonRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [systemAlert, setSystemAlert] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
  } | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const isProcessingRef = useRef(false);

  // Sync records to localStorage on every state change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_RECORDS_KEY, JSON.stringify(records));
    } catch (e) {
      console.warn('LocalStorage save warning:', e);
    }
  }, [records]);

  // Sync queue to localStorage (strip heavy base64 data to avoid quota errors)
  useEffect(() => {
    try {
      const safeQueue = queue.map((q) => ({
        ...q,
        dataUrl: q.dataUrl?.length > 1000000 ? '' : q.dataUrl,
      }));
      localStorage.setItem(LOCAL_STORAGE_QUEUE_KEY, JSON.stringify(safeQueue));
    } catch (e) {
      console.warn('LocalStorage queue save warning:', e);
    }
  }, [queue]);

  // Sync Auth State with Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          isFirebaseAuthenticated: true,
        });

        // Trigger Cloud Firestore synchronization
        syncWithFirestore(firebaseUser);
      } else {
        // Fallback Reviewer Session (persisted in localStorage)
        setUser({
          uid: 'ndc_reviewer_local',
          email: 'ogonnayaomoke80@gmail.com',
          displayName: 'NDC Reviewer',
          photoURL: null,
          isFirebaseAuthenticated: false,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync with Cloud Firestore
  const syncWithFirestore = async (firebaseUser: User) => {
    setIsCloudSyncing(true);
    try {
      // 1. Fetch remote records from Firestore
      const snap = await getDocs(collection(db, 'personRecords'));
      const remoteRecords: PersonRecord[] = [];
      snap.forEach((d) => {
        remoteRecords.push(d.data() as PersonRecord);
      });

      // 2. Merge remote records with any local records
      setRecords((prevLocal) => {
        const mergedMap = new Map<string, PersonRecord>();
        // Add remote records first
        remoteRecords.forEach((r) => mergedMap.set(r.id, r));
        // Overlay local records
        prevLocal.forEach((r) => {
          if (!mergedMap.has(r.id)) {
            mergedMap.set(r.id, r);
          }
        });
        const merged = Array.from(mergedMap.values());
        return reconcileDuplicates(merged);
      });

      // 3. Upload any local records missing from Firestore
      const remoteIds = new Set(remoteRecords.map((r) => r.id));
      for (const localRec of records) {
        if (!remoteIds.has(localRec.id)) {
          const cloudRec = { ...localRec, userId: firebaseUser.uid };
          await setDoc(doc(db, 'personRecords', cloudRec.id), cloudRec);
        }
      }

      setLastSyncTime(new Date().toLocaleTimeString());
      setSystemAlert({
        type: 'success',
        title: 'Cloud Firestore Connected',
        message: `Synchronized ${Math.max(remoteRecords.length, records.length)} record(s) with cloud database ai-studio-4c33ac16-b5ca-44e5-954e-c63122c2562b.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Firestore sync note:', msg);
      setSystemAlert({
        type: 'warning',
        title: 'Cloud Sync Notice',
        message: `Working in persistent local storage. Cloud sync: ${msg}`,
      });
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Google Sign-In with popup
  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        setUser({
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          isFirebaseAuthenticated: true,
        });
        syncWithFirestore(result.user);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Google Sign-In failed:', msg);
      setSystemAlert({
        type: 'error',
        title: 'Google Sign-In Error',
        message: `Sign-in popup note: ${msg}. Your data is safely preserved locally in this browser.`,
      });
    }
  };

  const handleDemoSignIn = () => {
    setUser({
      uid: 'ndc_reviewer_session',
      email: 'ogonnayaomoke80@gmail.com',
      displayName: 'NDC Senior Reviewer',
      photoURL: null,
      isFirebaseAuthenticated: false,
    });
    setSystemAlert({
      type: 'info',
      title: 'Reviewer Mode Active',
      message: 'All records are saved locally on this device. Sign in with Google anytime to sync across devices.',
    });
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      // ignore
    }
    setUser({
      uid: 'ndc_reviewer_local',
      email: 'ogonnayaomoke80@gmail.com',
      displayName: 'NDC Reviewer',
      photoURL: null,
      isFirebaseAuthenticated: false,
    });
    setSystemAlert({
      type: 'info',
      title: 'Signed Out',
      message: 'Switched to local reviewer mode. All current records remain loaded.',
    });
  };

  // Reconcile and flag suspected duplicates across records
  const reconcileDuplicates = (recordList: PersonRecord[]): PersonRecord[] => {
    const phones = new Map<string, string[]>();
    const voters = new Map<string, string[]>();
    const cards = new Map<string, string[]>();
    const dupeIds = new Set<string>();

    recordList.forEach((r) => {
      const phone = (r.phoneNo || '').trim();
      const voter = (r.votersCardNo || '').trim();
      const card = (r.membershipNo || '').trim();

      if (phone.length >= 8) {
        const list = phones.get(phone) || [];
        list.push(r.id);
        phones.set(phone, list);
      }
      if (voter.length >= 6) {
        const list = voters.get(voter) || [];
        list.push(r.id);
        voters.set(voter, list);
      }
      if (card.length >= 5) {
        const list = cards.get(card) || [];
        list.push(r.id);
        cards.set(card, list);
      }
    });

    phones.forEach((ids) => {
      if (ids.length > 1) ids.forEach((id) => dupeIds.add(id));
    });
    voters.forEach((ids) => {
      if (ids.length > 1) ids.forEach((id) => dupeIds.add(id));
    });
    cards.forEach((ids) => {
      if (ids.length > 1) ids.forEach((id) => dupeIds.add(id));
    });

    return recordList.map((r) => {
      const isDupe = dupeIds.has(r.id);
      const hasFlag = r.flags.includes('suspected_duplicate');
      if (isDupe && !hasFlag) {
        return { ...r, flags: [...r.flags, 'suspected_duplicate'] };
      } else if (!isDupe && hasFlag) {
        return { ...r, flags: r.flags.filter((f) => f !== 'suspected_duplicate') };
      }
      return r;
    });
  };

  // Stats calculation
  const stats: BatchStats = {
    queued: queue.filter((p) => p.status === 'queued').length,
    processing: queue.filter((p) => p.status === 'processing').length,
    needsReview: records.filter((r) => r.reviewStatus === 'needs_review').length,
    approved: records.filter((r) => r.reviewStatus === 'approved').length,
    failed: queue.filter((p) => p.status === 'failed').length,
  };

  // Add pages to queue
  const handleAddPagesToQueue = (newPages: ScannedPageQueueItem[]) => {
    setSystemAlert(null);
    setQueue((prev) => [...prev, ...newPages]);
  };

  // Save/Update a single record with audit logging
  const handleSaveRecord = async (updatedRecord: PersonRecord, logAction: string = 'Update') => {
    const updatedList = records.map((r) => (r.id === updatedRecord.id ? updatedRecord : r));
    const reconciled = reconcileDuplicates(updatedList);
    setRecords(reconciled);

    // Append review log item
    const newLog: ReviewLogItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recordId: updatedRecord.id,
      personName: updatedRecord.name,
      userId: user?.email || 'Reviewer',
      action: logAction,
      details: `Status set to ${updatedRecord.reviewStatus.toUpperCase()}`,
      timestamp: new Date().toLocaleString(),
    };
    setReviewLogs((prev) => [newLog, ...prev]);

    // Persist to Cloud Firestore if signed in
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'personRecords', updatedRecord.id), updatedRecord);
        await setDoc(doc(db, 'reviewLogs', newLog.id), newLog);
      } catch (err) {
        console.warn('Firestore write warning:', err);
      }
    }
  };

  // Batch approve selected records
  const handleBatchApprove = async (recordIds: string[]) => {
    const updated = records.map((r) => {
      if (recordIds.includes(r.id)) {
        return {
          ...r,
          reviewStatus: 'approved' as const,
          reviewedBy: user?.email || 'Reviewer',
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      return r;
    });
    const reconciled = reconcileDuplicates(updated);
    setRecords(reconciled);

    // Persist to Cloud Firestore if signed in
    if (auth.currentUser) {
      for (const id of recordIds) {
        const rec = reconciled.find((r) => r.id === id);
        if (rec) {
          try {
            await setDoc(doc(db, 'personRecords', id), rec);
          } catch (e) {
            // ignore
          }
        }
      }
    }
  };

  // Clear all records with confirmation
  const handleClearAllRecords = async () => {
    if (!window.confirm('Are you sure you want to clear all loaded records? This will delete local and cloud records for this session.')) {
      return;
    }

    if (auth.currentUser) {
      try {
        for (const rec of records) {
          await deleteDoc(doc(db, 'personRecords', rec.id));
        }
      } catch (e) {
        console.warn('Error clearing Firestore documents:', e);
      }
    }

    setRecords([]);
    setQueue([]);
    localStorage.removeItem(LOCAL_STORAGE_RECORDS_KEY);
    localStorage.removeItem(LOCAL_STORAGE_QUEUE_KEY);
    setSystemAlert({
      type: 'info',
      title: 'Records Cleared',
      message: 'All records have been cleared. You can now upload a fresh scanned form.',
    });
  };

  // Process a single scanned page with real handwriting recognition
  const processOnePage = async (pageItem: ScannedPageQueueItem) => {
    try {
      setSystemAlert(null);

      // Verify that image payload is present
      if (!pageItem.dataUrl || pageItem.dataUrl.length < 50) {
        throw new Error('Image data is missing or empty. Please re-upload the scan.');
      }

      // Mark page as processing
      setQueue((prev) =>
        prev.map((p) => (p.id === pageItem.id ? { ...p, status: 'processing', errorMessage: undefined } : p))
      );

      // Call server extraction API
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: pageItem.dataUrl,
          mimeType: 'image/jpeg',
          pageNumber: pageItem.pageNumber,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server extraction failed with HTTP ${response.status}`);
      }

      const data = await response.json();

      // STRICT VALIDATION: If extraction failed, THROW real error. NEVER substitute mock data!
      if (!data.success || !data.sections || data.sections.length === 0) {
        const errorText = data.error || 'No agent candidate sections detected on this scanned page.';
        throw new Error(errorText);
      }

      const detectedSections: ExtractedPersonSection[] = data.sections;

      // Load source image to crop passport photos and section snippets
      const sourceImg = await loadImage(pageItem.dataUrl);
      const newPersonRecords: PersonRecord[] = [];

      for (let sIdx = 0; sIdx < detectedSections.length; sIdx++) {
        const sec = detectedSections[sIdx];

        // Deterministic ID preventing duplicate insertions on retries
        const cleanFileName = pageItem.fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const recordId = `rec_${cleanFileName}_p${pageItem.pageNumber}_s${sIdx}`;

        // Section snippet for side-by-side inspection
        let sectionSnippet = '';
        if (sec.sectionBox) {
          sectionSnippet = cropImageFromBox(sourceImg, sec.sectionBox, 0, 0);
        }

        // Passport photograph crop (TIGHT, 0% padding)
        let passportCropUrl: string | undefined = undefined;
        const hasPhoto = Boolean(sec.hasPassportPhoto && sec.passportBox);

        if (hasPhoto && sec.passportBox) {
          passportCropUrl = cropImageFromBox(sourceImg, sec.passportBox, 0, 0);
        }

        const flags = Array.from(new Set(sec.flags || []));
        if (!hasPhoto && !flags.includes('missing_photo')) {
          flags.push('missing_photo');
        }

        const personRecord: PersonRecord = {
          id: recordId,
          batchId: pageItem.batchId,
          userId: auth.currentUser?.uid || user?.uid || 'ndc_reviewer_local',
          pageNumber: pageItem.pageNumber,
          sectionIndex: sIdx,
          sourceFileName: pageItem.fileName,
          name: sec.name || '',
          membershipNo: String(sec.membershipNo || ''),
          ward: sec.ward || '',
          pollingUnit: String(sec.pollingUnit || ''),
          phoneNo: String(sec.phoneNo || ''),
          votersCardNo: String(sec.votersCardNo || ''),
          state: sec.state || 'Greater Accra',
          lga: sec.lga || 'Ayawaso Central',
          isCollationAgent: Boolean(sec.isCollationAgent),
          collationAgentRole: sec.collationAgentRole || 'Polling Station Agent',
          hasPassportPhoto: hasPhoto,
          passportPhotoUrl: passportCropUrl,
          passportBox: sec.passportBox || undefined,
          passportRotation: 0,
          sectionBox: sec.sectionBox,
          sectionSnippetUrl: sectionSnippet || pageItem.dataUrl,
          sourceFullPageUrl: pageItem.dataUrl,
          reviewStatus: 'needs_review', // Strict requirement: must be reviewed
          flags,
          correctionHistory: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        newPersonRecords.push(personRecord);

        // Persist to Cloud Firestore if signed in
        if (auth.currentUser) {
          try {
            await setDoc(doc(db, 'personRecords', personRecord.id), personRecord);
          } catch (e) {
            console.warn('Firestore write warning:', e);
          }
        }
      }

      // Upsert into state (replaces previous records from same file/section on retry, avoiding duplicates!)
      setRecords((prev) => {
        const recordMap = new Map(prev.map((r) => [r.id, r]));
        newPersonRecords.forEach((r) => recordMap.set(r.id, r));
        return reconcileDuplicates(Array.from(recordMap.values()));
      });

      // Mark page as completed
      setQueue((prev) =>
        prev.map((p) =>
          p.id === pageItem.id
            ? { ...p, status: 'done', personCount: detectedSections.length }
            : p
        )
      );

      setSystemAlert({
        type: 'success',
        title: 'Extraction Completed',
        message: `Extracted ${detectedSections.length} candidate record(s) from ${pageItem.fileName}. Ready for review in the Table tab.`,
      });
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      console.error('Failed to process page:', pageItem.fileName, errMessage);
      setSystemAlert({
        type: 'error',
        title: 'Page Extraction Failed',
        message: `Failed to process ${pageItem.fileName}: ${errMessage}`,
      });
      setQueue((prev) =>
        prev.map((p) =>
          p.id === pageItem.id
            ? { ...p, status: 'failed', errorMessage: errMessage }
            : p
        )
      );
    }
  };

  // Start processing queued pages sequentially
  const handleStartProcessing = async () => {
    if (isProcessingRef.current) return;
    setIsProcessing(true);
    isProcessingRef.current = true;
    setSystemAlert(null);

    const pending = queue.filter((p) => p.status === 'queued' || p.status === 'failed');

    for (const pageItem of pending) {
      if (!isProcessingRef.current) break;
      await processOnePage(pageItem);
    }

    setIsProcessing(false);
    isProcessingRef.current = false;
    setActiveTab('table');
  };

  // Retry failed queue items
  const handleRetryFailed = () => {
    setQueue((prev) =>
      prev.map((p) => (p.status === 'failed' ? { ...p, status: 'queued', errorMessage: undefined } : p))
    );
    handleStartProcessing();
  };

  // Demo sample simulation
  const handleLoadOfficialSample = async () => {
    const sampleDataUrl = await generateSampleFormImage();
    const batchId = `demo_sample_${Date.now()}`;
    const samplePage: ScannedPageQueueItem = {
      id: `demo_page_${Date.now()}`,
      batchId,
      pageNumber: 1,
      fileName: 'NDC_Agent_Collection_Form_Sample.jpg',
      dataUrl: sampleDataUrl,
      status: 'queued',
    };

    setQueue((prev) => [samplePage, ...prev]);
    await processOnePage(samplePage);
    setActiveTab('table');
  };

  // Simulate 1,000-page batch queue runner
  const handleSimulateLargeBatch = (pageCount: number = 1000) => {
    const batchId = `sim_batch_${Date.now()}`;
    const simPages: ScannedPageQueueItem[] = [];

    for (let i = 1; i <= Math.min(pageCount, 100); i++) {
      simPages.push({
        id: `sim_page_${batchId}_${i}`,
        batchId,
        pageNumber: i,
        fileName: `Simulated_NDC_Batch_Scan_${i.toString().padStart(4, '0')}.pdf (p.${i})`,
        dataUrl: '',
        status: 'queued',
      });
    }

    setQueue((prev) => [...prev, ...simPages]);
    alert(
      `Loaded simulated queue with ${pageCount} pages. This tests durable queue metrics, error handling, and deduplication without triggering paid AI calls.`
    );
  };

  return (
    <div className="min-h-screen bg-slate-100/70 font-sans text-slate-900 antialiased">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onSignInWithGoogle={handleGoogleSignIn}
        onDemoSignIn={handleDemoSignIn}
        onSignOut={handleSignOut}
        recordsCount={records.length}
        approvedCount={records.filter((r) => r.reviewStatus === 'approved').length}
      />

      {/* Cloud & Local Persistence Status Banner */}
      <div className="border-b border-slate-200 bg-white px-4 py-2 text-xs">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-2 text-slate-600">
          <div className="flex items-center gap-2">
            {user?.isFirebaseAuthenticated ? (
              <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                <Cloud className="h-4 w-4 text-emerald-600" />
                Cloud Firestore Active: Synced with ai-studio-4c33ac16-b5ca-44e5-954e-c63122c2562b
                {lastSyncTime && <span className="text-slate-400 font-normal">({lastSyncTime})</span>}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-blue-700">
                <CloudOff className="h-4 w-4 text-blue-600" />
                Reviewer Mode (Local Browser Storage Active): {records.length} records safely preserved across refreshes
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isCloudSyncing && (
              <span className="flex items-center gap-1 text-slate-400">
                <RefreshCw className="h-3 w-3 animate-spin" /> Syncing...
              </span>
            )}
            {!user?.isFirebaseAuthenticated && (
              <button
                onClick={handleGoogleSignIn}
                className="font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
              >
                Sign in with Google to sync across browsers
              </button>
            )}
          </div>
        </div>
      </div>

      {/* System Alert Banner (Errors / Warnings / Confirmations) */}
      {systemAlert && (
        <div
          className={`border-b px-4 py-2.5 text-xs transition-colors ${
            systemAlert.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : systemAlert.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : systemAlert.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="mx-auto max-w-7xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {systemAlert.type === 'error' && <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />}
              {systemAlert.type === 'warning' && <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />}
              {systemAlert.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
              <div>
                <strong>{systemAlert.title}:</strong> {systemAlert.message}
              </div>
            </div>
            <button
              onClick={() => setSystemAlert(null)}
              className="rounded p-1 hover:bg-black/5 text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === 'queue' && (
          <UploadQueue
            queue={queue}
            stats={stats}
            isProcessing={isProcessing}
            onAddPagesToQueue={handleAddPagesToQueue}
            onStartProcessing={handleStartProcessing}
            onRetryFailed={handleRetryFailed}
            onLoadOfficialSample={handleLoadOfficialSample}
            onSimulateLargeBatch={handleSimulateLargeBatch}
          />
        )}

        {activeTab === 'table' && (
          <div className="space-y-4">
            {records.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 mb-4">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900">No Agent Records Currently Loaded</h3>
                <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                  Upload a scanned NDC Agent Data Collection Form (PDF, JPG, PNG) in the <strong>Upload &amp; Queue</strong> tab and click <strong>Process</strong> to extract candidates using actual handwriting vision OCR.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setActiveTab('queue')}
                    className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition"
                  >
                    Go to Upload &amp; Queue
                  </button>
                  {queue.length > 0 && (
                    <button
                      onClick={handleStartProcessing}
                      disabled={isProcessing}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                    >
                      Process {queue.length} Queued Page(s)
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <DataTable
                records={records}
                onSelectRecord={(rec) => setSelectedRecord(rec)}
                onExportExcel={() => setActiveTab('export')}
                onBatchApprove={handleBatchApprove}
                onClearAllRecords={handleClearAllRecords}
              />
            )}
          </div>
        )}

        {activeTab === 'export' && (
          <ExportView
            records={records}
            reviewLogs={reviewLogs}
            currentUserEmail={user?.email || 'Reviewer'}
          />
        )}

        {activeTab === 'validation' && (
          <ValidationSuite
            records={records}
            onLoadOfficialSample={handleLoadOfficialSample}
            onSimulateLargeBatch={handleSimulateLargeBatch}
          />
        )}
      </main>

      {/* Side-by-Side Review Modal */}
      {selectedRecord && (
        <ReviewModal
          record={selectedRecord}
          allRecords={records}
          onClose={() => setSelectedRecord(null)}
          onSaveRecord={handleSaveRecord}
          onSelectRecord={(rec) => setSelectedRecord(rec)}
          currentUserEmail={user?.email || 'Reviewer'}
        />
      )}
    </div>
  );
}
