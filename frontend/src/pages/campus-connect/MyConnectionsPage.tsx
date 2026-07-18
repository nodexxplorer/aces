import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { getMyConnections, getPendingRequests, respondToConnection } from '../../api/campus-connect';
import { MessageSquare, Loader2, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Connection } from '../../types';

type Tab = 'connections' | 'pending';

interface ConnectionData {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: string;
  message?: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  requester_name?: string;
  receiver_name?: string;
}

const MyConnectionsPage = () => {
  const { user } = useAuth();
  const { success, error } = useNotification();
  const [tab, setTab] = useState<Tab>('connections');
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [pending, setPending] = useState<ConnectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const normalizeConnectionData = (connection: Connection): ConnectionData => ({
    id: connection.id,
    requester_id: connection.requesterId,
    receiver_id: connection.recipientId,
    status: connection.status,
    message: connection.message,
    full_name: connection.requester?.fullName || connection.recipient?.fullName || connection.requester?.full_name || connection.recipient?.full_name,
    avatar_url: connection.requester?.avatar || connection.recipient?.avatar || connection.requester?.avatarUrl || connection.recipient?.avatarUrl,
    role: connection.requester?.role || connection.recipient?.role,
    requester_name: connection.requester?.fullName || connection.requester?.full_name,
    receiver_name: connection.recipient?.fullName || connection.recipient?.full_name,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [connData, pendData] = await Promise.all([
          getMyConnections(),
          getPendingRequests(),
        ]);
        setConnections(connData.map(normalizeConnectionData));
        setPending(pendData.map(normalizeConnectionData));
      } catch {
        error('Failed to load', 'Could not fetch connections.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [error]);

  const handleRespond = async (connectionId: string, status: 'accepted' | 'rejected') => {
    setRespondingId(connectionId);
    try {
      await respondToConnection(connectionId, status);
      setPending((prev) => prev.filter((p) => p.id !== connectionId));
      if (status === 'accepted') {
        success('Connection Accepted', 'You are now connected.');
      } else {
        success('Connection Rejected', 'Request has been rejected.');
      }
    } catch {
      error('Action Failed', 'Could not process the request.');
    } finally {
      setRespondingId(null);
    }
  };

  const getOtherName = (conn: ConnectionData) => {
    if (conn.requester_id === user?.id) return conn.receiver_name || conn.full_name || 'User';
    return conn.requester_name || conn.full_name || 'User';
  };

  const getOtherId = (conn: ConnectionData) => {
    if (conn.requester_id === user?.id) return conn.receiver_id;
    return conn.requester_id;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">My Connections</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review approved peer and lecturer connections.
        </p>
      </div>

      <div className="flex gap-2 border-b border-surface-200 dark:border-surface-700 pb-px">
        <button
          onClick={() => setTab('connections')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'connections'
              ? 'bg-white dark:bg-surface-800 border border-b-0 border-surface-200 dark:border-surface-700 text-primary-600'
              : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
          }`}
        >
          My Connections
        </button>
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative ${
            tab === 'pending'
              ? 'bg-white dark:bg-surface-800 border border-b-0 border-surface-200 dark:border-surface-700 text-primary-600'
              : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
          }`}
        >
          Pending Requests
          {pending.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary-500 text-white rounded-full">{pending.length}</span>
          )}
        </button>
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center p-12 text-surface-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading connections...
          </div>
        ) : tab === 'connections' ? (
          connections.length === 0 ? (
            <div className="p-12 text-center text-surface-400 text-sm">No connections yet. Browse the directory to connect with peers.</div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {connections.map((conn) => {
                const otherId = getOtherId(conn);
                return (
                  <div key={conn.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                        {conn.avatar_url ? (
                          <img src={conn.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          (getOtherName(conn).split(' ').map((n: string) => n[0]).join('').slice(0, 2))
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-surface-900 dark:text-white">{getOtherName(conn)}</h4>
                        <p className="text-xs text-surface-500">{conn.role || 'Member'}</p>
                      </div>
                    </div>
                    <Link to={`/connect/messages?userId=${otherId}`}>
                      <Button size="xs" variant="outline" leftIcon={<MessageSquare className="w-3.5 h-3.5" />}>
                        Message
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )
        ) : pending.length === 0 ? (
          <div className="p-12 text-center text-surface-400 text-sm">No pending requests.</div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {pending.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                    {req.avatar_url ? (
                      <img src={req.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      (req.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-surface-900 dark:text-white">{req.full_name || 'User'}</h4>
                    {req.message && <p className="text-xs text-surface-500 mt-0.5">{req.message}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="xs"
                    variant="success"
                    leftIcon={respondingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    onClick={() => handleRespond(req.id, 'accepted')}
                    disabled={respondingId === req.id}
                  >
                    Accept
                  </Button>
                  <Button
                    size="xs"
                    variant="danger"
                    leftIcon={<X className="w-3.5 h-3.5" />}
                    onClick={() => handleRespond(req.id, 'rejected')}
                    disabled={respondingId === req.id}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default MyConnectionsPage;
