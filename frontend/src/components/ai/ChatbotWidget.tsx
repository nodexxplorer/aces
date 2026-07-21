import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, ThumbsUp, ThumbsDown, Bot, User, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendChatMessage, getQuickActions } from '../../api/ai';
import type { ChatResponse, QuickAction } from '../../api/ai';
import { cn } from '../../utils/cn';
import { formatCurrency } from '../../utils/formatters';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  modelUsed?: string;
  interactionId?: string;
}

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [sessionId] = useState(() => crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      getQuickActions().then(setQuickActions).catch(() => {});
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Hello! I'm your **ACES Assistant** 🤖\n\nI can help you with schedules, grades, dues, courses, mentorship, and more.\n\nTry a quick action below or just ask me anything!",
        timestamp: new Date(),
        suggestions: ['Show my schedule', 'Check my grades', 'How to pay dues'],
      }]);
    }
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, messages.length]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const resp = await sendChatMessage(text, sessionId);

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: resp.reply,
        timestamp: new Date(),
        suggestions: resp.suggestions,
        modelUsed: resp.model_used,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again or contact the HOD office for assistance.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-[400px] h-[600px] max-h-[calc(100vh-7rem)] bg-white dark:bg-surface-900 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">ACES Assistant</h3>
                  <p className="text-xs text-white/80">Online · Powered by AI</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex gap-2", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-primary-500" />
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    msg.role === 'user'
                      ? "bg-primary-500 text-white rounded-br-md"
                      : "bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-200 rounded-bl-md"
                  )}>
                    <div className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                    {msg.modelUsed && msg.modelUsed !== 'disabled' && msg.modelUsed !== 'rate_limited' && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-surface-400">
                        <Sparkles className="w-3 h-3" />
                        <span>{msg.modelUsed}</span>
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4 text-surface-500" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary-500" />
                  </div>
                  <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-surface-300 dark:bg-surface-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-surface-300 dark:bg-surface-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-surface-300 dark:bg-surface-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {messages.length > 0 && !isLoading && (
                (() => {
                  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.suggestions?.length);
                  if (!lastAssistant || lastAssistant.id === messages[messages.length - 1]?.id) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5 ml-9">
                      {lastAssistant.suggestions?.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(s)}
                          className="text-xs px-3 py-1.5 rounded-full bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  );
                })()
              )}

              {/* Quick Actions (only show on welcome) */}
              {messages.length <= 1 && quickActions.length > 0 && (
                <div className="grid grid-cols-3 gap-2 ml-0">
                  {quickActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => sendMessage(action.query)}
                      className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 border border-surface-200 dark:border-surface-700 transition-colors"
                    >
                      <span className="text-xl">{action.icon}</span>
                      <span className="text-[11px] font-medium text-surface-600 dark:text-surface-400">{action.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-700">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-sm placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  className="p-2.5 rounded-xl bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-surface-400 mt-1.5 text-center">
                AI responses may be inaccurate. Verify important info.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-4 right-4 sm:right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-colors",
          isOpen
            ? "bg-surface-800 dark:bg-surface-200 text-white dark:text-surface-900"
            : "bg-primary-500 text-white hover:bg-primary-600"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>
    </>
  );
};

function formatMessage(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

export default ChatbotWidget;
