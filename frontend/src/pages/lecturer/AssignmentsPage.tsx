import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { Save, Plus, ArrowLeft, Download, Check } from 'lucide-react';
import type { Assignment } from '../../types';

const mockAssignments: Assignment[] = [
  {
    id: 'asg-1',
    courseId: 'c-1',
    title: 'Embedded System GPIO Architecture Report',
    description: 'Explain GPIO input/output modes and write assembly program configurations.',
    dueDate: '2026-06-25T23:59:59Z',
    maxPoints: 100,
    isClosed: false,
    createdAt: '',
  },
];

const mockSubmissions = [
  { id: 'sub-1', studentName: 'John Doe', matricNumber: 'ENG/2021/001', submittedAt: '2026-06-20T12:00:00Z', status: 'pending', score: '', feedback: '' },
];

const AssignmentsPage = () => {
  const { success } = useNotification();
  const [assignments, setAssignments] = useState<Assignment[]>(mockAssignments);
  const [submissions, setSubmissions] = useState(mockSubmissions);
  const [createMode, setCreateMode] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [points, setPoints] = useState('100');
  const [dueDate, setDueDate] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !dueDate) return;
    const newAsg: Assignment = {
      id: `asg-${Date.now()}`,
      courseId: 'c-1',
      title,
      description: desc,
      dueDate,
      maxPoints: parseInt(points),
      isClosed: false,
      createdAt: new Date().toISOString(),
    };
    setAssignments((prev) => [newAsg, ...prev]);
    setCreateMode(false);
    setTitle('');
    setDesc('');
    success('Assignment Created', 'Successfully broadcasted assignment task to all registered students.');
  };

  const handleGradeSubmission = (idx: number, score: string, feedback: string) => {
    setSubmissions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], score, feedback, status: 'graded' };
      return copy;
    });
    success('Submission Graded', 'Score and feedback applied successfully.');
  };

  const columns = [
    { key: 'title', label: 'Assignment Title', render: (val: unknown) => <span className="font-semibold">{val as string}</span> },
    { key: 'dueDate', label: 'Due Date', render: (val: unknown) => new Date(val as string).toLocaleDateString() },
    { key: 'maxPoints', label: 'Points' },
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

      {createMode ? (
        <div className="max-w-xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Configure New Task</CardTitle>
            </CardHeader>
            <form onSubmit={handleCreate} className="p-4 pt-0 space-y-4">
              <Input label="Assignment Title" placeholder="e.g. GPIO Port Config Report" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <Input label="Max Points" type="number" value={points} onChange={(e) => setPoints(e.target.value)} required />
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
              <Button type="submit" className="w-full" leftIcon={<Save className="w-4 h-4" />}>
                Publish Assignment
              </Button>
            </form>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Task List</CardTitle>
              </CardHeader>
              <DataTable columns={columns} data={assignments as unknown as Record<string, unknown>[]} />
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Grading Queue</CardTitle>
              <CardDescription>Evaluate recent files submitted by students</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0 space-y-4">
              {submissions.map((sub, idx) => (
                <div key={sub.id} className="p-4 bg-surface-50 dark:bg-surface-800/40 rounded-xl border border-surface-200/50 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-sm">{sub.studentName}</h4>
                      <p className="text-[10px] text-surface-500">{sub.matricNumber}</p>
                    </div>
                    <StatusBadge status={sub.status} />
                  </div>
                  <Button variant="outline" size="xs" className="w-full justify-center" leftIcon={<Download className="w-3.5 h-3.5" />}>
                    Download Document
                  </Button>
                  <div className="flex gap-2">
                    <Input placeholder="Score /100" value={sub.score} onChange={(e) => handleGradeSubmission(idx, e.target.value, '')} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AssignmentsPage;
