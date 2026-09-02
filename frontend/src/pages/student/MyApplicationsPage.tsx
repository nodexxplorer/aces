import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { useNotification } from '../../hooks/useNotification';
import { listMyJobApplications } from '../../api/alumni';
import { CheckCircle, Clock, AlertCircle, type LucideIcon } from 'lucide-react';
import type { BadgeVariant } from '../../components/ui/Badge';

const statusColors: Record<string, BadgeVariant> = {
  pending: 'warning',
  reviewed: 'info',
  shortlisted: 'success',
  rejected: 'danger',
  hired: 'success',
};
const statusIcons: Record<string, LucideIcon> = {
  pending: Clock,
  reviewed: AlertCircle,
  shortlisted: CheckCircle,
  rejected: Clock,
  hired: CheckCircle,
};

// The backend serializes nullable Go values (pgtype.Text / pgtype.Timestamptz)
// as either a plain value or a `{ String | Time, Valid }` wrapper depending on
// the endpoint, so these helpers narrow `unknown` rather than assume a shape.
const extractId = (v: unknown): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && 'String' in v) return String((v as { String?: unknown }).String ?? '');
  return String(v);
};

const extractTimestamptz = (v: unknown): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && 'Time' in v) return String((v as { Time?: unknown }).Time ?? '');
  return '';
};

// Mirrors the raw job-application fields as actually returned by the API
// (snake_case, with the nullable-wrapper shapes handled above) rather than
// the camelCase `JobApplication` shared type, which doesn't match this
// endpoint's payload.
interface JobApplicationRaw {
  id?: unknown;
  status?: string;
  job_title?: string;
  job_company?: string;
  cover_letter?: string;
  created_at?: unknown;
}

const MyApplicationsPage = () => {
  const { error: notifyError } = useNotification();
  const [applications, setApplications] = useState<JobApplicationRaw[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listMyJobApplications()
      .then((data) => setApplications(Array.isArray(data) ? data : []))
      .catch(() => notifyError('Error', 'Failed to load applications'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">My Applications</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Track the status of your job applications</p>
      </div>

      {loading ? (
        <Card>
          <div className="p-12 text-center text-sm text-surface-500">Loading your applications...</div>
        </Card>
      ) : applications.length === 0 ? (
        <Card>
          <EmptyState title="You haven't applied to any jobs yet" />
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const status = app.status || 'pending';
            const StatusIcon = statusIcons[status] || AlertCircle;
            return (
              <Card key={extractId(app.id)} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                      <StatusIcon className="w-5 h-5 text-primary-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-surface-900 dark:text-white text-sm">
                        {app.job_title || 'Job'}
                      </h3>
                      <p className="text-xs text-surface-500">{app.job_company || 'Company'}</p>
                      {app.cover_letter && (
                        <p className="text-xs text-surface-400 mt-1 line-clamp-2">"{app.cover_letter}"</p>
                      )}
                      <p className="text-[10px] text-surface-400 mt-1">
                        Applied{' '}
                        {extractTimestamptz(app.created_at)
                          ? new Date(extractTimestamptz(app.created_at)).toLocaleDateString()
                          : 'recently'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusColors[status] || 'secondary'}>{status}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyApplicationsPage;
