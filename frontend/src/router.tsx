/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import {
  departmentAdminHome,
  departmentAdminPath,
  departmentDashboardPath,
  departmentProfilePath,
  tenantPath,
} from './config/departmentAdminPaths';
import type { UserRole } from './types';

/* ── Lazy-loaded pages ───────────────────────── */
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const StaffPortalLoginPage = lazy(() => import('./pages/auth/StaffPortalLoginPage'));
const DepartmentEntry = lazy(() => import('./pages/auth/DepartmentEntry'));
const LoginCelebrationPage = lazy(() => import('./pages/auth/LoginCelebrationPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/PasswordResetOTPPage'));
const StudentSignupPage = lazy(() => import('./pages/auth/StudentSignupPage'));
const LecturerSignupPage = lazy(() => import('./pages/auth/LecturerSignupPage'));
const StudentOnboardingPage = lazy(() => import('./pages/onboarding/StudentOnboardingPage'));
const StudentAttendancePage = lazy(() => import('./pages/student/AttendancePage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Student
const ResultsPage = lazy(() => import('./pages/student/ResultsPage'));
const ResultDetailPage = lazy(() => import('./pages/student/ResultDetailPage'));
const PaymentsPage = lazy(() => import('./pages/student/PaymentsPage'));
const PaymentConfirmationPage = lazy(() => import('./pages/student/PaymentConfirmationPage'));
const CoursesPage = lazy(() => import('./pages/student/CoursesPage'));
const ComplaintsPage = lazy(() => import('./pages/student/ComplaintsPage'));
const StudentProfilePage = lazy(() => import('./pages/student/StudentProfilePage'));
const LecturerProfilePage = lazy(() => import('./pages/lecturer/LecturerProfilePage'));
const AdminProfilePage = lazy(() => import('./pages/admin/AdminProfilePage'));
const StudentJobBoardPage = lazy(() => import('./pages/student/StudentJobBoardPage'));
const MyApplicationsPage = lazy(() => import('./pages/student/MyApplicationsPage'));

// Lecturer
const LecturerDashboard = lazy(() => import('./pages/lecturer/LecturerDashboard'));
const LecturerGradesPage = lazy(() => import('./pages/lecturer/GradesPage'));
const AssignmentsPage = lazy(() => import('./pages/lecturer/AssignmentsPage'));
const LecturerClassListPage = lazy(() => import('./pages/lecturer/ClassListPage'));
const LecturerReportsPage = lazy(() => import('./pages/lecturer/LecturerReportsPage'));
const LecturerAttendanceReviewPage = lazy(() => import('./pages/lecturer/AttendanceReviewPage'));
const LecturerLeaveRequestsPage = lazy(() => import('./pages/lecturer/LeaveRequestsPage'));

// Class Rep
const ClassRepDashboard = lazy(() => import('./pages/class-rep/ClassRepDashboard'));
const AttendancePage = lazy(() => import('./pages/class-rep/AttendancePage'));
const AssignmentUploadPage = lazy(() => import('./pages/class-rep/AssignmentUploadPage'));
const PendingRequestsPage = lazy(() => import('./pages/class-rep/PendingRequestsPage'));
const ClassRepClassListPage = lazy(() => import('./pages/class-rep/ClassListPage'));
const NotifyStudentsPage = lazy(() => import('./pages/class-rep/NotifyStudentsPage'));

// Bursar
const BursarDashboard = lazy(() => import('./pages/bursar/BursarDashboard'));
const DuesPage = lazy(() => import('./pages/bursar/DuesPage'));
const PaymentVerificationPage = lazy(() => import('./pages/bursar/PaymentVerificationPage'));
const DefaultersPage = lazy(() => import('./pages/bursar/DefaultersPage'));
const PaymentHistoryPage = lazy(() => import('./pages/bursar/PaymentHistoryPage'));

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ResultApprovalPage = lazy(() => import('./pages/admin/ResultApprovalPage'));
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage'));
const UserRolesPage = lazy(() => import('./pages/admin/UserRolesPage'));
const DelegateAdminPage = lazy(() => import('./pages/admin/DelegateAdminPage'));
const AnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage'));
const SessionManagementPage = lazy(() => import('./pages/admin/SessionManagementPage'));
const CourseHubPage = lazy(() => import('./pages/admin/CourseHubPage'));
const AnnouncementsPage = lazy(() => import('./pages/admin/AnnouncementsManagePage'));
const AcademicsHubPage = lazy(() => import('./pages/admin/AcademicsHubPage'));
const AlumniManagementPage = lazy(() => import('./pages/admin/AlumniManagementPage'));
const ResultsManagementPage = lazy(() => import('./pages/admin/ResultsManagementPage'));

const CGPASettingsPage = lazy(() => import('./pages/admin/CGPASettingsPage'));
// const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const AISettingsPage = lazy(() => import('./pages/settings/AISettingsPage'));
const CRFSigningSettingsPage = lazy(() => import('./pages/admin/CRFSigningSettingsPage'));
const CourseFormSigningPage = lazy(() => import('./pages/student/CourseFormSigningPage'));
const StudentDetailPage = lazy(() => import('./pages/admin/StudentDetailPage'));
const AdminJobModerationPage = lazy(() => import('./pages/admin/AdminJobModerationPage'));
const UserDetailPage = lazy(() => import('./pages/admin/UserDetailPage'));
const EditStudentPage = lazy(() => import('./pages/admin/EditStudentPage'));
const CourseDetailPage = lazy(() => import('./pages/admin/CourseDetailPage'));
const LecturerManagementPage = lazy(() => import('./pages/admin/LecturerManagementPage'));

// AI Predictions
const GPAHubPage = lazy(() => import('./pages/student/GPAHubPage'));
const FindMentorPage = lazy(() => import('./pages/student/FindMentorPage'));
const AtRiskDashboard = lazy(() => import('./pages/admin/AtRiskDashboard'));
const RevenueForecastPage = lazy(() => import('./pages/admin/RevenueForecastPage'));
const DuesManagementPage = lazy(() => import('./pages/admin/DuesManagementPage'));

// Additional Features
const StudyPlannerPage = lazy(() => import('./pages/student/StudyPlannerPage'));
const ClassNoticeBoardPage = lazy(() => import('./pages/shared/ClassNoticeBoardPage'));
const ExpensesPage = lazy(() => import('./pages/admin/ExpensesPage'));

// New high-impact features
const AttendanceCheckinPage = lazy(() => import('./pages/student/AttendanceCheckinPage'));
const LecturerCourseMaterialsPage = lazy(() => import('./pages/lecturer/CourseMaterialsPage'));

const SupportPage = lazy(() => import('./pages/shared/SupportPage'));
const QRScanPage = lazy(() => import('./pages/student/QRScanPage'));
// const FeatureFlagsPage = lazy(() => import('./pages/admin/FeatureFlagsPage'));
// const FeedbackManagePage = lazy(() => import('./pages/admin/FeedbackManagePage'));
const SystemAdminPage = lazy(() => import('./pages/admin/SystemAdminPage'));
const PasswordResetOTPPage = lazy(() => import('./pages/auth/PasswordResetOTPPage'));

// Onboarding & Verification
const WaitingDashboardPage = lazy(() => import('./pages/shared/WaitingDashboardPage'));
const StudentCommunicationPage = lazy(() => import('./pages/student/StudentCommunicationPage'));

// Campus Connect (new)
const ConnectPage = lazy(() => import('./pages/connect/ConnectPage'));

// Alumni
const AlumniDashboard = lazy(() => import('./pages/alumni/AlumniDashboard'));
const AlumniJobsPage = lazy(() => import('./pages/alumni/AlumniJobsPage'));
const AlumniNetworkPage = lazy(() => import('./pages/alumni/AlumniNetworkPage'));
const GiveBackPage = lazy(() => import('./pages/alumni/GiveBackPage'));
const AlumniEventsPage = lazy(() => import('./pages/alumni/AlumniEventsPage'));
const AlumniProfilePage = lazy(() => import('./pages/alumni/AlumniProfilePage'));
const MentorshipRequestsPage = lazy(() => import('./pages/alumni/MentorshipRequestsPage'));
const DonationConfirmationPage = lazy(() => import('./pages/alumni/DonationConfirmationPage'));

// Shared
const NotificationsPage = lazy(() => import('./pages/shared/NotificationsPage'));
const NotificationSettingsPage = lazy(() => import('./pages/shared/NotificationSettingsPage'));
const SearchResultsPage = lazy(() => import('./pages/shared/SearchResultsPage'));
const NotFoundPage = lazy(() => import('./pages/shared/NotFoundPage'));
const ForbiddenPage = lazy(() => import('./pages/shared/ForbiddenPage'));
const ServerErrorPage = lazy(() => import('./pages/shared/ServerErrorPage'));
const ApprovalRejectedPage = lazy(() => import('./pages/shared/ApprovalRejectedPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/shared/PrivacyPolicyPage'));
const UnsubscribePage = lazy(() => import('./pages/shared/UnsubscribePage'));
// const AIBlueprintPage = lazy(() => import('./pages/shared/AIBlueprintPage'));

/* ── Layouts ─────────────────────────────────── */
const AppShell = lazy(() => import('./components/layout/AppShell'));

/* ── Loading fallback ────────────────────────── */
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-surface-50 dark:bg-surface-950">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-sm text-surface-500 dark:text-surface-400">Loading...</p>
    </div>
  </div>
);

const SuspenseWrapper = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

/* ── Route guards ────────────────────────────── */
const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const location = useLocation();

  if (!hasHydrated) return <PageLoader />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const onboardingRoutes = ['/onboarding', '/login/celebration'];
  if (user && user.onboardingCompleted === false && !onboardingRoutes.includes(location.pathname)) {
    return <Navigate to="/onboarding" replace />;
  }

  const waitingRoutes = ['/waiting', '/approval-rejected'];
  const pendingRoles = ['student', 'lecturer'];
  if (
    user &&
    user.onboardingCompleted !== false &&
    user.isApproved === false &&
    user.isActive !== false &&
    pendingRoles.includes(user.activeRole || user.role || '') &&
    !waitingRoutes.includes(location.pathname)
  ) {
    return <Navigate to="/waiting" replace />;
  }

  return (
    <SuspenseWrapper>
      <Outlet />
    </SuspenseWrapper>
  );
};

const PublicOnlyRoute = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  if (!hasHydrated) return <PageLoader />;

  if (isAuthenticated) {
    if (user && user.onboardingCompleted === false) {
      return <Navigate to="/onboarding" replace />;
    }
    const justLoggedIn = sessionStorage.getItem('just_logged_in') === 'true';
    if (justLoggedIn) {
      return <Navigate to="/login/celebration" replace />;
    }
    return <Navigate to={departmentDashboardPath(user?.tenant?.urlCode)} replace />;
  }
  return (
    <SuspenseWrapper>
      <Outlet />
    </SuspenseWrapper>
  );
};

const RoleRoute = ({ roles }: { roles: UserRole[] }) => {
  const activeRole = useAuthStore((s) => s.user?.activeRole ?? 'student');
  const urlCode = useAuthStore((s) => s.user?.tenant?.urlCode);
  if (!roles.includes(activeRole)) return <Navigate to={departmentDashboardPath(urlCode)} replace />;
  return <Outlet />;
};

// The staff pages. They are served twice: under /admin (for a department
// with no short name, and as the address people are sent from) and under the
// department's own short name (/co/admin, /ee/admin, ...).
const adminPages: { path: string; element: ReactNode }[] = [
  { path: '/admin', element: <AdminDashboard /> },
  { path: '/admin/dashboard', element: <AdminDashboard /> },
  { path: '/admin/profile', element: <AdminProfilePage /> },
  { path: '/admin/results', element: <ResultApprovalPage /> },
  { path: '/admin/results/manage', element: <ResultsManagementPage /> },
  { path: '/admin/users', element: <UserManagementPage /> },
  { path: '/admin/user-roles', element: <UserRolesPage /> },
  { path: '/admin/delegate', element: <DelegateAdminPage /> },
  { path: '/admin/analytics', element: <AnalyticsPage /> },
  { path: '/admin/sessions', element: <SessionManagementPage /> },
  { path: '/admin/course-hub', element: <CourseHubPage /> },
  { path: '/admin/announcements', element: <AnnouncementsPage /> },
  { path: '/admin/academics', element: <AcademicsHubPage /> },
  { path: '/admin/system', element: <SystemAdminPage /> },
  { path: '/admin/alumni', element: <AlumniManagementPage /> },
  { path: '/admin/cgpa-settings', element: <CGPASettingsPage /> },
  { path: '/admin/settings', element: <Navigate to="/admin/profile?tab=department" replace /> },
  { path: '/admin/ai-settings', element: <AISettingsPage /> },
  { path: '/admin/at-risk', element: <AtRiskDashboard /> },
  { path: '/admin/revenue-forecast', element: <RevenueForecastPage /> },
  { path: '/admin/duesmanagement', element: <DuesManagementPage /> },
  { path: '/admin/dues', element: <Navigate to="/admin/duesmanagement" replace /> },
  { path: '/admin/payments', element: <PaymentHistoryPage /> },
  { path: '/admin/transactions', element: <PaymentHistoryPage /> },
  { path: '/admin/expenses', element: <ExpensesPage /> },
  { path: '/admin/students/:id', element: <StudentDetailPage /> },
  { path: '/admin/users/:id', element: <UserDetailPage /> },
  { path: '/admin/users/:id/edit', element: <EditStudentPage /> },
  { path: '/admin/courses/:id', element: <CourseDetailPage /> },
  { path: '/admin/job-moderation', element: <AdminJobModerationPage /> },
  { path: '/admin/lecturers', element: <LecturerManagementPage /> },
  { path: '/admin/crf-signing', element: <CRFSigningSettingsPage /> },
];

/** Sends a plain /admin address to the signed-in person's own department address (/co/admin). */
const CanonicalAdminAddress = () => {
  const urlCode = useAuthStore((s) => s.user?.tenant?.urlCode);
  const { pathname, search } = useLocation();
  const target = departmentAdminPath(urlCode, pathname);
  if (target !== pathname) return <Navigate to={`${target}${search}`} replace />;
  return <Outlet />;
};

/**
 * Guards /:code/admin and everything under it. A signed-out visitor sees the
 * department's staff sign-in page on the admin home, and goes to /login on any
 * other admin page. A signed-in person is sent to their own department's
 * address, so another department's admin address never opens.
 */
const DepartmentAdminGate = () => {
  const { code = '' } = useParams();
  const { pathname, search } = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const urlCode = useAuthStore((s) => s.user?.tenant?.urlCode);

  if (!hasHydrated) return <PageLoader />;

  const base = `/${code}/admin`;
  const rest = pathname.slice(base.length);
  if (!isAuthenticated) {
    if (pathname.replace(/\/+$/, '') === base) {
      return (
        <SuspenseWrapper>
          <DepartmentEntry admin />
        </SuspenseWrapper>
      );
    }
    return <Navigate to="/login" replace />;
  }
  if (urlCode !== code) {
    return <Navigate to={`${departmentAdminHome(urlCode)}${rest}${search}`} replace />;
  }
  return <Outlet />;
};

// A page under /:code/admin: the same route, with the department code in front.
const toDepartmentRoute = (page: { path: string; element: ReactNode }) =>
  page.path === '/admin'
    ? { index: true, element: page.element }
    : { path: page.path.slice('/admin/'.length), element: page.element };

/**
 * Guards a role area (/:code/i, /:code/l, /:code/rep, /:code/bu). A signed-out
 * visitor goes to sign-in. A signed-in person on another department's address
 * is sent to the same page under their own short name.
 */
const RoleGate = ({ segment }: { segment: string }) => {
  const { code = '' } = useParams();
  const { pathname, search } = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const urlCode = useAuthStore((s) => s.user?.tenant?.urlCode);

  if (!hasHydrated) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!urlCode) return <Navigate to="/forbidden" replace />;
  if (urlCode !== code) {
    const rest = pathname.slice(`/${code}/${segment}`.length);
    return <Navigate to={`/${urlCode}/${segment}${rest}${search}`} replace />;
  }
  return <Outlet />;
};

/** Sends a page inside a role area to another page in the same area, e.g. /co/i/payments/history to /co/i/payments. */
const RoleRedirect = ({ segment, to }: { segment: string; to: string }) => {
  const { code = '' } = useParams();
  return <Navigate to={`/${code}/${segment}${to}`} replace />;
};

/**
 * An old address outside the role areas (/payments, /class-rep/pending,
 * /bursar/dues). It moves to the same page under the signed-in person's short
 * name and role segment, so no old address stays in the browser.
 */
const LegacyRedirect = ({ from, to }: { from: string; to: string }) => {
  const { pathname, search } = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const urlCode = useAuthStore((s) => s.user?.tenant?.urlCode);

  if (!hasHydrated) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!urlCode) return <Navigate to="/forbidden" replace />;
  const rest = pathname.slice(from.length);
  return <Navigate to={`${tenantPath(urlCode, `${to}${rest}`)}${search}`} replace />;
};

/** Old role addresses, each mapped to its new place in a role area. */
const LEGACY_ADDRESSES: Array<[string, string]> = [
  ['/i', '/i'],
  ['/l', '/l'],
  ['/rep', '/rep'],
  ['/bu', '/bu'],
  ['/lecturer', '/l'],
  ['/class-rep', '/rep'],
  ['/bursar', '/bu'],
  ['/results', '/i/results'],
  ['/payments', '/i/payments'],
  ['/course-form-signing', '/i/course-form-signing'],
  ['/courses', '/i/courses'],
  ['/attendance', '/i/attendance'],
  ['/student', '/i/student'],
  ['/study-planner', '/i/study-planner'],
  ['/gpa', '/i/gpa'],
  ['/gpa-calculator', '/i/gpa'],
  ['/gpa-prediction', '/i/gpa'],
  ['/students/gpa', '/i/gpa'],
  ['/students/communications', '/i/communication'],
  ['/find-mentor', '/i/find-mentor'],
  ['/help-center', '/i/help-center'],
  ['/materials', '/i/courses'],
  ['/complaints', '/i/complaints'],
  ['/communication', '/i/communication'],
  ['/announcements', '/i/communication'],
  ['/notices', '/i/communication'],
  ['/notice-board', '/i/notice-board'],
  ['/scan', '/i/scan'],
];

/** Each old address and everything under it. */
const legacyRoutes = () =>
  LEGACY_ADDRESSES.flatMap(([from, to]) => [
    { path: from, element: <LegacyRedirect from={from} to={to} /> },
    { path: `${from}/*`, element: <LegacyRedirect from={from} to={to} /> },
  ]);

/** Redirects to the user's role dashboard (e.g. /co/admin/dashboard, /l/dashboard, /co/i/dashboard) */
const DashboardRedirect = () => {
  const urlCode = useAuthStore((s) => s.user?.tenant?.urlCode);
  const role = useAuthStore((s) => s.user?.activeRole || s.user?.role);
  return <Navigate to={departmentDashboardPath(urlCode, role)} replace />;
};

/** Redirects /profile to the user's role profile (e.g. /co/admin/profile, /l/profile, /i/profile) */
const ProfileRedirect = () => {
  const urlCode = useAuthStore((s) => s.user?.tenant?.urlCode);
  const role = useAuthStore((s) => s.user?.activeRole || s.user?.role);
  return <Navigate to={departmentProfilePath(urlCode, role)} replace />;
};

/** The lecturer's profile. Admin, HOD and delegated admin accounts are sent to their own profile instead. */
const LecturerProfileRoute = () => {
  const urlCode = useAuthStore((s) => s.user?.tenant?.urlCode);
  const role = useAuthStore((s) => s.user?.activeRole || s.user?.role);
  if (role !== 'lecturer') return <Navigate to={departmentProfilePath(urlCode, role)} replace />;
  return <LecturerProfilePage />;
};

/* ── Router ──────────────────────────────────── */
export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      // Hidden staff portal: separate, unlinked route so student and staff
      // sign-in never share a URL. Rotatable via VITE_STAFF_PORTAL_PATH.
      { path: (import.meta.env.VITE_STAFF_PORTAL_PATH || '/portalsign') + '/login', element: <StaffPortalLoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password-otp', element: <PasswordResetOTPPage /> },
      { path: '/signup/student', element: <StudentSignupPage /> },
      {
        path: (import.meta.env.VITE_STAFF_PORTAL_PATH || '/portalsign') + '/lecturer/signup',
        element: <LecturerSignupPage />,
      },
      // A department's own sign-in addresses: /co for students, /co/admin for
      // staff. Static routes always win over these, so a code cannot shadow a
      // page (internal/tenant/urlcode.go reserves every page's first segment).
      {
        path: '/:code',
        element: (
          <SuspenseWrapper>
            <DepartmentEntry admin={false} />
          </SuspenseWrapper>
        ),
      },
    ],
  },
  // A department's own admin area: /co/admin, /ee/admin, and so on.
  {
    path: '/:code/admin',
    element: <DepartmentAdminGate />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                element: <RoleRoute roles={['hod', 'delegated_admin', 'admin']} />,
                children: adminPages.map(toDepartmentRoute),
              },
            ],
          },
        ],
      },
    ],
  },
  // ── Role areas. Each role's pages live under the department's short name and
  // the role's segment: /co/i (students), /co/l (lecturers), /co/rep (class
  // reps), /co/bu (bursars). Admin is /co/admin, above.
  {
    path: '/:code/i',
    element: <RoleGate segment="i" />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                element: (
                  <RoleRoute
                    roles={[
                      'student',
                      'class_rep',
                      'dept_bursar',
                      'class_bursar',
                      'alumni',
                      'project_coordinator',
                      'event_coordinator',
                      'alumni_rep',
                    ]}
                  />
                ),
                children: [
                  { index: true, element: <RoleRedirect segment="i" to="/dashboard" /> },
                  { path: 'dashboard', element: <Dashboard /> },
                  { path: 'profile', element: <StudentProfilePage /> },
                  { path: 'results', element: <ResultsPage /> },
                  { path: 'results/:id', element: <ResultDetailPage /> },
                  { path: 'payments', element: <PaymentsPage /> },
                  { path: 'payments/history', element: <RoleRedirect segment="i" to="/payments" /> },
                  { path: 'payments/confirmation', element: <PaymentConfirmationPage /> },
                  { path: 'course-form-signing', element: <CourseFormSigningPage /> },
                  { path: 'courses', element: <CoursesPage /> },
                  { path: 'courses/register', element: <RoleRedirect segment="i" to="/courses?tab=register" /> },
                  { path: 'materials', element: <RoleRedirect segment="i" to="/courses?tab=materials" /> },
                  { path: 'attendance', element: <StudentAttendancePage /> },
                  { path: 'attendance/checkin', element: <AttendanceCheckinPage /> },
                  { path: 'student/jobs', element: <StudentJobBoardPage /> },
                  { path: 'student/applications', element: <MyApplicationsPage /> },
                  { path: 'study-planner', element: <StudyPlannerPage /> },
                  { path: 'gpa', element: <GPAHubPage /> },
                  { path: 'gpa-calculator', element: <RoleRedirect segment="i" to="/gpa" /> },
                  { path: 'gpa-prediction', element: <RoleRedirect segment="i" to="/gpa" /> },
                  { path: 'students/gpa', element: <RoleRedirect segment="i" to="/gpa" /> },
                  { path: 'find-mentor', element: <FindMentorPage /> },
                  { path: 'support', element: <SupportPage /> },
                  { path: 'help-center', element: <SupportPage /> },
                  { path: 'complaints', element: <ComplaintsPage /> },
                  { path: 'communication', element: <StudentCommunicationPage /> },
                  { path: 'students/communications', element: <RoleRedirect segment="i" to="/communication" /> },
                  { path: 'announcements', element: <RoleRedirect segment="i" to="/communication" /> },
                  { path: 'notices', element: <RoleRedirect segment="i" to="/communication" /> },
                  { path: 'notice-board', element: <ClassNoticeBoardPage /> },
                  { path: 'scan', element: <QRScanPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '/:code/l',
    element: <RoleGate segment="l" />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                element: <RoleRoute roles={['lecturer', 'hod', 'delegated_admin']} />,
                children: [
                  { index: true, element: <RoleRedirect segment="l" to="/dashboard" /> },
                  { path: 'dashboard', element: <LecturerDashboard /> },
                  { path: 'profile', element: <LecturerProfileRoute /> },
                  { path: 'scores', element: <LecturerGradesPage /> },
                  { path: 'single-entry', element: <LecturerGradesPage /> },
                  { path: 'bulk-upload', element: <LecturerGradesPage /> },
                  { path: 'assignments', element: <AssignmentsPage /> },
                  { path: 'class-list', element: <LecturerClassListPage /> },
                  { path: 'reports', element: <LecturerReportsPage /> },
                  { path: 'attendance-review', element: <LecturerAttendanceReviewPage /> },
                  { path: 'materials', element: <LecturerCourseMaterialsPage /> },
                  { path: 'leave', element: <LecturerLeaveRequestsPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '/:code/rep',
    element: <RoleGate segment="rep" />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                element: <RoleRoute roles={['class_rep', 'hod', 'delegated_admin']} />,
                children: [
                  { index: true, element: <RoleRedirect segment="rep" to="/dashboard" /> },
                  { path: 'dashboard', element: <ClassRepDashboard /> },
                  { path: 'attendance', element: <AttendancePage /> },
                  { path: 'assignments', element: <AssignmentUploadPage /> },
                  { path: 'pending', element: <PendingRequestsPage /> },
                  { path: 'class-list', element: <ClassRepClassListPage /> },
                  { path: 'notify', element: <NotifyStudentsPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '/:code/bu',
    element: <RoleGate segment="bu" />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                element: <RoleRoute roles={['class_bursar', 'dept_bursar', 'hod', 'delegated_admin']} />,
                children: [
                  { index: true, element: <RoleRedirect segment="bu" to="/dashboard" /> },
                  { path: 'dashboard', element: <BursarDashboard /> },
                  { path: 'dues', element: <DuesPage /> },
                  { path: 'verify', element: <PaymentVerificationPage /> },
                  { path: 'defaulters', element: <DefaultersPage /> },
                  { path: 'history', element: <PaymentHistoryPage /> },
                  { path: 'revenue-forecast', element: <RoleRedirect segment="bu" to="/verify" /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/login/celebration',
        element: (
          <SuspenseWrapper>
            <LoginCelebrationPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: '/onboarding',
        element: (
          <SuspenseWrapper>
            <StudentOnboardingPage />
          </SuspenseWrapper>
        ),
      },
      {
        element: <AppShell />,
        children: [
          { path: '/dashboard', element: <DashboardRedirect /> },
          { path: '/:code/dashboard', element: <DashboardRedirect /> },
          { path: '/profile', element: <ProfileRedirect /> },
          { path: '/waiting', element: <WaitingDashboardPage /> },
          // Help is reachable from the sign-in page, so it is not limited to a role.
          { path: '/support', element: <SupportPage /> },
          // Old role addresses: each one moves to the signed-in person's own
          // department and role area.
          ...legacyRoutes(),

          // Admin routes
          {
            element: <CanonicalAdminAddress />,
            children: [
              {
                element: <RoleRoute roles={['hod', 'delegated_admin', 'admin']} />,
                children: adminPages,
              },
            ],
          },

          // Campus Connect (new)
          {
            path: '/connect',
            element: (
              <SuspenseWrapper>
                <ConnectPage />
              </SuspenseWrapper>
            ),
          },

          // Alumni
          {
            element: <RoleRoute roles={['alumni', 'hod', 'delegated_admin']} />,
            children: [
              { path: '/alumni', element: <AlumniDashboard /> },
              { path: '/alumni/profile', element: <AlumniProfilePage /> },
              { path: '/alumni/jobs', element: <AlumniJobsPage /> },
              { path: '/alumni/mentorship', element: <MentorshipRequestsPage /> },
              { path: '/alumni/my-jobs', element: <Navigate to="/alumni/jobs" replace /> },
              { path: '/alumni/network', element: <AlumniNetworkPage /> },
              { path: '/alumni/give-back', element: <GiveBackPage /> },
              { path: '/alumni/give-back/confirmation', element: <DonationConfirmationPage /> },
              { path: '/alumni/events', element: <AlumniEventsPage /> },
            ],
          },

          // Shared
          {
            path: '/notifications',
            element: (
              <SuspenseWrapper>
                <NotificationsPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: '/notifications/settings',
            element: (
              <SuspenseWrapper>
                <NotificationSettingsPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: '/search',
            element: (
              <SuspenseWrapper>
                <SearchResultsPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: '/forbidden',
            element: (
              <SuspenseWrapper>
                <ForbiddenPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: '/error',
            element: (
              <SuspenseWrapper>
                <ServerErrorPage />
              </SuspenseWrapper>
            ),
          },
        ],
      },
      {
        path: '/approval-rejected',
        element: (
          <SuspenseWrapper>
            <ApprovalRejectedPage />
          </SuspenseWrapper>
        ),
      },
    ],
  },
  {
    path: '/privacy-policy',
    element: (
      <SuspenseWrapper>
        <PrivacyPolicyPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/notifications/unsubscribe/:token',
    element: (
      <SuspenseWrapper>
        <UnsubscribePage />
      </SuspenseWrapper>
    ),
  },
  // { path: '/ai-blueprint', element: <SuspenseWrapper><AIBlueprintPage /></SuspenseWrapper> },
  { path: '/', element: <DashboardRedirect /> },
  {
    path: '*',
    element: (
      <SuspenseWrapper>
        <NotFoundPage />
      </SuspenseWrapper>
    ),
  },
]);
