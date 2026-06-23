import { useParams } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import MessageBubble from '../../components/ui/MessageBubble';
import { Send, Users } from 'lucide-react';
import { useState } from 'react';
import Button from '../../components/ui/Button';

const GroupDetailPage = () => {
  const { id } = useParams();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { id: '1', senderName: 'Jane Smith', content: 'Let us meet in ETF Hall at 4 PM for EEE 511 codes.', isMine: false, timestamp: new Date().toISOString() },
  ]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    const newMsg = {
      id: `msg-${Date.now()}`,
      senderName: 'You',
      content: message,
      isMine: true,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    setMessage('');
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col border border-surface-200 dark:border-surface-800 rounded-xl overflow-hidden bg-white dark:bg-surface-950 shadow-card">
      <div className="p-4 border-b border-surface-200 dark:border-surface-800 flex justify-between items-center bg-surface-50 dark:bg-surface-900">
        <div>
          <h3 className="font-semibold text-sm">Embedded Systems Lab Partners</h3>
          <p className="text-xs text-surface-500">Group ID: {id} · study partner room</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
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
          placeholder="Write to group..."
          className="flex-1 px-4 py-2 text-sm bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded-lg focus:outline-none"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button type="submit" leftIcon={<Send className="w-4 h-4" />} />
      </form>
    </div>
  );
};

export default GroupDetailPage;
