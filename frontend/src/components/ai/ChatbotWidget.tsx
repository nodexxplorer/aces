import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Minus, Send, HelpCircle, Sun, Moon, Monitor, ChevronRight, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { sendChatMessage } from '../../api/ai';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useAuth } from '../../hooks/useAuth';
import { tenantPath } from '../../config/departmentAdminPaths';
import { getStudentDashboard, type StudentDashboard } from '../../api/dashboard';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  action?: {
    label: string;
    url: string;
  };
}

const DEFAULT_SUGGESTIONS = ['How do I register courses?', 'Why is signing locked?', 'Check my dues'];

const ChatbotWidget = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [dashboardData, setDashboardData] = useState<StudentDashboard | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { user } = useAuth();
  const urlCode = user?.tenant?.urlCode;
  const { mode, setMode } = useDarkMode();
  const navigate = useNavigate();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const studentName = user?.firstName || 'Student';

  const formatTime = (d: Date) => {
    if (!d) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(new Date(d));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Load real student dashboard data to accurately answer dues and signing queries
  useEffect(() => {
    getStudentDashboard()
      .then(setDashboardData)
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    const handleOpen = () => {
      setIsChatOpen(true);
      setIsMenuOpen(false);
    };
    window.addEventListener('open-chatbot', handleOpen);
    return () => window.removeEventListener('open-chatbot', handleOpen);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize welcome message when chat opens
  useEffect(() => {
    if (isChatOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Hi ${studentName}! I can help you with courses, dues, the course form and more. What do you need?`,
          timestamp: new Date(),
        },
      ]);
    }
    if (isChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isChatOpen, messages.length, studentName]);

  // Click outside to close quick menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleFabClick = () => {
    if (isChatOpen) {
      setIsChatOpen(false);
    } else if (isMenuOpen) {
      setIsMenuOpen(false);
    } else {
      setIsMenuOpen(true);
    }
  };

  const handleSendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const lower = trimmed.toLowerCase();

    // Check for intelligent real-time responses based on actual user status
    if (lower.includes('signing locked') || lower.includes('sign form') || lower.includes('course form signing')) {
      const isCleared = (dashboardData?.payments?.dues_outstanding ?? 0) === 0;
      setTimeout(() => {
        if (isCleared) {
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content:
                'Course form signing opens once your dues are cleared. Your dues show **Cleared**, so you can upload your form now.',
              timestamp: new Date(),
              action: {
                label: 'Go to course form signing',
                url: '/i/course-form-signing',
              },
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content:
                'Course form signing is currently locked because you have outstanding departmental dues. Once your dues are cleared, you will be able to sign your course form.',
              timestamp: new Date(),
              action: {
                label: 'Pay dues now',
                url: '/i/payments',
              },
            },
          ]);
        }
        setIsLoading(false);
      }, 400);
      return;
    }

    if (lower.includes('register course') || lower.includes('course registration')) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content:
              'Course registration is active for your session. You can select your compulsory and elective courses and verify your credit units summary before submitting.',
            timestamp: new Date(),
            action: {
              label: 'Go to course registration',
              url: '/i/courses',
            },
          },
        ]);
        setIsLoading(false);
      }, 400);
      return;
    }

    if (lower.includes('check my dues') || lower.includes('dues') || lower.includes('payment')) {
      const outstanding = dashboardData?.payments?.dues_outstanding ?? 0;
      setTimeout(() => {
        if (outstanding === 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: 'Your dues for the academic session are completely **Cleared** with ₦0 outstanding.',
              timestamp: new Date(),
              action: {
                label: 'View payments & dues',
                url: '/i/payments',
              },
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: `You currently have ₦${outstanding.toLocaleString()} in outstanding departmental dues.`,
              timestamp: new Date(),
              action: {
                label: 'Pay dues now',
                url: '/i/payments',
              },
            },
          ]);
        }
        setIsLoading(false);
      }, 400);
      return;
    }

    // Call backend assistant API
    try {
      const resp = await sendChatMessage(trimmed, sessionId);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: resp.reply,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content:
            "I'm here to help with courses, dues, signing and department questions. If you need urgent administrative help, please file a ticket under Support.",
          timestamp: new Date(),
          action: {
            label: 'File a ticket',
            url: '/i/complaints',
          },
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
    }
  };

  return (
    <div ref={menuRef}>
      {/* ────────────────── QUICK MENU POPOVER ────────────────── */}
      <AnimatePresence>
        {isMenuOpen && !isChatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed bottom-20 right-6 z-50 w-[310px] sm:w-[330px] bg-white dark:bg-[#181a20] border border-slate-200/90 dark:border-[#22252b] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 pt-3.5 pb-1 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              QUICK MENU
            </div>

            {/* Item 1: Portal Assistant */}
            <button
              onClick={() => {
                setIsChatOpen(true);
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#1e222a] transition-colors border-b border-slate-100 dark:border-slate-800/60 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1d68ec] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Portal assistant</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Ask anything about the portal</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Item 2: Support */}
            <button
              onClick={() => {
                navigate(tenantPath(urlCode, '/i/complaints'));
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#1e222a] transition-colors border-b border-slate-100 dark:border-slate-800/60 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Support</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">File a ticket or get help</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Item 3: Theme */}
            <div className="p-3.5">
              <div className="flex items-center justify-between text-xs font-bold mb-2.5">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Sun className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  <span>Theme</span>
                </div>
                <span className="text-slate-500 dark:text-slate-400 font-normal capitalize">
                  {mode === 'system' ? 'Auto' : mode}
                </span>
              </div>

              {/* 3-Segmented Pill */}
              <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center border border-slate-200/60 dark:border-slate-700/60 gap-1">
                <button
                  type="button"
                  onClick={() => setMode('light')}
                  className={`flex-1 py-1 px-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all ${
                    mode === 'light'
                      ? 'bg-[#1d68ec] text-white font-semibold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('dark')}
                  className={`flex-1 py-1 px-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all ${
                    mode === 'dark'
                      ? 'bg-[#1d68ec] text-white font-semibold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('system')}
                  className={`flex-1 py-1 px-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all ${
                    mode === 'system'
                      ? 'bg-[#1d68ec] text-white font-semibold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Auto</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ────────────────── PORTAL ASSISTANT CHAT WIDGET ────────────────── */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-20 right-6 z-50 w-[350px] sm:w-[380px] h-[520px] max-h-[calc(100vh-6.5rem)] bg-white dark:bg-[#181a20] border border-slate-200/90 dark:border-[#22252b] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Top Blue Header */}
            <div className="bg-[#1d68ec] text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-white shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white leading-tight">Portal assistant</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    <span className="text-[10px] text-white/90">Online</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setIsChatOpen(false);
                    setIsMenuOpen(true);
                  }}
                  className="p-1 hover:bg-white/15 rounded-lg text-white/90 hover:text-white transition-colors"
                  aria-label="Minimize"
                  title="Minimize"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-1 hover:bg-white/15 rounded-lg text-white/90 hover:text-white transition-colors"
                  aria-label="Close"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-[#1d68ec] text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`rounded-2xl p-3 text-xs leading-relaxed max-w-[270px] ${
                      msg.role === 'user'
                        ? 'bg-[#1d68ec] text-white rounded-tr-sm shadow-sm'
                        : 'bg-slate-100 dark:bg-[#20232b] text-slate-800 dark:text-slate-200 rounded-tl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content.replace(/\*\*(.*?)\*\*/g, '$1')}</p>

                    {/* Action button if response has direct portal link */}
                    {msg.action && (
                      <div className="mt-2.5">
                        <button
                          onClick={() => {
                            setIsChatOpen(false);
                            navigate(tenantPath(urlCode, msg.action!.url));
                          }}
                          className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-[#1d68ec] hover:bg-[#1656c4] text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
                        >
                          {msg.action.label}
                        </button>
                      </div>
                    )}

                    {/* Timestamp & Copy footer */}
                    {msg.role === 'assistant' ? (
                      <div className="mt-2 pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                        <span>{formatTime(msg.timestamp)}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content.replace(/\*\*(.*?)\*\*/g, '$1'))}
                          className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors py-0.5 px-1 rounded"
                          title="Copy response"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500 font-semibold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex justify-end text-[10px] text-white/75">
                        <span>{formatTime(msg.timestamp)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Suggestions chips right after welcome message */}
              {messages.length === 1 && (
                <div className="flex flex-wrap gap-2 ml-8 mt-1">
                  {DEFAULT_SUGGESTIONS.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(suggestion)}
                      className="border border-[#1d68ec] text-[#1d68ec] dark:text-[#4b8efc] hover:bg-[#1d68ec]/10 text-xs px-3 py-1.5 rounded-full font-medium transition-colors text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {/* Loading bubble */}
              {isLoading && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-6 h-6 rounded-full bg-[#1d68ec] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-slate-100 dark:bg-[#20232b] rounded-2xl rounded-tl-sm px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Input */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-white dark:bg-[#181a20] flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                disabled={isLoading}
                className="flex-1 px-3.5 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#1d68ec] focus:rounded-2xl transition-colors"
              />
              <button
                onClick={() => handleSendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="w-8 h-8 rounded-full bg-[#1d68ec] text-white flex items-center justify-center hover:bg-[#1656c4] disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-colors shadow-sm"
                aria-label="Send message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ────────────────── FLOATING ACTION BUTTON (FAB) ────────────────── */}
      <button
        onClick={handleFabClick}
        className="fixed bottom-5 right-6 z-50 w-12 h-12 rounded-full bg-[#1d68ec] text-white hover:bg-[#1656c4] shadow-xl flex items-center justify-center transition-all duration-200 active:scale-95"
        aria-label="Portal assistant & quick menu"
      >
        {isMenuOpen || isChatOpen ? <X className="w-5 h-5 stroke-[2.5]" /> : <Sparkles className="w-5 h-5" />}
      </button>
    </div>
  );
};

export default ChatbotWidget;
