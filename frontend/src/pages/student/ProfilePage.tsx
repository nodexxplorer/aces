import { useAuth } from '../../hooks/useAuth';
import StudentProfilePage from './StudentProfilePage';
import StaffProfilePage from '../shared/StaffProfilePage';
import LecturerProfilePage from '../lecturer/LecturerProfilePage';

/**
 * Dispatches to StudentProfilePage (no password change) for students,
 * LecturerProfilePage for lecturers, and StaffProfilePage (with ChangePasswordCard) for admin roles.
 */
const ProfilePage = () => {
  const { user } = useAuth();
  const isStudent = (user?.activeRole || user?.role || 'student') === 'student';

  if (isStudent) {
    return <StudentProfilePage />;
  }

  const role = user?.activeRole || user?.role;
  if (role === 'lecturer') {
    return <LecturerProfilePage />;
  }

  return <StaffProfilePage />;
};

export default ProfilePage;
export { StudentProfilePage, StaffProfilePage };
