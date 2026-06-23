import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { Check } from 'lucide-react';

const mockAlumni = [
  { id: '1', name: 'Engr. Victor Udoh', gradYear: 'Class of 2020', role: 'Hardware Architect', status: 'pending' },
];

const AlumniManagementPage = () => {
  const { success } = useNotification();
  const [list, setList] = useState(mockAlumni);

  const handleVerify = (id: string, name: string) => {
    setList((prev) => prev.map((a) => a.id === id ? { ...a, status: 'verified' } : a));
    success('Alumni Verified', `${name} profile is now officially marked with verification badges.`);
  };

  const columns = [
    { key: 'name', label: 'Alumni Name' },
    { key: 'gradYear', label: 'Graduation Cohort' },
    { key: 'role', label: 'Domain/Title' },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: any) =>
        row.status === 'pending' ? (
          <Button size="xs" leftIcon={<Check className="w-3.5 h-3.5" />} onClick={() => handleVerify(row.id, row.name)}>
            Verify Account
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Alumni Registry Verification</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review credentials of graduated students applying to join the network.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verification Queue</CardTitle>
          <CardDescription>Accounts waiting for degree validation</CardDescription>
        </CardHeader>
        <DataTable columns={columns} data={list} />
      </Card>
    </div>
  );
};

export default AlumniManagementPage;
