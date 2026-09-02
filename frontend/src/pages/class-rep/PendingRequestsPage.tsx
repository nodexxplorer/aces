import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Tabs from '../../components/ui/Tabs';
import { useNotification } from '../../hooks/useNotification';
import {
  listPendingCourseRegistrations,
  approveCourseRegistration,
  listPendingStudentRegistrations,
  approveStudentRegistration,
} from '../../api/class-rep';
import type { PendingCourseRegistration, PendingStudentRegistration } from '../../api/class-rep';
import { Check, Loader2, RefreshCw, FileText, UserCheck } from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';

type TabKey = 'forms' | 'registrations';

const CourseFormsTab = () => {
  const { success, error: notifyError } = useNotification();
  const [list, setList] = useState<PendingCourseRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      setList(await listPendingCourseRegistrations());
    } catch {
      notifyError('Error', 'Failed to load pending registrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (id: string, name: string) => {
    setApprovingId(id);
    try {
      await approveCourseRegistration(id);
      setList((prev) => prev.filter((item) => item.id !== id));
      success('Registration Approved', `Verified registration for ${name}`);
    } catch (e: unknown) {
      notifyError('Error', getErrorMessage(e, 'Failed to approve registration'));
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forms Verification Queue</CardTitle>
        <CardDescription>
          Verify course form listings before they are processed by academic administration
        </CardDescription>
      </CardHeader>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          <span className="ml-2 text-sm text-surface-500">Loading pending registrations...</span>
        </div>
      ) : list.length === 0 ? (
        <EmptyState title="No pending course registrations to review" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-700">
                <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">STUDENT</th>
                <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">MATRIC NO.</th>
                <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">LEVEL</th>
                <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">COURSES</th>
                <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">SUBMITTED</th>
                <th className="text-right px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {list.map((reg) => (
                <tr
                  key={reg.id}
                  className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{reg.student_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-surface-600 dark:text-surface-400">
                    {reg.matric_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-400">{reg.level} Level</td>
                  <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-400">{reg.courses_count}</td>
                  <td className="px-4 py-3 text-xs text-surface-500">
                    {reg.created_at
                      ? new Date(reg.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="xs"
                      leftIcon={
                        approvingId === reg.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )
                      }
                      onClick={() => handleApprove(reg.id, reg.student_name)}
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
  );
};

const StudentRegistrationsTab = () => {
  const { success, error: notifyError } = useNotification();
  const [list, setList] = useState<PendingStudentRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      setList(await listPendingStudentRegistrations());
    } catch {
      notifyError('Error', 'Failed to load pending student registrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (id: string, name: string) => {
    setApprovingId(id);
    try {
      await approveStudentRegistration(id);
      setList((prev) => prev.filter((item) => item.id !== id));
      success('Student Approved', `${name} now has full access to ACES Zone`);
    } catch (e: unknown) {
      notifyError('Error', getErrorMessage(e, 'Failed to approve student'));
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Registration Queue</CardTitle>
        <CardDescription>New student accounts awaiting approval in your class level</CardDescription>
      </CardHeader>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          <span className="ml-2 text-sm text-surface-500">Loading pending students...</span>
        </div>
      ) : list.length === 0 ? (
        <EmptyState title="No pending student registrations to review" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-700">
                <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">STUDENT</th>
                <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">MATRIC NO.</th>
                <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">LEVEL</th>
                <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">TYPE</th>
                <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">SUBMITTED</th>
                <th className="text-right px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {list.map((reg) => (
                <tr
                  key={reg.id}
                  className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{reg.full_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-surface-600 dark:text-surface-400">
                    {reg.matric_number || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-400">{reg.level} Level</td>
                  <td className="px-4 py-3">
                    <Badge variant={reg.type === 'signup' ? 'primary' : 'warning'}>
                      {reg.type === 'signup' ? 'New Signup' : 'Unapproved Account'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-surface-500">
                    {reg.created_at
                      ? new Date(reg.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="xs"
                      variant="success"
                      leftIcon={
                        approvingId === reg.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )
                      }
                      onClick={() => handleApprove(reg.id, reg.full_name)}
                      disabled={approvingId === reg.id}
                    >
                      {approvingId === reg.id ? 'Approving...' : 'Approve'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

const PendingRequestsPage = () => {
  const [tab, setTab] = useState<TabKey>('forms');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Pending Registrations</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Review course registration forms and approve new student accounts in your class level.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<RefreshCw className="w-4 h-4" />}
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          Refresh
        </Button>
      </div>

      <Tabs
        tabs={[
          { id: 'forms', label: 'Course Forms', icon: <FileText className="w-4 h-4" /> },
          { id: 'registrations', label: 'Student Registrations', icon: <UserCheck className="w-4 h-4" /> },
        ]}
        activeTab={tab}
        onChange={(t) => setTab(t as TabKey)}
      />

      {tab === 'forms' ? (
        <CourseFormsTab key={`forms-${refreshKey}`} />
      ) : (
        <StudentRegistrationsTab key={`reg-${refreshKey}`} />
      )}
    </div>
  );
};

export default PendingRequestsPage;
