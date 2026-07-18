import { useState, useEffect } from 'react';
import { BookOpen, Award, CreditCard, Users, Megaphone, Calendar, Clock, AlertTriangle, TrendingUp, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import KpiCard from '../../components/data-display/KpiCard';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { formatGPA } from '../../utils/formatters';
import { getStudentDashboard, type StudentDashboard as DashboardData } from '../../api/dashboard';

const dayName = (d: number) => ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][d] || '';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStudentDashboard()
      .then(setData)
      .catch((e) => setError(e.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <p className="text-surface-600 dark:text-surface-400">{error || 'Failed to load dashboard'}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const { student, attendance, payments, next_class, today_classes, announcements, recent_grades, notifications, carryovers } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">
          Hello, {student.full_name?.split(' ')[0] || user?.firstName || 'Student'}!
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          {student.matric_number} · Level {student.level} · {student.academic_standing || 'Good Standing'}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Current CGPA"
          value={student.cgpa != null ? formatGPA(student.cgpa) : 'N/A'}
          icon={<Award className="w-5 h-5" />}
        />
        <KpiCard
          title="Attendance Rate"
          value={attendance?.total_classes > 0 ? `${Math.round(attendance.attendance_rate)}%` : 'No data'}
          icon={<BookOpen className="w-5 h-5" />}
        />
        <KpiCard
          title="Outstanding Dues"
          value={payments?.dues_outstanding > 0 ? `${payments.dues_outstanding} due` : 'Cleared'}
          icon={<CreditCard className="w-5 h-5" />}
          className={payments?.dues_outstanding > 0 ? 'border-l-4 border-amber-500' : ''}
        />
        <KpiCard
          title="Notifications"
          value={notifications?.unread > 0 ? `${notifications.unread} new` : 'All caught up'}
          icon={<Bell className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Next Class */}
          {next_class && (
            <Card className="border-l-4 border-primary-500">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary-500" />
                  <CardTitle>Next Class</CardTitle>
                </div>
                <Badge variant="primary">{next_class.time_until}</Badge>
              </CardHeader>
              <div className="p-4 pt-0">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-surface-900 dark:text-surface-100">
                      {next_class.course_code} — {next_class.course_title}
                    </h4>
                    <p className="text-sm text-surface-500">
                      {next_class.venue} · {next_class.start_time?.slice(0, 5)} – {next_class.end_time?.slice(0, 5)}
                    </p>
                  </div>
                  {next_class.class_type && (
                    <Badge variant="secondary">{next_class.class_type}</Badge>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Today's Classes */}
          {today_classes && today_classes.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary-500" />
                  <CardTitle>Today's Classes</CardTitle>
                </div>
                <span className="text-xs text-surface-400">{today_classes.length} classes</span>
              </CardHeader>
              <div className="space-y-2 p-4 pt-0">
                {today_classes.map((c, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-lg border border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900">
                    <div>
                      <h5 className="font-semibold text-sm text-surface-900 dark:text-surface-100">{c.course_code}</h5>
                      <p className="text-[10px] text-surface-500 truncate max-w-[180px]">{c.course_title}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-primary-500">{c.start_time?.slice(0, 5)}</span>
                      <p className="text-[10px] text-surface-400">{c.venue}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* No classes today */}
          {(!today_classes || today_classes.length === 0) && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-surface-400" />
                  <CardTitle>Today's Classes</CardTitle>
                </div>
              </CardHeader>
              <p className="text-center text-surface-400 text-sm py-6">No classes scheduled for today.</p>
            </Card>
          )}

          {/* Announcements */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-primary-500" />
                <CardTitle>Announcements</CardTitle>
              </div>
            </CardHeader>
            <div className="space-y-3 p-4 pt-0">
              {!announcements || announcements.length === 0 ? (
                <p className="text-xs text-surface-400 text-center py-4">No announcements.</p>
              ) : (
                announcements.map((ann) => (
                  <div key={ann.id} className="p-3 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200/50 dark:border-surface-700/50">
                    <div className="flex items-center justify-between mb-1">
                      {ann.is_pinned && <Badge variant="primary">Pinned</Badge>}
                      <span className="text-xs text-surface-400">{ann.date}</span>
                    </div>
                    <h4 className="font-semibold text-surface-900 dark:text-surface-100 text-sm">{ann.title}</h4>
                    <p className="text-xs text-surface-600 dark:text-surface-400 mt-1 line-clamp-2">{ann.content}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <div className="space-y-3 p-4 pt-0">
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Attendance</span>
                <span className="font-semibold">{attendance?.attended || 0}/{attendance?.total_classes || 0} classes</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Amount Paid</span>
                <span className="font-semibold text-success-500">₦{(payments?.amount_paid || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Amount Pending</span>
                <span className="font-semibold text-amber-500">₦{(payments?.amount_pending || 0).toLocaleString()}</span>
              </div>
              {carryovers > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-surface-500">Carryovers</span>
                  <span className="font-semibold text-danger-500">{carryovers}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Recent Grades */}
          {recent_grades && recent_grades.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary-500" />
                  <CardTitle>Recent Grades</CardTitle>
                </div>
              </CardHeader>
              <div className="space-y-2 p-4 pt-0">
                {recent_grades.map((g, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <div>
                      <p className="font-semibold text-surface-900 dark:text-surface-100">{g.course_code}</p>
                      <p className="text-[10px] text-surface-400">{g.session_name}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-surface-900 dark:text-surface-100">{g.score.toFixed(1)}</span>
                      {g.grade && <span className="text-xs text-surface-500 ml-1">({g.grade})</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0 space-y-2">
              <Link to="/timetable" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<Calendar className="w-4 h-4" />}>
                  View Timetable
                </Button>
              </Link>
              <Link to="/payments" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<CreditCard className="w-4 h-4" />}>
                  Pay Dues
                </Button>
              </Link>
              <Link to="/results" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<Award className="w-4 h-4" />}>
                  View Results
                </Button>
              </Link>
              <Link to="/notifications" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<Bell className="w-4 h-4" />}>
                  Notifications {notifications?.unread ? `(${notifications.unread})` : ''}
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
