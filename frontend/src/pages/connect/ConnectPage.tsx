import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getErrorMessage } from '../../utils/errors';
import { getMediaUrl } from '../../api/client';
import {
  Users,
  UserPlus,
  Check,
  X,
  MessageCircle,
  Send,
  ArrowLeft,
  Search,
  Loader2,
  ScanLine,
  Plus,
  Link2,
  UserCog,
  Compass,
} from 'lucide-react';
import {
  getDirectory,
  getPendingRequests,
  sendConnectionRequest,
  respondToConnection,
  getConversation,
  sendMessage,
  markMessageRead,
  getConnectionUserIds,
  getMyConversations,
  getMyGroups,
  getPublicGroups,
  getGroupMembers,
  addGroupMember,
  createGroup,
  joinGroup,
  sendGroupMessage,
  getGroupMessages,
  getGroupInviteCode,
  getGroupByInviteCode,
  type DirectoryUser,
  type Connection,
  type Message,
  type DMConversation,
  type GroupConversation,
  type Group,
  type GroupMessage,
  type PublicGroup,
  type GroupPreview,
} from '../../api/connect';
import { getInitials } from '../../utils/formatters';
import { PROFILE_SCAN_PARAM } from '../../utils/qr-scanner';
import { useWebSocket } from '../../hooks/useWebSocket';

function getChatSocketUrl(): string | undefined {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (!base) return undefined;
  return `${base.replace(/^http/, 'ws')}/api/v1/ws`;
}

function Avatar({
  name,
  url,
  className = 'w-10 h-10 text-xs',
}: {
  name: string;
  url?: string | null;
  className?: string;
}) {
  return (
    <div
      className={`rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden ${className}`}
    >
      {url ? (
        <img src={getMediaUrl(url) ?? undefined} alt="" className="w-full h-full object-cover" />
      ) : (
        getInitials(name.split(' ')[0] || 'U', name.split(' ')[1] || '')
      )}
    </div>
  );
}

function timeLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function QuickConnectBanner({ userId, myId, onDismiss }: { userId: string; myId: string; onDismiss: () => void }) {
  const { success, error: notifyError } = useNotification();
  const [target, setTarget] = useState<DirectoryUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [alreadyConnected, setAlreadyConnected] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    Promise.all([getDirectory(), getConnectionUserIds()])
      .then(([directory, connectedIds]) => {
        setTarget(directory.find((u) => u.id === userId) || null);
        setAlreadyConnected(connectedIds.includes(userId));
      })
      .catch(() => notifyError('Error', 'Could not look up this student'))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleConnect = async () => {
    try {
      await sendConnectionRequest(userId);
      setSent(true);
      success('Request Sent', `Connection request sent to ${target?.full_name}.`);
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not send request'));
    }
  };

  if (userId === myId) return null;

  return (
    <Card className="p-4 border-2 border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-950/20">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center shrink-0">
          <ScanLine className="w-5 h-5 text-primary-500" />
        </div>
        {loading ? (
          <p className="text-sm text-surface-500">Looking up scanned student...</p>
        ) : !target ? (
          <p className="text-sm text-surface-500">Couldn't find that student. They may not be in the directory.</p>
        ) : (
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <Avatar name={target.full_name} url={target.avatar_url} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">
                {target.full_name}
              </p>
              <p className="text-xs text-surface-500 truncate">
                {target.matric_number} &middot; Level {target.level}
              </p>
            </div>
            {alreadyConnected ? (
              <Badge variant="success">Already Connected</Badge>
            ) : sent ? (
              <Badge variant="info">Requested</Badge>
            ) : (
              <Button size="xs" onClick={handleConnect} leftIcon={<UserPlus className="w-3.5 h-3.5" />}>
                Connect
              </Button>
            )}
          </div>
        )}
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </Card>
  );
}

type View = 'chats' | 'discover' | 'requests';

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
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not send request'));
    }
  };

  const filtered = users.filter(
    (u) =>
      !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.matric_number.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
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
        <EmptyState title="No students found." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 p-4 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800"
            >
              <Avatar name={user.full_name} url={user.avatar_url} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">
                  {user.full_name}
                </p>
                <p className="text-xs text-surface-500 truncate">
                  {user.matric_number} &middot; Level {user.level}
                </p>
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

function RequestsTab({ onAccepted }: { onAccepted: () => void }) {
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
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not respond'));
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
        <EmptyState title="No pending requests." />
      ) : (
        requests.map((req) => (
          <div
            key={req.id}
            className="flex items-center gap-3 p-4 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800"
          >
            <Avatar name={req.full_name} url={req.avatar_url} />
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

function ConversationRow({
  avatarName,
  avatarUrl,
  title,
  preview,
  timestamp,
  unreadCount,
  active,
  onClick,
}: {
  avatarName: string;
  avatarUrl?: string | null;
  title: string;
  preview: string;
  timestamp: string;
  unreadCount?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
        active ? 'bg-primary-50 dark:bg-primary-950/30' : 'hover:bg-surface-100 dark:hover:bg-surface-800/60'
      }`}
    >
      <Avatar name={avatarName} url={avatarUrl} className="w-11 h-11 text-sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">{title}</p>
          {timestamp && <span className="text-[10px] text-surface-400 shrink-0">{timestamp}</span>}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-surface-500 truncate">{preview}</p>
          {!!unreadCount && (
            <span className="min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-primary-500 text-white text-[10px] font-bold leading-none shrink-0">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ChatListPanel({
  groups,
  dms,
  loading,
  activeKey,
  onSelectGroup,
  onSelectDM,
  onCreateGroup,
  onBrowseGroups,
  onJoinByLink,
}: {
  groups: GroupConversation[];
  dms: DMConversation[];
  loading: boolean;
  activeKey: string | null;
  onSelectGroup: (g: GroupConversation) => void;
  onSelectDM: (d: DMConversation) => void;
  onCreateGroup: () => void;
  onBrowseGroups: () => void;
  onJoinByLink: () => void;
}) {
  const [search, setSearch] = useState('');
  const filteredGroups = groups.filter((g) => !search || g.name.toLowerCase().includes(search.toLowerCase()));
  const filteredDMs = dms.filter((d) => !search || d.other_full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-surface-200 dark:border-surface-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between px-2 mb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-surface-400">Groups</p>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={onBrowseGroups}
                    className="p-1 rounded-md text-surface-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950/30"
                    title="Discover public groups"
                    aria-label="Discover public groups"
                  >
                    <Compass className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={onJoinByLink}
                    className="p-1 rounded-md text-surface-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950/30"
                    title="Join via invite link"
                    aria-label="Join via invite link"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={onCreateGroup}
                    className="p-1 rounded-md text-surface-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950/30"
                    title="New group"
                    aria-label="New group"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {filteredGroups.length === 0 ? (
                <p className="px-2 py-2 text-xs text-surface-400">No groups yet.</p>
              ) : (
                <div className="space-y-0.5">
                  {filteredGroups.map((g) => (
                    <ConversationRow
                      key={g.id}
                      avatarName={g.name}
                      avatarUrl={g.avatar_url}
                      title={g.name}
                      preview={
                        g.last_message
                          ? `${g.last_message_sender ? g.last_message_sender.split(' ')[0] + ': ' : ''}${g.last_message}`
                          : `${g.member_count} member${g.member_count === 1 ? '' : 's'}`
                      }
                      timestamp={timeLabel(g.last_message_at)}
                      active={activeKey === `group:${g.id}`}
                      onClick={() => onSelectGroup(g)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-surface-400">
                Direct Messages
              </p>
              {filteredDMs.length === 0 ? (
                <p className="px-2 py-2 text-xs text-surface-400">No conversations yet.</p>
              ) : (
                <div className="space-y-0.5">
                  {filteredDMs.map((d) => (
                    <ConversationRow
                      key={d.connection_id}
                      avatarName={d.other_full_name}
                      avatarUrl={d.other_avatar_url}
                      title={d.other_full_name}
                      preview={d.last_message ? `${d.last_message_mine ? 'You: ' : ''}${d.last_message}` : 'Say hello!'}
                      timestamp={timeLabel(d.last_message_at)}
                      unreadCount={d.unread_count}
                      active={activeKey === `dm:${d.other_user_id}`}
                      onClick={() => onSelectDM(d)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface ThreadMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string | null;
}

type ThreadTarget =
  | { kind: 'dm'; id: string; name: string; avatarUrl: string | null }
  | {
      kind: 'group';
      id: string;
      name: string;
      avatarUrl: string | null;
      memberCount: number;
      memberRole: string;
    };

function ThreadView({
  myId,
  target,
  onBack,
  incomingChat,
  incomingGroupChat,
  onAddMembers,
}: {
  myId: string;
  target: ThreadTarget;
  onBack: () => void;
  incomingChat: Message | null;
  incomingGroupChat: GroupMessage | null;
  onAddMembers: () => void;
}) {
  const { success, error: notifyError } = useNotification();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        if (target.kind === 'dm') {
          const data = await getConversation(target.id);
          if (cancelled) return;
          setMessages(
            data.map((m) => ({ id: m.id, sender_id: m.sender_id, content: m.content, created_at: m.created_at })),
          );
          for (const msg of data) {
            if (!msg.is_read && msg.sender_id === target.id) markMessageRead(msg.id).catch(() => {});
          }
        } else {
          const data = await getGroupMessages(target.id);
          if (cancelled) return;
          setMessages(
            data.map((m) => ({
              id: m.id,
              sender_id: m.sender_id,
              content: m.content,
              created_at: m.created_at,
              sender_name: m.full_name,
              sender_avatar: m.avatar_url,
            })),
          );
        }
      } catch {
        if (!cancelled) notifyError('Error', 'Could not load messages');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.kind, target.id]);

  useEffect(() => {
    if (target.kind !== 'dm' || !incomingChat) return;
    if (incomingChat.sender_id !== target.id) return;
    setMessages((prev) =>
      prev.some((m) => m.id === incomingChat.id)
        ? prev
        : [
            ...prev,
            {
              id: incomingChat.id,
              sender_id: incomingChat.sender_id,
              content: incomingChat.content,
              created_at: incomingChat.created_at,
            },
          ],
    );
    markMessageRead(incomingChat.id).catch(() => {});
  }, [incomingChat, target.kind, target.id]);

  useEffect(() => {
    if (target.kind !== 'group' || !incomingGroupChat) return;
    if (incomingGroupChat.group_id !== target.id) return;
    setMessages((prev) =>
      prev.some((m) => m.id === incomingGroupChat.id)
        ? prev
        : [
            ...prev,
            {
              id: incomingGroupChat.id,
              sender_id: incomingGroupChat.sender_id,
              content: incomingGroupChat.content,
              created_at: incomingGroupChat.created_at,
              sender_name: incomingGroupChat.full_name,
              sender_avatar: incomingGroupChat.avatar_url,
            },
          ],
    );
  }, [incomingGroupChat, target.kind, target.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      if (target.kind === 'dm') {
        const msg = await sendMessage(target.id, content);
        setMessages((prev) => [
          ...prev,
          { id: msg.id, sender_id: msg.sender_id, content: msg.content, created_at: msg.created_at },
        ]);
      } else {
        const msg = await sendGroupMessage(target.id, content);
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id)
            ? prev
            : [
                ...prev,
                {
                  id: msg.id,
                  sender_id: msg.sender_id,
                  content: msg.content,
                  created_at: msg.created_at,
                  sender_name: msg.full_name,
                  sender_avatar: msg.avatar_url,
                },
              ],
        );
      }
      setText('');
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not send message'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-900">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-200 dark:border-surface-800">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 lg:hidden">
          <ArrowLeft className="w-4 h-4 text-surface-500" />
        </button>
        <Avatar name={target.name} url={target.avatarUrl} className="w-9 h-9 text-xs" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">{target.name}</p>
          {target.kind === 'group' && (
            <p className="text-xs text-surface-400">
              {target.memberCount} member{target.memberCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
        {target.kind === 'group' && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={async () => {
                try {
                  const { invite_code } = await getGroupInviteCode(target.id);
                  const link = `${window.location.origin}/connect?g=${invite_code}`;
                  await navigator.clipboard.writeText(link);
                  success('Link Copied', 'Invite link copied — share it so others can join.');
                } catch {
                  notifyError('Failed', 'Could not copy the link');
                }
              }}
              className="p-1.5 rounded-lg text-surface-400 hover:text-primary-500 hover:bg-surface-100 dark:hover:bg-surface-800"
              title="Copy invite link"
              aria-label="Copy invite link"
            >
              <Link2 className="w-4 h-4" />
            </button>
            {(target.memberRole === 'admin' || target.memberRole === 'moderator') && (
              <button
                onClick={onAddMembers}
                className="p-1.5 rounded-lg text-surface-400 hover:text-primary-500 hover:bg-surface-100 dark:hover:bg-surface-800"
                title="Add members"
                aria-label="Add members"
              >
                <UserCog className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState title="No messages yet. Say hello!" />
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === myId;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} gap-2`}>
                {!isMine && target.kind === 'group' && (
                  <Avatar
                    name={msg.sender_name || 'U'}
                    url={msg.sender_avatar}
                    className="w-6 h-6 text-[9px] self-end"
                  />
                )}
                <div
                  className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                    isMine
                      ? 'bg-primary-500 text-white rounded-br-md'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-bl-md'
                  }`}
                >
                  {!isMine && target.kind === 'group' && (
                    <p className="text-[11px] font-semibold text-primary-500 mb-0.5">{msg.sender_name}</p>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-200' : 'text-surface-400'}`}>
                    {msg.created_at
                      ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-4 py-3 border-t border-surface-200 dark:border-surface-800"
      >
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

function CreateGroupModal({
  isOpen,
  onClose,
  onCreated,
  connections,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (group: Group) => void;
  connections: DMConversation[];
}) {
  const { success, error: notifyError } = useNotification();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('study');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const group = await createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        is_private: isPrivate,
        member_ids: Array.from(selectedIds),
      });
      success('Group Created', `"${group.name}" is ready.`);
      setName('');
      setDescription('');
      setCategory('study');
      setIsPrivate(false);
      setSelectedIds(new Set());
      onCreated(group);
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not create group'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Group" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Group Name"
          placeholder="e.g. CPE 500 Study Group"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What's this group about?"
            className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-surface-100 p-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
          />
        </div>
        <Select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={[
            { value: 'study', label: 'Study Group' },
            { value: 'project', label: 'Project' },
            { value: 'interest', label: 'Interest' },
            { value: 'class', label: 'Class' },
          ]}
        />
        <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="rounded border-surface-300"
          />
          Private group (invite only)
        </label>

        {connections.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Add members (optional)</label>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-surface-200 dark:border-surface-700 divide-y divide-surface-100 dark:divide-surface-800">
              {connections.map((c) => (
                <label
                  key={c.other_user_id}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-surface-700 dark:text-surface-300 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/60"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.other_user_id)}
                    onChange={() => toggleMember(c.other_user_id)}
                    className="rounded border-surface-300"
                  />
                  <Avatar name={c.other_full_name} url={c.other_avatar_url} className="w-6 h-6 text-[9px]" />
                  <span className="truncate">{c.other_full_name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <Button type="submit" className="w-full" isLoading={saving} disabled={!name.trim()}>
          Create Group
        </Button>
      </form>
    </Modal>
  );
}

function AddMembersModal({
  isOpen,
  onClose,
  groupId,
  groupName,
  connections,
}: {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  connections: DMConversation[];
}) {
  const { success, error: notifyError } = useNotification();
  const [existingMemberIds, setExistingMemberIds] = useState<Set<string>>(new Set());
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingMembers(true);
    setAddedIds(new Set());
    getGroupMembers(groupId)
      .then((members) => setExistingMemberIds(new Set(members.map((m) => m.user_id))))
      .catch(() => notifyError('Error', 'Could not load current members'))
      .finally(() => setLoadingMembers(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, groupId]);

  const handleAdd = async (userId: string, name: string) => {
    setAddingId(userId);
    try {
      await addGroupMember(groupId, userId);
      setAddedIds((prev) => new Set(prev).add(userId));
      success('Added', `${name} added to ${groupName}.`);
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not add member'));
    } finally {
      setAddingId(null);
    }
  };

  const candidates = connections.filter((c) => !existingMemberIds.has(c.other_user_id));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Add Members to ${groupName}`} size="sm">
      {loadingMembers ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
        </div>
      ) : candidates.length === 0 ? (
        <EmptyState title="All your connections are already in this group." className="py-6" />
      ) : (
        <div className="max-h-80 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800">
          {candidates.map((c) => {
            const added = addedIds.has(c.other_user_id);
            return (
              <div key={c.other_user_id} className="flex items-center gap-3 py-2.5">
                <Avatar name={c.other_full_name} url={c.other_avatar_url} className="w-9 h-9 text-xs" />
                <p className="flex-1 min-w-0 text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
                  {c.other_full_name}
                </p>
                {added ? (
                  <Badge variant="success">Added</Badge>
                ) : (
                  <Button
                    size="xs"
                    isLoading={addingId === c.other_user_id}
                    onClick={() => handleAdd(c.other_user_id, c.other_full_name)}
                  >
                    Add
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function BrowsePublicGroupsModal({
  isOpen,
  onClose,
  myGroupIds,
  onJoined,
}: {
  isOpen: boolean;
  onClose: () => void;
  myGroupIds: Set<string>;
  onJoined: () => void;
}) {
  const { success, error: notifyError } = useNotification();
  const [groups, setGroups] = useState<PublicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getPublicGroups()
      .then(setGroups)
      .catch(() => notifyError('Error', 'Could not load public groups'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleJoin = async (group: PublicGroup) => {
    setJoiningId(group.id);
    try {
      await joinGroup(group.id);
      success('Joined', `You're now in "${group.name}".`);
      onJoined();
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not join group'));
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Discover Groups" size="sm">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState title="No public groups yet." className="py-6" />
      ) : (
        <div className="max-h-80 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800">
          {groups.map((g) => {
            const alreadyIn = myGroupIds.has(g.id);
            return (
              <div key={g.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={g.name} url={g.avatar_url} className="w-9 h-9 text-xs" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{g.name}</p>
                  <p className="text-xs text-surface-400">
                    {g.member_count} member{g.member_count === 1 ? '' : 's'}
                  </p>
                </div>
                {alreadyIn ? (
                  <Badge variant="success">Joined</Badge>
                ) : (
                  <Button size="xs" isLoading={joiningId === g.id} onClick={() => handleJoin(g)}>
                    Join
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function GroupJoinBanner({
  code,
  myGroupIds,
  onDismiss,
  onJoined,
}: {
  code: string;
  myGroupIds: Set<string>;
  onDismiss: () => void;
  onJoined: () => void;
}) {
  const { success, error: notifyError } = useNotification();
  const [group, setGroup] = useState<GroupPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    getGroupByInviteCode(code)
      .then(setGroup)
      .catch(() => notifyError('Error', 'This invite link is invalid or has expired'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const alreadyMember = group ? myGroupIds.has(group.id) : false;

  const handleJoin = async () => {
    if (!group) return;
    setJoining(true);
    try {
      await joinGroup(group.id);
      setJoined(true);
      success('Joined', `You're now in "${group.name}".`);
      onJoined();
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not join group'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <Card className="p-4 border-2 border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-950/20">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center shrink-0">
          <Link2 className="w-5 h-5 text-primary-500" />
        </div>
        {loading ? (
          <p className="text-sm text-surface-500">Looking up group...</p>
        ) : !group ? (
          <p className="text-sm text-surface-500">This invite link is no longer valid.</p>
        ) : (
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <Avatar name={group.name} url={group.avatar_url} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">{group.name}</p>
              {group.description && <p className="text-xs text-surface-500 truncate">{group.description}</p>}
            </div>
            {alreadyMember || joined ? (
              <Badge variant="success">Joined</Badge>
            ) : (
              <Button
                size="xs"
                isLoading={joining}
                onClick={handleJoin}
                leftIcon={<UserPlus className="w-3.5 h-3.5" />}
              >
                Join Group
              </Button>
            )}
          </div>
        )}
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </Card>
  );
}

function JoinByLinkModal({
  isOpen,
  onClose,
  onSubmitCode,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmitCode: (code: string) => void;
}) {
  const [value, setValue] = useState('');

  const extractCode = (raw: string): string => {
    const trimmed = raw.trim();
    try {
      const url = new URL(trimmed);
      const fromParam = url.searchParams.get('g');
      if (fromParam) return fromParam;
    } catch {
      // not a full URL — treat the whole input as a bare code
    }
    return trimmed;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = extractCode(value);
    if (!code) return;
    onSubmitCode(code);
    setValue('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Join a Group" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Invite link or code"
          placeholder="Paste an invite link or code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <Button type="submit" className="w-full" disabled={!value.trim()}>
          Continue
        </Button>
      </form>
    </Modal>
  );
}

const GROUP_JOIN_PARAM = 'g';

export default function ConnectPage() {
  const { user } = useAuth();
  const myId = user?.id || '';
  const [view, setView] = useState<View>('chats');
  const [searchParams, setSearchParams] = useSearchParams();
  const scannedUserId = searchParams.get(PROFILE_SCAN_PARAM);
  const joinGroupCode = searchParams.get(GROUP_JOIN_PARAM);

  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [dms, setDms] = useState<DMConversation[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<ThreadTarget | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [joinByLinkOpen, setJoinByLinkOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [browseGroupsOpen, setBrowseGroupsOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);

  const [incomingChat, setIncomingChat] = useState<Message | null>(null);
  const [incomingGroupChat, setIncomingGroupChat] = useState<GroupMessage | null>(null);

  const { lastMessage } = useWebSocket(myId ? getChatSocketUrl() : undefined);

  const loadLists = useCallback(async () => {
    setListsLoading(true);
    try {
      const [groupData, dmData] = await Promise.all([
        getMyGroups().catch(() => []),
        getMyConversations().catch(() => []),
      ]);
      setGroups(groupData);
      setDms(dmData);
    } finally {
      setListsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    getPendingRequests()
      .then((data) => setPendingCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
  }, [view]);

  useEffect(() => {
    if (!lastMessage) return;
    try {
      const frame = JSON.parse(lastMessage) as { type: string; payload: Message & GroupMessage };
      if (frame.type === 'chat') {
        setIncomingChat(frame.payload);
        if (!activeThread || activeThread.kind !== 'dm' || activeThread.id !== frame.payload.sender_id) {
          loadLists();
        }
      } else if (frame.type === 'group_chat') {
        setIncomingGroupChat(frame.payload);
        if (!activeThread || activeThread.kind !== 'group' || activeThread.id !== frame.payload.group_id) {
          loadLists();
        }
      }
    } catch {
      // ignore malformed frames
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage]);

  const dismissScan = () => {
    const next = new URLSearchParams(searchParams);
    next.delete(PROFILE_SCAN_PARAM);
    setSearchParams(next, { replace: true });
  };

  const dismissJoinGroup = () => {
    const next = new URLSearchParams(searchParams);
    next.delete(GROUP_JOIN_PARAM);
    setSearchParams(next, { replace: true });
  };

  const handleJoinByCode = (code: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(GROUP_JOIN_PARAM, code);
    setSearchParams(next);
    setJoinByLinkOpen(false);
  };

  const openGroup = (g: GroupConversation) => {
    setActiveThread({
      kind: 'group',
      id: g.id,
      name: g.name,
      avatarUrl: g.avatar_url,
      memberCount: g.member_count,
      memberRole: g.member_role,
    });
  };

  const openDM = (d: DMConversation) => {
    setActiveThread({ kind: 'dm', id: d.other_user_id, name: d.other_full_name, avatarUrl: d.other_avatar_url });
  };

  const activeKey = activeThread ? `${activeThread.kind}:${activeThread.id}` : null;
  const myGroupIds = new Set(groups.map((g) => g.id));

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Connect</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Chat with your connections and groups, or discover more students.
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              { key: 'chats' as View, label: 'Chats', icon: MessageCircle, badge: undefined as number | undefined },
              { key: 'discover' as View, label: 'Discover', icon: Users, badge: undefined as number | undefined },
              { key: 'requests' as View, label: 'Requests', icon: UserPlus, badge: pendingCount },
            ] as const
          ).map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                view === key
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
              {!!badge && (
                <span className="min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-danger-500 text-white text-[10px] font-bold leading-none">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {scannedUserId && (
        <div className="mb-4">
          <QuickConnectBanner userId={scannedUserId} myId={myId} onDismiss={dismissScan} />
        </div>
      )}

      {joinGroupCode && (
        <div className="mb-4">
          <GroupJoinBanner
            code={joinGroupCode}
            myGroupIds={myGroupIds}
            onDismiss={dismissJoinGroup}
            onJoined={loadLists}
          />
        </div>
      )}

      {view === 'discover' && <DiscoverTab myId={myId} />}
      {view === 'requests' && <RequestsTab onAccepted={loadLists} />}

      {view === 'chats' && (
        <div className="flex-1 min-h-0 flex rounded-xl border border-surface-200 dark:border-surface-800 overflow-hidden bg-white dark:bg-surface-900">
          <div
            className={`w-full lg:w-80 shrink-0 border-r border-surface-200 dark:border-surface-800 ${activeThread ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'}`}
          >
            <ChatListPanel
              groups={groups}
              dms={dms}
              loading={listsLoading}
              activeKey={activeKey}
              onSelectGroup={openGroup}
              onSelectDM={openDM}
              onCreateGroup={() => setCreateGroupOpen(true)}
              onBrowseGroups={() => setBrowseGroupsOpen(true)}
              onJoinByLink={() => setJoinByLinkOpen(true)}
            />
          </div>

          <div className={`flex-1 min-w-0 ${activeThread ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'}`}>
            {activeThread ? (
              <ThreadView
                myId={myId}
                target={activeThread}
                onBack={() => setActiveThread(null)}
                incomingChat={incomingChat}
                incomingGroupChat={incomingGroupChat}
                onAddMembers={() => setAddMembersOpen(true)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <EmptyState
                  icon={<MessageCircle className="w-8 h-8 text-surface-400" />}
                  title="Select a conversation to start chatting"
                  description="Pick a group or a direct message from the list on the left."
                />
              </div>
            )}
          </div>
        </div>
      )}

      <CreateGroupModal
        isOpen={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        connections={dms}
        onCreated={(group) => {
          setCreateGroupOpen(false);
          loadLists();
          setActiveThread({
            kind: 'group',
            id: group.id,
            name: group.name,
            avatarUrl: group.avatar_url,
            memberCount: 1,
            memberRole: 'admin',
          });
        }}
      />

      <BrowsePublicGroupsModal
        isOpen={browseGroupsOpen}
        onClose={() => setBrowseGroupsOpen(false)}
        myGroupIds={myGroupIds}
        onJoined={loadLists}
      />

      <JoinByLinkModal
        isOpen={joinByLinkOpen}
        onClose={() => setJoinByLinkOpen(false)}
        onSubmitCode={handleJoinByCode}
      />

      {activeThread?.kind === 'group' && (
        <AddMembersModal
          isOpen={addMembersOpen}
          onClose={() => setAddMembersOpen(false)}
          groupId={activeThread.id}
          groupName={activeThread.name}
          connections={dms}
        />
      )}
    </div>
  );
}
