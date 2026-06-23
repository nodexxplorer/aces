import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { Printer, Download } from 'lucide-react';

interface StudentClassRow {
  matricNumber: string;
  name: string;
  level: number;
  duesStatus: 'active' | 'pending';
}

const mockEnrolled: StudentClassRow[] = [
  { matricNumber: 'ENG/2021/001', name: 'John Doe', level: 5, duesStatus: 'active' },
  { matricNumber: 'ENG/2021/002', name: 'Jane Smith', level: 5, duesStatus: 'active' },
  { matricNumber: 'ENG/2021/003', name: 'Bob Alabi', level: 5, duesStatus: 'pending' },
];

const ClassListPage = () => {
  const { success } = useNotification();
  const [course, setCourse] = useState('cpe511');

  const handleExport = () => {
    const csvContent = 'data:text/csv;charset=utf-8,Matric Number,Name,Level,Dues Status\nENG/2021/001,John Doe,5,Cleared\nENG/2021/002,Jane Smith,5,Cleared';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `class_list_${course}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Export Successful', 'Class list downloaded as CSV sheet.');
  };

  const columns = [
    { key: 'matricNumber', label: 'Matric Number', sortable: true },
    { key: 'name', label: 'Student Name', sortable: true },
    { key: 'level', label: 'Level', render: (val: unknown) => `${(val as number) * 100} Level` },
    { key: 'duesStatus', label: 'Dues status', render: (val: unknown) => <StatusBadge status={val === 'active' ? 'active' : 'pending'} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Course Class List</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Browse and export student rosters enrolled in your course modules.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
            Print List
          </Button>
          <Button variant="outline" leftIcon={<Download className="w-4 h-4" />} onClick={handleExport}>
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Enrolled Students</CardTitle>
            <CardDescription>Roster details filtered by course</CardDescription>
          </div>
          <Select
            options={[
              { value: 'cpe511', label: 'CPE 511 (Embedded Systems)' },
              { value: 'cpe513', label: 'CPE 513 (Computer Architecture II)' },
            ]}
            value={course}
            onChange={(e) => setCourse(e.target.value)}
          />
        </CardHeader>
        <DataTable columns={columns} data={mockEnrolled as unknown as Record<string, unknown>[]} />
      </Card>
    </div>
  );
};

export default ClassListPage;
