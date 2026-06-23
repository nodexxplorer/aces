import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';
import { formatCurrency } from '../../utils/formatters';

const mockClassDues = [
  { id: '1', level: '100 Level', collected: 250000, target: 500000 },
  { id: '2', level: '500 Level', collected: 390000, target: 390000 },
];

const ClassBursarDuesPage = () => {
  const columns = [
    { key: 'level', label: 'Class Level' },
    { key: 'collected', label: 'Total Collected', render: (val: unknown) => formatCurrency(val as number) },
    { key: 'target', label: 'Target Collection', render: (val: unknown) => formatCurrency(val as number) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Class Dues Audit</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review class fees collection statuses and financial metrics.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class Fee Targets</CardTitle>
          <CardDescription>Academic class levels fee metrics</CardDescription>
        </CardHeader>
        <DataTable columns={columns} data={mockClassDues} />
      </Card>
    </div>
  );
};

export default ClassBursarDuesPage;
