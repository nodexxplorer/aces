import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import { useNotification } from '../../hooks/useNotification';
import { Check } from 'lucide-react';

interface PendingReg {
  id: string;
  name: string;
  matricNumber: string;
  level: number;
  coursesCount: number;
}

const mockPending: PendingReg[] = [
  { id: '1', name: 'Bob Alabi', matricNumber: 'ENG/2021/003', level: 5, coursesCount: 6 },
  { id: '2', name: 'Amara Nwachukwu', matricNumber: 'ENG/2021/014', level: 5, coursesCount: 7 },
];

const PendingRegistrationsPage = () => {
  const { success } = useNotification();
  const [list, setList] = useState<PendingReg[]>(mockPending);

  const handleApprove = async (id: string, name: string) => {
    try {
      await new Promise((r) => setTimeout(r, 800));
      setList((prev) => prev.filter((item) => item.id !== id));
      success('Verification Clear', `Verified registration forms for student ${name}`);
    } catch {
      //
    }
  };

  const columns = [
    { key: 'matricNumber', label: 'Matric Number', sortable: true },
    { key: 'name', label: 'Student Name', sortable: true },
    { key: 'level', label: 'Level', render: (val: unknown) => `${(val as number) * 100} Level` },
    { key: 'coursesCount', label: 'Course Count' },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: PendingReg) => (
        <Button size="xs" leftIcon={<Check className="w-3.5 h-3.5" />} onClick={() => handleApprove(row.id, row.name)}>
          Verify Form
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Pending Registrations</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review and approve class members course registration sheets.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forms Verification Queue</CardTitle>
          <CardDescription>Verify course form listings before submitting to academic administration</CardDescription>
        </CardHeader>
        <DataTable columns={columns} data={list as unknown as Record<string, unknown>[]} />
      </Card>
    </div>
  );
};

export default PendingRegistrationsPage;
