import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { listMyJobApplications } from '../../api/alumni';
import { Briefcase, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const statusColors: Record<string, string> = {
  pending: 'warning',
  reviewed: 'info',
  shortlisted: 'success',
  rejected: 'danger',
  hired: 'success',
};
const statusIcons: Record<string, any> = {
  pending: Clock,
  reviewed: AlertCircle,
  shortlisted: CheckCircle,
  rejected: Clock,
  hired: CheckCircle,
};

const extractId = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (v.String) return v.String;
  return String(v);
};

const extractTimestamptz = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (v.Time) return v.Time;
  return '';
};

const MyApplicationsPage = () => {
  const { error: notifyError } = useNotification();
  const [applications, setApplications] = useState<any[]>([]);
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
        <Card><div className="p-12 text-center text-sm text-surface-500">Loading your applications...</div></Card>
      ) : applications.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <Briefcase className="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
            <p className="text-sm text-surface-500">You haven't applied to any jobs yet</p>
          </div>
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
                      <h3 className="font-semibold text-surface-900 dark:text-white text-sm">{app.job_title || 'Job'}</h3>
                      <p className="text-xs text-surface-500">{app.job_company || 'Company'}</p>
                      {app.cover_letter && <p className="text-xs text-surface-400 mt-1 line-clamp-2">"{app.cover_letter}"</p>}
                      <p className="text-[10px] text-surface-400 mt-1">
                        Applied {extractTimestamptz(app.created_at) ? new Date(extractTimestamptz(app.created_at)).toLocaleDateString() : 'recently'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={(statusColors[status] || 'secondary') as any}>{status}</Badge>
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
