import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { Search, UserPlus } from 'lucide-react';

const mockAlumni = [
  { id: '1', name: 'Engr. Victor Udoh', gradYear: 'Class of 2020', company: 'Google' },
];

const AlumniDirectoryPage = () => {
  const { success } = useNotification();
  const [search, setSearch] = useState('');

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'gradYear', label: 'Grad Cohort' },
    { key: 'company', label: 'Company' },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: any) => (
        <Button size="xs" variant="outline" leftIcon={<UserPlus className="w-3.5 h-3.5" />} onClick={() => success('Connection Request Sent', `Dispatched connection request to ${row.name}`)}>
          Connect
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Alumni Directory</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Browse profiles of graduated engineering alumni working globally.
        </p>
      </div>

      <div className="flex gap-4 max-w-xl">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search alumni..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <DataTable columns={columns} data={mockAlumni} />
      </Card>
    </div>
  );
};

export default AlumniDirectoryPage;
