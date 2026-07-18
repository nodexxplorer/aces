import { useState, useEffect, useRef } from 'react';
import Button from '../../components/ui/Button';
import MessageBubble from '../../components/ui/MessageBubble';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { getMyConnections, getConversation, sendMessage } from '../../api/campus-connect';
import { Send, Users, MessageSquare, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { Connection, Message } from '../../types';

interface Contact {
  id: string;
  requester_id: string;
  receiver_id: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  requester_name?: string;
  receiver_name?: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

const normalizeContact = (connection: Connection): Contact => ({
  id: connection.id,
  requester_id: connection.requesterId,
  receiver_id: connection.recipientId,
  full_name: connection.requester?.fullName || connection.recipient?.fullName || connection.requester?.full_name || connection.recipient?.full_name,
  avatar_url: connection.requester?.avatar || connection.recipient?.avatar || connection.requester?.avatarUrl || connection.recipient?.avatarUrl,
  role: connection.requester?.role || connection.recipient?.role,
  requester_name: connection.requester?.fullName || connection.requester?.full_name,
  receiver_name: connection.recipient?.fullName || connection.recipient?.full_name,
});

const normalizeMessage = (message: Message): ChatMessage => ({
  id: message.id,
  sender_id: message.senderId,
  receiver_id: message.recipientId,
  content: message.content,
  is_read: message.isRead,
  created_at: message.createdAt || '',
});

const CampusConnectPage = () => {
  const { user } = useAuth();
  const { error } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialUserId = searchParams.get('userId') || '';

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [activeContactId, setActiveContactId] = useState<string>(initialUserId);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const data = await getMyConnections();
        const normalizedContacts = data.map(normalizeContact);
        setContacts(normalizedContacts);
        if (!activeContactId && normalizedContacts.length > 0) {
          const first: Contact = normalizedContacts[0];
          const otherId = first.requester_id === user?.id ? first.receiver_id : first.requester_id;
          setActiveContactId(otherId);
          setSearchParams({ userId: otherId });
        }
      } catch {
        error('Failed to load', 'Could not fetch contacts.');
      } finally {
        setLoadingContacts(false);
      }
    };
    fetchContacts();
  }, [activeContactId, error, setSearchParams, user?.id]);

  useEffect(() => {
    if (!activeContactId) return;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const data = await getConversation(activeContactId);
        setMessages(data.map(normalizeMessage));
      } catch {
        error('Failed to load', 'Could not fetch messages.');
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchMessages();
  }, [activeContactId, error]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectContact = (contactId: string) => {
    setActiveContactId(contactId);
    setSearchParams({ userId: contactId });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeContactId || sending) return;
    setSending(true);
    try {
      const sent = await sendMessage(activeContactId, messageText.trim());
      setMessages((prev) => [...prev, normalizeMessage(sent)]);
      setMessageText('');
    } catch {
      error('Send Failed', 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const getContactName = (conn: Contact) => {
    if (conn.requester_id === user?.id) return conn.receiver_name || conn.full_name || 'User';
    return conn.requester_name || conn.full_name || 'User';
  };

  const getContactId = (conn: Contact) => {
    if (conn.requester_id === user?.id) return conn.receiver_id;
    return conn.requester_id;
  };

  const activeContact = contacts.find((c) => getContactId(c) === activeContactId);

  return (
    <div className="h-[calc(100vh-8rem)] flex border border-surface-200 dark:border-surface-800 rounded-xl overflow-hidden bg-white dark:bg-surface-900 shadow-card">
      <aside className="w-80 border-r border-surface-200 dark:border-surface-800 flex flex-col bg-surface-50 dark:bg-surface-900">
        <div className="p-4 border-b border-surface-250 dark:border-surface-800">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary-500" />
            Campus Connect Chats
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-surface-150 dark:divide-surface-800">
          {loadingContacts ? (
            <div className="flex items-center justify-center p-8 text-surface-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading...
            </div>
          ) : contacts.length === 0 ? (
            <div className="p-8 text-center text-surface-400 text-sm">
              No connections yet.
            </div>
          ) : (
            contacts.map((conn) => {
              const cid = getContactId(conn);
              return (
                <div
                  key={conn.id}
                  onClick={() => handleSelectContact(cid)}
                  className={`p-4 cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors ${
                    activeContactId === cid ? 'bg-primary-500/5 dark:bg-primary-500/10 border-l-4 border-primary-500' : ''
                  }`}
                >
                  <h4 className="font-semibold text-sm">{getContactName(conn)}</h4>
                  <p className="text-xs text-surface-500 truncate mt-1">{conn.role || 'Member'}</p>
                </div>
              );
            })
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-white dark:bg-surface-950">
        {activeContactId ? (
          <>
            <div className="p-4 border-b border-surface-200 dark:border-surface-800 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-sm">
                  {activeContact ? getContactName(activeContact) : 'Chat'}
                </h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full text-surface-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-surface-400 text-sm">
                  No messages yet. Say hello!
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    content={msg.content}
                    senderName={msg.sender_id === user?.id ? 'You' : (activeContact ? getContactName(activeContact) : 'User')}
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
                placeholder="Write message..."
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
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-surface-400">
            <Users className="w-12 h-12 mb-2" />
            <p className="text-sm">Select a contact to begin messaging.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default CampusConnectPage;
