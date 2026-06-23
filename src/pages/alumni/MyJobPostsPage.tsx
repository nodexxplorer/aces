import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import { useNotification } from '../../hooks/useNotification';
import { Trash2 } from 'lucide-react';

const mockMyJobs = [
  { id: '1', title: 'Junior Embedded Systems Engineer', company: 'Verve Technologies', location: 'Lagos' },
];

const MyJobPostsPage = () => {
  const { success } = useNotification();
  const [list, setList] = useState(mockMyJobs);

  const handleDelete = (id: string) => {
    setList((prev) => prev.filter((j) => j.id !== id));
    success('Listing Archived', 'Successfully removed job posting.');
  };

  const columns = [
    { key: 'title', label: 'Job Title' },
    { key: 'company', label: 'Company' },
    { key: 'location', label: 'Location' },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: any) => (
        <Button size="xs" variant="outline" className="text-danger-500 hover:bg-danger-50" leftIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDelete(row.id)}>
          Archive Listing
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">My Job Referral Listings</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review and edit job roles you posted on the career board.
        </p>
      </div>

      <Card>
        <DataTable columns={columns} data={list} />
      </Card>
    </div>
  );
};

export default MyJobPostsPage;
