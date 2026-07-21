import { useEffect } from 'react';
import { useRBAC } from '../hooks/useRBAC';
import { useAuth } from '../hooks/useAuth';
import StudentDashboardView from './student/StudentDashboard';
import LecturerDashboardView from './lecturer/LecturerDashboard';
import ClassRepDashboardView from './class-rep/ClassRepDashboard';
import BursarDashboardView from './bursar/BursarDashboard';
import AdminDashboardView from './admin/AdminDashboard';
import AlumniDashboardView from './alumni/AlumniDashboard';
import Alert from '../components/feedback/Alert';

const Dashboard = () => {
  const { activeRole } = useRBAC();
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    refreshUser();
  }, []);

  const isPendingApproval = user?.approvalStatus === 'pending';
  const isRejected = user?.approvalStatus === 'rejected';

  return (
    <div className="space-y-6">
      {isPendingApproval && (
        <Alert type="warning" title="Account Pending Approval">
          Your account is currently waiting for validation by department administrators.
          Some academic features, such as entering scores or viewing official transcripts, will remain locked until approved.
        </Alert>
      )}

      {isRejected && (
        <Alert type="error" title="Account Rejected">
          Your account validation request was declined. Please verify your profile info or contact your class representative.
        </Alert>
      )}

      {/* Render the appropriate dashboard based on active role */}
      {activeRole === 'student' && <StudentDashboardView />}
      {activeRole === 'lecturer' && <LecturerDashboardView />}
      {activeRole === 'class_rep' && <ClassRepDashboardView />}
      {(activeRole === 'class_bursar' || activeRole === 'dept_bursar') && <BursarDashboardView />}
      {(activeRole === 'hod' || activeRole === 'delegated_admin') && <AdminDashboardView />}
      {activeRole === 'alumni' && <AlumniDashboardView />}
    </div>
  );
};

export default Dashboard;
