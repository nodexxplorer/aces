import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Download, MapPin, User, Clock } from 'lucide-react';

const mockSlots = [
  { day: 'Monday', time: '08:00 AM - 10:00 AM', course: 'CPE 511', title: 'Embedded Systems', venue: 'ETF Lab II', lecturer: 'Dr. Jane Smith' },
  { day: 'Monday', time: '10:00 AM - 12:00 PM', course: 'CPE 513', title: 'Computer Architecture II', venue: 'ETF Hall A', lecturer: 'Dr. John Doe' },
  { day: 'Tuesday', time: '02:00 PM - 04:00 PM', course: 'EEE 511', title: 'Control Engineering I', venue: 'Power Hall', lecturer: 'Engr. Obi' },
  { day: 'Wednesday', time: '09:00 AM - 11:00 AM', course: 'GST 111', title: 'Communication English', venue: 'Assembly Hall', lecturer: 'Prof. Bassey' },
  { day: 'Thursday', time: '11:00 AM - 01:00 PM', course: 'CPE 511', title: 'Embedded Systems Lab', venue: 'ETF Lab II', lecturer: 'Dr. Jane Smith' },
];

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TimetablePage = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Academic Timetable</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Weekly class lecture schedules and locations.
          </p>
        </div>
        <Button variant="outline" leftIcon={<Download className="w-4 h-4" />} onClick={() => window.print()}>
          Print Schedule
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {days.map((day) => {
          const slots = mockSlots.filter((s) => s.day === day);
          return (
            <Card key={day} className="flex flex-col">
              <CardHeader className="border-b border-surface-150 dark:border-surface-800 pb-3 mb-3">
                <CardTitle className="text-base font-bold text-primary-500">{day}</CardTitle>
              </CardHeader>
              <div className="flex-1 space-y-3">
                {slots.length === 0 ? (
                  <p className="text-xs text-surface-400 text-center py-6">No scheduled classes</p>
                ) : (
                  slots.map((s, idx) => (
                    <div key={idx} className="p-3 bg-surface-50 dark:bg-surface-800/40 rounded-xl border border-surface-200/50">
                      <div className="flex items-center justify-between mb-1.5">
                        <Badge variant="primary">{s.course}</Badge>
                      </div>
                      <p className="text-xs font-semibold text-surface-800 dark:text-surface-200 line-clamp-1 mb-2">
                        {s.title}
                      </p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>{s.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{s.venue}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
                          <User className="w-3.5 h-3.5 shrink-0" />
                          <span>{s.lecturer}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default TimetablePage;
