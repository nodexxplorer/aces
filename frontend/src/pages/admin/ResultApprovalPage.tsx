import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { Check, X, Loader2 } from 'lucide-react';
import { getAllResults, approveResult } from '../../api/results';

const ResultApprovalPage = () => {
  const { success, error, warning } = useNotification();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const result = await getAllResults({ limit: 200, offset: 0 });
      const items = Array.isArray(result) ? result : (result as any).items || [];
      const pending = items.filter((r: any) => r.status === 'pending');
      setResults(pending);
    } catch (err: any) {
      error('Load Failed', err?.message || 'Could not load results');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, code: string) => {
    try {
      setActionId(id);
      await approveResult(id);
      setResults((prev) => prev.filter((r) => r.id !== id));
      success('Results Approved', `Grade sheet for ${code} has been approved`);
    } catch (err: any) {
      error('Approval Failed', err?.message || 'Could not approve results');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: string, code: string) => {
    try {
      setActionId(id);
      setResults((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'rejected' } : r)));
      warning('Results Rejected', `Returned grade sheet for ${code}`);
    } catch (err: any) {
      error('Rejection Failed', err?.message || 'Could not reject results');
    } finally {
      setActionId(null);
    }
  };

  const columns = [
    {
      key: 'courseCode',
      label: 'Course',
      render: (_: unknown, row: any) => (
        <div>
          <p className="font-semibold">{row.courseCode || row.course?.code || 'N/A'}</p>
          <p className="text-[10px] text-surface-500">{row.courseTitle || row.course?.title || ''}</p>
        </div>
      ),
    },
    { key: 'lecturerName', label: 'Lecturer', render: (_: unknown, row: any) => row.lecturerName || row.approvedBy || 'N/A' },
    { key: 'studentCount', label: 'Enrolled Count', render: (_: unknown, row: any) => row.studentCount || 1 },
    { key: 'createdAt', label: 'Submitted Date', render: (_: unknown, row: any) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : 'N/A' },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: any) =>
        row.status === 'pending' ? (
          <div className="flex gap-2">
            <Button
              size="xs"
              variant="success"
              leftIcon={actionId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              onClick={() => handleApprove(row.id, row.courseCode || 'this course')}
              disabled={actionId === row.id}
            >
              Approve
            </Button>
            <Button
              size="xs"
              variant="outline"
              className="text-danger-500 hover:bg-danger-50"
              leftIcon={<X className="w-3.5 h-3.5" />}
              onClick={() => handleReject(row.id, row.courseCode || 'this course')}
              disabled={actionId === row.id}
            >
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
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading results...</span>
          </div>
        ) : (
          <DataTable columns={columns} data={results as unknown as Record<string, unknown>[]} />
        )}
      </Card>
    </div>
  );
};

export default ResultApprovalPage;
