import { useAuth } from '../../hooks/useAuth';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import KpiCard from '../../components/data-display/KpiCard';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { BookOpen, Users, ClipboardList, Send, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { useNotification } from '../../hooks/useNotification';
import { Link } from 'react-router-dom';

const LecturerDashboard = () => {
  const { user } = useAuth();
  const { success } = useNotification();
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [publishing, setPublishing] = useState(false);

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle || !annContent) return;
    setPublishing(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      success('Announcement Published', 'Successfully broadcasted notification to enrolled students.');
      setAnnTitle('');
      setAnnContent('');
    } finally {
      setPublishing(false);
    }
  };

  const courses = [
    { code: 'CPE 513', title: 'Computer Architecture II', students: 84 },
    { code: 'CPE 511', title: 'Embedded Systems Design', students: 78 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">
          Lecturer Portal
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Welcome back, {user?.firstName} {user?.lastName}. Manage your academic modules and score registries.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Assigned Courses" value="2 Modules" icon={<BookOpen className="w-5 h-5" />} />
        <KpiCard title="Total Students Enrolled" value="162 Students" icon={<Users className="w-5 h-5" />} />
        <KpiCard title="Ungraded Assignments" value="14 Submissions" icon={<ClipboardList className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>My Modules</CardTitle>
              <CardDescription>Academic units assigned to you for instruction and evaluation</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0 divide-y divide-surface-150 dark:divide-surface-800">
              {courses.map((c) => (
                <div key={c.code} className="flex justify-between items-center py-3">
                  <div>
                    <h4 className="font-semibold text-sm text-surface-900 dark:text-white">{c.code}</h4>
                    <p className="text-xs text-surface-500">{c.title}</p>
                  </div>
                  <div className="flex gap-2">
                    <Link to="/lecturer/scores">
                      <Button size="xs" variant="outline" leftIcon={<ClipboardList className="w-3.5 h-3.5" />}>
                        Enter Grades
                      </Button>
                    </Link>
                    <Link to="/lecturer/class-list">
                      <Button size="xs" variant="outline" leftIcon={<Users className="w-3.5 h-3.5" />}>
                        Class List
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create Course Announcement</CardTitle>
              <CardDescription>Broadcast a push notification and news update to registered students</CardDescription>
            </CardHeader>
            <form onSubmit={handlePostAnnouncement} className="p-4 pt-0 space-y-4">
              <Input
                label="Topic Title"
                placeholder="e.g. Revision class postponed"
                value={annTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnnTitle(e.target.value)}
                required
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Message Content</label>
                <textarea
                  placeholder="Enter detailed notice instructions..."
                  className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-surface-100 p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                  value={annContent}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnnContent(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" isLoading={publishing} leftIcon={<Send className="w-4 h-4" />}>
                Post Notice
              </Button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Utilities</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0 space-y-3">
              <Link to="/lecturer/bulk-upload" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<FileSpreadsheet className="w-4 h-4" />}>
                  Excel Grade Import
                </Button>
              </Link>
              <Link to="/lecturer/assignments" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<ClipboardList className="w-4 h-4" />}>
                  Grading Assignments
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LecturerDashboard;
