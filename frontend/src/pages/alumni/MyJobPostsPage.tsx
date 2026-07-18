import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { Trash2, Users, Eye } from 'lucide-react';
import { listUserJobPosts, listJobApplications, updateJobApplicationStatus } from '../../api/alumni';
import type { JobPost, JobApplication } from '../../types';

const extractId = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (v.String) return v.String;
  return String(v);
};

const MyJobPostsPage = () => {
  const { success, error: notifyError } = useNotification();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    listUserJobPosts(user.id)
      .then((data) => setJobs(Array.isArray(data) ? data : []))
      .catch(() => notifyError('Error', 'Failed to load your job posts'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleDelete = async (jobId: string) => {
    if (!confirm('Remove this job listing?')) return;
    try {
      const { default: apiClient } = await import('../../api/client');
      await apiClient.delete(`/alumni/jobs/${jobId}`);
      setJobs((prev) => prev.filter((j: any) => extractId(j.id) !== jobId));
      success('Archived', 'Job post removed from listings');
    } catch (err: any) {
      notifyError('Error', err?.response?.data?.error || 'Failed to delete');
    }
  };

  const handleViewApps = async (job: any) => {
    setSelectedJob(job);
    setLoadingApps(true);
    try {
      const data = await listJobApplications(extractId(job.id));
      setApplications(Array.isArray(data) ? data : []);
    } catch {
      setApplications([]);
    } finally {
      setLoadingApps(false);
    }
  };

  const handleAppStatus = async (appId: string, status: string) => {
    try {
      await updateJobApplicationStatus(appId, status);
      setApplications((prev) => prev.map((a: any) => extractId(a.id) === appId ? { ...a, status } : a));
      success('Updated', `Application marked as ${status}`);
    } catch (err: any) {
      notifyError('Error', err?.response?.data?.error || 'Failed to update');
    }
  };

  const statusColors: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-800', reviewed: 'bg-blue-100 text-blue-800', shortlisted: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', hired: 'bg-emerald-100 text-emerald-800' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">My Job Posts</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Manage job listings you've posted on the board</p>
      </div>

      {loading ? (
        <Card><div className="p-12 text-center text-sm text-surface-500">Loading your posts...</div></Card>
      ) : jobs.length === 0 ? (
        <Card><div className="p-12 text-center text-sm text-surface-400">You haven't posted any jobs yet</div></Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: any) => (
            <Card key={extractId(job.id)} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-surface-900 dark:text-white">{job.title}</h3>
                    <Badge variant={job.is_active ? 'success' : 'secondary'}>{job.is_active ? 'Active' : 'Closed'}</Badge>
                  </div>
                  <p className="text-sm text-surface-500">{job.company} {job.location ? `• ${job.location}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" leftIcon={<Users className="w-3.5 h-3.5" />} onClick={() => handleViewApps(job)}>
                    Applications
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-50" leftIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDelete(extractId(job.id))}>
                    Archive
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Applications for: {selectedJob.title}</span>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedJob(null); setApplications([]); }}>Close</Button>
            </CardTitle>
            <CardDescription>{applications.length} application(s)</CardDescription>
          </CardHeader>
          <div className="p-4 pt-0 space-y-3">
            {loadingApps ? (
              <p className="text-sm text-surface-500">Loading applications...</p>
            ) : applications.length === 0 ? (
              <p className="text-sm text-surface-400">No applications yet</p>
            ) : (
              applications.map((app: any) => (
                <div key={extractId(app.id)} className="p-3 bg-surface-50 dark:bg-surface-800/40 rounded-xl border border-surface-200/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{app.applicant_name}</p>
                      <p className="text-xs text-surface-400">{app.applicant_email}</p>
                      {app.cover_letter && <p className="text-xs text-surface-500 mt-1 line-clamp-2">{app.cover_letter}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[app.status] || ''}>{app.status}</Badge>
                      <select
                        className="text-xs px-2 py-1 border rounded"
                        value={app.status}
                        onChange={(e) => handleAppStatus(extractId(app.id), e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="shortlisted">Shortlisted</option>
                        <option value="rejected">Rejected</option>
                        <option value="hired">Hired</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default MyJobPostsPage;
