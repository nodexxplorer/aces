import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import JobCard from '../../components/ui/JobCard';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { Search, Plus, Briefcase } from 'lucide-react';
import type { JobPost } from '../../types';

const mockJobs: JobPost[] = [
  {
    id: 'job-1',
    title: 'Junior Embedded Systems Engineer',
    company: 'Verve Technologies',
    description: 'Design PCB schematics, write bare metal C drivers, and assemble lab prototypes.',
    type: 'full_time',
    location: 'Lagos, Nigeria',
    salaryRange: '₦350,000 - ₦500,000 / month',
    deadline: '2026-07-15T00:00:00Z',
    postedBy: 'alumni-1',
    isActive: true,
    applicationCount: 4,
    viewCount: 22,
    createdAt: '',
  },
];

const JobBoardPage = () => {
  const { success } = useNotification();
  const [search, setSearch] = useState('');
  const [jobs, setJobs] = useState<JobPost[]>(mockJobs);
  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [type, setType] = useState('full_time');
  const [location, setLocation] = useState('');
  const [salary, setSalary] = useState('');
  const [desc, setDesc] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !company) return;
    const newJob: JobPost = {
      id: `job-${Date.now()}`,
      title,
      company,
      description: desc,
      type: type as any,
      location,
      salaryRange: salary,
      postedBy: 'me',
      isActive: true,
      applicationCount: 0,
      viewCount: 0,
      createdAt: new Date().toISOString(),
    };
    setJobs((prev) => [newJob, ...prev]);
    setCreateOpen(false);
    setTitle('');
    setCompany('');
    setDesc('');
    success('Job Posted', 'Job referral vacancy published on the Alumni Board.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Alumni Job Board</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Access internal job postings, internships, and entry-level engineering referrals.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          Post Job Referral
        </Button>
      </div>

      <div className="flex gap-4 max-w-xl">
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map((j) => (
          <JobCard key={j.id} job={j} onClick={() => success('Application Sent', 'Your student resume referral profile has been submitted.')} />
        ))}
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Post Job Vacancy">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Job Title" placeholder="e.g. Firmware Engineer" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Input label="Company Name" placeholder="e.g. Verve Tech" value={company} onChange={(e) => setCompany(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Contract Type"
              options={[
                { value: 'full_time', label: 'Full Time' },
                { value: 'part_time', label: 'Part Time' },
                { value: 'internship', label: 'Internship' },
                { value: 'contract', label: 'Contract' },
              ]}
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
            <Input label="Office Location" placeholder="e.g. Lagos (Remote)" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <Input label="Salary / Compensation" placeholder="e.g. ₦300,000 / month" value={salary} onChange={(e) => setSalary(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
            <textarea
              placeholder="Detail job tasks, qualifications required..."
              className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" leftIcon={<Briefcase className="w-4 h-4" />}>
            Publish Vacancy
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default JobBoardPage;
