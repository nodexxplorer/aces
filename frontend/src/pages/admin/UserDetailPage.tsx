import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { getUser, updateUser, deleteUser } from '../../api/users';
import { getCourses } from '../../api/courses';
import { useNotification } from '../../hooks/useNotification';
import {
  ArrowLeft, Mail, Phone, Calendar, Shield, CheckCircle, XCircle,
  BookOpen, Loader2, User as UserIcon, Edit3, Save, X, Trash2,
  MapPin, AlertTriangle,GraduationCap, Clock
} from 'lucide-react';
import type { User as UserType, Course, UserRole } from '../../types';

type EditFormState = {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  dateOfBirth: string;
  matricNumber: string;
  level: string;
  admissionMode: string;
  yearAdmitted: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  homeAddress: string;
};

const UserDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error: notifyError } = useNotification();
  const [user, setUser] = useState<UserType | null>(null);
  const [assignedCourses, setAssignedCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editForm, setEditForm] = useState<EditFormState>({
    fullName: '',
    email: '',
    phone: '',
    role: 'student',
    dateOfBirth: '',
    matricNumber: '',
    level: '',
    admissionMode: '',
    yearAdmitted: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    homeAddress: '',
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getUser(id)
      .then((userData) => {
        // normalize unknown user shape safely
        const ud = userData as Partial<UserType> & Record<string, unknown>;
        const getStr = (keys: string[]) => {
          for (const k of keys) {
            const v = ud[k];
            if (v !== undefined && v !== null) return String(v);
          }
          return '';
        };

        setUser(userData);
        setEditForm({
          fullName: userData.fullName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
          email: userData.email,
          phone: userData.phone || '',
          role: userData.role || userData.activeRole || 'student',
          dateOfBirth: getStr(['dateOfBirth', 'date_of_birth']),
          matricNumber: getStr(['matricNumber', 'matric_number']),
          level: getStr(['level']),
          admissionMode: getStr(['admissionMode', 'admission_mode']),
          yearAdmitted: getStr(['yearAdmitted', 'year_admitted']),
          emergencyContactName: getStr(['emergencyContactName', 'emergency_contact_name']),
          emergencyContactPhone: getStr(['emergencyContactPhone', 'emergency_contact_phone']),
          homeAddress: getStr(['homeAddress', 'home_address']),
        });
        if (userData.role === 'lecturer' || userData.activeRole === 'lecturer') {
          getCourses({ page: 1, perPage: 100 })
            .then((res) => {
              const allCourses = (res.items || (res as unknown)) as Course[];
              const mine = allCourses.filter(
                (c) => String(c.lecturerId || c.lecturerId || '') === String(id)
              );
              setAssignedCourses(mine);
            })
            .catch(() => {});
        }
      })
      .catch(() => notifyError('Error', 'Failed to load user details'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const yearAdmitted = editForm.yearAdmitted ? Number(editForm.yearAdmitted) : undefined;
      const level = editForm.level ? Number(editForm.level) : undefined;
      await updateUser(user.id, {
        fullName: editForm.fullName,
        email: editForm.email,
        phone: editForm.phone,
        role: editForm.role,
        dateOfBirth: editForm.dateOfBirth || undefined,
        matricNumber: editForm.matricNumber || undefined,
        level: Number.isNaN(level) ? undefined : level,
        admissionMode: editForm.admissionMode || undefined,
        yearAdmitted: Number.isNaN(yearAdmitted) ? undefined : yearAdmitted,
        emergencyContactName: editForm.emergencyContactName || undefined,
        emergencyContactPhone: editForm.emergencyContactPhone || undefined,
        homeAddress: editForm.homeAddress || undefined,
      });
      const updated = await getUser(user.id);
      setUser(updated);
      setEditing(false);
      success('Updated', 'User details saved successfully');
    } catch {
      notifyError('Error', 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await deleteUser(user.id);
      success('Deleted', 'User has been permanently deleted');
      navigate('/admin/users');
    } catch {
      notifyError('Error', 'Failed to delete user');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        <span className="ml-2 text-sm text-surface-500">Loading user details...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6 max-w-xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold">User Not Found</h2>
        <p className="text-surface-500">The user record you are looking for does not exist.</p>
        <Link to="/admin/users">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to User Directory
          </Button>
        </Link>
      </div>
    );
  }

  const fullName = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
  const userRole = user.role || user.activeRole || 'user';
  const isStudent = userRole === 'student';

  const inputCls = "w-full px-3 py-2 text-sm bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20";
  const labelCls = "block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Link to="/admin/users">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to User Directory
          </Button>
        </Link>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <Button size="sm" leftIcon={<Edit3 className="w-4 h-4" />} onClick={() => setEditing(true)}>
                Edit User
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-danger-500 hover:bg-danger-50 border-danger-300"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" leftIcon={<X className="w-4 h-4" />} onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" leftIcon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} onClick={handleSave} disabled={saving}>
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-surface-900 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-danger-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-surface-900 dark:text-white">Delete User</h2>
                <p className="text-sm text-surface-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Are you sure you want to permanently delete <strong>{fullName}</strong> ({user.email})? All associated data will be removed.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button
                variant="danger"
                leftIcon={deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                onClick={handleDelete}
                disabled={deleting}
              >
                Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header */}
      <Card glass className="p-8">
        <CardHeader className="border-b border-surface-200 dark:border-surface-700/50 pb-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-secondary-500 to-primary-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
              {fullName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={user.isActive ? 'success' : 'danger'}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </Badge>
                {!user.isApproved && (
                  <Badge variant="warning">Pending Approval</Badge>
                )}
                <span className="text-xs text-surface-400 capitalize">{userRole.replace('_', ' ')} Profile</span>
              </div>
              {editing ? (
                <input
                  type="text"
                  className="text-2xl font-bold bg-transparent border-b border-primary-500 focus:outline-none text-surface-900 dark:text-white w-full"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                />
              ) : (
                <CardTitle className="text-2xl font-bold">{fullName}</CardTitle>
              )}
              <CardDescription>System ID: {user.id}</CardDescription>
            </div>
          </div>
        </CardHeader>

        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <Mail className="w-5 h-5 text-primary-500" />
              <div className="flex-1">
                <p className="text-xs text-surface-400 font-medium">Email Address</p>
                {editing ? (
                  <input type="email" className={inputCls} value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                ) : (
                  <p>{user.email}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <Phone className="w-5 h-5 text-primary-500" />
              <div className="flex-1">
                <p className="text-xs text-surface-400 font-medium">Phone Number</p>
                {editing ? (
                  <input type="tel" className={inputCls} value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="Not provided" />
                ) : (
                  <p>{user.phone || 'Not provided'}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <UserIcon className="w-5 h-5 text-primary-500" />
              <div className="flex-1">
                <p className="text-xs text-surface-400 font-medium">Role</p>
                {editing ? (
                  <select className={inputCls} value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}>
                    <option value="student">Student</option>
                    <option value="lecturer">Lecturer</option>
                    <option value="class_rep">Class Rep</option>
                    <option value="hod">HOD</option>
                    <option value="delegated_admin">Delegated Admin</option>
                    <option value="class_bursar">Class Bursar</option>
                    <option value="dept_bursar">Dept Bursar</option>
                  </select>
                ) : (
                  <p className="capitalize">{userRole.replace('_', ' ')}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <Calendar className="w-5 h-5 text-primary-500" />
              <div className="flex-1">
                <p className="text-xs text-surface-400 font-medium">Date of Birth</p>
                {editing ? (
                  <input type="date" className={inputCls} value={editForm.dateOfBirth}
                    onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} />
                ) : (
                  <p>{editForm.dateOfBirth || 'Not provided'}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <Shield className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-xs text-surface-400 font-medium">Approval Status</p>
                <p className="flex items-center gap-1.5 mt-0.5">
                  {user.isApproved ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-success-500" />
                      <span className="text-success-600 dark:text-success-400 font-medium">Approved</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-danger-500" />
                      <span className="text-danger-600 dark:text-danger-400 font-medium">Pending Approval</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <Calendar className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-xs text-surface-400 font-medium">Member Since</p>
                <p>{user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'}</p>
              </div>
            </div>

            {user.lastLogin && (
              <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
                <Clock className="w-5 h-5 text-primary-500" />
                <div>
                  <p className="text-xs text-surface-400 font-medium">Last Login</p>
                  <p>{new Date(user.lastLogin).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <MapPin className="w-5 h-5 text-primary-500" />
              <div className="flex-1">
                <p className="text-xs text-surface-400 font-medium">Home Address</p>
                {editing ? (
                  <textarea className={inputCls} rows={2} value={editForm.homeAddress}
                    onChange={(e) => setEditForm({ ...editForm, homeAddress: e.target.value })}
                    placeholder="Not provided" />
                ) : (
                  <p>{editForm.homeAddress || 'Not provided'}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Student Details */}
      {isStudent && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary-500" />
                <CardTitle>Academic Details</CardTitle>
              </div>
              <Link
                to={`/admin/users/${id}/edit`}
                className="text-xs text-primary-500 hover:text-primary-600 flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" /> Full Profile Edit
              </Link>
            </div>
            <CardDescription>Academic information for this student</CardDescription>
          </CardHeader>
          <div className="p-4 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Matric Number</label>
                {editing ? (
                  <input type="text" className={inputCls} value={editForm.matricNumber}
                    onChange={(e) => setEditForm({ ...editForm, matricNumber: e.target.value })}
                    placeholder="e.g. 19/ENG/COE/001" />
                ) : (
                  <div className="bg-surface-50 dark:bg-surface-800/50 rounded-lg p-3">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white">{editForm.matricNumber || 'N/A'}</p>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Level</label>
                {editing ? (
                  <select className={inputCls} value={editForm.level}
                    onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}>
                    <option value="">Select Level</option>
                    <option value="100">100 Level</option>
                    <option value="200">200 Level</option>
                    <option value="300">300 Level</option>
                    <option value="400">400 Level</option>
                    <option value="500">500 Level</option>
                  </select>
                ) : (
                  <div className="bg-surface-50 dark:bg-surface-800/50 rounded-lg p-3">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white">{editForm.level ? `${editForm.level} Level` : 'N/A'}</p>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>CGPA</label>
                <div className="bg-surface-50 dark:bg-surface-800/50 rounded-lg p-3">
                  <p className="text-sm font-semibold text-surface-900 dark:text-white">{((user as UserType & { cgpa?: number | string }).cgpa) ?? 'N/A'}</p>
                </div>
              </div>

              <div>
                <label className={labelCls}>Admission Mode</label>
                {editing ? (
                  <select className={inputCls} value={editForm.admissionMode}
                    onChange={(e) => setEditForm({ ...editForm, admissionMode: e.target.value })}>
                    <option value="">Select Mode</option>
                    <option value="UTME">UTME</option>
                    <option value="Direct Entry">Direct Entry</option>
                  </select>
                ) : (
                  <div className="bg-surface-50 dark:bg-surface-800/50 rounded-lg p-3">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white">{editForm.admissionMode || 'N/A'}</p>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Year Admitted</label>
                {editing ? (
                  <input type="number" className={inputCls} value={editForm.yearAdmitted}
                    onChange={(e) => setEditForm({ ...editForm, yearAdmitted: e.target.value })}
                    placeholder="e.g. 2023" min="1900" max={new Date().getFullYear()} />
                ) : (
                  <div className="bg-surface-50 dark:bg-surface-800/50 rounded-lg p-3">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white">{editForm.yearAdmitted || 'N/A'}</p>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Academic Standing</label>
                <div className="bg-surface-50 dark:bg-surface-800/50 rounded-lg p-3">
                  <p className="text-sm font-semibold text-surface-900 dark:text-white capitalize">
                    {user ? (user as UserType & { academicStanding?: string; academic_standing?: string }).academicStanding || (user as UserType & { academicStanding?: string; academic_standing?: string }).academic_standing || 'N/A' : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Emergency Contact */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary-500" />
            <CardTitle>Emergency Contact</CardTitle>
          </div>
          <CardDescription>Emergency contact information</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Contact Name</label>
              {editing ? (
                <input type="text" className={inputCls} value={editForm.emergencyContactName}
                  onChange={(e) => setEditForm({ ...editForm, emergencyContactName: e.target.value })}
                  placeholder="Full name" />
              ) : (
                <div className="bg-surface-50 dark:bg-surface-800/50 rounded-lg p-3">
                  <p className="text-sm font-semibold text-surface-900 dark:text-white">{editForm.emergencyContactName || 'N/A'}</p>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Contact Phone</label>
              {editing ? (
                <input type="tel" className={inputCls} value={editForm.emergencyContactPhone}
                  onChange={(e) => setEditForm({ ...editForm, emergencyContactPhone: e.target.value })}
                  placeholder="Phone number" />
              ) : (
                <div className="bg-surface-50 dark:bg-surface-800/50 rounded-lg p-3">
                  <p className="text-sm font-semibold text-surface-900 dark:text-white">{editForm.emergencyContactPhone || 'N/A'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Assigned Courses (for lecturers) */}
      {(user.role === 'lecturer' || user.activeRole === 'lecturer') && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary-500" />
              <CardTitle>Assigned Courses</CardTitle>
            </div>
            <CardDescription>Courses assigned to this lecturer</CardDescription>
          </CardHeader>
          <div className="p-4 pt-0">
            {assignedCourses.length === 0 ? (
              <p className="text-sm text-surface-500 text-center py-6">No courses assigned yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Units</th>
                      <th className="px-3 py-2">Level</th>
                      <th className="px-3 py-2">Semester</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                    {assignedCourses.map((course: Course) => (
                      <tr key={course.id}>
                        <td className="px-3 py-2 font-semibold text-primary-600 dark:text-primary-400">{course.code}</td>
                        <td className="px-3 py-2">{course.title}</td>
                        <td className="px-3 py-2">{course.unit || course.creditUnits}</td>
                        <td className="px-3 py-2">{course.level}</td>
                        <td className="px-3 py-2 capitalize">{course.semester}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default UserDetailPage;
