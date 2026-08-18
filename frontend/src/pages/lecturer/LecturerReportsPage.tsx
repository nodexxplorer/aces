import { useEffect, useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Users, CalendarCheck, BarChart3 } from 'lucide-react';
import { getLecturerAttendanceOverview, type LecturerCourseAttendance } from '../../api/attendance';
import { getGradeDistribution, type GradeDistribution } from '../../api/predictions';
import { listLecturerAssignments } from '../../api/lecturers';
import { useAuth } from '../../hooks/useAuth';

const rateVariant = (rate: number) => {
  if (rate >= 75) return 'success' as const;
  if (rate >= 50) return 'warning' as const;
  return 'danger' as const;
};

const LecturerReportsPage = () => {
  const { user } = useAuth();
  const [attendanceCourses, setAttendanceCourses] = useState<LecturerCourseAttendance[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [gradeDistributions, setGradeDistributions] = useState<GradeDistribution[]>([]);
  const [gradesLoading, setGradesLoading] = useState(true);

  useEffect(() => {
    getLecturerAttendanceOverview()
      .then((data) => setAttendanceCourses(data.courses))
      .catch(() => setAttendanceCourses([]))
      .finally(() => setAttendanceLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([listLecturerAssignments(user.id), getGradeDistribution()])
      .then(([assignments, allDistributions]) => {
        const myCourseIds = new Set(assignments.map((a) => a.course_id));
        setGradeDistributions(allDistributions.filter((d) => myCourseIds.has(d.course_id)));
      })
      .catch(() => setGradeDistributions([]))
      .finally(() => setGradesLoading(false));
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Lecturer Academic Reports</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review class grade distributions and performance statistics.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {gradesLoading ? (
          <Card>
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
          </Card>
        ) : gradeDistributions.length === 0 ? (
          <Card className="lg:col-span-2 p-12 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-surface-300 mb-4" />
            <p className="text-surface-500">
              No grade data available yet. Distributions will appear once results are published for your courses.
            </p>
          </Card>
        ) : (
          gradeDistributions.map((course) => {
            const chartData = [
              { grade: 'A', count: course.grade_a },
              { grade: 'B', count: course.grade_b },
              { grade: 'C', count: course.grade_c },
              { grade: 'D', count: course.grade_d },
              { grade: 'E', count: course.grade_e },
              { grade: 'F', count: course.grade_f },
            ];
            return (
              <Card key={course.course_id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{course.course_code} Grade Distribution</span>
                    <span className="text-sm font-normal text-surface-400">{course.total_students} students</span>
                  </CardTitle>
                  <CardDescription>{course.course_name}</CardDescription>
                </CardHeader>
                <div className="h-64 p-4 pt-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="grade" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value) => [value, 'Students']} />
                      <Bar dataKey="count" fill="#0066CC" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance by Course</CardTitle>
          <CardDescription>Average class attendance rate this semester, per course you teach</CardDescription>
        </CardHeader>
        <div className="px-5 pb-5">
          {attendanceLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
            </div>
          ) : attendanceCourses.length === 0 ? (
            <p className="text-sm text-surface-500 text-center py-6">
              No attendance sessions recorded yet this semester.
            </p>
          ) : (
            <div className="space-y-3">
              {attendanceCourses.map((c) => (
                <div
                  key={c.course_id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-surface-150 dark:border-surface-700"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="primary">{c.course_code}</Badge>
                      <span className="text-sm font-medium text-surface-800 dark:text-surface-200">
                        {c.course_title}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-surface-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {c.class_size} students
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarCheck className="w-3.5 h-3.5" /> {c.total_sessions} sessions held
                      </span>
                    </div>
                  </div>
                  <Badge variant={rateVariant(c.avg_attendance_rate)} className="self-start sm:self-auto">
                    {c.avg_attendance_rate.toFixed(0)}% avg attendance
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default LecturerReportsPage;
