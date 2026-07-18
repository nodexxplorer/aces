import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import RoleBadge from '../../components/data-display/RoleBadge';
import StatusBadge from '../../components/data-display/StatusBadge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useNotification } from '../../hooks/useNotification';
import { Shield, Plus, Loader2, Trash2, UserCog } from 'lucide-react';
import { getAllRoles, createRole } from '../../api/role-management';
import type { UserRole } from '../../types';

const RoleManagementPage = () => {
  const { success } = useNotification();
  const [roles, setRoles] = useState<any[]>([]);
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
      const items = Array.isArray(data) ? data : (data as any).items || [];
      setRoles(items);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName) return;
    try {
      setSubmitting(true);
      await createRole({ name: roleName, description: roleDescription, permissions: [] } as any);
      setCreateOpen(false);
      setRoleName('');
      setRoleDescription('');
      success('Role Created', `New role "${roleName}" has been added`);
      fetchRoles();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Role',
      render: (_: unknown, row: any) => (
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
      render: (_: unknown, row: any) => {
        const perms = row.permissions || [];
        return (
          <div className="flex flex-wrap gap-1">
            {perms.length > 0 ? perms.slice(0, 3).map((p: string) => (
              <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-100 text-surface-600">
                {p}
              </span>
            )) : (
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
      render: (val: unknown) => (
        <span className="text-sm font-medium">{(val as number) || 0}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_: unknown, row: any) => (
        <StatusBadge status={row.isActive !== false ? 'active' : 'suspended'} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Role Management</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Create and manage user roles with specific permission sets across the system.
          </p>
        </div>
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
            {roles.length} role{roles.length !== 1 && 's'} configured in the system
          </CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading roles...</span>
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
    </div>
  );
};

export default RoleManagementPage;
