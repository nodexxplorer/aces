import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { CheckCircle, XCircle, Users } from 'lucide-react';
import { getMyMentorshipRequests, respondToMentorship } from '../../api/alumni';
import { getErrorMessage } from '../../utils/errors';
import type { MentorshipRequestItem } from '../../types';

type StatusVariant = 'primary' | 'success' | 'danger' | 'warning' | 'default';

const statusVariants: Record<string, StatusVariant> = {
  pending: 'warning',
  accepted: 'primary',
  active: 'success',
  completed: 'default',
  declined: 'danger',
};

const MentorshipRequestsPage = () => {
  const { success, error: notifyError } = useNotification();
  const [requests, setRequests] = useState<MentorshipRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getMyMentorshipRequests()
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .catch(() => notifyError('Error', 'Failed to load mentorship requests'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const respond = async (id: string, status: 'accepted' | 'declined') => {
    try {
      setActioningId(id);
      await respondToMentorship(id, status);
      success(status === 'accepted' ? 'Request Accepted' : 'Request Declined', '');
      load();
    } catch (err) {
      notifyError('Action Failed', getErrorMessage(err, 'Could not update this request'));
    } finally {
      setActioningId(null);
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const resolved = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Mentorship Requests</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Students who have asked you for mentorship
        </p>
      </div>

      {loading ? (
        <Card>
          <div className="p-12 text-center text-sm text-surface-500">Loading requests...</div>
        </Card>
      ) : requests.length === 0 ? (
        <Card>
          <div className="p-12 text-center text-sm text-surface-400">
            <Users className="w-10 h-10 mx-auto text-surface-300 mb-2" />
            No mentorship requests yet. Make sure "Available as Mentor" is turned on in your profile to be discoverable
            to students.
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">
                Pending ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((r) => (
                  <Card key={r.id} className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-surface-900 dark:text-white">{r.topic}</h3>
                          <Badge variant={statusVariants[r.status] || 'default'}>{r.status}</Badge>
                        </div>
                        <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                          From <span className="font-medium">{r.student_name}</span>
                        </p>
                        {r.message && (
                          <p className="text-sm text-surface-600 dark:text-surface-400 mt-2">{r.message}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          isLoading={actioningId === r.id}
                          leftIcon={<XCircle className="w-3.5 h-3.5" />}
                          onClick={() => respond(r.id, 'declined')}
                        >
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          isLoading={actioningId === r.id}
                          leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                          onClick={() => respond(r.id, 'accepted')}
                        >
                          Accept
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {resolved.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">History</h2>
              <div className="space-y-2">
                {resolved.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-surface-150 dark:border-surface-700"
                  >
                    <div>
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{r.topic}</p>
                      <p className="text-xs text-surface-500">From {r.student_name}</p>
                    </div>
                    <Badge variant={statusVariants[r.status] || 'default'}>{r.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MentorshipRequestsPage;
