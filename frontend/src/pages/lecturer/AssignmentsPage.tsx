import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import { createAssignment, getAssignments, deleteAssignment } from '../../api/assignments';
import { getCourses } from '../../api/courses';
import { getSessions, listSessionSemesters } from '../../api/sessions';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { Save, Plus, ArrowLeft, Trash2 } from 'lucide-react';
import type { Assignment, Course, Session, SemesterEntry } from '../../types';

const AssignmentsPage = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [semesters, setSemesters] = useState<SemesterEntry[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [createMode, setCreateMode] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCourses()
      .then((res) => {
        setCourses(res);
        if (res.length > 0) setSelectedCourseId(res[0].id);
      })
      .catch(() => notifyError('Error', 'Failed to load courses'));

    getSessions()
      .then((res) => {
        setSessions(res);
        const active = res.find((s) => s.is_active) || res[0];
        if (active) setSessionId(active.id);
      })
      .catch(() => notifyError('Error', 'Failed to load sessions'));
  }, []);

  // Semesters are scoped to a session — reload whenever the session changes,
  // and auto-pick the active one so the lecturer never has to hunt for a
  // session/semester UUID by hand.
  useEffect(() => {
    if (!sessionId) {
      setSemesters([]);
      setSemesterId('');
      return;
    }
    listSessionSemesters(sessionId)
      .then((res) => {
        setSemesters(res);
        const active = res.find((s) => s.is_active) || res[res.length - 1];
        setSemesterId(active?.id || '');
      })
      .catch(() => setSemesters([]));
  }, [sessionId]);

  useEffect(() => {
    if (!selectedCourseId || !sessionId) {
      setAssignments([]);
      return;
    }
    setLoading(true);
    getAssignments(selectedCourseId, sessionId)
      .then(setAssignments)
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  }, [selectedCourseId, sessionId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !selectedCourseId || !sessionId || !semesterId || !dueDate || !user?.id) {
      notifyError('Missing Fields', 'Select a session/semester and fill in title and due date.');
      return;
    }
    setSaving(true);
    try {
      await createAssignment({
        courseId: selectedCourseId,
        sessionId,
        semesterId,
        createdBy: user.id,
        title,
        description: desc,
        deadline: new Date(dueDate).toISOString(),
        maxScore: Number(maxScore) || 100,
      });
      setCreateMode(false);
      setTitle('');
      setDesc('');
      setDueDate('');
      setMaxScore('100');
      success('Assignment Created', 'Successfully published assignment.');
      getAssignments(selectedCourseId, sessionId).then(setAssignments);
    } catch {
      notifyError('Error', 'Failed to create assignment.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAssignment(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      success('Deleted', 'Assignment removed.');
    } catch {
      notifyError('Error', 'Failed to delete assignment.');
    }
  };

  const columns = [
    {
      key: 'title',
      label: 'Assignment Title',
      render: (val: unknown) => <span className="font-semibold">{val as string}</span>,
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (val: unknown) => (val ? new Date(val as string).toLocaleDateString() : 'N/A'),
    },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: Assignment) => (
        <Button
          variant="danger"
          size="xs"
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={() => handleDelete(row.id)}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Course Assignments</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Create tasks and evaluate submitted student lab workbooks.
          </p>
        </div>
        <Button
          onClick={() => setCreateMode(!createMode)}
          leftIcon={createMode ? <ArrowLeft className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        >
          {createMode ? 'View List' : 'Create Assignment'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 max-w-2xl">
        <select
          className="flex-1 min-w-[200px] px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} - {c.title}
            </option>
          ))}
        </select>
        <select
          className="flex-1 min-w-[160px] px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {semesters.length > 0 && (
          <select
            className="flex-1 min-w-[160px] px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={semesterId}
            onChange={(e) => setSemesterId(e.target.value)}
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {createMode ? (
        <div className="max-w-xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Configure New Task</CardTitle>
              <CardDescription>
                For {courses.find((c) => c.id === selectedCourseId)?.code} ·{' '}
                {sessions.find((s) => s.id === sessionId)?.name} ·{' '}
                {semesters.find((s) => s.id === semesterId)?.name || 'no semester available'}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleCreate} className="p-4 pt-0 space-y-4">
              <Input
                label="Assignment Title"
                placeholder="e.g. GPIO Port Config Report"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Due Date & Time"
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
                <Input
                  label="Max Score"
                  type="number"
                  min={1}
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Instructions</label>
                <textarea
                  placeholder="Provide instruction details..."
                  className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                isLoading={saving}
                disabled={!semesterId}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Publish Assignment
              </Button>
            </form>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Task List</CardTitle>
            <CardDescription>{loading ? 'Loading...' : `${assignments.length} assignment(s)`}</CardDescription>
          </CardHeader>
          <DataTable columns={columns} data={assignments} />
        </Card>
      )}
    </div>
  );
};

export default AssignmentsPage;
