import { useState, useEffect, useCallback } from 'react';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import {
  listStudentOnboardings,
  getOnboardingCounts,
  updateOnboardingStatus,
  bulkApproveOnboardings,
  listUnverifiedStudents,
  type StudentOnboarding,
} from '../../api/verification-announcements';
import { getUsers, approveUser, rejectUser } from '../../api/users';
import {
  CheckCircle,
  XCircle,
  Filter,
  Search,
  Loader2,
  UserCheck,
  Users,
  AlertCircle,
  ChevronDown,
  CheckSquare,
  XSquare,
} from 'lucide-react';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';
const PAGE_SIZE = 20;

const PendingApprovalsEnhancedPage = () => {
  const { success, error: notifyError } = useNotification();

  const [onboardings, setOnboardings] = useState<StudentOnboarding[]>([]);
  const [unverifiedCount, setUnverifiedCount] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [levelFilter, setLevelFilter] = useState<number | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [levelDropdownOpen, setLevelDropdownOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: string; level?: number; limit: number; offset: number } = {
        limit: PAGE_SIZE,
        offset,
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (levelFilter !== '') params.level = levelFilter;

      const [onboardingsResult, countsResult, unverifiedResult] = await Promise.all([
        listStudentOnboardings(params),
        getOnboardingCounts(),
        listUnverifiedStudents(),
      ]);

      setOnboardings(Array.isArray(onboardingsResult) ? onboardingsResult : []);
      setUnverifiedCount(Array.isArray(unverifiedResult) ? unverifiedResult.length : 0);

      const countMap: Record<string, number> = {};
      if (Array.isArray(countsResult)) {
        countsResult.forEach((c) => {
          countMap[c.status] = c.count;
        });
      }
      setCounts(countMap);
    } catch {
      notifyError('Error', 'Failed to load approvals data');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, levelFilter, offset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setOffset(0);
    setSelectedIds(new Set());
  }, [statusFilter, levelFilter]);

  const filteredOnboardings = onboardings.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (o.verified_name && o.verified_name.toLowerCase().includes(q)) ||
      o.matric_number.toLowerCase().includes(q) ||
      (o.submitted_email && o.submitted_email.toLowerCase().includes(q))
    );
  });

  const totalPending = counts['pending'] || 0;
  const totalApproved = counts['approved'] || 0;
  const totalRejected = counts['rejected'] || 0;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOnboardings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOnboardings.map((o) => o.id)));
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      await updateOnboardingStatus(id, { status: 'approved' });
      success('Approved', 'Student onboarding approved');
      fetchData();
    } catch {
      notifyError('Error', 'Failed to approve');
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
      await updateOnboardingStatus(rejectModalId, { status: 'rejected', rejection_reason: rejectReason });
      success('Rejected', 'Student onboarding rejected');
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
      await bulkApproveOnboardings(ids);
      success('Bulk Approved', `${ids.length} student(s) approved`);
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
      await Promise.all(ids.map((id) => updateOnboardingStatus(id, { status: 'rejected', rejection_reason: rejectReason })));
      success('Bulk Rejected', `${ids.length} student(s) rejected`);
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

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const statusBadgeClass = (status: string) => {
    if (status === 'approved') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (status === 'rejected') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Pending Approvals</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review and manage student onboarding approvals with verification data.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Pending</p>
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
              <p className="text-sm text-surface-500 dark:text-surface-400">Approved</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{totalApproved}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Rejected</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{totalRejected}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Unverified</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{unverifiedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex gap-1 bg-surface-100 dark:bg-surface-700 rounded-lg p-1">
            {(['pending', 'approved', 'rejected', 'all'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  statusFilter === s
                    ? 'bg-white dark:bg-surface-600 text-surface-900 dark:text-white shadow-sm'
                    : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className="relative">
            <button
              onClick={() => setLevelDropdownOpen(!levelDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-surface-200 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-600"
            >
              <Filter className="w-4 h-4" />
              Level: {levelFilter === '' ? 'All' : levelFilter}
              <ChevronDown className="w-4 h-4" />
            </button>
            {levelDropdownOpen && (
              <div className="absolute z-10 mt-1 w-40 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg shadow-lg">
                {[100, 200, 300, 400, 500].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => {
                      setLevelFilter(lvl);
                      setLevelDropdownOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-600"
                  >
                    Level {lvl}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setLevelFilter('');
                    setLevelDropdownOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-600 border-t border-surface-200 dark:border-surface-600"
                >
                  All Levels
                </button>
              </div>
            )}
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search by name, matric number, or email..."
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
        ) : filteredOnboardings.length === 0 ? (
          <div className="text-center py-12">
            <UserCheck className="w-10 h-10 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
            <p className="text-surface-500 dark:text-surface-400">No onboarding records found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-700">
                    <th className="px-4 py-3 text-left">
                      <button onClick={toggleSelectAll} className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300">
                        {selectedIds.size === filteredOnboardings.length && filteredOnboardings.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-primary-500" />
                        ) : (
                          <CheckSquare className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">Matric No.</th>
                    <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">Level</th>
                    <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">Submitted</th>
                    <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-surface-600 dark:text-surface-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {filteredOnboardings.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(item.id)} className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300">
                          {selectedIds.has(item.id) ? (
                            <CheckSquare className="w-4 h-4 text-primary-500" />
                          ) : (
                            <CheckSquare className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">
                        {item.verified_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-700 dark:text-surface-300">
                        {item.matric_number}
                      </td>
                      <td className="px-4 py-3 text-surface-700 dark:text-surface-300">
                        {item.verified_level || '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-500 dark:text-surface-400">
                        {item.submitted_email || '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-500 dark:text-surface-400">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadgeClass(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="xs"
                              variant="success"
                              isLoading={actionLoading === item.id}
                              leftIcon={actionLoading === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              onClick={() => handleApprove(item.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              className="text-danger-500 border-danger-300 hover:bg-danger-50 dark:border-danger-700 dark:hover:bg-danger-900/20"
                              leftIcon={<XCircle className="w-3.5 h-3.5" />}
                              onClick={() => {
                                setRejectModalId(item.id);
                                setRejectReason('');
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-surface-400">
                            {item.rejection_reason || 'No reason'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 dark:border-surface-700">
              <span className="text-sm text-surface-500 dark:text-surface-400">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, offset + filteredOnboardings.length)} of {filteredOnboardings.length}
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
                  disabled={filteredOnboardings.length < PAGE_SIZE}
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
              {rejectModalId === 'bulk' ? 'Reject Selected Students' : 'Reject Student'}
            </h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
              Provide a reason for rejection. This will be visible to the student.
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
