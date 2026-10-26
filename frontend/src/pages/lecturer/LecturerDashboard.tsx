import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { useCurrentDepartment } from '../../components/branding/department';
import { tenantPath } from '../../config/departmentAdminPaths';
import {
  getLecturerDashboardStats,
  listMyLeaveRequests,
  type LecturerDashboardStats,
  type LecturerAssignment,
  type LecturerLeave,
} from '../../api/lecturers';
import { getCourseClassList } from '../../api/courses';
import { getSessions } from '../../api/sessions';
import { listStudentAnnouncements, type AnnouncementV2 } from '../../api/verification-announcements';
import {
  getLecturerPendingAttendanceReviews,
  getLecturerAttendanceHistory,
  type PendingAttendanceReview,
} from '../../api/attendance';
import type { Session } from '../../types';
import { formatTimeAgo } from '../../utils/formatters';
import {
  BookOpen,
  Users,
  FileText,
  Mail,
  ChevronRight,
  Printer,
  Download,
  Calendar,
  MessageSquare,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

const SEMESTER_LABEL: Record<string, string> = {
  first: 'First semester',
  second: 'Second semester',
  harmattan: 'Harmattan',
  rain: 'Rain',
};

function sessionLine(sessionName: string, semester?: string) {
  const sem = semester ? SEMESTER_LABEL[semester] || semester : '';
  return [sessionName, sem].filter(Boolean).join(' · ');
}

export const LecturerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { error: notifyError } = useNotification();
  const department = useCurrentDepartment();
  const urlCode = user?.tenant?.urlCode;

  const [stats, setStats] = useState<LecturerDashboardStats | null>(null);
  const [courses, setCourses] = useState<LecturerAssignment[]>([]);
  const [leaves, setLeaves] = useState<LecturerLeave[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementV2[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingAttendanceReview[]>([]);
  const [reviewHistory, setReviewHistory] = useState<PendingAttendanceReview[]>([]);
  const [loading, setLoading] = useState(true);

  const lecturerName = user?.firstName || user?.fullName?.split(' ')[0] || 'Lecturer';
  const contactEmail = department?.approvalContactEmail || department?.contactEmail || '';
  const classListPath = tenantPath(urlCode, '/l/class-list');
  const leavePath = tenantPath(urlCode, '/l/leave');
  const profilePath = tenantPath(urlCode, '/l/profile');
  const announcementsPath = tenantPath(urlCode, '/l/announcements');
  const attendancePath = tenantPath(urlCode, '/l/attendance-review');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, leavesRes, sessionsRes, annRes, pendingRes, historyRes] = await Promise.allSettled([
        getLecturerDashboardStats(),
        listMyLeaveRequests(),
        getSessions({ page: 1, perPage: 10 }),
        listStudentAnnouncements(),
        getLecturerPendingAttendanceReviews(),
        getLecturerAttendanceHistory(),
      ]);

      let statsData: LecturerDashboardStats | null = null;
      if (statsRes.status === 'fulfilled' && statsRes.value) {
        statsData = statsRes.value;
        setStats(statsData);
      }

      if (leavesRes.status === 'fulfilled' && Array.isArray(leavesRes.value)) {
        setLeaves(leavesRes.value);
      }

      if (sessionsRes.status === 'fulfilled' && Array.isArray(sessionsRes.value)) {
        setSessions(sessionsRes.value);
      }

      if (annRes.status === 'fulfilled' && Array.isArray(annRes.value)) {
        setAnnouncements(annRes.value.slice(0, 5));
      }

      if (pendingRes.status === 'fulfilled') {
        setPendingReviews(pendingRes.value.reviews || []);
      }

      if (historyRes.status === 'fulfilled') {
        setReviewHistory(historyRes.value.history || []);
      }

      const assignments = statsData?.assignments;
      if (Array.isArray(assignments) && assignments.length > 0) {
        const needsCounts = assignments.some((a) => a.enrolled_count == null);
        if (!needsCounts) {
          setCourses(assignments);
        } else {
          const enriched = await Promise.all(
            assignments.map(async (assign) => {
              try {
                const students = await getCourseClassList(assign.course_id);
                return { ...assign, enrolled_count: Array.isArray(students) ? students.length : 0 };
              } catch {
                return { ...assign, enrolled_count: assign.enrolled_count ?? 0 };
              }
            }),
          );
          setCourses(enriched);
        }
      } else {
        setCourses([]);
      }
    } catch {
      notifyError('Failed to load dashboard data', 'Could not sync lecturer statistics.');
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const coursesCount = stats?.courses_assigned ?? courses.length;
  const totalStudents = useMemo(() => {
    if (typeof stats?.total_students === 'number') return stats.total_students;
    return courses.reduce((acc, c) => acc + (c.enrolled_count || 0), 0);
  }, [stats?.total_students, courses]);

  const pendingLeavesCount = useMemo(() => leaves.filter((l) => l.status === 'pending').length, [leaves]);
  const reportCount = pendingReviews.length + reviewHistory.length;
  const hasCourses = courses.length > 0;

  const currentSessionLine = useMemo(() => {
    const first = courses[0];
    if (!first) return '';
    const session =
      sessions.find((s) => s.id === first.session_id) || sessions.find((s) => s.isActive || s.is_active) || sessions[0];
    return sessionLine(session?.name || '', first.semester);
  }, [courses, sessions]);

  const recentReports = useMemo(() => {
    return [...pendingReviews, ...reviewHistory]
      .sort((a, b) => {
        const ta = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
        const tb = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 5);
  }, [pendingReviews, reviewHistory]);

  const handlePrintClassList = () => {
    navigate(classListPath);
  };

  const handleExportCSV = () => {
    if (courses.length === 0) {
      notifyError('No Courses', 'You do not have any courses assigned to export.');
      return;
    }
    navigate(classListPath);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-[#1d68ec] mb-3" />
        <p className="text-sm font-medium">Loading your lecturer dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome back, {lecturerName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your courses and class lists in one place.
          </p>
        </div>
        <Link
          to={classListPath}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161922] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Users className="w-4 h-4 text-slate-500" />
          <span>View class list</span>
        </Link>
      </div>

      {!hasCourses && (
        <div className="rounded-2xl border border-amber-300/40 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 dark:bg-amber-400/15 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No courses assigned yet</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                The HOD assigns courses to lecturers. Once assigned, they show up here with their class lists.
              </p>
            </div>
          </div>
          {contactEmail ? (
            <a
              href={`mailto:${contactEmail}?subject=Course%20Assignment%20Request`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161922] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <Mail className="w-4 h-4 text-slate-500" />
              <span>Contact the department</span>
            </a>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#161922] p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Courses assigned</p>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              {coursesCount}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">This session</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#161922] p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total students</p>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              {totalStudents}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Across your courses</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#161922] p-5 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Class rep reports</p>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              {reportCount}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {pendingReviews.length > 0 ? `${pendingReviews.length} unread` : 'From your classes'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#161922] p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">My courses</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {hasCourses
                    ? currentSessionLine || 'Courses assigned to you for teaching'
                    : 'Courses assigned to you for teaching'}
                </p>
              </div>
              {hasCourses && (
                <Link to={classListPath} className="text-xs font-semibold text-[#1d68ec] hover:underline">
                  View all
                </Link>
              )}
            </div>

            {!hasCourses ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800/80 p-10 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No course assignments found</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                  When the HOD assigns you a course, you will see its students, class rep and quick actions here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {courses.map((course) => (
                  <div
                    key={course.id || course.course_id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {course.course_code} {course.course_title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {course.course_unit} unit{course.course_unit !== 1 ? 's' : ''}
                          {course.level ? ` · Level ${course.level}` : ''}
                          {course.class_rep_name ? ` · Class rep: ${course.class_rep_name}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <div className="text-right">
                        <p className="text-base font-bold text-slate-900 dark:text-white leading-none">
                          {course.enrolled_count ?? 0}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">students</p>
                      </div>
                      <Link
                        to={`${classListPath}?course=${course.course_id}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161922] text-slate-700 dark:text-slate-200"
                      >
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>Class list</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {hasCourses && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#161922] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Class rep reports</h2>
                <Link to={attendancePath} className="text-xs font-semibold text-[#1d68ec] hover:underline">
                  View all
                </Link>
              </div>
              {recentReports.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800/80 p-8 text-center">
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    No attendance reports from class reps at this time.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentReports.map((r) => (
                    <Link
                      key={r.session_id}
                      to={attendancePath}
                      className="block p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {r.course_code}
                        {r.course_title ? ` · ${r.course_title}` : ''}
                      </h4>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        {[r.class_rep_name, r.submitted_at ? formatTimeAgo(r.submitted_at) : '']
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#161922] p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Quick actions</h2>
            <div className="space-y-2">
              <button
                type="button"
                onClick={handlePrintClassList}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left group"
              >
                <div className="flex items-center gap-3">
                  <Printer className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {hasCourses ? 'Print a class list' : 'View class list'}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {hasCourses && (
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left group"
                >
                  <div className="flex items-center gap-3">
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Export CSV</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              )}

              <Link
                to={leavePath}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Leave requests</span>
                </div>
                <div className="flex items-center gap-2">
                  {pendingLeavesCount > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400">
                      {pendingLeavesCount} pending
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </Link>

              <Link
                to="/connect"
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Open Connect</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>

              {!hasCourses && contactEmail && (
                <a
                  href={`mailto:${contactEmail}?subject=${encodeURIComponent('Contact the department')}`}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      Contact the department
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </a>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#161922] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Announcements</h2>
              <Link to={announcementsPath} className="text-xs font-semibold text-[#1d68ec] hover:underline">
                View all
              </Link>
            </div>
            {announcements.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-3 text-center">
                No recent departmental announcements.
              </p>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <Link
                    key={a.id}
                    to={announcementsPath}
                    className="block p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/30"
                  >
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{a.title}</h4>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      {[a.author_name, a.created_at ? formatTimeAgo(a.created_at) : ''].filter(Boolean).join(' · ')}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#161922] p-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Getting started</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Account approved</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Your department approved your account.
              </p>
            </div>
          </div>

          <Link to={profilePath} className="flex items-start gap-3.5 group">
            {user?.phone ? (
              <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 group-hover:border-[#1d68ec] group-hover:text-[#1d68ec]">
                2
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-[#1d68ec]">
                Complete your profile
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Add your phone, office hours and about.
              </p>
            </div>
          </Link>

          <div className="flex items-start gap-3.5">
            {hasCourses ? (
              <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                3
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Get your courses</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Your HOD assigns them to you.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LecturerDashboard;
