import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import { useNotification } from '../../hooks/useNotification';
import { Send, Download } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface Defaulter {
  id: string;
  name: string;
  matricNumber: string;
  level: number;
  outstandingBalance: number;
}

const mockDefaulters: Defaulter[] = [
  { id: '1', name: 'Bob Alabi', matricNumber: 'ENG/2021/003', level: 5, outstandingBalance: 5000 },
  { id: '2', name: 'Victor Udoh', matricNumber: 'ENG/2021/018', level: 5, outstandingBalance: 15000 },
];

const DefaultersPage = () => {
  const { success } = useNotification();
  const [level, setLevel] = useState('5');
  const [list, setList] = useState<Defaulter[]>(mockDefaulters);

  const handleReminder = async (name: string) => {
    try {
      await new Promise((r) => setTimeout(r, 800));
      success('Reminder Dispatched', `Sent direct push notification reminder to ${name} to clear their outstanding balance.`);
    } catch {
      //
    }
  };

  const columns = [
    { key: 'matricNumber', label: 'Matric Number', sortable: true },
    { key: 'name', label: 'Student Name', sortable: true },
    { key: 'level', label: 'Level', render: (val: unknown) => `${(val as number) * 100} Level` },
    { key: 'outstandingBalance', label: 'Dues Outstanding', render: (val: unknown) => formatCurrency(val as number) },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: Defaulter) => (
        <Button size="xs" variant="outline" leftIcon={<Send className="w-3.5 h-3.5" />} onClick={() => handleReminder(row.name)}>
          Remind
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Dues Defaulters List</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Track and contact students with unpaid association and class dues.
          </p>
        </div>
        <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>
          Export Defaulters Sheet
        </Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Defaulter Registry</CardTitle>
            <CardDescription>Roster details filtered by level</CardDescription>
          </div>
          <Select
            options={[
              { value: '1', label: '100 Level' },
              { value: '2', label: '200 Level' },
              { value: '3', label: '300 Level' },
              { value: '4', label: '400 Level' },
              { value: '5', label: '500 Level' },
            ]}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
        </CardHeader>
        <DataTable columns={columns} data={list as unknown as Record<string, unknown>[]} />
      </Card>
    </div>
  );
};

export default DefaultersPage;
