import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { getMyPracticalEnrollments } from '../../api/manuals';
import { useNotification } from '../../hooks/useNotification';
import { Loader2, ClipboardList } from 'lucide-react';
import type { PracticalEnrollment } from '../../api/manuals';

const PracticalDetailsPage = () => {
  const { error: notifyError } = useNotification();
  const [enrollments, setEnrollments] = useState<PracticalEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEnrollments();
  }, []);

  const fetchEnrollments = async () => {
    try {
      setLoading(true);
      const data = await getMyPracticalEnrollments();
      setEnrollments(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      key: 'course_code',
      label: 'Course',
      render: (_: unknown, row: PracticalEnrollment) => (
        <div>
          <p className="font-semibold">{row.course_code}</p>
          <p className="text-[10px] text-surface-500">{row.course_title}</p>
        </div>
      ),
    },
    {
      key: 'enrolled_via',
      label: 'Enrolled Via',
      render: (val: unknown) => <StatusBadge status={String(val || 'unknown')} />,
    },
    {
      key: 'enrolled_at',
      label: 'Enrolled At',
      render: (val: unknown) => val ? new Date(val as string).toLocaleDateString() : 'N/A',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Practicals & Labs</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Your enrolled practical courses and lab sessions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary-500" />
            My Practical Enrollments
          </CardTitle>
          <CardDescription>Courses you are enrolled in via QR scan or manual enrollment</CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading...</span>
          </div>
        ) : enrollments.length === 0 ? (
          <div className="p-8 text-center text-surface-500">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-surface-300" />
            <p>No practical enrollments found.</p>
            <p className="text-xs text-surface-400 mt-1">Purchase a manual and scan the QR code to enroll.</p>
          </div>
        ) : (
          <DataTable columns={columns as any} data={enrollments as unknown as Record<string, unknown>[]} />
        )}
      </Card>
    </div>
  );
};

export default PracticalDetailsPage;
