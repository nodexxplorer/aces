import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { Calendar } from 'lucide-react';

const mockEvents = [
  { id: '1', title: 'Department Homecoming Dinner 2026', date: '2026-11-20', location: 'ETF Hall' },
];

const AlumniEventsPage = () => {
  const { success } = useNotification();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Alumni Events</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Stay updated on alumni dinners, fundraisers and technical networking summits.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mockEvents.map((e) => (
          <Card key={e.id} className="p-6 flex gap-4">
            <div className="p-3 bg-primary-50 dark:bg-primary-950/20 text-primary-500 rounded-lg shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-surface-900 dark:text-white mb-1">{e.title}</h3>
              <p className="text-xs text-surface-500 mb-4">{e.date} · {e.location}</p>
              <Button size="sm" onClick={() => success('Registered', 'You have registered for the homecoming dinner event.')}>
                Register Seat
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AlumniEventsPage;
