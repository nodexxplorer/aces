import { useState, useEffect, useCallback } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import {
  Save,
  CalendarRange,
  Loader2,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  TrendingUp,
  RotateCcw,
  PauseCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  getSessions,
  createSession,
  updateSession,
  deleteSession,
  listSessionSemesters,
  createSemester,
  deleteSemester,
  prepareRollOver,
  getRollOverOverview,
  flipRollOverStudent,
  confirmRollOver,
  type RollOverOverview,
  type LevelPromotion,
  type LevelPromotionSummary,
} from '../../api/sessions';
import { getErrorMessage } from '../../utils/errors';
import type { Session, SemesterEntry } from '../../types';

const statusLabel: Record<LevelPromotion['status'], string> = {
  proposed: 'Proposed',
  confirmed: 'Promoted',
  carried_over: 'Carried over',
  held_back: 'Held back',
};

const statusStyle: Record<LevelPromotion['status'], string> = {
  proposed: 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400',
  confirmed: 'bg-success-50 text-success-600 dark:bg-success-950/40 dark:text-success-400',
  carried_over: 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400',
  held_back: 'bg-warning-50 text-warning-600 dark:bg-warning-950/40 dark:text-warning-400',
};

// RollOverCard lets HOD/admin review the promotion proposal for a session,
// flip individual students, then confirm the batch — which bumps levels
// and rolls everyone into the new session atomically.
const RollOverCard = ({ sessions }: { sessions: Session[] }) => {
  const { success, error: notifyError } = useNotification();
  const [sessionId, setSessionId] = useState('');
  const [overview, setOverview] = useState<RollOverOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [flippingId, setFlippingId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = async (id: string) => {
    if (!id) return;
    try {
      setLoading(true);
      setOverview(await getRollOverOverview(id));
    } catch (err: unknown) {
      setOverview(null);
      notifyError('Load Failed', getErrorMessage(err, 'No roll-over proposal for this session yet — click Prepare.'));
    } finally {
      setLoading(false);
    }
  };

  const handlePrepare = async () => {
    if (!sessionId) return;
    try {
      setPreparing(true);
      const res = await prepareRollOver(sessionId);
      success(
        'Proposal Ready',
        res.created > 0
          ? `${res.created} new proposal${res.created === 1 ? '' : 's'} generated (${res.total} total).`
          : `Proposal up to date (${res.total} students).`,
      );
      await load(sessionId);
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not prepare roll-over'));
    } finally {
      setPreparing(false);
    }
  };

  const handleFlip = async (p: LevelPromotion, status: 'promote' | 'carryover' | 'held_back') => {
    try {
      setFlippingId(p.id);
      await flipRollOverStudent(sessionId, p.id, status);
      await load(sessionId);
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not update student'));
    } finally {
      setFlippingId(null);
    }
  };

  const handleConfirm = async () => {
    try {
      setConfirming(true);
      const res = await confirmRollOver(sessionId);
      success(
        'Roll-over Complete',
        `${res.promoted} promoted, ${res.rolled} student${res.rolled === 1 ? '' : 's'} rolled into the new session.`,
      );
      setConfirmOpen(false);
      await load(sessionId);
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not confirm roll-over'));
    } finally {
      setConfirming(false);
    }
  };

  const proposals = overview?.proposals ?? [];
  const visible = selectedLevel === null ? proposals : proposals.filter((p) => p.level === selectedLevel);
  const pendingCount = proposals.filter((p) => p.status === 'proposed').length;
  const anyProposed = pendingCount > 0;

  const SummaryChip = ({ s }: { s: LevelPromotionSummary }) => {
    const active = selectedLevel === s.level;
    return (
      <button
        onClick={() => setSelectedLevel(active ? null : s.level)}
        className={`rounded-xl border p-3 text-left transition-all ${
          active
            ? 'border-primary-400 bg-primary-50/60 dark:border-primary-500/50 dark:bg-primary-950/30'
            : 'border-surface-200 hover:border-primary-300 dark:border-surface-700 dark:hover:border-primary-500/40'
        }`}
      >
        <p className="text-xs font-semibold text-surface-500 dark:text-surface-400">{s.level}L</p>
        <div className="mt-1 flex items-baseline gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-success-500" />
          <span className="text-lg font-bold text-surface-900 dark:text-white">{s.proposed + s.confirmed}</span>
          <span className="text-xs text-surface-400">up</span>
          <RotateCcw className="w-3.5 h-3.5 ml-2 text-surface-400" />
          <span className="text-lg font-bold text-surface-900 dark:text-white">{s.carryover}</span>
          <span className="text-xs text-surface-400">carry</span>
        </div>
        {(s.held_back > 0 || s.confirmed > 0) && (
          <p className="mt-0.5 text-[11px] text-surface-400">
            {s.confirmed > 0 && `${s.confirmed} confirmed`}
            {s.confirmed > 0 && s.held_back > 0 && ' · '}
            {s.held_back > 0 && `${s.held_back} held back`}
          </p>
        )}
      </button>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-500" />
          <CardTitle>Session Roll-over & Promotion</CardTitle>
        </div>
        <CardDescription>
          Review who advances a level and who carries over, then confirm the batch. Results stay on hold, eligibility is
          based on dues and course-form completion.
        </CardDescription>
      </CardHeader>
      <div className="p-4 pt-0 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            className="flex-1 px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600 text-sm"
            value={sessionId}
            onChange={(e) => {
              setSessionId(e.target.value);
              setOverview(null);
              setSelectedLevel(null);
              if (e.target.value) load(e.target.value);
            }}
          >
            <option value="">Select the new session…</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.is_active ? ' (active)' : ''}
              </option>
            ))}
          </select>
          <Button onClick={handlePrepare} disabled={!sessionId || preparing} isLoading={preparing}>
            Prepare / Refresh Proposal
          </Button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        )}

        {!loading && overview && (
          <>
            {(overview.summary?.length ?? 0) > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {overview.summary.map((s) => (
                  <SummaryChip key={s.level} s={s} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No proposals yet."
                description="Click Prepare to generate the promotion proposal."
                className="py-6"
              />
            )}

            {visible.length > 0 && (
              <div className="rounded-xl border border-surface-200 dark:border-surface-700 divide-y divide-surface-100 dark:divide-surface-800 max-h-96 overflow-y-auto">
                {visible.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                        {p.full_name}
                      </p>
                      <p className="text-xs text-surface-400">
                        {p.matric_number} · {p.from_level}L → {p.to_level}L
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusStyle[p.status]}`}>
                      {statusLabel[p.status]}
                    </span>
                    {p.status === 'proposed' && (
                      <div className="flex items-center gap-1">
                        {p.to_level > p.from_level ? (
                          <>
                            <button
                              onClick={() => handleFlip(p, 'carryover')}
                              disabled={flippingId === p.id}
                              title="Hold at current level (carry over)"
                              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-50"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleFlip(p, 'held_back')}
                              disabled={flippingId === p.id}
                              title="Hold back (excluded from roll)"
                              className="p-1.5 rounded-lg text-surface-400 hover:text-warning-500 hover:bg-warning-50 dark:hover:bg-warning-950/30 disabled:opacity-50"
                            >
                              <PauseCircle className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleFlip(p, 'promote')}
                            disabled={flippingId === p.id}
                            title="Promote to next level"
                            className="p-1.5 rounded-lg text-surface-400 hover:text-success-600 hover:bg-success-50 dark:hover:bg-success-950/30 disabled:opacity-50"
                          >
                            <TrendingUp className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-surface-400">
                {anyProposed
                  ? `${pendingCount} student${pendingCount === 1 ? '' : 's'} pending confirmation. Confirming locks levels, rolls everyone into the session and activates it.`
                  : 'Nothing pending — confirm again to re-run the session roll for any students added later.'}
              </p>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!sessionId}
                leftIcon={<ShieldCheck className="w-4 h-4" />}
              >
                Confirm Roll-over
              </Button>
            </div>
          </>
        )}

        <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Session Roll-over" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-surface-600 dark:text-surface-300">
              This will apply the proposal for{' '}
              <span className="font-semibold">{sessions.find((s) => s.id === sessionId)?.name}</span>:
            </p>
            <ul className="text-sm text-surface-600 dark:text-surface-300 space-y-1.5 list-disc pl-5">
              <li>Every pending student is promoted one level (carryovers keep their level).</li>{' '}
              <li>All active students move to this session (including carryovers).</li>
              <li>This session becomes the active one; the previous session is deactivated.</li>
              <li>Promoted students get a notification.</li>
            </ul>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} isLoading={confirming}>
                Confirm & Apply
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Card>
  );
};

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
  const [semesterName, setSemesterName] = useState<string>('first');
  const [semesterStart, setSemesterStart] = useState('');
  const [semesterEnd, setSemesterEnd] = useState('');
  const [semesters, setSemesters] = useState<Record<string, SemesterEntry[]>>({});
  const [semSaving, setSemSaving] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const items = await getSessions();
      const list = Array.isArray(items) ? items : [];
      setSessions(list);
      if (list.length > 0) {
        setSemesterSessionId((prev) => prev || list[0].id);
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
    } catch (err: unknown) {
      notifyError('Load Failed', getErrorMessage(err, 'Could not load sessions'));
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

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
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Could not create session.');
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
    } catch (err: unknown) {
      notifyError('Update Failed', getErrorMessage(err, 'Could not update session'));
    }
  };

  const handleDeleteSession = async (session: Session) => {
    if (!confirm(`Delete session "${session.name}"? This cannot be undone.`)) return;
    try {
      await deleteSession(session.id);
      success('Session Deleted', `${session.name} has been removed`);
      fetchSessions();
    } catch (err: unknown) {
      notifyError('Delete Failed', getErrorMessage(err, 'Could not delete session'));
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
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not create semester'));
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
              onChange={(e) => {
                setSessionName(e.target.value);
                setFormError('');
              }}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium disabled:opacity-50"
              disabled={saving || !sessionName.trim()}
            >
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
              <select
                className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                value={semesterSessionId}
                onChange={(e) => setSemesterSessionId(e.target.value)}
                required
              >
                <option value="">Select session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Semester</label>
              <select
                className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                value={semesterName}
                onChange={(e) => setSemesterName(e.target.value)}
              >
                <option value="first">First Semester</option>
                <option value="second">Second Semester</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                value={semesterStart}
                onChange={(e) => setSemesterStart(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">End Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                value={semesterEnd}
                onChange={(e) => setSemesterEnd(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium disabled:opacity-50"
            disabled={semSaving || !semesterSessionId}
          >
            {semSaving ? 'Creating...' : 'Create Semester'}
          </button>
        </form>
      </Card>

      {/* Session Roll-over (batch level promotion) */}
      <RollOverCard sessions={sessions} />

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Sessions</CardTitle>
          <CardDescription>All academic sessions and their semesters</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0">
          {sessions.length === 0 ? (
            <EmptyState title="No sessions created yet." className="py-6" />
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
                          {s.start_date ? new Date(s.start_date).toLocaleDateString() : 'No start'} —{' '}
                          {s.end_date ? new Date(s.end_date).toLocaleDateString() : 'No end'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(s)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg border ${
                          s.is_active
                            ? 'border-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'
                            : 'border-success-300 bg-success-50 text-success-700 hover:bg-success-100'
                        }`}
                      >
                        {s.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDeleteSession(s)}
                        className="px-3 py-1 text-xs font-medium rounded-lg border border-danger-300 text-danger-600 hover:bg-danger-50"
                      >
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
                      <div
                        key={sem.id}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-surface-50 dark:bg-surface-800"
                      >
                        <span className="capitalize font-medium">
                          {sem.name === 'harmattan' || sem.name === 'first'
                            ? 'First'
                            : sem.name === 'rain' || sem.name === 'second'
                              ? 'Second'
                              : sem.name}{' '}
                          Semester
                        </span>
                        <div className="flex items-center gap-2 text-surface-400">
                          {sem.start_date && <span>{new Date(sem.start_date).toLocaleDateString()}</span>}
                          {sem.is_active && <span className="text-success-500 font-medium">Active</span>}
                          <button
                            onClick={() => handleDeleteSemester(sem.id, sem.name)}
                            className="hover:text-danger-500"
                          >
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
