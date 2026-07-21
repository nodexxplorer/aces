import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import MessageBubble from '../../components/ui/MessageBubble';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { getGroup, getGroupMessages, getGroupMembers, sendGroupMessage } from '../../api/campus-connect';
import { toggleMessageReaction, listGroupFiles, uploadGroupFile } from '../../api/campus-connect-v2';
import {
  Send, Users, Loader2, FolderOpen, Upload, SmilePlus, File,
  Image as ImageIcon, FileText as FileIcon, Download
} from 'lucide-react';
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

interface GroupFile {
  id: string;
  group_id: string;
  uploaded_by: string;
  uploaded_by_name: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

const REACTION_OPTIONS = [
  { type: 'like', emoji: '👍' },
  { type: 'love', emoji: '❤️' },
  { type: 'celebrate', emoji: '🎉' },
  { type: 'insightful', emoji: '💡' },
  { type: 'funny', emoji: '😂' },
];

const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const getFileIcon = (fileType: string | null) => {
  if (!fileType) return <File className="w-5 h-5 text-surface-400" />;
  if (fileType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
  if (fileType.includes('pdf')) return <FileIcon className="w-5 h-5 text-red-500" />;
  return <File className="w-5 h-5 text-surface-400" />;
};

const GroupDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { success, error: errorFn } = useNotification();

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [files, setFiles] = useState<GroupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'members' | 'files'>('chat');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const [groupData, messagesData, membersData, filesData] = await Promise.all([
          getGroup(id),
          getGroupMessages(id),
          getGroupMembers(id),
          listGroupFiles(id),
        ]);
        setGroup(normalizeGroup(groupData));
        setMessages(Array.isArray(messagesData) ? messagesData.map(normalizeGroupMessage) : []);
        setMembers(Array.isArray(membersData) ? membersData.map(normalizeGroupMember) : []);
        setFiles(Array.isArray(filesData) ? filesData : []);
      } catch {
        errorFn('Failed to load', 'Could not fetch group details.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, errorFn]);

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
      errorFn('Send Failed', 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (messageId: string, reactionType: string) => {
    try {
      await toggleMessageReaction(messageId, reactionType);
      setReactionTarget(null);
    } catch {
      errorFn('Reaction Failed', 'Could not add reaction.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploadingFile(true);
    try {
      const uploaded = await uploadGroupFile(id, {
        file_name: file.name,
        file_url: URL.createObjectURL(file),
        file_type: file.type,
        file_size: file.size,
      });
      setFiles((prev) => [uploaded, ...prev]);
      success('File Uploaded', `${file.name} has been shared with the group.`);
    } catch {
      errorFn('Upload Failed', 'Could not upload file.');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
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
          <div className="flex gap-1">
            {(['chat', 'members', 'files'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                  activeTab === tab
                    ? 'bg-primary-500 text-white'
                    : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-surface-400 text-sm">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="group relative">
                    <MessageBubble
                      content={msg.content}
                      senderName={msg.sender_id === user?.id ? 'You' : (msg.full_name || 'User')}
                      senderAvatar={msg.avatar_url}
                      timestamp={msg.created_at}
                      isMine={msg.sender_id === user?.id}
                    />
                    <button
                      onClick={() => setReactionTarget(reactionTarget === msg.id ? null : msg.id)}
                      className="absolute -right-1 top-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700"
                    >
                      <SmilePlus className="w-3.5 h-3.5 text-surface-500" />
                    </button>
                    {reactionTarget === msg.id && (
                      <div className="absolute right-0 -top-2 z-10 flex gap-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-full px-2 py-1 shadow-lg">
                        {REACTION_OPTIONS.map((r) => (
                          <button
                            key={r.type}
                            onClick={() => handleReact(msg.id, r.type)}
                            className="text-sm hover:scale-125 transition-transform"
                            title={r.type}
                          >
                            {r.emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
          </>
        )}

        {activeTab === 'members' && (
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
        )}

        {activeTab === 'files' && (
          <div className="flex-1 flex flex-col">
            <div className="p-3 border-b border-surface-200 dark:border-surface-800 flex justify-between items-center">
              <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300">
                {files.length} file{files.length !== 1 ? 's' : ''}
              </h4>
              <label className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                uploadingFile
                  ? 'bg-surface-100 text-surface-400 cursor-not-allowed'
                  : 'bg-primary-500 text-white hover:bg-primary-600'
              }`}>
                {uploadingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploadingFile ? 'Uploading...' : 'Upload File'}
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                />
              </label>
            </div>
            <div className="flex-1 overflow-y-auto">
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-surface-400 py-12">
                  <FolderOpen className="w-10 h-10 mb-2" />
                  <p className="text-sm">No files shared yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-surface-100 dark:divide-surface-800">
                  {files.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 p-3 hover:bg-surface-50 dark:hover:bg-surface-900 transition-colors">
                      <div className="shrink-0">{getFileIcon(f.file_type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{f.file_name}</p>
                        <p className="text-xs text-surface-500">
                          {f.uploaded_by_name} · {formatFileSize(f.file_size)}
                        </p>
                      </div>
                      <a
                        href={f.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 p-2 rounded-lg text-surface-400 hover:text-primary-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupDetailPage;
