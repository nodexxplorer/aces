import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, Circle, Clock, Mail, RefreshCw, ExternalLink } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getMe } from '../../api/auth';
import { useCurrentDepartment } from '../../components/branding/department';
import { DepartmentLogo } from '../../components/branding/DepartmentBrand';
import { departmentDashboardPath } from '../../config/departmentAdminPaths';

const contactLink = (email: string, subject: string, body?: string) =>
  `mailto:${email}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`;

const WaitingDashboardPage = () => {
  const { user, updateUser } = useAuth();
  const { error: notifyError, success: notifySuccess } = useNotification();
  const department = useCurrentDepartment();
  const departmentName = department?.name ?? 'your department';
  const contact = department?.approvalContactEmail;
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [approvalStatus, setApprovalStatus] = useState<string>(
    user?.isApproved === false && user?.isActive !== false
      ? 'pending'
      : user?.isApproved === false && user?.isActive === false
        ? 'rejected'
        : 'pending',
  );

  const isLecturer = user?.role === 'lecturer' || user?.activeRole === 'lecturer' || user?.roles?.includes('lecturer');
  const rejectionReason = user?.rejectionReason || null;
  const submittedAt = user?.createdAt || user?.created_at || null;

  const fetchStatus = useCallback(async () => {
    try {
      const freshUser = await getMe();
      if (freshUser) {
        if (typeof updateUser === 'function') updateUser(freshUser);
        let next = 'pending';
        if (freshUser.isApproved === false && freshUser.isActive === false) {
          next = 'rejected';
        } else if (freshUser.isApproved === true) {
          next = 'approved';
        }
        setApprovalStatus(next);
        return next;
      }
      return null;
    } catch {
      return null;
    }
  }, [updateUser]);

  const handleCheckStatus = useCallback(async () => {
    setLoading(true);
    const status = await fetchStatus();
    if (status === 'approved') {
      notifySuccess('Approved', 'Your account has been approved!');
    } else if (status === 'rejected') {
      notifyError('Rejected', 'Your registration was not approved.');
    } else {
      notifySuccess('Status updated', 'Your status is still under review.');
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

  const dashboardPath = departmentDashboardPath(user?.tenant?.urlCode, user?.activeRole || user?.role);

  useEffect(() => {
    if (approvalStatus !== 'approved') return;
    setSecondsLeft(3);
    const tick = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    const timer = setTimeout(() => {
      window.location.href = dashboardPath;
    }, 3000);
    return () => {
      clearInterval(tick);
      clearTimeout(timer);
    };
  }, [approvalStatus, dashboardPath]);

  const displayName =
    user?.fullName || user?.full_name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Student';
  const displayMatric = user?.matricNumber || user?.matric_number || 'N/A';
  const displayLevel = user?.level ? `Level ${user.level}` : 'N/A';
  const roleLabel = isLecturer ? 'Lecturer' : (user?.role || user?.activeRole || 'Student').replace(/_/g, ' ');

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const steps = [
    {
      title: 'Account created',
      detail: isLecturer ? 'Your staff account was set up' : 'Your account was set up',
      done: Boolean(user?.id || user?.createdAt),
    },
    ...(user?.emailVerified !== undefined
      ? [
          {
            title: 'Email confirmed',
            detail: user.emailVerified ? 'Your school email is verified' : 'Your school email is not verified yet',
            done: Boolean(user.emailVerified),
          },
        ]
      : []),
    {
      title: 'Department review',
      detail:
        approvalStatus === 'approved'
          ? 'Approved by the HOD'
          : approvalStatus === 'rejected'
            ? 'Your registration was not approved'
            : 'The HOD is checking your account',
      done: approvalStatus === 'approved',
      current: approvalStatus === 'pending',
    },
    {
      title: 'Access granted',
      detail: approvalStatus === 'approved' ? 'Taking you to your dashboard' : 'Starts when you are approved',
      done: approvalStatus === 'approved',
    },
  ];

  const detailRows = isLecturer
    ? [
        ['NAME', displayName],
        ['ROLE', roleLabel],
        ['DEPARTMENT', departmentName === 'your department' ? '' : departmentName],
      ]
    : [
        ['Name', displayName],
        ['Matric Number', displayMatric],
        ['Level', displayLevel],
      ];

  return (
    <div className="px-4 py-8 sm:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-900">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-6 py-8 sm:px-8">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-surface-900 dark:text-white">
                {approvalStatus === 'approved' ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
                ) : (
                  <Clock className="h-5 w-5 shrink-0 text-surface-400" aria-hidden="true" />
                )}
                {approvalStatus === 'approved' ? 'You are approved' : 'Waiting for Approval'}
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-surface-500 dark:text-surface-400">
                {approvalStatus === 'approved' ? (
                  <>
                    Welcome to {departmentName}, {user?.firstName || displayName.split(' ')[0]}.
                  </>
                ) : (
                  <>Your account is being reviewed by {departmentName}.</>
                )}
              </p>

              <ol className="mt-6 space-y-4">
                {steps.map((step) => (
                  <li key={step.title} className="flex items-start gap-3">
                    {step.done ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <Circle
                        className={`w-5 h-5 shrink-0 mt-0.5 ${step.current ? 'text-amber-500' : 'text-surface-300'}`}
                      />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-surface-900 dark:text-white">{step.title}</p>
                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <div className="mt-5 lg:mt-0">
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
                    <p className="mt-2 text-xs text-surface-400 dark:text-surface-500">
                      Taking you to your dashboard {secondsLeft}s
                    </p>
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
                {detailRows
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
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

                {approvalStatus === 'approved' && (
                  <a
                    href={dashboardPath}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-medium text-white"
                  >
                    Go to dashboard
                  </a>
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
