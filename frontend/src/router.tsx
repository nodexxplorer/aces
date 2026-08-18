import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import type { UserRole } from './types';

/* ── Lazy-loaded pages ───────────────────────── */
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
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
const TranscriptsPage = lazy(() => import('./pages/student/TranscriptsPage'));
const CoursesPage = lazy(() => import('./pages/student/CoursesPage'));
const ComplaintsPage = lazy(() => import('./pages/student/ComplaintsPage'));
const TimetablePage = lazy(() => import('./pages/student/TimetablePage'));
const ProfilePage = lazy(() => import('./pages/student/ProfilePage'));
const ManualsPage = lazy(() => import('./pages/student/ManualsPage'));
const PracticalDetailsPage = lazy(() => import('./pages/student/PracticalDetailsPage'));
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
const TimetableManagePage = lazy(() => import('./pages/admin/TimetableManagePage'));
const ManualsManagementPage = lazy(() => import('./pages/admin/ManualsManagementPage'));
const ManualCoverBulkDownloadPage = lazy(() => import('./pages/admin/ManualCoverBulkDownloadPage'));
const AlumniManagementPage = lazy(() => import('./pages/admin/AlumniManagementPage'));
const ResultsManagementPage = lazy(() => import('./pages/admin/ResultsManagementPage'));

const CGPASettingsPage = lazy(() => import('./pages/admin/CGPASettingsPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const AISettingsPage = lazy(() => import('./pages/settings/AISettingsPage'));
const CRFSigningSettingsPage = lazy(() => import('./pages/admin/CRFSigningSettingsPage'));
const CourseFormSigningPage = lazy(() => import('./pages/student/CourseFormSigningPage'));
const StudentDetailPage = lazy(() => import('./pages/admin/StudentDetailPage'));
const ManualDetailPage = lazy(() => import('./pages/admin/ManualDetailPage'));
const AdminJobModerationPage = lazy(() => import('./pages/admin/AdminJobModerationPage'));
const UserDetailPage = lazy(() => import('./pages/admin/UserDetailPage'));
const EditStudentPage = lazy(() => import('./pages/admin/EditStudentPage'));
const DocumentVerificationPage = lazy(() => import('./pages/admin/DocumentVerificationPage'));
const CourseDetailPage = lazy(() => import('./pages/admin/CourseDetailPage'));
const LecturerManagementPage = lazy(() => import('./pages/admin/LecturerManagementPage'));

// AI Predictions
const GPAHubPage = lazy(() => import('./pages/student/GPAHubPage'));
const FindMentorPage = lazy(() => import('./pages/student/FindMentorPage'));
const AtRiskDashboard = lazy(() => import('./pages/admin/AtRiskDashboard'));
const GradeDistributionPage = lazy(() => import('./pages/admin/GradeDistributionPage'));
const RevenueForecastPage = lazy(() => import('./pages/admin/RevenueForecastPage'));

// Additional Features
const StudyPlannerPage = lazy(() => import('./pages/student/StudyPlannerPage'));
const GradeAppealsPage = lazy(() => import('./pages/student/GradeAppealsPage'));
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
const PublicLayout = lazy(() => import('./components/layout/PublicLayout'));

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
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <SuspenseWrapper>
      <Outlet />
    </SuspenseWrapper>
  );
};

const RoleRoute = ({ roles }: { roles: UserRole[] }) => {
  const activeRole = useAuthStore((s) => s.user?.activeRole ?? 'student');
  if (!roles.includes(activeRole)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

/* ── Router ──────────────────────────────────── */
export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/reset-password-otp', element: <PasswordResetOTPPage /> },
          { path: '/signup/student', element: <StudentSignupPage /> },
          { path: '/signup/lecturer', element: <LecturerSignupPage /> },
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
          { path: '/dashboard', element: <Dashboard /> },

          // Student-only routes (lecturers cannot access). Includes the
          // delegated student roles (project_coordinator/event_coordinator/
          // alumni_rep) — they're students with an extra duty layered on,
          // routed to the student dashboard/nav, so they need the same base
          // page access a student gets or the Sidebar links Dashboard.tsx
          // shows them would all dead-end back here.
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
              { path: '/results', element: <ResultsPage /> },
              { path: '/results/:id', element: <ResultDetailPage /> },
              { path: '/gpa-prediction', element: <Navigate to="/gpa" replace /> },
              { path: '/payments', element: <PaymentsPage /> },
              { path: '/payments/history', element: <Navigate to="/payments" replace /> },
              { path: '/course-form-signing', element: <CourseFormSigningPage /> },
              { path: '/payments/confirmation', element: <PaymentConfirmationPage /> },
              { path: '/transcripts', element: <TranscriptsPage /> },
              { path: '/courses', element: <CoursesPage /> },
              { path: '/courses/register', element: <Navigate to="/courses?tab=register" replace /> },
              { path: '/timetable', element: <TimetablePage /> },
              { path: '/attendance', element: <StudentAttendancePage /> },
              { path: '/manuals', element: <ManualsPage /> },
              { path: '/manuals/my', element: <Navigate to="/manuals?tab=my" replace /> },
              { path: '/practicals', element: <PracticalDetailsPage /> },
              { path: '/student/jobs', element: <StudentJobBoardPage /> },
              { path: '/student/applications', element: <MyApplicationsPage /> },
              { path: '/study-planner', element: <StudyPlannerPage /> },
              { path: '/gpa-calculator', element: <Navigate to="/gpa" replace /> },
              { path: '/gpa', element: <GPAHubPage /> },
              { path: '/find-mentor', element: <FindMentorPage /> },
              { path: '/grade-appeals', element: <GradeAppealsPage /> },
              { path: '/support', element: <SupportPage /> },
              { path: '/help-center', element: <SupportPage /> },
              { path: '/carryovers', element: <Navigate to="/courses?tab=carryovers" replace /> },
              { path: '/materials', element: <Navigate to="/courses?tab=materials" replace /> },
              { path: '/attendance/checkin', element: <AttendanceCheckinPage /> },
            ],
          },
          // Shared routes (all roles)
          { path: '/complaints', element: <ComplaintsPage /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/notices', element: <Navigate to="/communication" replace /> },
          { path: '/scan', element: <QRScanPage /> },
          { path: '/calendar', element: <Navigate to="/communication?tab=calendar" replace /> },
          { path: '/notice-board', element: <ClassNoticeBoardPage /> },

          { path: '/waiting', element: <WaitingDashboardPage /> },
          { path: '/announcements', element: <Navigate to="/communication" replace /> },
          { path: '/communication', element: <StudentCommunicationPage /> },
          { path: '/students/communications', element: <Navigate to="/communication" replace /> },
          { path: '/students/gpa', element: <Navigate to="/gpa" replace /> },

          // Lecturer routes
          {
            element: <RoleRoute roles={['lecturer', 'hod', 'delegated_admin']} />,
            children: [
              { path: '/lecturer', element: <LecturerDashboard /> },
              { path: '/lecturer/scores', element: <LecturerGradesPage /> },
              { path: '/lecturer/single-entry', element: <LecturerGradesPage /> },
              { path: '/lecturer/bulk-upload', element: <LecturerGradesPage /> },
              { path: '/lecturer/assignments', element: <AssignmentsPage /> },
              { path: '/lecturer/class-list', element: <LecturerClassListPage /> },
              { path: '/lecturer/reports', element: <LecturerReportsPage /> },
              { path: '/lecturer/attendance-review', element: <LecturerAttendanceReviewPage /> },
              { path: '/lecturer/materials', element: <LecturerCourseMaterialsPage /> },
              { path: '/lecturer/leave', element: <LecturerLeaveRequestsPage /> },
            ],
          },

          // Class Rep routes
          {
            element: <RoleRoute roles={['class_rep', 'hod', 'delegated_admin']} />,
            children: [
              { path: '/class-rep', element: <ClassRepDashboard /> },
              { path: '/class-rep/attendance', element: <AttendancePage /> },
              { path: '/class-rep/assignments', element: <AssignmentUploadPage /> },
              { path: '/class-rep/pending', element: <PendingRequestsPage /> },
              { path: '/class-rep/class-list', element: <ClassRepClassListPage /> },
              { path: '/class-rep/notify', element: <NotifyStudentsPage /> },
            ],
          },

          // Bursar routes
          {
            element: <RoleRoute roles={['class_bursar', 'dept_bursar', 'hod', 'delegated_admin']} />,
            children: [
              { path: '/bursar', element: <BursarDashboard /> },
              { path: '/bursar/dues', element: <DuesPage /> },
              { path: '/bursar/verify', element: <PaymentVerificationPage /> },
              { path: '/bursar/defaulters', element: <DefaultersPage /> },
              { path: '/bursar/history', element: <PaymentHistoryPage /> },
            ],
          },

          // Admin routes
          {
            element: <RoleRoute roles={['hod', 'delegated_admin', 'admin']} />,
            children: [
              { path: '/admin', element: <AdminDashboard /> },
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
              { path: '/admin/timetable', element: <TimetableManagePage /> },
              { path: '/admin/manuals', element: <ManualsManagementPage /> },
              { path: '/admin/manuals/covers/bulk', element: <ManualCoverBulkDownloadPage /> },
              { path: '/admin/alumni', element: <AlumniManagementPage /> },
              { path: '/admin/cgpa-settings', element: <CGPASettingsPage /> },
              { path: '/admin/settings', element: <SettingsPage /> },
              { path: '/admin/ai-settings', element: <AISettingsPage /> },
              { path: '/admin/at-risk', element: <AtRiskDashboard /> },
              { path: '/admin/grade-distribution', element: <GradeDistributionPage /> },
              { path: '/admin/revenue-forecast', element: <RevenueForecastPage /> },
              { path: '/admin/expenses', element: <ExpensesPage /> },
              { path: '/admin/students/:id', element: <StudentDetailPage /> },
              { path: '/admin/users/:id', element: <UserDetailPage /> },
              { path: '/admin/users/:id/edit', element: <EditStudentPage /> },
              { path: '/admin/documents', element: <DocumentVerificationPage /> },
              { path: '/admin/courses/:id', element: <CourseDetailPage /> },
              { path: '/admin/manuals/:id', element: <ManualDetailPage /> },
              { path: '/admin/job-moderation', element: <AdminJobModerationPage /> },
              { path: '/admin/lecturers', element: <LecturerManagementPage /> },
              { path: '/admin/crf-signing', element: <CRFSigningSettingsPage /> },
            ],
          },

          // Campus Connect (new)
          { path: '/connect', element: <ConnectPage /> },

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
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/notifications/settings', element: <NotificationSettingsPage /> },
          { path: '/search', element: <SearchResultsPage /> },
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
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  {
    path: '*',
    element: (
      <SuspenseWrapper>
        <NotFoundPage />
      </SuspenseWrapper>
    ),
  },
]);
