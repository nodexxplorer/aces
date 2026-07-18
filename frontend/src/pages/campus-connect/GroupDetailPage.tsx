import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import MessageBubble from '../../components/ui/MessageBubble';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { getGroup, getGroupMessages, getGroupMembers, sendGroupMessage } from '../../api/campus-connect';
import { Send, Users, Loader2 } from 'lucide-react';
import type { Group, GroupMember as ApiGroupMember, GroupMessage as ApiGroupMessage } from '../../types';

interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  category: string;
  is_private: boolean;
  member_count?: number;
  created_by: string;
}

const normalizeGroup = (groupData: Group): GroupInfo => ({
  id: groupData.id,
  name: groupData.name,
  description: groupData.description,
  category: groupData.type,
  is_private: groupData.isPrivate,
  member_count: groupData.memberCount,
  created_by: groupData.createdBy,
});

const normalizeGroupMessage = (message: ApiGroupMessage): GroupMessage => ({
  id: message.id,
  group_id: message.groupId,
  sender_id: message.senderId,
  content: message.content,
  created_at: message.createdAt || '',
  full_name: message.sender?.fullName || message.sender?.full_name,
  avatar_url: message.sender?.avatar || message.sender?.avatarUrl || message.sender?.avatar_url,
});

const normalizeGroupMember = (member: ApiGroupMember): GroupMember => ({
  id: member.id,
  group_id: member.groupId,
  user_id: member.userId,
  role: member.role,
  joined_at: member.joinedAt || '',
  full_name: member.user?.fullName || member.user?.full_name,
  avatar_url: member.user?.avatar || member.user?.avatarUrl || member.user?.avatar_url,
});

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  full_name?: string;
  avatar_url?: string;
}

interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  full_name?: string;
  avatar_url?: string;
}

const GroupDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { error } = useNotification();

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const [groupData, messagesData, membersData] = await Promise.all([
          getGroup(id),
          getGroupMessages(id),
          getGroupMembers(id),
        ]);
        setGroup(normalizeGroup(groupData));
        setMessages(messagesData.map(normalizeGroupMessage));
        setMembers(membersData.map(normalizeGroupMember));
      } catch {
        error('Failed to load', 'Could not fetch group details.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, error]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !id || sending) return;
    setSending(true);
    try {
      const sent = await sendGroupMessage(id, messageText.trim());
      setMessages((prev) => [...prev, normalizeGroupMessage(sent)]);
      setMessageText('');
    } catch {
      error('Send Failed', 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)] text-surface-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading group...
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)] text-surface-400">
        Group not found.
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex border border-surface-200 dark:border-surface-800 rounded-xl overflow-hidden bg-white dark:bg-surface-950 shadow-card">
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-surface-200 dark:border-surface-800 flex justify-between items-center bg-surface-50 dark:bg-surface-900">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-surface-900 dark:text-white">{group.name}</h3>
              {group.is_private ? (
                <Badge variant="outline">Private</Badge>
              ) : (
                <Badge variant="info">Public</Badge>
              )}
            </div>
            <p className="text-xs text-surface-500 mt-0.5">
              {group.category} · {group.member_count || members.length} members
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Users className="w-4 h-4" />}
            onClick={() => setShowMembers((prev) => !prev)}
          >
            Members
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-surface-400 text-sm">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                content={msg.content}
                senderName={msg.sender_id === user?.id ? 'You' : (msg.full_name || 'User')}
                senderAvatar={msg.avatar_url}
                timestamp={msg.created_at}
                isMine={msg.sender_id === user?.id}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="p-4 border-t border-surface-200 dark:border-surface-800 flex gap-2">
          <input
            type="text"
            placeholder="Write to group..."
            className="flex-1 px-4 py-2 text-sm bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
          />
          <Button
            type="submit"
            leftIcon={sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            disabled={!messageText.trim() || sending}
          />
        </form>
      </div>

      {showMembers && (
        <aside className="w-72 border-l border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900 flex flex-col">
          <div className="p-4 border-b border-surface-250 dark:border-surface-800">
            <h4 className="font-semibold text-sm">Members ({members.length})</h4>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-surface-150 dark:divide-surface-800">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    (m.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{m.full_name || 'User'}</p>
                  <p className="text-xs text-surface-500">{m.role}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
};

export default GroupDetailPage;
