import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { Shield } from 'lucide-react';

const mockRoles = [
  { id: '1', name: 'John Doe', role: 'Student', assignedDate: '2026-06-20' },
  { id: '2', name: 'Amara Nwachukwu', role: 'Class Rep', assignedDate: '2026-06-19' },
];

const RoleManagementPage = () => {
  const { success } = useNotification();

  const columns = [
    { key: 'name', label: 'User' },
    { key: 'role', label: 'Assigned Role' },
    { key: 'assignedDate', label: 'Assigned Date' },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: any) => (
        <Button size="xs" variant="outline" leftIcon={<Shield className="w-3.5 h-3.5" />} onClick={() => success('Role Updated', 'Updated user role permission context.')}>
          Manage
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Role Permission Registry</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Configure security scopes and access levels.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>Configure user group privileges</CardDescription>
        </CardHeader>
        <DataTable columns={columns} data={mockRoles} />
      </Card>
    </div>
  );
};

export default RoleManagementPage;
