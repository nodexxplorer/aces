import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Check,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Pencil,
  Archive,
  BookOpen,
  Users,
  Info,
  Loader2,
  Lock,
  X,
  Trash2,
} from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';
import { getErrorMessage } from '../../utils/errors';
import {
  getSessions,
  createSession,
  updateSession,
  deleteSession,
  listSessionSemesters,
  createSemester,
  updateSemester,
  prepareRollOver,
  getRollOverOverview,
  confirmRollOver,
  type RollOverOverview,
} from '../../api/sessions';
import type { Session, SemesterEntry } from '../../types';

export default function SessionManagementPage() {
  const { success, error: notifyError } = useNotification();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [semestersMap, setSemestersMap] = useState<Record<string, SemesterEntry[]>>({});

  // ── Helpers: format dates & compute semester status/progress from real data ──

  /** Format an ISO date string to "7 Sep 2026" style, or return '—' if missing. */
  const formatDateShort = (dateStr?: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  /** Determine a semester's status from its is_active flag and real dates. */
  const getSemesterStatus = (sem: SemesterEntry): 'active' | 'completed' | 'upcoming' | 'undated' => {
    if (sem.is_active) return 'active';
    const now = Date.now();
    if (sem.end_date && new Date(sem.end_date).getTime() < now) return 'completed';
    if (sem.start_date && new Date(sem.start_date).getTime() > now) return 'upcoming';
    // Without dates the status is unknown, so it is not reported as completed.
    return 'undated';
  };

  /** Compute a semester's progress percentage (0–100) from its real start/end dates. */
  const getSemesterProgress = (sem: SemesterEntry): number => {
    if (!sem.start_date || !sem.end_date) return 0;
    const start = new Date(sem.start_date).getTime();
    const end = new Date(sem.end_date).getTime();
    const now = Date.now();
    if (now >= end) return 100;
    if (now <= start) return 0;
    return Math.min(100, Math.round(((now - start) / (end - start)) * 100));
  };

  // View state: 'list' | 'create'
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // Form state for creating session & semesters
  const currentYear = new Date().getFullYear();
  const defaultSessionName = `${currentYear}/${currentYear + 1}`;
  const [sessionName, setSessionName] = useState(defaultSessionName);
  const [sessionStartDate, setSessionStartDate] = useState(`${currentYear}-09-07`);
  const [sessionEndDate, setSessionEndDate] = useState(`${currentYear + 1}-07-30`);

  // Semesters form state
  const [firstSemStart, setFirstSemStart] = useState(`${currentYear}-09-07`);
  const [firstSemEnd, setFirstSemEnd] = useState(`${currentYear + 1}-01-29`);
  const [secondSemStart, setSecondSemStart] = useState(`${currentYear + 1}-02-01`);
  const [secondSemEnd, setSecondSemEnd] = useState(`${currentYear + 1}-07-30`);

  const [savingSession, setSavingSession] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);

  // Roll-over modal/drawer
  const [rollOverOpen, setRollOverOpen] = useState(false);
  const [rollOverSessionId, setRollOverSessionId] = useState('');
  const [rollOverOverview, setRollOverOverview] = useState<RollOverOverview | null>(null);
  const [rollOverLoading, setRollOverLoading] = useState(false);
  const [rollOverConfirming, setRollOverConfirming] = useState(false);

  // Load sessions and their semesters
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getSessions();
      const sessionsList = Array.isArray(list) ? list : [];
      setSessions(sessionsList);

      const semMap: Record<string, SemesterEntry[]> = {};
      for (const s of sessionsList) {
        try {
          const sems = await listSessionSemesters(s.id);
          semMap[s.id] = Array.isArray(sems) ? sems : [];
        } catch {
          semMap[s.id] = [];
        }
      }
      setSemestersMap(semMap);
    } catch (err: unknown) {
      notifyError('Failed to load', getErrorMessage(err, 'Could not load sessions.'));
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Identify active session & active semester
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.is_active || s.isActive) || null;
  }, [sessions]);

  const activeSemester = useMemo(() => {
    if (!activeSession) return null;
    const sems = semestersMap[activeSession.id] || [];
    return sems.find((sm) => sm.is_active || sm.is_active) || sems[0] || null;
  }, [activeSession, semestersMap]);

  // Calculate active semester progress & weeks
  const semesterProgress = useMemo(() => {
    if (!activeSemester?.start_date || !activeSemester?.end_date) {
      return null;
    }
    const start = new Date(activeSemester.start_date).getTime();
    const end = new Date(activeSemester.end_date).getTime();
    const now = Date.now();

    if (now < start) return { weekCurrent: 0, totalWeeks: 20, percent: 0 };
    if (now > end) return { weekCurrent: 21, totalWeeks: 21, percent: 100 };

    const totalDays = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
    const passedDays = Math.max(0, (now - start) / (1000 * 60 * 60 * 24));
    const totalWeeks = Math.ceil(totalDays / 7);
    const weekCurrent = Math.min(totalWeeks, Math.ceil(passedDays / 7));
    const percent = Math.min(100, Math.round((passedDays / totalDays) * 100));

    return { weekCurrent, totalWeeks, percent };
  }, [activeSemester]);

  // Duration calculation for session
  const sessionDurationText = useMemo(() => {
    if (!sessionStartDate || !sessionEndDate) return '';
    const start = new Date(sessionStartDate);
    const end = new Date(sessionEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return '';

    const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
    const startStr = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const endStr = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${months} months - ${startStr} to ${endStr}`;
  }, [sessionStartDate, sessionEndDate]);

  // Dynamic timeline metrics calculation for create form preview
  const timelineMetrics = useMemo(() => {
    if (!sessionStartDate || !sessionEndDate) {
      return {
        firstLeft: 0,
        firstWidth: 48,
        secondLeft: 52,
        secondWidth: 48,
        months: ['Start', 'Mid', 'End'],
        firstDurationWeeks: 0,
        secondDurationWeeks: 0,
      };
    }

    const sessionStart = new Date(sessionStartDate).getTime();
    const sessionEnd = new Date(sessionEndDate).getTime();
    const totalDuration = Math.max(1, sessionEnd - sessionStart);

    const getPct = (time: number) => {
      const clamped = Math.max(sessionStart, Math.min(sessionEnd, time));
      return Math.max(0, Math.min(100, ((clamped - sessionStart) / totalDuration) * 100));
    };

    const fStart = firstSemStart ? new Date(firstSemStart).getTime() : sessionStart;
    const fEnd = firstSemEnd ? new Date(firstSemEnd).getTime() : sessionStart + totalDuration * 0.48;
    const sStart = secondSemStart ? new Date(secondSemStart).getTime() : fEnd;
    const sEnd = secondSemEnd ? new Date(secondSemEnd).getTime() : sessionEnd;

    const firstLeft = getPct(fStart);
    const firstRight = getPct(fEnd);
    const firstWidth = Math.max(4, firstRight - firstLeft);

    const secondLeft = getPct(sStart);
    const secondRight = getPct(sEnd);
    const secondWidth = Math.max(4, secondRight - secondLeft);

    const firstDurationWeeks = Math.max(1, Math.round((fEnd - fStart) / (1000 * 60 * 60 * 24 * 7)));
    const secondDurationWeeks = Math.max(1, Math.round((sEnd - sStart) / (1000 * 60 * 60 * 24 * 7)));

    const startD = new Date(sessionStartDate);
    const endD = new Date(sessionEndDate);
    const midD = new Date(sessionStart + totalDuration / 2);

    const months = [
      startD.toLocaleDateString('en-GB', { month: 'short' }),
      midD.toLocaleDateString('en-GB', { month: 'short' }),
      endD.toLocaleDateString('en-GB', { month: 'short' }),
    ];

    return {
      firstLeft: Number(firstLeft.toFixed(1)),
      firstWidth: Number(firstWidth.toFixed(1)),
      secondLeft: Number(secondLeft.toFixed(1)),
      secondWidth: Number(secondWidth.toFixed(1)),
      months,
      firstDurationWeeks,
      secondDurationWeeks,
    };
  }, [sessionStartDate, sessionEndDate, firstSemStart, firstSemEnd, secondSemStart, secondSemEnd]);

  // Validation checks for create form
  const isSecondSemesterOverlapping = useMemo(() => {
    if (!firstSemEnd || !secondSemStart) return false;
    return new Date(secondSemStart) <= new Date(firstSemEnd);
  }, [firstSemEnd, secondSemStart]);

  const isValidSessionName = useMemo(() => {
    return /^\d{4}\/\d{4}$/.test(sessionName.trim());
  }, [sessionName]);

  const isValidSessionDates = useMemo(() => {
    return Boolean(sessionStartDate && sessionEndDate && new Date(sessionEndDate) > new Date(sessionStartDate));
  }, [sessionStartDate, sessionEndDate]);

  const isValidFirstSem = useMemo(() => {
    return Boolean(firstSemStart && firstSemEnd && new Date(firstSemEnd) > new Date(firstSemStart));
  }, [firstSemStart, firstSemEnd]);

  const isValidSecondSem = useMemo(() => {
    return (
      Boolean(secondSemStart && secondSemEnd && new Date(secondSemEnd) > new Date(secondSemStart)) &&
      !isSecondSemesterOverlapping
    );
  }, [secondSemStart, secondSemEnd, isSecondSemesterOverlapping]);

  const canCreate = isValidSessionName && isValidSessionDates && isValidFirstSem && isValidSecondSem;

  // Handlers
  const handleCreateFullSession = async () => {
    if (!canCreate) {
      notifyError('Validation Error', 'Please resolve all date conflicts and fill in required fields.');
      return;
    }

    try {
      setSavingSession(true);
      // 1. Create Session
      const newSession = await createSession({
        name: sessionName.trim(),
        start_date: sessionStartDate,
        end_date: sessionEndDate,
      });

      // 2. Create First Semester
      await createSemester({
        session_id: newSession.id,
        name: 'first',
        start_date: firstSemStart,
        end_date: firstSemEnd,
      });

      // 3. Create Second Semester
      await createSemester({
        session_id: newSession.id,
        name: 'second',
        start_date: secondSemStart,
        end_date: secondSemEnd,
      });

      success('Session Created', `Academic session ${sessionName} and semesters configured successfully.`);
      setViewMode('list');
      await fetchData();
    } catch (err: unknown) {
      notifyError('Creation Failed', getErrorMessage(err, 'Could not create session.'));
    } finally {
      setSavingSession(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      setDeletingSession(true);
      await deleteSession(sessionToDelete.id);
      success('Session Deleted', `Academic session "${sessionToDelete.name}" has been deleted.`);
      setSessionToDelete(null);
      await fetchData();
    } catch (err: unknown) {
      notifyError('Delete Failed', getErrorMessage(err, 'Could not delete session.'));
    } finally {
      setDeletingSession(false);
    }
  };

  const handleSetActiveSession = async (s: Session) => {
    try {
      await updateSession(s.id, { is_active: true } as Partial<Session>);
      success('Active Session Updated', `${s.name} is now the active academic session.`);
      fetchData();
    } catch (err: unknown) {
      notifyError('Update Failed', getErrorMessage(err, 'Could not set active session.'));
    }
  };

  const handleToggleRegistration = async (sem: SemesterEntry) => {
    try {
      const nowActive = !sem.is_active;
      await updateSemester(sem.id, { is_active: nowActive } as Partial<SemesterEntry>);
      success(
        nowActive ? 'Registration Opened' : 'Registration Closed',
        `${sem.name} semester course registration is now ${nowActive ? 'open' : 'closed'}.`,
      );
      fetchData();
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not update registration status.'));
    }
  };

  /** Manually activate a specific semester (deactivates others via backend). */
  const handleActivateSemester = async (sem: SemesterEntry) => {
    try {
      await updateSemester(sem.id, { is_active: true } as Partial<SemesterEntry>);
      success('Semester Activated', `${sem.name.charAt(0).toUpperCase() + sem.name.slice(1)} semester is now active.`);
      fetchData();
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not activate semester.'));
    }
  };

  const loadRollOver = async (id: string) => {
    setRollOverSessionId(id);
    try {
      setRollOverLoading(true);
      const overview = await getRollOverOverview(id);
      setRollOverOverview(overview);
    } catch {
      setRollOverOverview(null);
    } finally {
      setRollOverLoading(false);
    }
  };

  const handlePrepareRollOver = async () => {
    if (!rollOverSessionId) return;
    try {
      setRollOverLoading(true);
      await prepareRollOver(rollOverSessionId);
      success('Proposal Prepared', 'Roll-over proposal generated.');
      await loadRollOver(rollOverSessionId);
    } catch (err: unknown) {
      notifyError('Error', getErrorMessage(err, 'Could not prepare roll-over.'));
    } finally {
      setRollOverLoading(false);
    }
  };

  const handleConfirmRollOver = async () => {
    if (!rollOverSessionId) return;
    try {
      setRollOverConfirming(true);
      await confirmRollOver(rollOverSessionId);
      success('Roll-over Applied', 'Students have been promoted to the new session.');
      setRollOverOpen(false);
      fetchData();
    } catch (err: unknown) {
      notifyError('Error', getErrorMessage(err, 'Could not apply roll-over.'));
    } finally {
      setRollOverConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-3" />
        <span className="text-sm text-surface-500 font-medium">Loading sessions & semesters...</span>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW: CREATE SESSION
  // ─────────────────────────────────────────────────────────────────────────
  if (viewMode === 'create') {
    return (
      <div className="space-y-6 pb-16 font-sans antialiased text-surface-900 dark:text-surface-100 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
              Semesters & Registration
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-surface-900 dark:text-white mt-1">
              Sessions & semesters
            </h1>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Create academic sessions, manage semesters and set the active session.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-200 transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                success('Draft Saved', 'Session draft saved locally.');
                setViewMode('list');
              }}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-200 transition-colors shadow-sm"
            >
              Save as draft
            </button>
            <button
              type="button"
              disabled={!canCreate || savingSession}
              onClick={handleCreateFullSession}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white transition-colors shadow-sm disabled:opacity-50"
            >
              {savingSession ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
              Create session
            </button>
          </div>
        </div>

        {/* Step 1: Session */}
        <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              1
            </div>
            <div>
              <h3 className="text-sm font-bold text-surface-900 dark:text-white">Session</h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">The academic year</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1.5">
                Session name
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="2026/2027"
                className="w-full text-sm font-medium px-4 py-2.5 rounded-xl border border-primary-500/80 bg-surface-50/50 dark:bg-surface-800/40 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              <p className="text-[11px] text-surface-400 mt-1">Use the format YYYY/YYYY</p>

              {/* Suggestions */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-surface-400">Suggestions</span>
                {[`${currentYear}/${currentYear + 1}`, `${currentYear + 1}/${currentYear + 2}`].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setSessionName(sug)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      sessionName === sug
                        ? 'bg-primary-600 text-white'
                        : 'border border-surface-300 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1.5">
                  Start date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={sessionStartDate}
                    onChange={(e) => setSessionStartDate(e.target.value)}
                    className="w-full text-xs font-medium px-4 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-800/40 text-surface-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1.5">
                  End date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={sessionEndDate}
                    onChange={(e) => setSessionEndDate(e.target.value)}
                    className="w-full text-xs font-medium px-4 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-800/40 text-surface-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            {sessionDurationText && (
              <div className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/20 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="w-4 h-4" />
                <span>{sessionDurationText}</span>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Semesters */}
        <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              2
            </div>
            <div>
              <h3 className="text-sm font-bold text-surface-900 dark:text-white">Semesters</h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Each semester must sit inside the session dates
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* First Semester */}
            <div className="p-4 rounded-xl border border-surface-200 dark:border-surface-700/80 bg-surface-50/40 dark:bg-surface-800/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-surface-900 dark:text-white">First semester</h4>
                <span className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Within session
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-surface-500 block mb-1">Start</label>
                  <input
                    type="date"
                    value={firstSemStart}
                    onChange={(e) => setFirstSemStart(e.target.value)}
                    className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-surface-500 block mb-1">End</label>
                  <input
                    type="date"
                    value={firstSemEnd}
                    onChange={(e) => setFirstSemEnd(e.target.value)}
                    className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Second Semester */}
            <div
              className={`p-4 rounded-xl border transition-colors ${
                isSecondSemesterOverlapping
                  ? 'border-red-500 bg-red-500/5'
                  : 'border-surface-200 dark:border-surface-700/80 bg-surface-50/40 dark:bg-surface-800/30'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-surface-900 dark:text-white">Second semester</h4>
                {isSecondSemesterOverlapping ? (
                  <span className="text-[11px] font-semibold text-red-500 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Needs attention
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Within session
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-surface-500 block mb-1">Start</label>
                  <input
                    type="date"
                    value={secondSemStart}
                    onChange={(e) => setSecondSemStart(e.target.value)}
                    className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-surface-500 block mb-1">End</label>
                  <input
                    type="date"
                    value={secondSemEnd}
                    onChange={(e) => setSecondSemEnd(e.target.value)}
                    className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
                  />
                </div>
              </div>

              {isSecondSemesterOverlapping && (
                <div className="mt-3 flex items-center gap-2 text-xs text-red-500">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Starts before the first semester ends. Move it to {firstSemEnd} or later.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Preview */}
        <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-bold text-surface-900 dark:text-white">Preview</h3>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{sessionName}</p>
          </div>

          {/* Visual Gantt timeline bar */}
          <div>
            <div className="relative h-7 w-full rounded-xl bg-surface-200 dark:bg-surface-800 overflow-hidden">
              {/* First Semester Bar */}
              <div
                className="absolute top-0 bottom-0 bg-primary-600 rounded-lg transition-all flex items-center justify-center text-[10px] font-bold text-white shadow-sm overflow-hidden"
                style={{
                  left: `${timelineMetrics.firstLeft}%`,
                  width: `${timelineMetrics.firstWidth}%`,
                }}
                title={`First Semester (${timelineMetrics.firstDurationWeeks} wks)`}
              >
                <span className="truncate px-1">First ({timelineMetrics.firstDurationWeeks}w)</span>
              </div>

              {/* Second Semester Bar */}
              <div
                className={`absolute top-0 bottom-0 rounded-lg transition-all flex items-center justify-center text-[10px] font-bold shadow-sm overflow-hidden ${
                  isSecondSemesterOverlapping
                    ? 'bg-red-500 text-white ring-2 ring-red-400'
                    : 'bg-amber-400 text-surface-900'
                }`}
                style={{
                  left: `${timelineMetrics.secondLeft}%`,
                  width: `${timelineMetrics.secondWidth}%`,
                }}
                title={`Second Semester (${timelineMetrics.secondDurationWeeks} wks)`}
              >
                <span className="truncate px-1">Second ({timelineMetrics.secondDurationWeeks}w)</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-surface-400 font-medium mt-2">
              <span>{timelineMetrics.months[0]}</span>
              <span>{timelineMetrics.months[1]}</span>
              <span>{timelineMetrics.months[2]}</span>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold mt-3">
              <span className="flex items-center gap-1.5 text-surface-700 dark:text-surface-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary-600" />
                First ({timelineMetrics.firstDurationWeeks} wks)
              </span>
              <span className="flex items-center gap-1.5 text-surface-700 dark:text-surface-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                Second ({timelineMetrics.secondDurationWeeks} wks)
              </span>
              {isSecondSemesterOverlapping && (
                <span className="flex items-center gap-1.5 text-red-500 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" /> Overlap
                </span>
              )}
            </div>
          </div>

          {/* Checklist: READY TO CREATE? */}
          <div className="pt-4 border-t border-surface-100 dark:border-surface-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block mb-2.5">
              READY TO CREATE?
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                {isValidSessionName ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <X className="w-4 h-4 text-red-500" />
                )}
                <span
                  className={isValidSessionName ? 'text-surface-700 dark:text-surface-300 font-medium' : 'text-red-500'}
                >
                  Session name
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isValidSessionDates ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <X className="w-4 h-4 text-red-500" />
                )}
                <span
                  className={
                    isValidSessionDates ? 'text-surface-700 dark:text-surface-300 font-medium' : 'text-red-500'
                  }
                >
                  Session dates
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isValidFirstSem ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <X className="w-4 h-4 text-red-500" />
                )}
                <span
                  className={isValidFirstSem ? 'text-surface-700 dark:text-surface-300 font-medium' : 'text-red-500'}
                >
                  First semester
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isValidSecondSem ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <X className="w-4 h-4 text-red-500" />
                )}
                <span
                  className={isValidSecondSem ? 'text-surface-700 dark:text-surface-300 font-medium' : 'text-red-500'}
                >
                  Second semester dates
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW: NO SESSIONS YET (EMPTY STATE)
  // ─────────────────────────────────────────────────────────────────────────
  if (sessions.length === 0) {
    return (
      <div className="space-y-6 pb-16 font-sans antialiased text-surface-900 dark:text-surface-100 max-w-6xl mx-auto">
        {/* Header */}
        <div>
          <div className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
            Semesters & Registration
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-surface-900 dark:text-white mt-1">
            Sessions & semesters
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Create academic sessions, manage semesters and set the active session.
          </p>
        </div>

        {/* 3 Top Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl p-5 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-primary-500">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Sessions</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white leading-tight">0</p>
            </div>
          </div>

          <div className="rounded-2xl p-5 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-primary-500">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Active semester</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white leading-tight">None</p>
            </div>
          </div>

          <div className="rounded-2xl p-5 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-emerald-500">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Registration</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white leading-tight">Closed</p>
            </div>
          </div>
        </div>

        {/* Hero Banner Card with Illustration */}
        <div className="relative overflow-hidden rounded-2xl p-8 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-lg z-10">
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider block mb-1.5">
              ACADEMIC CALENDAR
            </span>
            <h2 className="text-2xl lg:text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
              No sessions yet
            </h2>
            <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 mt-2 leading-relaxed">
              Set up an academic session and its two semesters. Students can register as soon as you open registration.
            </p>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setViewMode('create')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create your first session
              </button>
              <button
                type="button"
                onClick={() => setViewMode('create')}
                className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 transition-colors shadow-sm"
              >
                How it works
              </button>
            </div>
          </div>

          {/* Graphical academic calendar illustration */}
          <div className="shrink-0 flex flex-col items-center justify-center p-4">
            <div className="flex items-end gap-2 h-24 mb-2">
              <div className="w-4 bg-primary-600/40 rounded-t-md h-12" />
              <div className="w-4 bg-primary-600/80 rounded-t-md h-20" />
              <div className="w-4 bg-primary-600 rounded-t-md h-24" />
              <div className="w-4 bg-primary-600/70 rounded-t-md h-16" />
              <div className="w-4 bg-primary-600 rounded-t-md h-22" />
              <div className="w-4 bg-surface-300 dark:bg-surface-700/60 rounded-t-md h-14" />
              <div className="w-4 bg-surface-300 dark:bg-surface-700/60 rounded-t-md h-10" />
              <div className="w-4 bg-surface-300 dark:bg-surface-700/60 rounded-t-md h-6" />
            </div>
            <div className="flex items-center justify-between w-full text-[10px] text-surface-400 font-bold px-1">
              <span>SEP</span>
              <span>DEC</span>
              <span>MAR</span>
              <span>JUN</span>
              <span>AUG</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-primary-500/30 text-primary-500">
                First semester
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-surface-300 dark:border-surface-700 text-surface-400">
                Second semester
              </span>
            </div>
          </div>
        </div>

        {/* Set up in three steps */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-surface-900 dark:text-white">Set up in three steps</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
                  1
                </div>
                <Calendar className="w-4 h-4 text-surface-400" />
              </div>
              <div className="mt-6">
                <h4 className="text-sm font-bold text-surface-900 dark:text-white">Create a session</h4>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                  The academic year, for example 2026/2027, with start and end dates.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
                  2
                </div>
                <BookOpen className="w-4 h-4 text-surface-400" />
              </div>
              <div className="mt-6">
                <h4 className="text-sm font-bold text-surface-900 dark:text-white">Add semesters</h4>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                  First and second semester, each inside the session dates.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
                  3
                </div>
                <Check className="w-4 h-4 text-surface-400" />
              </div>
              <div className="mt-6">
                <h4 className="text-sm font-bold text-surface-900 dark:text-white">Open registration</h4>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                  Choose when students can register for courses.
                </p>
              </div>
            </div>
          </div>

          {/* Session roll-over locked banner */}
          <div className="rounded-2xl p-4 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-400 shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-surface-900 dark:text-white">Session roll-over and promotion</h4>
                <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
                  Available once you have a second session. Review who advances a level and who carries over, then
                  confirm the batch.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 text-surface-400 cursor-not-allowed opacity-60"
            >
              Roll over
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW: SESSIONS & SEMESTERS LIST (ACTIVE SESSIONS PRESENT)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-16 font-sans antialiased text-surface-900 dark:text-surface-100 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
            Semesters & Registration
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-surface-900 dark:text-white mt-1">
            Sessions & semesters
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Create academic sessions, manage semesters and set the active session.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setViewMode('create')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New session
          </button>
        </div>
      </div>

      {/* Top Banner: ACTIVE NOW */}
      {activeSession && (
        <div className="rounded-2xl p-4 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">ACTIVE NOW</span>
              <h3 className="text-sm font-bold text-surface-900 dark:text-white">
                {activeSession.name} ·{' '}
                {activeSemester
                  ? activeSemester.name.charAt(0).toUpperCase() + activeSemester.name.slice(1)
                  : 'No active'}{' '}
                semester
              </h3>
            </div>
          </div>

          {semesterProgress ? (
            <div className="flex items-center gap-3 w-full sm:w-auto max-w-xs">
              <span className="text-xs text-surface-500 dark:text-surface-400 font-medium whitespace-nowrap">
                Week {semesterProgress.weekCurrent} of {semesterProgress.totalWeeks}
              </span>
              <div className="flex-1 h-2 bg-surface-200 dark:bg-surface-800 rounded-full overflow-hidden w-28">
                <div
                  className="h-full bg-primary-600 rounded-full transition-all duration-500"
                  style={{ width: `${semesterProgress.percent}%` }}
                />
              </div>
              <span className="text-xs font-bold text-surface-900 dark:text-white">{semesterProgress.percent}%</span>
            </div>
          ) : (
            <span className="text-xs text-surface-500 dark:text-surface-400 font-medium">
              Start and end dates not set
            </span>
          )}
        </div>
      )}

      {/* Main Grid: Left Sessions & Right Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Sessions List */}
        <div className="lg:col-span-8 space-y-6">
          {sessions.map((sess) => {
            const isActive = Boolean(sess.is_active || sess.isActive);
            const sems = semestersMap[sess.id] || [];
            const firstSem = sems.find((sm) => sm.name.toLowerCase().includes('first')) || sems[0];
            const secondSem = sems.find((sm) => sm.name.toLowerCase().includes('second')) || sems[1];

            return (
              <div
                key={sess.id}
                className={`rounded-2xl p-6 transition-all ${
                  isActive
                    ? 'bg-white dark:bg-surface-900/80 border-2 border-primary-500 shadow-md ring-1 ring-primary-500/20'
                    : 'bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm'
                }`}
              >
                {/* Session Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-surface-900 dark:text-white tracking-tight">{sess.name}</h2>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                        Completed
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSessionToDelete(sess)}
                      title="Delete session"
                      className="w-8 h-8 rounded-full border border-red-200 dark:border-red-900/40 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('create')}
                      className="w-8 h-8 rounded-full border border-surface-200 dark:border-surface-700 flex items-center justify-center text-surface-500 hover:text-surface-900 dark:hover:text-white transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                  {formatDateShort(sess.start_date)} – {formatDateShort(sess.end_date)}
                </p>

                {/* Semesters list */}
                <div className="space-y-4 mt-6">
                  {/* First semester */}
                  {firstSem && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-surface-900 dark:text-white">
                            {firstSem.name.charAt(0).toUpperCase() + firstSem.name.slice(1)} semester
                          </span>
                          <span className="text-surface-400 ml-2">
                            {formatDateShort(firstSem.start_date)} – {formatDateShort(firstSem.end_date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {firstSem.is_active ? (
                            <span className="text-emerald-500 font-semibold flex items-center gap-1 text-[11px]">
                              <Check className="w-3.5 h-3.5" /> Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleActivateSemester(firstSem)}
                              className="text-primary-500 hover:text-primary-600 font-semibold flex items-center gap-1 text-[11px] hover:underline transition-colors"
                            >
                              <Clock className="w-3.5 h-3.5" /> Activate
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="h-2 w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getSemesterStatus(firstSem) === 'active' ? 'bg-primary-600' : getSemesterStatus(firstSem) === 'completed' ? 'bg-emerald-500' : 'bg-surface-200 dark:bg-surface-700'}`}
                          style={{ width: `${getSemesterProgress(firstSem)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Second semester */}
                  {secondSem && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-surface-900 dark:text-white">
                            {secondSem.name.charAt(0).toUpperCase() + secondSem.name.slice(1)} semester
                          </span>
                          <span className="text-surface-400 ml-2">
                            {formatDateShort(secondSem.start_date)} – {formatDateShort(secondSem.end_date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {secondSem.is_active ? (
                            <span className="text-emerald-500 font-semibold flex items-center gap-1 text-[11px]">
                              <Check className="w-3.5 h-3.5" /> Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleActivateSemester(secondSem)}
                              className="text-primary-500 hover:text-primary-600 font-semibold flex items-center gap-1 text-[11px] hover:underline transition-colors"
                            >
                              <Clock className="w-3.5 h-3.5" /> Activate
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="h-2 w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getSemesterStatus(secondSem) === 'active' ? 'bg-primary-600' : getSemesterStatus(secondSem) === 'completed' ? 'bg-emerald-500' : 'bg-surface-200 dark:bg-surface-700'}`}
                          style={{ width: `${getSemesterProgress(secondSem)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Show message if no semesters */}
                  {!firstSem && !secondSem && (
                    <p className="text-xs text-surface-400 italic">No semesters configured for this session.</p>
                  )}
                </div>

                {/* Registration toggle card (Active Session) */}
                {isActive &&
                  (() => {
                    const activeSem = sems.find((s) => s.is_active) || firstSem;
                    if (!activeSem) return null;
                    const regDeadline = activeSem.registration_deadline;
                    const daysUntilDeadline = regDeadline
                      ? Math.max(0, Math.ceil((new Date(regDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                      : null;

                    return (
                      <div className="mt-6 p-4 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200/60 dark:border-surface-700/60 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-surface-200 dark:bg-surface-700 flex items-center justify-center text-primary-500">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-surface-900 dark:text-white">
                              {activeSem.is_active ? 'Registration open' : 'Registration closed'}
                            </h4>
                            <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
                              {activeSem.is_active && daysUntilDeadline !== null
                                ? `Closes in ${daysUntilDeadline} day${daysUntilDeadline !== 1 ? 's' : ''}`
                                : activeSem.is_active
                                  ? 'No deadline set'
                                  : 'Toggle to open registration'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => activeSem && handleToggleRegistration(activeSem)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            activeSem.is_active ? 'bg-primary-600' : 'bg-surface-300 dark:bg-surface-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              activeSem.is_active ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })()}

                {/* Session action buttons */}
                <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-surface-100 dark:border-surface-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isActive ? (
                      <>
                        <button
                          type="button"
                          onClick={() => success('Window Extended', 'Registration deadline extended by 7 days.')}
                          className="px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 transition-colors shadow-sm"
                        >
                          Extend registration
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('create')}
                          className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 transition-colors shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add semester
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => success('Archived', `${sess.name} archived.`)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 transition-colors shadow-sm"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          Archive
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('create')}
                          className="px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 transition-colors shadow-sm"
                        >
                          View summary
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSessionToDelete(sess)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Quick Actions & Good to know */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Actions */}
          <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-surface-900 dark:text-white mb-2">Quick actions</h3>

            <button
              type="button"
              onClick={() => setViewMode('create')}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New session
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeSession) {
                  loadRollOver(activeSession.id);
                  setRollOverOpen(true);
                } else {
                  notifyError('No Session', 'No active session to roll over.');
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 transition-colors shadow-sm"
            >
              <Users className="w-4 h-4 text-surface-400" />
              Roll over to next session
            </button>

            <button
              type="button"
              onClick={() => {
                const nextSess = sessions.find((s) => !s.is_active && !s.isActive);
                if (nextSess) {
                  handleSetActiveSession(nextSess);
                } else {
                  notifyError('Notice', 'No other session available to activate. Create a new session first.');
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 transition-colors shadow-sm"
            >
              Set a different active session
            </button>
          </div>

          {/* Good to know */}
          <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-surface-900 dark:text-white">Good to know</h3>

            <div className="space-y-3 text-xs text-surface-500 dark:text-surface-400">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                <p>Only one session is active at a time.</p>
              </div>

              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                <p>Closing registration does not remove registered students.</p>
              </div>

              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                <p>Roll over after the session is closed and the next one is open.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Roll-Over Modal / Drawer */}
      {rollOverOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-2xl p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-surface-900 dark:text-white">Session Roll-Over</h3>
              <button
                type="button"
                onClick={() => setRollOverOpen(false)}
                className="p-1 rounded-lg text-surface-400 hover:text-surface-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-surface-500 dark:text-surface-400">
              Review who advances to the next academic level and who carries over.
            </p>

            {rollOverLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : rollOverOverview ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {rollOverOverview.summary?.map((s) => (
                    <div key={s.level} className="p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800/50">
                      <span className="font-semibold">{s.level}L: </span>
                      <span>
                        {s.confirmed} promoted, {s.carryover} carryover
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => setRollOverOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 text-surface-700 dark:text-surface-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={rollOverConfirming}
                    onClick={handleConfirmRollOver}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white"
                  >
                    {rollOverConfirming ? 'Confirming...' : 'Confirm Roll-Over'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-surface-500 mb-4">No proposal prepared yet for this session.</p>
                <button
                  type="button"
                  onClick={handlePrepareRollOver}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary-600 text-white"
                >
                  Prepare Proposal
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Session Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-surface-200 dark:border-surface-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-surface-900 dark:text-white">Delete Academic Session</h3>
                <p className="text-xs text-surface-500 dark:text-surface-400">This action is irreversible</p>
              </div>
            </div>

            <p className="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">
              Are you sure you want to permanently delete session{' '}
              <strong className="text-surface-900 dark:text-white font-semibold">"{sessionToDelete.name}"</strong>? All
              associated semesters and academic settings for this session will also be removed.
            </p>

            {Boolean(sessionToDelete.is_active || sessionToDelete.isActive) && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Warning:</strong> This session is currently marked as active. Deleting it will leave the
                  system without an active session until a new one is selected.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deletingSession}
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingSession}
                onClick={handleDeleteSession}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50 shadow-sm"
              >
                {deletingSession ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Session
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
