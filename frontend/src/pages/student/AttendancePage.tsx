import { useEffect, useState } from 'react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { CalendarCheck, CheckCircle2, XCircle, MapPin, ClipboardList } from 'lucide-react';
import {
  getMyAttendanceOverview,
  getMyCourseAttendance,
  type StudentAttendanceOverview,
  type StudentCourseAttendance,
  type StudentCourseAttendanceSession,
} from '../../api/attendance';

const rateVariant = (rate: number) => {
  if (rate >= 75) return 'success' as const;
  if (rate >= 50) return 'warning' as const;
  return 'danger' as const;
};

const AttendancePage = () => {
  const { error: notifyError } = useNotification();
  const [overview, setOverview] = useState<StudentAttendanceOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedCourse, setSelectedCourse] = useState<StudentCourseAttendance | null>(null);
  const [sessions, setSessions] = useState<StudentCourseAttendanceSession[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    getMyAttendanceOverview()
      .then(setOverview)
      .catch(() => notifyError('Error', 'Failed to load attendance overview'))
      .finally(() => setLoading(false));
  }, []);

  const openCourse = async (course: StudentCourseAttendance) => {
    setSelectedCourse(course);
    setDetailLoading(true);
    try {
      const detail = await getMyCourseAttendance(course.course_id);
      setSessions(detail.sessions);
    } catch {
      notifyError('Error', 'Failed to load session history for this course');
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  const summary = overview?.summary;
  const courses = overview?.courses ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">My Attendance</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Overall attendance and per-course totals for the current semester.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-surface-400 font-medium">Overall Attendance</p>
            <p className="text-4xl font-bold text-surface-900 dark:text-white mt-1">
              {(summary?.attendance_rate ?? 100).toFixed(0)}%
            </p>
            <p className="text-xs text-surface-500 mt-1">
              {summary?.present ?? 0} of {summary?.total_sessions ?? 0} classes attended
            </p>
          </div>
          <Badge variant={rateVariant(summary?.attendance_rate ?? 100)} className="text-sm px-3 py-1">
            {summary && summary.total_sessions > 0
              ? summary.attendance_rate >= 75
                ? 'Good Standing'
                : summary.attendance_rate >= 50
                  ? 'At Risk'
                  : 'Below Minimum'
              : 'No Classes Yet'}
          </Badge>
        </div>
      </Card>

      {courses.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardList className="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
          <p className="text-sm text-surface-500">No registered courses with attendance records yet this semester.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => (
            <Card key={c.course_id} hover onClick={() => openCourse(c)} className="p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <Badge variant="primary">{c.course_code}</Badge>
                <Badge variant={rateVariant(c.attendance_rate)}>{c.attendance_rate.toFixed(0)}%</Badge>
              </div>
              <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 line-clamp-2 mb-3">
                {c.course_title}
              </p>
              <div className="h-1.5 rounded-full bg-surface-100 dark:bg-surface-700 overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full ${
                    c.attendance_rate >= 75
                      ? 'bg-success-500'
                      : c.attendance_rate >= 50
                        ? 'bg-warning-500'
                        : 'bg-danger-500'
                  }`}
                  style={{ width: `${Math.min(c.attendance_rate, 100)}%` }}
                />
              </div>
              <p className="text-xs text-surface-500">
                {c.present} present · {c.absent} absent · {c.total_sessions} total
              </p>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!selectedCourse}
        onClose={() => setSelectedCourse(null)}
        title={selectedCourse ? `${selectedCourse.course_code} — Attendance History` : undefined}
        size="lg"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8">
            <CalendarCheck className="w-10 h-10 mx-auto text-surface-300 dark:text-surface-600 mb-2" />
            <p className="text-sm text-surface-500">No classes recorded for this course yet.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {sessions.map((s) => (
              <div
                key={s.session_id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-surface-150 dark:border-surface-700"
              >
                <div>
                  <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                    {new Date(s.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  {s.venue && (
                    <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> {s.venue}
                    </p>
                  )}
                </div>
                {s.present ? (
                  <Badge variant="success" dot>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Present
                  </Badge>
                ) : (
                  <Badge variant="danger" dot>
                    <XCircle className="w-3.5 h-3.5" /> Absent
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AttendancePage;
