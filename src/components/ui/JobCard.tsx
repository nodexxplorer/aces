import { MapPin, Clock, Briefcase } from 'lucide-react';
import Card from './Card';
import Badge from './Badge';
import type { JobPost } from '../../types';
import { formatDate, formatCurrency } from '../../utils/formatters';

const typeColors = { full_time: 'primary', part_time: 'info', internship: 'success', contract: 'warning' } as const;
const typeLabels = { full_time: 'Full Time', part_time: 'Part Time', internship: 'Internship', contract: 'Contract' };

interface JobCardProps { job: JobPost; onClick?: () => void; }

const JobCard = ({ job, onClick }: JobCardProps) => (
  <Card hover onClick={onClick}>
    <div className="flex items-start justify-between mb-2">
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-surface-900 dark:text-surface-100 truncate">{job.title}</h4>
        <p className="text-sm text-surface-500">{job.company}</p>
      </div>
      <Badge variant={typeColors[job.type]}>{typeLabels[job.type]}</Badge>
    </div>
    <div className="flex items-center gap-3 text-xs text-surface-500 mb-3 flex-wrap">
      {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>}
      {job.salaryRange && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {job.salaryRange}</span>}
      {job.deadline && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatDate(job.deadline)}</span>}
    </div>
    <p className="text-sm text-surface-600 dark:text-surface-400 line-clamp-2">{job.description}</p>
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-100 dark:border-surface-700 text-xs text-surface-500">
      <span>{job.applicationCount} applicant{job.applicationCount !== 1 ? 's' : ''}</span>
      <span>{job.viewCount} views</span>
    </div>
  </Card>
);

export default JobCard;
