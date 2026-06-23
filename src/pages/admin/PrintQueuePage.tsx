import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { Printer, X, Check } from 'lucide-react';

interface PrintJob {
  id: string;
  studentName: string;
  matricNumber: string;
  fileName: string;
  status: string;
  createdAt: string;
}

const mockJobs: PrintJob[] = [
  { id: 'job-1', studentName: 'John Doe', matricNumber: 'ENG/2021/001', fileName: 'CPE 511 Laboratory Workbook.pdf', status: 'queued', createdAt: '2026-06-20 12:00' },
  { id: 'job-2', studentName: 'Jane Smith', matricNumber: 'ENG/2021/002', fileName: 'CPE 513 Lecture Notes.pdf', status: 'printed', createdAt: '2026-06-20 11:30' },
];

const PrintQueuePage = () => {
  const { success } = useNotification();
  const [jobs, setJobs] = useState<PrintJob[]>(mockJobs);

  const handlePrint = async (id: string, name: string) => {
    try {
      await new Promise((r) => setTimeout(r, 1200));
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, status: 'printed' } : j))
      );
      success('Job Printed', `Finished printing order for ${name}`);
    } catch {
      //
    }
  };

  const handleCancel = async (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    success('Job Cancelled', 'Print slot removed.');
  };

  const columns = [
    { key: 'fileName', label: 'File Target', render: (val: unknown) => <span className="font-semibold">{val as string}</span> },
    { key: 'studentName', label: 'Student', render: (_: unknown, row: PrintJob) => <div><p className="font-semibold">{row.studentName}</p><p className="text-[10px] text-surface-500">{row.matricNumber}</p></div> },
    { key: 'createdAt', label: 'Time Queued' },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
    {
      key: 'action',
      label: 'Actions',
      render: (_: unknown, row: PrintJob) =>
        row.status === 'queued' ? (
          <div className="flex gap-2">
            <Button size="xs" variant="success" leftIcon={<Printer className="w-3.5 h-3.5" />} onClick={() => handlePrint(row.id, row.studentName)}>
              Print
            </Button>
            <Button size="xs" variant="outline" className="text-danger-500" leftIcon={<X className="w-3.5 h-3.5" />} onClick={() => handleCancel(row.id)}>
              Cancel
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Print Queue Hub</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Monitor manual workbook files sent to department physical printer.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Physical Printing Orders</CardTitle>
          <CardDescription>Release print locks after verifying dues clearance</CardDescription>
        </CardHeader>
        <DataTable columns={columns} data={jobs as unknown as Record<string, unknown>[]} />
      </Card>
    </div>
  );
};

export default PrintQueuePage;
