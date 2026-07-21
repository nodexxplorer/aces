import { useEffect, useState, useCallback } from 'react';
import { Clock, Mail, RefreshCw, ExternalLink } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getStudentOnboardingStatus } from '../../api/verification-announcements';

const WaitingDashboardPage = () => {
  const { user } = useAuth();
  const { error: notifyError, success: notifySuccess } = useNotification();
  const [loading, setLoading] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<string>('pending');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getStudentOnboardingStatus();
      setOnboardingStatus(data.status);
      setRejectionReason(data.rejection_reason);
      setSubmittedAt(data.created_at);
      return data.status;
    } catch {
      return null;
    }
  }, []);

  const handleCheckStatus = useCallback(async () => {
    setLoading(true);
    const status = await fetchStatus();
    if (status === 'approved') {
      notifySuccess('Approved', 'Your account has been approved!');
    } else if (status === 'rejected') {
      notifyError('Rejected', 'Your registration was not approved.');
    } else {
      notifySuccess('Status Updated', 'Your status is still under review.');
    }
    setLoading(false);
  }, [fetchStatus, notifyError, notifySuccess]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      fetchStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (onboardingStatus === 'approved') {
      const timer = setTimeout(() => {
        window.location.href = '/dashboard';
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [onboardingStatus]);

  const displayName =
    user?.fullName || user?.full_name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Student';
  const displayMatric = user?.matricNumber || user?.matric_number || 'N/A';
  const displayLevel = user?.level ? `Level ${user.level}` : 'N/A';

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-surface-50 via-white to-surface-100 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 px-4 py-12">
      <div className="w-full max-w-lg mx-auto">
        <div className="bg-white dark:bg-surface-900 rounded-2xl shadow-xl border border-surface-200/60 dark:border-surface-800/60 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-amber-400 to-amber-500" />

          <div className="p-8 md:p-10 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center mb-5">
              <div className="w-10 h-10 rounded-xl bg-surface-200/80 dark:bg-surface-700/80 flex items-center justify-center text-sm font-bold text-surface-500 dark:text-surface-300">
                ACES
              </div>
            </div>

            <h2 className="text-xl font-bold text-surface-900 dark:text-white flex items-center justify-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Waiting for Approval
            </h2>

            <p className="text-sm text-surface-500 dark:text-surface-400 max-w-sm mx-auto leading-relaxed">
              Your account is being reviewed by the Department of Computer Engineering.
            </p>

            <div className="my-6 border-t border-surface-200/60 dark:border-surface-700/60" />

            <div className="text-left space-y-3 bg-surface-50 dark:bg-surface-800/50 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wide">Name</span>
                <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">{displayName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wide">Matric Number</span>
                <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">{displayMatric}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wide">Level</span>
                <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">{displayLevel}</span>
              </div>
            </div>

            {onboardingStatus === 'rejected' ? (
              <div className="mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-danger-500/10 text-danger-500 border border-danger-500/20 mb-3">
                  Rejected
                </span>
                {rejectionReason && (
                  <div className="p-3 bg-danger-500/5 border border-danger-500/10 rounded-xl text-left mt-2">
                    <span className="block text-xs font-semibold text-danger-500 uppercase tracking-wider mb-1">Reason:</span>
                    <p className="text-sm text-surface-700 dark:text-surface-300">&quot;{rejectionReason}&quot;</p>
                  </div>
                )}
              </div>
            ) : onboardingStatus === 'approved' ? (
              <div className="mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success-500/10 text-success-500 border border-success-500/20">
                  Approved
                </span>
                <p className="text-xs text-surface-400 dark:text-surface-500 mt-2">Redirecting to dashboard...</p>
              </div>
            ) : (
              <div className="mb-6 space-y-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Under Review
                </span>
                {submittedAt && (
                  <p className="text-xs text-surface-400 dark:text-surface-500">
                    Submitted {formatDate(submittedAt)}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {onboardingStatus === 'pending' && (
                <button
                  onClick={handleCheckStatus}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {loading ? 'Checking...' : 'Check Status'}
                </button>
              )}

              {onboardingStatus === 'rejected' && (
                <a
                  href="mailto:hod@computer.engineering.uniuyo.edu.ng?subject=ACES%20Zone%20Registration%20Appeal&body=Hello%20HOD%2C%0A%0AI%20am%20writing%20regarding%20my%20rejected%20registration%20on%20ACES%20Zone.%0A%0AMy%20name%3A%20${encodeURIComponent(displayName)}%0AMatric%20Number%3A%20${encodeURIComponent(displayMatric)}%0A%0APlease%20let%20me%20know%20if%20there%20are%20any%20issues%20I%20can%20address.%0A%0AThank%20you."
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-danger-500 hover:bg-danger-600 text-white text-sm font-medium transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Contact HOD
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>
              )}

              <a
                href="mailto:hod@computer.engineering.uniuyo.edu.ng?subject=ACES%20Zone%20Registration%20Inquiry"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800/80 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Contact HOD
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </a>
            </div>
          </div>

          <div className="px-8 py-4 bg-surface-50 dark:bg-surface-800/40 border-t border-surface-200/60 dark:border-surface-700/60">
            <p className="text-[11px] text-surface-400 dark:text-surface-500 text-center">
              Association of Computer Engineering Students — Uniuyo Chapter
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaitingDashboardPage;
