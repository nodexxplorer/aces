import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { getClassRepClassList, sendClassNotification, type ClassRepStudent } from '../../api/class-rep';
import { Search, Send, Users, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';

const NotifyStudentsPage = () => {
  const { success, error: notifyError } = useNotification();
  const [students, setStudents] = useState<ClassRepStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<{ student_id: string; status: 'sent' | 'failed'; error?: string }[] | null>(
    null,
  );

  useEffect(() => {
    getClassRepClassList()
      .then((data) => setStudents(data))
      .catch(() => notifyError('Error', 'Failed to load class list'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.matric_number.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s) => s.id)));
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      notifyError('Validation', 'Title and message are required');
      return;
    }
    if (selected.size === 0) {
      notifyError('Validation', 'Select at least one student');
      return;
    }

    setSending(true);
    setResults(null);
    try {
      const targetUserIds = Array.from(selected).map((studentId) => {
        const student = students.find((s) => s.id === studentId);
        return student?.user_id || studentId;
      });
      const res = await sendClassNotification(targetUserIds, title.trim(), message.trim());
      setResults(res);
      const sent = res.filter((r) => r.status === 'sent').length;
      const failed = res.filter((r) => r.status === 'failed').length;
      if (failed === 0) {
        success('Notification Sent', `Successfully sent to ${sent} student${sent !== 1 ? 's' : ''}`);
        setTitle('');
        setMessage('');
        setSelected(new Set());
      } else {
        notifyError('Partial Failure', `${sent} sent, ${failed} failed`);
      }
    } catch (e: unknown) {
      notifyError('Error', getErrorMessage(e, 'Failed to send notifications'));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Send Notification to Class</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Send a notification message to students in your class level.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student list */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-500" />
                <CardTitle>Select Recipients</CardTitle>
              </div>
              <span className="text-xs text-surface-400">
                {selected.size} of {filtered.length} selected
              </span>
            </CardHeader>

            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="px-4 pb-3">
              <button
                onClick={toggleAll}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
              >
                {selected.size === filtered.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800">
              {filtered.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggleSelect(s.id)}
                    className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500/20"
                  />
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    {s.full_name
                      ?.split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{s.full_name}</p>
                    <p className="text-xs text-surface-400">{s.matric_number}</p>
                  </div>
                  {s.is_defaulter && <Badge variant="danger">Defaulter</Badge>}
                </label>
              ))}
              {filtered.length === 0 && <p className="text-xs text-surface-400 text-center py-6">No students found</p>}
            </div>
          </Card>
        </div>

        {/* Compose */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Compose Notification</CardTitle>
              <CardDescription>This will be sent as an in-app notification to selected students</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-600 dark:text-surface-300 mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Meeting Reminder"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-600 dark:text-surface-300 mb-1">
                  Message
                </label>
                <textarea
                  rows={5}
                  placeholder="Type your message here..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                leftIcon={sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                onClick={handleSend}
                disabled={sending || selected.size === 0 || !title.trim() || !message.trim()}
              >
                {sending ? 'Sending...' : `Send to ${selected.size} Student${selected.size !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </Card>

          {/* Results */}
          {results && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Delivery Results</CardTitle>
              </CardHeader>
              <div className="p-4 pt-0 space-y-1">
                {results.map((r) => {
                  const student = students.find((s) => s.id === r.student_id || s.user_id === r.student_id);
                  return (
                    <div key={r.student_id} className="flex items-center gap-2 text-xs">
                      {r.status === 'sent' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-success-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-danger-500 shrink-0" />
                      )}
                      <span className="text-surface-700 dark:text-surface-300 truncate">
                        {student?.full_name || r.student_id}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotifyStudentsPage;
