import { useState } from 'react';
import { Bell, Megaphone, Pin, Calendar } from 'lucide-react';
import Tabs from '../../components/ui/Tabs';
import NotificationsTab from '../shared/NotificationsPage';
import AnnouncementsTab from '../shared/StudentAnnouncementsPage';
import NoticesTab from '../shared/ClassNoticeBoardPage';
import CalendarTab from '../admin/CalendarPage';

const communicationTabs = [
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'announcements', label: 'Announcements', icon: <Megaphone className="w-4 h-4" /> },
  { id: 'notices', label: 'Notice Board', icon: <Pin className="w-4 h-4" /> },
  { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-4 h-4" /> },
];

export default function StudentCommunicationPage() {
  const initialTab = new URLSearchParams(window.location.search).get('tab');
  const [activeTab, setActiveTab] = useState(
    communicationTabs.some((t) => t.id === initialTab) ? (initialTab as string) : 'notifications',
  );

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Communication</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Notifications, announcements, and class notices
          </p>
        </div>

        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
          <div className="px-4">
            <Tabs tabs={communicationTabs} activeTab={activeTab} onChange={setActiveTab} />
          </div>

          <div className="p-4">
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'announcements' && <AnnouncementsTab />}
            {activeTab === 'notices' && <NoticesTab />}
            {activeTab === 'calendar' && <CalendarTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
