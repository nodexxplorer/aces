import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { listPendingAppeals, updateAppealStatus, type GradeAppeal } from '../../api/additional-features';
import { getErrorMessage } from '../../utils/errors';
import { AlertCircle, Clock, CheckCircle, XCircle, Filter, MessageSquare } from 'lucide-react';

const STATUS_TABS = ['submitted', 'lecturer_review', 'hod_review', 'resolved', 'rejected'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_LABELS: Record<StatusTab, string> = {
  submitted: 'Submitted',
  lecturer_review: 'Lecturer Review',
  hod_review: 'HOD Review',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

const STATUS_BADGE: Record<StatusTab, 'primary' | 'warning' | 'success' | 'danger'> = {
  submitted: 'primary',
  lecturer_review: 'warning',
  hod_review: 'warning',
  resolved: 'success',
  rejected: 'danger',
};

const NEXT_ACTIONS: Record<StatusTab, { status: string; label: string; needsScore?: boolean }[]> = {
  submitted: [
    { status: 'lecturer_review', label: 'Move to Lecturer Review' },
    { status: 'hod_review', label: 'Escalate to HOD Review' },
    { status: 'rejected', label: 'Reject' },
  ],
  lecturer_review: [
    { status: 'hod_review', label: 'Escalate to HOD Review' },
    { status: 'resolved', label: 'Resolve', needsScore: true },
    { status: 'rejected', label: 'Reject' },
  ],
  hod_review: [
    { status: 'resolved', label: 'Resolve', needsScore: true },
    { status: 'rejected', label: 'Reject' },
  ],
  resolved: [],
  rejected: [],
};

const GradeAppealsAdminPage = () => {
  const { success, error: notifyError } = useNotification();
  const [activeTab, setActiveTab] = useState<StatusTab>('submitted');
  const [appeals, setAppeals] = useState<GradeAppeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GradeAppeal | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [revisedScore, setRevisedScore] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAppeals = async (status: StatusTab) => {
    setLoading(true);
    try {
      const data = await listPendingAppeals(status);
      setAppeals(Array.isArray(data) ? data : []);
    } catch {
      notifyError('Error', 'Failed to load grade appeals');
      setAppeals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppeals(activeTab);
  }, [activeTab]);

  const openAppeal = (appeal: GradeAppeal) => {
    setSelected(appeal);
    setActionStatus(null);
    setResponse('');
    setRevisedScore('');
  };

  const handleSubmitAction = async () => {
    if (!selected || !actionStatus) return;
    setSubmitting(true);
    try {
      await updateAppealStatus(selected.id, {
        status: actionStatus,
        response: response.trim() || undefined,
        revised_score: revisedScore ? Number(revisedScore) : undefined,
      });
      success('Appeal Updated', `Status changed to ${STATUS_LABELS[actionStatus as StatusTab] ?? actionStatus}.`);
      setSelected(null);
      fetchAppeals(activeTab);
    } catch (err: unknown) {
      notifyError('Error', getErrorMessage(err, 'Failed to update appeal'));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedActions = selected ? (NEXT_ACTIONS[selected.status as StatusTab] ?? []) : [];
  const selectedAction = selectedActions.find((a) => a.status === actionStatus);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Grade Appeals</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review student grade appeals and move them through lecturer/HOD review to a resolution.
        </p>
      </div>

      <div className="flex items-center gap-1 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-1 shadow-sm w-fit max-w-full overflow-x-auto">
        <Filter className="w-4 h-4 text-surface-400 mx-2 shrink-0" />
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
            }`}
          >
            {STATUS_LABELS[tab]}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STATUS_LABELS[activeTab]} Appeals</CardTitle>
          <CardDescription>{loading ? 'Loading...' : `${appeals.length} appeal(s)`}</CardDescription>
        </CardHeader>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Clock className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : appeals.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-10 h-10 text-surface-300 mx-auto mb-3" />
            <p className="text-sm text-surface-500">No appeals in this status.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {appeals.map((appeal) => (
              <button
                key={appeal.id}
                onClick={() => openAppeal(appeal)}
                className="w-full text-left p-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-surface-900 dark:text-white">
                      {appeal.course_code ?? 'Course'}
                    </span>
                    <Badge variant={STATUS_BADGE[appeal.status as StatusTab] ?? 'primary'} className="text-[10px]">
                      {STATUS_LABELS[appeal.status as StatusTab] ?? appeal.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-surface-500 mt-0.5">{appeal.student_name || appeal.student_id}</p>
                  <p className="text-sm text-surface-600 dark:text-surface-400 mt-1 line-clamp-1">{appeal.reason}</p>
                </div>
                <span className="text-[10px] text-surface-400 shrink-0">
                  {appeal.created_at ? new Date(appeal.created_at).toLocaleDateString() : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-surface-900 dark:text-white">
                  {selected.course_code ?? 'Grade Appeal'} — {selected.course_title}
                </h2>
                <p className="text-xs text-surface-500 mt-0.5">{selected.student_name || selected.student_id}</p>
              </div>
              <Badge variant={STATUS_BADGE[selected.status as StatusTab] ?? 'primary'}>
                {STATUS_LABELS[selected.status as StatusTab] ?? selected.status}
              </Badge>
            </div>

            <div>
              <p className="text-xs font-semibold text-surface-500 mb-1">Reason</p>
              <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap">{selected.reason}</p>
            </div>

            {selected.evidence_urls && selected.evidence_urls.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-surface-500 mb-1">Evidence</p>
                <div className="flex flex-wrap gap-2">
                  {selected.evidence_urls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-600 hover:underline border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1"
                    >
                      Evidence {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {selected.lecturer_response && (
              <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3">
                <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mb-1">Lecturer Response</p>
                <p className="text-sm text-surface-700 dark:text-surface-300">{selected.lecturer_response}</p>
              </div>
            )}
            {selected.hod_response && (
              <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-3">
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-1">HOD Response</p>
                <p className="text-sm text-surface-700 dark:text-surface-300">{selected.hod_response}</p>
              </div>
            )}

            {selectedActions.length > 0 ? (
              <div className="space-y-3 pt-2 border-t border-surface-200 dark:border-surface-800">
                <p className="text-xs font-semibold text-surface-500 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Take Action
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedActions.map((action) => (
                    <Button
                      key={action.status}
                      size="sm"
                      variant={
                        action.status === 'rejected' ? 'danger' : action.status === 'resolved' ? 'success' : 'outline'
                      }
                      onClick={() => setActionStatus(action.status)}
                      className={actionStatus === action.status ? 'ring-2 ring-primary-500' : ''}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>

                {actionStatus && (
                  <div className="space-y-3 pt-2">
                    <textarea
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      placeholder="Response to the student (optional but recommended)..."
                      rows={3}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                    />
                    {selectedAction?.needsScore && (
                      <input
                        type="number"
                        value={revisedScore}
                        onChange={(e) => setRevisedScore(e.target.value)}
                        placeholder="Revised score (optional — leave blank if grade stands)"
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    )}
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        isLoading={submitting}
                        leftIcon={<CheckCircle className="w-4 h-4" />}
                        onClick={handleSubmitAction}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="outline"
                        leftIcon={<XCircle className="w-4 h-4" />}
                        onClick={() => setActionStatus(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-surface-400 pt-2 border-t border-surface-200 dark:border-surface-800">
                This appeal is already {STATUS_LABELS[selected.status as StatusTab]?.toLowerCase()} — no further action
                needed.
              </p>
            )}

            <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>
              Close
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default GradeAppealsAdminPage;
