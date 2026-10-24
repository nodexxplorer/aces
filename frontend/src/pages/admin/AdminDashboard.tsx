import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import {
  Users,
  BookOpen,
  HelpCircle,
  Award,
  ArrowUpRight,
  FileText,
  UserPlus,
  Calendar,
  CreditCard,
  Mail,
  HardDrive,
  BarChart3,
  Megaphone,
  Plus,
  Send,
  Loader2,
  Check,
  Activity,
} from 'lucide-react';
import { getDashboardAnalytics } from '../../api/analytics';
import { getUsers, getPendingApprovals } from '../../api/users';
import { getSessions, listSessionSemesters } from '../../api/sessions';
import { getAllComplaints } from '../../api/complaints';
import { getAllDues, getAllPayments } from '../../api/payments';
import { getCourses } from '../../api/courses';
import { listAllCRFHistory } from '../../api/crf-signing';
import { createAnnouncementV2 } from '../../api/verification-announcements';
import type { Session, SemesterEntry, User, DuePayment } from '../../types';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { success, error: notifyError } = useNotification();

  const [loading, setLoading] = useState(true);

  // Real data state
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersThisWeek, setUsersThisWeek] = useState(0);
  const [roleCounts, setRoleCounts] = useState({ students: 0, staff: 0, hod: 0, other: 0 });
  const [levelCounts, setLevelCounts] = useState<Record<number, { registered: number; total: number }>>({
    100: { registered: 0, total: 0 },
    200: { registered: 0, total: 0 },
    300: { registered: 0, total: 0 },
    400: { registered: 0, total: 0 },
    500: { registered: 0, total: 0 },
  });

  const [totalCourses, setTotalCourses] = useState(0);

  const [complaintsCount, setComplaintsCount] = useState(0);
  const [unansweredComplaints, setUnansweredComplaints] = useState(0);

  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [activeSemester, setActiveSemester] = useState<SemesterEntry | null>(null);
  const [registeredStudentsCount, setRegisteredStudentsCount] = useState(0);

  // Course forms signing
  const [signedFormsCount, setSignedFormsCount] = useState(0);
  const [waitingFormsCount, setWaitingFormsCount] = useState(0);
  const [oldFormsCount, setOldFormsCount] = useState(0);

  // Dues & Payments
  const [duesCollected, setDuesCollected] = useState(0);
  const [duesTarget, setDuesTarget] = useState(0);
  const [, setHasDues] = useState(false);

  // Middle right card toggle: 'announcement' or 'health'
  const [middleCardTab, setMiddleCardTab] = useState<'announcement' | 'health'>('health');

  // Quick announcement state
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementAudience, setAnnouncementAudience] = useState<'all' | 'level500' | 'staff'>('all');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || 'Bliss';

  useEffect(() => {
    fetchAllDashboardData();
  }, []);

  const fetchAllDashboardData = async () => {
    try {
      setLoading(true);

      const [
        analyticsRes,
        usersRes,
        pendingApprovalsRes,
        sessionsRes,
        complaintsRes,
        duesRes,
        paymentsRes,
        coursesRes,
        crfRes,
      ] = await Promise.allSettled([
        getDashboardAnalytics(),
        getUsers({ perPage: 100 }),
        getPendingApprovals(),
        getSessions(),
        getAllComplaints(),
        getAllDues(),
        getAllPayments(),
        getCourses({ perPage: 100 }),
        listAllCRFHistory(),
      ]);

      // 1. Analytics & Basic Stats
      let analyticsData = null;
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value) {
        analyticsData = analyticsRes.value;
      }

      // 2. Users calculation
      if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value)) {
        const usersList: User[] = usersRes.value;
        // This week calculation
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const recent = usersList.filter((u) => {
          if (!u.createdAt) return false;
          const created = new Date(u.createdAt).getTime();
          return now - created <= sevenDaysMs;
        }).length;
        setUsersThisWeek(recent);

        // Role Breakdown
        let stCount = 0;
        let staffCount = 0;
        let hodCount = 0;
        let othCount = 0;

        const levels: Record<number, { registered: number; total: number }> = {
          100: { registered: 0, total: 0 },
          200: { registered: 0, total: 0 },
          300: { registered: 0, total: 0 },
          400: { registered: 0, total: 0 },
          500: { registered: 0, total: 0 },
        };

        usersList.forEach((u) => {
          const r = u.role || u.activeRole || '';
          if (r === 'student' || r === 'class_rep' || r === 'class_bursar' || r === 'alumni') {
            stCount++;
            const lvl = Number(u.level);
            if (lvl && levels[lvl]) {
              levels[lvl].total++;
              // If user has onboardingCompleted or active session registration
              if (u.onboardingCompleted !== false) {
                levels[lvl].registered++;
              }
            }
          } else if (r === 'lecturer' || r === 'dept_bursar') {
            staffCount++;
          } else if (r === 'hod' || r === 'admin' || r === 'delegated_admin') {
            hodCount++;
          } else {
            othCount++;
          }
        });

        setRoleCounts({ students: stCount, staff: staffCount, hod: hodCount, other: othCount });
        setLevelCounts(levels);
        setRegisteredStudentsCount(Object.values(levels).reduce((sum, item) => sum + item.registered, 0));
      }

      // The total is every user on the server. The user list is one page (at most 100), so it is only a fallback.
      if (analyticsData) {
        setTotalUsers((analyticsData.totalStudents ?? 0) + (analyticsData.totalLecturers ?? 0));
      } else if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value)) {
        setTotalUsers(usersRes.value.length);
      }

      // 3. Pending approvals (New accounts queue)
      if (pendingApprovalsRes.status === 'fulfilled' && Array.isArray(pendingApprovalsRes.value)) {
        setPendingApprovalsCount(pendingApprovalsRes.value.length);
      }

      // 4. Courses
      if (coursesRes.status === 'fulfilled' && Array.isArray(coursesRes.value)) {
        setTotalCourses(coursesRes.value.length);
      } else if (analyticsData?.totalCourses) {
        setTotalCourses(analyticsData.totalCourses);
      }

      // 5. Complaints
      if (complaintsRes.status === 'fulfilled' && Array.isArray(complaintsRes.value)) {
        const complaintsList = complaintsRes.value;
        const open = complaintsList.filter((c) => c.status === 'open' || c.status === 'in_review').length;
        const unanswered = complaintsList.filter((c) => c.status === 'open').length;
        setComplaintsCount(open);
        setUnansweredComplaints(unanswered);
      } else if (analyticsData?.activeComplaints) {
        setComplaintsCount(analyticsData.activeComplaints);
      }

      // 6. Sessions & Semesters
      if (sessionsRes.status === 'fulfilled' && Array.isArray(sessionsRes.value)) {
        const sessions = sessionsRes.value;
        const currentActive = sessions.find((s) => s.is_active || s.isActive) || sessions[0] || null;
        setActiveSession(currentActive);

        if (currentActive?.id) {
          try {
            const semesters = await listSessionSemesters(currentActive.id);
            if (Array.isArray(semesters) && semesters.length > 0) {
              const activeSem = semesters.find((sm) => sm.is_active || sm.is_active) || semesters[0];
              setActiveSemester(activeSem);
            }
          } catch {
            // silent fallback
          }
        }
      }

      // 7. Dues and Payments
      let duesList: DuePayment[] = [];
      if (duesRes.status === 'fulfilled' && Array.isArray(duesRes.value)) {
        duesList = duesRes.value;
        setHasDues(duesList.length > 0);
      }

      if (paymentsRes.status === 'fulfilled' && Array.isArray(paymentsRes.value)) {
        const paymentsList = paymentsRes.value;
        const collected = paymentsList
          .filter((p) => p.status === 'completed' || p.status === 'success' || p.status === 'verified')
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        setDuesCollected(collected);

        // Calculate target from dues list or default reasonable calculation
        if (duesList.length > 0) {
          const totalDuesPrice = duesList.reduce((sum: number, d: DuePayment) => sum + (Number(d.amount) || 0), 0);
          setDuesTarget(totalDuesPrice * Math.max(1, totalUsers));
        } else {
          setDuesTarget(0);
        }
      }

      // 8. Course forms from real CRF submissions. Signed and waiting count the
      // current session's completed and draft forms; old forms are those from other sessions.
      const currentSessionId =
        sessionsRes.status === 'fulfilled' && Array.isArray(sessionsRes.value)
          ? (sessionsRes.value.find((s) => s.is_active || s.isActive) || sessionsRes.value[0])?.id
          : undefined;
      if (crfRes.status === 'fulfilled' && Array.isArray(crfRes.value)) {
        const currentForms = crfRes.value.filter((f) => f.session_id === currentSessionId);
        setSignedFormsCount(currentForms.filter((f) => f.status === 'completed').length);
        setWaitingFormsCount(currentForms.filter((f) => f.status === 'draft').length);
        setOldFormsCount(crfRes.value.length - currentForms.length);
      } else {
        setSignedFormsCount(0);
        setWaitingFormsCount(0);
        setOldFormsCount(0);
      }
    } catch (err) {
      console.error('Error fetching admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      notifyError('Missing Fields', 'Please provide a title and message.');
      return;
    }

    try {
      setPostingAnnouncement(true);
      const targetAudience =
        announcementAudience === 'all'
          ? ['student', 'lecturer', 'class_rep']
          : announcementAudience === 'staff'
            ? ['lecturer', 'hod']
            : ['student'];

      const targetLevels = announcementAudience === 'level500' ? [500] : [];

      await createAnnouncementV2({
        title: announcementTitle.trim(),
        content: announcementMessage.trim(),
        target_audience: targetAudience,
        target_levels: targetLevels,
        priority: 'normal',
        category: 'academic',
        status: 'published',
      });

      success('Announcement Posted', 'Your announcement has been broadcast successfully.');
      setAnnouncementTitle('');
      setAnnouncementMessage('');
    } catch (_err: unknown) {
      notifyError('Failed to Post', 'Could not post announcement. Please try again.');
    } finally {
      setPostingAnnouncement(false);
    }
  };

  const totalAttentionItems = waitingFormsCount + complaintsCount + pendingApprovalsCount;

  // Donut chart angles calculation
  // The role split comes from the loaded user page, so the donut is drawn from that page's own total.
  const totalDonutUsers = Math.max(1, roleCounts.students + roleCounts.staff + roleCounts.hod + roleCounts.other);
  const studentFraction = roleCounts.students / totalDonutUsers;
  const staffFraction = roleCounts.staff / totalDonutUsers;
  const hodFraction = roleCounts.hod / totalDonutUsers;
  const otherFraction = roleCounts.other / totalDonutUsers;

  const circumference = 2 * Math.PI * 40; // r = 40
  const studentStroke = studentFraction * circumference;
  const staffStroke = staffFraction * circumference;
  const hodStroke = hodFraction * circumference;
  const otherStroke = otherFraction * circumference;

  const duesPercent = duesTarget > 0 ? Math.min(100, Math.round((duesCollected / duesTarget) * 100)) : 0;
  const duesOutstanding = Math.max(0, duesTarget - duesCollected);

  const semesterDisplayName = activeSemester?.name
    ? activeSemester.name.charAt(0).toUpperCase() + activeSemester.name.slice(1)
    : activeSession
      ? 'First'
      : 'None';

  // Registration deadline computation from real semester data
  const regDeadline = activeSemester?.registration_deadline;
  const daysUntilRegClose = regDeadline
    ? Math.max(0, Math.ceil((new Date(regDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const isRegOpen = activeSemester?.is_active ?? false;

  return (
    <div className="space-y-6 pb-12 font-sans antialiased text-surface-900 dark:text-surface-100">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-surface-900 dark:text-white">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            System overview and recent activity for the current academic session.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setMiddleCardTab('announcement');
              navigate('/admin/announcements');
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 transition-colors shadow-sm"
          >
            <Megaphone className="w-3.5 h-3.5 text-surface-600 dark:text-surface-300" />
            New announcement
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/duesmanagement')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create dues
          </button>
        </div>
      </div>

      {/* ── No Active Semester Banner (Shown when no session is active) ── */}
      {!activeSession && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-surface-900 dark:text-white">No active semester</h3>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                Students cannot register for courses until a session is opened.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/sessions')}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white transition-colors shrink-0 shadow-sm"
          >
            Open a session
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── 4 Top Stat Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Users */}
        <div
          onClick={() => navigate('/admin/users')}
          className="group relative rounded-2xl p-5 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 hover:border-surface-300 dark:hover:border-surface-700 transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-primary-500 dark:text-primary-400">
              <Users className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-surface-400 group-hover:text-primary-500 dark:group-hover:text-white transition-colors" />
          </div>
          <div>
            <div className="text-3xl font-bold text-surface-900 dark:text-white mt-4 tracking-tight">
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-surface-400" /> : totalUsers}
            </div>
            <div className="text-xs font-medium text-surface-500 dark:text-surface-400 mt-1">Total users</div>
            <div className="text-xs font-semibold text-emerald-500 flex items-center gap-1 mt-3">
              {usersThisWeek > 0 ? (
                <>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>+{usersThisWeek} this week</span>
                </>
              ) : (
                <span>Student, HOD</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Total Courses */}
        <div
          onClick={() => navigate('/admin/course-hub')}
          className="group relative rounded-2xl p-5 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 hover:border-surface-300 dark:hover:border-surface-700 transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-primary-500 dark:text-primary-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-surface-400 group-hover:text-primary-500 dark:group-hover:text-white transition-colors" />
          </div>
          <div>
            <div className="text-3xl font-bold text-surface-900 dark:text-white mt-4 tracking-tight">
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-surface-400" /> : totalCourses}
            </div>
            <div className="text-xs font-medium text-surface-500 dark:text-surface-400 mt-1">Total courses</div>
            <div className="text-xs font-medium text-surface-500 dark:text-surface-400 mt-3">
              {activeSession ? 'Active session' : 'Ready to publish'}
            </div>
          </div>
        </div>

        {/* Card 3: Active Complaints */}
        <div
          onClick={() => navigate('/i/complaints')}
          className="group relative rounded-2xl p-5 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 hover:border-surface-300 dark:hover:border-surface-700 transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-primary-500 dark:text-primary-400">
              <HelpCircle className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-surface-400 group-hover:text-primary-500 dark:group-hover:text-white transition-colors" />
          </div>
          <div>
            <div className="text-3xl font-bold text-surface-900 dark:text-white mt-4 tracking-tight">
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-surface-400" /> : complaintsCount}
            </div>
            <div className="text-xs font-medium text-surface-500 dark:text-surface-400 mt-1">Active complaints</div>
            <div className="text-xs font-semibold mt-3">
              {complaintsCount === 0 ? (
                <span className="text-emerald-500 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> All clear
                </span>
              ) : (
                <span className="text-surface-500 dark:text-surface-400">{unansweredComplaints} unanswered</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Current Semester */}
        <div
          onClick={() => navigate('/admin/sessions')}
          className="group relative rounded-2xl p-5 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 hover:border-surface-300 dark:hover:border-surface-700 transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-primary-500 dark:text-primary-400">
              <Award className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-surface-400 group-hover:text-primary-500 dark:group-hover:text-white transition-colors" />
          </div>
          <div>
            <div className="text-3xl font-bold text-surface-900 dark:text-white mt-4 tracking-tight">
              {semesterDisplayName}
            </div>
            <div className="text-xs font-medium text-surface-500 dark:text-surface-400 mt-1">Current semster</div>
            <div className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5 mt-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span>{activeSession ? 'Active' : 'active'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Needs Attention & Semester Control ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Needs your attention */}
        <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-surface-900 dark:text-white">Needs your attention</h2>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                  {totalAttentionItems > 0
                    ? `${totalAttentionItems} items across 3 queues`
                    : 'Nothing is waiting on you right now'}
                </p>
              </div>

              {totalAttentionItems > 0 ? (
                <span className="bg-amber-400 text-surface-950 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                  Priority first
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                  <Check className="w-3 h-3" /> Up to date
                </span>
              )}
            </div>

            <div className="space-y-4 mt-6">
              {/* Queue 1: Course forms */}
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-300">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-900 dark:text-white leading-tight">
                      Course forms
                    </h3>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">Waiting for your signature</p>
                  </div>
                </div>

                {waitingFormsCount > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
                      {waitingFormsCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/admin/crf-signing')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors"
                    >
                      Review
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> All clear
                  </span>
                )}
              </div>

              {/* Queue 2: Complaints */}
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-300">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-900 dark:text-white leading-tight">Complaints</h3>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                      {complaintsCount > 0
                        ? `${complaintsCount} open, ${unansweredComplaints} unanswered`
                        : 'Open student tickets'}
                    </p>
                  </div>
                </div>

                {complaintsCount > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
                      {complaintsCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/i/complaints')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors"
                    >
                      Review
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> All clear
                  </span>
                )}
              </div>

              {/* Queue 3: New accounts */}
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-300">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-900 dark:text-white leading-tight">
                      New accounts
                    </h3>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">Waiting for approval</p>
                  </div>
                </div>

                {pendingApprovalsCount > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
                      {pendingApprovalsCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/admin/user-roles')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors"
                    >
                      Review
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> All clear
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Semester control */}
        <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
          {activeSession ? (
            /* Active Session View */
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-surface-900 dark:text-white">Semester control</h2>
                  <span
                    className={`inline-flex items-center gap-1 ${isRegOpen ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-surface-100 dark:bg-surface-800 text-surface-500 border-surface-300 dark:border-surface-700'} border text-[11px] font-semibold px-2.5 py-0.5 rounded-full`}
                  >
                    <Check className="w-3 h-3" /> {isRegOpen ? 'Registration open' : 'Registration closed'}
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-xl font-bold text-surface-900 dark:text-white tracking-tight">
                    {activeSession.name} · {semesterDisplayName} semester
                  </h3>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                    {isRegOpen && daysUntilRegClose !== null
                      ? `Registration closes in ${daysUntilRegClose} day${daysUntilRegClose !== 1 ? 's' : ''}`
                      : isRegOpen
                        ? 'Registration is open (no deadline set)'
                        : 'Registration is currently closed'}
                  </p>
                </div>

                <div className="space-y-4 mt-6">
                  {/* Progress 1: Registered */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span className="text-surface-600 dark:text-surface-300">Registered</span>
                      <span className="text-surface-900 dark:text-white font-bold">
                        {registeredStudentsCount}/{totalUsers || '—'}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-600 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((registeredStudentsCount / Math.max(1, totalUsers)) * 100),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Progress 2: Course forms */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span className="text-surface-600 dark:text-surface-300">Course forms</span>
                      <span className="text-surface-900 dark:text-white font-bold">
                        {signedFormsCount}/{Math.max(1, registeredStudentsCount)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((signedFormsCount / Math.max(1, registeredStudentsCount)) * 100),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-6 mt-6 border-t border-surface-100 dark:border-surface-800">
                <button
                  type="button"
                  onClick={() => navigate('/admin/sessions')}
                  className="flex-1 px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 transition-colors text-center"
                >
                  Extend window
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin/sessions')}
                  className="flex-1 px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 transition-colors text-center"
                >
                  Close registration
                </button>
              </div>
            </div>
          ) : (
            /* No Active Session View */
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-surface-900 dark:text-white">Semester control</h2>
                  <span className="bg-amber-400 text-surface-950 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                    No active session
                  </span>
                </div>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                  Students cannot register until a session is open.
                </p>

                <div className="space-y-4 mt-6">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-surface-900 dark:text-white">Create a session</h4>
                      <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
                        Set the academic year and semester dates
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full border border-surface-300 dark:border-surface-700 text-surface-500 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-surface-900 dark:text-white">Open registration</h4>
                      <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
                        Choose when students can register
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full border border-surface-300 dark:border-surface-700 text-surface-500 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-surface-900 dark:text-white">Publish courses</h4>
                      <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
                        {totalCourses} courses are ready to publish
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-surface-100 dark:border-surface-800">
                <button
                  type="button"
                  onClick={() => navigate('/admin/sessions')}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create a session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Registration by Level / Course Forms / Dues ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Registration by level */}
        <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-surface-900 dark:text-white">Registration by level</h2>
              <button
                type="button"
                onClick={() => navigate('/admin/analytics')}
                className="text-primary-600 dark:text-primary-400 hover:underline text-xs font-semibold"
              >
                Details
              </button>
            </div>

            {activeSession && registeredStudentsCount > 0 ? (
              <div className="space-y-3 mt-5">
                {[100, 200, 300, 400, 500].map((lvl) => {
                  const data = levelCounts[lvl] || { registered: 0, total: 0 };
                  const percent = data.total > 0 ? Math.round((data.registered / data.total) * 100) : 0;
                  return (
                    <div key={lvl} className="flex items-center gap-3">
                      <span className="w-16 text-xs text-surface-600 dark:text-surface-400 font-medium">
                        Level {lvl}
                      </span>
                      <div className="flex-1 h-2 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-600 rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs font-semibold text-surface-900 dark:text-white">
                        {data.registered}/{data.total}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-800 text-primary-500 flex items-center justify-center mb-3">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-semibold text-surface-900 dark:text-white">Starts when a session opens</h4>
                <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-1 max-w-[200px]">
                  See who has registered and who has not, level by level.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Course form signing */}
        <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-surface-900 dark:text-white">Course form signing</h2>
              <button
                type="button"
                onClick={() => navigate('/admin/crf-signing')}
                className="text-primary-600 dark:text-primary-400 hover:underline text-xs font-semibold"
              >
                Open queue
              </button>
            </div>

            {signedFormsCount > 0 || waitingFormsCount > 0 ? (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl p-3 bg-surface-50 dark:bg-surface-800/60 border border-surface-200/50 dark:border-surface-800 text-center">
                    <div className="text-xl font-bold text-emerald-500">{signedFormsCount}</div>
                    <div className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">Signed</div>
                  </div>
                  <div className="rounded-xl p-3 bg-surface-50 dark:bg-surface-800/60 border border-surface-200/50 dark:border-surface-800 text-center">
                    <div className="text-xl font-bold text-surface-900 dark:text-white">{waitingFormsCount}</div>
                    <div className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">Waiting</div>
                  </div>
                  <div className="rounded-xl p-3 bg-surface-50 dark:bg-surface-800/60 border border-surface-200/50 dark:border-surface-800 text-center">
                    <div className="text-xl font-bold text-surface-900 dark:text-white">{oldFormsCount}</div>
                    <div className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">Old forms</div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-surface-600 dark:text-surface-300">Signed</span>
                    <span className="text-surface-900 dark:text-white font-bold">
                      {signedFormsCount}/{signedFormsCount + waitingFormsCount}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((signedFormsCount / Math.max(1, signedFormsCount + waitingFormsCount)) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-800 text-primary-500 flex items-center justify-center mb-3">
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-semibold text-surface-900 dark:text-white">No forms yet</h4>
                <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-1 max-w-[200px]">
                  Signed and waiting forms show up here once students upload them.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Dues collection */}
        <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-surface-900 dark:text-white">Dues collection</h2>
              <CreditCard className="w-4 h-4 text-surface-400" />
            </div>

            <div className="mt-4">
              <div className="text-2xl font-bold text-surface-900 dark:text-white tracking-tight">
                ₦{duesCollected.toLocaleString()}
              </div>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                {duesTarget > 0 ? `collected of ₦${duesTarget.toLocaleString()}` : 'No dues created yet'}
              </p>

              <div className="h-2 w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden mt-4">
                <div
                  className="h-full bg-primary-600 rounded-full transition-all duration-500"
                  style={{ width: `${duesPercent}%` }}
                />
              </div>

              {duesTarget > 0 ? (
                <div className="flex items-center justify-between text-[11px] font-semibold mt-2">
                  <span className="text-emerald-500">{duesPercent}% collected</span>
                  <span className="text-surface-500 dark:text-surface-400">
                    ₦{duesOutstanding.toLocaleString()} outstanding
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-2">
                  Create dues so students can pay and you can track collection.
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 mt-4">
            {duesTarget > 0 ? (
              <button
                type="button"
                onClick={() => navigate('/admin/revenue-forecast')}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 transition-colors shadow-sm"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Open revenue forecast
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/admin/duesmanagement')}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Create dues
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 4: Support & Feedback / Quick Announcement or System Health / Users by Role ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Support and feedback */}
        <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-surface-900 dark:text-white">Support and feedback</h2>
              <button
                type="button"
                onClick={() => navigate('/i/complaints')}
                className="text-primary-600 dark:text-primary-400 hover:underline text-xs font-semibold"
              >
                Open inbox
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-5">
              <div className="rounded-xl p-3 bg-surface-50 dark:bg-surface-800/60 border border-surface-200/50 dark:border-surface-800 text-center">
                <div className="text-xl font-bold text-surface-900 dark:text-white">{complaintsCount}</div>
                <div className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">Open tickets</div>
              </div>
              <div className="rounded-xl p-3 bg-surface-50 dark:bg-surface-800/60 border border-surface-200/50 dark:border-surface-800 text-center">
                <div className="text-xl font-bold text-surface-900 dark:text-white">{unansweredComplaints}</div>
                <div className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">Unanswered</div>
              </div>
              <div className="rounded-xl p-3 bg-surface-50 dark:bg-surface-800/60 border border-surface-200/50 dark:border-surface-800 text-center">
                <div className="text-xl font-bold text-surface-900 dark:text-white">4.6</div>
                <div className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">Avg rating</div>
              </div>
            </div>

            <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-4">
              {complaintsCount > 0 ? '2 new feedback ideas this week' : 'No tickets or feedback yet'}
            </p>
          </div>
        </div>

        {/* Middle Card: Toggle between Quick Announcement and System Health */}
        <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
          {middleCardTab === 'health' ? (
            /* System health view */
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-surface-900 dark:text-white">System health</h2>
                <button
                  type="button"
                  title="Switch to quick announcement"
                  onClick={() => setMiddleCardTab('announcement')}
                  className="text-xs text-surface-400 hover:text-primary-500 p-1"
                >
                  <Megaphone className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 mt-5">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-50/50 dark:bg-surface-800/40">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-4 h-4 text-surface-400" />
                    <span className="text-xs font-medium text-surface-800 dark:text-surface-200">Payment gateway</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Operational
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-50/50 dark:bg-surface-800/40">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-surface-400" />
                    <span className="text-xs font-medium text-surface-800 dark:text-surface-200">Email delivery</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Operational
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-50/50 dark:bg-surface-800/40">
                  <div className="flex items-center gap-3">
                    <HardDrive className="w-4 h-4 text-surface-400" />
                    <span className="text-xs font-medium text-surface-800 dark:text-surface-200">File storage</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Operational
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Quick announcement view */
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-surface-900 dark:text-white">Quick announcement</h2>
                <button
                  type="button"
                  title="Switch to system health"
                  onClick={() => setMiddleCardTab('health')}
                  className="text-xs text-surface-400 hover:text-primary-500 p-1"
                >
                  <Activity className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handlePostAnnouncement} className="space-y-3 mt-4">
                <input
                  type="text"
                  placeholder="Title"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                />

                <textarea
                  rows={2}
                  placeholder="Write a short message..."
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
                />

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setAnnouncementAudience('all')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                      announcementAudience === 'all'
                        ? 'bg-primary-600 text-white'
                        : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                    }`}
                  >
                    All students
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnouncementAudience('level500')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                      announcementAudience === 'level500'
                        ? 'bg-primary-600 text-white'
                        : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                    }`}
                  >
                    Level 500
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnouncementAudience('staff')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                      announcementAudience === 'staff'
                        ? 'bg-primary-600 text-white'
                        : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                    }`}
                  >
                    Staff
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={postingAnnouncement}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white transition-colors shadow-sm disabled:opacity-50 mt-1"
                >
                  {postingAnnouncement ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Post announcement
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Users by role */}
        <div className="rounded-2xl p-6 bg-white dark:bg-surface-900/70 border border-surface-200 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-surface-900 dark:text-white">Users by role</h2>
              <button
                type="button"
                onClick={() => navigate('/admin/user-roles')}
                className="text-primary-600 dark:text-primary-400 hover:underline text-xs font-semibold"
              >
                Roles
              </button>
            </div>

            <div className="flex items-center justify-between gap-6 mt-6">
              {/* Donut Chart */}
              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="10"
                    className="text-surface-100 dark:text-surface-800"
                  />
                  {/* Students (Blue) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#3b82f6"
                    strokeWidth="10"
                    strokeDasharray={`${studentStroke} ${circumference}`}
                    strokeDashoffset="0"
                  />
                  {/* Staff (Yellow) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#eab308"
                    strokeWidth="10"
                    strokeDasharray={`${staffStroke} ${circumference}`}
                    strokeDashoffset={-studentStroke}
                  />
                  {/* HOD (Emerald) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#10b981"
                    strokeWidth="10"
                    strokeDasharray={`${hodStroke} ${circumference}`}
                    strokeDashoffset={-(studentStroke + staffStroke)}
                  />
                  {/* Other (Slate) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#94a3b8"
                    strokeWidth="10"
                    strokeDasharray={`${otherStroke} ${circumference}`}
                    strokeDashoffset={-(studentStroke + staffStroke + hodStroke)}
                  />
                </svg>

                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-xl font-bold text-surface-900 dark:text-white leading-none">{totalUsers}</span>
                  <span className="text-[10px] text-surface-500 dark:text-surface-400 mt-0.5">users</span>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-2.5 flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-surface-600 dark:text-surface-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                    Students
                  </span>
                  <span className="font-bold text-surface-900 dark:text-white">{roleCounts.students}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-surface-600 dark:text-surface-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    Staff
                  </span>
                  <span className="font-bold text-surface-900 dark:text-white">{roleCounts.staff}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-surface-600 dark:text-surface-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    HOD
                  </span>
                  <span className="font-bold text-surface-900 dark:text-white">{roleCounts.hod}</span>
                </div>

                {roleCounts.other > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-surface-600 dark:text-surface-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                      Other
                    </span>
                    <span className="font-bold text-surface-900 dark:text-white">{roleCounts.other}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
