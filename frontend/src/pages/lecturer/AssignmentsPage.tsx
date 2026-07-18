import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import { createAssignment, getAssignments, deleteAssignment } from '../../api/assignments';
import { getCourses } from '../../api/courses';
import { useNotification } from '../../hooks/useNotification';
import { Save, Plus, ArrowLeft, Trash2 } from 'lucide-react';
import type { Assignment, Course } from '../../types';

const AssignmentsPage = () => {
  const { success, error: notifyError } = useNotification();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [createMode, setCreateMode] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCourses()
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data ?? [];
        setCourses(list);
        if (list.length > 0) setSelectedCourseId(list[0].id);
      })
      .catch(() => notifyError('Error', 'Failed to load courses'));
  }, []);

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
    if (!title || !selectedCourseId || !sessionId) return;
    setSaving(true);
    try {
      await createAssignment({
        courseId: selectedCourseId,
        sessionId,
        title,
        description: desc,
        dueDate,
      });
      setCreateMode(false);
      setTitle('');
      setDesc('');
      setDueDate('');
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
    { key: 'title', label: 'Assignment Title', render: (val: unknown) => <span className="font-semibold">{val as string}</span> },
    { key: 'dueDate', label: 'Due Date', render: (val: unknown) => val ? new Date(val as string).toLocaleDateString() : 'N/A' },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: Assignment) => (
        <Button variant="danger" size="xs" leftIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDelete(row.id)}>
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
        <Button onClick={() => setCreateMode(!createMode)} leftIcon={createMode ? <ArrowLeft className="w-4 h-4" /> : <Plus className="w-4 h-4" />}>
          {createMode ? 'View List' : 'Create Assignment'}
        </Button>
      </div>

      <div className="flex gap-4 max-w-xl">
        <select
          className="flex-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.code} - {c.title}</option>
          ))}
        </select>
        <Input
          label="Session ID"
          placeholder="e.g. 2025/2026"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        />
      </div>

      {createMode ? (
        <div className="max-w-xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Configure New Task</CardTitle>
            </CardHeader>
            <form onSubmit={handleCreate} className="p-4 pt-0 space-y-4">
              <Input label="Assignment Title" placeholder="e.g. GPIO Port Config Report" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <Input label="Due Date & Time" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Instructions</label>
                <textarea
                  placeholder="Provide instruction details..."
                  className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
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
          <DataTable columns={columns} data={assignments as unknown as Record<string, unknown>[]} />
        </Card>
      )}
    </div>
  );
};

export default AssignmentsPage;
