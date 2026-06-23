import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import MessageBubble from '../../components/ui/MessageBubble';
import { Send, Users, MessageSquare, ArrowLeft } from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';

interface Contact {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  lastMessage?: string;
  score: number;
}

const mockContacts: Contact[] = [
  { id: '1', name: 'Dr. Jane Smith', role: 'lecturer', lastMessage: 'Let me check your dev board tomorrow.', score: 95 },
  { id: '2', name: 'Jane Smith', role: 'student', lastMessage: 'Are we study partnering for EEE 511?', score: 85 },
];

const CampusConnectPage = () => {
  const { success } = useNotification();
  const [contacts] = useState<Contact[]>(mockContacts);
  const [activeContact, setActiveContact] = useState<Contact | null>(mockContacts[0] || null);
  const [message, setMessage] = useState('');
  const [chatLogs, setChatLogs] = useState([
    { id: '1', senderName: 'Dr. Jane Smith', content: 'Let me check your dev board tomorrow.', isMine: false, timestamp: new Date().toISOString() },
  ]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeContact) return;
    const newMsg = {
      id: `msg-${Date.now()}`,
      senderName: 'You',
      content: message,
      isMine: true,
      timestamp: new Date().toISOString(),
    };
    setChatLogs((prev) => [...prev, newMsg]);
    setMessage('');

    // Simulate reply
    setTimeout(() => {
      setChatLogs((prev) => [
        ...prev,
        {
          id: `msg-reply-${Date.now()}`,
          senderName: activeContact.name,
          content: 'Got it, let us check tomorrow.',
          isMine: false,
          timestamp: new Date().toISOString(),
        },
      ]);
    }, 1200);
  };

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
          {contacts.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveContact(c)}
              className={`p-4 cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors ${activeContact?.id === c.id ? 'bg-primary-500/5 dark:bg-primary-500/10 border-l-4 border-primary-500' : ''}`}
            >
              <h4 className="font-semibold text-sm">{c.name}</h4>
              <p className="text-xs text-surface-500 truncate mt-1">{c.lastMessage}</p>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-white dark:bg-surface-950">
        {activeContact ? (
          <>
            <div className="p-4 border-b border-surface-200 dark:border-surface-800 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-sm">{activeContact.name}</h3>
                <p className="text-xs text-surface-500">{activeContact.role}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatLogs.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  content={msg.content}
                  senderName={msg.senderName}
                  timestamp={msg.timestamp}
                  isMine={msg.isMine}
                />
              ))}
            </div>
            <form onSubmit={handleSend} className="p-4 border-t border-surface-200 dark:border-surface-800 flex gap-2">
              <input
                type="text"
                placeholder="Write message..."
                className="flex-1 px-4 py-2 text-sm bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button type="submit" leftIcon={<Send className="w-4 h-4" />} />
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
