import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { listPendingCourseRegistrations, approveCourseRegistration } from '../../api/class-rep';
import type { PendingCourseRegistration } from '../../api/class-rep';
import { Check, Loader2, RefreshCw } from 'lucide-react';

const PendingRequestsPage = () => {
  const { success, error: notifyError } = useNotification();
  const [list, setList] = useState<PendingCourseRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await listPendingCourseRegistrations();
      setList(data);
    } catch {
      notifyError('Error', 'Failed to load pending registrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleApprove = async (id: string, name: string) => {
    setApprovingId(id);
    try {
      await approveCourseRegistration(id);
      setList((prev) => prev.filter((item) => item.id !== id));
      success('Registration Approved', `Verified registration for ${name}`);
    } catch {
      notifyError('Error', 'Failed to approve registration');
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Pending Registrations</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Review and approve class members course registration forms.
          </p>
        </div>
        <Button variant="outline" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={fetchData}>
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forms Verification Queue</CardTitle>
          <CardDescription>Verify course form listings before they are processed by academic administration</CardDescription>
        </CardHeader>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading pending registrations...</span>
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-sm text-surface-400">
            No pending course registrations to review
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">STUDENT</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">MATRIC NO.</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">LEVEL</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">COURSES</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">UNITS</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">SUBMITTED</th>
                  <th className="text-right px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {list.map((reg) => (
                  <tr key={reg.id} className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{reg.full_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-surface-600 dark:text-surface-400">{reg.matric_number}</td>
                    <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-400">{reg.level * 100} Level</td>
                    <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-400">{reg.courses_count}</td>
                    <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-400">{reg.total_units} units</td>
                    <td className="px-4 py-3 text-xs text-surface-500">
                      {reg.created_at ? new Date(reg.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="xs"
                        leftIcon={approvingId === reg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        onClick={() => handleApprove(reg.id, reg.full_name)}
                        disabled={approvingId === reg.id}
                      >
                        {approvingId === reg.id ? 'Approving...' : 'Verify Form'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PendingRequestsPage;
