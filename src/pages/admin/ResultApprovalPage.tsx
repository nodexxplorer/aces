import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { Check, X } from 'lucide-react';

interface GradeSheet {
  id: string;
  courseCode: string;
  courseTitle: string;
  lecturerName: string;
  submittedAt: string;
  studentCount: number;
  status: string;
}

const mockSheets: GradeSheet[] = [
  { id: 'sheet-1', courseCode: 'CPE 511', courseTitle: 'Embedded Systems Design', lecturerName: 'Dr. Jane Smith', submittedAt: '2026-06-20', studentCount: 78, status: 'pending' },
  { id: 'sheet-2', courseCode: 'CPE 513', courseTitle: 'Computer Architecture II', lecturerName: 'Dr. John Doe', submittedAt: '2026-06-19', studentCount: 84, status: 'approved' },
];

const ResultApprovalPage = () => {
  const { success, warning } = useNotification();
  const [sheets, setSheets] = useState<GradeSheet[]>(mockSheets);

  const handleApprove = async (id: string, code: string) => {
    try {
      await new Promise((r) => setTimeout(r, 1000));
      setSheets((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'approved' } : s))
      );
      success('Results Approved', `Grade sheet for ${code} has been officially approved and published to student portals.`);
    } catch {
      //
    }
  };

  const handleReject = async (id: string, code: string) => {
    try {
      await new Promise((r) => setTimeout(r, 800));
      setSheets((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'rejected' } : s))
      );
      warning('Results Rejected', `Returned grade sheet for ${code} back to lecturer for remarks.`);
    } catch {
      //
    }
  };

  const columns = [
    { key: 'courseCode', label: 'Course', render: (_: unknown, row: GradeSheet) => <div><p className="font-semibold">{row.courseCode}</p><p className="text-[10px] text-surface-500">{row.courseTitle}</p></div> },
    { key: 'lecturerName', label: 'Lecturer' },
    { key: 'studentCount', label: 'Enrolled Count' },
    { key: 'submittedAt', label: 'Submitted Date' },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: GradeSheet) =>
        row.status === 'pending' ? (
          <div className="flex gap-2">
            <Button size="xs" variant="success" leftIcon={<Check className="w-3.5 h-3.5" />} onClick={() => handleApprove(row.id, row.courseCode)}>
              Approve
            </Button>
            <Button size="xs" variant="outline" className="text-danger-500 hover:bg-danger-50" leftIcon={<X className="w-3.5 h-3.5" />} onClick={() => handleReject(row.id, row.courseCode)}>
              Reject
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Results Approval</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review and approve semester course continuous assessment and exam grade sheets.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lecturer Grade Sheet Submissions</CardTitle>
          <CardDescription>Verify class scores before publishing official results</CardDescription>
        </CardHeader>
        <DataTable columns={columns} data={sheets as unknown as Record<string, unknown>[]} />
      </Card>
    </div>
  );
};

export default ResultApprovalPage;
