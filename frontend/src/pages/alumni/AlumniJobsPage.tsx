import { useState, useEffect, useCallback } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import {
  Search,
  Plus,
  Briefcase,
  MapPin,
  ExternalLink,
  Edit,
  Users,
  ChevronDown,
  ChevronUp,
  Mail,
  Check,
  X,
} from 'lucide-react';
import {
  getJobPosts,
  createJobPost,
  updateJobPost,
  trackJobView,
  listJobApplications,
  updateJobApplicationStatus,
} from '../../api/alumni';
import { getErrorMessage } from '../../utils/errors';

// Job/application shapes as actually consumed on this page — the backend
// returns a mix of snake_case and camelCase fields for these resources.
type JobBadgeVariant = 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'default' | 'outline' | 'secondary';

interface AlumniJob {
  id: string;
  title: string;
  company: string;
  description: string;
  location?: string;
  industry?: string;
  requirements?: string;
  responsibilities?: string;
  job_type?: string;
  type?: string;
  salary_range?: string;
  salaryRange?: string;
  application_url?: string;
  applicationUrl?: string;
  posted_by?: string;
  postedBy?: string;
  poster_name?: string;
  views_count?: number;
  applications_count?: number;
}

interface JobApplicationEntry {
  id: string;
  status?: string;
  applicant_name?: string;
  applicant_email?: string;
  cover_letter?: string;
  resume_url?: string;
  created_at?: string;
}

const typeLabels: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  internship: 'Internship',
  contract: 'Contract',
  remote: 'Remote',
};
const typeColors: Record<string, JobBadgeVariant> = {
  full_time: 'primary',
  part_time: 'info',
  internship: 'success',
  contract: 'warning',
  remote: 'info',
};

const AlumniJobsPage = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [jobs, setJobs] = useState<AlumniJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'applications'>('all');
  const [appStatusFilter, setAppStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedJob, setSelectedJob] = useState<AlumniJob | null>(null);
  const [jobApplications, setJobApplications] = useState<Record<string, JobApplicationEntry[]>>({});
  const [loadingApps, setLoadingApps] = useState(false);
  const [expandedJobApps, setExpandedJobApps] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobType, setJobType] = useState('full_time');
  const [location, setLocation] = useState('');
  const [industry, setIndustry] = useState('');
  const [salary, setSalary] = useState('');
  const [desc, setDesc] = useState('');
  const [requirements, setRequirements] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [appUrl, setAppUrl] = useState('');

  useEffect(() => {
    setLoading(true);
    getJobPosts()
      .then((data) => setJobs(Array.isArray(data) ? data : []))
      .catch(() => notifyError('Error', 'Failed to load jobs'))
      .finally(() => setLoading(false));
  }, []);

  const fetchApplicationsForMyJobs = useCallback(async () => {
    if (!user) return;
    setLoadingApps(true);
    try {
      const myJobs = jobs.filter((j) => j.posted_by === user.id || j.postedBy === user.id);
      const appsMap: Record<string, JobApplicationEntry[]> = {};
      await Promise.all(
        myJobs.map(async (job) => {
          try {
            const apps = await listJobApplications(job.id);
            appsMap[job.id] = Array.isArray(apps) ? apps : [];
          } catch {
            appsMap[job.id] = [];
          }
        }),
      );
      setJobApplications(appsMap);
    } catch {
      // silent
    } finally {
      setLoadingApps(false);
    }
  }, [user, jobs]);

  useEffect(() => {
    if ((activeTab === 'my' || activeTab === 'applications') && user) {
      fetchApplicationsForMyJobs();
    }
  }, [activeTab, user, fetchApplicationsForMyJobs]);

  const myJobs = jobs.filter((j) => user && (j.posted_by === user.id || j.postedBy === user.id));
  const allMyApplications = myJobs
    .flatMap((job) => (jobApplications[job.id] || []).map((app: JobApplicationEntry) => ({ app, job })))
    .filter(({ app }) => appStatusFilter === 'all' || (app.status || 'pending') === appStatusFilter)
    .sort((a, b) => new Date(b.app.created_at || 0).getTime() - new Date(a.app.created_at || 0).getTime());

  const canEditJob = (job: AlumniJob) => {
    if (!user || !job) return false;
    const isOwner = job.posted_by === user.id || job.postedBy === user.id;
    const userRole = user.activeRole || user.role || '';
    const isAdmin = ['admin', 'hod', 'delegated_admin'].includes(userRole);
    return isOwner || isAdmin;
  };

  const filtered = jobs.filter((j) => {
    if (activeTab === 'my' && user) {
      const isOwner = j.posted_by === user.id || j.postedBy === user.id;
      if (!isOwner) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      j.title?.toLowerCase().includes(q) ||
      j.company?.toLowerCase().includes(q) ||
      j.industry?.toLowerCase().includes(q)
    );
  });

  const handleOpenCreate = () => {
    setEditingJobId(null);
    setTitle('');
    setCompany('');
    setJobType('full_time');
    setLocation('');
    setIndustry('');
    setSalary('');
    setDesc('');
    setRequirements('');
    setResponsibilities('');
    setAppUrl('');
    setCreateOpen(true);
  };

  const handleOpenEdit = (job: AlumniJob, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingJobId(job.id);
    setTitle(job.title || '');
    setCompany(job.company || '');
    setJobType(job.job_type || job.type || 'full_time');
    setLocation(job.location || '');
    setIndustry(job.industry || '');
    setSalary(job.salary_range || job.salaryRange || '');
    setDesc(job.description || '');
    setRequirements(job.requirements || '');
    setResponsibilities(job.responsibilities || '');
    setAppUrl(job.application_url || job.applicationUrl || '');
    setSelectedJob(null);
    setCreateOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !company || !desc) return;
    try {
      setSubmitting(true);
      const payload = {
        title,
        company,
        job_type: jobType,
        location: location || undefined,
        industry: industry || undefined,
        description: desc,
        requirements: requirements || undefined,
        responsibilities: responsibilities || undefined,
        salary_range: salary || undefined,
        application_url: appUrl || undefined,
      };

      if (editingJobId) {
        await updateJobPost(editingJobId, payload);
        success('Job Updated', 'Your job listing has been updated');
      } else {
        await createJobPost(payload);
        success('Job Posted', 'Your job listing is now live');
      }

      setCreateOpen(false);
      setEditingJobId(null);
      setTitle('');
      setCompany('');
      setDesc('');
      setRequirements('');
      setResponsibilities('');
      setLocation('');
      setIndustry('');
      setSalary('');
      setAppUrl('');
      const refreshed = await getJobPosts();
      setJobs(Array.isArray(refreshed) ? refreshed : []);
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewJob = async (job: AlumniJob) => {
    setSelectedJob(job);
    try {
      await trackJobView(job.id);
    } catch {
      /* silent */
    }
    if (activeTab === 'my' && user) {
      try {
        const apps = await listJobApplications(job.id);
        setJobApplications((prev) => ({ ...prev, [job.id]: Array.isArray(apps) ? apps : [] }));
      } catch {
        /* silent */
      }
    }
  };

  const handleUpdateAppStatus = async (applicationId: string, newStatus: string) => {
    try {
      await updateJobApplicationStatus(applicationId, newStatus);
      success('Updated', `Application ${newStatus}`);
      if (selectedJob) {
        const apps = await listJobApplications(selectedJob.id);
        setJobApplications((prev) => ({ ...prev, [selectedJob.id]: Array.isArray(apps) ? apps : [] }));
      } else {
        await fetchApplicationsForMyJobs();
      }
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Alumni Job Board</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Post and discover job opportunities from the alumni network
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={handleOpenCreate}>
          Post Job
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all' as const, label: 'All Jobs' },
          { key: 'my' as const, label: 'My Posts' },
          { key: 'applications' as const, label: 'Applications' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-primary-500 text-white'
                : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab !== 'applications' && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search by title, company, or industry..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {activeTab === 'applications' ? (
        <div className="space-y-4">
          <div className="flex gap-1 flex-wrap">
            {(['all', 'pending', 'accepted', 'rejected'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setAppStatusFilter(st)}
                className={`px-3 py-1 text-xs font-medium rounded-lg capitalize transition-colors ${
                  appStatusFilter === st
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {loadingApps ? (
            <Card>
              <div className="p-12 text-center text-sm text-surface-500">Loading applications...</div>
            </Card>
          ) : myJobs.length === 0 ? (
            <Card>
              <div className="p-12 text-center text-sm text-surface-400">You haven't posted any jobs yet</div>
            </Card>
          ) : allMyApplications.length === 0 ? (
            <Card>
              <div className="p-12 text-center text-sm text-surface-400">No applications found</div>
            </Card>
          ) : (
            <div className="space-y-3">
              {allMyApplications.map(({ app, job }) => (
                <Card key={app.id} className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-surface-900 dark:text-surface-100">
                          {app.applicant_name || 'Applicant'}
                        </p>
                        <Badge
                          variant={
                            app.status === 'accepted' ? 'success' : app.status === 'rejected' ? 'danger' : 'warning'
                          }
                        >
                          {app.status || 'pending'}
                        </Badge>
                      </div>
                      {app.applicant_email && (
                        <p className="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" /> {app.applicant_email}
                        </p>
                      )}
                      <p className="text-xs text-surface-400 mt-1">
                        Applied for{' '}
                        <span className="font-medium text-surface-600 dark:text-surface-300">{job.title}</span> at{' '}
                        {job.company}
                      </p>
                      {app.cover_letter && (
                        <p className="text-sm text-surface-600 dark:text-surface-400 mt-2 line-clamp-3">
                          {app.cover_letter}
                        </p>
                      )}
                      {app.resume_url && (
                        <a
                          href={app.resume_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline mt-2"
                        >
                          <ExternalLink className="w-3 h-3" /> View Resume
                        </a>
                      )}
                    </div>
                    {(app.status || 'pending') === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="xs"
                          variant="success"
                          leftIcon={<Check className="w-3 h-3" />}
                          onClick={() => handleUpdateAppStatus(app.id, 'accepted')}
                        >
                          Accept
                        </Button>
                        <Button
                          size="xs"
                          variant="danger"
                          leftIcon={<X className="w-3 h-3" />}
                          onClick={() => handleUpdateAppStatus(app.id, 'rejected')}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <Card>
          <div className="p-12 text-center text-sm text-surface-500">Loading...</div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="p-12 text-center text-sm text-surface-400">No job listings found</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((job) => {
            const type = (job.job_type || job.type || 'full_time') as string;
            const isEditable = canEditJob(job);
            const isMyPost = activeTab === 'my';
            const apps = jobApplications[job.id] || [];
            const isExpanded = expandedJobApps === job.id;
            return (
              <Card key={job.id} hover className="p-5 flex flex-col relative group">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleViewJob(job)}>
                    <h4 className="font-semibold text-surface-900 dark:text-surface-100 truncate">{job.title}</h4>
                    <p className="text-sm text-surface-500">{job.company}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditable && (
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(job, e)}
                        className="p-1 text-surface-400 hover:text-primary-600 hover:bg-surface-100 dark:hover:bg-surface-800 rounded transition-colors"
                        title="Edit Job"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    <Badge variant={typeColors[type] || 'primary'}>{typeLabels[type] || type}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-surface-500 mb-3 flex-wrap">
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {job.location}
                    </span>
                  )}
                  {(job.salary_range || job.salaryRange) && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5" /> {job.salary_range || job.salaryRange}
                    </span>
                  )}
                  {job.industry && <Badge variant="outline">{job.industry}</Badge>}
                </div>
                <p
                  className="text-sm text-surface-600 dark:text-surface-400 line-clamp-3 flex-1 cursor-pointer"
                  onClick={() => handleViewJob(job)}
                >
                  {job.description}
                </p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
                  {job.poster_name && <p className="text-[10px] text-surface-400">by {job.poster_name}</p>}
                  <div className="flex items-center gap-2">
                    {(job.views_count || job.applications_count) && (
                      <p className="text-[10px] text-surface-400">
                        {job.views_count || 0} views &bull; {job.applications_count || 0} apps
                      </p>
                    )}
                    {isMyPost && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedJobApps(isExpanded ? null : job.id);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-50 text-primary-600 dark:bg-primary-950/20 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-950/30 transition-colors"
                      >
                        <Users className="w-3 h-3" />
                        {apps.length || job.applications_count || 0}
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>
                {isMyPost && isExpanded && (
                  <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700 space-y-2">
                    {loadingApps ? (
                      <p className="text-xs text-surface-400">Loading applications...</p>
                    ) : apps.length === 0 ? (
                      <p className="text-xs text-surface-400">No applications yet</p>
                    ) : (
                      apps.map((app: JobApplicationEntry) => (
                        <div key={app.id} className="p-2 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-surface-800 dark:text-surface-200 truncate">
                                {app.applicant_name || 'Applicant'}
                              </p>
                              <p className="text-[10px] text-surface-400 truncate">{app.applicant_email}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge
                                variant={
                                  app.status === 'accepted'
                                    ? 'success'
                                    : app.status === 'rejected'
                                      ? 'danger'
                                      : 'warning'
                                }
                              >
                                {app.status || 'pending'}
                              </Badge>
                              {app.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateAppStatus(app.id, 'accepted')}
                                    className="p-0.5 text-success-500 hover:text-success-600 transition-colors"
                                    title="Accept"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleUpdateAppStatus(app.id, 'rejected')}
                                    className="p-0.5 text-danger-500 hover:text-danger-600 transition-colors"
                                    title="Reject"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {app.cover_letter && (
                            <p className="text-[10px] text-surface-500 mt-1 line-clamp-2">{app.cover_letter}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {selectedJob && (
        <Modal isOpen={!!selectedJob} onClose={() => setSelectedJob(null)} title={selectedJob.title} size="lg">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="primary">{selectedJob.company}</Badge>
              <Badge variant="outline">
                {typeLabels[selectedJob.job_type || selectedJob.type || 'full_time'] || selectedJob.job_type}
              </Badge>
              {selectedJob.industry && <Badge variant="info">{selectedJob.industry}</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {selectedJob.location && (
                <p className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {selectedJob.location}
                </p>
              )}
              {selectedJob.salary_range && (
                <p className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" /> {selectedJob.salary_range}
                </p>
              )}
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1">Description</h4>
              <p className="text-sm text-surface-600 dark:text-surface-400 whitespace-pre-wrap">
                {selectedJob.description}
              </p>
            </div>
            {selectedJob.requirements && (
              <div>
                <h4 className="font-semibold text-sm mb-1">Requirements</h4>
                <p className="text-sm text-surface-600 dark:text-surface-400 whitespace-pre-wrap">
                  {selectedJob.requirements}
                </p>
              </div>
            )}
            {selectedJob.responsibilities && (
              <div>
                <h4 className="font-semibold text-sm mb-1">Responsibilities</h4>
                <p className="text-sm text-surface-600 dark:text-surface-400 whitespace-pre-wrap">
                  {selectedJob.responsibilities}
                </p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              {selectedJob.application_url && (
                <a href={selectedJob.application_url} target="_blank" rel="noopener noreferrer">
                  <Button leftIcon={<ExternalLink className="w-4 h-4" />}>Apply Now</Button>
                </a>
              )}
              {canEditJob(selectedJob) && (
                <Button
                  variant="outline"
                  leftIcon={<Edit className="w-4 h-4" />}
                  onClick={(e) => handleOpenEdit(selectedJob, e)}
                >
                  Edit Job
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedJob(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditingJobId(null);
        }}
        title={editingJobId ? 'Edit Job' : 'Post a Job'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Job Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Input label="Company" value={company} onChange={(e) => setCompany(e.target.value)} required />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Type</label>
              <select
                className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
              >
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="internship">Internship</option>
                <option value="contract">Contract</option>
                <option value="remote">Remote</option>
              </select>
            </div>
            <Input
              label="Location"
              placeholder="Lagos, Remote"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <Input
              label="Industry"
              placeholder="e.g. Tech"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>
          <Input label="Salary Range" value={salary} onChange={(e) => setSalary(e.target.value)} />
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description *</label>
            <textarea
              className="w-full mt-1 h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none resize-none"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Requirements</label>
            <textarea
              className="w-full mt-1 h-20 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none resize-none"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Responsibilities</label>
            <textarea
              className="w-full mt-1 h-20 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none resize-none"
              value={responsibilities}
              onChange={(e) => setResponsibilities(e.target.value)}
            />
          </div>
          <Input
            label="Application URL"
            placeholder="https://..."
            value={appUrl}
            onChange={(e) => setAppUrl(e.target.value)}
          />
          <Button type="submit" className="w-full" isLoading={submitting}>
            {editingJobId ? 'Update Job' : 'Publish Job'}
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default AlumniJobsPage;
