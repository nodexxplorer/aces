import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { Check } from 'lucide-react';
import { useState } from 'react';

const PendingApprovalsPage = () => {
  const { success } = useNotification();
  const [list, setList] = useState([
    { id: '1', name: 'Dr. Jane Smith', email: 'janesmith@uniuyo.edu.ng', role: 'Lecturer' },
  ]);

  const handleApprove = (id: string, name: string) => {
    setList((prev) => prev.filter((item) => item.id !== id));
    success('Approved', `Activated account access for ${name}`);
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: any) => (
        <Button size="xs" leftIcon={<Check className="w-3.5 h-3.5" />} onClick={() => handleApprove(row.id, row.name)}>
          Approve User
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Pending Account Approvals</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review signup registrations for academic staff and students.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signups Queue</CardTitle>
          <CardDescription>Accounts waiting for administrator approval</CardDescription>
        </CardHeader>
        <DataTable columns={columns} data={list} />
      </Card>
    </div>
  );
};

export default PendingApprovalsPage;
