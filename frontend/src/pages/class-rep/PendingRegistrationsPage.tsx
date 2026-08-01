import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { Check, Loader2 } from 'lucide-react';
import apiClient from '../../api/client';

interface PendingItem {
  id: string;
  user_id?: string;
  name: string;
  matric_number: string;
  email: string;
  level: number;
  type: string;
}

const PendingRegistrationsPage = () => {
  const { success, error: notifyError } = useNotification();
  const [list, setList] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchPending = async () => {
    try {
      const res = await apiClient.get('/class-rep/pending-registrations');
      const data = res.data?.data || res.data || [];
      setList(Array.isArray(data) ? data : []);
    } catch {
      notifyError('Error', 'Failed to load pending registrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleAccept = async (item: PendingItem) => {
    setApprovingId(item.id);
    try {
      await apiClient.post(`/approvals/${item.id}/approve`);
      setList((prev) => prev.filter((i) => i.id !== item.id && i.user_id !== item.id));
      success('Student Accepted', `Accepted registration for ${item.name}`);
    } catch {
      notifyError('Approval Failed', 'Failed to accept student registration');
    } finally {
      setApprovingId(null);
    }
  };

  const columns = [
    { key: 'matric_number', label: 'Matric Number', sortable: true },
    { key: 'name', label: 'Student Name', sortable: true },
    {
      key: 'level',
      label: 'Level',
      render: (val: unknown) => `${val || 400} Level`,
    },
    {
      key: 'type',
      label: 'Registration Type',
      render: (val: unknown) => (
        <Badge variant="warning">{(val as string) || 'User Registration'}</Badge>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: PendingItem) => (
        <Button
          size="xs"
          variant="success"
          isLoading={approvingId === row.id}
          leftIcon={<Check className="w-3.5 h-3.5" />}
          onClick={() => handleAccept(row)}
        >
          Accept
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Pending Registrations</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review and accept newly registered students in your class level.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Level Verification Queue</CardTitle>
          <CardDescription>Accept pending student user registrations for your level</CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading pending list...</span>
          </div>
        ) : (
          <DataTable columns={columns} data={list as unknown as Record<string, unknown>[]} />
        )}
      </Card>
    </div>
  );
};

export default PendingRegistrationsPage;
