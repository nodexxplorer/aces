import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { MessageSquare } from 'lucide-react';

const mockConnections = [
  { id: '1', name: 'Dr. Jane Smith', role: 'Lecturer' },
  { id: '2', name: 'John Doe', role: 'Student' },
];

const MyConnectionsPage = () => {
  const { success } = useNotification();

  const columns = [
    { key: 'name', label: 'Contact Name' },
    { key: 'role', label: 'Role' },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: any) => (
        <Button size="xs" variant="outline" leftIcon={<MessageSquare className="w-3.5 h-3.5" />} onClick={() => success('Chat Opened', `Opening messages chat frame with ${row.name}`)}>
          Send Message
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">My Connections</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review approved peer and lecturer connections.
        </p>
      </div>

      <Card>
        <DataTable columns={columns} data={mockConnections} />
      </Card>
    </div>
  );
};

export default MyConnectionsPage;
