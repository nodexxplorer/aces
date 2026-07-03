import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { GraduationCap } from 'lucide-react';

const mockSeniors = [
  { id: '1', name: 'Victor Udoh', matricNumber: 'ENG/2020/004', cgpa: 4.62, status: 'cleared' },
  { id: '2', name: 'John Doe', matricNumber: 'ENG/2021/001', cgpa: 3.42, status: 'uncleared' },
];

const GraduationCheckPage = () => {
  const { success } = useNotification();
  const [list, setList] = useState(mockSeniors);

  const handleClearGraduation = (id: string, name: string) => {
    setList((prev) => prev.map((s) => s.id === id ? { ...s, status: 'cleared' } : s));
    success('Student Cleared', `Successfully marked ${name} as cleared for graduation.`);
  };

  const columns = [
    { key: 'matricNumber', label: 'Matric' },
    { key: 'name', label: 'Student' },
    { key: 'cgpa', label: 'Final CGPA', render: (val: unknown) => (val as number).toFixed(2) },
    { key: 'status', label: 'Grad Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: any) =>
        row.status === 'uncleared' ? (
          <Button size="xs" leftIcon={<GraduationCap className="w-3.5 h-3.5" />} onClick={() => handleClearGraduation(row.id, row.name)}>
            Clear Student
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Graduation Clearance</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Perform degree audits and final CGPA checks.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Final Year Roster Check</CardTitle>
          <CardDescription>Verify overall course completion and credits earned</CardDescription>
        </CardHeader>
        <DataTable columns={columns} data={list} />
      </Card>
    </div>
  );
};

export default GraduationCheckPage;
