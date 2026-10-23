import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  CreditCard,
  Download,
  FileText,
  Info,
  Loader2,
  Lock,
  Minus,
  PenTool,
  Plus,
  RefreshCw,
  RotateCcw,
  Upload,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Eye,
  Edit,
  GripVertical,
} from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errors';
import { formatNumber, formatTimeAgo } from '../../utils/formatters';
import { initializeCheckout, getMyDues, checkDuePaid } from '../../api/payments';
import { getSessions, listSessionSemesters } from '../../api/sessions';
import type { DuePayment, SemesterEntry, Session } from '../../types';
import Modal from '../../components/ui/Modal';
import SignaturePlacementCanvas from '../../components/crf/SignaturePlacementCanvas';
import {
  getMyCRFSubmission,
  uploadCRF,
  listMyCRFDrafts,
  listMyCRFHistory,
  saveCRFPlacements,
  previewCRFSubmission,
  approveCRFSubmission,
  getCRFDownloadUrl,
  getCRFOriginalUrl,
  getCRFSignatureImageUrl,
  listCRFSignatureAssets,
  getCRFBacklogPrice,
  createCRFBacklogRequest,
  getMyCRFBacklogStatus,
  submitCRFBacklogForm,
  type CRFSigningSubmission,
  type CRFBacklogRequest,
  type CRFSignatureAsset,
  type CRFPlacements,
} from '../../api/crf-signing';

export default function CourseFormSigningPage() {
  const { success, error: notifyError } = useNotification();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission & Flow State
  const [submission, setSubmission] = useState<CRFSigningSubmission | null>(null);
  const [historyList, setHistoryList] = useState<CRFSigningSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Placements & Editor State
  const [assets, setAssets] = useState<CRFSignatureAsset[]>([]);
  const [placements, setPlacements] = useState<CRFPlacements>({});
  const [placementHistory, setPlacementHistory] = useState<CRFPlacements[]>([]);
  const [sizeFactor, setSizeFactor] = useState(1);
  const [snapToLines, setSnapToLines] = useState(true);
  const [draggingKind, setDraggingKind] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmedRightPlaces, setConfirmedRightPlaces] = useState(false);
  const [approving, setApproving] = useState(false);
  const [viewingSignedUrl, setViewingSignedUrl] = useState<string | null>(null);

  // Backlog State
  const [backlogPrice, setBacklogPrice] = useState(1000);
  const [backlog, setBacklog] = useState<CRFBacklogRequest | null>(null);
  const [requestCount, setRequestCount] = useState(1);
  const [requestingBacklog, setRequestingBacklog] = useState(false);
  const [isBacklogModalOpen, setIsBacklogModalOpen] = useState(false);
  const [pastSemesters, setPastSemesters] = useState<SemesterEntry[]>([]);
  const [allSemesters, setAllSemesters] = useState<SemesterEntry[]>([]);
  const [activeSemesterId, setActiveSemesterId] = useState<string>('');
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [backlogFile, setBacklogFile] = useState<File | null>(null);
  const [uploadingBacklog, setUploadingBacklog] = useState(false);

  // History Tab Filter
  const [historyFilter, setHistoryFilter] = useState<'all' | 'current' | 'old'>('all');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  // Dues State
  const [unpaidDuesList, setUnpaidDuesList] = useState<DuePayment[]>([]);
  const [duesLoading, setDuesLoading] = useState(true);

  // Check unpaid required dues
  useEffect(() => {
    let cancelled = false;
    const checkDues = async () => {
      setDuesLoading(true);
      try {
        const dues = await getMyDues(user?.level);
        const requiredDues = (dues || []).filter(
          (d) => d.is_active && (d.type === 'dept_dues' || d.type === 'class_dues'),
        );
        if (requiredDues.length === 0) {
          if (!cancelled) setUnpaidDuesList([]);
          return;
        }
        const unpaid: DuePayment[] = [];
        await Promise.all(
          requiredDues.map(async (d) => {
            try {
              const status = await checkDuePaid(d.id);
              if (!status.is_paid) unpaid.push(d);
            } catch {
              // ignore
            }
          }),
        );
        if (!cancelled) setUnpaidDuesList(unpaid);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setDuesLoading(false);
      }
    };

    checkDues();
    return () => {
      cancelled = true;
    };
  }, [user?.level]);

  // Load all CRF data
  useEffect(() => {
    Promise.all([
      getMyCRFSubmission().catch(() => null),
      listCRFSignatureAssets().catch(() => []),
      getCRFBacklogPrice().catch(() => null),
      getMyCRFBacklogStatus().catch(() => null),
      getSessions()
        .then(async (sessions: Session[]) => {
          const recentSessions = (sessions || []).slice(0, 3);
          const lists = await Promise.all(
            recentSessions.map((s) => listSessionSemesters(s.id).catch(() => [] as SemesterEntry[])),
          );
          return lists.flat();
        })
        .catch(() => []),
      listMyCRFDrafts().catch(() => []),
      listMyCRFHistory().catch(() => []),
    ])
      .then(([sub, assetList, bPrice, bStatus, semestersList, drafts, historyData]) => {
        let currentSub = sub;
        if (!currentSub && drafts.length > 0) {
          currentSub = drafts[0];
        }
        setSubmission(currentSub);
        if (currentSub) {
          const rawPlacements = currentSub.placements || {};
          const initialPlacements: CRFPlacements = {
            hod: rawPlacements.hod || { page: 1, x: 72, y: 215, width: 110, max_height: 34 },
            exam_officer: rawPlacements.exam_officer || { page: 1, x: 320, y: 215, width: 110, max_height: 34 },
          };
          if (rawPlacements.watermark) {
            initialPlacements.watermark = rawPlacements.watermark;
          }
          setPlacements(initialPlacements);
        }

        setAssets(assetList || []);
        if (bPrice?.amount_per_backlog) {
          setBacklogPrice(Number(bPrice.amount_per_backlog));
        }
        setBacklog(bStatus);

        const allSems = semestersList || [];
        setAllSemesters(allSems);
        const nowStr = new Date().toISOString();
        const activeSem =
          allSems.find((s) => s.is_active) ||
          allSems.find((s) => {
            const start = s.start_date || (s as any).startDate || '';
            const end = s.end_date || (s as any).endDate || '';
            return Boolean(start && end && nowStr >= start && nowStr <= end);
          }) ||
          allSems[allSems.length - 1];
        if (activeSem?.id) {
          setActiveSemesterId(activeSem.id);
        }
        setPastSemesters(allSems.filter((s) => s.id !== activeSem?.id));

        // Deduplicate history items
        const combined = [...(historyData || [])];
        if (currentSub && currentSub.status === 'completed' && !combined.some((h) => h.id === currentSub?.id)) {
          combined.unshift(currentSub);
        }
        setHistoryList(combined);
        if (combined.length > 0) {
          setSelectedHistoryId(combined[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalOutstandingDues = useMemo(() => {
    return unpaidDuesList.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }, [unpaidDuesList]);

  const duesCleared = !duesLoading && unpaidDuesList.length === 0;
  const isCompleted = submission?.status === 'completed';
  const isDraft = submission?.status === 'draft';
  const hodPlaced = Boolean(placements.hod);
  const examOfficerPlaced = Boolean(placements.exam_officer);
  const bothPlaced = hodPlaced && examOfficerPlaced;
  const remainingSlots = backlog ? Math.max(0, backlog.requested_count - backlog.forms_submitted) : 0;

  // Sync active step
  useEffect(() => {
    if (isCompleted) {
      setActiveStep(4);
    } else if (isDraft) {
      setActiveStep((prev) => (prev === 4 ? 4 : 3));
    } else if (duesCleared) {
      setActiveStep(2);
    } else {
      setActiveStep(1);
    }
  }, [isCompleted, isDraft, duesCleared]);

  // Track placement updates with undo history
  const handlePlacementsChange = useCallback(
    (next: CRFPlacements) => {
      setPlacementHistory((prev) => [...prev.slice(-10), placements]);
      setPlacements(next);
    },
    [placements],
  );

  // Ensure default placements are initialized whenever a submission is loaded
  useEffect(() => {
    if (submission && (!placements || (!placements.hod && !placements.exam_officer))) {
      const raw = submission.placements || {};
      setPlacements({
        hod: raw.hod || { page: 1, x: 72, y: 215, width: 110 * sizeFactor, max_height: 34 * sizeFactor },
        exam_officer: raw.exam_officer || {
          page: 1,
          x: 320,
          y: 215,
          width: 110 * sizeFactor,
          max_height: 34 * sizeFactor,
        },
        ...(raw.watermark ? { watermark: raw.watermark } : {}),
      });
    }
  }, [submission, activeStep]);

  const handleUndo = () => {
    if (placementHistory.length === 0) return;
    const previous = placementHistory[placementHistory.length - 1];
    setPlacementHistory((prev) => prev.slice(0, -1));
    setPlacements(previous);
  };

  const handleReset = () => {
    setPlacementHistory((prev) => [...prev, placements]);
    setPlacements({
      hod: { page: 1, x: 72, y: 215, width: 110 * sizeFactor, max_height: 34 * sizeFactor },
      exam_officer: { page: 1, x: 320, y: 215, width: 110 * sizeFactor, max_height: 34 * sizeFactor },
      watermark: { page: 1, x: 275, y: 42, width: 44, max_height: 50 },
    });
  };

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSizeFactor(val);
    const updated: CRFPlacements = { ...placements };
    if (updated.hod) {
      updated.hod = { ...updated.hod, width: 110 * val, max_height: 34 * val };
    }
    if (updated.exam_officer) {
      updated.exam_officer = { ...updated.exam_officer, width: 110 * val, max_height: 34 * val };
    }
    setPlacements(updated);
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!duesCleared) {
      notifyError('Outstanding Dues', 'Pay your outstanding dues before signing your course form.');
      return;
    }
    setUploading(true);
    try {
      const draft = await uploadCRF(file, activeSemesterId || undefined);
      setSubmission(draft);
      const rawPlacements = draft.placements || {};
      const initialPlacements: CRFPlacements = {
        hod: rawPlacements.hod || { page: 1, x: 72, y: 215, width: 110 * sizeFactor, max_height: 34 * sizeFactor },
        exam_officer: rawPlacements.exam_officer || {
          page: 1,
          x: 320,
          y: 215,
          width: 110 * sizeFactor,
          max_height: 34 * sizeFactor,
        },
      };
      if (rawPlacements.watermark) {
        initialPlacements.watermark = rawPlacements.watermark;
      }
      setPlacements(initialPlacements);
      setFile(null);
      setActiveStep(3);
      success('Form Uploaded', 'Now drag and arrange the HOD and Exam Officer signatures on the form.');
    } catch (err) {
      notifyError('Could Not Upload Form', getErrorMessage(err, 'Please try again'));
    } finally {
      setUploading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!duesCleared) return;
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
    } else {
      notifyError('Invalid File', 'Only PDF files are accepted.');
    }
  };

  const handleReviewAndSaveStep = async () => {
    if (!submission) return;
    setPreviewing(true);
    try {
      await saveCRFPlacements(submission.id, placements);
      const blob = await previewCRFSubmission(submission.id);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setActiveStep(4);
    } catch (err) {
      notifyError('Preview Error', getErrorMessage(err, 'Could not generate document preview'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleSaveAndDownloadFinal = async () => {
    if (!submission) return;
    setApproving(true);
    try {
      await saveCRFPlacements(submission.id, placements);
      const final = await approveCRFSubmission(submission.id);
      setSubmission(final);
      setHistoryList((prev) => [final, ...prev.filter((h) => h.id !== final.id)]);
      setActiveStep(4);
      success('Form Signed', 'Your course form has been officially signed and saved.');

      // Automatically trigger download
      const downloadLink = document.createElement('a');
      downloadLink.href = getCRFDownloadUrl(final.id);
      downloadLink.download = `Course_Form_Signed.pdf`;
      downloadLink.target = '_blank';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
    } catch (err) {
      notifyError('Signing Failed', getErrorMessage(err, 'Could not approve course form.'));
    } finally {
      setApproving(false);
    }
  };

  const handlePayForBacklog = async () => {
    if (!user?.email) {
      notifyError('Checkout Error', 'User email is required.');
      return;
    }
    setRequestingBacklog(true);
    try {
      const { backlog_request, payment } = await createCRFBacklogRequest(requestCount);
      setBacklog(backlog_request);
      const res = await initializeCheckout(payment.id, user.email);
      if (res?.authorization_url) {
        success('Redirecting', 'Forwarding to Paystack to unlock old form slot(s)...');
        window.location.href = res.authorization_url;
      } else {
        notifyError('Checkout Error', 'No redirect URL returned.');
      }
    } catch (err) {
      notifyError('Payment Error', getErrorMessage(err, 'Unable to initiate payment'));
    } finally {
      setRequestingBacklog(false);
    }
  };

  const semesterMap = useMemo(() => {
    const map = new Map<string, string>();
    allSemesters.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [allSemesters]);

  const filteredHistory = useMemo(() => {
    return historyList.filter((item) => {
      if (item.status !== 'completed') return false;
      const isCurrent = item.semester_id === activeSemesterId;
      if (historyFilter === 'current') return isCurrent;
      if (historyFilter === 'old') return !isCurrent;
      return true;
    });
  }, [historyList, historyFilter, activeSemesterId]);

  return (
    <div className="flex flex-col min-h-0 text-[var(--text)] space-y-6 pb-12">
      {/* ======================================================== */}
      {/* TOP HEADER (No sample badge)                             */}
      {/* ======================================================== */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)]">Course Form Signing</h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
          Upload your course form, place the HOD and Exam Officer signatures, then save and download your signed PDF.
        </p>
      </div>

      {/* ======================================================== */}
      {/* 4-STEP PROGRESS BAR                                      */}
      {/* ======================================================== */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm">
        <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none py-1">
          {/* STEP 1: Pay dues */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                duesCleared || isCompleted
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-[#1d68ec] text-white shadow-sm ring-4 ring-blue-500/10'
              }`}
            >
              {duesCleared || isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
            </div>
            <div className="text-left">
              <p className="text-xs sm:text-sm font-bold text-[var(--text)]">Pay dues</p>
              <p className="text-[11px] text-[var(--text-muted)]">Clear any outstanding dues</p>
            </div>
          </div>

          <div
            className={`flex-1 h-0.5 mx-3 min-w-[32px] ${
              duesCleared || isCompleted ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-[#282b37]'
            }`}
          />

          {/* STEP 2: Upload form */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                (activeStep > 2 || isCompleted) && (submission || isCompleted)
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : activeStep === 2 && !isCompleted
                    ? 'bg-[#1d68ec] text-white shadow-sm ring-4 ring-blue-500/10'
                    : 'border border-slate-300 dark:border-[#2f3342] text-[var(--text-muted)] bg-transparent'
              }`}
            >
              {(activeStep > 2 || isCompleted) && (submission || isCompleted) ? (
                <Check className="w-4 h-4 stroke-[3]" />
              ) : (
                '2'
              )}
            </div>
            <div className="text-left">
              <p className="text-xs sm:text-sm font-bold text-[var(--text)]">Upload form</p>
              <p className="text-[11px] text-[var(--text-muted)]">PDF only</p>
            </div>
          </div>

          <div
            className={`flex-1 h-0.5 mx-3 min-w-[32px] ${
              (activeStep > 2 || isCompleted) && (submission || isCompleted)
                ? 'bg-emerald-500'
                : 'bg-slate-200 dark:bg-[#282b37]'
            }`}
          />

          {/* STEP 3: Place signatures */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                activeStep > 3 || isCompleted
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : activeStep === 3
                    ? 'bg-[#1d68ec] text-white shadow-sm ring-4 ring-blue-500/10'
                    : 'border border-slate-300 dark:border-[#2f3342] text-[var(--text-muted)] bg-transparent'
              }`}
            >
              {activeStep > 3 || isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : '3'}
            </div>
            <div className="text-left">
              <p className="text-xs sm:text-sm font-bold text-[var(--text)]">Place signatures</p>
              <p className="text-[11px] text-[var(--text-muted)]">HOD and Exam Officer</p>
            </div>
          </div>

          <div
            className={`flex-1 h-0.5 mx-3 min-w-[32px] ${
              activeStep > 3 || isCompleted ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-[#282b37]'
            }`}
          />

          {/* STEP 4: Save and download */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                isCompleted
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : activeStep === 4
                    ? 'bg-[#1d68ec] text-white shadow-sm ring-4 ring-blue-500/10'
                    : 'border border-slate-300 dark:border-[#2f3342] text-[var(--text-muted)] bg-transparent'
              }`}
            >
              {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : '4'}
            </div>
            <div className="text-left">
              <p className="text-xs sm:text-sm font-bold text-[var(--text)]">Save and download</p>
              <p className="text-[11px] text-[var(--text-muted)]">Your signed PDF</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#1d68ec]" />
          <p className="text-xs text-[var(--text-muted)]">Loading course form signing status...</p>
        </div>
      ) : isCompleted ? (
        /* ======================================================== */
        /* COMPLETED STATE: SIGNED BANNER & HISTORY (Screenshots 1 & 4) */
        /* ======================================================== */
        <div className="space-y-6">
          {/* Green Course Form Signed Banner */}
          <div className="p-6 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-black text-[var(--text)]">Course form signed</h3>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
                  Your signed PDF is saved in your history. Next signing opens next semester.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
              <a
                href={getCRFDownloadUrl(submission.id)}
                download="Course_Form_Signed.pdf"
                className="px-5 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </a>

              <button
                onClick={() => setViewingSignedUrl(getCRFDownloadUrl(submission.id))}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#2a2e3c] bg-white dark:bg-[#161820] hover:bg-slate-50 dark:hover:bg-[#1c1f28] text-[var(--text)] text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all shadow-sm"
              >
                <Eye className="w-4 h-4" />
                <span>View</span>
              </button>
            </div>
          </div>

          {/* Signing History Table Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#20232e]">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[var(--text)]">Signing history</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Every signed course form, ready to download again
                </p>
              </div>

              {/* Filter Pills */}
              <div className="inline-flex p-1 rounded-full border border-slate-200 dark:border-[#262833] bg-slate-50 dark:bg-[#13151b] gap-1 self-start sm:self-auto">
                <button
                  onClick={() => setHistoryFilter('all')}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    historyFilter === 'all'
                      ? 'bg-[#1d68ec] text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setHistoryFilter('current')}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    historyFilter === 'current'
                      ? 'bg-[#1d68ec] text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  Current
                </button>
                <button
                  onClick={() => setHistoryFilter('old')}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    historyFilter === 'old'
                      ? 'bg-[#1d68ec] text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  Old forms
                </button>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                No course forms found for this filter.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-[#20232e] text-[11px] font-bold text-[var(--text-muted)] tracking-wider">
                      <th className="py-3 px-3">SEMESTER</th>
                      <th className="py-3 px-3">FILE</th>
                      <th className="py-3 px-3">TYPE</th>
                      <th className="py-3 px-3">SIGNED</th>
                      <th className="py-3 px-3">STATUS</th>
                      <th className="py-3 px-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#20232e]">
                    {filteredHistory.map((item) => {
                      const isCurrent = item.semester_id === activeSemesterId;
                      const isSelected = selectedHistoryId === item.id;
                      const semName =
                        semesterMap.get(item.semester_id) || (isCurrent ? 'Current semester' : 'Past semester');

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedHistoryId(item.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-l-[#1d68ec]'
                              : 'hover:bg-slate-50/70 dark:hover:bg-[#13151b] border-l-4 border-l-transparent'
                          }`}
                        >
                          <td className="py-3.5 px-3 font-bold text-[var(--text)] whitespace-nowrap">
                            {semName} {isCurrent ? '' : '(old form)'}
                          </td>

                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span className="flex items-center gap-2 font-medium text-[var(--text)]">
                              <FileText className="w-4 h-4 text-[#1d68ec]" />
                              {isCurrent ? 'Course_Form_Signed.pdf' : 'Old_Form_Signed.pdf'}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-[var(--text-muted)] whitespace-nowrap">
                            {isCurrent ? 'Current' : 'Old form'}
                          </td>

                          <td className="py-3.5 px-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                            {formatTimeAgo(item.created_at)}
                          </td>

                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Signed</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingSignedUrl(getCRFDownloadUrl(item.id));
                                }}
                                className="p-2 rounded-xl border border-slate-200 dark:border-[#2b2e3c] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-slate-100 dark:hover:bg-[#1f222d] transition-colors"
                                title="View form"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={getCRFDownloadUrl(item.id)}
                                download="Course_Form_Signed.pdf"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 rounded-xl border border-slate-200 dark:border-[#2b2e3c] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-slate-100 dark:hover:bg-[#1f222d] transition-colors"
                                title="Download signed PDF"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : isDraft && activeStep === 4 ? (
        /* ======================================================== */
        /* STEP 4: FINAL PREVIEW & CONFIRMATION (Screenshots 2 & 5) */
        /* ======================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: FINAL PREVIEW (~8 cols) */}
          <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-[#20232e] bg-slate-50/50 dark:bg-[#13151b] flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--text)]">Final preview</span>
              <span className="text-[var(--text-muted)] font-mono">Course_Form.pdf</span>
            </div>

            <div className="p-6 bg-slate-100/60 dark:bg-[#0c0d12] flex items-center justify-center min-h-[580px]">
              {previewUrl ? (
                <iframe
                  title="Course Form Final Preview"
                  src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                  className="w-full h-[620px] rounded-xl border border-slate-200 dark:border-[#262833] bg-white shadow-md"
                />
              ) : (
                <div className="text-center py-20 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#1d68ec] mx-auto" />
                  <p className="text-xs text-[var(--text-muted)]">Generating stamped preview...</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: READY TO SAVE CHECKLIST & APPROVE (~4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            {/* Ready to Save Checklist Card */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[var(--text)]">Ready to save</h3>
              <div className="space-y-3 text-xs divide-y divide-slate-100 dark:divide-[#20232e]">
                <div className="flex items-center gap-2.5 pt-2 first:pt-0 font-medium text-[var(--text)]">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span>Dues cleared</span>
                </div>

                <div className="flex items-center gap-2.5 pt-2.5 font-medium text-[var(--text)]">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span>Course form uploaded</span>
                </div>

                <div className="flex items-center gap-2.5 pt-2.5 font-medium text-[var(--text)]">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span>HOD signature placed</span>
                </div>

                <div className="flex items-center gap-2.5 pt-2.5 font-medium text-[var(--text)]">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span>Exam Officer signature placed</span>
                </div>
              </div>
            </div>

            {/* Saving is Final Warning Card */}
            <div className="p-5 rounded-2xl border border-amber-400/60 dark:border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/15 space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#facc15] text-slate-900 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-[var(--text)]">Saving is final</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                    You can sign one course form per semester. Saving uses this semester's slot.
                  </p>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmedRightPlaces}
                  onChange={(e) => setConfirmedRightPlaces(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-[#1d68ec] focus:ring-[#1d68ec] border-slate-300 dark:border-[#2b2e3c] cursor-pointer"
                />
                <span className="text-xs font-semibold text-[var(--text)]">
                  I confirm the signatures are in the right places.
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                disabled={!confirmedRightPlaces || approving}
                onClick={handleSaveAndDownloadFinal}
                className="w-full py-3.5 px-4 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Save and download PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveStep(3)}
                className="w-full py-3 px-4 rounded-xl border border-slate-200 dark:border-[#2a2e3c] hover:bg-slate-50 dark:hover:bg-[#1c1f28] text-[var(--text)] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Edit className="w-4 h-4" />
                <span>Edit placement</span>
              </button>
            </div>
          </div>
        </div>
      ) : isDraft && activeStep === 3 ? (
        /* ======================================================== */
        /* STEP 3: PLACING SIGNATURES (Screenshot 3)               */
        /* ======================================================== */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 1. LEFT PANEL: SIGNATURES PALETTE (~3 cols) */}
            <div className="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-5 shadow-sm space-y-5">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)]">Signatures</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                  Drag each signature to the line where your form asks for it.
                </p>
              </div>

              {/* HOD Card */}
              {(() => {
                const hodAsset = assets.find((a) => a.kind === 'hod');
                return (
                  <div
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', 'hod');
                      e.dataTransfer.effectAllowed = 'copy';
                      setDraggingKind('hod');
                    }}
                    onDragEnd={() => setDraggingKind(null)}
                    onClick={() => {
                      if (!placements.hod) {
                        handlePlacementsChange({
                          ...placements,
                          hod: { page: 1, x: 72, y: 215, width: 110 * sizeFactor, max_height: 34 * sizeFactor },
                        });
                      }
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-grab active:cursor-grabbing select-none ${
                      hodPlaced
                        ? 'border-blue-500/40 bg-blue-50/20 dark:bg-blue-950/20'
                        : 'border-slate-200 dark:border-[#262833] bg-slate-50/50 dark:bg-[#12141a] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                        <span className="text-xs font-bold text-[var(--text)]">HOD signature</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          hodPlaced
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-200/70 dark:bg-[#252833] text-[var(--text-muted)]'
                        }`}
                      >
                        {hodPlaced ? 'Placed' : 'Click or drag'}
                      </span>
                    </div>
                    <div className="h-16 rounded-xl border border-dashed border-slate-200 dark:border-[#282b37] bg-white dark:bg-[#181a23] flex items-center justify-center p-2">
                      {hodAsset?.file_path ? (
                        <img
                          src={getCRFSignatureImageUrl(hodAsset.file_path) ?? ''}
                          alt="HOD Signature"
                          className="max-h-full max-w-full object-contain pointer-events-none select-none"
                        />
                      ) : (
                        <svg
                          className="w-24 h-8 text-[#1d68ec]"
                          viewBox="0 0 100 30"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M 5,20 Q 20,5 35,20 T 65,20 T 95,15" />
                        </svg>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1.5 text-center">Drag onto the HOD line</p>
                  </div>
                );
              })()}

              {/* Exam Officer Card */}
              {(() => {
                const examAsset = assets.find((a) => a.kind === 'exam_officer');
                return (
                  <div
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', 'exam_officer');
                      e.dataTransfer.effectAllowed = 'copy';
                      setDraggingKind('exam_officer');
                    }}
                    onDragEnd={() => setDraggingKind(null)}
                    onClick={() => {
                      if (!placements.exam_officer) {
                        handlePlacementsChange({
                          ...placements,
                          exam_officer: {
                            page: 1,
                            x: 320,
                            y: 215,
                            width: 110 * sizeFactor,
                            max_height: 34 * sizeFactor,
                          },
                        });
                      }
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-grab active:cursor-grabbing select-none ${
                      examOfficerPlaced
                        ? 'border-blue-500/40 bg-blue-50/20 dark:bg-blue-950/20'
                        : 'border-slate-200 dark:border-[#262833] bg-slate-50/50 dark:bg-[#12141a] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                        <span className="text-xs font-bold text-[var(--text)]">Exam Officer signature</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          examOfficerPlaced
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : draggingKind === 'exam_officer'
                              ? 'bg-amber-400 text-slate-900'
                              : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}
                      >
                        {examOfficerPlaced ? 'Placed' : draggingKind === 'exam_officer' ? 'Dragging' : 'Click or drag'}
                      </span>
                    </div>
                    <div className="h-16 rounded-xl border border-dashed border-slate-200 dark:border-[#282b37] bg-white dark:bg-[#181a23] flex items-center justify-center p-2">
                      {examAsset?.file_path ? (
                        <img
                          src={getCRFSignatureImageUrl(examAsset.file_path) ?? ''}
                          alt="Exam Officer Signature"
                          className="max-h-full max-w-full object-contain pointer-events-none select-none"
                        />
                      ) : (
                        <svg
                          className="w-24 h-8 text-[#1d68ec]"
                          viewBox="0 0 100 30"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M 5,22 Q 25,2 45,22 T 75,10 T 95,20" />
                        </svg>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1.5 text-center">
                      Drag onto the Exam Officer line
                    </p>
                  </div>
                );
              })()}

              {/* Size Slider */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#20232e] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--text)]">
                  <span>SIZE</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{Math.round(sizeFactor * 100)}%</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
                  <span>S</span>
                  <input
                    type="range"
                    min="0.7"
                    max="1.5"
                    step="0.05"
                    value={sizeFactor}
                    onChange={handleSizeChange}
                    className="flex-1 accent-[#1d68ec] cursor-pointer"
                  />
                  <span>L</span>
                </div>
              </div>

              {/* Anti-Fraud Watermark Position Card */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#20232e] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--text)]">
                  <span>WATERMARK BADGE</span>
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    Anti-tamper
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-[#181a23] rounded-xl text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setPlacements((prev) => ({
                        ...prev,
                        watermark: { page: 1, x: 275, y: 42, width: 44, max_height: 50 },
                      }));
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                      !placements.watermark || (placements.watermark.y || 42) <= 100
                        ? 'bg-white dark:bg-[#252833] text-[var(--text)] shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    Bottom
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlacements((prev) => ({
                        ...prev,
                        watermark: { page: 1, x: 275, y: 390, width: 44, max_height: 50 },
                      }));
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                      placements.watermark && (placements.watermark.y || 0) > 100
                        ? 'bg-white dark:bg-[#252833] text-[var(--text)] shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    Middle
                  </button>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] text-center">
                  Compact QR badge with student name & matric
                </p>
              </div>

              {/* Action Buttons: Undo & Reset */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={placementHistory.length === 0}
                  className="py-2 px-3 rounded-xl border border-slate-200 dark:border-[#262833] hover:bg-slate-50 dark:hover:bg-[#1d202a] text-xs font-bold text-[var(--text)] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="py-2 px-3 rounded-xl border border-slate-200 dark:border-[#262833] hover:bg-slate-50 dark:hover:bg-[#1d202a] text-xs font-bold text-[var(--text)] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* 2. CENTER PANEL: PDF CANVAS VIEWER (~6 cols) */}
            <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm overflow-hidden flex flex-col">
              <SignaturePlacementCanvas
                pdfUrl={getCRFOriginalUrl(submission.id)}
                assets={assets}
                value={placements}
                onChange={handlePlacementsChange}
                snapToLines={snapToLines}
                onDraggingKindChange={(k) => setDraggingKind(k)}
                studentName={
                  user?.fullName ||
                  user?.full_name ||
                  `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
                  'Student'
                }
                matricNumber={(user as any)?.matric_number || (user as any)?.matricNumber || 'OFFICIAL'}
              />
            </div>

            {/* 3. RIGHT PANEL: PLACEMENT CHECKLIST & TIPS (~3 cols) */}
            <div className="lg:col-span-3 space-y-5">
              {/* Placement Status Card */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-[var(--text)]">Placement</h3>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-[var(--text)]">
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center ${
                          hodPlaced ? 'bg-emerald-500 text-white' : 'border border-slate-300 dark:border-[#2b2e3c]'
                        }`}
                      >
                        {hodPlaced && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      HOD signature
                    </span>
                    <span className={`font-bold ${hodPlaced ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`}>
                      {hodPlaced ? 'Placed' : 'Not placed'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-[var(--text)]">
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center ${
                          examOfficerPlaced
                            ? 'bg-emerald-500 text-white'
                            : draggingKind === 'exam_officer'
                              ? 'border-2 border-amber-400'
                              : 'border border-slate-300 dark:border-[#2b2e3c]'
                        }`}
                      >
                        {examOfficerPlaced ? (
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        ) : draggingKind === 'exam_officer' ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        ) : null}
                      </span>
                      Exam Officer signature
                    </span>
                    <span
                      className={`font-bold ${
                        examOfficerPlaced
                          ? 'text-emerald-500'
                          : draggingKind === 'exam_officer'
                            ? 'text-amber-500'
                            : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {examOfficerPlaced ? 'Placed' : draggingKind === 'exam_officer' ? 'Dragging...' : 'Not placed'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-[#20232e] flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)] font-medium">Snap to lines</span>
                  <button
                    type="button"
                    onClick={() => setSnapToLines((prev) => !prev)}
                    className={`w-10 h-6 rounded-full transition-colors relative focus:outline-none ${
                      snapToLines ? 'bg-[#1d68ec]' : 'bg-slate-300 dark:bg-[#252833]'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                        snapToLines ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Tips Card */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-[var(--text)]">Tips</h3>
                <ul className="space-y-2.5 text-xs text-[var(--text-muted)]">
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <span>Drop the signature on the line, not over the text.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <span>Drag the corners to resize it.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <span>You can move it again until you save.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Navigation Bar */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <button
              onClick={() => {
                if (window.confirm('Leave signature placement studio? Your draft will be saved.')) {
                  setSubmission(null);
                  setActiveStep(2);
                }
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2a2e3c] hover:bg-slate-50 dark:hover:bg-[#1c1f28] text-xs font-bold text-[var(--text)] flex items-center gap-2 self-start sm:self-auto transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 text-center justify-center">
              {bothPlaced ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-4 h-4 stroke-[3]" /> Both signatures placed. Ready to review and save.
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Info className="w-4 h-4 text-blue-500" /> Place the Exam Officer and HOD signatures to continue.
                </span>
              )}
            </div>

            <button
              disabled={!bothPlaced || previewing}
              onClick={handleReviewAndSaveStep}
              className="px-6 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-40 active:scale-95 self-end sm:self-auto"
            >
              {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Review and save &gt;</span>
            </button>
          </div>
        </div>
      ) : (
        /* ======================================================== */
        /* STEPS 1 & 2: DUES CHECK & UPLOAD (Screenshots 1, 2, 4, 5) */
        /* ======================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: UPLOAD & OLD COURSE FORMS (~8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* 1. YELLOW WARNING BANNER (When Dues are Unpaid - Screenshots 2 & 5) */}
            {!duesCleared && (
              <div className="rounded-2xl border border-amber-400/70 dark:border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/15 p-6 shadow-sm space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-[#facc15] text-slate-900 flex items-center justify-center shrink-0 shadow-sm">
                    <Lock className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-[var(--text)]">Pay your dues to unlock signing</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                      You have dues waiting. Clear them first, then come back to upload and sign this semester's course
                      form.
                    </p>
                  </div>
                </div>

                {/* Dues List */}
                <div className="space-y-2.5">
                  {unpaidDuesList.map((d) => (
                    <div
                      key={d.id}
                      className="p-3.5 rounded-xl border border-slate-200/80 dark:border-[#222530] bg-white/70 dark:bg-[#12141a]/70 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CreditCard className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                        <div className="min-w-0">
                          <span className="font-bold text-[var(--text)] truncate block">{d.name}</span>
                          <span className="text-[10px] text-blue-500 font-semibold">Required</span>
                        </div>
                      </div>
                      <span className="font-bold text-[var(--text)]">₦{formatNumber(Number(d.amount))}</span>
                    </div>
                  ))}
                </div>

                {/* Total Outstanding Box */}
                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-[#222530] bg-white/90 dark:bg-[#161820] flex items-center justify-between text-xs">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">Total outstanding</span>
                  <span className="text-lg sm:text-xl font-black text-[var(--text)]">
                    ₦{formatNumber(totalOutstandingDues)}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-1">
                  <Link
                    to="/payments"
                    className="px-5 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Pay dues now</span>
                  </Link>

                  <Link
                    to="/payments?tab=cart"
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2b2e3c] bg-white dark:bg-[#161820] hover:bg-slate-50 dark:hover:bg-[#1c1f28] text-xs font-bold text-[var(--text)] inline-flex items-center gap-2 transition-all shadow-sm"
                  >
                    <span>View in Payments</span>
                  </Link>
                </div>
              </div>
            )}

            {/* 2. UPLOAD YOUR COURSE FORM CARD */}
            <div className="rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#20232e]">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text)]">Upload your course form</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Only PDF files are accepted</p>
                </div>

                {duesCleared && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Dues cleared</span>
                  </span>
                )}
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (duesCleared) setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleFileDrop}
                className={`relative rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
                  !duesCleared
                    ? 'border-slate-200/60 dark:border-[#20232e] bg-slate-50/30 dark:bg-[#12141a]/40 opacity-75'
                    : isDragOver
                      ? 'border-[#1d68ec] bg-blue-50/30 dark:bg-blue-950/20'
                      : 'border-slate-200 dark:border-[#282b37] bg-slate-50/40 dark:bg-[#13151b] hover:border-slate-300 dark:hover:border-[#383d4e]'
                }`}
              >
                {!duesCleared ? (
                  /* Locked Dropzone (Screenshots 2 & 5) */
                  <div className="space-y-3 py-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-200/70 dark:bg-[#20232e] text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-muted)]">Locked until your dues are paid</p>
                    </div>
                    <button
                      disabled
                      className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-[#202430] text-slate-400 dark:text-slate-500 text-xs font-bold inline-flex items-center gap-2 cursor-not-allowed"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Choose PDF</span>
                    </button>
                  </div>
                ) : (
                  /* Active Dropzone (Screenshots 1 & 4) */
                  <div className="space-y-3 py-2">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center mx-auto">
                      <Upload className="w-6 h-6 stroke-[2]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text)]">Drag and drop your course form</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">PDF files only</p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />

                    {file ? (
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs font-bold text-[#1d68ec]">
                        <FileText className="w-4 h-4" />
                        <span className="truncate max-w-[200px]">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setFile(null)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-5 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Choose PDF</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 3 Validation Checklist Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-slate-100 dark:border-[#20232e] bg-slate-50/50 dark:bg-[#13151b] flex items-center gap-2 text-[var(--text)] font-medium">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>PDF format only</span>
                </div>
                <div className="p-3 rounded-xl border border-slate-100 dark:border-[#20232e] bg-slate-50/50 dark:bg-[#13151b] flex items-center gap-2 text-[var(--text)] font-medium">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Signature areas visible</span>
                </div>
                <div className="p-3 rounded-xl border border-slate-100 dark:border-[#20232e] bg-slate-50/50 dark:bg-[#13151b] flex items-center gap-2 text-[var(--text)] font-medium">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>One form per semester</span>
                </div>
              </div>

              {/* Continue Button */}
              <button
                disabled={!file || !duesCleared || uploading}
                onClick={handleUpload}
                className="w-full py-3 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-40 active:scale-[0.99]"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Upload and continue to signing &gt;</span>
              </button>
            </div>

            {/* 3. SIGN AN OLD COURSE FORM CARD (Screenshots 1 & 4) */}
            <div className="rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-6 shadow-sm space-y-5">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text)]">Sign an old course form</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    For unsigned forms from previous semesters. Pay first, then upload.
                  </p>
                </div>
              </div>

              {remainingSlots > 0 ? (
                /* Unlocked Backlog Slot Upload Area */
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> {remainingSlots} old form slot(s) unlocked!
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRequestCount(1);
                        setIsBacklogModalOpen(true);
                      }}
                      className="text-xs font-semibold text-[#1d68ec] dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Unlock more slots
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={selectedSemesterId}
                      onChange={(e) => setSelectedSemesterId(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#13151b] text-xs text-[var(--text)] focus:outline-none focus:border-[#1d68ec]"
                    >
                      <option value="">Select past semester...</option>
                      {pastSemesters.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setBacklogFile(e.target.files?.[0] || null)}
                      className="text-xs text-[var(--text-muted)] self-center"
                    />
                  </div>

                  <button
                    disabled={!backlogFile || !selectedSemesterId || uploadingBacklog}
                    onClick={async () => {
                      if (!backlogFile || !selectedSemesterId) return;
                      setUploadingBacklog(true);
                      try {
                        const draft = await submitCRFBacklogForm(backlogFile, selectedSemesterId);
                        setSubmission(draft);
                        const rawPlacements = draft.placements || {};
                        const initialPlacements: CRFPlacements = {
                          hod: rawPlacements.hod || {
                            page: 1,
                            x: 72,
                            y: 150,
                            width: 110 * sizeFactor,
                            max_height: 34 * sizeFactor,
                          },
                          exam_officer: rawPlacements.exam_officer || {
                            page: 1,
                            x: 260,
                            y: 150,
                            width: 110 * sizeFactor,
                            max_height: 34 * sizeFactor,
                          },
                        };
                        setPlacements(initialPlacements);
                        setActiveStep(3);
                        success('Uploaded', 'Old form uploaded. Place signatures to complete.');
                      } catch (err) {
                        notifyError('Error', getErrorMessage(err, 'Failed to upload form'));
                      } finally {
                        setUploadingBacklog(false);
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors disabled:opacity-40"
                  >
                    {uploadingBacklog ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    <span>Upload backlog form</span>
                  </button>
                </div>
              ) : (
                /* Backlog Pay Call-to-action */
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-[#262833] bg-slate-50/50 dark:bg-[#13151b]">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[var(--text)]">No backlog form slots currently unlocked</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Fee: <span className="font-bold text-[var(--text)]">₦{formatNumber(backlogPrice)}</span> per
                      semester form. You can select how many forms you want to pay for.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRequestCount(1);
                      setIsBacklogModalOpen(true);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 whitespace-nowrap self-stretch sm:self-auto"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Pay for Backlog</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: HOW IT WORKS & HISTORY (~4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            {/* 1. HOW IT WORKS CARD */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[var(--text)]">How it works</h3>
              <div className="space-y-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center shrink-0 mt-0.5">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--text)]">Pay any outstanding dues</p>
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                      Signing unlocks once dues are cleared.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center shrink-0 mt-0.5">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--text)]">Upload your course form</p>
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">Only PDF files are accepted.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center shrink-0 mt-0.5">
                    <PenTool className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--text)]">Place the signatures</p>
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                      Drag the HOD and Exam Officer signatures onto the form.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center shrink-0 mt-0.5">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--text)]">Save and download</p>
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                      You get a signed PDF, saved in your history.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. ONE FORM PER SEMESTER WARNING CARD */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-[var(--text)]">One form per semester</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                    You can sign one course form each semester, so check it before you save.
                  </p>
                </div>
              </div>

              <div className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#fef08a] dark:bg-[#ca8a04]/20 text-slate-900 dark:text-[#fef08a]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{isCompleted ? '0 slots available' : '1 slot available'}</span>
                </span>
              </div>
            </div>

            {/* 3. HISTORY CARD (When in upload mode) */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#20232e]">
                <h3 className="text-sm font-bold text-[var(--text)]">History</h3>
                {filteredHistory.length > 0 && (
                  <span className="text-xs text-[var(--text-muted)]">{filteredHistory.length} signed</span>
                )}
              </div>

              {filteredHistory.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredHistory.slice(0, 3).map((item) => {
                    const isCur = item.semester_id === activeSemesterId;
                    const sName = semesterMap.get(item.semester_id) || (isCur ? 'Current semester' : 'Past semester');
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-[#222530] bg-slate-50/50 dark:bg-[#12141a] flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-[#1d68ec] shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-[var(--text)] truncate">{sName}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">{formatTimeAgo(item.created_at)}</p>
                          </div>
                        </div>
                        <a
                          href={getCRFDownloadUrl(item.id)}
                          download="Course_Form_Signed.pdf"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-[#262833] hover:bg-white dark:hover:bg-[#1a1c26] text-[var(--text)] transition-colors shrink-0"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1f222d] text-[var(--text-muted)] flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-[var(--text)]">No signed forms yet</h4>
                  <p className="text-[11px] text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed">
                    Signed forms are saved here so you can download them again.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SIGNED FORM VIEW MODAL                                   */}
      {/* ======================================================== */}
      {viewingSignedUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#161820] w-full max-w-4xl h-[85vh] rounded-3xl border border-slate-200 dark:border-[#222530] shadow-2xl p-6 flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#20232e]">
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">Signed Course Form</h3>
                <p className="text-xs text-[var(--text-muted)]">Official stamped and signed document</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={viewingSignedUrl}
                  download="Course_Form_Signed.pdf"
                  className="px-4 py-2 rounded-xl bg-[#1d68ec] hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setViewingSignedUrl(null)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-[#262833] hover:bg-slate-100 dark:hover:bg-[#1f222d] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 rounded-xl border border-slate-200 dark:border-[#262833] bg-slate-100 dark:bg-[#0c0d12] overflow-hidden">
              <iframe title="Signed Course Form" src={viewingSignedUrl} className="w-full h-full border-0" />
            </div>
          </div>
        </div>
      )}

      {/* Backlog Payment Count Selection Modal */}
      <Modal
        isOpen={isBacklogModalOpen}
        onClose={() => {
          if (!requestingBacklog) setIsBacklogModalOpen(false);
        }}
        title="Pay for Backlog Forms"
        size="md"
      >
        <div className="p-6 space-y-6">
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-[var(--text)]">How many backlog forms do you want to pay for?</h4>
            <p className="text-xs text-[var(--text-muted)]">
              Choose how many past semester course forms you need to unlock and sign digitally.
            </p>
          </div>

          {/* Quantity Selector */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-[#262833] bg-slate-50/70 dark:bg-[#13151b] flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text)]">Number of Forms</span>
            <div className="inline-flex items-center border border-slate-200 dark:border-[#262833] rounded-xl bg-white dark:bg-[#1c1f2b] p-1 shadow-sm">
              <button
                type="button"
                disabled={requestCount <= 1 || requestingBacklog}
                onClick={() => setRequestCount((c) => Math.max(1, c - 1))}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-[#252836] flex items-center justify-center text-[var(--text)] transition-colors disabled:opacity-40"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-12 text-center text-sm font-bold text-[var(--text)]">{requestCount}</span>
              <button
                type="button"
                disabled={requestCount >= 20 || requestingBacklog}
                onClick={() => setRequestCount((c) => Math.min(20, c + 1))}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-[#252836] flex items-center justify-center text-[var(--text)] transition-colors disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)] font-medium">Quick pick:</span>
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                type="button"
                disabled={requestingBacklog}
                onClick={() => setRequestCount(num)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  requestCount === num
                    ? 'bg-[#1d68ec] text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-[#222530] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {num} {num === 1 ? 'form' : 'forms'}
              </button>
            ))}
          </div>

          {/* Price Breakdown */}
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">Fee per form</span>
              <span className="font-semibold text-[var(--text)]">₦{formatNumber(backlogPrice)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">Quantity</span>
              <span className="font-semibold text-[var(--text)]">× {requestCount}</span>
            </div>
            <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text)]">Total to pay</span>
              <span className="text-base font-extrabold text-[#1d68ec] dark:text-blue-400">
                ₦{formatNumber(backlogPrice * requestCount)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={requestingBacklog}
              onClick={() => setIsBacklogModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#262833] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={requestingBacklog}
              onClick={handlePayForBacklog}
              className="px-5 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              {requestingBacklog ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              <span>Proceed to Paystack (₦{formatNumber(backlogPrice * requestCount)})</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
