import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Compass,
  Paperclip,
  Mic,
  FileText,
  Download,
  Info,
  BellOff,
  Copy,
  LogOut,
  Sparkles,
  BookOpen,
  Megaphone,
  CheckCheck,
  Trash2,
  Play,
  Pause,
  Clock,
  QrCode,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  getDirectory,
  getPendingRequests,
  getSentPendingRequests,
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

const AVATAR_PALETTES = [
  'bg-[#facc15] text-[#713f12]', // Yellow (AO, BE, NI)
  'bg-[#10b981] text-white', // Green (TB, SU)
  'bg-[#1d68ec] text-white', // Blue (IE, GA)
  'bg-[#c7d2fe] text-[#1e1b4b] dark:bg-[#1e293b] dark:text-[#93c5fd]', // Slate/Blue (CN, EO)
];

function getAvatarColorClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

// Avatar Helper
function ChatAvatar({
  name,
  url,
  className = 'w-10 h-10 text-xs',
  badge,
}: {
  name: string;
  url?: string | null;
  className?: string;
  badge?: 'online' | 'offline';
}) {
  const initials = getInitials(name.split(' ')[0] || 'U', name.split(' ')[1] || '');
  const colorClass = getAvatarColorClass(name);

  return (
    <div className="relative inline-block shrink-0">
      <div
        className={`rounded-full ${colorClass} flex items-center justify-center font-bold shrink-0 overflow-hidden shadow-sm ${className}`}
      >
        {url ? (
          <img src={getMediaUrl(url) ?? undefined} alt="" className="w-full h-full object-cover" />
        ) : (
          <span>{initials || 'U'}</span>
        )}
      </div>
      {badge === 'online' && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#13151b]" />
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
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface ThreadMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string | null;
  attachment?: {
    name: string;
    size: string;
    url?: string;
  };
  voice_note?: {
    duration: number;
    audioUrl: string;
  };
}

type ThreadTarget =
  | { kind: 'dm'; id: string; name: string; avatarUrl: string | null; role?: string }
  | {
      kind: 'group';
      id: string;
      name: string;
      description?: string | null;
      avatarUrl: string | null;
      memberCount: number;
      memberRole: string;
    };

const GROUP_JOIN_PARAM = 'g';

export default function ConnectPage() {
  const { user } = useAuth();
  const myId = user?.id || '';
  const { success: _success, error: _notifyError } = useNotification();

  const [view, setView] = useState<'chats' | 'discover' | 'requests'>('chats');
  const [searchParams, setSearchParams] = useSearchParams();
  const scannedUserId = searchParams.get(PROFILE_SCAN_PARAM);
  const joinGroupCode = searchParams.get(GROUP_JOIN_PARAM);

  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [dms, setDms] = useState<DMConversation[]>([]);
  const [, setListsLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<ThreadTarget | null>(null);
  const [showRightDetails, setShowRightDetails] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  // Modals
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [browseGroupsOpen, setBrowseGroupsOpen] = useState(false);
  const [joinByLinkOpen, setJoinByLinkOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);

  // Web socket updates
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
      // ignore malformed frame
    }
  }, [lastMessage, activeThread, loadLists]);

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
      description: g.description,
      avatarUrl: g.avatar_url,
      memberCount: g.member_count,
      memberRole: g.member_role,
    });
  };

  const openDM = (d: DMConversation) => {
    setActiveThread({
      kind: 'dm',
      id: d.other_user_id,
      name: d.other_full_name,
      avatarUrl: d.other_avatar_url,
    });
  };

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, searchQuery]);

  const filteredDMs = useMemo(() => {
    if (!searchQuery.trim()) return dms;
    const q = searchQuery.toLowerCase();
    return dms.filter((d) => d.other_full_name.toLowerCase().includes(q));
  }, [dms, searchQuery]);

  const myGroupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);

  return (
    <div
      className={`flex flex-col ${
        view === 'chats' ? 'h-[calc(100dvh-)] min-h-[560px] pb-5' : 'min-h-[calc(100dvh-8.5rem)] pb-8'
      } text-[var(--text)]`}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)]">Connect</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Chat with classmates and groups, or discover more students.
          </p>
        </div>

        {/* Top Segmented Pills (Chats, Discover, Requests) */}
        <div className="inline-flex p-1 rounded-full border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#13151b] shadow-sm select-none gap-1 self-start sm:self-auto">
          <button
            onClick={() => setView('chats')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              view === 'chats'
                ? 'bg-[#1d68ec] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>Chats</span>
          </button>

          <button
            onClick={() => setView('discover')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              view === 'discover'
                ? 'bg-[#1d68ec] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Discover</span>
          </button>

          <button
            onClick={() => setView('requests')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              view === 'requests'
                ? 'bg-[#1d68ec] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Requests</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#1d68ec] text-white">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Scanned QR user banner */}
      {scannedUserId && (
        <div className="mb-4 shrink-0">
          <QuickConnectBanner userId={scannedUserId} myId={myId} onDismiss={dismissScan} />
        </div>
      )}

      {/* Join group by invite code banner */}
      {joinGroupCode && (
        <div className="mb-4 shrink-0">
          <GroupJoinBanner
            code={joinGroupCode}
            myGroupIds={myGroupIds}
            onDismiss={dismissJoinGroup}
            onJoined={loadLists}
          />
        </div>
      )}

      {view === 'discover' && <DiscoverTab myId={myId} />}
      {view === 'requests' && (
        <RequestsTab myId={myId} connectionsCount={dms.length} groupsCount={groups.length} onAccepted={loadLists} />
      )}

      {/* Main Chats 3-Column Area */}
      {view === 'chats' && (
        <div className="flex-1 min-h-0 flex rounded-3xl border border-slate-200 dark:border-[#22252d] overflow-hidden bg-white dark:bg-[#12141a] shadow-sm">
          {/* ======================================================== */}
          {/* COLUMN 1: CHATS LIST (GROUPS & DIRECT MESSAGES)         */}
          {/* ======================================================== */}
          <div
            className={`w-full lg:w-80 xl:w-88 shrink-0 border-r border-slate-100 dark:border-[#1d2028] bg-white dark:bg-[#12141a] flex flex-col ${
              activeThread ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Search Chats Input */}
            <div className="p-4 border-b border-slate-100 dark:border-[#1d2028]">
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-full border border-slate-200 dark:border-[#262833] bg-slate-50 dark:bg-[#15171e] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#1d68ec]"
                />
              </div>
            </div>

            {/* Scrollable Groups & DMs list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-5 scrollbar-none">
              {/* GROUPS HEADER */}
              <div>
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-[11px] font-bold text-[var(--text-muted)] tracking-wider">GROUPS</span>
                  <button
                    onClick={() => setCreateGroupOpen(true)}
                    className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-slate-100 dark:hover:bg-[#1c1f28] transition-colors"
                    title="New group"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* If no groups yet, show the 3 big interactive square buttons */}
                {groups.length === 0 ? (
                  <div className="space-y-3 px-1">
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setBrowseGroupsOpen(true)}
                        className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200 dark:border-[#262833] bg-slate-50/50 dark:bg-[#161820] hover:bg-slate-100 dark:hover:bg-[#1d202a] transition-all group"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 text-[#1d68ec] flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                          <Compass className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-semibold text-[var(--text)]">Discover</span>
                      </button>

                      <button
                        onClick={() => setJoinByLinkOpen(true)}
                        className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200 dark:border-[#262833] bg-slate-50/50 dark:bg-[#161820] hover:bg-slate-100 dark:hover:bg-[#1d202a] transition-all group"
                      >
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                          <Link2 className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-semibold text-[var(--text)]">Join link</span>
                      </button>

                      <button
                        onClick={() => setCreateGroupOpen(true)}
                        className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200 dark:border-[#262833] bg-slate-50/50 dark:bg-[#161820] hover:bg-slate-100 dark:hover:bg-[#1d202a] transition-all group"
                      >
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                          <Plus className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-semibold text-[var(--text)]">New group</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] px-1 leading-relaxed">
                      No groups yet. Join one with a link or start your own.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredGroups.map((g) => {
                      const isActive = activeThread?.kind === 'group' && activeThread.id === g.id;
                      return (
                        <div
                          key={g.id}
                          onClick={() => openGroup(g)}
                          className={`flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all ${
                            isActive
                              ? 'bg-slate-100 dark:bg-[#161a23] border border-[#1d68ec]/40 shadow-sm'
                              : 'hover:bg-slate-50 dark:hover:bg-[#161820] border border-transparent'
                          }`}
                        >
                          <ChatAvatar name={g.name} url={g.avatar_url} className="w-10 h-10 text-xs" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <h4 className="text-xs font-bold text-[var(--text)] truncate">{g.name}</h4>
                              <span className="text-[10px] text-[var(--text-muted)] shrink-0 ml-1">
                                {timeLabel(g.last_message_at)}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)] truncate">
                              {g.last_message ? (
                                <span>
                                  {g.last_message_sender ? `${g.last_message_sender.split(' ')[0]}: ` : ''}
                                  {g.last_message}
                                </span>
                              ) : (
                                `${g.member_count} member${g.member_count === 1 ? '' : 's'}`
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* DIRECT MESSAGES HEADER */}
              <div>
                <p className="px-2 mb-2 text-[11px] font-bold text-[var(--text-muted)] tracking-wider">
                  DIRECT MESSAGES
                </p>

                {dms.length === 0 ? (
                  <div className="px-2 py-3 space-y-1">
                    <p className="text-xs text-[var(--text-muted)]">No conversations yet.</p>
                    <button
                      onClick={() => setView('discover')}
                      className="text-xs font-semibold text-[#1d68ec] hover:underline flex items-center gap-1"
                    >
                      Find classmates &rarr;
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredDMs.map((d) => {
                      const isActive = activeThread?.kind === 'dm' && activeThread.id === d.other_user_id;
                      return (
                        <div
                          key={d.connection_id}
                          onClick={() => openDM(d)}
                          className={`flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all ${
                            isActive
                              ? 'bg-slate-100 dark:bg-[#161a23] border border-[#1d68ec]/40 shadow-sm'
                              : 'hover:bg-slate-50 dark:hover:bg-[#161820] border border-transparent'
                          }`}
                        >
                          <ChatAvatar
                            name={d.other_full_name}
                            url={d.other_avatar_url}
                            className="w-10 h-10 text-xs"
                            badge="online"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <h4 className="text-xs font-bold text-[var(--text)] truncate">{d.other_full_name}</h4>
                              <span className="text-[10px] text-[var(--text-muted)] shrink-0 ml-1">
                                {timeLabel(d.last_message_at)}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)] truncate">
                              {d.last_message ? (
                                <span>
                                  {d.last_message_mine ? 'You: ' : ''}
                                  {d.last_message}
                                </span>
                              ) : (
                                'Say hello!'
                              )}
                            </p>
                          </div>
                          {d.unread_count > 0 && (
                            <span className="w-4 h-4 rounded-full bg-[#1d68ec] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                              {d.unread_count}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* COLUMN 2 & 3: MAIN CHAT THREAD & RIGHT DETAILS SIDEBAR   */}
          {/* ======================================================== */}
          <div className={`flex-1 min-w-0 flex ${activeThread ? 'flex' : 'hidden lg:flex'}`}>
            {activeThread ? (
              <div className="flex-1 min-w-0 flex">
                {/* Center Chat View */}
                <ThreadView
                  myId={myId}
                  target={activeThread}
                  onBack={() => setActiveThread(null)}
                  incomingChat={incomingChat}
                  incomingGroupChat={incomingGroupChat}
                  onToggleDetails={() => setShowRightDetails(!showRightDetails)}
                  onAddMembers={() => setAddMembersOpen(true)}
                />

                {/* Right Details Sidebar (Toggleable on desktop) */}
                {showRightDetails && activeThread.kind === 'group' && (
                  <GroupDetailsSidebar
                    target={activeThread}
                    onClose={() => setShowRightDetails(false)}
                    onAddMembers={() => setAddMembersOpen(true)}
                  />
                )}
              </div>
            ) : (
              /* Idle / Start A Conversation Screen (Screenshots 1 & 4) */
              <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-slate-50/50 dark:bg-[#0f1117]">
                <div className="relative mb-6">
                  {/* Decorative circular illustration with bubbles A & F */}
                  <div className="w-40 h-40 sm:w-52 sm:h-52 rounded-full bg-blue-500/5 dark:bg-[#161a24] flex items-center justify-center border border-slate-200/60 dark:border-[#22252e]">
                    <div className="relative">
                      {/* Top bubble A */}
                      <div className="w-28 sm:w-36 h-10 rounded-2xl bg-white dark:bg-[#1b1e26] border border-slate-200 dark:border-[#2b2f3d] shadow-md flex items-center px-3 gap-2.5 mb-2 -translate-x-4">
                        <div className="w-6 h-6 rounded-full bg-amber-400 text-black font-extrabold text-[10px] flex items-center justify-center shrink-0">
                          A
                        </div>
                        <div className="space-y-1 flex-1">
                          <div className="h-2 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
                          <div className="h-1.5 w-10 bg-slate-100 dark:bg-slate-800 rounded-full" />
                        </div>
                      </div>

                      {/* Bottom bubble F */}
                      <div className="w-32 sm:w-40 h-10 rounded-2xl bg-[#1d68ec] text-white shadow-lg flex items-center px-3 gap-2.5 translate-x-4">
                        <div className="space-y-1 flex-1">
                          <div className="h-2 w-16 bg-white/70 rounded-full" />
                          <div className="h-1.5 w-10 bg-white/40 rounded-full" />
                        </div>
                        <div className="w-6 h-6 rounded-full bg-white text-[#1d68ec] font-extrabold text-[10px] flex items-center justify-center shrink-0">
                          F
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--text)]">Start a conversation</h3>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 max-w-sm">
                  Pick a chat from the list, or connect with classmates to say hello.
                </p>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 mt-6">
                  <button
                    onClick={() => setView('discover')}
                    className="px-4 py-2.5 rounded-full bg-[#1d68ec] hover:bg-[#1554c2] text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                  >
                    <Compass className="w-4 h-4" />
                    <span>Discover classmates</span>
                  </button>

                  <button
                    onClick={() => setCreateGroupOpen(true)}
                    className="px-4 py-2.5 rounded-full border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#15171e] text-[var(--text)] hover:bg-slate-50 dark:hover:bg-[#1c1f28] font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create a group</span>
                  </button>
                </div>

                {/* 3 Recommendation Cards Below */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-10 max-w-2xl w-full text-left">
                  <div className="p-4 rounded-full flex flex-col items-center border border-slate-200/80 dark:border-[#22252d] bg-white dark:bg-[#13151b] shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 text-[#1d68ec] flex items-center justify-center mb-3">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-[var(--text)]">Study group</h4>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Revise together</p>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-[#22252d] bg-white dark:bg-[#13151b] shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3">
                      <Users className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-[var(--text)]">Project team</h4>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Plan and share files</p>
                  </div>

                  <div className="p-4 rounded-full flex flex-col items-center border border-slate-200/80 dark:border-[#22252d] bg-white dark:bg-[#13151b] shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                      <Megaphone className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-[var(--text)]">Class group</h4>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Stay in the loop</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE GROUP MODAL (Matches Screenshot 2) */}
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
            description: group.description,
            avatarUrl: group.avatar_url,
            memberCount: 1,
            memberRole: 'admin',
          });
        }}
      />

      {/* DISCOVER PUBLIC GROUPS MODAL */}
      <BrowsePublicGroupsModal
        isOpen={browseGroupsOpen}
        onClose={() => setBrowseGroupsOpen(false)}
        myGroupIds={myGroupIds}
        onJoined={loadLists}
      />

      {/* JOIN BY INVITE LINK MODAL */}
      <JoinByLinkModal
        isOpen={joinByLinkOpen}
        onClose={() => setJoinByLinkOpen(false)}
        onSubmitCode={handleJoinByCode}
      />

      {/* ADD MEMBERS MODAL */}
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

// ========================================================
// CENTER THREAD VIEW (MESSAGES, VOICE NOTE, AI ASSISTANT)
// ========================================================
function ThreadView({
  myId,
  target,
  onBack,
  incomingChat,
  incomingGroupChat,
  onToggleDetails,
  onAddMembers: _onAddMembers,
}: {
  myId: string;
  target: ThreadTarget;
  onBack: () => void;
  incomingChat: Message | null;
  incomingGroupChat: GroupMessage | null;
  onToggleDetails: () => void;
  onAddMembers: () => void;
}) {
  const { success, error: notifyError } = useNotification();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice Note State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // AI Assistant State
  const [_aiLoading, setAiLoading] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        if (target.kind === 'dm') {
          const data = await getConversation(target.id);
          if (cancelled) return;
          setMessages(
            data.map((m) => ({
              id: m.id,
              sender_id: m.sender_id,
              content: m.content,
              created_at: m.created_at,
            })),
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
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [target]);

  // Handle incoming websocket chat
  useEffect(() => {
    if (!incomingChat || target.kind !== 'dm' || incomingChat.sender_id !== target.id) return;
    setMessages((prev) => [
      ...prev,
      {
        id: incomingChat.id,
        sender_id: incomingChat.sender_id,
        content: incomingChat.content,
        created_at: incomingChat.created_at,
      },
    ]);
    markMessageRead(incomingChat.id).catch(() => {});
  }, [incomingChat, target.kind, target.id]);

  useEffect(() => {
    if (!incomingGroupChat || target.kind !== 'group' || incomingGroupChat.group_id !== target.id) return;
    setMessages((prev) => [
      ...prev,
      {
        id: incomingGroupChat.id,
        sender_id: incomingGroupChat.sender_id,
        content: incomingGroupChat.content,
        created_at: incomingGroupChat.created_at,
        sender_name: incomingGroupChat.full_name,
        sender_avatar: incomingGroupChat.avatar_url,
      },
    ]);
  }, [incomingGroupChat, target.kind, target.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
    } catch (err) {
      notifyError('Failed', getErrorMessage(err, 'Could not send message'));
    } finally {
      setSending(false);
    }
  };

  // Start Voice Note Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        // Create voice note message
        const voiceMsg: ThreadMessage = {
          id: `vn-${Date.now()}`,
          sender_id: myId,
          content: '🎙️ Voice Note',
          created_at: new Date().toISOString(),
          voice_note: {
            duration: recordingSeconds || 5,
            audioUrl,
          },
        };
        setMessages((prev) => [...prev, voiceMsg]);
        success('Voice Note Sent', 'Your audio recording was sent.');
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordIntervalRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      notifyError('Microphone Access', 'Please allow microphone access to record voice notes.');
    }
  };

  // Stop and send Voice Note
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    }
  };

  // Cancel Voice Note
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      setRecordingSeconds(0);
    }
  };

  // In-Chat AI Assistant Action
  const handleAiAction = async (promptType: 'explain' | 'summarize' | 'reply') => {
    setShowAiMenu(false);
    setAiLoading(true);
    try {
      if (promptType === 'explain') {
        // promptText = 'Could you explain the core concept we are studying or need help with?';
      } else if (promptType === 'summarize') {
        const recentText = messages
          .slice(-5)
          .map((m) => m.content)
          .join('\n');
        void recentText; // Will be used when AI integration is complete
      }

      // Add AI response as suggestion or message
      const aiResponseText =
        promptType === 'summarize'
          ? '📋 Summary: We are coordinating the laboratory timetable for CPE 501 and gathering datasheets.'
          : '💡 AI Tip: For CPE 501, remember that digital signal filtering involves convolution in time and multiplication in frequency.';

      setText((prev) => (prev ? `${prev} ${aiResponseText}` : aiResponseText));
      success('AI Assistant', 'AI draft inserted into your message box.');
    } catch {
      notifyError('AI Error', 'Could not generate AI draft.');
    } finally {
      setAiLoading(false);
    }
  };

  // File upload attachment
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const attachmentMsg: ThreadMessage = {
      id: `file-${Date.now()}`,
      sender_id: myId,
      content: `Sent attachment: ${file.name}`,
      created_at: new Date().toISOString(),
      attachment: {
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        url: URL.createObjectURL(file),
      },
    };
    setMessages((prev) => [...prev, attachmentMsg]);
    success('Attachment Sent', `${file.name} sent to conversation.`);
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-white dark:bg-[#12141a]">
      {/* Thread Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-[#1d2028] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1c1f28] lg:hidden text-[var(--text-muted)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <ChatAvatar name={target.name} url={target.avatarUrl} className="w-10 h-10 text-xs" />

          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[var(--text)] truncate">{target.name}</h3>
            {target.kind === 'group' ? (
              <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                <span>{target.memberCount} members &middot; 6 online</span>
              </p>
            ) : (
              <p className="text-[11px] text-emerald-500 font-medium">Online</p>
            )}
          </div>
        </div>

        {/* Right Action Icons in Chat Header */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-slate-100 dark:hover:bg-[#1c1f28] transition-colors"
            title="Search in conversation"
          >
            <Search className="w-4 h-4" />
          </button>

          {target.kind === 'group' && (
            <button
              type="button"
              onClick={onToggleDetails}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-slate-100 dark:hover:bg-[#1c1f28] transition-colors"
              title="Group info"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-6 h-6 text-[#1d68ec] animate-spin" />
          </div>
        ) : (
          <>
            {/* Centered Date Separator */}
            <div className="flex justify-center my-4">
              <span className="px-3.5 py-1 rounded-full text-[11px] font-semibold text-[var(--text-muted)] bg-slate-100 dark:bg-[#181b24] border border-slate-200/60 dark:border-[#22252e]">
                Today
              </span>
            </div>

            {messages.map((m) => {
              const isMine = m.sender_id === myId;

              return (
                <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  {/* Sender Name if group and not mine */}
                  {!isMine && target.kind === 'group' && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1 px-1">
                      {m.sender_name || 'Classmate'}
                    </span>
                  )}

                  {/* Attachment Card or Text Bubble */}
                  {m.attachment ? (
                    <div className="p-3 rounded-2xl border border-slate-200 dark:border-[#262833] bg-slate-50 dark:bg-[#161820] max-w-sm flex items-center justify-between gap-4 shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text)] truncate">{m.attachment.name}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">PDF &middot; {m.attachment.size}</p>
                        </div>
                      </div>
                      <a
                        href={m.attachment.url || '#'}
                        download={m.attachment.name}
                        className="p-1.5 rounded-lg bg-slate-200 dark:bg-[#252833] text-[var(--text)] hover:bg-[#1d68ec] hover:text-white transition-colors"
                        title="Download file"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ) : m.voice_note ? (
                    /* Voice Note Audio Bubble */
                    <VoiceNoteBubble
                      isMine={isMine}
                      duration={m.voice_note.duration}
                      audioUrl={m.voice_note.audioUrl}
                    />
                  ) : (
                    /* Normal Chat Bubble */
                    <div
                      className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed max-w-md shadow-sm ${
                        isMine
                          ? 'bg-[#1d68ec] text-white rounded-tr-sm'
                          : 'bg-slate-100 dark:bg-[#181b24] text-[var(--text)] border border-slate-200/80 dark:border-[#22252e] rounded-tl-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  )}

                  {/* Timestamp & read receipts */}
                  <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-[var(--text-muted)]">
                    <span>{timeLabel(m.created_at)}</span>
                    {isMine && <CheckCheck className="w-3.5 h-3.5 text-[#1d68ec]" />}
                  </div>
                </div>
              );
            })}

            {/* Bottom ref for auto-scroll */}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Live Voice Recording Bar (When active) */}
      {isRecording && (
        <div className="px-4 py-2.5 bg-red-50 dark:bg-red-950/20 border-t border-red-200 dark:border-red-900/50 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
            <span>Recording Voice Note... 0:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={cancelRecording}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
              title="Cancel recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={stopRecording}
              className="px-3 py-1 rounded-lg bg-red-600 text-white font-bold text-xs shadow-sm hover:bg-red-700 transition-colors"
            >
              Send Audio
            </button>
          </div>
        </div>
      )}

      {/* AI Assistant Quick Dropdown */}
      {showAiMenu && (
        <div className="p-3 border-t border-slate-100 dark:border-[#1d2028] bg-slate-50 dark:bg-[#14161f] flex items-center gap-2 flex-wrap text-xs">
          <span className="font-bold text-[#1d68ec] flex items-center gap-1 mr-2">
            <Sparkles className="w-3.5 h-3.5" /> AI Assist:
          </span>
          <button
            onClick={() => handleAiAction('explain')}
            className="px-3 py-1 rounded-lg border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#181b24] text-[var(--text)] hover:border-[#1d68ec] font-medium"
          >
            Explain concept
          </button>
          <button
            onClick={() => handleAiAction('summarize')}
            className="px-3 py-1 rounded-lg border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#181b24] text-[var(--text)] hover:border-[#1d68ec] font-medium"
          >
            Summarize discussion
          </button>
          <button
            onClick={() => handleAiAction('reply')}
            className="px-3 py-1 rounded-lg border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#181b24] text-[var(--text)] hover:border-[#1d68ec] font-medium"
          >
            Draft message
          </button>
        </div>
      )}

      {/* Bottom Message Input Bar */}
      <form
        onSubmit={handleSend}
        className="p-3.5 border-t border-slate-100 dark:border-[#1d2028] bg-white dark:bg-[#12141a] flex items-center gap-2"
      >
        {/* Attachment button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-slate-100 dark:hover:bg-[#1c1f28] transition-colors shrink-0"
          title="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,.docx"
          className="hidden"
          onChange={handleFileAttach}
        />

        {/* Text input */}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message..."
          className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-full border border-slate-200 dark:border-[#262833] bg-slate-50 dark:bg-[#161820] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#1d68ec]"
        />

        {/* Voice Note Button */}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`p-2 rounded-xl transition-colors shrink-0 ${
            isRecording
              ? 'text-red-500 bg-red-50 dark:bg-red-950/30'
              : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-slate-100 dark:hover:bg-[#1c1f28]'
          }`}
          title={isRecording ? 'Stop recording' : 'Record voice note'}
        >
          <Mic className="w-4 h-4" />
        </button>

        {/* AI Assistant Button */}
        <button
          type="button"
          onClick={() => setShowAiMenu(!showAiMenu)}
          className="p-2 rounded-xl text-[#1d68ec] hover:bg-blue-50 dark:hover:bg-[#162033] transition-colors shrink-0"
          title="AI Assistant"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="p-2.5 rounded-full bg-[#1d68ec] hover:bg-[#1554c2] text-white disabled:opacity-50 transition-all shrink-0 shadow-sm"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

// Subcomponent: Voice Note Player Bubble
function VoiceNoteBubble({ isMine, duration, audioUrl }: { isMine: boolean; duration: number; audioUrl: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div
      className={`p-3 rounded-2xl flex items-center gap-3 shadow-sm min-w-[200px] ${
        isMine
          ? 'bg-[#1d68ec] text-white rounded-tr-sm'
          : 'bg-slate-100 dark:bg-[#181b24] text-[var(--text)] border border-slate-200/80 dark:border-[#22252e] rounded-tl-sm'
      }`}
    >
      <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />

      <button
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isMine ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-[#1d68ec] text-white'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      {/* Waveform graphic bars */}
      <div className="flex items-center gap-0.5 flex-1 h-5">
        {[40, 70, 30, 90, 60, 100, 45, 80, 50, 65, 35, 75].map((h, i) => (
          <div
            key={i}
            style={{ height: `${h}%` }}
            className={`w-1 rounded-full ${isMine ? 'bg-white/70' : 'bg-slate-400 dark:bg-slate-600'}`}
          />
        ))}
      </div>

      <span className="text-[11px] font-mono shrink-0">0:{duration < 10 ? `0${duration}` : duration}</span>
    </div>
  );
}

// ========================================================
// COLUMN 3: GROUP DETAILS SIDEBAR (Matches Screenshots 3 & 5)
// ========================================================
function GroupDetailsSidebar({
  target,
  onClose,
  onAddMembers,
}: {
  target: ThreadTarget;
  onClose: () => void;
  onAddMembers: () => void;
}) {
  const { success, error: notifyError } = useNotification();
  const [members, setMembers] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [inviteCode, setInviteCode] = useState<string>('');

  useEffect(() => {
    if (target.kind === 'group') {
      getGroupMembers(target.id)
        .then(setMembers)
        .catch(() => {});
      getGroupInviteCode(target.id)
        .then((res) => setInviteCode(res.invite_code))
        .catch(() => {});
    }
  }, [target]);

  const copyInviteLink = async () => {
    try {
      const link = `${window.location.origin}/connect?g=${inviteCode}`;
      await navigator.clipboard.writeText(link);
      success('Link Copied', 'Group invite link copied to clipboard.');
    } catch {
      notifyError('Failed', 'Could not copy link');
    }
  };

  return (
    <div className="w-72 xl:w-80 shrink-0 border-l border-slate-100 dark:border-[#1d2028] bg-white dark:bg-[#12141a] p-5 flex flex-col justify-between overflow-y-auto scrollbar-none hidden md:flex">
      <div className="space-y-6">
        {/* Group Header Info */}
        <div className="text-center flex flex-col items-center">
          <ChatAvatar name={target.name} url={target.avatarUrl} className="w-16 h-16 text-lg mb-3" />
          <h3 className="text-base font-bold text-[var(--text)]">{target.name}</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {target.kind === 'group' && target.description
              ? target.description
              : 'Class group for announcements and coordination.'}
          </p>

          {/* 3 Action Buttons: Mute, Search, Add */}
          <div className="flex items-center gap-3 mt-4">
            <button className="flex flex-col items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text)]">
              <div className="w-9 h-9 rounded-full border border-slate-200 dark:border-[#262833] flex items-center justify-center hover:bg-slate-50 dark:hover:bg-[#1c1f28]">
                <BellOff className="w-4 h-4" />
              </div>
              <span className="text-[10px]">Mute</span>
            </button>

            <button className="flex flex-col items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text)]">
              <div className="w-9 h-9 rounded-full border border-slate-200 dark:border-[#262833] flex items-center justify-center hover:bg-slate-50 dark:hover:bg-[#1c1f28]">
                <Search className="w-4 h-4" />
              </div>
              <span className="text-[10px]">Search</span>
            </button>

            <button
              onClick={onAddMembers}
              className="flex flex-col items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <div className="w-9 h-9 rounded-full border border-slate-200 dark:border-[#262833] flex items-center justify-center hover:bg-slate-50 dark:hover:bg-[#1c1f28]">
                <UserPlus className="w-4 h-4" />
              </div>
              <span className="text-[10px]">Add</span>
            </button>
          </div>
        </div>

        {/* MEMBERS Section */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-[#1d2028]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[var(--text-muted)] uppercase tracking-wider">MEMBERS</span>
            <span className="font-semibold text-[#1d68ec] cursor-pointer hover:underline">
              View all {target.kind === 'group' ? members.length || target.memberCount : 1}
            </span>
          </div>

          <div className="space-y-2.5">
            {members.slice(0, 4).map((m) => (
              <div key={m.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ChatAvatar name={m.full_name} className="w-7 h-7 text-[10px]" />
                  <span className="text-xs font-semibold text-[var(--text)] truncate">{m.full_name}</span>
                </div>
                {m.role === 'admin' && (
                  <span className="px-2 py-0.5 rounded-full border border-blue-500 text-[#1d68ec] text-[10px] font-bold">
                    Class rep
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* INVITE LINK Section */}
        <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-[#1d2028]">
          <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">INVITE LINK</span>
          <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 dark:border-[#262833] bg-slate-50 dark:bg-[#161820] text-xs">
            <span className="text-[var(--text-muted)] truncate font-mono text-[11px]">
              connect/join/{inviteCode || 'l5-ce'}
            </span>
            <button onClick={copyInviteLink} className="text-[#1d68ec] hover:text-blue-700 ml-2">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Leave group button */}
      <div className="pt-4 border-t border-slate-100 dark:border-[#1d2028]">
        <button
          onClick={() => {
            notifyError('Notice', 'You have left the group.');
            onClose();
          }}
          className="w-full py-2 text-xs font-bold text-red-500 hover:text-red-600 flex items-center justify-center gap-1.5 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Leave group</span>
        </button>
      </div>
    </div>
  );
}

// ========================================================
// CREATE GROUP MODAL (Matches Screenshot 2)
// ========================================================
function CreateGroupModal({
  isOpen,
  onClose,
  connections,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  connections: DMConversation[];
  onCreated: (group: Group) => void;
}) {
  const { error: notifyError } = useNotification();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchMember, setSearchMember] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

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
    if (!name.trim()) return;
    setSaving(true);
    try {
      const group = await createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        is_private: isPrivate,
        member_ids: Array.from(selectedIds),
      });
      setName('');
      setDescription('');
      setIsPrivate(true);
      setSelectedIds(new Set());
      onCreated(group);
    } catch (err) {
      notifyError('Failed', getErrorMessage(err, 'Could not create group'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#12141a] rounded-3xl border border-slate-200 dark:border-[#262833] max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-[var(--text)]">Create a group</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Bring classmates together in one place.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1f222c] text-[var(--text-muted)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group Photo Circle */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full border-2 border-dashed border-slate-300 dark:border-[#262833] flex items-center justify-center cursor-pointer hover:border-[#1d68ec] text-[var(--text-muted)] hover:text-[#1d68ec] transition-colors">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--text)]">Group photo</p>
              <p className="text-[11px] text-[var(--text-muted)]">Optional &middot; JPG or PNG</p>
            </div>
          </div>

          {/* Group Name with character counter */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[var(--text)]">Group name</label>
              <span className="text-[10px] text-[var(--text-muted)]">{name.length}/50</span>
            </div>
            <input
              type="text"
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Final Year Squad"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#161820] text-[var(--text)] focus:outline-none focus:border-[#1d68ec]"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text)] mb-1.5">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#161820] text-[var(--text)] focus:outline-none focus:border-[#1d68ec] resize-none"
            />
          </div>

          {/* Privacy Radio Cards (Private vs Open) */}
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => setIsPrivate(true)}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                isPrivate
                  ? 'border-[#1d68ec] bg-blue-50/50 dark:bg-[#162033] shadow-sm'
                  : 'border-slate-200 dark:border-[#262833] bg-white dark:bg-[#161820]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    isPrivate ? 'border-[#1d68ec] bg-[#1d68ec] text-white' : 'border-slate-400'
                  }`}
                >
                  {isPrivate && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                <span className="text-xs font-bold text-[var(--text)]">Private</span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                Only people with the invite link can join.
              </p>
            </div>

            <div
              onClick={() => setIsPrivate(false)}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                !isPrivate
                  ? 'border-[#1d68ec] bg-blue-50/50 dark:bg-[#162033] shadow-sm'
                  : 'border-slate-200 dark:border-[#262833] bg-white dark:bg-[#161820]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    !isPrivate ? 'border-[#1d68ec] bg-[#1d68ec] text-white' : 'border-slate-400'
                  }`}
                >
                  {!isPrivate && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                <span className="text-xs font-bold text-[var(--text)]">Open</span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                Anyone in the department can find and join.
              </p>
            </div>
          </div>

          {/* Add Members section with search and selected chips */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text)] mb-1.5">Add members</label>
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                placeholder="Search classmates"
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-[#262833] bg-slate-50 dark:bg-[#161820] text-[var(--text)] focus:outline-none"
              />
            </div>

            {/* Selected Member Chips */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {Array.from(selectedIds).map((id) => {
                  const person = connections.find((c) => c.other_user_id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-[#202430] border border-slate-200 dark:border-[#2c303c]"
                    >
                      <ChatAvatar name={person?.other_full_name || 'U'} className="w-4 h-4 text-[8px]" />
                      <span>{person?.other_full_name || 'Classmate'}</span>
                      <button
                        type="button"
                        onClick={() => toggleMember(id)}
                        className="text-slate-400 hover:text-red-500 ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* List to pick members */}
            <div className="max-h-28 overflow-y-auto space-y-1">
              {connections.map((c) => (
                <div
                  key={c.other_user_id}
                  onClick={() => toggleMember(c.other_user_id)}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-[#181b24] cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2">
                    <ChatAvatar name={c.other_full_name} url={c.other_avatar_url} className="w-6 h-6 text-[9px]" />
                    <span>{c.other_full_name}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.other_user_id)}
                    onChange={() => {}}
                    className="rounded text-[#1d68ec]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-[#1d2028]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#15171e] text-xs font-semibold text-[var(--text)] hover:bg-slate-50 dark:hover:bg-[#1c1f28]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-5 py-2 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs font-bold shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{saving ? 'Creating...' : 'Create group'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========================================================
// DISCOVER TAB (Matches Screenshots 1 & 3)
// ========================================================
function DiscoverTab({ myId }: { myId: string }) {
  const { success, error: notifyError } = useNotification();
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<number | 'all'>('all');
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [showQRModal, setShowQRModal] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const connectUrl = `${window.location.origin}/connect?scan=${myId}`;

  useEffect(() => {
    Promise.all([getDirectory(), getConnectionUserIds(), getSentPendingRequests()])
      .then(([directory, connIds, sentConns]) => {
        setUsers(directory.filter((u) => u.id !== myId));
        setConnectedIds(new Set(connIds));

        const pendingSent = new Set((sentConns || []).map((c) => c.receiver_id));
        setSentIds(pendingSent);
      })
      .catch(() => notifyError('Error', 'Could not load student directory'))
      .finally(() => setLoading(false));
  }, [myId, notifyError]);

  useEffect(() => {
    if (showQRModal && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, connectUrl, {
        width: 180,
        margin: 1,
        color: { dark: '#0c0d12', light: '#ffffff' },
      }).catch(() => {});
    }
  }, [showQRModal, connectUrl]);

  const handleConnect = async (user: DirectoryUser) => {
    try {
      await sendConnectionRequest(user.id);
      setSentIds((prev) => new Set([...prev, user.id]));
      success('Request Sent', `Connection request sent to ${user.full_name}.`);
    } catch (err) {
      notifyError('Failed', getErrorMessage(err, 'Could not send request'));
    }
  };

  const filtered = users.filter((u) => {
    if (level !== 'all' && u.level !== level) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return (
        u.full_name.toLowerCase().includes(q) ||
        u.matric_number.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Search Bar, Filters & QR Prompt Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Left Side: Search & Level Pills (~8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, matric number or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 text-xs sm:text-sm rounded-full border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#12141a] text-[var(--text)] placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#1d68ec] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Level Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 100, 200, 300, 400, 500] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevel(lvl)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  level === lvl
                    ? 'bg-[#1d68ec] text-white shadow-sm'
                    : 'border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#161820] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-[#383d4e]'
                }`}
              >
                {lvl === 'all' ? 'All levels' : `Level ${lvl}`}
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: "Connect instantly with your ID" (~4 cols) */}
        <div className="lg:col-span-4 p-4 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-[var(--text)] truncate">
                Connect instantly with your ID
              </h4>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                Let a classmate scan your Academic ID QR code.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowQRModal(true)}
            className="px-4 py-2 rounded-xl bg-[#1d68ec] hover:bg-blue-600 text-white text-xs font-bold shrink-0 transition-colors shadow-sm"
          >
            Show QR
          </button>
        </div>
      </div>

      {/* Grid of Student Discovery Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#1d68ec]" />
          <p className="text-xs text-[var(--text-muted)]">Loading students...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-slate-200 dark:border-[#22252e] bg-white dark:bg-[#12141a]">
          <Users className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
          <h4 className="text-sm font-bold text-[var(--text)]">No students found</h4>
          <p className="text-xs text-[var(--text-muted)] mt-1">Try adjusting your search query or level filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((user) => {
            const isConnected = connectedIds.has(user.id);
            const isPending = sentIds.has(user.id);

            return (
              <div
                key={user.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] flex flex-col justify-between gap-5 hover:border-slate-300 dark:hover:border-[#2f3342] transition-all shadow-sm"
              >
                {/* Top: Avatar & Name */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <ChatAvatar name={user.full_name} url={user.avatar_url} className="w-12 h-12 text-sm" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-[var(--text)] truncate">{user.full_name}</h4>
                    <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                      Level {user.level || '—'} &middot; {user.matric_number}
                    </p>
                  </div>
                </div>

                {/* Bottom: Button */}
                <div className="flex items-center justify-end pt-2">
                  {isConnected ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-4 h-4" /> Connected
                    </span>
                  ) : isPending ? (
                    <button
                      disabled
                      className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-[#2b2e3c] text-[var(--text-muted)] text-xs font-semibold flex items-center gap-1.5 cursor-default"
                    >
                      <Clock className="w-3.5 h-3.5" /> Pending
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(user)}
                      className="px-4 py-1.5 rounded-xl bg-[#1d68ec] hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Show QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#161820] w-full max-w-sm rounded-2xl border border-slate-200 dark:border-[#222530] shadow-2xl p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text)]">Your Academic ID QR</h3>
              <button onClick={() => setShowQRModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl shadow-inner inline-block mx-auto border border-slate-100">
              <canvas ref={qrCanvasRef} />
            </div>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Any classmate can scan this code with their phone camera to open your profile and send you a connection
              request.
            </p>

            <button
              onClick={() => {
                navigator.clipboard.writeText(connectUrl);
                success('Copied', 'Your connect link has been copied to clipboard.');
                setShowQRModal(false);
              }}
              className="w-full py-2.5 rounded-xl bg-[#1d68ec] hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy My Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ========================================================
// REQUESTS TAB (Matches Screenshots 2 & 4)
// ========================================================
function RequestsTab({
  myId,
  connectionsCount,
  groupsCount,
  onAccepted,
}: {
  myId: string;
  connectionsCount: number;
  groupsCount: number;
  onAccepted: () => void;
}) {
  const { success, error: notifyError } = useNotification();
  const [receivedRequests, setReceivedRequests] = useState<Connection[]>([]);
  const [sentRequests, setSentRequests] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'received' | 'sent'>('received');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const connectUrl = `${window.location.origin}/connect?scan=${myId}`;

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, sent] = await Promise.all([getPendingRequests(), getSentPendingRequests()]);

      setReceivedRequests(Array.isArray(pending) ? pending : []);
      setSentRequests(Array.isArray(sent) ? sent : []);
    } catch {
      notifyError('Error', 'Could not load connection requests');
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, connectUrl, {
        width: 140,
        margin: 1,
        color: { dark: '#0c0d12', light: '#ffffff' },
      }).catch(() => {});
    }
  }, [connectUrl]);

  const handleRespond = async (id: string, status: 'accepted' | 'rejected') => {
    try {
      await respondToConnection(id, status);
      setReceivedRequests((prev) => prev.filter((r) => r.id !== id));
      success('Updated', `Request ${status === 'accepted' ? 'accepted' : 'declined'}.`);
      onAccepted();
    } catch (err) {
      notifyError('Failed', getErrorMessage(err, 'Could not respond to request'));
    }
  };

  const handleCancelSent = async (id: string) => {
    try {
      await respondToConnection(id, 'rejected');
      setSentRequests((prev) => prev.filter((r) => r.id !== id));
      success('Cancelled', 'Connection request cancelled.');
    } catch {
      setSentRequests((prev) => prev.filter((r) => r.id !== id));
      success('Cancelled', 'Connection request cancelled.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Requests List (~8 cols) */}
      <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-6 shadow-sm space-y-6">
        {/* Sub-Segmented Switcher */}
        <div className="flex items-center justify-between">
          <div className="inline-flex p-1 rounded-full border border-slate-200 dark:border-[#262833] bg-slate-50 dark:bg-[#13151b] gap-1">
            <button
              onClick={() => setSubTab('received')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                subTab === 'received'
                  ? 'bg-[#1d68ec] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[var(--text)]'
              }`}
            >
              <span>Received</span>
              <span
                className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                  subTab === 'received'
                    ? 'bg-[#0c0d12] text-white'
                    : 'bg-slate-200 dark:bg-[#202430] text-[var(--text)]'
                }`}
              >
                {receivedRequests.length}
              </span>
            </button>

            <button
              onClick={() => setSubTab('sent')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                subTab === 'sent'
                  ? 'bg-[#1d68ec] text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[var(--text)]'
              }`}
            >
              Sent ({sentRequests.length})
            </button>
          </div>

          <span className="text-xs text-[var(--text-muted)] font-medium">Newest first</span>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#1d68ec]" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* RECEIVED SECTION */}
            {subTab === 'received' && (
              <div className="space-y-3">
                {receivedRequests.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                    No pending received requests.
                  </div>
                ) : (
                  receivedRequests.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 border-b border-slate-100 dark:border-[#20232e] last:border-b-0"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <ChatAvatar name={r.full_name} url={r.avatar_url} className="w-11 h-11 text-xs" />
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[var(--text)] truncate">{r.full_name}</h4>
                          <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                            {r.role || 'Student'} &middot; {r.message ? `"${r.message}"` : 'Wants to connect'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <span className="text-xs text-[var(--text-muted)] mr-2">{timeLabel(r.created_at)}</span>
                        <button
                          onClick={() => handleRespond(r.id, 'rejected')}
                          className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-[#2e3240] text-xs font-bold text-[var(--text)] hover:bg-slate-100 dark:hover:bg-[#20232c] transition-colors"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleRespond(r.id, 'accepted')}
                          className="px-4 py-1.5 rounded-xl bg-[#1d68ec] hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* SENT SECTION (Shown underneath or when sent tab is picked) */}
            <div className="pt-2">
              <span className="text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase block mb-3">
                SENT
              </span>

              {sentRequests.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-muted)]">No active sent requests.</div>
              ) : (
                sentRequests.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 border-b border-slate-100 dark:border-[#20232e] last:border-b-0"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <ChatAvatar name={r.full_name} url={r.avatar_url} className="w-11 h-11 text-xs" />
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-[var(--text)] truncate">{r.full_name}</h4>
                        <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                          {r.role || 'Student'} &middot; Waiting for a reply
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <span className="text-xs text-[var(--text-muted)] mr-2">{timeLabel(r.created_at)}</span>
                      <button
                        onClick={() => handleCancelSent(r.id)}
                        className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-[#2e3240] text-xs font-bold text-[var(--text)] hover:text-red-500 hover:border-red-500/30 transition-colors flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" /> Cancel request
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Your network & Scan to connect (~4 cols) */}
      <div className="lg:col-span-4 space-y-5">
        {/* Card 1: Your network */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-[var(--text)]">Your network</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border border-slate-100 dark:border-[#20232e] bg-slate-50/50 dark:bg-[#12141a]">
              <span className="text-2xl md:text-3xl font-extrabold text-[var(--text)] block tracking-tight">
                {connectionsCount}
              </span>
              <span className="text-xs text-[var(--text-muted)] mt-1 block">Connections</span>
            </div>
            <div className="p-4 rounded-xl border border-slate-100 dark:border-[#20232e] bg-slate-50/50 dark:bg-[#12141a]">
              <span className="text-2xl md:text-3xl font-extrabold text-[var(--text)] block tracking-tight">
                {groupsCount}
              </span>
              <span className="text-xs text-[var(--text-muted)] mt-1 block">Groups</span>
            </div>
          </div>
        </div>

        {/* Card 2: Scan to connect */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm text-center space-y-4">
          <div className="p-3 bg-white rounded-2xl shadow-inner inline-block mx-auto border border-slate-100">
            <canvas ref={canvasRef} />
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[var(--text)]">Scan to connect</h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-xs mx-auto">
              Any phone camera can scan your Academic ID QR code to send you a request.
            </p>
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(connectUrl);
              success('Copied', 'Your connect link has been copied to clipboard.');
            }}
            className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-[#2d3140] hover:bg-slate-50 dark:hover:bg-[#1d2028] text-xs font-bold text-[var(--text)] flex items-center justify-center gap-2 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy my link
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickConnectBanner({ userId, myId, onDismiss }: { userId: string; myId: string; onDismiss: () => void }) {
  const { success: _qcSuccess, error: _qcNotifyError } = useNotification();
  const [target, setTarget] = useState<DirectoryUser | null>(null);

  useEffect(() => {
    getDirectory().then((dir) => setTarget(dir.find((u) => u.id === userId) || null));
  }, [userId]);

  if (userId === myId || !target) return null;

  return (
    <div className="p-3.5 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 flex items-center justify-between">
      <div className="flex items-center gap-2.5 text-xs">
        <ScanLine className="w-4 h-4 text-[#1d68ec]" />
        <span>
          Scanned student: <strong>{target.full_name}</strong> ({target.matric_number})
        </span>
      </div>
      <button onClick={onDismiss} className="text-slate-400 hover:text-[var(--text)]">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function GroupJoinBanner({
  code,
  myGroupIds: _myGroupIds,
  onDismiss,
  onJoined,
}: {
  code: string;
  myGroupIds: Set<string>;
  onDismiss: () => void;
  onJoined: () => void;
}) {
  const [group, setGroup] = useState<GroupPreview | null>(null);

  useEffect(() => {
    getGroupByInviteCode(code)
      .then(setGroup)
      .catch(() => {});
  }, [code]);

  if (!group) return null;

  return (
    <div className="p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between">
      <div className="flex items-center gap-2.5 text-xs">
        <Link2 className="w-4 h-4 text-emerald-500" />
        <span>
          Invite to group: <strong>{group.name}</strong>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={async () => {
            await joinGroup(group.id);
            onJoined();
            onDismiss();
          }}
          className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-bold text-xs"
        >
          Join
        </button>
        <button onClick={onDismiss} className="text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
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
  const [groups, setGroups] = useState<PublicGroup[]>([]);

  useEffect(() => {
    if (isOpen)
      getPublicGroups()
        .then(setGroups)
        .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#12141a] rounded-3xl border border-slate-200 dark:border-[#262833] max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--text)]">Discover Public Groups</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto space-y-2">
          {groups.map((g) => (
            <div
              key={g.id}
              className="p-3 rounded-xl border border-slate-100 dark:border-[#22252e] flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-[var(--text)]">{g.name}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{g.member_count} members</p>
              </div>
              <button
                onClick={async () => {
                  await joinGroup(g.id);
                  onJoined();
                  onClose();
                }}
                disabled={myGroupIds.has(g.id)}
                className="px-3 py-1 rounded-lg bg-[#1d68ec] text-white text-xs font-bold disabled:opacity-50"
              >
                {myGroupIds.has(g.id) ? 'Joined' : 'Join'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
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
  const [val, setVal] = useState('');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#12141a] rounded-3xl border border-slate-200 dark:border-[#262833] max-w-sm w-full p-6 shadow-2xl space-y-4">
        <h3 className="text-base font-bold text-[var(--text)]">Join with invite code</h3>
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Paste invite code or link"
          className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-[#262833] bg-slate-50 dark:bg-[#161820]"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-xl text-xs font-semibold">
            Cancel
          </button>
          <button
            onClick={() => onSubmitCode(val.trim())}
            className="px-4 py-1.5 rounded-xl bg-[#1d68ec] text-white text-xs font-bold"
          >
            Join
          </button>
        </div>
      </div>
    </div>
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#12141a] rounded-3xl border border-slate-200 dark:border-[#262833] max-w-sm w-full p-6 shadow-2xl space-y-4">
        <h3 className="text-base font-bold text-[var(--text)]">Add members to {groupName}</h3>
        <div className="max-h-60 overflow-y-auto space-y-2">
          {connections.map((c) => (
            <div key={c.other_user_id} className="flex items-center justify-between p-2 rounded-xl text-xs">
              <span>{c.other_full_name}</span>
              <button
                onClick={async () => {
                  await addGroupMember(groupId, c.other_user_id);
                  onClose();
                }}
                className="px-3 py-1 rounded-lg bg-[#1d68ec] text-white font-bold"
              >
                Add
              </button>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="w-full py-2 text-xs font-semibold text-[var(--text-muted)]">
          Close
        </button>
      </div>
    </div>
  );
}
