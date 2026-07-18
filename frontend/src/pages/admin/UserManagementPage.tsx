import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import RoleBadge from '../../components/data-display/RoleBadge';
import { useNotification } from '../../hooks/useNotification';
import { Search, UserCheck, ShieldAlert, Loader2, UserPlus, X, RotateCcw, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { getUsers, approveUser, updateUser, createUser, deleteUser } from '../../api/users';
import { useAuth } from '../../hooks/useAuth';
import type { User, UserRole } from '../../types';

const getDisplayName = (u: any) => {
  if (u.fullName) return u.fullName;
  if (u.full_name) return u.full_name;
  if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return u.email;
};

const UserManagementPage = () => {
  const { success, error: notifyError } = useNotification();
  const { user: currentUser } = useAuth();
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', password: '', full_name: '', role: 'student', phone: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '', email: '', phone: '', role: 'student',
    dateOfBirth: '', matricNumber: '', level: '', admissionMode: '', yearAdmitted: '',
    emergencyContactName: '', emergencyContactPhone: '', homeAddress: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getUsers({ page: 1, perPage: 100 });
      setUsers(Array.isArray(result) ? result : []);
    } catch (err: any) {
      notifyError('Load Failed', err?.response?.data?.error || err?.response?.data?.message || 'Could not load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const getUserAllRoles = (u: User): UserRole[] => {
    const any = u as any;
    if (Array.isArray(any.allRoles) && any.allRoles.length > 0) return any.allRoles;
    if (Array.isArray(u.roles) && u.roles.length > 0) return u.roles;
    if (u.role) return [u.role];
    return [];
  };

  const filtered = users.filter((u) => {
    const allRoles = getUserAllRoles(u);
    const matchesRole = roleFilter === 'all' || allRoles.includes(roleFilter as UserRole);
    const name = getDisplayName(u);
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      await approveUser(id);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isApproved: true } : u)));
      success('User Approved', 'Account activated successfully');
    } catch (err: any) {
      notifyError('Approval Failed', err?.response?.data?.message || err?.message || 'Could not approve user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (id: string) => {
    if (id === currentUser?.id) {
      notifyError('Not Allowed', 'You cannot suspend your own account');
      return;
    }
    try {
      setActionLoading(id);
      const user = users.find((u) => u.id === id);
      const fullName = getDisplayName(user || {} as User);
      await updateUser(id, { full_name: fullName, isActive: false } as any);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isActive: false } : u)));
      success('User Suspended', 'Account access suspended');
    } catch (err: any) {
      notifyError('Suspend Failed', err?.response?.data?.message || err?.message || 'Could not suspend user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      setActionLoading(id);
      const user = users.find((u) => u.id === id);
      const fullName = getDisplayName(user || {} as User);
      await updateUser(id, { full_name: fullName, isActive: true } as any);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isActive: true } : u)));
      success('User Reactivated', 'Account access restored');
    } catch (err: any) {
      notifyError('Reactivation Failed', err?.response?.data?.message || err?.message || 'Could not reactivate user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddUser = async () => {
    try {
      setAddLoading(true);
      await createUser({
        email: addForm.email,
        password: addForm.password,
        full_name: addForm.full_name,
        role: addForm.role,
        phone: addForm.phone || undefined,
      });
      success('User Created', 'New account has been created');
      setShowAddModal(false);
      setAddForm({ email: '', password: '', full_name: '', role: 'student', phone: '' });
      fetchUsers();
    } catch (err: any) {
      notifyError('Create Failed', err?.response?.data?.message || err?.message || 'Could not create user');
    } finally {
      setAddLoading(false);
    }
  };

  const openEditModal = (user: User) => {
    setEditUser(user);
    setEditForm({
      full_name: getDisplayName(user),
      email: user.email,
      phone: user.phone || '',
      role: user.role || user.activeRole || 'student',
      dateOfBirth: (user as any).dateOfBirth || (user as any).date_of_birth || '',
      matricNumber: (user as any).matricNumber || (user as any).matric_number || '',
      level: (user as any).level ? String((user as any).level) : '',
      admissionMode: (user as any).admissionMode || (user as any).admission_mode || '',
      yearAdmitted: (user as any).yearAdmitted ? String((user as any).yearAdmitted) : ((user as any).year_admitted ? String((user as any).year_admitted) : ''),
      emergencyContactName: (user as any).emergencyContactName || (user as any).emergency_contact_name || '',
      emergencyContactPhone: (user as any).emergencyContactPhone || (user as any).emergency_contact_phone || '',
      homeAddress: (user as any).homeAddress || (user as any).home_address || '',
    });
  };

  const handleEditSubmit = async () => {
    if (!editUser) return;
    try {
      setEditLoading(true);
      await updateUser(editUser.id, {
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone,
        role: editForm.role,
        dateOfBirth: editForm.dateOfBirth || undefined,
        matricNumber: editForm.matricNumber || undefined,
        level: editForm.level || undefined,
        admissionMode: editForm.admissionMode || undefined,
        yearAdmitted: editForm.yearAdmitted || undefined,
        emergencyContactName: editForm.emergencyContactName || undefined,
        emergencyContactPhone: editForm.emergencyContactPhone || undefined,
        homeAddress: editForm.homeAddress || undefined,
      } as any);
      setUsers((prev) => prev.map((u) => {
        if (u.id !== editUser.id) return u;
        return {
          ...u,
          fullName: editForm.full_name,
          firstName: editForm.full_name.split(' ')[0],
          lastName: editForm.full_name.split(' ').slice(1).join(' '),
          email: editForm.email,
          phone: editForm.phone,
          role: editForm.role as UserRole,
          activeRole: editForm.role as UserRole,
        };
      }));
      success('User Updated', 'User details have been saved');
      setEditUser(null);
    } catch (err: any) {
      notifyError('Update Failed', err?.response?.data?.message || err?.message || 'Could not update user');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setDeleteLoading(true);
    try {
      await deleteUser(deleteUserTarget.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteUserTarget.id));
      success('User Deleted', `${getDisplayName(deleteUserTarget)} has been permanently removed`);
      setDeleteUserTarget(null);
    } catch (err: any) {
      notifyError('Delete Failed', err?.response?.data?.message || err?.message || 'Could not delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (_: unknown, row: User) => {
        const displayName = getDisplayName(row);
        const userRole = row.role || row.activeRole || (row.roles && row.roles[0]) || '';
        const isStudent = userRole === 'student';
        const detailPath = isStudent ? `/admin/students/${row.id}` : `/admin/users/${row.id}`;
        return (
          <div>
            <Link to={detailPath} className="font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              {displayName}
            </Link>
            <p className="text-[10px] text-surface-500">{row.email}</p>
          </div>
        );
      },
    },
    {
      key: 'role', label: 'Roles',
      render: (_: unknown, row: User) => {
        const allRoles = getUserAllRoles(row);
        return (
          <div className="flex flex-wrap gap-1">
            {allRoles.map((r) => <RoleBadge key={r} role={r} />)}
          </div>
        );
      },
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (val: unknown) => <span className="text-sm text-surface-600 dark:text-surface-400">{(val as string) || '—'}</span>,
    },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
    {
      key: 'action',
      label: 'Actions',
      render: (_: unknown, row: User) => {
        const isLoading = actionLoading === row.id;
        return (
          <div className="flex gap-2 flex-wrap">
            <Button
              size="xs"
              variant="ghost"
              leftIcon={<Pencil className="w-3.5 h-3.5" />}
              onClick={() => openEditModal(row)}
            >
              Edit
            </Button>
            {!row.isApproved && (
              <Button
                size="xs"
                variant="success"
                leftIcon={isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                onClick={() => handleApprove(row.id)}
                disabled={isLoading}
              >
                Approve
              </Button>
            )}
            {row.isActive && row.id !== currentUser?.id && (
              <Button
                size="xs"
                variant="outline"
                className="text-danger-500 hover:bg-danger-50"
                leftIcon={<ShieldAlert className="w-3.5 h-3.5" />}
                onClick={() => handleSuspend(row.id)}
                disabled={isLoading}
              >
                Suspend
              </Button>
            )}
            {!row.isActive && (
              <Button
                size="xs"
                variant="outline"
                className="text-success-600 hover:bg-success-50"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => handleReactivate(row.id)}
                disabled={isLoading}
              >
                Reactivate
              </Button>
            )}
            <Button
              size="xs"
              variant="ghost"
              className="text-danger-500 hover:bg-danger-50"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => setDeleteUserTarget(row)}
            >
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

  const mappedUsers = filtered.map((u) => ({
    ...u,
    role: u.role || u.activeRole || (u.roles && u.roles.length > 0 ? u.roles[0] : ''),
    allRoles: getUserAllRoles(u),
    status: u.isActive ? (u.isApproved ? 'active' : 'pending') : 'suspended',
  }));

  const editModalIsStudent = editForm.role === 'student';
  const inputCls = "w-full px-3 py-2 text-sm bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">User Directory</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Review, approve and manage system access settings for all department users.
          </p>
        </div>
        <Button
          leftIcon={<UserPlus className="w-4 h-4" />}
          onClick={() => setShowAddModal(true)}
        >
          Add User
        </Button>
      </div>

      <div className="flex gap-4 max-w-xl">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search directory..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          options={[
            { value: 'all', label: 'All Roles' },
            { value: 'student', label: 'Students' },
            { value: 'lecturer', label: 'Lecturers' },
            { value: 'class_rep', label: 'Class Reps' },
            { value: 'hod', label: 'HOD' },
            { value: 'delegated_admin', label: 'Admins' },
            { value: 'class_bursar', label: 'Class Bursar' },
            { value: 'dept_bursar', label: 'Dept Bursar' },
          ]}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        />
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading users...</span>
          </div>
        ) : (
          <DataTable columns={columns} data={mappedUsers as unknown as Record<string, unknown>[]} />
        )}
      </Card>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-surface-900 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-surface-900 dark:text-white">Add New User</h2>
              <button onClick={() => setShowAddModal(false)} className="text-surface-400 hover:text-surface-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Full Name</label>
                <input
                  type="text"
                  className={inputCls}
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Email</label>
                <input
                  type="email"
                  className={inputCls}
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Password</label>
                <input
                  type="password"
                  className={inputCls}
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Phone (optional)</label>
                <input
                  type="tel"
                  className={inputCls}
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="08012345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Role</label>
                <Select
                  options={[
                    { value: 'student', label: 'Student' },
                    { value: 'lecturer', label: 'Lecturer' },
                    { value: 'class_rep', label: 'Class Rep' },
                    { value: 'hod', label: 'HOD' },
                    { value: 'class_bursar', label: 'Class Bursar' },
                    { value: 'dept_bursar', label: 'Dept Bursar' },
                  ]}
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button
                leftIcon={addLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
                onClick={handleAddUser}
                disabled={addLoading || !addForm.email || !addForm.password || !addForm.full_name}
              >
                Create User
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
          <div className="bg-white dark:bg-surface-900 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-surface-900 dark:text-white">Edit User Details</h2>
              <button onClick={() => setEditUser(null)} className="text-surface-400 hover:text-surface-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Full Name</label>
                <input type="text" className={inputCls} value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Email</label>
                <input type="email" className={inputCls} value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Phone</label>
                <input type="tel" className={inputCls} value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="Not provided" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Role</label>
                <Select
                  options={[
                    { value: 'student', label: 'Student' },
                    { value: 'lecturer', label: 'Lecturer' },
                    { value: 'class_rep', label: 'Class Rep' },
                    { value: 'hod', label: 'HOD' },
                    { value: 'delegated_admin', label: 'Delegated Admin' },
                    { value: 'class_bursar', label: 'Class Bursar' },
                    { value: 'dept_bursar', label: 'Dept Bursar' },
                  ]}
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Date of Birth</label>
                <input type="date" className={inputCls} value={editForm.dateOfBirth}
                  onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Home Address</label>
                <input type="text" className={inputCls} value={editForm.homeAddress}
                  onChange={(e) => setEditForm({ ...editForm, homeAddress: e.target.value })}
                  placeholder="Not provided" />
              </div>

              {/* Student-specific fields */}
              {editModalIsStudent && (
                <>
                  <div className="border-t border-surface-200 dark:border-surface-700 pt-3 mt-3">
                    <p className="text-xs font-semibold text-primary-500 uppercase tracking-wider mb-3">Student Details</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Matric Number</label>
                      <input type="text" className={inputCls} value={editForm.matricNumber}
                        onChange={(e) => setEditForm({ ...editForm, matricNumber: e.target.value })}
                        placeholder="e.g. 19/ENG/COE/001" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Level</label>
                      <Select
                        options={[
                          { value: '', label: 'Select' },
                          { value: '100', label: '100 Level' },
                          { value: '200', label: '200 Level' },
                          { value: '300', label: '300 Level' },
                          { value: '400', label: '400 Level' },
                          { value: '500', label: '500 Level' },
                        ]}
                        value={editForm.level}
                        onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Admission Mode</label>
                      <Select
                        options={[
                          { value: '', label: 'Select' },
                          { value: 'UTME', label: 'UTME' },
                          { value: 'Direct Entry', label: 'Direct Entry' },
                        ]}
                        value={editForm.admissionMode}
                        onChange={(e) => setEditForm({ ...editForm, admissionMode: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Year Admitted</label>
                      <input type="number" className={inputCls} value={editForm.yearAdmitted}
                        onChange={(e) => setEditForm({ ...editForm, yearAdmitted: e.target.value })}
                        placeholder="e.g. 2023" min="1900" max={new Date().getFullYear()} />
                    </div>
                  </div>
                </>
              )}

              {/* Emergency Contact */}
              <div className="border-t border-surface-200 dark:border-surface-700 pt-3 mt-3">
                <p className="text-xs font-semibold text-primary-500 uppercase tracking-wider mb-3">Emergency Contact</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Contact Name</label>
                  <input type="text" className={inputCls} value={editForm.emergencyContactName}
                    onChange={(e) => setEditForm({ ...editForm, emergencyContactName: e.target.value })}
                    placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Contact Phone</label>
                  <input type="tel" className={inputCls} value={editForm.emergencyContactPhone}
                    onChange={(e) => setEditForm({ ...editForm, emergencyContactPhone: e.target.value })}
                    placeholder="Phone number" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t border-surface-200 dark:border-surface-700">
              <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button
                leftIcon={editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
                onClick={handleEditSubmit}
                disabled={editLoading || !editForm.full_name || !editForm.email}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteUserTarget && (
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
              Are you sure you want to permanently delete <strong>{getDisplayName(deleteUserTarget)}</strong> ({deleteUserTarget.email})? All associated data will be removed.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setDeleteUserTarget(null)}>Cancel</Button>
              <Button
                variant="danger"
                leftIcon={deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                onClick={handleDeleteUser}
                disabled={deleteLoading}
              >
                Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
