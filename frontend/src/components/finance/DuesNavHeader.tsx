import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, CreditCard, FileText, TrendingUp } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { departmentAdminPath, isAdminArea } from '../../config/departmentAdminPaths';

/**
 * The tabs of the Dues & Payments area. The admin area has Dues, Transactions
 * and Revenue forecast. The bursar area has Dues, Transactions and Verify.
 */
export type DuesTabKey = 'dues' | 'transactions' | 'forecast' | 'verify';

interface DuesNavHeaderProps {
  activeTab: DuesTabKey;
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  onTabChange?: (tab: DuesTabKey) => void;
}

interface DuesTab {
  key: DuesTabKey;
  label: string;
  path: string;
  icon: React.ReactNode;
}

const ADMIN_TABS: DuesTab[] = [
  { key: 'dues', label: 'Dues', path: '/admin/duesmanagement', icon: <CreditCard className="w-4 h-4" /> },
  { key: 'transactions', label: 'Transactions', path: '/admin/transactions', icon: <FileText className="w-4 h-4" /> },
  {
    key: 'forecast',
    label: 'Revenue forecast',
    path: '/admin/revenue-forecast',
    icon: <TrendingUp className="w-4 h-4" />,
  },
];

const BURSAR_TABS: DuesTab[] = [
  { key: 'dues', label: 'Dues', path: '/bu/dues', icon: <CreditCard className="w-4 h-4" /> },
  { key: 'transactions', label: 'Transactions', path: '/bu/history', icon: <FileText className="w-4 h-4" /> },
  { key: 'verify', label: 'Verify', path: '/bu/verify', icon: <CheckCircle className="w-4 h-4" /> },
];

const DEFAULT_TITLES: Record<DuesTabKey, string> = {
  dues: 'Dues management',
  transactions: 'Transactions',
  forecast: 'Revenue forecast',
  verify: 'Verify payments',
};

const DEFAULT_SUBTITLES: Record<DuesTabKey, string> = {
  dues: 'Create, manage and track class and departmental dues.',
  transactions: 'Review full payment transactions, receipts, and verifications.',
  forecast: 'Projections based on your historical payment data.',
  verify: 'Search by Paystack reference, confirm transactions, and approve manually if needed.',
};

export const DuesNavHeader: React.FC<DuesNavHeaderProps> = ({
  activeTab,
  title,
  subtitle,
  rightAction,
  onTabChange,
}) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const urlCode = user?.tenant?.urlCode;
  const tabs = isAdminArea(pathname) ? ADMIN_TABS : BURSAR_TABS;

  const handleTabClick = (tab: DuesTab) => {
    if (onTabChange) {
      onTabChange(tab.key);
      return;
    }
    navigate(departmentAdminPath(urlCode, tab.path));
  };

  return (
    <div className="space-y-4 mb-6">
      {/* ─── Breadcrumb & Title ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">Dues &amp; Payments</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {title || DEFAULT_TITLES[activeTab]}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {subtitle || DEFAULT_SUBTITLES[activeTab]}
          </p>
        </div>

        {rightAction && <div className="self-start sm:self-auto">{rightAction}</div>}
      </div>

      {/* ─── Dues & Payments Sub-Navigation Tabs ─── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabClick(tab)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === tab.key
                ? 'bg-[#1a66d6] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
