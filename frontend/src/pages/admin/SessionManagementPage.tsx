import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { useNotification } from '../../hooks/useNotification';
import { Save, CalendarRange, Loader2, CheckCircle, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { getSessions, createSession, updateSession, deleteSession, listSessionSemesters, createSemester, deleteSemester } from '../../api/sessions';
import type { Session, SemesterEntry } from '../../types';

const SessionManagementPage = () => {
  const { success, error: notifyError } = useNotification();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [sessionName, setSessionName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formError, setFormError] = useState('');

  const [semesterSessionId, setSemesterSessionId] = useState('');
  const [semesterName, setSemesterName] = useState<'harmattan' | 'rain'>('harmattan');
  const [semesterStart, setSemesterStart] = useState('');
  const [semesterEnd, setSemesterEnd] = useState('');
  const [semesters, setSemesters] = useState<Record<string, SemesterEntry[]>>({});
  const [semSaving, setSemSaving] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const items = await getSessions();
      const list = Array.isArray(items) ? items : [];
      setSessions(list);
      if (list.length > 0 && !semesterSessionId) {
        setSemesterSessionId(list[0].id);
      }
      // Load semesters for all sessions
      for (const s of list) {
        try {
          const sems = await listSessionSemesters(s.id);
          setSemesters((prev) => ({ ...prev, [s.id]: Array.isArray(sems) ? sems : [] }));
        } catch {
          setSemesters((prev) => ({ ...prev, [s.id]: [] }));
        }
      }
    } catch (err: any) {
      notifyError('Load Failed', err?.response?.data?.error || 'Could not load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!sessionName.trim()) {
      setFormError('Session name is required');
      return;
    }
    try {
      setSaving(true);
      await createSession({
        name: sessionName.trim(),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      success('Session Created', `Academic session ${sessionName} has been created`);
      setSessionName('');
      setStartDate('');
      setEndDate('');
      fetchSessions();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Could not create session.';
      setFormError(msg);
      notifyError('Creation Failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (session: Session) => {
    try {
      await updateSession(session.id, {
        is_active: !session.is_active,
      } as Partial<Session>);
      success('Session Updated', `${session.name} has been ${!session.is_active ? 'activated' : 'deactivated'}`);
      fetchSessions();
    } catch (err: any) {
      notifyError('Update Failed', err?.response?.data?.error || 'Could not update session');
    }
  };

  const handleDeleteSession = async (session: Session) => {
    if (!confirm(`Delete session "${session.name}"? This cannot be undone.`)) return;
    try {
      await deleteSession(session.id);
      success('Session Deleted', `${session.name} has been removed`);
      fetchSessions();
    } catch (err: any) {
      notifyError('Delete Failed', err?.response?.data?.error || 'Could not delete session');
    }
  };

  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!semesterSessionId) {
      notifyError('Error', 'Select a session first');
      return;
    }
    try {
      setSemSaving(true);
      await createSemester({
        session_id: semesterSessionId,
        name: semesterName,
        start_date: semesterStart || undefined,
        end_date: semesterEnd || undefined,
      });
      success('Semester Created', `${semesterName} semester added`);
      setSemesterStart('');
      setSemesterEnd('');
      fetchSessions();
    } catch (err: any) {
      notifyError('Failed', err?.response?.data?.error || 'Could not create semester');
    } finally {
      setSemSaving(false);
    }
  };

  const handleDeleteSemester = async (semesterId: string, semName: string) => {
    if (!confirm(`Delete ${semName} semester?`)) return;
    try {
      await deleteSemester(semesterId);
      success('Deleted', `${semName} semester removed`);
      fetchSessions();
    } catch {
      notifyError('Error', 'Could not delete semester');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Session & Semester Management</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Create academic sessions, manage semesters, and set the active session.
        </p>
      </div>

      {/* Create Session */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-primary-500" />
            <CardTitle>Create New Session</CardTitle>
          </div>
          <CardDescription>Add a new academic session to the system</CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading sessions...</span>
          </div>
        ) : (
          <form onSubmit={handleCreateSession} className="p-4 pt-0 space-y-4">
            {formError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-50 dark:bg-danger-950/20 border border-danger-200 dark:border-danger-800">
                <AlertCircle className="w-4 h-4 text-danger-500 shrink-0" />
                <p className="text-sm text-danger-600 dark:text-danger-400">{formError}</p>
              </div>
            )}
            <input
              className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
              placeholder="e.g. 2025/2026"
              value={sessionName}
              onChange={(e) => { setSessionName(e.target.value); setFormError(''); }}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Start Date</label>
                <input type="date" className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">End Date</label>
                <input type="date" className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium disabled:opacity-50" disabled={saving || !sessionName.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Creating...' : 'Create Session'}
            </button>
          </form>
        )}
      </Card>

      {/* Create Semester */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary-500" />
            <CardTitle>Create Semester</CardTitle>
          </div>
          <CardDescription>Add a semester to an existing session</CardDescription>
        </CardHeader>
        <form onSubmit={handleCreateSemester} className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Session</label>
              <select className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600" value={semesterSessionId} onChange={(e) => setSemesterSessionId(e.target.value)} required>
                <option value="">Select session</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Semester</label>
              <select className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600" value={semesterName} onChange={(e) => setSemesterName(e.target.value as 'harmattan' | 'rain')}>
                <option value="harmattan">Harmattan (First Semester)</option>
                <option value="rain">Rain (Second Semester)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Start Date</label>
              <input type="date" className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600" value={semesterStart} onChange={(e) => setSemesterStart(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">End Date</label>
              <input type="date" className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600" value={semesterEnd} onChange={(e) => setSemesterEnd(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium disabled:opacity-50" disabled={semSaving || !semesterSessionId}>
            {semSaving ? 'Creating...' : 'Create Semester'}
          </button>
        </form>
      </Card>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Sessions</CardTitle>
          <CardDescription>All academic sessions and their semesters</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0">
          {sessions.length === 0 ? (
            <p className="text-sm text-surface-500 text-center py-6">No sessions created yet.</p>
          ) : (
            <div className="space-y-4">
              {sessions.map((s) => (
                <div key={s.id} className="border border-surface-200 dark:border-surface-700 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {s.is_active ? (
                        <CheckCircle className="w-5 h-5 text-success-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-surface-400 shrink-0" />
                      )}
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-surface-500">
                          {s.start_date ? new Date(s.start_date).toLocaleDateString() : 'No start'} — {s.end_date ? new Date(s.end_date).toLocaleDateString() : 'No end'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(s)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg border ${
                          s.is_active ? 'border-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700' : 'border-success-300 bg-success-50 text-success-700 hover:bg-success-100'
                        }`}
                      >
                        {s.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => handleDeleteSession(s)} className="px-3 py-1 text-xs font-medium rounded-lg border border-danger-300 text-danger-600 hover:bg-danger-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Semesters for this session */}
                  <div className="ml-8 space-y-1">
                    {semesters[s.id]?.length === 0 && (
                      <p className="text-xs text-surface-400 italic">No semesters yet</p>
                    )}
                    {semesters[s.id]?.map((sem) => (
                      <div key={sem.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-surface-50 dark:bg-surface-800">
                        <span className="capitalize font-medium">{sem.name} Semester</span>
                        <div className="flex items-center gap-2 text-surface-400">
                          {sem.start_date && <span>{new Date(sem.start_date).toLocaleDateString()}</span>}
                          {sem.is_active && <span className="text-success-500 font-medium">Active</span>}
                          <button onClick={() => handleDeleteSemester(sem.id, sem.name)} className="hover:text-danger-500">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SessionManagementPage;
