import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import type { UserRole } from './types';

/* ── Lazy-loaded pages ───────────────────────── */
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const LoginCelebrationPage = lazy(() => import('./pages/auth/LoginCelebrationPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const StudentSignupPage = lazy(() => import('./pages/auth/StudentSignupPage'));
const LecturerSignupPage = lazy(() => import('./pages/auth/LecturerSignupPage'));
const StudentOnboardingPage = lazy(() => import('./pages/onboarding/StudentOnboardingPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Student
const ResultsPage = lazy(() => import('./pages/student/ResultsPage'));
const ResultDetailPage = lazy(() => import('./pages/student/ResultDetailPage'));
const PaymentsPage = lazy(() => import('./pages/student/PaymentsPage'));
const TranscriptsPage = lazy(() => import('./pages/student/TranscriptsPage'));
const CourseRegistrationPage = lazy(() => import('./pages/student/CourseRegistrationPage'));
const ComplaintsPage = lazy(() => import('./pages/student/ComplaintsPage'));
const TimetablePage = lazy(() => import('./pages/student/TimetablePage'));
const ProfilePage = lazy(() => import('./pages/student/ProfilePage'));
const ManualsPage = lazy(() => import('./pages/student/ManualsPage'));
const MyManualsPage = lazy(() => import('./pages/student/MyManualsPage'));
const PracticalDetailsPage = lazy(() => import('./pages/student/PracticalDetailsPage'));
const StudentJobBoardPage = lazy(() => import('./pages/student/StudentJobBoardPage'));
const MyApplicationsPage = lazy(() => import('./pages/student/MyApplicationsPage'));

// Lecturer
const LecturerDashboard = lazy(() => import('./pages/lecturer/LecturerDashboard'));
const ScoreEntryPage = lazy(() => import('./pages/lecturer/ScoreEntryPage'));
const BulkUploadPage = lazy(() => import('./pages/lecturer/BulkUploadPage'));
const AssignmentsPage = lazy(() => import('./pages/lecturer/AssignmentsPage'));
const LecturerClassListPage = lazy(() => import('./pages/lecturer/ClassListPage'));
const LecturerReportsPage = lazy(() => import('./pages/lecturer/LecturerReportsPage'));

// Class Rep
const ClassRepDashboard = lazy(() => import('./pages/class-rep/ClassRepDashboard'));
const AttendancePage = lazy(() => import('./pages/class-rep/AttendancePage'));
const AssignmentUploadPage = lazy(() => import('./pages/class-rep/AssignmentUploadPage'));
const PendingRequestsPage = lazy(() => import('./pages/class-rep/PendingRequestsPage'));
const ClassRepClassListPage = lazy(() => import('./pages/class-rep/ClassListPage'));

// Bursar
const BursarDashboard = lazy(() => import('./pages/bursar/BursarDashboard'));
const ClassBursarDuesPage = lazy(() => import('./pages/bursar/ClassBursarDuesPage'));
const DeptBursarDuesPage = lazy(() => import('./pages/bursar/DeptBursarDuesPage'));
const PaymentVerificationPage = lazy(() => import('./pages/bursar/PaymentVerificationPage'));
const DefaultersPage = lazy(() => import('./pages/bursar/DefaultersPage'));

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ResultApprovalPage = lazy(() => import('./pages/admin/ResultApprovalPage'));
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage'));
const PendingApprovalsPage = lazy(() => import('./pages/admin/PendingApprovalsPage'));
const RoleManagementPage = lazy(() => import('./pages/admin/RoleManagementPage'));
const DelegateAdminPage = lazy(() => import('./pages/admin/DelegateAdminPage'));
const DelegateStudentRolePage = lazy(() => import('./pages/admin/DelegateStudentRolePage'));
const AnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage'));
const SessionManagementPage = lazy(() => import('./pages/admin/SessionManagementPage'));
const CourseManagementPage = lazy(() => import('./pages/admin/CourseManagementPage'));
const CourseSubcategoryPage = lazy(() => import('./pages/admin/CourseSubcategoryPage'));
const AnnouncementsPage = lazy(() => import('./pages/admin/AnnouncementsPage'));
const TranscriptQueuePage = lazy(() => import('./pages/admin/TranscriptQueuePage'));
const GraduationCheckPage = lazy(() => import('./pages/admin/GraduationCheckPage'));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'));
const BackupPage = lazy(() => import('./pages/admin/BackupPage'));
const ComplaintsManagePage = lazy(() => import('./pages/admin/ComplaintsManagePage'));
const TimetableManagePage = lazy(() => import('./pages/admin/TimetableManagePage'));
const ManualsManagementPage = lazy(() => import('./pages/admin/ManualsManagementPage'));
const ManualPrintQueuePage = lazy(() => import('./pages/admin/ManualPrintQueuePage'));
const AlumniManagementPage = lazy(() => import('./pages/admin/AlumniManagementPage'));
const BulkResultsUploadPage = lazy(() => import('./pages/admin/BulkResultsUploadPage'));
const CGPASettingsPage = lazy(() => import('./pages/admin/CGPASettingsPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const StudentDetailPage = lazy(() => import('./pages/admin/StudentDetailPage'));
const ManualDetailPage = lazy(() => import('./pages/admin/ManualDetailPage'));
const AdminJobModerationPage = lazy(() => import('./pages/admin/AdminJobModerationPage'));
const UserDetailPage = lazy(() => import('./pages/admin/UserDetailPage'));
const EditStudentPage = lazy(() => import('./pages/admin/EditStudentPage'));
const DocumentVerificationPage = lazy(() => import('./pages/admin/DocumentVerificationPage'));
const CourseDetailPage = lazy(() => import('./pages/admin/CourseDetailPage'));
const LecturerManagementPage = lazy(() => import('./pages/admin/LecturerManagementPage'));

// Campus Connect
const CampusConnectPage = lazy(() => import('./pages/campus-connect/CampusConnectPage'));
const StudentDirectoryPage = lazy(() => import('./pages/campus-connect/StudentDirectoryPage'));
const AlumniDirectoryPage = lazy(() => import('./pages/campus-connect/AlumniDirectoryPage'));
const MyConnectionsPage = lazy(() => import('./pages/campus-connect/MyConnectionsPage'));
const MessagesPage = lazy(() => import('./pages/campus-connect/MessagesPage'));
const GroupDiscoveryPage = lazy(() => import('./pages/campus-connect/GroupDiscoveryPage'));
const MyGroupsPage = lazy(() => import('./pages/campus-connect/MyGroupsPage'));
const GroupDetailPage = lazy(() => import('./pages/campus-connect/GroupDetailPage'));
const ConnectionProfilePage = lazy(() => import('./pages/campus-connect/ConnectionProfilePage'));

// Skills & Trade
const SkillsMarketplacePage = lazy(() => import('./pages/skills-trade/SkillsMarketplacePage'));
const MySkillsPage = lazy(() => import('./pages/skills-trade/MySkillsPage'));
const CreateSkillListingPage = lazy(() => import('./pages/skills-trade/CreateSkillListingPage'));
const TradeOffersPage = lazy(() => import('./pages/skills-trade/TradeOffersPage'));
const MyTradesPage = lazy(() => import('./pages/skills-trade/MyTradesPage'));
const CreateTradeOfferPage = lazy(() => import('./pages/skills-trade/CreateTradeOfferPage'));
const SkillDetailPage = lazy(() => import('./pages/skills-trade/SkillDetailPage'));
const RatingsPage = lazy(() => import('./pages/skills-trade/RatingsPage'));

// Alumni
const AlumniDashboard = lazy(() => import('./pages/alumni/AlumniDashboard'));
const MentorshipHubPage = lazy(() => import('./pages/alumni/MentorshipHubPage'));
const AlumniJobsPage = lazy(() => import('./pages/alumni/AlumniJobsPage'));
const MyJobPostsPage = lazy(() => import('./pages/alumni/MyJobPostsPage'));
const AlumniNetworkPage = lazy(() => import('./pages/alumni/AlumniNetworkPage'));
const GiveBackPage = lazy(() => import('./pages/alumni/GiveBackPage'));
const AlumniEventsPage = lazy(() => import('./pages/alumni/AlumniEventsPage'));
const AlumniProfilePage = lazy(() => import('./pages/alumni/AlumniProfilePage'));

// Shared
const NotificationsPage = lazy(() => import('./pages/shared/NotificationsPage'));
const SearchResultsPage = lazy(() => import('./pages/shared/SearchResultsPage'));
const NotFoundPage = lazy(() => import('./pages/shared/NotFoundPage'));
const ForbiddenPage = lazy(() => import('./pages/shared/ForbiddenPage'));
const ServerErrorPage = lazy(() => import('./pages/shared/ServerErrorPage'));
const ApprovalRejectedPage = lazy(() => import('./pages/shared/ApprovalRejectedPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/shared/PrivacyPolicyPage'));

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

  return <SuspenseWrapper><Outlet /></SuspenseWrapper>;
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
  return <SuspenseWrapper><Outlet /></SuspenseWrapper>;
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
          { path: '/signup/student', element: <StudentSignupPage /> },
          { path: '/signup/lecturer', element: <LecturerSignupPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/login/celebration', element: <SuspenseWrapper><LoginCelebrationPage /></SuspenseWrapper> },
      { path: '/onboarding', element: <SuspenseWrapper><StudentOnboardingPage /></SuspenseWrapper> },
      {
        element: <AppShell />,
        children: [
          { path: '/dashboard', element: <Dashboard /> },

          // Student routes
          { path: '/results', element: <ResultsPage /> },
          { path: '/results/:id', element: <ResultDetailPage /> },
          { path: '/payments', element: <PaymentsPage /> },
          { path: '/transcripts', element: <TranscriptsPage /> },
          { path: '/courses/register', element: <CourseRegistrationPage /> },
          { path: '/complaints', element: <ComplaintsPage /> },
          { path: '/timetable', element: <TimetablePage /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/manuals', element: <ManualsPage /> },
          { path: '/manuals/my', element: <MyManualsPage /> },
          { path: '/practicals', element: <PracticalDetailsPage /> },
          { path: '/student/jobs', element: <StudentJobBoardPage /> },
          { path: '/student/applications', element: <MyApplicationsPage /> },

          // Lecturer routes
          {
            element: <RoleRoute roles={['lecturer', 'hod', 'delegated_admin']} />,
            children: [
              { path: '/lecturer', element: <LecturerDashboard /> },
              { path: '/lecturer/scores', element: <ScoreEntryPage /> },
              { path: '/lecturer/bulk-upload', element: <BulkUploadPage /> },
              { path: '/lecturer/assignments', element: <AssignmentsPage /> },
              { path: '/lecturer/class-list', element: <LecturerClassListPage /> },
              { path: '/lecturer/reports', element: <LecturerReportsPage /> },
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
            ],
          },

          // Bursar routes
          {
            element: <RoleRoute roles={['class_bursar', 'dept_bursar', 'hod', 'delegated_admin']} />,
            children: [
              { path: '/bursar', element: <BursarDashboard /> },
              { path: '/bursar/class-dues', element: <ClassBursarDuesPage /> },
              { path: '/bursar/dept-dues', element: <DeptBursarDuesPage /> },
              { path: '/bursar/verify', element: <PaymentVerificationPage /> },
              { path: '/bursar/defaulters', element: <DefaultersPage /> },
            ],
          },

          // Admin routes
          {
            element: <RoleRoute roles={['hod', 'delegated_admin', 'admin']} />,
            children: [
              { path: '/admin', element: <AdminDashboard /> },
              { path: '/admin/results', element: <ResultApprovalPage /> },
              { path: '/admin/results/bulk-upload', element: <BulkResultsUploadPage /> },
              { path: '/admin/users', element: <UserManagementPage /> },
              { path: '/admin/approvals', element: <PendingApprovalsPage /> },
              { path: '/admin/roles', element: <RoleManagementPage /> },
              { path: '/admin/delegate', element: <DelegateAdminPage /> },
              { path: '/admin/delegate-student-roles', element: <DelegateStudentRolePage /> },
              { path: '/admin/analytics', element: <AnalyticsPage /> },
              { path: '/admin/sessions', element: <SessionManagementPage /> },
              { path: '/admin/courses', element: <CourseManagementPage /> },
              { path: '/admin/subcategories', element: <CourseSubcategoryPage /> },
              { path: '/admin/announcements', element: <AnnouncementsPage /> },
              { path: '/admin/transcripts', element: <TranscriptQueuePage /> },
              { path: '/admin/graduation', element: <GraduationCheckPage /> },
              { path: '/admin/reports', element: <ReportsPage /> },
              { path: '/admin/backups', element: <BackupPage /> },
              { path: '/admin/complaints', element: <ComplaintsManagePage /> },
              { path: '/admin/timetable', element: <TimetableManagePage /> },
              { path: '/admin/manuals', element: <ManualsManagementPage /> },
              { path: '/admin/print-queue', element: <ManualPrintQueuePage /> },
              { path: '/admin/alumni', element: <AlumniManagementPage /> },
              { path: '/admin/cgpa-settings', element: <CGPASettingsPage /> },
              { path: '/admin/settings', element: <SettingsPage /> },
              { path: '/admin/students/:id', element: <StudentDetailPage /> },
              { path: '/admin/users/:id', element: <UserDetailPage /> },
              { path: '/admin/users/:id/edit', element: <EditStudentPage /> },
              { path: '/admin/documents', element: <DocumentVerificationPage /> },
              { path: '/admin/courses/:id', element: <CourseDetailPage /> },
              { path: '/admin/manuals/:id', element: <ManualDetailPage /> },
              { path: '/admin/job-moderation', element: <AdminJobModerationPage /> },
              { path: '/admin/lecturers', element: <LecturerManagementPage /> },
            ],
          },

          // Campus Connect
          { path: '/connect', element: <CampusConnectPage /> },
          { path: '/connect/students', element: <StudentDirectoryPage /> },
          { path: '/connect/alumni', element: <AlumniDirectoryPage /> },
          { path: '/connect/my-connections', element: <MyConnectionsPage /> },
          { path: '/connect/messages', element: <MessagesPage /> },
          { path: '/connect/groups', element: <GroupDiscoveryPage /> },
          { path: '/connect/my-groups', element: <MyGroupsPage /> },
          { path: '/connect/groups/:id', element: <GroupDetailPage /> },
          { path: '/connect/profile/:id', element: <ConnectionProfilePage /> },

          // Skills & Trade
          { path: '/skills', element: <SkillsMarketplacePage /> },
          { path: '/skills/my-skills', element: <MySkillsPage /> },
          { path: '/skills/create', element: <CreateSkillListingPage /> },
          { path: '/skills/:id', element: <SkillDetailPage /> },
          { path: '/trades', element: <TradeOffersPage /> },
          { path: '/trades/my-trades', element: <MyTradesPage /> },
          { path: '/trades/create', element: <CreateTradeOfferPage /> },
          { path: '/ratings', element: <RatingsPage /> },

          // Alumni
          {
            element: <RoleRoute roles={['alumni', 'hod', 'delegated_admin']} />,
            children: [
              { path: '/alumni', element: <AlumniDashboard /> },
              { path: '/alumni/profile', element: <AlumniProfilePage /> },
              { path: '/alumni/mentorship', element: <MentorshipHubPage /> },
              { path: '/alumni/jobs', element: <AlumniJobsPage /> },
              { path: '/alumni/my-jobs', element: <MyJobPostsPage /> },
              { path: '/alumni/network', element: <AlumniNetworkPage /> },
              { path: '/alumni/give-back', element: <GiveBackPage /> },
              { path: '/alumni/events', element: <AlumniEventsPage /> },
            ],
          },

          // Shared
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/search', element: <SearchResultsPage /> },
          { path: '/forbidden', element: <SuspenseWrapper><ForbiddenPage /></SuspenseWrapper> },
          { path: '/error', element: <SuspenseWrapper><ServerErrorPage /></SuspenseWrapper> },
        ],
      },
      { path: '/approval-rejected', element: <SuspenseWrapper><ApprovalRejectedPage /></SuspenseWrapper> },
    ],
  },
  { path: '/privacy-policy', element: <SuspenseWrapper><PrivacyPolicyPage /></SuspenseWrapper> },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '*', element: <SuspenseWrapper><NotFoundPage /></SuspenseWrapper> },
]);
