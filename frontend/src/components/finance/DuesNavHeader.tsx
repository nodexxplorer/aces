import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, FileText, TrendingUp } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { departmentAdminPath } from '../../config/departmentAdminPaths';

export type DuesTabKey = 'dues' | 'transactions' | 'forecast';

interface DuesNavHeaderProps {
  activeTab: DuesTabKey;
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  onTabChange?: (tab: DuesTabKey) => void;
}

export const DuesNavHeader: React.FC<DuesNavHeaderProps> = ({
  activeTab,
  title,
  subtitle,
  rightAction,
  onTabChange,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const urlCode = user?.tenant?.urlCode;

  const handleTabClick = (key: DuesTabKey) => {
    if (onTabChange) {
      onTabChange(key);
      return;
    }
    if (key === 'dues') {
      navigate(departmentAdminPath(urlCode, '/bursar/dues'));
    } else if (key === 'transactions') {
      navigate(departmentAdminPath(urlCode, '/bursar/history'));
    } else if (key === 'forecast') {
      navigate(departmentAdminPath(urlCode, '/admin/revenue-forecast'));
    }
  };

  const defaultTitle =
    activeTab === 'dues' ? 'Dues management' : activeTab === 'transactions' ? 'Transactions' : 'Revenue forecast';

  const defaultSubtitle =
    activeTab === 'dues'
      ? 'Create, manage and track class and departmental dues.'
      : activeTab === 'transactions'
        ? 'Review full payment transactions, receipts, and verifications.'
        : 'Projections based on your historical payment data.';

  return (
    <div className="space-y-4 mb-6">
      {/* ─── Breadcrumb & Title ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">Dues &amp; Payments</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {title || defaultTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle || defaultSubtitle}</p>
        </div>

        {rightAction && <div className="self-start sm:self-auto">{rightAction}</div>}
      </div>

      {/* ─── Dues & Payments Sub-Navigation Tabs ─── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleTabClick('dues')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'dues'
              ? 'bg-[#1a66d6] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Dues</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabClick('transactions')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'transactions'
              ? 'bg-[#1a66d6] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Transactions</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabClick('forecast')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'forecast'
              ? 'bg-[#1a66d6] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Revenue forecast</span>
        </button>
      </div>
    </div>
  );
};
