import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { Send } from 'lucide-react';

const mockQueue = [
  { id: '1', name: 'Victor Udoh', matricNumber: 'ENG/2020/004', destination: 'University of Uyo PG school', status: 'pending' },
];

const TranscriptQueuePage = () => {
  const { success } = useNotification();
  const [list, setList] = useState(mockQueue);

  const handleDispatch = (id: string, name: string) => {
    setList((prev) => prev.map((item) => item.id === id ? { ...item, status: 'dispatched' } : item));
    success('Transcript Dispatched', `Officially dispatched transcript documentation for ${name}`);
  };

  const columns = [
    { key: 'matricNumber', label: 'Matric' },
    { key: 'name', label: 'Student' },
    { key: 'destination', label: 'Destination Portal' },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: any) =>
        row.status === 'pending' ? (
          <Button size="xs" leftIcon={<Send className="w-3.5 h-3.5" />} onClick={() => handleDispatch(row.id, row.name)}>
            Dispatch
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Transcript Dispatch Queue</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review PG destination address details and process outgoing transcripts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Official Invoices Pending</CardTitle>
          <CardDescription>Verify student academic status records prior to dispatching files</CardDescription>
        </CardHeader>
        <DataTable columns={columns} data={list} />
      </Card>
    </div>
  );
};

export default TranscriptQueuePage;
