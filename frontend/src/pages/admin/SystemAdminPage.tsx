import { useState } from 'react';
import { Calendar, BarChart3, Database, HelpCircle, MessageSquare, ShieldAlert, Wrench } from 'lucide-react';
import CalendarPage from './CalendarPage';
import ReportsPage from './ReportsPage';
import BackupPage from './BackupPage';
import ComplaintsManagePage from './ComplaintsManagePage';
import FeedbackManagePage from './FeedbackManagePage';
import FeatureFlagsPage from './FeatureFlagsPage';

type Tab = 'calendar' | 'reports' | 'backups' | 'complaints' | 'feedback' | 'feature-flags';

const tabs: { key: Tab; label: string; icon: typeof Calendar }[] = [
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'backups', label: 'Backups', icon: Database },
  { key: 'complaints', label: 'Complaints', icon: HelpCircle },
  { key: 'feedback', label: 'Feedback', icon: MessageSquare },
  { key: 'feature-flags', label: 'Feature Flags', icon: ShieldAlert },
];

export default function SystemAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('calendar');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-surface-100 dark:bg-surface-800 rounded-xl">
          <Wrench className="w-6 h-6 text-surface-600 dark:text-surface-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Operations</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">Calendar, reports, backups, complaints, feedback, and feature flags.</p>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap border-b border-surface-200 dark:border-surface-800 pb-px">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20'
                : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800/50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'calendar' && <CalendarPage />}
        {activeTab === 'reports' && <ReportsPage />}
        {activeTab === 'backups' && <BackupPage />}
        {activeTab === 'complaints' && <ComplaintsManagePage />}
        {activeTab === 'feedback' && <FeedbackManagePage />}
        {activeTab === 'feature-flags' && <FeatureFlagsPage />}
      </div>
    </div>
  );
}
