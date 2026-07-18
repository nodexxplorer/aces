import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { getLecturerDashboardStats, createLeaveRequest } from '../../api/lecturers';
import type { LecturerDashboardStats } from '../../api/lecturers';
import { useNotification } from '../../hooks/useNotification';
import { Link } from 'react-router-dom';
import { BookOpen, Users, ClipboardList, Send, Calendar, Loader2 } from 'lucide-react';

const LecturerDashboard = () => {
  const { user } = useAuth();
  const { success, error } = useNotification();
  const [stats, setStats] = useState<LecturerDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'sick', start_date: '', end_date: '', reason: '' });
  const [submittingLeave, setSubmittingLeave] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getLecturerDashboardStats();
        setStats(data);
      } catch {
        error('Load Failed', 'Unable to fetch dashboard statistics.');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [error]);

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason) return;
    setSubmittingLeave(true);
    try {
      await createLeaveRequest(leaveForm);
      success('Leave Submitted', 'Your leave request has been submitted for approval.');
      setLeaveForm({ leave_type: 'sick', start_date: '', end_date: '', reason: '' });
    } catch {
      error('Submission Failed', 'Could not submit leave request. Please try again.');
    } finally {
      setSubmittingLeave(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">
          Lecturer Portal
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Welcome back, {user?.firstName} {user?.lastName}. Manage your academic modules and score registries.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
              <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-xs text-surface-500 dark:text-surface-400">Courses Assigned</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{stats?.courses_assigned ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-success-100 dark:bg-success-900/30">
              <Users className="w-5 h-5 text-success-600 dark:text-success-400" />
            </div>
            <div>
              <p className="text-xs text-surface-500 dark:text-surface-400">Total Students</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{stats?.total_students ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-warning-100 dark:bg-warning-900/30">
              <ClipboardList className="w-5 h-5 text-warning-600 dark:text-warning-400" />
            </div>
            <div>
              <p className="text-xs text-surface-500 dark:text-surface-400">Pending Results</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">0</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>My Modules</CardTitle>
              <CardDescription>Academic units assigned to you for instruction and evaluation</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0 divide-y divide-surface-150 dark:divide-surface-800">
              {stats?.assignments.map((a) => (
                <div key={a.id} className="flex justify-between items-center py-3">
                  <div>
                    <h4 className="font-semibold text-sm text-surface-900 dark:text-white">
                      {a.course_code} &mdash; {a.course_title}
                    </h4>
                    <p className="text-xs text-surface-500">
                      {a.course_unit} Unit{a.course_unit !== 1 ? 's' : ''} &middot; Level {a.level}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link to="/lecturer/scores">
                      <Button size="xs" variant="outline" leftIcon={<ClipboardList className="w-3.5 h-3.5" />}>
                        Enter Grades
                      </Button>
                    </Link>
                    <Link to="/lecturer/class-list">
                      <Button size="xs" variant="outline" leftIcon={<Users className="w-3.5 h-3.5" />}>
                        Class List
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
              {stats?.assignments.length === 0 && (
                <p className="py-4 text-sm text-surface-500 dark:text-surface-400 text-center">
                  No course assignments found.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leave Request</CardTitle>
              <CardDescription>Submit a leave of absence request for administrative approval</CardDescription>
            </CardHeader>
            <form onSubmit={handleLeaveSubmit} className="p-4 pt-0 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Leave Type</label>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm((p) => ({ ...p, leave_type: e.target.value }))}
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-surface-100 p-2 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                >
                  <option value="sick">Sick Leave</option>
                  <option value="annual">Annual Leave</option>
                  <option value="study">Study Leave</option>
                  <option value="compassionate">Compassionate Leave</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Start Date"
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLeaveForm((p) => ({ ...p, start_date: e.target.value }))}
                  required
                />
                <Input
                  label="End Date"
                  type="date"
                  value={leaveForm.end_date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLeaveForm((p) => ({ ...p, end_date: e.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Reason</label>
                <textarea
                  placeholder="Provide a reason for your leave request..."
                  className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-surface-100 p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                  value={leaveForm.reason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))}
                  required
                />
              </div>
              <Button type="submit" isLoading={submittingLeave} leftIcon={<Send className="w-4 h-4" />}>
                Submit Request
              </Button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0 space-y-3">
              <Link to="/lecturer/bulk-upload" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<Calendar className="w-4 h-4" />}>
                  Bulk Upload Grades
                </Button>
              </Link>
              <Link to="/lecturer/assignments" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<ClipboardList className="w-4 h-4" />}>
                  Grading Assignments
                </Button>
              </Link>
              <Link to="/lecturer/class-list" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<Users className="w-4 h-4" />}>
                  View Class List
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LecturerDashboard;
