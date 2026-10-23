import { useAuth } from '../../hooks/useAuth';
import StudentProfilePage from './StudentProfilePage';
import StaffProfilePage from '../shared/StaffProfilePage';

/**
 * Dispatches to StudentProfilePage (no password change) for students,
 * or StaffProfilePage (with ChangePasswordCard) for staff and admin roles.
 */
const ProfilePage = () => {
  const { user } = useAuth();
  const isStudent = (user?.activeRole || user?.role || 'student') === 'student';

  if (isStudent) {
    return <StudentProfilePage />;
  }

  return <StaffProfilePage />;
};

export default ProfilePage;
export { StudentProfilePage, StaffProfilePage };
