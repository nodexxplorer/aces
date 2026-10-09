import { useEffect, useState, useCallback } from 'react';
import { Clock, Mail, RefreshCw, ExternalLink } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getMe } from '../../api/auth';
import { useCurrentDepartment } from '../../components/branding/department';
import { DepartmentLogo } from '../../components/branding/DepartmentBrand';

// A mailto link to the department's contact address, with a prefilled subject
// and, optionally, body.
const contactLink = (email: string, subject: string, body?: string) =>
  `mailto:${email}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`;

const WaitingDashboardPage = () => {
  const { user, updateUser } = useAuth();
  const { error: notifyError, success: notifySuccess } = useNotification();
  const department = useCurrentDepartment();
  const departmentName = department?.name ?? 'your department';
  const contact = department?.approvalContactEmail;
  const [loading, setLoading] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<string>(
    user?.isApproved === false && user?.isActive !== false
      ? 'pending'
      : user?.isApproved === false && user?.isActive === false
        ? 'rejected'
        : 'pending',
  );
  const [rejectionReason] = useState<string | null>(null);
  const [submittedAt] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const freshUser = await getMe();
      if (freshUser) {
        if (typeof updateUser === 'function') updateUser(freshUser);
        if (freshUser.isApproved === false && freshUser.isActive === false) {
          setApprovalStatus('rejected');
        } else if (freshUser.isApproved === true) {
          setApprovalStatus('approved');
        } else {
          setApprovalStatus('pending');
        }
        return approvalStatus;
      }
      return null;
    } catch {
      return null;
    }
  }, [updateUser, approvalStatus]);

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
    if (approvalStatus === 'approved') {
      const timer = setTimeout(() => {
        window.location.href = '/dashboard';
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [approvalStatus]);

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
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-lg">
        <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-900">
          {/* The department comes first; the page is about its approval, not the platform. */}
          {department && (
            <div className="flex items-center gap-3 border-b border-surface-200 px-6 py-4 dark:border-surface-800 sm:px-8">
              <DepartmentLogo department={department} className="h-10 w-10 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-surface-900 dark:text-surface-100">
                  {department.name}
                </p>
                {department.institution && (
                  <p className="truncate text-xs text-surface-500 dark:text-surface-400">{department.institution}</p>
                )}
              </div>
            </div>
          )}

          <div className="px-6 py-8 sm:px-8">
            <h2 className="flex items-center gap-2 text-xl font-bold text-surface-900 dark:text-white">
              <Clock className="h-5 w-5 shrink-0 text-surface-400" aria-hidden="true" />
              Waiting for Approval
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-surface-500 dark:text-surface-400">
              Your account is being reviewed by {departmentName}.
            </p>

            <div className="mt-5">
              {approvalStatus === 'rejected' ? (
                <div>
                  <span className="inline-flex items-center whitespace-nowrap rounded-full border border-danger-500/20 bg-danger-500/10 px-3 py-1 text-xs font-semibold text-danger-600 dark:text-danger-400">
                    Rejected
                  </span>
                  {rejectionReason && (
                    <div className="mt-3 rounded-xl border border-danger-500/10 bg-danger-500/5 p-3 text-left">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-danger-600 dark:text-danger-400">
                        Reason:
                      </span>
                      <p className="text-sm text-surface-700 dark:text-surface-300">&quot;{rejectionReason}&quot;</p>
                    </div>
                  )}
                </div>
              ) : approvalStatus === 'approved' ? (
                <div>
                  <span className="inline-flex items-center whitespace-nowrap rounded-full border border-success-500/20 bg-success-500/10 px-3 py-1 text-xs font-semibold text-success-600 dark:text-success-400">
                    Approved
                  </span>
                  <p className="mt-2 text-xs text-surface-400 dark:text-surface-500">Redirecting to dashboard...</p>
                </div>
              ) : (
                <div>
                  <span className="inline-flex items-center whitespace-nowrap rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Under Review
                  </span>
                  {submittedAt && (
                    <p className="mt-2 text-xs text-surface-400 dark:text-surface-500">
                      Submitted {formatDate(submittedAt)}
                    </p>
                  )}
                </div>
              )}
            </div>

            <dl className="mt-6 divide-y divide-surface-200 rounded-xl border border-surface-200 dark:divide-surface-800 dark:border-surface-800">
              {[
                ['Name', displayName],
                ['Matric Number', displayMatric],
                ['Level', displayLevel],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-surface-400 dark:text-surface-500">
                    {label}
                  </dt>
                  <dd className="min-w-0 truncate text-sm font-semibold text-surface-800 dark:text-surface-200">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-col gap-3">
              {approvalStatus === 'pending' && (
                <button
                  onClick={handleCheckStatus}
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {loading ? 'Checking...' : 'Check Status'}
                </button>
              )}

              {approvalStatus === 'rejected' && contact && (
                <a
                  href={contactLink(
                    contact,
                    `Registration appeal - ${departmentName}`,
                    `Hello,\n\nI am writing regarding my rejected registration on ${departmentName}.\n\nMy name: ${displayName}\nMatric Number: ${displayMatric}\n\nPlease let me know if there are any issues I can address.\n\nThank you.`,
                  )}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                >
                  <Mail className="h-4 w-4" />
                  Appeal by email
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </a>
              )}

              {contact ? (
                <a
                  href={contactLink(contact, `Registration inquiry - ${departmentName}`)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-surface-200 px-5 py-2.5 text-sm font-medium text-surface-600 transition-colors hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800/80"
                >
                  <Mail className="h-4 w-4" />
                  Contact the department
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </a>
              ) : (
                <p className="text-center text-xs text-surface-400 dark:text-surface-500">
                  Contact your department office for help.
                </p>
              )}
            </div>
          </div>

          {department && (
            <div className="border-t border-surface-200 bg-surface-50 px-6 py-3 dark:border-surface-800 dark:bg-surface-800/40 sm:px-8">
              <p className="text-center text-[11px] text-surface-400 dark:text-surface-500">
                {[department.name, department.institution].filter(Boolean).join(' · ')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WaitingDashboardPage;
