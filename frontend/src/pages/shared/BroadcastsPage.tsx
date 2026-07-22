import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, Megaphone, Shield } from 'lucide-react';
import { listBroadcasts, acknowledgeBroadcast, type Broadcast } from '../../api/additional-features';
import { useAuthStore } from '../../stores/authStore';

const priorityStyles: Record<string, { bg: string; badge: string; icon: React.ReactNode }> = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
  },
  urgent: {
    bg: 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    icon: <Megaphone className="w-5 h-5 text-orange-500" />,
  },
  normal: {
    bg: 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    icon: <Megaphone className="w-5 h-5 text-blue-500" />,
  },
};

function getStyles(priority: string) {
  return priorityStyles[priority] || priorityStyles.normal;
}

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const fetchBroadcasts = async () => {
    setLoading(true);
    try {
      const data = await listBroadcasts();
      const sorted = [...data].sort((a, b) => {
        const order: Record<string, number> = { critical: 0, urgent: 1, normal: 2 };
        return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
      });
      setBroadcasts(sorted);
    } catch (err) {
      console.error('Failed to load broadcasts', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (broadcastId: string) => {
    try {
      await acknowledgeBroadcast(broadcastId);
      setBroadcasts((prev) =>
        prev.map((b) =>
          b.id === broadcastId
            ? { ...b, acknowledged: true, acknowledged_at: new Date().toISOString() }
            : b
        )
      );
    } catch (err) {
      console.error('Failed to acknowledge broadcast', err);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-red-500" />
          <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50">
            Emergency Broadcasts
          </h1>
        </div>

        {loading ? (
          <div className="text-center py-16 text-surface-400">Loading broadcasts...</div>
        ) : broadcasts.length === 0 ? (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-12 text-center">
            <Shield className="w-12 h-12 text-surface-300 mx-auto mb-4" />
            <p className="text-surface-500 dark:text-surface-400 text-lg">No broadcasts</p>
            <p className="text-surface-400 dark:text-surface-500 text-sm mt-1">
              There are currently no emergency broadcasts.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {broadcasts.map((broadcast) => {
              const s = getStyles(broadcast.priority);
              const isAcknowledged = broadcast.acknowledged;
              const needsAck = broadcast.requires_acknowledgment && !isAcknowledged;

              return (
                <div
                  key={broadcast.id}
                  className={`rounded-2xl border shadow-sm p-5 transition-colors ${s.bg}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 shrink-0">{s.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${s.badge}`}>
                          {broadcast.priority}
                        </span>
                        <h3 className="text-surface-900 dark:text-surface-50 font-semibold text-lg">
                          {broadcast.title}
                        </h3>
                      </div>
                      <p className="text-surface-700 dark:text-surface-300 text-sm whitespace-pre-wrap mb-3">
                        {broadcast.message}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-surface-400 flex-wrap">
                        <span>From: {broadcast.sender_name || 'System'}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(broadcast.created_at)}
                        </span>
                        {isAcknowledged && (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            Acknowledged
                          </span>
                        )}
                      </div>
                      {needsAck && (
                        <div className="mt-3">
                          <button
                            onClick={() => handleAcknowledge(broadcast.id)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-900 dark:bg-surface-50 text-white dark:text-surface-900 text-sm font-medium hover:opacity-90 transition-opacity"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Acknowledge
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
