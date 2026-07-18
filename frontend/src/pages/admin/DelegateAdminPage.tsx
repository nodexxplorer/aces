import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { UserCog, Loader2, Search, ShieldCheck } from 'lucide-react';
import { getUsers } from '../../api/users';
import { delegateAdmin } from '../../api/role-management';
import type { User } from '../../types';

const getDisplayName = (u: User) => {
  if (u.fullName) return u.fullName;
  if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return u.email;
};

const DelegateAdminPage = () => {
  const { success, error } = useNotification();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const result = await getUsers({ page: 1, perPage: 100 });
      const items = Array.isArray(result) ? result : [];
      setUsers(items.filter((u) => u.role === 'lecturer' || u.role === 'hod'));
    } catch (err: any) {
      error('Load Failed', err?.message || 'Could not load users');
    } finally {
      setLoading(false);
    }
  };

  const filtered = users.filter((u) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const name = getDisplayName(u);
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const handleDelegate = async (userId: string) => {
    try {
      setAssigning(userId);
      await delegateAdmin(userId);
      success('Admin Delegated', 'User has been granted temporary admin privileges');
    } catch (err: any) {
      error('Delegation Failed', err?.message || 'Could not delegate admin privileges');
    } finally {
      setAssigning(null);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (_: unknown, row: User) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center">
            <UserCog className="w-4 h-4 text-surface-500" />
          </div>
          <div>
            <p className="font-semibold">{getDisplayName(row)}</p>
            <p className="text-[10px] text-surface-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', label: 'Role', render: (val: unknown) => <StatusBadge status={val as string} /> },
    {
      key: 'action',
      label: 'Delegate Admin',
      render: (_: unknown, row: User) => (
        <Button
          size="xs"
          variant="outline"
          leftIcon={assigning === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          onClick={() => handleDelegate(row.id)}
          disabled={assigning === row.id}
        >
          Grant Admin
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Delegate Admin Access</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Grant temporary administrative privileges to selected lecturers or staff members.
        </p>
      </div>

      <div className="flex gap-4 max-w-xl">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          options={[
            { value: 'all', label: 'All Roles' },
            { value: 'lecturer', label: 'Lecturers' },
            { value: 'hod', label: 'HOD' },
          ]}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eligible Staff</CardTitle>
          <CardDescription>
            {filtered.length} user{filtered.length !== 1 && 's'} found
          </CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading users...</span>
          </div>
        ) : (
          <DataTable columns={columns} data={filtered as unknown as Record<string, unknown>[]} />
        )}
      </Card>
    </div>
  );
};

export default DelegateAdminPage;
