import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { BookOpen, Settings, Users } from 'lucide-react';
import CourseManagementPage from './CourseManagementPage';
import AdminCourseRegistrationsPage from './AdminCourseRegistrationsPage';

type Tab = 'courses' | 'registrations';

export default function CourseHubPage() {
  const [activeTab, setActiveTab] = useState<Tab>('courses');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-surface-100 dark:bg-surface-800 rounded-xl">
          <BookOpen className="w-6 h-6 text-surface-600 dark:text-surface-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Course Management</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">Manage courses, lecturers, and student registrations.</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-surface-200 dark:border-surface-800 pb-px">
        {([
          { key: 'courses' as Tab, label: 'Courses', icon: Settings },
          { key: 'registrations' as Tab, label: 'Student Registrations', icon: Users },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
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

      {activeTab === 'courses' && <CourseManagementPage />}
      {activeTab === 'registrations' && <AdminCourseRegistrationsPage />}
    </div>
  );
}
