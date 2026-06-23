import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';

const mockNetwork = [
  { id: '1', name: 'Engr. Victor Udoh', classOf: '2020', role: 'Hardware Architect at Google' },
];

const AlumniNetworkPage = () => {
  const columns = [
    { key: 'name', label: 'Alumnus Name' },
    { key: 'classOf', label: 'Graduation Class' },
    { key: 'role', label: 'Position / Industry' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Alumni Network Directory</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Stay in touch with departmental graduates.
        </p>
      </div>

      <Card>
        <DataTable columns={columns} data={mockNetwork} />
      </Card>
    </div>
  );
};

export default AlumniNetworkPage;
