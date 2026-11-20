import { useState } from 'react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

import { AlertTriangle, Check, X, Shield } from 'lucide-react';
import { attendanceAction, type VerifiedRecord } from '../../api/verified-attendance';

interface ReviewPanelProps {
  sessionId: string;
  records: VerifiedRecord[];
  currentUserId: string;
  onSaved: () => void;
}

const label = (s: string) => s.replace(/_/g, ' ');

export default function ReviewPanel({ sessionId, records, currentUserId, onSaved }: ReviewPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const [activeUser, setActiveUser] = useState('');
  const [outcome, setOutcome] = useState('present');
  const [reason, setReason] = useState('');
  const [approveDevice, setApproveDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reviewable = showAll
    ? records.filter((r) => r.user_id !== currentUserId)
    : records.filter(
        (r) => r.user_id !== currentUserId && (r.verification === 'flagged' || r.verification === 'pending'),
      );

  const submit = async () => {
    if (!activeUser || reason.length < 5) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await attendanceAction(sessionId, 'review', {
        userId: activeUser,
        outcome,
        reason,
        approveDevice,
      });
      setNotice('Decision saved.');
      setReason('');
      setActiveUser('');
      setApproveDevice(false);
      onSaved();
    } catch (e) {
      setError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to save review decision.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning-500" />
          Review Queue
        </h3>
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          {showAll ? 'Show exceptions only' : 'Show all students'}
        </button>
      </div>

      {reviewable.length === 0 && (
        <p className="text-sm text-surface-500 dark:text-surface-400">
          {showAll
            ? 'No other students on this roster.'
            : 'No exceptions to review. All check-ins passed verification.'}
        </p>
      )}

      <div className="divide-y divide-surface-100 dark:divide-surface-700/50">
        {reviewable.map((r) => (
          <div key={r.user_id} className="py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-medium text-surface-900 dark:text-surface-100">{r.matric}</span>
                <span className="text-surface-500 dark:text-surface-400"> — {r.name}</span>
              </div>
              <div className="flex gap-1.5">
                <Badge
                  variant={
                    r.verification === 'flagged' ? 'warning' : r.verification === 'verified' ? 'success' : 'default'
                  }
                >
                  {label(r.verification)}
                </Badge>
                <Badge variant={r.outcome === 'present' ? 'success' : r.outcome === 'late' ? 'warning' : 'danger'}>
                  {r.outcome}
                </Badge>
              </div>
            </div>
            {r.flags.length > 0 && (
              <p className="text-xs text-warning-600 dark:text-warning-400 mt-1">
                Flags: {r.flags.map(label).join(', ')}
              </p>
            )}
            {r.review_reason && (
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                Previous decision: {r.review_reason}
              </p>
            )}
            {activeUser !== r.user_id ? (
              <Button
                size="xs"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  setActiveUser(r.user_id);
                  setOutcome(r.outcome === 'absent' ? 'present' : r.outcome);
                  setReason('');
                  setApproveDevice(false);
                }}
              >
                Review
              </Button>
            ) : (
              <div className="mt-3 p-3 rounded-lg bg-surface-50 dark:bg-surface-700/30 space-y-3">
                <select
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-transparent p-2 text-sm"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                >
                  <option value="present">Present</option>
                  <option value="late">Late (full pilot credit)</option>
                  <option value="absent">Absent / rejected</option>
                </select>
                <textarea
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-transparent p-2 text-sm"
                  placeholder="Decision reason (min 5 characters)"
                  minLength={5}
                  maxLength={2000}
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <label className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                  <input
                    type="checkbox"
                    checked={approveDevice}
                    onChange={(e) => setApproveDevice(e.target.checked)}
                    className="rounded"
                  />
                  <Shield className="w-3.5 h-3.5" />I supervised identity re-verification and approve this device
                </label>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy || reason.length < 5} onClick={() => void submit()}>
                    <Check className="w-3.5 h-3.5" />
                    Save decision
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setActiveUser('')}>
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      {notice && <p className="text-sm text-success-600">{notice}</p>}
    </div>
  );
}
