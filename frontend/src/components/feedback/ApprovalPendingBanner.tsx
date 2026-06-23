import { Clock, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const ApprovalPendingBanner = () => {
  const { user } = useAuth();

  if (!user || user.approvalStatus !== 'pending') return null;

  return (
    <div
      role="status"
      className="w-full flex items-start gap-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-700/50 rounded-xl p-4"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-warning-100 dark:bg-warning-900/40 flex items-center justify-center">
        <Clock className="w-5 h-5 text-warning-600 dark:text-warning-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-warning-800 dark:text-warning-300 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" /> Account Pending Approval
        </p>
        <p className="text-xs text-warning-700 dark:text-warning-400 mt-0.5 leading-relaxed">
          Your account is awaiting verification by department administrators. Some features are restricted until your identity is confirmed.
        </p>
      </div>
    </div>
  );
};

export default ApprovalPendingBanner;
