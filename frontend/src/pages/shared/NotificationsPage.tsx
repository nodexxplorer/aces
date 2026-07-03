import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Bell } from 'lucide-react';

const mockNotifications = [
  { id: '1', title: 'Grade Published', message: 'CPE 511 continuous assessment grades are now published.', date: '2026-06-20' },
];

const NotificationsPage = () => {
  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Notifications</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review recent push notification logs.
        </p>
      </div>

      <div className="space-y-4">
        {mockNotifications.map((n) => (
          <Card key={n.id} className="p-4 flex gap-3">
            <Bell className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm text-surface-900 dark:text-white">{n.title}</h4>
              <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">{n.message}</p>
              <p className="text-[10px] text-surface-400 mt-2">{n.date}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default NotificationsPage;
