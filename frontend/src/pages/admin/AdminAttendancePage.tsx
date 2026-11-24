import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  type AttendanceCourse,
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
  const queryClient = useQueryClient();

  const [selectedChoice, setChoice] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [tab, setTab] = useState('dashboard');
  const [auditSearch, setAuditSearch] = useState('');

  // 1. Catalog query
  const {
    data: catalogData,
    isLoading: catalogLoading,
    error: catalogError,
  } = useQuery({
    queryKey: ['attendance', 'catalog', user?.id],
    queryFn: attendanceCatalog,
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const courses: AttendanceCourse[] = catalogData?.courses ?? [];

  // Active choice defaults to first course if none selected or if selection invalid
  const choice =
    selectedChoice && courses.some((c) => `${c.id}:${c.semester_id}` === selectedChoice)
      ? selectedChoice
      : courses[0]
        ? `${courses[0].id}:${courses[0].semester_id}`
        : '';

  const course = courses.find((c) => `${c.id}:${c.semester_id}` === choice);

  // Clear selected session when course choice changes
  useEffect(() => {
    setSelectedSessionId(null);
  }, [choice]);

  // 2. Course sessions query
  const { data: sessions = [], error: sessionsError } = useQuery({
    queryKey: ['attendance', 'sessions', course?.id, course?.semester_id],
    queryFn: () => attendanceSessions(course!.id, course!.semester_id),
    enabled: !!course?.id && !!course?.semester_id,
    staleTime: 15_000,
  });

  // 3. Course eligibility query
  const { data: report = null, error: reportError } = useQuery({
    queryKey: ['attendance', 'eligibility', course?.id, course?.semester_id],
    queryFn: () => attendanceEligibility(course!.id, course!.semester_id),
    enabled: !!course?.id && !!course?.semester_id,
    staleTime: 15_000,
  });

  // 4. Course snapshots query
  const { data: snapshots = [] } = useQuery({
    queryKey: ['attendance', 'snapshots', course?.id, course?.semester_id],
    queryFn: () => attendanceSnapshots(course!.id, course!.semester_id).catch(() => []),
    enabled: !!course?.id && !!course?.semester_id,
    staleTime: 60_000,
  });

  // 5. Selected session detail query
  const { data: detail = null, error: detailError } = useQuery({
    queryKey: ['attendance', 'session-detail', selectedSessionId],
    queryFn: () => attendanceDetail(selectedSessionId!),
    enabled: !!selectedSessionId,
    staleTime: 15_000,
  });

  // 6. Aggregate audit events from recent sessions
  const sessionIdsKey = useMemo(
    () =>
      sessions
        .slice(0, 20)
        .map((s) => s.id)
        .join(','),
    [sessions],
  );

  const { data: allEvents = [] } = useQuery({
    queryKey: ['attendance', 'audit-events', course?.id, course?.semester_id, sessionIdsKey],
    queryFn: async () => {
      const topSessions = sessions.slice(0, 20);
      if (topSessions.length === 0) return [];
      const details = await Promise.allSettled(topSessions.map((s) => attendanceDetail(s.id)));
      const eventList: AttendanceEvent[] = [];
      for (const res of details) {
        if (res.status === 'fulfilled' && res.value.events) {
          eventList.push(...res.value.events);
        }
      }
      eventList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return eventList;
    },
    enabled: !!course?.id && !!course?.semester_id && sessions.length > 0,
    staleTime: 15_000,
  });

  const selectSession = (id: string) => {
    setSelectedSessionId(id);
  };

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['attendance'] });
  };

  const queryError = catalogError || sessionsError || reportError || detailError;
  const error = queryError ? errMsg(queryError) : '';
  const loading = !user?.id || catalogLoading;

  // Dashboard stats
  const openCount = useMemo(() => sessions.filter((s) => s.status === 'open').length, [sessions]);
  const closedCount = useMemo(() => sessions.filter((s) => s.status === 'closed').length, [sessions]);
  const finalizedCount = useMemo(() => sessions.filter((s) => s.status === 'finalized').length, [sessions]);
  const pendingReviews = useMemo(() => report?.results.reduce((n, r) => n + r.pending, 0) ?? 0, [report]);

  const filteredEvents = useMemo(() => {
    if (!auditSearch) return allEvents;
    const q = auditSearch.toLowerCase();
    return allEvents.filter(
      (e) => e.action.toLowerCase().includes(q) || JSON.stringify(e.evidence).toLowerCase().includes(q),
    );
  }, [allEvents, auditSearch]);

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
