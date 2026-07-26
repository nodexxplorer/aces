import { useState, useEffect, useCallback } from 'react';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { getUsers, approveUser, rejectUser } from '../../api/users';
import type { User } from '../../types';
import {
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  UserCheck,
  Users,
  AlertCircle,
  CheckSquare,
  XSquare,
} from 'lucide-react';

const PAGE_SIZE = 20;

const getDisplayName = (u: Partial<User>) => {
  if (u.fullName) return u.fullName;
  if (u.full_name) return u.full_name;
  if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return u.email || '—';
};

const PendingApprovalsEnhancedPage = () => {
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
    return (
      name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      ((u as any).matricNumber && (u as any).matricNumber.toLowerCase().includes(q)) ||
      ((u as any).matric_number && (u as any).matric_number.toLowerCase().includes(q))
    );
  });

  const paginatedUsers = filteredUsers.slice(offset, offset + PAGE_SIZE);

  const totalPending = pendingUsers.length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedUsers.map((u) => u.id)));
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      await approveUser(id);
      success('Approved', 'User approved successfully');
      fetchData();
    } catch {
      notifyError('Error', 'Failed to approve user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModalId) return;
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
      notifyError('Error', 'Failed to reject user');
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

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Pending Approvals</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review and approve newly registered users awaiting activation.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Pending Approval</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{totalPending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Total Users</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Showing</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{filteredUsers.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search by name, email, or matric number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-surface-200 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {hasSelection && (
          <div className="mt-4 flex items-center gap-3 pt-4 border-t border-surface-200 dark:border-surface-700">
            <span className="text-sm text-surface-500 dark:text-surface-400">
              {selectedIds.size} selected
            </span>
            <Button
              size="sm"
              variant="success"
              isLoading={actionLoading === 'bulk-approve'}
              leftIcon={actionLoading === 'bulk-approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
              onClick={handleBulkApprove}
            >
              Approve Selected
            </Button>
            <Button
              size="sm"
              variant="danger"
              isLoading={actionLoading === 'bulk-reject'}
              leftIcon={actionLoading === 'bulk-reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XSquare className="w-4 h-4" />}
              onClick={() => setRejectModalId('bulk')}
            >
              Reject Selected
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading approvals...</span>
          </div>
        ) : paginatedUsers.length === 0 ? (
          <div className="text-center py-12">
            <UserCheck className="w-10 h-10 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
            <p className="text-surface-500 dark:text-surface-400">
              {pendingUsers.length === 0
                ? 'No pending approvals — all users are approved'
                : 'No users match your search'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-700">
                    <th className="px-4 py-3 text-left">
                      <button onClick={toggleSelectAll} className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300">
                        {selectedIds.size === paginatedUsers.length && paginatedUsers.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-primary-500" />
                        ) : (
                          <CheckSquare className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">Role</th>
                    <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">Matric No.</th>
                    <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">Registered</th>
                    <th className="px-4 py-3 text-right font-medium text-surface-600 dark:text-surface-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {paginatedUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(user.id)} className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300">
                          {selectedIds.has(user.id) ? (
                            <CheckSquare className="w-4 h-4 text-primary-500" />
                          ) : (
                            <CheckSquare className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">
                        {getDisplayName(user)}
                      </td>
                      <td className="px-4 py-3 text-surface-500 dark:text-surface-400">
                        {user.email}
                      </td>
                      <td className="px-4 py-3 text-surface-700 dark:text-surface-300">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 capitalize">
                          {user.role || user.activeRole || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-700 dark:text-surface-300">
                        {(user as any).matricNumber || (user as any).matric_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-500 dark:text-surface-400">
                        {formatDate(user.createdAt || (user as any).created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="xs"
                            variant="success"
                            isLoading={actionLoading === user.id}
                            leftIcon={actionLoading === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            onClick={() => handleApprove(user.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            className="text-danger-500 border-danger-300 hover:bg-danger-50 dark:border-danger-700 dark:hover:bg-danger-900/20"
                            leftIcon={<XCircle className="w-3.5 h-3.5" />}
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
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 dark:border-surface-700">
              <span className="text-sm text-surface-500 dark:text-surface-400">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, offset + paginatedUsers.length)} of {filteredUsers.length}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={offset === 0}
                  onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={filteredUsers.length <= PAGE_SIZE}
                  onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {rejectModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
              {rejectModalId === 'bulk' ? 'Reject Selected Users' : 'Reject User'}
            </h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
              Provide a reason for rejection. This will be visible to the user.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              className="w-full px-3 py-2 text-sm border border-surface-200 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
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
                onClick={rejectModalId === 'bulk' ? handleBulkReject : async () => {
                  if (!rejectReason || rejectReason.length < 3) {
                    notifyError('Error', 'Rejection reason must be at least 3 characters');
                    return;
                  }
                  await handleReject();
                }}
              >
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingApprovalsEnhancedPage;
