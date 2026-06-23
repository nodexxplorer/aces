import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';

const mockClassList = [
  { id: '1', name: 'John Doe', matricNumber: 'ENG/2021/001', role: 'Student' },
  { id: '2', name: 'Jane Smith', matricNumber: 'ENG/2021/002', role: 'Student' },
];

const ClassListPage = () => {
  const columns = [
    { key: 'matricNumber', label: 'Matric Number', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'role', label: 'Role' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Class List Directory</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Browse students registered in your class level.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class Members</CardTitle>
          <CardDescription>Roster of students under your level coordination</CardDescription>
        </CardHeader>
        <DataTable columns={columns} data={mockClassList} />
      </Card>
    </div>
  );
};

export default ClassListPage;
