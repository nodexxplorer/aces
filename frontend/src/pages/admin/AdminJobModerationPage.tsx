import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { getJobPosts, archiveJobPost, listJobApplications } from '../../api/alumni';
import { Briefcase, MapPin, Clock, Users, Trash2, Eye, Search } from 'lucide-react';

const typeLabels: Record<string, string> = { full_time: 'Full Time', part_time: 'Part Time', internship: 'Internship', contract: 'Contract' };
const typeColors: Record<string, string> = { full_time: 'primary', part_time: 'info', internship: 'success', contract: 'warning' };

const AdminJobModerationPage = () => {
  const { success, error: notifyError } = useNotification();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<any>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getJobPosts()
      .then((data) => setJobs(Array.isArray(data) ? data : []))
      .catch(() => notifyError('Error', 'Failed to load jobs'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = jobs.filter((j) => {
    const matchType = typeFilter === 'all' || (j.job_type || j.type) === typeFilter;
    const matchSearch = !search || j.title?.toLowerCase().includes(search.toLowerCase()) || j.company?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const handleViewApps = async (job: any) => {
    setSelectedJob(job);
    setAppsLoading(true);
    try {
      const data = await listJobApplications(job.id);
      setApps(Array.isArray(data) ? data : []);
    } catch {
      setApps([]);
    } finally {
      setAppsLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!confirmArchive) return;
    setArchiving(true);
    try {
      await archiveJobPost(confirmArchive.id);
      success('Deactivated', `"${confirmArchive.title}" has been removed from listings`);
      setJobs((prev) => prev.filter((j) => j.id !== confirmArchive.id));
      setConfirmArchive(null);
    } catch (err: any) {
      notifyError('Failed', err?.response?.data?.error || err?.message);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Job Board Moderation</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Review and manage job listings posted by alumni</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input type="text" placeholder="Search by title or company..." className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="full_time">Full Time</option>
          <option value="part_time">Part Time</option>
          <option value="internship">Internship</option>
          <option value="contract">Contract</option>
        </select>
      </div>

      {loading ? (
        <Card><div className="p-12 text-center text-sm text-surface-500">Loading...</div></Card>
      ) : filtered.length === 0 ? (
        <Card><div className="p-12 text-center text-sm text-surface-400">No job listings found</div></Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((job) => {
            const type = (job.job_type || job.type || 'full_time') as string;
            const deadline = job.application_deadline;
            const isExpired = deadline && new Date(deadline) < new Date();
            return (
              <Card key={job.id} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-surface-900 dark:text-white">{job.title}</h3>
                      <Badge variant={(typeColors[type] || 'primary') as any}>{typeLabels[type] || type}</Badge>
                      {isExpired && <Badge variant="warning">Expired</Badge>}
                    </div>
                    <p className="text-sm text-surface-500 mt-1">{job.company}{job.location ? ` — ${job.location}` : ''}</p>
                    {job.poster_name && <p className="text-xs text-surface-400 mt-1">Posted by {job.poster_name}</p>}
                    <p className="text-sm text-surface-600 dark:text-surface-400 mt-2 line-clamp-2">{job.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-surface-500">
                      {job.salary_range && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {job.salary_range}</span>}
                      {deadline && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Deadline: {new Date(deadline).toLocaleDateString()}</span>}
                      {job.application_url && <a href={job.application_url} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline flex items-center gap-1"><span className="w-3.5 h-3.5 inline-block">↗</span> Application Link</a>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" leftIcon={<Users className="w-3.5 h-3.5" />} onClick={() => handleViewApps(job)}>Applications</Button>
                    <Button size="sm" variant="danger" leftIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setConfirmArchive(job)}>Remove</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={!!selectedJob} onClose={() => { setSelectedJob(null); setApps([]); }} title={`Applications — ${selectedJob?.title || ''}`}>
        {appsLoading ? (
          <div className="p-8 text-center text-sm text-surface-500">Loading applications...</div>
        ) : apps.length === 0 ? (
          <div className="p-8 text-center text-sm text-surface-400">No applications yet</div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {apps.map((app: any) => (
              <div key={app.id} className="p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-surface-900 dark:text-white">{app.applicant_name || 'Student'}</span>
                  <Badge variant={app.status === 'pending' ? 'warning' : app.status === 'accepted' ? 'success' : 'danger'}>{app.status}</Badge>
                </div>
                {app.cover_letter && <p className="text-xs text-surface-500 mt-1 line-clamp-2">{app.cover_letter}</p>}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal isOpen={!!confirmArchive} onClose={() => setConfirmArchive(null)} title="Remove Job Post">
        <p className="text-sm text-surface-600 dark:text-surface-400 mb-4">
          Are you sure you want to deactivate <strong>{confirmArchive?.title}</strong>? This will remove it from student view.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirmArchive(null)}>Cancel</Button>
          <Button variant="danger" isLoading={archiving} onClick={handleArchive}>Deactivate</Button>
        </div>
      </Modal>
    </div>
  );
};

export default AdminJobModerationPage;
