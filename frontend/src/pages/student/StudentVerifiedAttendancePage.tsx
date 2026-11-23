import { useEffect, useRef, useState, useMemo } from 'react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import { useAuthStore } from '../../stores/authStore';
import {
  BookOpen,
  AlertCircle,
  ChevronRight,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertTriangle,
  Radio,
  TrendingUp,
  TrendingDown,
  Eye,
  ChevronDown,
  BarChart3,
  Target,
  GraduationCap,
  Layers,
} from 'lucide-react';
import {
  attendanceCatalog,
  attendanceSessions,
  attendanceDetail,
  attendanceEligibility,
  attendanceSnapshots,
  type AttendanceCourse,
  type VerifiedSession,
  type AttendanceDetail,
  type EligibilityReport,
  type EligibilitySnapshot,
} from '../../api/verified-attendance';
import SessionDetail from '../../components/attendance/SessionDetail';

import { useQuery } from '@tanstack/react-query';
const msg = (e: unknown) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
  (e instanceof Error ? e.message : 'Failed to load attendance data.');
const label = (s: string) => s.replace(/_/g, ' ');

/* ═══════════════════════════════════════════
   Animated Radial Gauge
   ═══════════════════════════════════════════ */
function RadialGauge({
  value,
  size = 140,
  strokeWidth = 10,
  threshold = 75,
}: {
  value: number | null;
  size?: number;
  strokeWidth?: number;
  threshold?: number;
}) {
  const pct = value ?? 0;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(pct, 100) / 100) * circ;
  const thresholdAngle = (threshold / 100) * 360 - 90;
  const thresholdRad = (thresholdAngle * Math.PI) / 180;
  const tx = size / 2 + (r + 6) * Math.cos(thresholdRad);
  const ty = size / 2 + (r + 6) * Math.sin(thresholdRad);
  const color = value === null ? '#6b7280' : pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} className="drop-shadow-lg">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        className="text-surface-200 dark:text-surface-700"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - filled}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-1000 ease-out"
      />
      {/* 75% threshold marker */}
      <circle cx={tx} cy={ty} r={2.5} fill="currentColor" className="text-surface-400 dark:text-surface-500" />
      <text
        x={size / 2}
        y={size / 2 - 4}
        textAnchor="middle"
        className="fill-surface-900 dark:fill-white font-extrabold"
        style={{ fontSize: value === null ? '1.4rem' : '1.8rem' }}
      >
        {value !== null ? `${pct.toFixed(0)}%` : '—'}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 16}
        textAnchor="middle"
        className="fill-surface-500 dark:fill-surface-400"
        style={{ fontSize: '0.65rem', fontWeight: 600 }}
      >
        ATTENDANCE
      </text>
    </svg>
  );
}

/* ═══════════════════════════════════════════
   Mini Stat Card
   ═══════════════════════════════════════════ */
function StatCard({
  icon: Icon,
  label: statLabel,
  value,
  accent,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-surface-200/60 dark:border-surface-700/40 bg-white/60 dark:bg-surface-800/40 backdrop-blur-sm p-3.5">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-surface-500 dark:text-surface-400 font-medium">{statLabel}</p>
        <p className="text-sm font-bold text-surface-900 dark:text-white truncate">{value}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Session Timeline Item
   ═══════════════════════════════════════════ */
function SessionTimelineItem({
  session,
  ownOutcome,
  active,
  onClick,
}: {
  session: VerifiedSession;
  ownOutcome?: { verification: string; outcome: string; flags: string[] };
  active: boolean;
  onClick: () => void;
}) {
  const isLive = session.status === 'open';
  const isCancelled = session.status === 'cancelled';
  const scheduledDate = new Date(session.scheduled_at);

  const statusColor = isLive
    ? 'bg-emerald-500'
    : isCancelled
      ? 'bg-rose-500'
      : session.status === 'finalized'
        ? 'bg-blue-500'
        : session.status === 'closed'
          ? 'bg-amber-500'
          : 'bg-slate-400';

  const getOutcomeIcon = () => {
    if (!ownOutcome) return <Clock className="w-4 h-4 text-surface-400" />;
    if (ownOutcome.outcome === 'present' || ownOutcome.outcome === 'late') {
      if (ownOutcome.verification === 'verified' || ownOutcome.verification === 'approved')
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      if (ownOutcome.verification === 'flagged') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      return <Clock className="w-4 h-4 text-blue-500" />;
    }
    return <XCircle className="w-4 h-4 text-rose-500" />;
  };

  return (
    <button
      onClick={onClick}
      className={`group relative w-full text-left transition-all duration-200 ${
        active ? 'scale-[1.01]' : 'hover:scale-[1.005]'
      }`}
    >
      <div
        className={`relative rounded-2xl border p-4 transition-all duration-200 ${
          active
            ? 'border-primary-500/50 bg-primary-50/30 dark:bg-primary-950/20 shadow-lg shadow-primary-500/10 ring-1 ring-primary-500/20'
            : 'border-surface-200/60 dark:border-surface-700/40 bg-white dark:bg-[#1a1d21] hover:shadow-md hover:border-surface-300 dark:hover:border-surface-600'
        }`}
      >
        {/* Live pulse indicator */}
        {isLive && (
          <div className="absolute -top-1.5 -right-1.5 flex items-center gap-1 rounded-full bg-emerald-500 pl-1.5 pr-2.5 py-0.5 shadow-lg shadow-emerald-500/30">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            <span className="text-[9px] font-bold text-white uppercase tracking-wider">Live</span>
          </div>
        )}

        <div className="flex items-center gap-3.5">
          {/* Timeline dot */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div
              className={`h-3 w-3 rounded-full ${statusColor} ${isLive ? 'animate-pulse' : ''} ring-2 ring-white dark:ring-surface-900`}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-sm text-surface-900 dark:text-white truncate">{session.title}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-surface-500 dark:text-surface-400">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {scheduledDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {scheduledDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {session.venue}
              </span>
            </div>
          </div>

          {/* Right side: outcome + chevron */}
          <div className="flex items-center gap-2 shrink-0">
            {getOutcomeIcon()}
            <ChevronRight className="w-4 h-4 text-surface-300 dark:text-surface-600 group-hover:text-primary-500 transition-colors" />
          </div>
        </div>

        {/* Own attendance badge */}
        {ownOutcome && (
          <div className="mt-2.5 pt-2.5 border-t border-surface-100 dark:border-surface-700/40 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                ownOutcome.outcome === 'present'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : ownOutcome.outcome === 'late'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
              }`}
            >
              {ownOutcome.outcome === 'present' ? 'Present' : ownOutcome.outcome === 'late' ? 'Late' : 'Absent'}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                ownOutcome.verification === 'verified' || ownOutcome.verification === 'approved'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                  : ownOutcome.verification === 'flagged'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                    : ownOutcome.verification === 'rejected'
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                      : 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400'
              }`}
            >
              {label(ownOutcome.verification)}
            </span>
            {ownOutcome.flags.length > 0 && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                · {ownOutcome.flags.length} flag{ownOutcome.flags.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════
   Course Chip Selector
   ═══════════════════════════════════════════ */
function CourseChips({
  courses,
  choice,
  onSelect,
}: {
  courses: AttendanceCourse[];
  choice: string;
  onSelect: (val: string) => void;
}) {
  if (courses.length <= 4) {
    return (
      <div className="flex flex-wrap gap-2">
        {courses.map((c) => {
          const val = `${c.id}:${c.semester_id}`;
          const isActive = val === choice;
          return (
            <button
              key={val}
              onClick={() => onSelect(val)}
              className={`group relative flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'border-primary-500/50 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300 shadow-md shadow-primary-500/10 ring-1 ring-primary-500/20'
                  : 'border-surface-200 dark:border-surface-700/50 bg-white dark:bg-[#1a1d21] text-surface-700 dark:text-surface-300 hover:border-primary-300 hover:shadow-sm'
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold ${
                  isActive
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 group-hover:bg-primary-100 group-hover:text-primary-600'
                }`}
              >
                {c.code.slice(0, 3)}
              </span>
              <div className="text-left">
                <span className="block text-xs font-bold">{c.code}</span>
                <span className="block text-[10px] font-medium text-surface-500 dark:text-surface-400 truncate max-w-[150px]">
                  {c.title}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Fallback to dropdown for many courses
  return (
    <div className="relative">
      <Layers className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-500" />
      <select
        className="w-full appearance-none rounded-2xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-[#1a1d21] pl-10 pr-10 py-3 text-sm font-semibold shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        value={choice}
        onChange={(e) => onSelect(e.target.value)}
      >
        {courses.map((c) => (
          <option key={`${c.id}:${c.semester_id}`} value={`${c.id}:${c.semester_id}`}>
            {c.code} — {c.title} · {c.academic_year} {c.semester}
            {c.is_active === false ? ' (archived)' : ''}
          </option>
        ))}
      </select>
      <ChevronDown className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
    </div>
  );
}

/* ═══════════════════════════════════════════
   Active Tab Enum
   ═══════════════════════════════════════════ */
type TabKey = 'overview' | 'sessions' | 'eligibility';

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
export default function StudentVerifiedAttendancePage() {
  const user = useAuthStore((s) => s.user);
  const [choice, setChoice] = useState('');
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState<VerifiedSession[]>([]);
  const [detail, setDetail] = useState<AttendanceDetail | null>(null);
  const [report, setReport] = useState<EligibilityReport | null>(null);
  const [snapshots, setSnapshots] = useState<EligibilitySnapshot[]>([]);
  const [tab, setTab] = useState<TabKey>('overview');

  const { data: _qd, isLoading: loading } = useQuery({
    queryKey: ['student-verified-attendance', user?.id],
    queryFn: async () => {
      const _r: any = { courses: [], choice: '', error: '' };
      const active = true;
      generation.current++;
      attendanceCatalog()
        .then((data) => {
          if (!active) return;
          _r.courses = data.courses;
          if (data.courses[0]) _r.choice = `${data.courses[0].id}:${data.courses[0].semester_id}`;
        })
        .catch((e) => {
          if (active) {
            _r.error = msg(e);
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
  const generation = useRef(0);

  const course = courses.find((c: any) => `${c.id}:${c.semester_id}` === choice);

  /* ── Load catalog ── */
  /* ── Load sessions + eligibility ── */
  useEffect(() => {
    if (!course) return;
    const rev = ++generation.current;
    setDetail(null);
    setSessions([]);
    setReport(null);
    setSnapshots([]);
    setError('');
    Promise.all([
      attendanceSessions(course.id, course.semester_id),
      attendanceEligibility(course.id, course.semester_id),
      attendanceSnapshots(course.id, course.semester_id).catch(() => []),
    ])
      .then(([sess, elig, snaps]) => {
        if (rev !== generation.current) return;
        setSessions(sess);
        setReport(elig);
        setSnapshots(snaps);
      })
      .catch((e) => {
        if (rev === generation.current) setError(msg(e));
      });
  }, [choice, course]);

  const selectSession = async (id: string) => {
    const rev = generation.current;
    setError('');
    setTab('sessions');
    try {
      const d = await attendanceDetail(id);
      if (rev === generation.current) setDetail(d);
    } catch (e) {
      if (rev === generation.current) setError(msg(e));
    }
  };

  const refreshDetail = async () => {
    if (!detail || !course) return;
    const rev = generation.current;
    try {
      const [d, sess, elig] = await Promise.all([
        attendanceDetail(detail.session.id),
        attendanceSessions(course.id, course.semester_id),
        attendanceEligibility(course.id, course.semester_id),
      ]);
      if (rev === generation.current) {
        setDetail(d);
        setSessions(sess);
        setReport(elig);
      }
    } catch {
      /* ignore */
    }
  };

  /* ── Derived data ── */
  const ownResult = report?.results.find((r) => r.user_id === user?.id);
  const pct = ownResult?.percentage ?? null;
  const credited = ownResult?.credited ?? 0;
  const total = ownResult?.total ?? 0;
  const pending = ownResult?.pending ?? 0;

  // Build a lookup of own records per session
  const ownRecordMap = useMemo(() => {
    if (!detail) return new Map<string, { verification: string; outcome: string; flags: string[] }>();
    const map = new Map<string, { verification: string; outcome: string; flags: string[] }>();
    // We only have detail for the selected session; populate from full detail
    for (const r of detail.records) {
      if (r.user_id === user?.id) {
        map.set(detail.session.id, { verification: r.verification, outcome: r.outcome, flags: r.flags });
      }
    }
    return map;
  }, [detail, user?.id]);

  // Count live sessions
  const liveSessions = sessions.filter((s) => s.status === 'open');
  const totalHeld = sessions.filter((s) => ['open', 'closed', 'finalized'].includes(s.status)).length;

  // Decision display
  const decisionMeta: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    eligible: { label: 'Exam Eligible', color: 'text-emerald-600 dark:text-emerald-400', icon: ShieldCheck },
    not_eligible: { label: 'Not Eligible', color: 'text-rose-600 dark:text-rose-400', icon: XCircle },
    pending_review: { label: 'Under Review', color: 'text-amber-600 dark:text-amber-400', icon: Clock },
    not_assessable: { label: 'Not Assessed', color: 'text-surface-500', icon: AlertCircle },
  };
  const decision = ownResult
    ? decisionMeta[ownResult.decision] || decisionMeta.not_assessable
    : decisionMeta.not_assessable;
  const DecisionIcon = decision.icon;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-surface-500 dark:text-surface-400 animate-pulse">Loading your attendance…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-white flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25">
              <BookOpen className="w-5 h-5" />
            </div>
            My Attendance
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 ml-[52px]">
            Track your attendance records and exam eligibility
          </p>
        </div>
      </div>

      {/* ═══ ERROR ═══ */}
      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-danger-50 dark:bg-danger-500/10 border border-danger-200/50 dark:border-danger-800/30 text-danger-700 dark:text-danger-400 text-sm font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ═══ EMPTY STATE ═══ */}
      {courses.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800 mb-4">
              <BookOpen className="w-8 h-8 text-surface-400" />
            </div>
            <h3 className="text-lg font-bold text-surface-700 dark:text-surface-200 mb-1">No courses found</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 max-w-sm mx-auto">
              Make sure your course registration is approved for this semester. Attendance records will appear here once
              your lecturer holds a session.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* ═══ COURSE SELECTOR ═══ */}
          <CourseChips courses={courses} choice={choice} onSelect={setChoice} />

          {/* ═══ LIVE SESSION BANNER ═══ */}
          {liveSessions.length > 0 && (
            <button
              onClick={() => void selectSession(liveSessions[0].id)}
              className="w-full text-left rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 p-4 shadow-lg shadow-emerald-500/10 hover:shadow-xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
                    <Radio className="w-5 h-5" />
                  </div>
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Live Check-In Active
                  </p>
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 truncate">
                    {liveSessions[0].title} · {liveSessions[0].venue}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-500 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          )}

          {/* ═══ OVERVIEW HERO + STATS ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Gauge + Decision */}
            <div className="lg:col-span-5">
              <Card>
                <div className="p-6 flex flex-col items-center text-center">
                  <RadialGauge value={pct} />
                  <div className="mt-4 space-y-2">
                    <div className={`inline-flex items-center gap-1.5 text-sm font-bold ${decision.color}`}>
                      <DecisionIcon className="w-4 h-4" />
                      {decision.label}
                    </div>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {credited} of {total} session{total !== 1 ? 's' : ''} credited
                      {pending > 0 && <span className="text-amber-600 dark:text-amber-400"> · {pending} pending</span>}
                    </p>
                    {/* Threshold indicator */}
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <div className="h-1.5 flex-1 max-w-[200px] rounded-full bg-surface-100 dark:bg-surface-700 overflow-hidden relative">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
                            (pct ?? 0) >= 75 ? 'bg-emerald-500' : (pct ?? 0) >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
                        />
                        <div className="absolute inset-y-0 left-[75%] w-0.5 bg-surface-400 dark:bg-surface-500" />
                      </div>
                      <span className="text-[10px] text-surface-400 font-semibold whitespace-nowrap">75% min</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Stats Grid */}
            <div className="lg:col-span-7 grid grid-cols-2 gap-3">
              <StatCard
                icon={BarChart3}
                label="Sessions Held"
                value={totalHeld}
                accent="bg-gradient-to-br from-blue-500 to-blue-600"
              />
              <StatCard
                icon={CheckCircle2}
                label="Present"
                value={credited}
                accent="bg-gradient-to-br from-emerald-500 to-emerald-600"
              />
              <StatCard
                icon={Clock}
                label="Pending Review"
                value={pending}
                accent="bg-gradient-to-br from-amber-500 to-amber-600"
              />
              <StatCard
                icon={Target}
                label="Target"
                value="≥ 75%"
                accent="bg-gradient-to-br from-purple-500 to-purple-600"
              />
              <div className="col-span-2">
                <StatCard
                  icon={(pct ?? 0) >= 75 ? TrendingUp : TrendingDown}
                  label="Eligibility Trend"
                  value={
                    pct === null
                      ? 'No data yet'
                      : pct >= 75
                        ? `On track — ${(pct - 75).toFixed(0)}% above threshold`
                        : `${(75 - pct).toFixed(0)}% below threshold — attend more lectures`
                  }
                  accent={
                    (pct ?? 0) >= 75
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                      : 'bg-gradient-to-br from-rose-500 to-rose-600'
                  }
                />
              </div>
            </div>
          </div>

          {/* ═══ TAB NAVIGATION ═══ */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-surface-100/80 dark:bg-surface-800/60 backdrop-blur-sm border border-surface-200/50 dark:border-surface-700/30">
            {[
              { key: 'overview' as TabKey, label: 'Session History', icon: Calendar },
              { key: 'sessions' as TabKey, label: 'Session Detail', icon: Eye },
              { key: 'eligibility' as TabKey, label: 'Eligibility', icon: GraduationCap },
            ].map(({ key, label: tabLabel, icon: TabIcon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs font-bold transition-all duration-200 ${
                  tab === key
                    ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                    : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tabLabel}</span>
              </button>
            ))}
          </div>

          {/* ═══ TAB CONTENT ═══ */}

          {/* Sessions Timeline */}
          {tab === 'overview' && (
            <div>
              {sessions.length === 0 ? (
                <Card>
                  <div className="p-10 text-center">
                    <Calendar className="w-10 h-10 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      No sessions recorded yet for this course.
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-surface-900 dark:text-white">Session History</h2>
                    <span className="text-xs text-surface-500 dark:text-surface-400 font-medium">
                      {sessions.length} session{sessions.length !== 1 ? 's' : ''} total
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {sessions.map((s) => (
                      <SessionTimelineItem
                        key={s.id}
                        session={s}
                        ownOutcome={ownRecordMap.get(s.id)}
                        active={detail?.session.id === s.id}
                        onClick={() => void selectSession(s.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Session Detail */}
          {tab === 'sessions' &&
            (detail ? (
              <SessionDetail
                detail={detail}
                currentUserId={user?.id || ''}
                onRefresh={() => void refreshDetail()}
                role="student"
              />
            ) : (
              <Card>
                <div className="p-10 text-center">
                  <Eye className="w-10 h-10 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    Select a session from the history to view details.
                  </p>
                </div>
              </Card>
            ))}

          {/* Eligibility Tab */}
          {tab === 'eligibility' && (
            <div className="space-y-5">
              {/* Current eligibility */}
              {ownResult && (
                <Card>
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-surface-900 dark:text-white">Current Eligibility</h3>
                        <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
                          Based on your verified attendance for {course?.code}
                        </p>
                      </div>
                      <Badge
                        variant={
                          ownResult.decision === 'eligible'
                            ? 'success'
                            : ownResult.decision === 'not_eligible'
                              ? 'danger'
                              : 'warning'
                        }
                        className="text-sm gap-1.5 px-3 py-1"
                      >
                        <DecisionIcon className="w-3.5 h-3.5" />
                        {decision.label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 p-3 text-center">
                        <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">{credited}</p>
                        <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">
                          Credited
                        </p>
                      </div>
                      <div className="rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200/50 dark:border-surface-700/30 p-3 text-center">
                        <p className="text-2xl font-extrabold text-surface-800 dark:text-surface-200">{total}</p>
                        <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Total</p>
                      </div>
                      <div className="rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 p-3 text-center">
                        <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-400">{pending}</p>
                        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-500 uppercase tracking-wider">
                          Pending
                        </p>
                      </div>
                    </div>

                    {/* Progress bar with threshold */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-surface-500 dark:text-surface-400">
                        <span>Your attendance</span>
                        <span>75% threshold</span>
                      </div>
                      <div className="relative h-3 rounded-full bg-surface-100 dark:bg-surface-700 overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
                            (pct ?? 0) >= 75 ? 'bg-emerald-500' : (pct ?? 0) >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, pct ?? 0)}%` }}
                        />
                        <div className="absolute inset-y-0 left-[75%] w-0.5 bg-surface-400 dark:bg-surface-500" />
                      </div>
                    </div>

                    <p className="text-[11px] text-surface-400 dark:text-surface-500">
                      Policy: pilot-session-75-v1 · Late attendance receives full credit · Decisions use exact ratios
                    </p>
                  </div>
                </Card>
              )}

              {/* Snapshots */}
              {snapshots.length > 0 && (
                <Card>
                  <div className="p-5">
                    <h3 className="font-bold text-surface-900 dark:text-white mb-1">Published Snapshots</h3>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mb-4">
                      Corrections generate new versions; earlier snapshots are preserved.
                    </p>
                    <div className="space-y-3">
                      {snapshots.map((snap) => {
                        const own = snap.results.find((r) => r.user_id === user?.id);
                        return (
                          <div
                            key={snap.id}
                            className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200/50 dark:border-surface-700/30"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/40 text-xs font-bold text-primary-700 dark:text-primary-300">
                                  v{snap.version}
                                </span>
                                <span className="text-sm text-surface-500 dark:text-surface-400">
                                  {new Date(snap.created_at).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </span>
                              </div>
                              {own && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-surface-900 dark:text-white">
                                    {own.credited}/{own.total}
                                    {own.percentage !== null && ` · ${own.percentage.toFixed(1)}%`}
                                  </span>
                                  <Badge
                                    variant={
                                      own.decision === 'eligible'
                                        ? 'success'
                                        : own.decision === 'not_eligible'
                                          ? 'danger'
                                          : 'warning'
                                    }
                                  >
                                    {label(own.decision)}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              )}

              {!ownResult && snapshots.length === 0 && (
                <Card>
                  <div className="p-10 text-center">
                    <GraduationCap className="w-10 h-10 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      Eligibility data will appear here once sessions are held and finalized.
                    </p>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Footer */}
          <p className="text-[10px] text-surface-400 dark:text-surface-500 text-center pt-2">
            Pilot system · Late attendance receives full credit · Decisions use exact ratios, not rounded percentages
          </p>
        </>
      )}
    </div>
  );
}
