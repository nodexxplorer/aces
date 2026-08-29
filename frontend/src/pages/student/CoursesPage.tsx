import { useState } from 'react';
import { BookMarked, FolderOpen } from 'lucide-react';
import CourseRegistrationPage from './CourseRegistrationPage';
import StudentCourseMaterialsPage from './CourseMaterialsPage';

type Tab = 'register' | 'materials';

const TAB_FROM_PARAM: Record<string, Tab> = {
  register: 'register',
  materials: 'materials',
};

const tabs: { key: Tab; label: string; icon: typeof BookMarked }[] = [
  { key: 'register', label: 'Course Registration', icon: BookMarked },
  { key: 'materials', label: 'Course Materials', icon: FolderOpen },
];

export default function CoursesPage() {
  const params = new URLSearchParams(window.location.search);
  const initialTab = TAB_FROM_PARAM[params.get('tab') ?? ''] ?? 'register';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Courses</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Register for courses and access course materials.
        </p>
      </div>

      <div className="flex gap-1 flex-wrap border-b border-surface-200 dark:border-surface-800 pb-px">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20'
                : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'register' && <CourseRegistrationPage />}
      {activeTab === 'materials' && <StudentCourseMaterialsPage />}
    </div>
  );
}
