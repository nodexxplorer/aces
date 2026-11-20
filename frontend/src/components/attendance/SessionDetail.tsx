import { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { cn } from '../../utils/cn';
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  MessageSquare,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { attendanceAction, type AttendanceDetail as DetailType } from '../../api/verified-attendance';
import ReviewPanel from './ReviewPanel';
import AuditTimeline from './AuditTimeline';

interface SessionDetailProps {
  detail: DetailType;
  currentUserId: string;
  onRefresh: () => void;
  role: 'student' | 'lecturer' | 'admin';
}

const label = (s: string) => s.replace(/_/g, ' ');

const verificationBadge = (v: string) => {
  switch (v) {
    case 'verified':
      return <Badge variant="success">Verified</Badge>;
    case 'flagged':
      return <Badge variant="warning">Flagged</Badge>;
    case 'approved':
      return <Badge variant="success">Approved</Badge>;
    case 'rejected':
      return <Badge variant="danger">Rejected</Badge>;
    default:
      return <Badge variant="default">Pending</Badge>;
  }
};

const outcomeBadge = (o: string) => {
  switch (o) {
    case 'present':
      return <Badge variant="success">Present</Badge>;
    case 'late':
      return <Badge variant="warning">Late</Badge>;
    default:
      return <Badge variant="danger">Absent</Badge>;
  }
};

export default function SessionDetail({ detail, currentUserId, onRefresh, role }: SessionDetailProps) {
  const [showAudit, setShowAudit] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'late' | 'absent' | 'flagged'>('all');
  const [reason, setReason] = useState('');
  const [held, setHeld] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [delegate, setDelegate] = useState(detail.session.delegate_id || '');
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  const { session, records, disputes, events } = detail;
  const ownRecord = records.find((r) => r.user_id === currentUserId);
  const canManage = detail.canManage;
  const canOperate = detail.canOperate;
  const hasOpenDispute = disputes.some((d) => d.user_id === currentUserId && d.status === 'open');

  // Live auto-closing countdown for open sessions
  useEffect(() => {
    if (session.status !== 'open' || !session.closes_at) {
      setSecondsRemaining(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(session.closes_at!).getTime() - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        onRefresh();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session.status, session.closes_at, onRefresh]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const act = async (action: string, data: object = {}) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await attendanceAction(session.id, action, data);
      setNotice('Saved successfully.');
      setReason('');
      setHeld(false);
      onRefresh();
    } catch (e) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  // Stats
  const checkedInCount = records.filter((r) => r.submitted_at).length;
  const presentCount = records.filter((r) => r.outcome === 'present').length;
  const lateCount = records.filter((r) => r.outcome === 'late').length;
  const absentCount = records.filter((r) => r.outcome === 'absent').length;
  const flaggedCount = records.filter((r) => r.verification === 'flagged').length;

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.matric.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'flagged') return r.verification === 'flagged';
    return r.outcome === statusFilter;
  });

  return (
    <Card>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-surface-200 dark:border-surface-700/60">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">{session.title}</h2>
              {detail.courseCode && (
                <span className="rounded-lg bg-surface-100 dark:bg-surface-800 px-2.5 py-0.5 text-xs font-semibold text-primary-600 dark:text-primary-400">
                  {detail.courseCode}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-4 mt-2 text-xs text-surface-500 dark:text-surface-400">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Calendar className="w-4 h-4 text-primary-500" />
                {new Date(session.scheduled_at).toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <MapPin className="w-4 h-4 text-emerald-500" />
                {session.venue}
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4 text-amber-500" />
                {session.duration_minutes} min window
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Users className="w-4 h-4 text-blue-500" />
                {records.length} enrolled students
              </span>
            </div>
          </div>

          <Badge
            variant={
              session.status === 'open'
                ? 'success'
                : session.status === 'finalized'
                  ? 'info'
                  : session.status === 'cancelled'
                    ? 'danger'
                    : session.status === 'closed'
                      ? 'warning'
                      : 'default'
            }
            className="text-xs px-3 py-1 font-semibold"
          >
            {label(session.status)}
          </Badge>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-danger-50 dark:bg-danger-500/10 text-danger-700 dark:text-danger-400 text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {notice && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {notice}
          </div>
        )}

        {/* ═══ STATE CALLOUTS ═══ */}
        {/* Open State Callout with Live Auto-Close Countdown */}
        {session.status === 'open' && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
                  <Clock className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Live Check-In Active
                    </span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  </div>
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                    Students are scanning live rotating QR codes. Roster auto-freezes when time expires.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">
                    Auto-Closing In
                  </span>
                  <span className="text-xl font-mono font-extrabold text-emerald-800 dark:text-emerald-200">
                    {secondsRemaining !== null ? formatTimer(secondsRemaining) : `${session.duration_minutes}m`}
                  </span>
                </div>
                {canOperate && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void act('close')}
                    className="border-emerald-600 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-400 dark:text-emerald-200"
                  >
                    Close check-in early
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Draft State Callout */}
        {session.status === 'draft' && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-surface-900 dark:text-surface-100">
                  Ready to start this lecture?
                </h4>
                <p className="mt-1 text-xs text-surface-600 dark:text-surface-400 leading-relaxed">
                  Clicking <strong>Open &amp; freeze roster</strong> locks the registered attendee list, launches the{' '}
                  {session.duration_minutes}-minute secure rotating QR code check-in, and starts the automatic closing
                  timer.
                </p>
              </div>
              {canOperate && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void act('open')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-md shadow-emerald-500/20"
                >
                  Open &amp; freeze roster
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Closed State Callout */}
        {session.status === 'closed' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Lecture Check-in Closed</h4>
                <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-300/80">
                  Check-in window duration has elapsed. Please review any flagged check-ins or student disputes below,
                  then finalize official records.
                </p>
              </div>

              {canManage && (
                <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-surface-800 dark:text-surface-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={held}
                      onChange={(e) => setHeld(e.target.checked)}
                      className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span>I confirm this lecture was held and I have reviewed all student attendance exceptions.</span>
                  </label>
                  <Button
                    size="sm"
                    disabled={busy || !held}
                    onClick={() => void act('finalize', { held: true })}
                    className="bg-primary-600 hover:bg-primary-700 text-white shrink-0"
                  >
                    Finalize official records
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delegate selector (draft, lecturer only) */}
        {canManage && session.status === 'draft' && detail.delegates && detail.delegates.length > 0 && (
          <div className="p-4 rounded-xl border border-surface-200 dark:border-surface-700/60 bg-surface-50/50 dark:bg-surface-800/50 space-y-2">
            <span className="text-xs font-semibold text-surface-700 dark:text-surface-300">
              Class Representative Delegation
            </span>
            <div className="flex items-center gap-3">
              <select
                className="flex-1 rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 p-2.5 text-xs font-medium shadow-sm"
                value={delegate}
                onChange={(e) => setDelegate(e.target.value)}
              >
                <option value="">No class rep delegated (Lecturer operates session directly)</option>
                {detail.delegates.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.matric} — {d.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void act('delegate', { delegateId: delegate || null })}
              >
                Assign Delegate
              </Button>
            </div>
          </div>
        )}

        {/* Student's own record (if viewed by a student) */}
        {role === 'student' && ownRecord && (
          <div
            className={cn(
              'p-4 rounded-2xl border-l-4 shadow-sm',
              ownRecord.verification === 'verified' || ownRecord.verification === 'approved'
                ? 'border-l-success-500 bg-success-50/40 dark:bg-success-950/20'
                : ownRecord.verification === 'flagged'
                  ? 'border-l-warning-500 bg-warning-50/40 dark:bg-warning-950/20'
                  : ownRecord.outcome === 'absent'
                    ? 'border-l-danger-500 bg-danger-50/40 dark:bg-danger-950/20'
                    : 'border-l-surface-400 bg-surface-50 dark:bg-surface-800/40',
            )}
          >
            <p className="font-bold text-surface-900 dark:text-surface-100 text-sm">Your Attendance Status</p>
            <div className="flex gap-2 mt-2">
              {outcomeBadge(ownRecord.outcome)}
              {verificationBadge(ownRecord.verification)}
            </div>
            {ownRecord.flags.length > 0 && (
              <p className="text-xs text-warning-700 dark:text-warning-400 mt-2">
                Flags: {ownRecord.flags.map(label).join(', ')}
              </p>
            )}
            {ownRecord.review_reason && (
              <p className="text-xs text-surface-600 dark:text-surface-400 mt-1 font-medium">
                Decision: {ownRecord.review_reason}
              </p>
            )}
          </div>
        )}

        {/* Student dispute form */}
        {role === 'student' && ownRecord && ['closed', 'finalized'].includes(session.status) && !hasOpenDispute && (
          <form
            className="space-y-3 p-4 rounded-2xl border border-surface-200 dark:border-surface-700/60 bg-surface-50/40 dark:bg-surface-800/40"
            onSubmit={(e) => {
              e.preventDefault();
              void act('dispute', { reason });
            }}
          >
            <label className="block">
              <span className="text-xs font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-primary-500" />
                Report missing or incorrect attendance
              </span>
              <textarea
                className="w-full mt-2 rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 p-3 text-xs"
                minLength={5}
                maxLength={2000}
                required
                rows={3}
                placeholder="Explain why you could not check in or describe any technical failure..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <Button size="sm" type="submit" disabled={busy}>
              Submit dispute
            </Button>
          </form>
        )}

        {/* Disputes List */}
        {disputes.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-surface-800 dark:text-surface-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Student Disputes ({disputes.length})
            </h3>
            <div className="space-y-2">
              {disputes.map((d) => (
                <div
                  key={d.id}
                  className="p-3.5 rounded-xl border border-surface-200 dark:border-surface-700/60 bg-surface-50 dark:bg-surface-800 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-surface-900 dark:text-surface-100">
                      {records.find((r) => r.user_id === d.user_id)?.name || d.user_id}
                    </span>
                    <Badge variant={d.status === 'open' ? 'warning' : 'success'}>{d.status}</Badge>
                  </div>
                  <p className="text-surface-600 dark:text-surface-400 mt-1">{d.reason}</p>
                  {d.resolution && (
                    <p className="text-primary-600 dark:text-primary-400 mt-1 font-medium">
                      Resolution: {d.resolution}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ ATTENDEE ROSTER SECTION (lecturer/admin) ═══ */}
        {role !== 'student' && records.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">Student Attendance Roster</h3>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                  {checkedInCount} of {records.length} students checked in (
                  {Math.round((checkedInCount / records.length) * 100)}%)
                </p>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  type="text"
                  placeholder="Search student or matric..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-xs placeholder:text-surface-400 focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all',
                  statusFilter === 'all'
                    ? 'bg-surface-900 text-white dark:bg-white dark:text-surface-900 shadow-sm'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-400',
                )}
              >
                All ({records.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('present')}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all',
                  statusFilter === 'present'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-100',
                )}
              >
                Present ({presentCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('late')}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all',
                  statusFilter === 'late'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 hover:bg-amber-100',
                )}
              >
                Late ({lateCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('absent')}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all',
                  statusFilter === 'absent'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 hover:bg-rose-100',
                )}
              >
                Absent ({absentCount})
              </button>
              {flaggedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('flagged')}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-semibold transition-all',
                    statusFilter === 'flagged'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200',
                  )}
                >
                  Flagged ({flaggedCount})
                </button>
              )}
            </div>

            {/* Roster Table */}
            <div className="overflow-x-auto rounded-2xl border border-surface-200 dark:border-surface-700/60">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/80">
                    <th className="text-left py-3 px-4 font-semibold text-surface-600 dark:text-surface-300">
                      Student
                    </th>
                    <th className="text-center py-3 px-3 font-semibold text-surface-600 dark:text-surface-300">
                      Outcome
                    </th>
                    <th className="text-center py-3 px-3 font-semibold text-surface-600 dark:text-surface-300">
                      Verification
                    </th>
                    <th className="text-left py-3 px-3 font-semibold text-surface-600 dark:text-surface-300">
                      Check-in Time
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-surface-600 dark:text-surface-300">
                      Exceptions / Flags
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-surface-400">
                        No students match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => (
                      <tr
                        key={r.user_id}
                        className="hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-bold text-surface-900 dark:text-surface-100 block">{r.matric}</span>
                          <span className="text-surface-500 dark:text-surface-400">{r.name}</span>
                        </td>
                        <td className="text-center py-3 px-3">{outcomeBadge(r.outcome)}</td>
                        <td className="text-center py-3 px-3">{verificationBadge(r.verification)}</td>
                        <td className="py-3 px-3 text-surface-600 dark:text-surface-400">
                          {r.submitted_at
                            ? new Date(r.submitted_at).toLocaleTimeString(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                                second: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-surface-500 dark:text-surface-400">
                          {r.flags.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                              <AlertCircle className="w-3 h-3" />
                              {r.flags.map(label).join(', ')}
                            </span>
                          ) : (
                            <span className="text-surface-400 dark:text-surface-500">—</span>
                          )}
                          {r.review_reason && (
                            <p className="text-[11px] text-primary-600 dark:text-primary-400 mt-0.5">
                              Decision: {r.review_reason}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Review panel (lecturer/admin, closed/finalized) */}
        {canManage && ['closed', 'finalized'].includes(session.status) && (
          <ReviewPanel sessionId={session.id} records={records} currentUserId={currentUserId} onSaved={onRefresh} />
        )}

        {/* Cancel Session (Collapsible) */}
        {canManage && session.status !== 'cancelled' && (
          <div className="border-t border-surface-200 dark:border-surface-700/60 pt-4">
            <button
              type="button"
              onClick={() => setShowCancel(!showCancel)}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              {showCancel ? 'Hide cancellation form' : 'Cancel this lecture session'}
            </button>

            {showCancel && (
              <form
                className="mt-3 p-4 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/10 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (window.confirm('Are you sure you want to cancel this session? This action cannot be undone.'))
                    void act('cancel', { reason });
                }}
              >
                <label className="block">
                  <span className="text-xs font-medium text-rose-900 dark:text-rose-200">
                    Cancellation reason (required, min 5 chars):
                  </span>
                  <input
                    className="w-full mt-1 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-surface-900 p-2 text-xs"
                    minLength={5}
                    maxLength={2000}
                    required
                    placeholder="e.g. Lecturer unavailable, university holiday, power outage..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <Button size="sm" variant="danger" type="submit" disabled={busy}>
                  Confirm Cancellation
                </Button>
              </form>
            )}
          </div>
        )}

        {/* Audit timeline */}
        {(role === 'lecturer' || role === 'admin') && events && events.length > 0 && (
          <div className="border-t border-surface-200 dark:border-surface-700/60 pt-4">
            <button
              onClick={() => setShowAudit(!showAudit)}
              className="text-xs font-medium text-surface-500 dark:text-surface-400 hover:text-primary-600 flex items-center gap-1"
            >
              {showAudit ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Audit trail ({events.length} security events)
            </button>
            {showAudit && (
              <div className="mt-3">
                <AuditTimeline events={events} />
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
