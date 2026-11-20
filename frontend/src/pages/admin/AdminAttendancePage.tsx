import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Card from '../../components/ui/Card';

import Badge from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import Spinner from '../../components/ui/Spinner';
import { useAuthStore } from '../../stores/authStore';
import { BarChart3, AlertCircle, Shield, CheckCircle, Clock, AlertTriangle, Users, Search } from 'lucide-react';
import {
  attendanceCatalog,
  attendanceSessions,
  attendanceDetail,
  attendanceEligibility,
  attendanceSnapshots,
  type VerifiedSession,
  type AttendanceDetail,
  type EligibilityReport,
  type EligibilitySnapshot,
  type AttendanceEvent,
} from '../../api/verified-attendance';
import SessionCard from '../../components/attendance/SessionCard';
import SessionDetail from '../../components/attendance/SessionDetail';
import AuditTimeline from '../../components/attendance/AuditTimeline';
import { cn } from '../../utils/cn';

const errMsg = (e: unknown) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
  (e instanceof Error ? e.message : 'Request failed.');
const label = (s: string) => s.replace(/_/g, ' ');

export default function AdminAttendancePage() {
  const user = useAuthStore((s) => s.user);
  const [choice, setChoice] = useState('');
  const [sessions, setSessions] = useState<VerifiedSession[]>([]);
  const [detail, setDetail] = useState<AttendanceDetail | null>(null);
  const [report, setReport] = useState<EligibilityReport | null>(null);
  const [snapshots, setSnapshots] = useState<EligibilitySnapshot[]>([]);
  const [allEvents, setAllEvents] = useState<AttendanceEvent[]>([]);
  const [tab, setTab] = useState('dashboard');
  const [error, setError] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const gen = useRef(0);

  const { data: courses = [], isLoading: loading } = useQuery({
    queryKey: ['admin-attendance-catalog', user?.id],
    queryFn: () => attendanceCatalog().then((d) => d.courses),
    staleTime: 60_000,
    enabled: !!user?.id,
  });

  // Auto-select first course
  useEffect(() => {
    if (courses.length > 0 && !choice) {
      setChoice(`${courses[0].id}:${courses[0].semester_id}`);
    }
  }, [courses]);

  const course = courses.find((c) => `${c.id}:${c.semester_id}` === choice);

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

      // Aggregate all events from session details for the audit tab
      const eventList: AttendanceEvent[] = [];
      for (const s of sess.slice(0, 20)) {
        try {
          const d = await attendanceDetail(s.id);
          if (r !== gen.current) return;
          if (d.events) eventList.push(...d.events);
        } catch {
          /* skip */
        }
      }
      eventList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      if (r === gen.current) setAllEvents(eventList);
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
    setAllEvents([]);
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

  // Dashboard stats
  const openCount = sessions.filter((s) => s.status === 'open').length;
  const closedCount = sessions.filter((s) => s.status === 'closed').length;
  const finalizedCount = sessions.filter((s) => s.status === 'finalized').length;
  const pendingReviews = report?.results.reduce((n, r) => n + r.pending, 0) ?? 0;

  const filteredEvents = auditSearch
    ? allEvents.filter(
        (e) =>
          e.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
          JSON.stringify(e.evidence).toLowerCase().includes(auditSearch.toLowerCase()),
      )
    : allEvents;

  const tabDefs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'courses', label: 'All Courses' },
    { id: 'audit', label: 'Audit Log', badge: allEvents.length > 0 ? allEvents.length : undefined },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary-500" />
          Attendance Overview
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Department-wide attendance monitoring, reporting, and audit trail
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-50 dark:bg-danger-500/10 text-danger-700 dark:text-danger-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Course selector */}
      {courses.length > 0 && (
        <select
          className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 p-3 text-sm font-medium shadow-sm focus:ring-2 focus:ring-primary-500"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          {courses.map((c) => (
            <option key={`${c.id}:${c.semester_id}`} value={`${c.id}:${c.semester_id}`}>
              {c.code} — {c.title} · {c.academic_year} {c.semester}
            </option>
          ))}
        </select>
      )}

      <Tabs tabs={tabDefs} activeTab={tab} onChange={setTab} />

      {/* ═══ Dashboard Tab ═══ */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Clock className="w-5 h-5" />}
              label="Active Sessions"
              value={openCount}
              color="text-success-500"
              bg="bg-success-50 dark:bg-success-500/10"
            />
            <StatCard
              icon={<AlertTriangle className="w-5 h-5" />}
              label="Pending Reviews"
              value={pendingReviews}
              color="text-warning-500"
              bg="bg-warning-50 dark:bg-warning-500/10"
            />
            <StatCard
              icon={<CheckCircle className="w-5 h-5" />}
              label="Finalized Sessions"
              value={finalizedCount}
              color="text-primary-500"
              bg="bg-primary-50 dark:bg-primary-500/10"
            />
            <StatCard
              icon={<Users className="w-5 h-5" />}
              label="Closed (Awaiting)"
              value={closedCount}
              color="text-accent-500"
              bg="bg-accent-50 dark:bg-accent-500/10"
            />
          </div>

          {/* Recent sessions */}
          <div>
            <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3">Recent Sessions</h2>
            {sessions.length === 0 ? (
              <Card>
                <div className="p-6 text-center text-surface-500 dark:text-surface-400">
                  No sessions for this course yet.
                </div>
              </Card>
            ) : (
              <div className="space-y-2">
                {sessions.slice(0, 10).map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    active={detail?.session.id === s.id}
                    onClick={() => {
                      void selectSession(s.id);
                      setTab('courses');
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Eligibility overview */}
          {report && report.results.length > 0 && (
            <Card>
              <div className="p-5">
                <h2 className="font-semibold text-surface-900 dark:text-surface-100 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Eligibility Summary
                </h2>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-success-600">
                      {report.results.filter((r) => r.decision === 'eligible').length}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">Eligible</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-danger-600">
                      {report.results.filter((r) => r.decision === 'not_eligible').length}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">Not Eligible</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning-600">
                      {
                        report.results.filter((r) => r.decision === 'pending_review' || r.decision === 'not_assessable')
                          .length
                      }
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">Pending / N/A</p>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ═══ All Courses Tab ═══ */}
      {tab === 'courses' && (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <Card>
              <div className="p-6 text-center text-surface-500 dark:text-surface-400">No sessions for this course.</div>
            </Card>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  active={detail?.session.id === s.id}
                  onClick={() => void selectSession(s.id)}
                />
              ))}
            </div>
          )}

          {detail && (
            <SessionDetail
              detail={detail}
              currentUserId={user?.id || ''}
              onRefresh={() => void refreshAll()}
              role="admin"
            />
          )}

          {/* Full eligibility table */}
          {report && report.results.length > 0 && (
            <Card padding="none">
              <div className="p-4 border-b border-surface-200 dark:border-surface-700">
                <h3 className="font-semibold text-surface-900 dark:text-surface-100">Eligibility Report</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
                      <th className="text-left py-3 px-4 font-medium text-surface-500 dark:text-surface-400">
                        Student
                      </th>
                      <th className="text-center py-3 px-3 font-medium text-surface-500 dark:text-surface-400">
                        Credited / Held
                      </th>
                      <th className="text-center py-3 px-3 font-medium text-surface-500 dark:text-surface-400">%</th>
                      <th className="text-center py-3 px-3 font-medium text-surface-500 dark:text-surface-400">
                        Pending
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-surface-500 dark:text-surface-400">
                        Decision
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.results.map((r) => (
                      <tr key={r.user_id} className="border-b border-surface-100 dark:border-surface-700/50">
                        <td className="py-2.5 px-4">
                          <span className="font-medium">{r.matric}</span>
                          <br />
                          <span className="text-surface-500 dark:text-surface-400">{r.name}</span>
                        </td>
                        <td className="text-center py-2.5 px-3">
                          {r.credited} / {r.total}
                        </td>
                        <td className="text-center py-2.5 px-3">
                          {r.percentage !== null ? `${r.percentage.toFixed(1)}%` : '—'}
                        </td>
                        <td className="text-center py-2.5 px-3">{r.pending}</td>
                        <td className="text-center py-2.5 px-4">
                          <Badge
                            variant={
                              r.decision === 'eligible'
                                ? 'success'
                                : r.decision === 'not_eligible'
                                  ? 'danger'
                                  : 'warning'
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
          )}

          {/* Snapshots */}
          {snapshots.length > 0 && (
            <Card>
              <div className="p-5 space-y-3">
                <h3 className="font-semibold">Published Snapshots</h3>
                {snapshots.map((snap) => (
                  <details key={snap.id} className="border-t border-surface-100 dark:border-surface-700/50 pt-2">
                    <summary className="cursor-pointer text-sm font-medium">
                      Version {snap.version} · {new Date(snap.created_at).toLocaleString()}
                    </summary>
                    <pre className="mt-2 text-xs bg-surface-50 dark:bg-surface-700/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(snap.results, null, 2)}
                    </pre>
                  </details>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ═══ Audit Log Tab ═══ */}
      {tab === 'audit' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500"
              placeholder="Search audit events..."
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
            />
          </div>

          {filteredEvents.length === 0 ? (
            <Card>
              <div className="p-6 text-center text-surface-500 dark:text-surface-400">
                {allEvents.length === 0 ? 'No audit events recorded yet.' : 'No events match your search.'}
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-5">
                <AuditTimeline events={filteredEvents.slice(0, 50)} />
                {filteredEvents.length > 50 && (
                  <p className="text-xs text-surface-400 mt-3">Showing 50 of {filteredEvents.length} events.</p>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <Card>
      <div className="p-4 flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', bg, color)}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">{value}</p>
          <p className="text-xs text-surface-500 dark:text-surface-400">{label}</p>
        </div>
      </div>
    </Card>
  );
}
