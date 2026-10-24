import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  approveUser,
  rejectUser,
  getPendingApprovals,
} from '../../api/users';
import {
  getAllRoles,
  createRole,
  searchStudentsForRoles,
  assignUserRole,
  revokeUserRole,
  type Role,
} from '../../api/role-management';
import type { User, UserRole, StudentForRoleManagement } from '../../types';
import { getErrorMessage } from '../../utils/errors';
import { CAPABILITIES, capabilitiesForRole, capabilitiesForRoles, type Capability } from '../../config/permissions';
import {
  Users,
  Shield,
  UserPlus,
  Check,
  Search,
  Plus,
  Pencil,
  MoreVertical,
  Lock,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  X,
  Loader2,
  Trash2,
  Ban,
  CheckCircle2,
  UserCog,
} from 'lucide-react';

type TabKey = 'directory' | 'roles' | 'assign' | 'approvals';

// Extended type for full user profile fields
type ExtendedUser = User & {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  matric_number?: string;
  admission_mode?: string;
  year_admitted?: number | string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  home_address?: string;
};

// Mask email like "t•••••••@gmail.com"
const maskEmail = (email?: string): string => {
  if (!email || !email.includes('@')) return email || '—';
  const [local, domain] = email.split('@');
  if (local.length <= 1) return `${local}•••••••@${domain}`;
  const dotCount = Math.min(7, Math.max(4, local.length - 1));
  return `${local[0]}${'•'.repeat(dotCount)}@${domain}`;
};

// Mask or format phone like "+234 907 ••• ••34"
const formatPhone = (phone?: string): string => {
  if (!phone) return '—';
  const clean = phone.trim();
  if (clean.length >= 10) {
    const start = clean.slice(0, 4);
    const end = clean.slice(-2);
    return `${start} ••• ••${end}`;
  }
  return clean;
};

// Get initials for avatar (e.g. "GN" for Godswill Nicbassey)
const getInitials = (user: User): string => {
  const first = (user.firstName || '').trim();
  const last = (user.lastName || '').trim();
  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }
  const full = (user.fullName || '').trim();
  if (full) {
    const parts = full.split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  }
  if (user.email) {
    return user.email.slice(0, 2).toUpperCase();
  }
  return 'U';
};

// Format short display name (e.g. "Godswill N." or "System Admin")
const getShortDisplayName = (user: User): string => {
  const first = (user.firstName || '').trim();
  const last = (user.lastName || '').trim();
  if (first && last) {
    return `${first} ${last[0]}.`;
  }
  if (user.fullName) {
    const parts = user.fullName.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[1][0]}.`;
    }
    return user.fullName;
  }
  return user.email.split('@')[0];
};

// Format full display name (e.g. "Godswill Nicbassey")
const getFullDisplayName = (user: User): string => {
  const first = (user.firstName || '').trim();
  const last = (user.lastName || '').trim();
  if (first || last) {
    return `${first} ${last}`.trim();
  }
  return user.fullName || user.email;
};

/** Every role a person holds: the primary role plus extra roles, without duplicates. */
function rolesOfPerson(u: User): string[] {
  const names = [u.role, ...(u.roles ?? [])].filter((r): r is UserRole => Boolean(r));
  return Array.from(new Set(names));
}

// Student extra roles configuration
const STUDENT_ASSIGNABLE_ROLES: {
  key: UserRole;
  label: string;
  description: string;
}[] = [
  {
    key: 'class_rep',
    label: 'Class representative',
    description: 'Can track attendance and submit class reports',
  },
  {
    key: 'class_bursar',
    label: 'Class bursar',
    description: 'Can verify student payments and manage defaulters',
  },
  {
    key: 'dept_bursar',
    label: 'Department bursar',
    description: 'Can manage departmental finances',
  },
  {
    key: 'project_coordinator',
    label: 'Project coordinator',
    description: 'Manage project and thesis groups and milestones',
  },
  {
    key: 'event_coordinator',
    label: 'Event coordinator',
    description: 'Create and manage departmental events and announcements',
  },
];

export default function UserManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabKey) || 'directory';

  const { user: currentUser } = useAuth();
  const { success, error: notifyError } = useNotification();

  // ----------------------------------------------------
  // Global State (Real Data Only)
  // ----------------------------------------------------
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Directory filter states
  const [directorySearch, setDirectorySearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Edit Drawer State
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [, setEditLoading] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    role: 'student',
    level: '',
    matricNumber: '',
    yearAdmitted: '',
  });

  // Add User Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone: '',
    role: 'student',
  });

  // Assign Roles State
  const [assignSearch, setAssignSearch] = useState('');
  const [assignStudents, setAssignStudents] = useState<StudentForRoleManagement[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [manageRolesStudent, setManageRolesStudent] = useState<StudentForRoleManagement | null>(null);
  const [manageRolesModalOpen, setManageRolesModalOpen] = useState(false);
  const [studentRoleToggles, setStudentRoleToggles] = useState<Set<UserRole>>(new Set());
  const [savingStudentRoles, setSavingStudentRoles] = useState(false);

  // Roles & Permissions Tab State
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);
  const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  const [rolePage, setRolePage] = useState(1);

  // Permissions for a person: a search over the directory, then the chosen person.
  const [permissionSearch, setPermissionSearch] = useState('');
  const [permissionResults, setPermissionResults] = useState<User[]>([]);
  const [permissionPerson, setPermissionPerson] = useState<User | null>(null);
  const [searchingPeople, setSearchingPeople] = useState(false);

  // Active action menu row id
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // ----------------------------------------------------
  // Fetch Real Data from APIs
  // ----------------------------------------------------
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes, approvalsRes] = await Promise.allSettled([
        getUsers({ page: 1, perPage: 100 }),
        getAllRoles(),
        getPendingApprovals(),
      ]);

      if (usersRes.status === 'fulfilled') {
        setUsers(Array.isArray(usersRes.value) ? usersRes.value : []);
      }
      if (rolesRes.status === 'fulfilled') {
        const val = rolesRes.value;
        const list = Array.isArray(val) ? val : (val as { items: Role[] })?.items || [];
        setRoles(list);
      }
      if (approvalsRes.status === 'fulfilled') {
        setPendingApprovals(Array.isArray(approvalsRes.value) ? approvalsRes.value : []);
      }
    } catch {
      notifyError('Error', 'Failed to load user directory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Search the directory for the person whose permissions are shown (debounced).
  useEffect(() => {
    const term = permissionSearch.trim();
    if (!term) {
      setPermissionResults([]);
      setSearchingPeople(false);
      return;
    }
    setSearchingPeople(true);
    const timer = setTimeout(async () => {
      try {
        const res = await getUsers({ page: 1, perPage: 10, search: term });
        setPermissionResults(Array.isArray(res) ? res : []);
      } catch {
        setPermissionResults([]);
      } finally {
        setSearchingPeople(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [permissionSearch]);

  // Fetch assignable students when assign tab is active or search changes
  useEffect(() => {
    if (activeTab === 'assign') {
      const fetchAssignData = async () => {
        try {
          setAssignLoading(true);
          const res = await searchStudentsForRoles({ search: assignSearch, page: 1, per_page: 50 });
          setAssignStudents(res.data || []);
        } catch {
          setAssignStudents([]);
        } finally {
          setAssignLoading(false);
        }
      };
      const t = setTimeout(fetchAssignData, 250);
      return () => clearTimeout(t);
    }
  }, [activeTab, assignSearch]);

  const handleTabChange = (key: TabKey) => {
    setSearchParams({ tab: key });
  };

  // ----------------------------------------------------
  // Stat Card Metrics (Real Backend Numbers Only)
  // ----------------------------------------------------
  const allUsersCount = users.length;
  const studentsCount = useMemo(() => {
    return users.filter((u) => {
      const r = (u.role || u.activeRole || '').toLowerCase();
      const rolesArr = (u.roles || []).map((x) => x.toLowerCase());
      return r === 'student' || rolesArr.includes('student');
    }).length;
  }, [users]);

  const hodCount = useMemo(() => {
    return users.filter((u) => {
      const r = (u.role || u.activeRole || '').toLowerCase();
      const rolesArr = (u.roles || []).map((x) => x.toLowerCase());
      return r === 'hod' || rolesArr.includes('hod');
    }).length;
  }, [users]);

  const adminCount = useMemo(() => {
    return users.filter((u) => {
      const r = (u.role || u.activeRole || '').toLowerCase();
      const rolesArr = (u.roles || []).map((x) => x.toLowerCase());
      return (
        r === 'admin' ||
        r === 'system_admin' ||
        r === 'delegated_admin' ||
        rolesArr.includes('admin') ||
        rolesArr.includes('delegated_admin')
      );
    }).length;
  }, [users]);

  // ----------------------------------------------------
  // Filtered Users for Directory
  // ----------------------------------------------------
  const filteredUsers = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    return users.filter((u) => {
      // Role filter
      if (roleFilter !== 'all') {
        const uRole = (u.role || u.activeRole || '').toLowerCase();
        const uRoles = (u.roles || []).map((x) => x.toLowerCase());
        if (uRole !== roleFilter && !uRoles.includes(roleFilter)) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && (!u.isActive || !u.isApproved)) return false;
        if (statusFilter === 'pending' && (u.isApproved || !u.isActive)) return false;
        if (statusFilter === 'suspended' && u.isActive) return false;
      }

      // Search query
      if (q) {
        const name = (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase();
        const email = (u.email || '').toLowerCase();
        const matric = ((u as ExtendedUser).matric_number || (u as ExtendedUser).matricNumber || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !matric.includes(q)) return false;
      }

      return true;
    });
  }, [users, directorySearch, roleFilter, statusFilter]);

  // ----------------------------------------------------
  // Edit User Drawer Handlers
  // ----------------------------------------------------
  const handleOpenEditDrawer = async (user: User) => {
    setSelectedUser(user);
    const eu = user as ExtendedUser;
    setEditForm({
      first_name: eu.firstName || eu.first_name || '',
      last_name: eu.lastName || eu.last_name || '',
      email: eu.email || '',
      phone: eu.phone || '',
      dateOfBirth: eu.dateOfBirth || eu.date_of_birth || '',
      role: eu.role || eu.activeRole || 'student',
      level: eu.level ? `${eu.level} Level` : '',
      matricNumber: eu.matricNumber || eu.matric_number || '',
      yearAdmitted: eu.yearAdmitted ? String(eu.yearAdmitted) : eu.year_admitted ? String(eu.year_admitted) : '',
    });
    setEditDrawerOpen(true);

    try {
      setEditLoading(true);
      const full = (await getUser(user.id)) as ExtendedUser;
      if (full) {
        setEditForm({
          first_name: full.firstName || full.first_name || '',
          last_name: full.lastName || full.last_name || '',
          email: full.email || '',
          phone: full.phone || '',
          dateOfBirth: full.dateOfBirth || full.date_of_birth || '',
          role: full.role || full.activeRole || 'student',
          level: full.level ? `${full.level} Level` : '',
          matricNumber: full.matricNumber || full.matric_number || '',
          yearAdmitted: full.yearAdmitted
            ? String(full.yearAdmitted)
            : full.year_admitted
              ? String(full.year_admitted)
              : '',
        });
      }
    } catch {
      // keep basic info
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveUserChanges = async () => {
    if (!selectedUser) return;
    try {
      setEditSubmitting(true);
      const levelNumber = parseInt(editForm.level.replace(/[^0-9]/g, ''), 10) || undefined;
      await updateUser(selectedUser.id, {
        firstName: editForm.first_name,
        lastName: editForm.last_name,
        email: editForm.email,
        phone: editForm.phone || undefined,
        role: editForm.role as UserRole,
        level: levelNumber,
        matricNumber: editForm.matricNumber || undefined,
      });
      success('Changes Saved', `Updated details for ${editForm.first_name || selectedUser.email}`);
      setEditDrawerOpen(false);
      fetchData();
    } catch (err: unknown) {
      notifyError('Failed to Save', getErrorMessage(err, 'Could not save user details'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleSuspendUser = async () => {
    if (!selectedUser) return;
    if (selectedUser.id === currentUser?.id) {
      notifyError('Not Allowed', 'You cannot suspend your own account');
      return;
    }
    try {
      await updateUser(selectedUser.id, { isActive: !selectedUser.isActive });
      success(
        selectedUser.isActive ? 'User Suspended' : 'User Reactivated',
        `Account access ${selectedUser.isActive ? 'suspended' : 'restored'}`,
      );
      setEditDrawerOpen(false);
      fetchData();
    } catch (err: unknown) {
      notifyError('Action Failed', getErrorMessage(err, 'Could not update user status'));
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (selectedUser.id === currentUser?.id) {
      notifyError('Not Allowed', 'You cannot delete your own account');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete ${getFullDisplayName(selectedUser)}?`)) {
      return;
    }
    try {
      await deleteUser(selectedUser.id);
      success('User Deleted', 'Account has been removed');
      setEditDrawerOpen(false);
      fetchData();
    } catch (err: unknown) {
      notifyError('Delete Failed', getErrorMessage(err, 'Could not delete user'));
    }
  };

  // ----------------------------------------------------
  // Add User Handlers
  // ----------------------------------------------------
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.email || !addForm.password) {
      notifyError('Missing Fields', 'Email and password are required');
      return;
    }
    try {
      setAddSubmitting(true);
      await createUser({
        email: addForm.email.trim(),
        password: addForm.password,
        first_name: addForm.first_name.trim(),
        last_name: addForm.last_name.trim(),
        role: addForm.role,
        phone: addForm.phone ? addForm.phone.trim() : undefined,
      });
      success('User Created', `Account created for ${addForm.email}`);
      setAddModalOpen(false);
      setAddForm({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        phone: '',
        role: 'student',
      });
      fetchData();
    } catch (err: unknown) {
      notifyError('Creation Failed', getErrorMessage(err, 'Could not create user account'));
    } finally {
      setAddSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // Manage Student Roles Handlers
  // ----------------------------------------------------
  const handleOpenManageRolesModal = (student: StudentForRoleManagement) => {
    setManageRolesStudent(student);
    const existing = new Set<UserRole>(student.roles || []);
    setStudentRoleToggles(existing);
    setManageRolesModalOpen(true);
  };

  const toggleStudentRole = (roleKey: UserRole) => {
    setStudentRoleToggles((prev) => {
      const next = new Set(prev);
      if (next.has(roleKey)) {
        next.delete(roleKey);
      } else {
        next.add(roleKey);
      }
      return next;
    });
  };

  const handleSaveStudentRoles = async () => {
    if (!manageRolesStudent) return;
    try {
      setSavingStudentRoles(true);
      const original = new Set(manageRolesStudent.roles || []);
      const desired = studentRoleToggles;

      for (const r of desired) {
        if (!original.has(r)) {
          await assignUserRole(manageRolesStudent.id, r);
        }
      }
      for (const r of original) {
        if (!desired.has(r) && r !== 'student') {
          await revokeUserRole(manageRolesStudent.id, r);
        }
      }

      success('Roles Updated', `Roles for ${manageRolesStudent.full_name} have been updated.`);
      setManageRolesModalOpen(false);

      // Refresh assign list
      const res = await searchStudentsForRoles({ search: assignSearch, page: 1, per_page: 50 });
      setAssignStudents(res.data || []);
      fetchData();
    } catch (err: unknown) {
      notifyError('Update Failed', getErrorMessage(err, 'Could not update student roles'));
    } finally {
      setSavingStudentRoles(false);
    }
  };

  // ----------------------------------------------------
  // Create New Role Handlers
  // ----------------------------------------------------
  const handleCreateNewRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      setCreatingRole(true);
      await createRole({
        name: newRoleName.trim().toLowerCase().replace(/\s+/g, '_'),
        description: newRoleDesc.trim(),
        permissions: [],
      });
      success('Role Created', `New role "${newRoleName}" created successfully.`);
      setCreateRoleModalOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      fetchData();
    } catch (err: unknown) {
      notifyError('Creation Failed', getErrorMessage(err, 'Could not create new role'));
    } finally {
      setCreatingRole(false);
    }
  };

  // ----------------------------------------------------
  // Approvals Handlers
  // ----------------------------------------------------
  const handleApproveRegistration = async (id: string, name: string) => {
    try {
      await approveUser(id);
      success('Approved', `Account for ${name} has been approved.`);
      fetchData();
    } catch (err: unknown) {
      notifyError('Approval Failed', getErrorMessage(err, 'Could not approve user'));
    }
  };

  const handleRejectRegistration = async (id: string, name: string) => {
    const reason = window.prompt(`Reason for rejecting ${name}:`, 'Incomplete or unverified credentials');
    if (reason === null) return;
    try {
      await rejectUser(id, reason);
      success('Rejected', `Account for ${name} has been rejected.`);
      fetchData();
    } catch (err: unknown) {
      notifyError('Rejection Failed', getErrorMessage(err, 'Could not reject user'));
    }
  };

  // Selected role for Permissions panel
  const activeSelectedRole = roles[selectedRoleIndex] || roles[0];
  // Everything the chosen person can do: the union over all of their roles, including extra roles.
  const personRoleNames = permissionPerson ? rolesOfPerson(permissionPerson) : [];
  const personGranted = new Set(capabilitiesForRoles(personRoleNames).map((c) => c.key));
  const roleCapabilities: Capability[] = activeSelectedRole ? capabilitiesForRole(activeSelectedRole.name) : [];

  return (
    <div className="space-y-6 pb-16">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
            <span>People & access</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {activeTab === 'roles' ? 'Roles & permissions' : activeTab === 'assign' ? 'Assign roles' : 'Users'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {activeTab === 'directory' && 'Review, approve and manage system access for all department users.'}
            {activeTab === 'roles' && 'Manage system roles and what each one can do.'}
            {activeTab === 'assign' && 'Give students extra responsibilities.'}
            {activeTab === 'approvals' && 'Review, approve or reject pending account registrations.'}
          </p>
        </div>

        {/* Top Right Action Button */}
        <div>
          {activeTab === 'directory' && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add user</span>
            </button>
          )}
          {activeTab === 'roles' && (
            <button
              onClick={() => setCreateRoleModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Create role</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div className="inline-flex items-center p-1 rounded-full bg-slate-100 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/80 shadow-inner">
        <button
          onClick={() => handleTabChange('directory')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeTab === 'directory'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Directory</span>
        </button>

        <button
          onClick={() => handleTabChange('roles')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeTab === 'roles'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Roles & permissions</span>
        </button>

        <button
          onClick={() => handleTabChange('assign')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeTab === 'assign'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Assign roles</span>
        </button>

        <button
          onClick={() => handleTabChange('approvals')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeTab === 'approvals'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Check className="w-3.5 h-3.5" />
          <span>Approvals</span>
          {pendingApprovals.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
              {pendingApprovals.length}
            </span>
          )}
        </button>
      </div>

      {/* ==================================================== */}
      {/* ── TAB 1: DIRECTORY (Screenshots 1, 2, 3) ── */}
      {/* ==================================================== */}
      {activeTab === 'directory' && (
        <div className="space-y-6">
          {/* 4 Stat Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Tile 1: All users */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">All users</p>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{allUsersCount}</p>
              </div>
            </div>

            {/* Tile 2: Students */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center shrink-0">
                <UserCog className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Students</p>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{studentsCount}</p>
              </div>
            </div>

            {/* Tile 3: HOD */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">HOD</p>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{hodCount}</p>
              </div>
            </div>

            {/* Tile 4: Admin */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Admin</p>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{adminCount}</p>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email or matric number"
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All roles</option>
                <option value="student">Student</option>
                <option value="lecturer">Lecturer</option>
                <option value="hod">HOD</option>
                <option value="admin">Admin</option>
                <option value="delegated_admin">Delegated admin</option>
                <option value="class_rep">Class rep</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Directory Users Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a]/40 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4 sm:px-6">Name</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Phone</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        <p>Loading user directory...</p>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold text-slate-300">No users found</p>
                        <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isCurrentOrHOD = u.id === currentUser?.id || (u.role || '').toLowerCase() === 'hod';
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                          {/* Name + Masked Email */}
                          <td className="py-3 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700/80">
                                {getInitials(u)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 dark:text-white truncate">
                                  {getShortDisplayName(u)}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">{maskEmail(u.email)}</p>
                              </div>
                            </div>
                          </td>

                          {/* Role Pill */}
                          <td className="py-3 px-4">
                            {(() => {
                              const r = (u.role || u.activeRole || 'student').toLowerCase();
                              if (r === 'hod') {
                                return (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">
                                    HOD
                                  </span>
                                );
                              }
                              if (r === 'admin' || r === 'system_admin') {
                                return (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-rose-500/30 text-rose-400 bg-rose-500/10">
                                    Admin
                                  </span>
                                );
                              }
                              if (r === 'delegated_admin') {
                                return (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-purple-500/30 text-purple-400 bg-purple-500/10">
                                    Delegated Admin
                                  </span>
                                );
                              }
                              if (r === 'lecturer') {
                                return (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
                                    Lecturer
                                  </span>
                                );
                              }
                              if (r === 'class_rep') {
                                return (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-amber-500/30 text-amber-400 bg-amber-500/10">
                                    Class rep
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                                  Student
                                </span>
                              );
                            })()}
                          </td>

                          {/* Phone */}
                          <td className="py-3 px-4 text-slate-500 text-xs">{formatPhone((u as ExtendedUser).phone)}</td>

                          {/* Status Pill */}
                          <td className="py-3 px-4">
                            {u.isActive ? (
                              u.isApproved ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" /> Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                  Pending
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 border border-rose-500/20 text-rose-400">
                                Suspended
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 sm:px-6 text-right">
                            <div className="relative inline-flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenEditDrawer(u)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>

                              {isCurrentOrHOD ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 px-2 py-1">
                                  <Lock className="w-3.5 h-3.5 opacity-60" />
                                  <span>Protected</span>
                                </span>
                              ) : (
                                <div className="relative">
                                  <button
                                    onClick={() => setActiveMenuId(activeMenuId === u.id ? null : u.id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>

                                  {activeMenuId === u.id && (
                                    <>
                                      <div className="fixed inset-0 z-20" onClick={() => setActiveMenuId(null)} />
                                      <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white dark:bg-[#111c35] border border-slate-200 dark:border-slate-700 shadow-xl z-30 py-1 text-left text-xs">
                                        <button
                                          onClick={() => {
                                            setActiveMenuId(null);
                                            handleOpenEditDrawer(u);
                                          }}
                                          className="w-full px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                                        >
                                          <Pencil className="w-3.5 h-3.5" /> Edit details
                                        </button>
                                        <button
                                          onClick={async () => {
                                            setActiveMenuId(null);
                                            await updateUser(u.id, { isActive: !u.isActive });
                                            fetchData();
                                          }}
                                          className="w-full px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                                        >
                                          <Ban className="w-3.5 h-3.5" />{' '}
                                          {u.isActive ? 'Suspend account' : 'Reactivate account'}
                                        </button>
                                        <button
                                          onClick={async () => {
                                            setActiveMenuId(null);
                                            if (window.confirm(`Permanently delete ${getFullDisplayName(u)}?`)) {
                                              await deleteUser(u.id);
                                              fetchData();
                                            }
                                          }}
                                          className="w-full px-3 py-2 text-rose-500 hover:bg-rose-500/10 flex items-center gap-2"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" /> Delete user
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="py-3 px-6 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400">
              {filteredUsers.length} user{filteredUsers.length !== 1 && 's'}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ── TAB 2: ROLES & PERMISSIONS (Screenshot 5) ── */}
      {/* ==================================================== */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: System Roles Table (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 shadow-sm">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">System roles</h3>
                <p className="text-xs text-slate-400">{roles.length} roles configured</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Permissions</th>
                      <th className="py-2.5 px-3">Users</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {roles.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-400">
                          No roles found
                        </td>
                      </tr>
                    ) : (
                      roles.map((r, idx) => {
                        const isSelected = idx === selectedRoleIndex;
                        return (
                          <tr
                            key={r.name || idx}
                            onClick={() => setSelectedRoleIndex(idx)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-600/10 border-l-2 border-l-blue-500'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                            }`}
                          >
                            {/* Role Icon & Name */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700/60 text-slate-300">
                                  <Shield className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 dark:text-white capitalize truncate">
                                    {r.name.replace(/_/g, ' ')}
                                  </p>
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {r.description || 'System role'}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Permissions */}
                            <td className="py-3 px-3">
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {capabilitiesForRole(r.name).length} capabilities
                              </span>
                            </td>

                            {/* Users count */}
                            <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                              {r.userCount ?? 0}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <Check className="w-3 h-3 stroke-[3]" /> Active
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table pagination */}
              <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                <span>
                  Showing 1–{roles.length} of {roles.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setRolePage(1)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center ${
                      rolePage === 1 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    1
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: what a role grants, and what a person can do */}
          <div className="lg:col-span-5 space-y-6">
            {activeSelectedRole ? (
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 shadow-sm space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">
                      {activeSelectedRole.name.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-xs text-slate-400">{activeSelectedRole.userCount ?? 0} users have this role</p>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {activeSelectedRole.description || 'Controls what people with this role can do.'}
                </p>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    What this role can do
                  </p>
                  {roleCapabilities.length === 0 ? (
                    <p className="text-xs text-slate-400">This role has no capabilities in the system.</p>
                  ) : (
                    <ul className="space-y-2">
                      {roleCapabilities.map((c) => (
                        <li
                          key={c.key}
                          className="flex items-center gap-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200"
                        >
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>{c.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11px] text-slate-400 mt-3">
                    These come with the system. Changing them needs a code change, so they are not edited here.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Permissions for a person</h3>
                <p className="text-xs text-slate-400">
                  Find someone to see what they can do, based on all of their roles, including extra roles.
                </p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                  placeholder="Name or email"
                  aria-label="Search for a person"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-slate-900 dark:text-white"
                />
              </div>

              {permissionSearch.trim() && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {searchingPeople ? (
                    <p className="px-3 py-3 text-xs text-slate-400">Searching…</p>
                  ) : permissionResults.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-slate-400">No one matches that search.</p>
                  ) : (
                    permissionResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setPermissionPerson(u)}
                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                          permissionPerson?.id === u.id ? 'bg-blue-600/10' : ''
                        }`}
                      >
                        <span className="block font-semibold text-slate-900 dark:text-white truncate">
                          {u.fullName || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email}
                        </span>
                        <span className="block text-xs text-slate-400 truncate">{u.email}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {permissionPerson && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {permissionPerson.fullName || permissionPerson.email}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {personRoleNames.map((r) => (
                          <span
                            key={r}
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize bg-blue-600/10 text-blue-400"
                          >
                            {r.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPermissionPerson(null)}
                      className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      Clear
                    </button>
                  </div>

                  {(['Finance', 'Academics', 'Class', 'Administration'] as const).map((group) => (
                    <div key={group}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{group}</p>
                      <ul className="space-y-2">
                        {CAPABILITIES.filter((c) => c.group === group).map((c) => {
                          const allowed = personGranted.has(c.key);
                          return (
                            <li
                              key={c.key}
                              className={`flex items-center justify-between gap-3 text-xs sm:text-sm ${
                                allowed ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'
                              }`}
                            >
                              <span>{c.label}</span>
                              <span
                                className={`shrink-0 text-[11px] font-semibold ${
                                  allowed ? 'text-emerald-500' : 'text-slate-400'
                                }`}
                              >
                                {allowed ? 'Allowed' : 'Not allowed'}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ── TAB 3: ASSIGN ROLES (Screenshot 4) ── */}
      {/* ==================================================== */}
      {activeTab === 'assign' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email or matric number"
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Students List */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a]/40 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4 sm:px-6">Student</th>
                    <th className="py-3.5 px-4">Roles</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {assignLoading ? (
                    <tr>
                      <td colSpan={3} className="py-16 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        <p>Loading students...</p>
                      </td>
                    </tr>
                  ) : assignStudents.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-16 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold text-slate-300">No students found</p>
                      </td>
                    </tr>
                  ) : (
                    assignStudents.map((s) => {
                      const studentRoles = s.roles || ['student'];
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                          <td className="py-3 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700/80">
                                {s.full_name
                                  ? s.full_name
                                      .split(' ')
                                      .map((n) => n[0])
                                      .slice(0, 2)
                                      .join('')
                                      .toUpperCase()
                                  : 'ST'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 dark:text-white truncate">{s.full_name}</p>
                                <p className="text-[11px] text-slate-500 truncate">{maskEmail(s.email)}</p>
                              </div>
                            </div>
                          </td>

                          {/* Assigned Roles Pills */}
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {studentRoles.map((r) => (
                                <span
                                  key={r}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 capitalize"
                                >
                                  {r.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Action Button */}
                          <td className="py-3 px-4 sm:px-6 text-right">
                            <button
                              onClick={() => handleOpenManageRolesModal(s)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              <span>Manage roles</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ── TAB 4: APPROVALS ── */}
      {/* ==================================================== */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {pendingApprovals.length === 0 ? (
            <div className="p-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/40 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2 opacity-80" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">All clear</h3>
              <p className="text-xs text-slate-400 mt-1">
                There are no pending student or staff registrations awaiting approval.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a]/40 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4 sm:px-6">User</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Date Registered</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {pendingApprovals.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-800 font-bold text-xs flex items-center justify-center shrink-0">
                            {getInitials(p)}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{getFullDisplayName(p)}</p>
                            <p className="text-[11px] text-slate-400">{p.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 capitalize text-slate-300">{p.role}</td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4 sm:px-6 text-right space-x-2">
                        <button
                          onClick={() => handleApproveRegistration(p.id, getFullDisplayName(p))}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectRegistration(p.id, getFullDisplayName(p))}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 text-xs font-semibold"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* ── MODAL: ADD NEW USER (Screenshot 2) ── */}
      {/* ==================================================== */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-[#0f172a] border border-slate-800 shadow-2xl p-6 relative">
            <button
              onClick={() => setAddModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-5">
              <h2 className="text-lg font-bold text-white">Add new user</h2>
              <p className="text-xs text-slate-400 mt-0.5">They can sign in with this email and password</p>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* First name & Last name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">First name</label>
                  <input
                    type="text"
                    required
                    placeholder="First name"
                    value={addForm.first_name}
                    onChange={(e) => setAddForm({ ...addForm, first_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Last name</label>
                  <input
                    type="text"
                    required
                    placeholder="Last name"
                    value={addForm.last_name}
                    onChange={(e) => setAddForm({ ...addForm, last_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    maxLength={72}
                    placeholder="At least 6 characters"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">6 to 72 characters</p>
              </div>

              {/* Phone (optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone (optional)</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    placeholder="08012345678"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Role</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="hod">HOD</option>
                  <option value="admin">Admin</option>
                  <option value="delegated_admin">Delegated admin</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-sm flex items-center gap-1.5 transition-all"
                >
                  {addSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Create user</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ── DRAWER: EDIT USER (Screenshot 3) ── */}
      {/* ==================================================== */}
      {editDrawerOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl h-full bg-[#0d1627] border-l border-slate-800 flex flex-col shadow-2xl overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-full bg-blue-600 font-extrabold text-white text-sm flex items-center justify-center shrink-0">
                  {getInitials(selectedUser)}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-tight">{getFullDisplayName(selectedUser)}</h2>
                  <p className="text-xs text-slate-400 capitalize">
                    {selectedUser.role} · {selectedUser.isActive ? 'Active' : 'Suspended'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 space-y-6 flex-1">
              {/* SECTION 1: PERSONAL */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400 mb-3">Personal</p>
                <div className="space-y-4">
                  {/* First name & Last name */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">First name</label>
                      <input
                        type="text"
                        value={editForm.first_name}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Last name</label>
                      <input
                        type="text"
                        value={editForm.last_name}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Phone & Date of birth */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="tel"
                          placeholder="Not provided"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Date of birth</label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="date"
                          value={editForm.dateOfBirth}
                          onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: ROLE AND STUDENT DETAILS */}
              <div className="pt-4 border-t border-slate-800/80">
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400 mb-3">
                  Role and student details
                </p>
                <div className="space-y-4">
                  {/* Role & Level */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Role</label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 capitalize"
                      >
                        <option value="student">Student</option>
                        <option value="lecturer">Lecturer</option>
                        <option value="hod">HOD</option>
                        <option value="admin">Admin</option>
                        <option value="delegated_admin">Delegated admin</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Level</label>
                      <select
                        value={editForm.level}
                        onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Not applicable</option>
                        <option value="100 Level">100 Level</option>
                        <option value="200 Level">200 Level</option>
                        <option value="300 Level">300 Level</option>
                        <option value="400 Level">400 Level</option>
                        <option value="500 Level">500 Level</option>
                      </select>
                    </div>
                  </div>

                  {/* Matric number & Year admitted */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Matric number</label>
                      <input
                        type="text"
                        placeholder="e.g. 19/ENG/COE/001"
                        value={editForm.matricNumber}
                        onChange={(e) => setEditForm({ ...editForm, matricNumber: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Year admitted</label>
                      <input
                        type="text"
                        placeholder="e.g. 2023"
                        value={editForm.yearAdmitted}
                        onChange={(e) => setEditForm({ ...editForm, yearAdmitted: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: DANGER ZONE */}
              <div className="p-4 rounded-xl border border-rose-900/60 bg-rose-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-white">Danger zone</p>
                    <p className="text-[11px] text-slate-400">Suspend blocks sign-in. Delete removes the account.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSuspendUser}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{selectedUser.isActive ? 'Suspend' : 'Reactivate'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteUser}
                    className="px-3 py-1.5 rounded-lg border border-rose-800/80 hover:bg-rose-900/40 text-xs font-semibold text-rose-400 flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Drawer Sticky Footer */}
            <div className="p-4 sm:p-6 border-t border-slate-800 bg-[#0d1627] sticky bottom-0 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditDrawerOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUserChanges}
                disabled={editSubmitting}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-sm flex items-center gap-1.5 transition-all"
              >
                {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Save changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ── MODAL: MANAGE ROLES (Screenshot 4) ── */}
      {/* ==================================================== */}
      {manageRolesModalOpen && manageRolesStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-[#0f172a] border border-slate-800 shadow-2xl p-6 relative">
            <button
              onClick={() => setManageRolesModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-base font-bold text-white mb-4">Manage roles</h2>

            {/* Student Card Header */}
            <div className="p-3.5 rounded-xl bg-[#162038] border border-slate-700/60 flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {manageRolesStudent.full_name
                  ? manageRolesStudent.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'ST'}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white text-sm truncate">{manageRolesStudent.full_name}</p>
                <p className="text-xs text-slate-400 truncate">
                  {manageRolesStudent.matric_number || '—'} · Level {manageRolesStudent.level || '—'} · Student
                </p>
              </div>
            </div>

            {/* Toggles list */}
            <div className="space-y-3">
              {STUDENT_ASSIGNABLE_ROLES.map((r) => {
                const isChecked = studentRoleToggles.has(r.key);
                return (
                  <div
                    key={r.key}
                    onClick={() => toggleStudentRole(r.key)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isChecked
                        ? 'bg-blue-600/10 border-blue-500/80 shadow-sm'
                        : 'bg-[#121c33]/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-white">{r.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{r.description}</p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStudentRole(r.key);
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                        isChecked ? 'bg-blue-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          isChecked ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-5 mt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setManageRolesModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStudentRoles}
                disabled={savingStudentRoles}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-sm flex items-center gap-1.5 transition-all"
              >
                {savingStudentRoles ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Save roles</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ── MODAL: CREATE ROLE ── */}
      {/* ==================================================== */}
      {createRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-[#0f172a] border border-slate-800 shadow-2xl p-6 relative">
            <button
              onClick={() => setCreateRoleModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-base font-bold text-white mb-1">Create role</h2>
            <p className="text-xs text-slate-400 mb-4">Define a new system role for department staff or students.</p>

            <form onSubmit={handleCreateNewRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Role Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lab Technician"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description</label>
                <textarea
                  rows={3}
                  placeholder="Responsibilities and access scope..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-[#162038] border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateRoleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRole}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-sm flex items-center gap-1.5 transition-all"
                >
                  {creatingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Create role</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
