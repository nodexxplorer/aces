import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, Clock, AlertTriangle, Circle, Calendar } from 'lucide-react';
import { createStudyTask, listMyStudyTasks, updateStudyTask, deleteStudyTask, type StudyTask } from '../../api/additional-features';
import { useAuthStore } from '../../stores/authStore';

type Priority = 'high' | 'medium' | 'low';
type Status = 'pending' | 'in_progress' | 'completed';
type FilterTab = 'all' | 'high' | 'in_progress' | 'completed';

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  high: { label: 'High', className: 'bg-red-100 text-red-700' },
  medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-700' },
  low: { label: 'Low', className: 'bg-green-100 text-green-700' },
};

const statusConfig: Record<Status, { label: string; className: string; icon: typeof Circle }> = {
  pending: { label: 'Pending', className: 'bg-surface-100 text-surface-600', icon: Circle },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700', icon: Clock },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700', icon: CheckCircle },
};

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High Priority' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

export default function StudyPlannerPage() {
  const user = useAuthStore((s) => s.user);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newDueDate, setNewDueDate] = useState('');

  const fetchTasks = async () => {
    try {
      setError('');
      const res = await listMyStudyTasks();
      const list = Array.isArray(res) ? res : ((res as { data?: StudyTask[] } | undefined)?.data ?? []);
      setTasks(list);
    } catch {
      setError('Failed to load study tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filteredTasks = tasks.filter((t) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'high') return t.priority === 'high';
    if (activeFilter === 'in_progress') return t.status === 'in_progress';
    if (activeFilter === 'completed') return t.status === 'completed';
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await createStudyTask({
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority,
        due_date: newDueDate || undefined,
      });
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      setNewDueDate('');
      setShowModal(false);
      await fetchTasks();
    } catch {
      setError('Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (task: StudyTask, nextStatus: Status) => {
    try {
      await updateStudyTask(task.id, { status: nextStatus });
      await fetchTasks();
    } catch {
      setError('Failed to update task status');
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteStudyTask(taskId);
      await fetchTasks();
    } catch {
      setError('Failed to delete task');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 p-6 space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Study Planner</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Organize your study tasks, set priorities, and track your progress.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
              activeFilter === tab.key
                ? 'bg-primary-500 text-white'
                : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-800 hover:border-primary-300 dark:hover:border-primary-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredTasks.length === 0 ? (
        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
            <Calendar className="w-8 h-8 text-surface-400" />
          </div>
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-1">No tasks yet</h3>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
            Create your first study task to start organizing your workflow.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl font-medium transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTasks.map((task) => {
            const pCfg = priorityConfig[task.priority as Priority] ?? priorityConfig.medium;
            const sCfg = statusConfig[task.status as Status] ?? statusConfig.pending;
            const StatusIcon = sCfg.icon;

            return (
              <div
                key={task.id}
                className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-5 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-surface-900 dark:text-white leading-snug">{task.title}</h3>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="shrink-0 text-surface-400 hover:text-red-500 transition-colors"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {task.description && (
                  <p className="text-sm text-surface-500 dark:text-surface-400 line-clamp-2">{task.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${pCfg.className}`}>
                    {pCfg.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${sCfg.className}`}>
                    <StatusIcon className="w-3 h-3" />
                    {sCfg.label}
                  </span>
                  {task.course_code && (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400">
                      {task.course_code}
                    </span>
                  )}
                </div>

                {task.due_date && (
                  <div className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
                    <Calendar className="w-3.5 h-3.5" />
                    Due {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}

                <div className="flex gap-2 mt-auto pt-1">
                  {task.status === 'pending' && (
                    <button
                      onClick={() => handleStatusChange(task, 'in_progress')}
                      className="flex-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-1"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Start
                    </button>
                  )}
                  {task.status === 'in_progress' && (
                    <button
                      onClick={() => handleStatusChange(task, 'completed')}
                      className="flex-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 transition-colors flex items-center justify-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Complete
                    </button>
                  )}
                  {task.status === 'completed' && (
                    <span className="flex-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 flex items-center justify-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Done
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
          <div
            className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-surface-900 dark:text-white">New Study Task</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Review Chapter 5 notes"
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 text-sm text-surface-900 dark:text-surface-100 p-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Optional details about the task..."
                  rows={3}
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 text-sm text-surface-900 dark:text-surface-100 p-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as Priority)}
                    className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 text-sm text-surface-900 dark:text-surface-100 p-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Due Date</label>
                  <input
                    type="datetime-local"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 text-sm text-surface-900 dark:text-surface-100 p-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 font-medium text-sm hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
