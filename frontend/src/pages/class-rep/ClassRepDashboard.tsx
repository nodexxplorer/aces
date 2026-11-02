import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getErrorMessage } from '../../utils/errors';
import {
  getClassRepClassList,
  listMyAttendanceSessions,
  listMyReports,
  listPendingCourseRegistrations,
  listPendingStudentRegistrations,
  type ClassRepStudent,
  type AttendanceSession,
  type ClassRepReport,
} from '../../api/class-rep';
import { Users, CheckCircle, BarChart3, FileText, RefreshCw, Plus, ArrowUpRight, Check, Megaphone } from 'lucide-react';

export default function ClassRepDashboard() {
  const { user } = useAuth();
  const { error: notifyError } = useNotification();
  const [students, setStudents] = useState<ClassRepStudent[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [reports, setReports] = useState<ClassRepReport[]>([]);
  const [pendingFormsCount, setPendingFormsCount] = useState(0);
  const [pendingStudentsCount, setPendingStudentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [classList, sessionsList, reportsList, formsList, studentsRegList] = await Promise.allSettled([
        getClassRepClassList(),
        listMyAttendanceSessions(),
        listMyReports(),
        listPendingCourseRegistrations(),
        listPendingStudentRegistrations(),
      ]);

      if (classList.status === 'fulfilled') setStudents(classList.value);
      if (sessionsList.status === 'fulfilled') setSessions(sessionsList.value);
      if (reportsList.status === 'fulfilled') setReports(reportsList.value);
      if (formsList.status === 'fulfilled') setPendingFormsCount(formsList.value.length);
      if (studentsRegList.status === 'fulfilled') setPendingStudentsCount(studentsRegList.value.length);
    } catch (e: unknown) {
      notifyError('Load Error', getErrorMessage(e, 'Failed to load dashboard data'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const totalSessions = sessions.length;
  const finalizedSessions = sessions.filter((s) => s.status === 'finalized' || s.status === 'closed').length;
  const pendingReportsCount = reports.filter((r) => r.status === 'submitted' || r.status === 'pending').length;
  const totalPresent = sessions.reduce((sum, s) => sum + s.total_present, 0);
  const totalStudentsInSessions = sessions.reduce((sum, s) => sum + s.total_students, 0);
  const attendanceRate =
    totalStudentsInSessions > 0 ? Math.round((totalPresent / totalStudentsInSessions) * 100) : null;

  const levelText = user?.level ? `Level ${user.level * 100}` : 'Level 500';

  const kpis = [
    {
      label: 'Class size',
      value: `${students.length} student${students.length !== 1 ? 's' : ''}`,
      subtitle: levelText,
      icon: <Users className="w-5 h-5 text-slate-400" />,
    },
    {
      label: 'Attendance rate',
      value: attendanceRate !== null ? `${attendanceRate}%` : 'No data',
      subtitle: totalSessions > 0 ? `${totalSessions} session(s)` : 'No sessions yet',
      icon: <CheckCircle className="w-5 h-5 text-slate-400" />,
    },
    {
      label: 'Sessions held',
      value: `${finalizedSessions} of ${totalSessions}`,
      subtitle: 'This semester',
      icon: <BarChart3 className="w-5 h-5 text-slate-400" />,
    },
    {
      label: 'Pending reports',
      value: `${pendingReportsCount}`,
      subtitle: pendingReportsCount === 0 ? 'Nothing waiting' : 'Awaiting review',
      icon: <FileText className="w-5 h-5 text-slate-400" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-white">Class rep portal</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Manage your class list, take attendance and send reports to the HOD.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] hover:bg-surface-50 dark:hover:bg-[#152033] text-xs font-semibold text-surface-700 dark:text-slate-200 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm flex items-start justify-between"
          >
            <div className="space-y-1">
              <p className="text-xs font-medium text-surface-500 dark:text-surface-400">{kpi.label}</p>
              <p className="text-2xl font-black text-surface-900 dark:text-white">{loading ? '...' : kpi.value}</p>
              <p className="text-xs text-surface-400 dark:text-slate-500">{kpi.subtitle}</p>
            </div>
            <div className="p-2 rounded-xl bg-surface-100 dark:bg-[#152033]">{kpi.icon}</div>
          </div>
        ))}
      </div>

      {/* Middle 2-Column: Recent attendance sessions & Recent reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Attendance Sessions Card */}
        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-surface-900 dark:text-white">Recent attendance sessions</h2>
            <Link
              to="/rep/attendance"
              className="px-3 py-1.5 rounded-xl bg-[#1d68ec] text-white hover:bg-[#1a5cd1] text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New session</span>
            </Link>
          </div>

          {sessions.length === 0 ? (
            /* Clean Empty State as shown in PDF Page 11 */
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-[#152033] flex items-center justify-center text-[#1d68ec] mb-3">
                <Check className="w-6 h-6 stroke-[2.5]" />
              </div>
              <p className="text-base font-bold text-surface-900 dark:text-white">No attendance sessions yet</p>
              <p className="text-xs text-surface-400 dark:text-slate-400 mt-1 max-w-xs">
                Start a session, mark who is present and send it to your lecturer.
              </p>
              <Link
                to="/rep/attendance"
                className="mt-4 px-4 py-2 rounded-xl bg-[#1d68ec] text-white hover:bg-[#1a5cd1] font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start your first session</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800/80">
              {sessions.slice(0, 4).map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-surface-900 dark:text-white">
                      Course Session ({s.method})
                    </p>
                    <p className="text-xs text-surface-400 dark:text-slate-500">
                      {new Date(s.created_at).toLocaleDateString()} · {s.total_students} students
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-500">{s.total_present} present</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-100 dark:bg-[#152033] text-surface-700 dark:text-slate-300">
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Reports Card */}
        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-surface-900 dark:text-white">Recent reports</h2>
          </div>

          {reports.length === 0 ? (
            /* Clean Empty State as shown in PDF Page 11 */
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-[#152033] flex items-center justify-center text-[#1d68ec] mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-surface-900 dark:text-white">No reports yet</p>
              <p className="text-xs text-surface-400 dark:text-slate-400 mt-1 max-w-xs">
                Send a class report to the HOD.
              </p>
              <Link
                to="/rep/reports"
                className="mt-4 px-4 py-2 rounded-xl border border-surface-300 dark:border-[#223352] text-surface-700 dark:text-slate-200 hover:bg-surface-50 dark:hover:bg-[#152033] font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New report</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800/80">
              {reports.slice(0, 4).map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-surface-900 dark:text-white">{r.title}</p>
                    <p className="text-xs text-surface-400 dark:text-slate-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom 2-Column: Needs your approval & Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs your approval Card */}
        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm">
          <h2 className="text-base font-bold text-surface-900 dark:text-white mb-4">Needs your approval</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Course forms */}
            <Link
              to="/rep/pending"
              className="p-4 rounded-xl border border-surface-200 dark:border-[#1e2a3f] bg-surface-50 dark:bg-[#0b101c] hover:border-[#1d68ec] transition-colors flex items-center justify-between"
            >
              <div className="space-y-1">
                <span className="text-2xl font-black text-surface-900 dark:text-white">{pendingFormsCount}</span>
                <p className="text-xs text-surface-500 dark:text-slate-400">Course forms to verify</p>
              </div>
              {pendingFormsCount === 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                  <Check className="w-3.5 h-3.5" /> Clear
                </span>
              )}
            </Link>

            {/* New students */}
            <Link
              to="/rep/pending"
              className="p-4 rounded-xl border border-surface-200 dark:border-[#1e2a3f] bg-surface-50 dark:bg-[#0b101c] hover:border-[#1d68ec] transition-colors flex items-center justify-between"
            >
              <div className="space-y-1">
                <span className="text-2xl font-black text-surface-900 dark:text-white">{pendingStudentsCount}</span>
                <p className="text-xs text-surface-500 dark:text-slate-400">New students to approve</p>
              </div>
              {pendingStudentsCount === 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                  <Check className="w-3.5 h-3.5" /> Clear
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Quick actions Card */}
        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm">
          <h2 className="text-base font-bold text-surface-900 dark:text-white mb-4">Quick actions</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              to="/rep/attendance"
              className="flex items-center justify-between p-3.5 rounded-xl border border-surface-200 dark:border-[#1a2538] hover:bg-surface-50 dark:hover:bg-[#152033] transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#1d68ec]" />
                <span className="text-xs sm:text-sm font-medium text-surface-800 dark:text-slate-200">
                  Take attendance
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-surface-400 group-hover:text-[#1d68ec] transition-colors" />
            </Link>

            <Link
              to="/rep/notify"
              className="flex items-center justify-between p-3.5 rounded-xl border border-surface-200 dark:border-[#1a2538] hover:bg-surface-50 dark:hover:bg-[#152033] transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Megaphone className="w-4 h-4 text-amber-500" />
                <span className="text-xs sm:text-sm font-medium text-surface-800 dark:text-slate-200">
                  Notify classmates
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-surface-400 group-hover:text-amber-500 transition-colors" />
            </Link>

            <Link
              to="/rep/reports"
              className="flex items-center justify-between p-3.5 rounded-xl border border-surface-200 dark:border-[#1a2538] hover:bg-surface-50 dark:hover:bg-[#152033] transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-sky-500" />
                <span className="text-xs sm:text-sm font-medium text-surface-800 dark:text-slate-200">
                  Send a report
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-surface-400 group-hover:text-sky-500 transition-colors" />
            </Link>

            <Link
              to="/rep/class-list"
              className="flex items-center justify-between p-3.5 rounded-xl border border-surface-200 dark:border-[#1a2538] hover:bg-surface-50 dark:hover:bg-[#152033] transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-emerald-500" />
                <span className="text-xs sm:text-sm font-medium text-surface-800 dark:text-slate-200">
                  View class list
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-surface-400 group-hover:text-emerald-500 transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
