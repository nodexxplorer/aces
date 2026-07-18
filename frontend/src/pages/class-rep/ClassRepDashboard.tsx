import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import KpiCard from '../../components/data-display/KpiCard';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Users, ClipboardList, ShieldCheck, Plus, Send, FileText, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotification } from '../../hooks/useNotification';
import {
  getClassRepClassList,
  listMyAttendanceSessions,
  listMyReports,
  type ClassRepStudent,
  type AttendanceSession,
  type ClassRepReport,
} from '../../api/class-rep';

const ClassRepDashboard = () => {
  const { success, error: notifyError } = useNotification();
  const [students, setStudents] = useState<ClassRepStudent[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [reports, setReports] = useState<ClassRepReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [classList, sessionsList, reportsList] = await Promise.allSettled([
          getClassRepClassList(),
          listMyAttendanceSessions(),
          listMyReports(),
        ]);
        if (classList.status === 'fulfilled') setStudents(classList.value);
        if (sessionsList.status === 'fulfilled') setSessions(sessionsList.value);
        if (reportsList.status === 'fulfilled') setReports(reportsList.value);
      } catch (e: any) {
        notifyError('Load Error', e.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  const totalSessions = sessions.length;
  const finalizedSessions = sessions.filter((s) => s.status === 'finalized').length;
  const pendingReports = reports.filter((r) => r.status === 'submitted').length;
  const totalPresent = sessions.reduce((sum, s) => sum + s.total_present, 0);
  const totalStudents = sessions.reduce((sum, s) => sum + s.total_students, 0);
  const attendanceRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Class Representative Portal</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Manage class rosters, take attendance, and submit reports to the HOD.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Class Size" value={`${students.length} Students`} icon={<Users className="w-5 h-5" />} />
        <KpiCard title="Attendance Rate" value={totalStudents > 0 ? `${attendanceRate}%` : 'No data'} icon={<ClipboardList className="w-5 h-5" />} />
        <KpiCard title="Sessions Held" value={`${finalizedSessions}/${totalSessions}`} icon={<BarChart3 className="w-5 h-5" />} />
        <KpiCard title="Pending Reports" value={`${pendingReports}`} icon={<FileText className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Attendance Sessions */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary-500" />
                <CardTitle>Recent Attendance Sessions</CardTitle>
              </div>
              <Link to="/class-rep/attendance">
                <Button size="xs" leftIcon={<Plus className="w-3 h-3" />}>New Session</Button>
              </Link>
            </CardHeader>
            <div className="p-4 pt-0">
              {sessions.length === 0 ? (
                <p className="text-xs text-surface-400 text-center py-6">No attendance sessions yet. Click "New Session" to start.</p>
              ) : (
                <div className="divide-y divide-surface-150 dark:divide-surface-800">
                  {sessions.slice(0, 5).map((s) => (
                    <div key={s.id} className="flex justify-between items-center py-3">
                      <div>
                        <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                          Session {s.id.slice(0, 8)}...
                        </p>
                        <p className="text-xs text-surface-400">
                          {s.method} · {new Date(s.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-success-500">{s.total_present} present</span>
                        <span className="text-xs font-mono text-danger-500">{s.total_absent} absent</span>
                        <Badge variant={s.status === 'finalized' ? 'success' : s.status === 'open' ? 'primary' : 'secondary'}>
                          {s.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Class Roster Preview */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-500" />
                <CardTitle>Class Roster</CardTitle>
              </div>
              <span className="text-xs text-surface-400">{students.length} students</span>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Matric Number</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Name</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-150 dark:divide-surface-800/80">
                  {students.slice(0, 10).map((s) => (
                    <tr key={s.id}>
                      <td className="px-6 py-3 font-semibold text-surface-900 dark:text-white">{s.matric_number}</td>
                      <td className="px-6 py-3 text-surface-700 dark:text-surface-300">{s.full_name}</td>
                      <td className="px-6 py-3">
                        {s.is_defaulter ? (
                          <Badge variant="danger">Defaulter</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {students.length > 10 && (
                <p className="text-xs text-surface-400 text-center py-2">...and {students.length - 10} more</p>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Reports */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-500" />
                <CardTitle>Recent Reports</CardTitle>
              </div>
            </CardHeader>
            <div className="space-y-2 p-4 pt-0">
              {reports.length === 0 ? (
                <p className="text-xs text-surface-400 text-center py-4">No reports submitted yet.</p>
              ) : (
                reports.slice(0, 3).map((r) => (
                  <div key={r.id} className="p-2 rounded-lg border border-surface-100 dark:border-surface-800">
                    <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">{r.title}</p>
                    <div className="flex justify-between items-center mt-1">
                      <Badge variant={r.status === 'submitted' ? 'warning' : r.status === 'resolved' ? 'success' : 'secondary'}>
                        {r.status}
                      </Badge>
                      <span className="text-[10px] text-surface-400">{r.report_type}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0 space-y-2">
              <Link to="/class-rep/attendance" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<ClipboardList className="w-4 h-4" />}>
                  Take Attendance
                </Button>
              </Link>
              <Link to="/class-rep/class-list" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<Users className="w-4 h-4" />}>
                  View Class List
                </Button>
              </Link>
              <Link to="/class-rep/pending" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<Send className="w-4 h-4" />}>
                  Submit Report
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ClassRepDashboard;
