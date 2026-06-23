import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';
import { formatCurrency } from '../../utils/formatters';

const mockDeptDues = [
  { id: '1', purpose: 'Department Dues (2025/2026)', collected: 1500000, target: 2000000 },
];

const DeptBursarDuesPage = () => {
  const columns = [
    { key: 'purpose', label: 'Dues Category' },
    { key: 'collected', label: 'Collected Amount', render: (val: unknown) => formatCurrency(val as number) },
    { key: 'target', label: 'Expected Total', render: (val: unknown) => formatCurrency(val as number) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Department Dues Audit</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review general department association dues collection progress.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Association Dues Logs</CardTitle>
          <CardDescription>Department dues target collections</CardDescription>
        </CardHeader>
        <DataTable columns={columns} data={mockDeptDues} />
      </Card>
    </div>
  );
};

export default DeptBursarDuesPage;
