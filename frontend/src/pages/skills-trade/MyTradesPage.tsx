import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';

const mockMyTrades = [
  { id: '1', partner: 'Jane Smith', skillOffered: 'React Development', skillReceived: 'UI Design', status: 'completed' },
];

const MyTradesPage = () => {
  const columns = [
    { key: 'partner', label: 'Trade Partner' },
    { key: 'skillOffered', label: 'Skill Offered' },
    { key: 'skillReceived', label: 'Skill Received' },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Trade History</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review your swap and barter trade logs.
        </p>
      </div>

      <Card>
        <DataTable columns={columns} data={mockMyTrades} />
      </Card>
    </div>
  );
};

export default MyTradesPage;
