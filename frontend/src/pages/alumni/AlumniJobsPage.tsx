import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { Search, Plus, Briefcase, MapPin, ExternalLink, Edit } from 'lucide-react';
import { getJobPosts, createJobPost, updateJobPost, trackJobView } from '../../api/alumni';

const typeLabels: Record<string, string> = { full_time: 'Full Time', part_time: 'Part Time', internship: 'Internship', contract: 'Contract', remote: 'Remote' };
const typeColors: Record<string, string> = { full_time: 'primary', part_time: 'info', internship: 'success', contract: 'warning', remote: 'info' };

const AlumniJobsPage = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);

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

  const canEditJob = (job: any) => {
    if (!user || !job) return false;
    const isOwner = job.posted_by === user.id || job.postedBy === user.id;
    const userRole = user.role || user.activeRole || '';
    const isAdmin = ['admin', 'hod', 'delegated_admin'].includes(userRole);
    return isOwner || isAdmin;
  };

  const filtered = jobs.filter((j) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return j.title?.toLowerCase().includes(q) || j.company?.toLowerCase().includes(q) || j.industry?.toLowerCase().includes(q);
  });

  const handleOpenCreate = () => {
    setEditingJobId(null);
    setTitle(''); setCompany(''); setJobType('full_time'); setLocation(''); setIndustry(''); setSalary(''); setDesc(''); setRequirements(''); setResponsibilities(''); setAppUrl('');
    setCreateOpen(true);
  };

  const handleOpenEdit = (job: any, e?: React.MouseEvent) => {
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
      setTitle(''); setCompany(''); setDesc(''); setRequirements(''); setResponsibilities(''); setLocation(''); setIndustry(''); setSalary(''); setAppUrl('');
      const refreshed = await getJobPosts();
      setJobs(Array.isArray(refreshed) ? refreshed : []);
    } catch (err: any) {
      notifyError('Failed', err?.response?.data?.error || err?.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewJob = async (job: any) => {
    setSelectedJob(job);
    try { await trackJobView(job.id); } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Alumni Job Board</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Post and discover job opportunities from the alumni network</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={handleOpenCreate}>Post Job</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
        <input type="text" placeholder="Search by title, company, or industry..." className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <Card><div className="p-12 text-center text-sm text-surface-500">Loading...</div></Card>
      ) : filtered.length === 0 ? (
        <Card><div className="p-12 text-center text-sm text-surface-400">No job listings found</div></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((job) => {
            const type = (job.job_type || job.type || 'full_time') as string;
            const isEditable = canEditJob(job);
            return (
              <Card key={job.id} hover className="p-5 flex flex-col relative group" onClick={() => handleViewJob(job)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
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
                    <Badge variant={(typeColors[type] || 'primary') as any}>{typeLabels[type] || type}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-surface-500 mb-3 flex-wrap">
                  {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>}
                  {(job.salary_range || job.salaryRange) && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {job.salary_range || job.salaryRange}</span>}
                  {job.industry && <Badge variant="outline">{job.industry}</Badge>}
                </div>
                <p className="text-sm text-surface-600 dark:text-surface-400 line-clamp-3 flex-1">{job.description}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
                  {job.poster_name && <p className="text-[10px] text-surface-400">by {job.poster_name}</p>}
                  {(job.views_count || job.applications_count) && (
                    <p className="text-[10px] text-surface-400">{job.views_count || 0} views &bull; {job.applications_count || 0} apps</p>
                  )}
                </div>
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
              <Badge variant="outline">{typeLabels[selectedJob.job_type] || selectedJob.job_type}</Badge>
              {selectedJob.industry && <Badge variant="info">{selectedJob.industry}</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {selectedJob.location && <p className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {selectedJob.location}</p>}
              {selectedJob.salary_range && <p className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> {selectedJob.salary_range}</p>}
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1">Description</h4>
              <p className="text-sm text-surface-600 dark:text-surface-400 whitespace-pre-wrap">{selectedJob.description}</p>
            </div>
            {selectedJob.requirements && (
              <div>
                <h4 className="font-semibold text-sm mb-1">Requirements</h4>
                <p className="text-sm text-surface-600 dark:text-surface-400 whitespace-pre-wrap">{selectedJob.requirements}</p>
              </div>
            )}
            {selectedJob.responsibilities && (
              <div>
                <h4 className="font-semibold text-sm mb-1">Responsibilities</h4>
                <p className="text-sm text-surface-600 dark:text-surface-400 whitespace-pre-wrap">{selectedJob.responsibilities}</p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              {selectedJob.application_url && (
                <a href={selectedJob.application_url} target="_blank" rel="noopener noreferrer">
                  <Button leftIcon={<ExternalLink className="w-4 h-4" />}>Apply Now</Button>
                </a>
              )}
              {canEditJob(selectedJob) && (
                <Button variant="outline" leftIcon={<Edit className="w-4 h-4" />} onClick={(e) => handleOpenEdit(selectedJob, e)}>
                  Edit Job
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedJob(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal isOpen={createOpen} onClose={() => { setCreateOpen(false); setEditingJobId(null); }} title={editingJobId ? "Edit Job" : "Post a Job"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Job Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Input label="Company" value={company} onChange={(e) => setCompany(e.target.value)} required />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Type</label>
              <select className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg" value={jobType} onChange={(e) => setJobType(e.target.value)}>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="internship">Internship</option>
                <option value="contract">Contract</option>
                <option value="remote">Remote</option>
              </select>
            </div>
            <Input label="Location" placeholder="Lagos, Remote" value={location} onChange={(e) => setLocation(e.target.value)} />
            <Input label="Industry" placeholder="e.g. Tech" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </div>
          <Input label="Salary Range" value={salary} onChange={(e) => setSalary(e.target.value)} />
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description *</label>
            <textarea className="w-full mt-1 h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none resize-none" value={desc} onChange={(e) => setDesc(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Requirements</label>
            <textarea className="w-full mt-1 h-20 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none resize-none" value={requirements} onChange={(e) => setRequirements(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Responsibilities</label>
            <textarea className="w-full mt-1 h-20 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none resize-none" value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} />
          </div>
          <Input label="Application URL" placeholder="https://..." value={appUrl} onChange={(e) => setAppUrl(e.target.value)} />
          <Button type="submit" className="w-full" isLoading={submitting}>
            {editingJobId ? 'Update Job' : 'Publish Job'}
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default AlumniJobsPage;
