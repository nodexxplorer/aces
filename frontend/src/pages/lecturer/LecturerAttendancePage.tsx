import { useEffect, useRef, useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import Spinner from '../../components/ui/Spinner';
import { useAuthStore } from '../../stores/authStore';
import {
  ClipboardList,
  AlertCircle,
  BarChart3,
  Download,
  Plus,
  Radio,
  CheckCircle2,
  ShieldCheck,
  RotateCcw,
  Calendar,
  Eye,
} from 'lucide-react';
import {
  attendanceCatalog,
  attendanceSessions,
  attendanceDetail,
  attendanceEligibility,
  attendanceSnapshots,
  publishAttendanceSnapshot,
  type VerifiedSession,
  type AttendanceDetail,
  type EligibilityReport,
  type EligibilitySnapshot,
} from '../../api/verified-attendance';

import SessionCard from '../../components/attendance/SessionCard';
import SessionDetail from '../../components/attendance/SessionDetail';
import QRDisplay from '../../components/attendance/QRDisplay';
import CreateSessionForm from '../../components/attendance/CreateSessionForm';
import { cn } from '../../utils/cn';

import { useQuery } from '@tanstack/react-query';
const errMsg = (e: unknown) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
  (e instanceof Error ? e.message : 'Request failed.');
const label = (s: string) => s.replace(/_/g, ' ');

export default function LecturerAttendancePage() {
  const user = useAuthStore((s) => s.user);
  const [choice, setChoice] = useState('');
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState<VerifiedSession[]>([]);
  const [detail, setDetail] = useState<AttendanceDetail | null>(null);
  const [report, setReport] = useState<EligibilityReport | null>(null);
  const [snapshots, setSnapshots] = useState<EligibilitySnapshot[]>([]);
  const [tab, setTab] = useState('sessions');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'open' | 'draft' | 'closed' | 'finalized'>('all');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: _qd, isLoading: loading } = useQuery({
    queryKey: ['lecturer-attendance', user?.id],
    queryFn: async () => {
      const _r: any = { courses: [], choice: '', error: '' };
      const active = true;
      gen.current++;
      attendanceCatalog()
        .then((data) => {
          if (!active) return;
          const managed = data.courses.filter((c) => c.can_manage);
          _r.courses = managed;
          if (managed[0]) _r.choice = `${managed[0].id}:${managed[0].semester_id}`;
        })
        .catch((e) => {
          if (active) {
            _r.error = errMsg(e);
          }
        });
      return _r;
    },
    staleTime: 15_000,
  });
  const courses = _qd?.courses ?? [];
  useEffect(() => {
    if (_qd) {
      if (_qd.choice && !choice) setChoice(_qd.choice);
      if (_qd.error) setError(_qd.error);
    }
  }, [_qd, choice]);
  const gen = useRef(0);

  const course = courses.find((c: any) => `${c.id}:${c.semester_id}` === choice);

  // Load catalog
  // Load course data
  const loadCourse = async (rev?: number) => {
    if (!course) return;
    const r = rev ?? gen.current;
    try {
      const [sess, elig, snaps] = await Promise.all([
        attendanceSessions(course.id, course.semester_id),
        attendanceEligibility(course.id, course.semester_id),
        attendanceSnapshots(course.id, course.semester_id).catch(() => []),
      ]);
      if (r !== gen.current) return;
      setSessions(sess);
      setReport(elig);
      setSnapshots(snaps);
    } catch (e) {
      if (r === gen.current) setError(errMsg(e));
    }
  };

  useEffect(() => {
    const rev = ++gen.current;
    setDetail(null);
    setSessions([]);
    setReport(null);
    setSnapshots([]);
    setError('');
    void loadCourse(rev);
  }, [choice, course]);

  const selectSession = async (id: string) => {
    const rev = gen.current;
    setError('');
    try {
      const d = await attendanceDetail(id);
      if (rev === gen.current) setDetail(d);
    } catch (e) {
      if (rev === gen.current) setError(errMsg(e));
    }
  };

  const refreshAll = async () => {
    const rev = gen.current;
    await loadCourse(rev);
    if (detail) {
      try {
        const d = await attendanceDetail(detail.session.id);
        if (rev === gen.current) setDetail(d);
      } catch {
        /* ignore */
      }
    }
  };

  const publishSnapshot = async () => {
    if (!course || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await publishAttendanceSnapshot(course.id, course.semester_id);
      setNotice('Eligibility snapshot published successfully.');
      await loadCourse();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  // Derive stats
  const openSession = sessions.find((s) => s.status === 'open');
  const draftSessions = sessions.filter((s) => s.status === 'draft');
  const closedSessions = sessions.filter((s) => s.status === 'closed');
  const finalizedSessions = sessions.filter((s) => s.status === 'finalized');
  const flaggedCount = report?.results.reduce((n, r) => n + r.pending, 0) ?? 0;
  const eligibleCount = report?.results.filter((r) => r.decision === 'eligible').length ?? 0;
  const totalStudents = report?.results.length ?? 0;
  const clearanceRate = totalStudents > 0 ? Math.round((eligibleCount / totalStudents) * 100) : 0;

  // Auto-close countdown & background sync when openSession closes_at is reached
  useEffect(() => {
    if (!openSession || !openSession.closes_at) return;
    const closeTime = new Date(openSession.closes_at).getTime();
    const checkExpiry = () => {
      if (Date.now() >= closeTime) {
        setNotice(
          `Lecture "${openSession.title}" check-in window elapsed. Official records have been automatically closed.`,
        );
        void refreshAll();
      }
    };
    checkExpiry();
    const interval = window.setInterval(checkExpiry, 1000);
    return () => window.clearInterval(interval);
  }, [openSession?.id, openSession?.closes_at]);

  // Auto-select open session or first session if none selected
  useEffect(() => {
    if (openSession && (!detail || detail.session.id !== openSession.id)) {
      void selectSession(openSession.id);
    } else if (!detail && sessions.length > 0 && tab === 'sessions') {
      void selectSession(sessions[0].id);
    }
  }, [openSession?.id, sessions.length]);

  const filteredSessions = sessions.filter((s) => {
    if (sessionFilter === 'all') return true;
    return s.status === sessionFilter;
  });

  const tabDefs = [
    { id: 'sessions', label: 'Lectures & Sessions', badge: sessions.length > 0 ? sessions.length : undefined },
    { id: 'create', label: 'Create Lecture' },
    { id: 'review', label: 'Review Queue', badge: flaggedCount > 0 ? flaggedCount : undefined },
    { id: 'reports', label: 'Eligibility & Reports' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] gap-3">
        <Spinner size="lg" />
        <p className="text-xs text-surface-500 font-medium">Loading attendance courses...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ────────────────── MODERN HEADER ────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-white shadow-md shadow-primary-500/25">
              <ClipboardList className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-surface-900 dark:text-surface-100">
              Attendance &amp; Verification Hub
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 mt-1">
            Monitor live lecture check-ins, auto-closing session timers, review student exceptions, and publish exam
            clearance lists.
          </p>
        </div>

        {course && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={tab === 'create' ? 'primary' : 'outline'}
              onClick={() => setTab('create')}
              className="gap-1.5 rounded-xl shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Lecture</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void refreshAll()}
              className="rounded-xl"
              title="Refresh attendance records"
            >
              <RotateCcw className={cn('w-4 h-4', busy && 'animate-spin')} />
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-danger-50 dark:bg-danger-500/10 text-danger-700 dark:text-danger-400 text-xs font-semibold shadow-sm border border-danger-200 dark:border-danger-900/30">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400 text-xs font-semibold shadow-sm border border-success-200 dark:border-success-900/30">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* ────────────────── COURSE SELECTION & KPI CARDS ────────────────── */}
      {courses.length > 0 ? (
        <div className="space-y-4">
          {/* Course Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-surface-200 dark:border-surface-700/60 bg-white dark:bg-[#1a1d21] shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300 font-bold text-sm">
                {course?.code || 'Course'}
              </span>
              <div>
                <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">
                  {course?.title || 'Select a course'}
                </h3>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {course?.academic_year} · {course?.semester} Semester
                </p>
              </div>
            </div>

            {/* Switch Course Select */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-surface-500 hidden sm:inline">Course:</span>
              <select
                className="rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-3 py-2 text-xs font-semibold shadow-sm focus:ring-2 focus:ring-primary-500"
                value={choice}
                onChange={(e) => {
                  setChoice(e.target.value);
                  setTab('sessions');
                }}
              >
                {courses.map((c: any) => (
                  <option key={`${c.id}:${c.semester_id}`} value={`${c.id}:${c.semester_id}`}>
                    {c.code} — {c.title} ({c.academic_year} {c.semester})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Live Session Indicator */}
            <div
              className={cn(
                'rounded-2xl border p-4 transition-all shadow-sm',
                openSession
                  ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500/20'
                  : 'border-surface-200 dark:border-surface-700/60 bg-white dark:bg-[#1a1d21]',
              )}
            >
              <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
                <span className="font-medium">Live Lecture</span>
                {openSession ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                ) : (
                  <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                )}
              </div>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-surface-900 dark:text-surface-100">
                  {openSession ? 'Active Now' : 'Idle'}
                </span>
                <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400 truncate">
                  {openSession ? openSession.title : 'No session open'}
                </p>
              </div>
            </div>

            {/* 2. Total Held Lectures */}
            <div className="rounded-2xl border border-surface-200 dark:border-surface-700/60 bg-white dark:bg-[#1a1d21] p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
                <span className="font-medium">Lectures Held</span>
                <Calendar className="w-4 h-4 text-primary-500" />
              </div>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-surface-900 dark:text-surface-100">
                  {closedSessions.length + finalizedSessions.length}{' '}
                  <span className="text-xs font-normal text-surface-500">of {sessions.length}</span>
                </span>
                <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
                  {draftSessions.length} draft ready
                </p>
              </div>
            </div>

            {/* 3. Review Queue / Flagged Exceptions */}
            <div className="rounded-2xl border border-surface-200 dark:border-surface-700/60 bg-white dark:bg-[#1a1d21] p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
                <span className="font-medium">Exceptions &amp; Reviews</span>
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-surface-900 dark:text-surface-100">
                  {flaggedCount}
                </span>
                <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
                  {flaggedCount > 0 ? 'Pending verification review' : 'All clear'}
                </p>
              </div>
            </div>

            {/* 4. Exam Clearance Rate */}
            <div className="rounded-2xl border border-surface-200 dark:border-surface-700/60 bg-white dark:bg-[#1a1d21] p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
                <span className="font-medium">Exam Clearance (≥75%)</span>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
                  {clearanceRate}%
                </span>
                <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
                  {eligibleCount} of {totalStudents} students
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Card>
          <div className="p-12 text-center text-surface-500 dark:text-surface-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30 text-primary-500" />
            <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">No Courses Assigned</h3>
            <p className="mt-1 text-xs">
              You do not currently have course assignments configured for attendance management.
            </p>
          </div>
        </Card>
      )}

      {course && (
        <>
          <Tabs tabs={tabDefs} activeTab={tab} onChange={setTab} />

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* ═══ SESSIONS TAB ════════════════════════════════════════════════ */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === 'sessions' && (
            <div className="space-y-6">
              {/* ── Active Live Lecture Spotlight (when open) ── */}
              {openSession &&
                detail?.session.id === openSession.id &&
                detail.session.status === 'open' &&
                detail.canOperate && (
                  <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30 p-6 dark:from-[#13281e] dark:via-[#1a1d21] dark:to-[#12221b] shadow-lg shadow-emerald-500/5">
                    <div className="flex flex-col lg:flex-row gap-8 items-center">
                      {/* Live rotating QR display */}
                      <div className="shrink-0 flex flex-col items-center">
                        <QRDisplay sessionId={openSession.id} onError={setError} />
                      </div>

                      {/* Live details & auto-closing notice */}
                      <div className="flex-1 space-y-4">
                        <div>
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            <Radio className="w-3.5 h-3.5 animate-pulse" />
                            <span>LIVE CHECK-IN WINDOW ACTIVE</span>
                          </div>
                          <h3 className="text-2xl font-extrabold text-surface-900 dark:text-surface-100 mt-2">
                            {openSession.title}
                          </h3>
                          <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                            QR code rotates every 59 seconds to prevent sharing. The session will automatically close
                            when time elapses.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="p-3 rounded-xl bg-white/80 dark:bg-surface-800/80 border border-emerald-200/50 dark:border-emerald-800/30">
                            <span className="text-surface-500 block">Venue</span>
                            <span className="font-bold text-surface-900 dark:text-surface-100">
                              {openSession.venue}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-white/80 dark:bg-surface-800/80 border border-emerald-200/50 dark:border-emerald-800/30">
                            <span className="text-surface-500 block">Closes At</span>
                            <span className="font-bold text-surface-900 dark:text-surface-100">
                              {openSession.closes_at ? new Date(openSession.closes_at).toLocaleTimeString() : '—'}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-white/80 dark:bg-surface-800/80 border border-emerald-200/50 dark:border-emerald-800/30">
                            <span className="text-surface-500 block">Enrolled Roster</span>
                            <span className="font-bold text-surface-900 dark:text-surface-100">
                              {detail.records.length} students
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-white/80 dark:bg-surface-800/80 border border-emerald-200/50 dark:border-emerald-800/30">
                            <span className="text-surface-500 block">Checked In</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              {detail.records.filter((r) => r.submitted_at).length} (
                              {detail.records.length > 0
                                ? Math.round(
                                    (detail.records.filter((r) => r.submitted_at).length / detail.records.length) * 100,
                                  )
                                : 0}
                              %)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* ── Master-Detail Layout ── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Sessions List (5 cols) */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">
                      Lectures ({sessions.length})
                    </h3>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1">
                      {(['all', 'open', 'draft', 'closed'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setSessionFilter(f)}
                          className={cn(
                            'px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all capitalize',
                            sessionFilter === f
                              ? 'bg-surface-900 text-white dark:bg-white dark:text-surface-900'
                              : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800',
                          )}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredSessions.length === 0 ? (
                    <Card>
                      <div className="p-8 text-center text-surface-500 dark:text-surface-400">
                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">No {sessionFilter !== 'all' ? sessionFilter : ''} sessions found.</p>
                        <Button size="sm" variant="outline" onClick={() => setTab('create')} className="mt-3 text-xs">
                          Create lecture
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredSessions.map((s) => (
                        <SessionCard
                          key={s.id}
                          session={s}
                          active={detail?.session.id === s.id}
                          onClick={() => void selectSession(s.id)}
                          stats={{
                            checkedIn: 0,
                            total: 0,
                            flagged: 0,
                            disputes: 0,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Column: Session Detail (7 cols) */}
                <div className="lg:col-span-7">
                  {detail ? (
                    <SessionDetail
                      detail={detail}
                      currentUserId={user?.id || ''}
                      onRefresh={() => void refreshAll()}
                      role="lecturer"
                    />
                  ) : (
                    <Card>
                      <div className="p-12 text-center text-surface-500 dark:text-surface-400">
                        <Eye className="w-10 h-10 mx-auto mb-3 opacity-30 text-primary-500" />
                        <h4 className="text-sm font-bold text-surface-900 dark:text-surface-100">Select a Lecture</h4>
                        <p className="mt-1 text-xs">
                          Click any session from the left list to inspect attendee check-ins, manage QR display, and
                          finalize attendance.
                        </p>
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* ═══ CREATE TAB ══════════════════════════════════════════════════ */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === 'create' && (
            <div className="max-w-2xl mx-auto">
              <CreateSessionForm
                courseId={course.id}
                semesterId={course.semester_id}
                onCreated={() => {
                  setTab('sessions');
                  void loadCourse();
                }}
              />
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* ═══ REVIEW QUEUE TAB ════════════════════════════════════════════ */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === 'review' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300">
                <span className="font-bold">Review Queue Policy:</span> Flagged check-in records (outside GPS geofence
                or device fingerprint change) and student disputes must be reviewed before final official records are
                locked for semester examination clearance.
              </div>

              {closedSessions.length === 0 ? (
                <Card>
                  <div className="p-12 text-center text-surface-500 dark:text-surface-400">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-60" />
                    <p className="text-sm font-bold text-surface-900 dark:text-surface-100">
                      No Closed Sessions Awaiting Review
                    </p>
                    <p className="text-xs mt-1">
                      When lectures finish and check-in windows close, their review queues appear here.
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {closedSessions.map((s) => (
                    <Card
                      key={s.id}
                      hover
                      onClick={() => {
                        void selectSession(s.id);
                        setTab('sessions');
                      }}
                      className="cursor-pointer"
                    >
                      <div className="p-5 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-surface-900 dark:text-surface-100">{s.title}</p>
                          <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                            {new Date(s.scheduled_at).toLocaleDateString()} · {s.venue}
                          </p>
                        </div>
                        <Badge variant="warning">Needs review &rarr;</Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* ═══ REPORTS TAB ═════════════════════════════════════════════════ */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {tab === 'reports' && report && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary-500" />
                    Official Exam Clearance Report
                  </h2>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    Students must meet 75% attendance across all held lectures to qualify for examination clearance.
                  </p>
                </div>

                <Button size="sm" disabled={busy} isLoading={busy} onClick={() => void publishSnapshot()}>
                  <Download className="w-4 h-4" />
                  Publish official snapshot
                </Button>
              </div>

              <Card padding="none">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
                        <th className="text-left py-3 px-4 font-semibold text-surface-600 dark:text-surface-300">
                          Student
                        </th>
                        <th className="text-center py-3 px-3 font-semibold text-surface-600 dark:text-surface-300">
                          Credited / Held
                        </th>
                        <th className="text-center py-3 px-3 font-semibold text-surface-600 dark:text-surface-300">
                          Percentage
                        </th>
                        <th className="text-center py-3 px-3 font-semibold text-surface-600 dark:text-surface-300">
                          Pending Reviews
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-surface-600 dark:text-surface-300">
                          Exam Eligibility
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                      {report.results.map((r) => (
                        <tr
                          key={r.user_id}
                          className="hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span className="font-bold text-surface-900 dark:text-surface-100 block">{r.matric}</span>
                            <span className="text-surface-500 dark:text-surface-400">{r.name}</span>
                          </td>
                          <td className="text-center py-3 px-3 font-medium text-surface-700 dark:text-surface-300">
                            {r.credited} / {r.total}
                          </td>
                          <td className="text-center py-3 px-3">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all duration-300',
                                    r.percentage !== null && r.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500',
                                  )}
                                  style={{ width: `${Math.min(100, r.percentage ?? 0)}%` }}
                                />
                              </div>
                              <span className="font-semibold text-surface-800 dark:text-surface-200">
                                {r.percentage !== null ? `${r.percentage.toFixed(1)}%` : '—'}
                              </span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-3">
                            {r.pending > 0 ? <Badge variant="warning">{r.pending}</Badge> : '0'}
                          </td>
                          <td className="text-center py-3 px-4">
                            <Badge
                              variant={
                                r.decision === 'eligible'
                                  ? 'success'
                                  : r.decision === 'not_eligible'
                                    ? 'danger'
                                    : r.decision === 'pending_review'
                                      ? 'warning'
                                      : 'default'
                              }
                            >
                              {label(r.decision)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Snapshot history */}
              {snapshots.length > 0 && (
                <Card>
                  <div className="p-5 space-y-3">
                    <h3 className="font-bold text-surface-900 dark:text-surface-100 text-sm">
                      Published Official Snapshots
                    </h3>
                    {snapshots.map((snap) => (
                      <details key={snap.id} className="border-t border-surface-100 dark:border-surface-700/50 pt-3">
                        <summary className="cursor-pointer text-xs font-semibold text-surface-700 dark:text-surface-300">
                          Snapshot Version {snap.version} · {new Date(snap.created_at).toLocaleString()} ·{' '}
                          {snap.policy_version}
                        </summary>
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-surface-500">
                                <th className="text-left py-1">Student</th>
                                <th className="text-center py-1">Credited / Held</th>
                                <th className="text-center py-1">%</th>
                                <th className="text-center py-1">Decision</th>
                              </tr>
                            </thead>
                            <tbody>
                              {snap.results.map((r) => (
                                <tr key={r.user_id} className="border-t border-surface-100 dark:border-surface-700/50">
                                  <td className="py-1">
                                    {r.name} ({r.matric})
                                  </td>
                                  <td className="text-center py-1">
                                    {r.credited}/{r.total}
                                  </td>
                                  <td className="text-center py-1">
                                    {r.percentage !== null ? `${r.percentage.toFixed(1)}%` : '—'}
                                  </td>
                                  <td className="text-center py-1">{label(r.decision)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
