import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { Search, MapPin, Briefcase, ExternalLink, Send } from 'lucide-react';
import { getJobPosts, applyToJob } from '../../api/alumni';
import type { JobPost } from '../../types';

const typeLabels: Record<string, string> = { full_time: 'Full Time', part_time: 'Part Time', internship: 'Internship', contract: 'Contract' };
const typeColors: Record<string, string> = { full_time: 'primary', part_time: 'info', internship: 'success', contract: 'warning' };

const extractTimestamptz = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (v.Time) return v.Time;
  return '';
};

const extractId = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (v.String) return v.String;
  return String(v);
};

const StudentJobBoardPage = () => {
  const { success, error: notifyError } = useNotification();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [applyOpen, setApplyOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    getJobPosts()
      .then((data) => setJobs(Array.isArray(data) ? data : []))
      .catch(() => notifyError('Error', 'Failed to load jobs'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = jobs.filter((j) => {
    const q = search.toLowerCase();
    const matchSearch = !q || j.title?.toLowerCase().includes(q) || j.company?.toLowerCase().includes(q);
    const matchType = !typeFilter || (j.job_type || j.type) === typeFilter;
    return matchSearch && matchType;
  });

  const openApply = (job: any) => {
    setSelectedJob(job);
    setCoverLetter('');
    setResumeUrl('');
    setApplyOpen(true);
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    try {
      setSubmitting(true);
      await applyToJob(extractId(selectedJob.id), {
        cover_letter: coverLetter || undefined,
        resume_url: resumeUrl || undefined,
      });
      setApplyOpen(false);
      success('Application Sent', `Your application for ${selectedJob.title} has been submitted`);
    } catch (err: any) {
      notifyError('Application Failed', err?.response?.data?.error || err?.message || 'Could not submit application');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Job Board</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Find opportunities posted by ACES alumni</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search job titles or companies..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="full_time">Full Time</option>
          <option value="part_time">Part Time</option>
          <option value="internship">Internship</option>
          <option value="contract">Contract</option>
        </select>
      </div>

      {loading ? (
        <Card><div className="p-12 text-center text-sm text-surface-500">Loading jobs...</div></Card>
      ) : filtered.length === 0 ? (
        <Card><div className="p-12 text-center text-sm text-surface-400">No job listings available</div></Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((job) => {
            const type = (job.job_type || job.type || 'full_time') as string;
            return (
              <Card key={extractId(job.id)} hover className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-surface-900 dark:text-white">{job.title}</h3>
                      <Badge variant={(typeColors[type] || 'primary') as any}>{typeLabels[type] || type}</Badge>
                    </div>
                    <p className="text-sm font-medium text-surface-600 dark:text-surface-400">{job.company}</p>
                    <div className="flex items-center gap-3 text-xs text-surface-500 mt-1 flex-wrap">
                      {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>}
                      {(job.salary_range || job.salaryRange) && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {job.salary_range || job.salaryRange}</span>}
                    </div>
                    <p className="text-sm text-surface-600 dark:text-surface-400 mt-3 line-clamp-3">{job.description}</p>
                    {job.requirements && (
                      <p className="text-xs text-surface-500 mt-2"><span className="font-medium">Requirements:</span> {job.requirements}</p>
                    )}
                    {job.poster_name && <p className="text-[10px] text-surface-400 mt-2">Posted by {job.poster_name}</p>}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" leftIcon={<Send className="w-3.5 h-3.5" />} onClick={() => openApply(job)}>Apply</Button>
                    {job.application_url && (
                      <Button size="sm" variant="outline" leftIcon={<ExternalLink className="w-3.5 h-3.5" />} onClick={() => window.open(job.application_url, '_blank')}>
                        External Link
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={applyOpen} onClose={() => setApplyOpen(false)} title={`Apply: ${selectedJob?.title || ''}`}>
        <form onSubmit={handleApply} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Cover Letter</label>
            <textarea
              className="w-full mt-1 h-32 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
              placeholder="Tell the employer why you're a great fit..."
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Resume/CV URL (optional)</label>
            <input
              type="url"
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
              placeholder="https://drive.google.com/..."
              value={resumeUrl}
              onChange={(e) => setResumeUrl(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" isLoading={submitting} leftIcon={<Send className="w-4 h-4" />}>
            Submit Application
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default StudentJobBoardPage;
