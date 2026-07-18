import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import RoleBadge from '../../components/data-display/RoleBadge';
import { useNotification } from '../../hooks/useNotification';
import { Check, X, Loader2 } from 'lucide-react';
import { getUsers, approveUser, rejectUser } from '../../api/users';
import type { User, UserRole } from '../../types';

const getDisplayName = (u: User) => {
  if (u.fullName) return u.fullName;
  if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return u.email;
};

const PendingApprovalsPage = () => {
  const { success, error } = useNotification();
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const result = await getUsers({ page: 1, perPage: 100 });
      const items = Array.isArray(result) ? result : [];
      setPendingUsers(items.filter((u) => !u.isApproved));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      await approveUser(id);
      setPendingUsers((prev) => prev.filter((u) => u.id !== id));
      success('Account Approved', 'User has been granted access');
    } catch {
      error('Approval Failed', 'Could not approve account');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setActionLoading(id);
      await rejectUser(id, 'Registration request rejected by administrator');
      setPendingUsers((prev) => prev.filter((u) => u.id !== id));
      success('Account Rejected', 'Registration request denied');
    } catch {
      error('Rejection Failed', 'Could not reject account');
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (_: unknown, row: User) => (
        <div>
          <p className="font-semibold">{getDisplayName(row)}</p>
          <p className="text-[10px] text-surface-500">{row.email}</p>
        </div>
      ),
    },
    { key: 'role', label: 'Role', render: (val: unknown) => <RoleBadge role={val as UserRole} /> },
    { key: 'status', label: 'Status', render: () => <StatusBadge status="pending" /> },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: User) => {
        const isLoading = actionLoading === row.id;
        return (
          <div className="flex gap-2">
            <Button
              size="xs"
              variant="success"
              leftIcon={isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              onClick={() => handleApprove(row.id)}
              disabled={isLoading}
            >
              Approve
            </Button>
            <Button
              size="xs"
              variant="outline"
              className="text-danger-500 hover:bg-danger-50"
              leftIcon={<X className="w-3.5 h-3.5" />}
              onClick={() => handleReject(row.id)}
              disabled={isLoading}
            >
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  const mapped = pendingUsers.map((u) => ({
    ...u,
    status: 'pending',
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Pending Approvals</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review new user registrations requiring administrative approval before account activation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unapproved Accounts</CardTitle>
          <CardDescription>
            {pendingUsers.length} registration{pendingUsers.length !== 1 && 's'} awaiting review
          </CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading pending approvals...</span>
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="p-8 text-center text-surface-500">
            <p>No pending registrations.</p>
          </div>
        ) : (
          <DataTable columns={columns} data={mapped as unknown as Record<string, unknown>[]} />
        )}
      </Card>
    </div>
  );
};

export default PendingApprovalsPage;
