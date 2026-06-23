import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import RoleBadge from '../../components/data-display/RoleBadge';
import { useNotification } from '../../hooks/useNotification';
import { Search, UserCheck, ShieldAlert, KeyRound } from 'lucide-react';
import type { UserRole } from '../../types';

interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
  idNumber: string;
}

const mockUsers: DirectoryUser[] = [
  { id: 'u-1', name: 'Dr. Jane Smith', email: 'janesmith@uniuyo.edu.ng', role: 'lecturer', status: 'pending', idNumber: 'ENG/LEC/001' },
  { id: 'u-2', name: 'John Doe', email: 'john@student.com', role: 'student', status: 'active', idNumber: 'ENG/2021/001' },
];

const UserDirectoryPage = () => {
  const { success } = useNotification();
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<DirectoryUser[]>(mockUsers);

  const filtered = users.filter((u) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const handleApprove = async (id: string, name: string) => {
    try {
      await new Promise((r) => setTimeout(r, 800));
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: 'active' } : u))
      );
      success('User Approved', `Successfully activated account for ${name}`);
    } catch {
      //
    }
  };

  const handleSuspend = async (id: string, name: string) => {
    try {
      await new Promise((r) => setTimeout(r, 800));
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: 'suspended' } : u))
      );
      success('User Suspended', `Suspended account access for ${name}`);
    } catch {
      //
    }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (_: unknown, row: DirectoryUser) => <div><p className="font-semibold">{row.name}</p><p className="text-[10px] text-surface-500">{row.email}</p></div> },
    { key: 'idNumber', label: 'Matric / Staff ID' },
    { key: 'role', label: 'Role', render: (val: unknown) => <RoleBadge role={val as UserRole} /> },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
    {
      key: 'action',
      label: 'Actions',
      render: (_: unknown, row: DirectoryUser) => (
        <div className="flex gap-2">
          {row.status === 'pending' && (
            <Button size="xs" variant="success" leftIcon={<UserCheck className="w-3.5 h-3.5" />} onClick={() => handleApprove(row.id, row.name)}>
              Approve
            </Button>
          )}
          {row.status === 'active' && (
            <Button size="xs" variant="outline" className="text-danger-500 hover:bg-danger-50" leftIcon={<ShieldAlert className="w-3.5 h-3.5" />} onClick={() => handleSuspend(row.id, row.name)}>
              Suspend
            </Button>
          )}
          <Button size="xs" variant="outline" leftIcon={<KeyRound className="w-3.5 h-3.5" />} onClick={() => success('Password Reset', `Temporary password sent to ${row.email}`)}>
            Reset
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">User Directory</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review, approve and manage system access settings for all department users.
        </p>
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
          ]}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        />
      </div>

      <Card>
        <DataTable columns={columns} data={filtered as unknown as Record<string, unknown>[]} />
      </Card>
    </div>
  );
};

export default UserDirectoryPage;
