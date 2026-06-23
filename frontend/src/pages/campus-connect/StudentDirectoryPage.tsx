import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { Search, UserPlus } from 'lucide-react';

const mockStudents = [
  { id: '1', name: 'John Doe', level: 5, matricNumber: 'ENG/2021/001' },
  { id: '2', name: 'Jane Smith', level: 5, matricNumber: 'ENG/2021/002' },
];

const StudentDirectoryPage = () => {
  const { success } = useNotification();
  const [search, setSearch] = useState('');

  const columns = [
    { key: 'matricNumber', label: 'Matric' },
    { key: 'name', label: 'Name' },
    { key: 'level', label: 'Level', render: (val: unknown) => `${(val as number) * 100} Level` },
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
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Student Directory</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Browse students across classes, levels, and study groups.
        </p>
      </div>

      <div className="flex gap-4 max-w-xl">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search students..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <DataTable columns={columns} data={mockStudents} />
      </Card>
    </div>
  );
};

export default StudentDirectoryPage;
