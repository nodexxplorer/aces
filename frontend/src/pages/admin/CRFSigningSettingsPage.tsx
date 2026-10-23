import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNotification } from '../../hooks/useNotification';
import { getErrorMessage } from '../../utils/errors';
import {
  listCRFSignatureAssets,
  uploadCRFSignatureAsset,
  deleteCRFSignatureAsset,
  getCRFBacklogPrice,
  updateCRFBacklogPrice,
  getCRFSignatureImageUrl,
  listAllCRFHistory,
  type CRFSignatureAsset,
  type CRFSignatureKind,
  type CRFAdminSubmission,
} from '../../api/crf-signing';
import { getSessions } from '../../api/sessions';
import type { Session } from '../../types';
import {
  FileText,
  Pencil,
  Upload,
  Trash2,
  CheckCircle2,
  Check,
  X,
  CreditCard,
  Download,
  Loader2,
  FileCheck,
  AlertCircle,
  History,
  Search,
  ExternalLink,
  Users,
  FileCode,
} from 'lucide-react';

type TabKey = 'queue' | 'setup' | 'history';

const KIND_TITLES: Record<CRFSignatureKind, string> = {
  hod: 'HOD signature',
  exam_officer: 'Exam Officer signature',
};

export default function CRFSigningSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabKey = tabParam === 'history' ? 'history' : tabParam === 'queue' ? 'queue' : 'setup';

  const { success, error: notifyError } = useNotification();
  const [assets, setAssets] = useState<CRFSignatureAsset[]>([]);
  const [submissions, setSubmissions] = useState<CRFAdminSubmission[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // Backlog price state (real data from API)
  const [, setBacklogFee] = useState<number | null>(null);
  const [feeInput, setFeeInput] = useState<string>('');
  // The fee is only shown and saved once the server has returned it.
  const [feeLoaded, setFeeLoaded] = useState(false);
  const [savingFee, setSavingFee] = useState(false);

  // History Tab Filters
  const [historySearch, setHistorySearch] = useState('');
  const [sessionFilter, setSessionFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State for Upload/Replace signature
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<CRFSignatureKind>('hod');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [processedImageBlob, setProcessedImageBlob] = useState<Blob | null>(null);
  const [processedDataUrl, setProcessedDataUrl] = useState<string | null>(null);

  // Modal Image Processing Controls
  const [inkStrength, setInkStrength] = useState<number>(50);
  const [keepOriginalColor, setKeepOriginalColor] = useState<boolean>(true);
  const [savingSignature, setSavingSignature] = useState(false);
  const [deletingKind, setDeletingKind] = useState<CRFSignatureKind | null>(null);

  // Hidden file inputs for each kind
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentUploadKindRef = useRef<CRFSignatureKind>('hod');

  // Load Real Data from APIs
  const fetchData = async () => {
    try {
      setLoading(true);
      const [assetsData, priceData, historyData, sessionsData] = await Promise.allSettled([
        listCRFSignatureAssets(),
        getCRFBacklogPrice(),
        listAllCRFHistory(),
        getSessions(),
      ]);

      if (assetsData.status === 'fulfilled') {
        setAssets(Array.isArray(assetsData.value) ? assetsData.value : []);
      }
      if (priceData.status === 'fulfilled') {
        const amt = Number(priceData.value?.amount_per_backlog);
        if (Number.isFinite(amt) && amt > 0) {
          setBacklogFee(amt);
          setFeeInput(String(amt));
          setFeeLoaded(true);
        }
      }
      if (historyData.status === 'fulfilled') {
        setSubmissions(Array.isArray(historyData.value) ? historyData.value : []);
      }
      if (sessionsData.status === 'fulfilled') {
        setSessions(Array.isArray(sessionsData.value) ? sessionsData.value : []);
      }
    } catch {
      notifyError('Load Failed', 'Could not load course forms data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const hodAsset = useMemo(() => assets.find((a) => a.kind === 'hod'), [assets]);
  const examOfficerAsset = useMemo(() => assets.find((a) => a.kind === 'exam_officer'), [assets]);
  const isReady = Boolean(hodAsset && examOfficerAsset);

  // Filtered Submissions for History Tab
  const filteredSubmissions = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return submissions.filter((sub) => {
      // Session filter
      if (sessionFilter !== 'all') {
        if (sub.session_id !== sessionFilter && sub.session_name !== sessionFilter) return false;
      }

      // Semester filter
      if (semesterFilter !== 'all') {
        const sem = (sub.semester_name || '').toLowerCase();
        if (!sem.includes(semesterFilter.toLowerCase())) return false;
      }

      // Level filter
      if (levelFilter !== 'all') {
        if (String(sub.level) !== levelFilter) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (sub.status !== statusFilter) return false;
      }

      // Search query
      if (q) {
        const name = (sub.student_name || '').toLowerCase();
        const matric = (sub.matric_number || '').toLowerCase();
        if (!name.includes(q) && !matric.includes(q)) return false;
      }

      return true;
    });
  }, [submissions, historySearch, sessionFilter, semesterFilter, levelFilter, statusFilter]);

  // Real Metrics for History Tab
  const totalSubmissions = submissions.length;
  const completedCount = useMemo(() => submissions.filter((s) => s.status === 'completed').length, [submissions]);
  const draftCount = useMemo(() => submissions.filter((s) => s.status === 'draft').length, [submissions]);
  const uniqueStudents = useMemo(() => new Set(submissions.map((s) => s.user_id)).size, [submissions]);

  // Trigger file selection for a specific signature kind
  const triggerFileSelect = (kind: CRFSignatureKind) => {
    currentUploadKindRef.current = kind;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // When a user selects a file, read it and open the preview modal
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('image/png') && !file.type.includes('image/jpeg')) {
      notifyError('Invalid File', 'Please select a PNG or JPEG photo of the signature.');
      return;
    }

    setSelectedFile(file);
    setModalKind(currentUploadKindRef.current);

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const src = loadEvt.target?.result as string;
      setRawImageSrc(src);
      setModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  // Client-side interactive canvas background removal for preview
  useEffect(() => {
    if (!rawImageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = rawImageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;

      // Threshold based on ink strength: 0 to 100 maps to 180 to 240
      const threshold = 180 + (inkStrength / 100) * 60;

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        if (luminance >= threshold) {
          // Transparent paper background
          d[i + 3] = 0;
        } else {
          // Ink pixel
          const alphaRatio = Math.min(1, Math.max(0, (threshold - luminance) / 30));
          d[i + 3] = Math.round(alphaRatio * 255);
          if (!keepOriginalColor) {
            d[i] = 15;
            d[i + 1] = 23;
            d[i + 2] = 42;
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      setProcessedDataUrl(canvas.toDataURL('image/png'));
      canvas.toBlob((blob) => {
        if (blob) setProcessedImageBlob(blob);
      }, 'image/png');
    };
  }, [rawImageSrc, inkStrength, keepOriginalColor]);

  // Save the signature through the real backend API
  const handleSaveSignature = async () => {
    if (!selectedFile) return;
    try {
      setSavingSignature(true);
      const fileToUpload = processedImageBlob
        ? new File([processedImageBlob], selectedFile.name.replace(/\.[^/.]+$/, '.png'), {
            type: 'image/png',
          })
        : selectedFile;

      const updatedAsset = await uploadCRFSignatureAsset(modalKind, fileToUpload);
      setAssets((prev) => [...prev.filter((a) => a.kind !== modalKind), updatedAsset]);
      success('Signature Saved', `${KIND_TITLES[modalKind]} has been saved.`);
      setModalOpen(false);
      setSelectedFile(null);
      setRawImageSrc(null);
    } catch (err: unknown) {
      notifyError('Upload Failed', getErrorMessage(err, 'Could not save signature'));
    } finally {
      setSavingSignature(false);
    }
  };

  // Remove a signature
  const handleRemoveSignature = async (kind: CRFSignatureKind) => {
    if (!window.confirm(`Are you sure you want to remove the ${KIND_TITLES[kind]}?`)) {
      return;
    }
    try {
      setDeletingKind(kind);
      await deleteCRFSignatureAsset(kind);
      setAssets((prev) => prev.filter((a) => a.kind !== kind));
      success('Signature Removed', `${KIND_TITLES[kind]} removed.`);
    } catch (err: unknown) {
      notifyError('Remove Failed', getErrorMessage(err, 'Could not remove signature'));
    } finally {
      setDeletingKind(null);
    }
  };

  // Save Backlog Fee
  const handleSaveBacklogFee = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = Number(feeInput.replace(/[^0-9]/g, ''));
    if (!cleanNum || cleanNum < 0) {
      notifyError('Invalid Fee', 'Please enter a valid amount.');
      return;
    }
    try {
      setSavingFee(true);
      const res = await updateCRFBacklogPrice(cleanNum);
      const newPrice = Number(res.amount_per_backlog) || cleanNum;
      setBacklogFee(newPrice);
      setFeeInput(String(newPrice));
      success('Backlog Fee Updated', `Backlog fee set to ₦${newPrice.toLocaleString()}`);
    } catch (err: unknown) {
      notifyError('Save Failed', getErrorMessage(err, 'Could not update backlog fee'));
    } finally {
      setSavingFee(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 KB';
    return `${Math.round(bytes / 1024)} KB`;
  };

  const formatUpdatedDate = (isoString?: string): string => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
      />

      {/* ── Page Header ── */}
      <div>
        <nav className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
          <span>Academics</span>
          <span>›</span>
          <span>Course Forms</span>
        </nav>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {activeTab === 'history'
            ? 'Course Forms History'
            : activeTab === 'queue'
              ? 'Course Forms Queue'
              : 'Signature setup'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          {activeTab === 'history'
            ? 'View and download all uploaded and signed course registration forms across sessions, semesters and levels.'
            : activeTab === 'queue'
              ? 'Review student course forms awaiting verification or signature placement.'
              : 'Upload the HOD and Exam Officer signatures. Students place them on their own course forms.'}
        </p>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div className="inline-flex items-center p-1 rounded-full bg-slate-100 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/80 shadow-inner">
        <button
          onClick={() => setSearchParams({ tab: 'queue' })}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeTab === 'queue'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Queue</span>
        </button>

        <button
          onClick={() => setSearchParams({ tab: 'setup' })}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeTab === 'setup'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Signature setup</span>
        </button>

        <button
          onClick={() => setSearchParams({ tab: 'history' })}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>History</span>
          {submissions.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
              {submissions.length}
            </span>
          )}
        </button>
      </div>

      {/* ==================================================== */}
      {/* ── TAB 1: HISTORY (admin/crf-signing?tab=history) ── */}
      {/* ==================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* 4 Stat Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Total forms</p>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{totalSubmissions}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Signed & approved</p>
                <p className="text-xl sm:text-2xl font-extrabold text-emerald-400">{completedCount}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <FileCode className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Drafts / In-progress</p>
                <p className="text-xl sm:text-2xl font-extrabold text-amber-400">{draftCount}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Students</p>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{uniqueStudents}</p>
              </div>
            </div>
          </div>

          {/* Filters & Search Row */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name or matric number"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {historySearch && (
                <button
                  onClick={() => setHistorySearch('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Session Filter */}
              <select
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All sessions</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Semester Filter */}
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All semesters</option>
                <option value="first">First semester</option>
                <option value="second">Second semester</option>
              </select>

              {/* Level Filter */}
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All levels</option>
                <option value="100">100 Level</option>
                <option value="200">200 Level</option>
                <option value="300">300 Level</option>
                <option value="400">400 Level</option>
                <option value="500">500 Level</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All statuses</option>
                <option value="completed">Signed & approved</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a]/40 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4 sm:px-6">Student</th>
                    <th className="py-3.5 px-4">Level</th>
                    <th className="py-3.5 px-4">Session & Semester</th>
                    <th className="py-3.5 px-4">Submitted / Signed</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        <p>Loading course form history...</p>
                      </td>
                    </tr>
                  ) : filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold text-slate-300">No course forms found</p>
                        <p className="text-xs text-slate-500 mt-1">
                          When students upload and sign course forms, they will show here.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub) => {
                      const studentName = sub.student_name || 'Student';
                      const matric = sub.matric_number || '—';
                      const initials =
                        studentName
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase() || 'ST';
                      const sessionLabel = sub.session_name || 'Academic Session';
                      const semesterLabel = sub.semester_name
                        ? `${sub.semester_name.charAt(0).toUpperCase() + sub.semester_name.slice(1)} semester`
                        : 'Current semester';
                      const isCompleted = sub.status === 'completed';

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                          {/* Student */}
                          <td className="py-3 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700/80">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 dark:text-white truncate">{studentName}</p>
                                <p className="text-[11px] text-slate-500 truncate">{matric}</p>
                              </div>
                            </div>
                          </td>

                          {/* Level */}
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                              {sub.level ? `${sub.level}L` : '—'}
                            </span>
                          </td>

                          {/* Session & Semester */}
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-800 dark:text-slate-200">{sessionLabel}</p>
                            <p className="text-[11px] text-slate-400 capitalize">{semesterLabel}</p>
                          </td>

                          {/* Date */}
                          <td className="py-3 px-4 text-xs text-slate-500">
                            {sub.created_at ? formatUpdatedDate(sub.created_at) : '—'}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                                <Check className="w-3.5 h-3.5 stroke-[3]" /> Signed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                Draft
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 sm:px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isCompleted && sub.signed_file_path && (
                                <a
                                  href={sub.signed_file_path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Signed PDF</span>
                                </a>
                              )}

                              {sub.original_file_path && (
                                <a
                                  href={sub.original_file_path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Original</span>
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="py-3 px-6 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400">
              Showing {filteredSubmissions.length} of {submissions.length} course forms
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: QUEUE ── */}
      {activeTab === 'queue' && (
        <div className="p-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/40 text-center">
          <FileText className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-60" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No course forms in queue</h3>
          <p className="text-xs text-slate-400 mt-1">
            When students upload course registration forms or backlog requests, they will show here.
          </p>
        </div>
      )}

      {/* ── TAB 3: SIGNATURE SETUP (Screenshot 1) ── */}
      {activeTab === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols): 2 Signature Cards + Backlog Fee + How Signing Works */}
          <div className="lg:col-span-8 space-y-6">
            {/* 2 Signature Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: HOD Signature */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">HOD signature</h3>
                    {hodAsset ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Check className="w-3 h-3 stroke-[3]" /> Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-400">
                        Not set
                      </span>
                    )}
                  </div>

                  {/* Signature Preview Canvas Box */}
                  <div className="w-full h-32 rounded-xl border border-slate-200 dark:border-slate-800/80 overflow-hidden flex items-center justify-center p-3 relative bg-[radial-gradient(#334155_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:12px_12px] bg-slate-50 dark:bg-slate-950/60">
                    {hodAsset ? (
                      <img
                        src={getCRFSignatureImageUrl(hodAsset.file_path) ?? undefined}
                        alt="HOD Signature"
                        className="max-h-full max-w-full object-contain filter drop-shadow-sm"
                      />
                    ) : (
                      <p className="text-xs text-slate-400 font-medium">No signature uploaded yet</p>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                    This is what students see and place on their forms.{' '}
                    {hodAsset?.uploaded_at && <span>Last updated {formatUpdatedDate(hodAsset.uploaded_at)}.</span>}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => triggerFileSelect('hod')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{hodAsset ? 'Replace' : 'Upload'}</span>
                  </button>

                  {hodAsset && (
                    <button
                      type="button"
                      disabled={deletingKind === 'hod'}
                      onClick={() => handleRemoveSignature('hod')}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700/80 hover:bg-rose-500/10 hover:border-rose-500/40 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-rose-400 transition-colors"
                    >
                      {deletingKind === 'hod' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Card 2: Exam Officer Signature */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Exam Officer signature</h3>
                    {examOfficerAsset ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Check className="w-3 h-3 stroke-[3]" /> Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-400">
                        Not set
                      </span>
                    )}
                  </div>

                  {/* Signature Preview Canvas Box */}
                  <div className="w-full h-32 rounded-xl border border-slate-200 dark:border-slate-800/80 overflow-hidden flex items-center justify-center p-3 relative bg-[radial-gradient(#334155_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:12px_12px] bg-slate-50 dark:bg-slate-950/60">
                    {examOfficerAsset ? (
                      <img
                        src={getCRFSignatureImageUrl(examOfficerAsset.file_path) ?? undefined}
                        alt="Exam Officer Signature"
                        className="max-h-full max-w-full object-contain filter drop-shadow-sm"
                      />
                    ) : (
                      <p className="text-xs text-slate-400 font-medium">No signature uploaded yet</p>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                    This is what students see and place on their forms.{' '}
                    {examOfficerAsset?.uploaded_at && (
                      <span>Last updated {formatUpdatedDate(examOfficerAsset.uploaded_at)}.</span>
                    )}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => triggerFileSelect('exam_officer')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{examOfficerAsset ? 'Replace' : 'Upload'}</span>
                  </button>

                  {examOfficerAsset && (
                    <button
                      type="button"
                      disabled={deletingKind === 'exam_officer'}
                      onClick={() => handleRemoveSignature('exam_officer')}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700/80 hover:bg-rose-500/10 hover:border-rose-500/40 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-rose-400 transition-colors"
                    >
                      {deletingKind === 'exam_officer' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Backlog Fee Card */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Backlog fee</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Charged per old or unsigned course form a student submits. The total is the number of forms times
                    this amount. Changing it only affects new requests.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveBacklogFee} className="space-y-2 pt-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Fee per form</label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative w-full sm:w-48">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-sm text-slate-500">
                      ₦
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={feeInput}
                      disabled={!feeLoaded}
                      placeholder={feeLoaded ? '' : 'Not loaded'}
                      onChange={(e) => setFeeInput(e.target.value)}
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl text-sm font-bold bg-white dark:bg-[#162038] border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    Example: a student with 3 old forms pays{' '}
                    <span className="font-bold text-slate-900 dark:text-white">
                      ₦{((Number(feeInput) || 0) * 3).toLocaleString()}
                    </span>
                    .
                  </div>

                  <button
                    type="submit"
                    disabled={savingFee || !feeLoaded}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    {savingFee ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Save</span>
                  </button>
                </div>
              </form>
            </div>

            {/* How Signing Works Section */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-5">How signing works</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Step 1 */}
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 font-bold text-white text-xs flex items-center justify-center mb-1">
                    1
                  </div>
                  <Pencil className="w-4 h-4 text-blue-400" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white">You upload signatures</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    HOD and Exam Officer, once.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 font-bold text-white text-xs flex items-center justify-center mb-1">
                    2
                  </div>
                  <Upload className="w-4 h-4 text-blue-400" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Student uploads the form</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Their course registration form as a PDF.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 font-bold text-white text-xs flex items-center justify-center mb-1">
                    3
                  </div>
                  <FileCheck className="w-4 h-4 text-blue-400" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Student places signatures</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    They drag each one to the signing spot, since forms differ by year.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 font-bold text-white text-xs flex items-center justify-center mb-1">
                    4
                  </div>
                  <Download className="w-4 h-4 text-blue-400" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Final PDF is made</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    The student approves a preview. The server renders the signed PDF.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Readiness Banner & Tips Card */}
          <div className="lg:col-span-4 space-y-4">
            {/* Readiness Card */}
            <div
              className={`p-5 rounded-2xl border shadow-sm ${
                isReady ? 'bg-emerald-950/20 border-emerald-900/60' : 'bg-amber-950/20 border-amber-900/60'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isReady ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                  }`}
                >
                  {isReady ? <Check className="w-5 h-5 stroke-[3]" /> : <AlertCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isReady ? 'Ready for students' : 'Setup incomplete'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {isReady
                      ? 'Both signatures are set. Students can sign their course forms.'
                      : 'Upload both HOD and Exam Officer signatures so students can sign their course forms.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tips Card */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Tips</h4>
              <ul className="space-y-3 text-xs text-slate-400">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>Sign with a dark pen on plain white paper.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>Take the photo in good light.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>PNG or JPEG is fine.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>The paper background is removed for you.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ── MODAL: REPLACE / UPLOAD SIGNATURE (Screenshot 2) ── */}
      {/* ==================================================== */}
      {modalOpen && selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl bg-[#0f172a] border border-slate-800 shadow-2xl p-6 relative">
            {/* Close Button */}
            <button
              onClick={() => {
                setModalOpen(false);
                setSelectedFile(null);
                setRawImageSrc(null);
              }}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="mb-5">
              <h2 className="text-base font-bold text-white">Replace {KIND_TITLES[modalKind]}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedFile.name} · {formatFileSize(selectedFile.size)}
              </p>
            </div>

            {/* 2 Preview Boxes (Side by Side) */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {/* Box 1: YOUR PHOTO */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Your photo</p>
                <div className="w-full h-36 rounded-xl border border-slate-800 bg-[#e8e4d9] flex items-center justify-center p-2 overflow-hidden">
                  {rawImageSrc && (
                    <img src={rawImageSrc} alt="Uploaded raw" className="max-h-full max-w-full object-contain" />
                  )}
                </div>
              </div>

              {/* Box 2: WHAT STUDENTS SEE */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  What students see
                </p>
                <div className="w-full h-36 rounded-xl border border-slate-800 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:10px_10px] bg-slate-950 flex items-center justify-center p-2 overflow-hidden">
                  {processedDataUrl ? (
                    <img
                      src={processedDataUrl}
                      alt="Processed signature"
                      className="max-h-full max-w-full object-contain filter drop-shadow"
                    />
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-4 mb-6">
              {/* Ink Strength Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white">Ink strength</label>
                  <span className="text-xs text-slate-400">{inkStrength}%</span>
                </div>
                <p className="text-[11px] text-slate-400">Raise it if the signature looks faint.</p>
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={inkStrength}
                  onChange={(e) => setInkStrength(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Keep Original Ink Colour Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div>
                  <p className="text-xs font-semibold text-white">Keep original ink colour</p>
                  <p className="text-[11px] text-slate-400">Only the paper background is removed.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setKeepOriginalColor(!keepOriginalColor)}
                  className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                    keepOriginalColor ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                      keepOriginalColor ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setSelectedFile(null);
                  setRawImageSrc(null);
                }}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveSignature}
                disabled={savingSignature}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-sm flex items-center gap-1.5 transition-all"
              >
                {savingSignature ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 stroke-[2.5]" />
                )}
                <span>Save signature</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
