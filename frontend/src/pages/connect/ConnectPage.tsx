import { useState, useEffect, useRef } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import {
  Users, UserPlus, Check, X, MessageCircle, Send, ArrowLeft, Search, Loader2
} from 'lucide-react';
import {
  getDirectory, getMyConnections, getPendingRequests,
  sendConnectionRequest, respondToConnection,
  getConversation, sendMessage, markMessageRead, getUnreadCounts, getConnectionUserIds,
  type DirectoryUser, type Connection, type Message
} from '../../api/connect';
import { getInitials } from '../../utils/formatters';

type Tab = 'discover' | 'requests' | 'connections';

function getOtherUser(c: Connection, myId: string) {
  return c.requester_id === myId ? c.receiver_id : c.requester_id;
}

function getOtherName(c: Connection, myId: string) {
  const isRequester = c.requester_id === myId;
  return isRequester ? 'You' : c.full_name;
}

function DiscoverTab({ myId }: { myId: string }) {
  const { success, error: notifyError } = useNotification();
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([getDirectory(), getConnectionUserIds()])
      .then(([directory, connectedIds]) => {
        const excludeSet = new Set(connectedIds);
        setUsers(directory.filter((u) => u.id !== myId && !excludeSet.has(u.id)));
      })
      .catch(() => notifyError('Error', 'Could not load directory'))
      .finally(() => setLoading(false));
  }, [myId]);

  const handleConnect = async (user: DirectoryUser) => {
    try {
      await sendConnectionRequest(user.id);
      setSentIds((prev) => new Set([...prev, user.id]));
      success('Request Sent', `Connection request sent to ${user.full_name}.`);
    } catch (err: any) {
      notifyError('Failed', err?.response?.data?.error || 'Could not send request');
    }
  };

  const filtered = users.filter((u) =>
    !search || u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.matric_number.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
        <input
          type="text"
          placeholder="Search by name, matric number, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-surface-500 text-sm">No students found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((user) => (
            <div key={user.id} className="flex items-center gap-3 p-4 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  getInitials(user.full_name.split(' ')[0] || 'U', user.full_name.split(' ')[1] || '')
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">{user.full_name}</p>
                <p className="text-xs text-surface-500 truncate">{user.matric_number} &middot; Level {user.level}</p>
              </div>
              {sentIds.has(user.id) ? (
                <Badge variant="info">Requested</Badge>
              ) : (
                <Button size="xs" onClick={() => handleConnect(user)} leftIcon={<UserPlus className="w-3.5 h-3.5" />}>
                  Connect
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RequestsTab({ myId, onAccepted }: { myId: string; onAccepted: () => void }) {
  const { success, error: notifyError } = useNotification();
  const [requests, setRequests] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    getPendingRequests()
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .catch(() => notifyError('Error', 'Could not load requests'))
      .finally(() => setLoading(false));
  }, []);

  const handleRespond = async (id: string, status: 'accepted' | 'rejected') => {
    setRespondingId(id);
    try {
      await respondToConnection(id, status);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      success(status === 'accepted' ? 'Accepted' : 'Rejected', `Request ${status}.`);
      if (status === 'accepted') onAccepted();
    } catch (err: any) {
      notifyError('Failed', err?.response?.data?.error || 'Could not respond');
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-surface-500 text-sm">No pending requests.</div>
      ) : (
        requests.map((req) => (
          <div key={req.id} className="flex items-center gap-3 p-4 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {req.avatar_url ? (
                <img src={req.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                getInitials(req.full_name.split(' ')[0] || 'U', req.full_name.split(' ')[1] || '')
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">{req.full_name}</p>
              {req.message && <p className="text-xs text-surface-500 truncate mt-0.5">"{req.message}"</p>}
              <p className="text-xs text-surface-400 mt-0.5">{new Date(req.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="xs"
                variant="ghost"
                className="text-success-600 hover:bg-success-50"
                leftIcon={<Check className="w-3.5 h-3.5" />}
                disabled={respondingId === req.id}
                onClick={() => handleRespond(req.id, 'accepted')}
              >
                Accept
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="text-danger-600 hover:bg-danger-50"
                leftIcon={<X className="w-3.5 h-3.5" />}
                disabled={respondingId === req.id}
                onClick={() => handleRespond(req.id, 'rejected')}
              >
                Reject
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ConnectionsTab({ myId, onChat }: { myId: string; onChat: (userId: string, name: string) => void }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([getMyConnections(), getUnreadCounts()])
      .then(([connData, unreadData]) => {
        setConnections(Array.isArray(connData) ? connData : []);
        setUnreadMap(unreadData || {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const accepted = connections.filter((c) => c.status === 'accepted');
  const deduped = accepted.filter((c, i, arr) => {
    const otherId = getOtherUser(c, myId);
    return arr.findIndex((c2) => getOtherUser(c2, myId) === otherId) === i;
  });
  const filtered = deduped.filter((c) => {
    const otherName = getOtherName(c, myId);
    return !search || otherName.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
        <input
          type="text"
          placeholder="Search connections..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-surface-500 text-sm">
          {accepted.length === 0 ? 'No connections yet. Send a request from the Discover tab.' : 'No matching connections.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((conn) => {
            const otherId = getOtherUser(conn, myId);
            const count = unreadMap[otherId] || 0;
            return (
              <div key={conn.id} className="flex items-center gap-3 p-4 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {conn.avatar_url ? (
                      <img src={conn.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      getInitials(conn.full_name.split(' ')[0] || 'U', conn.full_name.split(' ')[1] || '')
                    )}
                  </div>
                  {count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-danger-500 text-white text-[10px] font-bold leading-none">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">{conn.full_name}</p>
                  <Badge variant="success" className="mt-1">Connected</Badge>
                </div>
                <Button
                  size="xs"
                  leftIcon={<MessageCircle className="w-3.5 h-3.5" />}
                  onClick={() => onChat(otherId, conn.full_name)}
                >
                  Message
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChatView({ myId, otherUserId, otherName, onBack }: { myId: string; otherUserId: string; otherName: string; onBack: () => void }) {
  const { error: notifyError } = useNotification();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    try {
      const data = await getConversation(otherUserId);
      setMessages(Array.isArray(data) ? data : []);
      // mark unread messages as read
      for (const msg of data) {
        if (!msg.is_read && msg.sender_id === otherUserId) {
          markMessageRead(msg.id).catch(() => {});
        }
      }
    } catch {
      notifyError('Error', 'Could not load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMessages(); }, [otherUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(otherUserId, text.trim());
      setMessages((prev) => [...prev, msg]);
      setText('');
    } catch (err: any) {
      notifyError('Failed', err?.response?.data?.error || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-200 dark:border-surface-800">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
          <ArrowLeft className="w-4 h-4 text-surface-500" />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-bold">
          {getInitials(otherName.split(' ')[0] || 'U', otherName.split(' ')[1] || '')}
        </div>
        <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">{otherName}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-surface-400 text-sm">No messages yet. Say hello!</div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === myId;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                  isMine
                    ? 'bg-primary-500 text-white rounded-br-md'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-bl-md'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-200' : 'text-surface-400'}`}>
                    {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3 border-t border-surface-200 dark:border-surface-800">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
        <Button type="submit" size="sm" disabled={!text.trim() || sending} leftIcon={<Send className="w-4 h-4" />}>
          Send
        </Button>
      </form>
    </div>
  );
}

export default function ConnectPage() {
  const { user } = useAuth();
  const myId = user?.id || '';
  const [activeTab, setActiveTab] = useState<Tab>('discover');
  const [chatTarget, setChatTarget] = useState<{ userId: string; name: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (chatTarget) {
    return (
      <ChatView
        myId={myId}
        otherUserId={chatTarget.userId}
        otherName={chatTarget.name}
        onBack={() => { setChatTarget(null); setRefreshKey((k) => k + 1); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Connect</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Discover students, send connection requests, and chat with your connections.
        </p>
      </div>

      <div className="flex gap-2">
        {([
          { key: 'discover', label: 'Discover', icon: Users },
          { key: 'requests', label: 'Requests', icon: UserPlus },
          { key: 'connections', label: 'Connections', icon: MessageCircle },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div key={refreshKey}>
        {activeTab === 'discover' && <DiscoverTab myId={myId} />}
        {activeTab === 'requests' && <RequestsTab myId={myId} onAccepted={() => setRefreshKey((k) => k + 1)} />}
        {activeTab === 'connections' && <ConnectionsTab myId={myId} onChat={(uid, name) => setChatTarget({ userId: uid, name: name })} />}
      </div>
    </div>
  );
}
