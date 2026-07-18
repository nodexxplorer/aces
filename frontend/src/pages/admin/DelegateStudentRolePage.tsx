import { useState, useEffect, useCallback } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import {
  Search, Shield, UserPlus, UserMinus, Loader2, ChevronLeft, ChevronRight,
  Clock, Filter, X, Check, History, Users
} from 'lucide-react';
import {
  searchStudentsForRoles, assignUserRole, revokeUserRole,
  getRoleLogsByUser
} from '../../api/role-management';
import type { UserRole, RoleAssignmentLog, StudentForRoleManagement } from '../../types';

const assignableRoles: { value: UserRole; label: string; description: string; color: string }[] = [
  { value: 'class_rep', label: 'Class Representative', description: 'Can track attendance and submit class reports', color: 'primary' },
  { value: 'class_bursar', label: 'Class Bursar', description: 'Can verify student payments and manage defaulters', color: 'success' },
  { value: 'dept_bursar', label: 'Department Bursar', description: 'Can manage departmental finances', color: 'success' },
  { value: 'project_coordinator', label: 'Project Coordinator', description: 'Manage project/thesis groups and milestones', color: 'info' },
  { value: 'event_coordinator', label: 'Event Coordinator', description: 'Create/manage departmental events and announcements', color: 'warning' },
  { value: 'alumni_rep', label: 'Alumni Representative', description: 'Moderate alumni groups and approve job posts', color: 'info' },
  { value: 'delegated_admin', label: 'Delegated Admin', description: 'Can perform admin operations on behalf of HOD', color: 'accent' },
];

const roleBadgeColor = (role: UserRole): string => {
  const found = assignableRoles.find((r) => r.value === role);
  return found?.color || 'secondary';
};

const DelegateStudentRolePage = () => {
  const { success, error: notifyError } = useNotification();

  // Students list state
  const [students, setStudents] = useState<StudentForRoleManagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  // Modal state
  const [selectedStudent, setSelectedStudent] = useState<StudentForRoleManagement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Set<UserRole>>(new Set());
  const [originalRoles, setOriginalRoles] = useState<UserRole[]>([]);

  // Audit log state
  const [logs, setLogs] = useState<RoleAssignmentLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch students when search or page changes
  useEffect(() => {
    fetchStudents();
  }, [debouncedSearch, page]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const result = await searchStudentsForRoles({
        search: debouncedSearch,
        page,
        per_page: perPage,
      });
      setStudents(result.data);
      setTotal(result.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  // Open manage roles modal
  const handleManageRoles = async (student: StudentForRoleManagement) => {
    setSelectedStudent(student);
    setOriginalRoles(student.roles || []);
    setSelectedRoles(new Set(student.roles || []));
    setModalOpen(true);

    // Fetch audit log for this student
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
    if (role === 'student') return; // Can't remove base role
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      const currentRoles = new Set(originalRoles);
      const desiredRoles = selectedRoles;

      // Roles to add
      for (const role of desiredRoles) {
        if (!currentRoles.has(role)) {
          await assignUserRole(selectedStudent.id, role);
        }
      }

      // Roles to remove
      for (const role of currentRoles) {
        if (!desiredRoles.has(role) && role !== 'student') {
          await revokeUserRole(selectedStudent.id, role);
        }
      }

      success('Roles Updated', `Roles for ${selectedStudent.full_name} have been updated`);
      setModalOpen(false);
      setSelectedStudent(null);
      fetchStudents();
    } catch (err: any) {
      notifyError('Failed', err?.response?.data?.error || err?.message || 'Could not update roles');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Delegate Student Roles</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Assign additional roles to students such as class representative or bursar.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search by name, email or matric number..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Students Table */}
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
                  <tr key={student.id} className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                          {student.avatar_url ? (
                            <img src={student.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            student.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-surface-900 dark:text-white truncate">{student.full_name}</p>
                          <p className="text-xs text-surface-500 truncate">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-surface-600 dark:text-surface-400">{student.matric_number || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-surface-600 dark:text-surface-400">{student.level ? `${student.level}L` : 'N/A'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(student.roles || ['student']).map((role) => (
                          <Badge key={role} variant={role === 'student' ? 'secondary' : roleBadgeColor(role) as any}>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 dark:border-surface-700">
            <span className="text-xs text-surface-500">
              Showing {((page - 1) * perPage) + 1}-{Math.min(page * perPage, total)} of {total} students
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-surface-600 dark:text-surface-400 font-medium">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Manage Roles Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedStudent(null); }}
        title={`Manage Roles: ${selectedStudent?.full_name || ''}`}
      >
        {selectedStudent && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {/* Student Info */}
            <div className="flex items-center gap-3 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {selectedStudent.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-surface-900 dark:text-white">{selectedStudent.full_name}</p>
                <p className="text-xs text-surface-500">{selectedStudent.email} &middot; {selectedStudent.matric_number || 'N/A'} &middot; Level {selectedStudent.level ? `${selectedStudent.level}L` : 'N/A'}</p>
              </div>
            </div>

            {/* Current & Available Roles */}
            <div>
              <p className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">Roles</p>
              <div className="space-y-3 ">
                {assignableRoles.map((ar) => {
                  const isChecked = selectedRoles.has(ar.value);
                  const isBase = ar.value === 'student';
                  return (
                    <label
                      key={ar.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        isChecked
                          ? 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-950/20'
                          : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isBase}
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

            {/* Audit Log */}
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
                    <div key={log.id} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-surface-50 dark:bg-surface-800">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${log.action === 'assigned' ? 'bg-success-500' : 'bg-danger-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-surface-700 dark:text-surface-300">
                          <span className="font-medium capitalize">{log.action}</span>{' '}
                          <Badge variant={log.action === 'assigned' ? 'success' : 'danger'} className="text-[10px] px-1.5 py-0">{log.role.replace(/_/g, ' ')}</Badge>{' '}
                          by {log.performed_by_name || 'Admin'}
                        </p>
                        <p className="text-surface-400 mt-0.5">{formatTime(log.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-surface-200 dark:border-surface-700">
              <Button variant="outline" onClick={() => { setModalOpen(false); setSelectedStudent(null); }}>
                Cancel
              </Button>
              <Button isLoading={saving} onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DelegateStudentRolePage;
