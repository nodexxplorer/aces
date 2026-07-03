import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { CheckSquare } from 'lucide-react';

const mockComplaints = [
  { id: '1', studentName: 'John Doe', category: 'Result Issue', message: 'Mistake in EEE 511 CA entry', status: 'pending' },
];

const ComplaintsManagePage = () => {
  const { success } = useNotification();
  const [list, setList] = useState(mockComplaints);

  const handleResolve = (id: string) => {
    setList((prev) => prev.map((c) => c.id === id ? { ...c, status: 'resolved' } : c));
    success('Complaint Resolved', 'Successfully marked ticket as resolved.');
  };

  const columns = [
    { key: 'studentName', label: 'Student' },
    { key: 'category', label: 'Category' },
    { key: 'message', label: 'Complaint Details' },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: any) =>
        row.status === 'pending' ? (
          <Button size="xs" leftIcon={<CheckSquare className="w-3.5 h-3.5" />} onClick={() => handleResolve(row.id)}>
            Resolve
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Student Complaints</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Monitor and resolve tickets filed by students.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Complaints Inbox</CardTitle>
          <CardDescription>Review academic, fee payment or timetable disputes</CardDescription>
        </CardHeader>
        <DataTable columns={columns} data={list} />
      </Card>
    </div>
  );
};

export default ComplaintsManagePage;
