import { BookOpen, Award, CreditCard, Users, Megaphone, Calendar } from 'lucide-react';
import KpiCard from '../../components/data-display/KpiCard';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../hooks/useAuth';
import { formatGPA } from '../../utils/formatters';

const StudentDashboard = () => {
  const { user } = useAuth();

  const announcements = [
    {
      id: '1',
      title: 'First Semester Examination Timetable',
      content: 'The official examination timetable for the 2025/2026 session is out. Exams begin next month.',
      date: '2 hours ago',
      category: 'Academic',
    },
    {
      id: '2',
      title: 'ACES Annual Tech Conference',
      content: 'Register for the upcoming ACES annual symposium featuring top industry engineers and alumni.',
      date: '1 day ago',
      category: 'Event',
    },
  ];

  const recentCourses = [
    { code: 'EEE 511', title: 'Control Engineering I', cu: 3, time: 'Mon 10:00 AM' },
    { code: 'CPE 513', title: 'Computer Architecture II', cu: 3, time: 'Tue 02:00 PM' },
    { code: 'CPE 515', title: 'Embedded Systems Design', cu: 4, time: 'Thu 09:00 AM' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">
          Hello, {user?.firstName || 'Student'}!
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Here is your academic and campus overview for the current semester.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Current CGPA" value={formatGPA(3.85)} icon={<Award className="w-5 h-5" />} />
        <KpiCard title="Credits Registered" value="18 / 24" icon={<BookOpen className="w-5 h-5" />} />
        <KpiCard title="Department Dues" value="Cleared" icon={<CreditCard className="w-5 h-5" />} />
        <KpiCard title="Campus Connections" value="42" icon={<Users className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-primary-500" />
                <CardTitle>Department Announcements</CardTitle>
              </div>
            </CardHeader>
            <div className="space-y-4">
              {announcements.map((ann) => (
                <div key={ann.id} className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200/50 dark:border-surface-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="primary">{ann.category}</Badge>
                    <span className="text-xs text-surface-400">{ann.date}</span>
                  </div>
                  <h4 className="font-semibold text-surface-900 dark:text-surface-100 text-sm mb-1">{ann.title}</h4>
                  <p className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed">{ann.content}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-500" />
                <CardTitle>Today's Courses</CardTitle>
              </div>
            </CardHeader>
            <div className="space-y-3">
              {recentCourses.map((c) => (
                <div key={c.code} className="flex justify-between items-center p-3 rounded-lg border border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900">
                  <div>
                    <h5 className="font-semibold text-sm text-surface-900 dark:text-surface-100">{c.code}</h5>
                    <p className="text-[10px] text-surface-500 truncate max-w-[150px]">{c.title}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-primary-500">{c.time}</span>
                    <p className="text-[10px] text-surface-400">{c.cu} Credits</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
