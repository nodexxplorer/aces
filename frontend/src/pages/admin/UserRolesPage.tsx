import { useState, useEffect, useCallback } from 'react';
import { getMediaUrl } from '../../api/client';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import DataTable from '../../components/data-display/DataTable';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import {
  Shield,
  Plus,
  Loader2,
  UserCog,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  History,
  Users,
  Wrench,
  UserCheck,
  AlertCircle,
  CheckCircle,
  CheckSquare,
} from 'lucide-react';
import {
  getAllRoles,
  createRole,
  searchStudentsForRoles,
  assignUserRole,
  revokeUserRole,
  getRoleLogsByUser,
} from '../../api/role-management';
import type { Role } from '../../api/role-management';
import { getUsers, approveUser, rejectUser } from '../../api/users';
import { getErrorMessage } from '../../utils/errors';
import type { User, UserRole, RoleAssignmentLog, StudentForRoleManagement } from '../../types';

type Tab = 'roles' | 'assign' | 'approvals';
type BadgeVariantLocal = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'secondary';

const assignableRoles: { value: UserRole; label: string; description: string; color: string }[] = [
  {
    value: 'class_rep',
    label: 'Class Representative',
    description: 'Can track attendance and submit class reports',
    color: 'primary',
  },
  {
    value: 'class_bursar',
    label: 'Class Bursar',
    description: 'Can verify student payments and manage defaulters',
    color: 'success',
  },
  {
    value: 'dept_bursar',
    label: 'Department Bursar',
    description: 'Can manage departmental finances',
    color: 'success',
  },
  {
    value: 'project_coordinator',
    label: 'Project Coordinator',
    description: 'Manage project/thesis groups and milestones',
    color: 'info',
  },
  {
    value: 'event_coordinator',
    label: 'Event Coordinator',
    description: 'Create/manage departmental events and announcements',
    color: 'warning',
  },
  {
    value: 'alumni_rep',
    label: 'Alumni Representative',
    description: 'Moderate alumni groups and approve job posts',
    color: 'info',
  },
  {
    value: 'delegated_admin',
    label: 'Delegated Admin',
    description: 'Can perform admin operations on behalf of HOD',
    color: 'accent',
  },
];

const roleBadgeColor = (role: UserRole): string => {
  const found = assignableRoles.find((r) => r.value === role);
  return found?.color || 'secondary';
};

export default function UserRolesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('roles');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-surface-100 dark:bg-surface-800 rounded-xl">
          <Wrench className="w-6 h-6 text-surface-600 dark:text-surface-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">User Roles</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Manage system roles and assign roles to students.
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-surface-200 dark:border-surface-800 pb-px">
        {[
          { key: 'roles' as Tab, label: 'Roles', icon: Shield },
          { key: 'assign' as Tab, label: 'Assign to Students', icon: Users },
          { key: 'approvals' as Tab, label: 'Approvals', icon: UserCheck },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20'
                : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'roles' && <RolesTab />}
      {activeTab === 'assign' && <AssignTab />}
      {activeTab === 'approvals' && <ApprovalsTab />}
    </div>
  );
}

function RolesTab() {
  const { success } = useNotification();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const data = await getAllRoles();
      setRoles(Array.isArray(data) ? data : data.items || []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName) return;
    try {
      setSubmitting(true);
      await createRole({ name: roleName, description: roleDescription, permissions: [] });
      setCreateOpen(false);
      setRoleName('');
      setRoleDescription('');
      success('Role Created', `New role "${roleName}" has been added`);
      fetchRoles();
    } catch {
      /* silent */
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Role',
      render: (_: unknown, row: Role) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
            <UserCog className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <p className="font-semibold capitalize">{row.name}</p>
            <p className="text-[10px] text-surface-500">{row.description || 'No description'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'permissions',
      label: 'Permissions',
      render: (_: unknown, row: Role) => {
        const perms = row.permissions || [];
        return (
          <div className="flex flex-wrap gap-1">
            {perms.length > 0 ? (
              perms.slice(0, 3).map((p: string) => (
                <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-100 text-surface-600">
                  {p}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-surface-400">Default permissions</span>
            )}
            {perms.length > 3 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-100 text-primary-600">
                +{perms.length - 3} more
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'userCount',
      label: 'Users',
      render: (val: unknown) => <span className="text-sm font-medium">{(val as number) || 0}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (_: unknown, row: Role) => <StatusBadge status={row.isActive !== false ? 'active' : 'suspended'} />,
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          Create New Role
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-500" />
            System Roles
          </CardTitle>
          <CardDescription>
            {roles.length} role{roles.length !== 1 && 's'} configured
          </CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto rounded-lg border border-surface-200 dark:border-surface-700">
            <DataTable columns={columns} data={roles} />
          </div>
        )}
      </Card>
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create New Role">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Role Name"
            placeholder="e.g. Exam Officer"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            required
          />
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
            <textarea
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 h-24"
              placeholder="Brief description of this role's responsibilities..."
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" isLoading={submitting}>
            Create Role
          </Button>
        </form>
      </Modal>
    </>
  );
}

function AssignTab() {
  const { success, error: notifyError } = useNotification();
  const [students, setStudents] = useState<StudentForRoleManagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  const [selectedStudent, setSelectedStudent] = useState<StudentForRoleManagement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Set<UserRole>>(new Set());
  const [originalRoles, setOriginalRoles] = useState<UserRole[]>([]);
  const [logs, setLogs] = useState<RoleAssignmentLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchStudents();
  }, [debouncedSearch, page]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const result = await searchStudentsForRoles({ search: debouncedSearch, page, per_page: perPage });
      setStudents(result.data);
      setTotal(result.total);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  const handleManageRoles = async (student: StudentForRoleManagement) => {
    setSelectedStudent(student);
    setOriginalRoles(student.roles || []);
    setSelectedRoles(new Set(student.roles || []));
    setModalOpen(true);
    setLogsLoading(true);
    try {
      const logsData = await getRoleLogsByUser(student.id, { limit: 10 });
      setLogs(Array.isArray(logsData) ? logsData : []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const toggleRole = (role: UserRole) => {
    if (role === 'student') return;
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      const currentRoles = new Set(originalRoles);
      const desiredRoles = selectedRoles;
      for (const role of desiredRoles) {
        if (!currentRoles.has(role)) await assignUserRole(selectedStudent.id, role);
      }
      for (const role of currentRoles) {
        if (!desiredRoles.has(role) && role !== 'student') await revokeUserRole(selectedStudent.id, role);
      }
      success('Roles Updated', `Roles for ${selectedStudent.full_name} have been updated`);
      setModalOpen(false);
      setSelectedStudent(null);
      fetchStudents();
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not update roles'));
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search by name, email or matric number..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-700">
                <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">STUDENT</th>
                <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">MATRIC NO.</th>
                <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">LEVEL</th>
                <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">ROLES</th>
                <th className="text-right px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>
                    <div className="flex items-center justify-center p-12">
                      <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                      <span className="ml-2 text-sm text-surface-500">Loading students...</span>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="text-center py-12 text-sm text-surface-400">No students found</div>
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr
                    key={student.id}
                    className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                          {student.avatar_url ? (
                            <img
                              src={getMediaUrl(student.avatar_url) ?? undefined}
                              alt=""
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            student.full_name
                              ?.split(' ')
                              .map((n: string) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-surface-900 dark:text-white truncate">{student.full_name}</p>
                          <p className="text-xs text-surface-500 truncate">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-surface-600 dark:text-surface-400">
                        {student.matric_number || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-surface-600 dark:text-surface-400">
                        {student.level ? `${student.level}L` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(student.roles || ['student']).map((role) => (
                          <Badge
                            key={role}
                            variant={role === 'student' ? 'secondary' : (roleBadgeColor(role) as BadgeVariantLocal)}
                          >
                            {role.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="xs"
                        variant="outline"
                        leftIcon={<Shield className="w-3.5 h-3.5" />}
                        onClick={() => handleManageRoles(student)}
                      >
                        Manage Roles
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 dark:border-surface-700">
            <span className="text-xs text-surface-500">
              Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-surface-600 dark:text-surface-400 font-medium">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedStudent(null);
        }}
        title={`Manage Roles: ${selectedStudent?.full_name || ''}`}
      >
        {selectedStudent && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex items-center gap-3 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {selectedStudent.full_name
                  ?.split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-surface-900 dark:text-white">{selectedStudent.full_name}</p>
                <p className="text-xs text-surface-500">
                  {selectedStudent.email} &middot; {selectedStudent.matric_number || 'N/A'} &middot; Level{' '}
                  {selectedStudent.level ? `${selectedStudent.level}L` : 'N/A'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">Roles</p>
              <div className="space-y-3">
                {assignableRoles.map((ar) => {
                  const isChecked = selectedRoles.has(ar.value);
                  return (
                    <label
                      key={ar.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${isChecked ? 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-950/20' : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRole(ar.value)}
                        className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-900 dark:text-white">{ar.label}</p>
                        <p className="text-xs text-surface-500">{ar.description}</p>
                      </div>
                      {isChecked && <Check className="w-4 h-4 text-primary-500 shrink-0" />}
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2">
                <History className="w-4 h-4" /> Role History
              </p>
              {logsLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-xs text-surface-400 text-center py-3">No role history yet</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-2 text-xs p-2 rounded-lg bg-surface-50 dark:bg-surface-800"
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${log.action === 'assigned' ? 'bg-success-500' : 'bg-danger-500'}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-surface-700 dark:text-surface-300">
                          <span className="font-medium capitalize">{log.action}</span>{' '}
                          <Badge
                            variant={log.action === 'assigned' ? 'success' : 'danger'}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {log.role.replace(/_/g, ' ')}
                          </Badge>{' '}
                          by {log.performed_by_name || 'Admin'}
                        </p>
                        <p className="text-surface-400 mt-0.5">{formatTime(log.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-surface-200 dark:border-surface-700">
              <Button
                variant="outline"
                onClick={() => {
                  setModalOpen(false);
                  setSelectedStudent(null);
                }}
              >
                Cancel
              </Button>
              <Button isLoading={saving} onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

const APPROVALS_PAGE_SIZE = 20;

const getDisplayName = (u: Partial<User>) => {
  if (u.fullName) return u.fullName;
  if (u.full_name) return u.full_name;
  if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return u.email || '—';
};

function ApprovalsTab() {
  const { success, error: notifyError } = useNotification();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getUsers({ page: 1, perPage: 200 });
      setUsers(Array.isArray(result) ? result : []);
    } catch {
      notifyError('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pendingUsers = users.filter((u) => !u.isApproved);

  const filteredUsers = pendingUsers.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = getDisplayName(u);
    const matric = u.matricNumber || u.matric_number || '';
    return name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || matric.toLowerCase().includes(q);
  });

  const paginatedUsers = filteredUsers.slice(offset, offset + APPROVALS_PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedUsers.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginatedUsers.map((u) => u.id)));
  };

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      await approveUser(id);
      success('Approved', 'User approved');
      fetchData();
    } catch {
      notifyError('Error', 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModalId || rejectModalId === 'bulk') return;
    if (!rejectReason || rejectReason.length < 3) {
      notifyError('Error', 'Rejection reason must be at least 3 characters');
      return;
    }
    try {
      setActionLoading(rejectModalId);
      await rejectUser(rejectModalId, rejectReason);
      success('Rejected', 'User rejected');
      setRejectModalId(null);
      setRejectReason('');
      fetchData();
    } catch {
      notifyError('Error', 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      setActionLoading('bulk-approve');
      await Promise.all(ids.map((id) => approveUser(id)));
      success('Bulk Approved', `${ids.length} user(s) approved`);
      setSelectedIds(new Set());
      fetchData();
    } catch {
      notifyError('Error', 'Failed to bulk approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkReject = async () => {
    if (!rejectReason || rejectReason.length < 3) {
      notifyError('Error', 'Rejection reason must be at least 3 characters');
      return;
    }
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      setActionLoading('bulk-reject');
      await Promise.all(ids.map((id) => rejectUser(id, rejectReason)));
      success('Bulk Rejected', `${ids.length} user(s) rejected`);
      setSelectedIds(new Set());
      setRejectModalId(null);
      setRejectReason('');
      fetchData();
    } catch {
      notifyError('Error', 'Failed to bulk reject');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-surface-500">Pending</p>
              <p className="text-lg font-bold text-surface-900 dark:text-white">{pendingUsers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-surface-500">Total Users</p>
              <p className="text-lg font-bold text-surface-900 dark:text-white">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-surface-500">Showing</p>
              <p className="text-lg font-bold text-surface-900 dark:text-white">{filteredUsers.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
            <input
              type="text"
              placeholder="Search by name, email, or matric number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-surface-200 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
            <span className="text-xs text-surface-500">{selectedIds.size} selected</span>
            <Button
              size="xs"
              variant="success"
              isLoading={actionLoading === 'bulk-approve'}
              onClick={handleBulkApprove}
            >
              Approve
            </Button>
            <Button
              size="xs"
              variant="danger"
              isLoading={actionLoading === 'bulk-reject'}
              onClick={() => {
                setRejectModalId('bulk');
                setRejectReason('');
              }}
            >
              Reject
            </Button>
          </div>
        )}
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : paginatedUsers.length === 0 ? (
          <div className="text-center py-12">
            <UserCheck className="w-10 h-10 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
            <p className="text-sm text-surface-400">
              {pendingUsers.length === 0 ? 'All users are approved' : 'No users match your search'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="px-3 py-2 text-left">
                    <button onClick={toggleSelectAll}>
                      <CheckSquare className="w-4 h-4 text-surface-400" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-surface-600 dark:text-surface-400">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-surface-600 dark:text-surface-400">Email</th>
                  <th className="px-3 py-2 text-left font-medium text-surface-600 dark:text-surface-400">Role</th>
                  <th className="px-3 py-2 text-left font-medium text-surface-600 dark:text-surface-400">Matric No.</th>
                  <th className="px-3 py-2 text-left font-medium text-surface-600 dark:text-surface-400">Registered</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-600 dark:text-surface-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                    <td className="px-3 py-2">
                      <button onClick={() => toggleSelect(user.id)}>
                        <CheckSquare
                          className={`w-4 h-4 ${selectedIds.has(user.id) ? 'text-primary-500' : 'text-surface-400'}`}
                        />
                      </button>
                    </td>
                    <td className="px-3 py-2 font-medium text-surface-900 dark:text-white">{getDisplayName(user)}</td>
                    <td className="px-3 py-2 text-surface-500 dark:text-surface-400 text-xs">{user.email}</td>
                    <td className="px-3 py-2 text-surface-700 dark:text-surface-300 text-xs capitalize">
                      {user.role || user.activeRole || '—'}
                    </td>
                    <td className="px-3 py-2 text-surface-700 dark:text-surface-300 font-mono text-xs">
                      {user.matricNumber || user.matric_number || '—'}
                    </td>
                    <td className="px-3 py-2 text-surface-500 dark:text-surface-400 text-xs">
                      {formatDate(user.createdAt || (user as unknown as { created_at?: string }).created_at)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="xs"
                          variant="success"
                          isLoading={actionLoading === user.id}
                          onClick={() => handleApprove(user.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          className="text-danger-500 border-danger-300 hover:bg-danger-50"
                          onClick={() => {
                            setRejectModalId(user.id);
                            setRejectReason('');
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 dark:border-surface-700">
              <span className="text-xs text-surface-500">
                Showing {offset + 1}–{Math.min(offset + APPROVALS_PAGE_SIZE, offset + paginatedUsers.length)} of{' '}
                {filteredUsers.length}
              </span>
              <div className="flex gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={offset === 0}
                  onClick={() => setOffset((p) => Math.max(0, p - APPROVALS_PAGE_SIZE))}
                >
                  Prev
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={filteredUsers.length <= APPROVALS_PAGE_SIZE}
                  onClick={() => setOffset((p) => p + APPROVALS_PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {rejectModalId && (
        <Modal
          isOpen={true}
          onClose={() => {
            setRejectModalId(null);
            setRejectReason('');
          }}
          title={rejectModalId === 'bulk' ? 'Reject Selected Users' : 'Reject User'}
        >
          <div className="space-y-4">
            <p className="text-xs text-surface-400">
              Provide a reason for rejection. This will be visible to the user.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              className="w-full px-3 py-2 text-sm border border-surface-200 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRejectModalId(null);
                  setRejectReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                isLoading={actionLoading === rejectModalId}
                onClick={rejectModalId === 'bulk' ? handleBulkReject : handleReject}
              >
                Reject
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
