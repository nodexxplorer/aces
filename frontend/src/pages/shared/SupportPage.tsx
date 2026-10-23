import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  MessageSquare,
  Search,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Plus,
  Star,
  Send,
  FileText,
  Mail,
  Phone,
  CreditCard,
  User as UserIcon,
  LifeBuoy,
  Sparkles,
  Award,
  AlertTriangle,
  Lightbulb,
  Copy,
  Check,
  X,
  Calendar,
  Shield,
  Loader2,
  Paperclip,
  Bell,
  Heart,
  Inbox,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  listHelpArticles,
  getHelpArticle,
  markHelpArticleHelpful,
  searchHelpArticles,
  type HelpArticle,
  createFeedback,
  listMyFeedback,
  type Feedback,
} from '../../api/additional-features';
import EmptyState from '../../components/ui/EmptyState';

// Map category names to icons
function getCategoryIcon(cat: string) {
  const c = cat.toLowerCase();
  if (c.includes('result')) return Award;
  if (c.includes('course') || c.includes('registration')) return BookOpen;
  if (c.includes('payment') || c.includes('due') || c.includes('finance')) return CreditCard;
  if (c.includes('profile') || c.includes('account') || c.includes('user')) return UserIcon;
  if (c.includes('study') || c.includes('planner')) return Calendar;
  if (c.includes('troubleshoot') || c.includes('error') || c.includes('issue')) return AlertTriangle;
  if (c.includes('security') || c.includes('access') || c.includes('started')) return Shield;
  return FileText;
}

// Format highlighted text for search results
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-yellow-300 dark:bg-yellow-500/40 text-surface-900 dark:text-surface-50 px-0.5 rounded font-bold"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

// Format article body with step badges, warnings, tips
function ArticleContentRenderer({ content }: { content: string }) {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Parse structured sections
  const introLines: string[] = [];
  const steps: { title: string; detail?: string }[] = [];
  const warnings: string[] = [];
  const tips: string[] = [];

  let isParsingSteps = false;

  for (const line of lines) {
    if (line.toLowerCase().startsWith('important:') || line.toLowerCase().startsWith('warning:')) {
      warnings.push(line.replace(/^(important:|warning:)\s*/i, ''));
    } else if (line.toLowerCase().startsWith('tip:') || line.toLowerCase().startsWith('still failing')) {
      tips.push(line);
    } else if (/^\d+[.)]\s*/.test(line)) {
      isParsingSteps = true;
      const stripped = line.replace(/^\d+[.)]\s*/, '');
      const [title, ...rest] = stripped.split('.');
      steps.push({
        title: title.trim(),
        detail: rest.join('.').trim() || undefined,
      });
    } else if (isParsingSteps) {
      // Follow-up line for the previous step or new step
      steps.push({ title: line });
    } else {
      introLines.push(line);
    }
  }

  // If no numbered steps found, check if lines look like sequential instructions
  if (steps.length === 0 && lines.length > 2) {
    // First line is intro, remaining are steps
    introLines.length = 0;
    introLines.push(lines[0]);
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().startsWith('important:') || line.toLowerCase().startsWith('warning:')) {
        warnings.push(line.replace(/^(important:|warning:)\s*/i, ''));
      } else if (line.toLowerCase().startsWith('tip:') || line.toLowerCase().startsWith('still failing')) {
        tips.push(line);
      } else {
        const [title, ...rest] = line.split('.');
        steps.push({
          title: title.trim(),
          detail: rest.join('.').trim() || undefined,
        });
      }
    }
  }

  return (
    <div className="space-y-6">
      {introLines.length > 0 && (
        <div className="text-surface-700 dark:text-surface-300 text-sm leading-relaxed">
          {introLines.map((intro, idx) => (
            <p key={idx} className="mb-2">
              {intro}
            </p>
          ))}
        </div>
      )}

      {steps.length > 0 && (
        <div className="space-y-4 pt-2 border-t border-surface-100 dark:border-surface-800">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-3.5">
              <span className="w-6 h-6 rounded-full bg-primary-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">{step.title}</p>
                {step.detail && (
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 leading-relaxed">{step.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-yellow-400/90 bg-amber-50/70 dark:bg-transparent p-4 flex items-start gap-3 text-amber-900 dark:text-surface-100">
          <div className="p-1 rounded-lg bg-amber-400 text-slate-950 shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4 fill-slate-950 text-amber-400" />
          </div>
          <div className="text-xs leading-relaxed">
            <span className="font-bold text-amber-950 dark:text-white">Important: </span>
            {warnings.join(' ')}
          </div>
        </div>
      )}

      {tips.length > 0 && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 p-3.5 flex items-start gap-3 text-blue-900 dark:text-blue-200">
          <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{tips.join(' ')}</p>
        </div>
      )}
    </div>
  );
}

// Right sidebar: "Still need help?" card
function StillNeedHelpCard({ onFileTicket, onAskAssistant }: { onFileTicket: () => void; onAskAssistant: () => void }) {
  const [copiedType, setCopiedType] = useState<'email' | 'phone' | null>(null);

  const handleCopy = (text: string, type: 'email' | 'phone') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-5 sm:p-6 shadow-sm space-y-4">
      <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-sm">
        <LifeBuoy className="w-5 h-5" />
      </div>

      <div>
        <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">Still need help?</h3>
        <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
          Our support team is here to help with any issue.
        </p>
      </div>

      <div className="space-y-2.5 pt-1">
        {/* Email Support */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/70 dark:bg-surface-950/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Email support</p>
              <p className="text-xs font-semibold text-surface-900 dark:text-surface-100 truncate">
                support@aceszone.edu.ng
              </p>
            </div>
          </div>
          <button
            onClick={() => handleCopy('support@aceszone.edu.ng', 'email')}
            title="Copy email address"
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-200/50 dark:hover:bg-surface-800 transition-colors"
          >
            {copiedType === 'email' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Phone Support */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/70 dark:bg-surface-950/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Phone support</p>
              <p className="text-xs font-semibold text-surface-900 dark:text-surface-100 truncate">
                +234 800 2237 4357
              </p>
            </div>
          </div>
          <button
            onClick={() => handleCopy('+234 800 2237 4357', 'phone')}
            title="Copy phone number"
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-200/50 dark:hover:bg-surface-800 transition-colors"
          >
            {copiedType === 'phone' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2.5 pt-2">
        <button
          onClick={onFileTicket}
          className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <HelpCircle className="w-4 h-4" /> File a ticket
        </button>

        <button
          onClick={onAskAssistant}
          className="w-full py-2.5 px-4 bg-white dark:bg-transparent hover:bg-primary-50 dark:hover:bg-surface-800/50 text-primary-600 dark:text-blue-400 border border-primary-200 dark:border-surface-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all"
        >
          <Sparkles className="w-4 h-4" /> Ask the assistant
        </button>
      </div>
    </div>
  );
}

function HelpCenterTab() {
  const navigate = useNavigate();

  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [helpfulFeedbackGiven, setHelpfulFeedbackGiven] = useState<Record<string, 'yes' | 'no'>>({});

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const data = await listHelpArticles();
      setArticles(data || []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    const q = query.trim();
    if (!q) {
      fetchArticles();
      return;
    }
    setSearching(true);
    try {
      const res = await searchHelpArticles(q);
      setArticles(res || []);
    } catch {
      /* silent */
    } finally {
      setSearching(false);
    }
  };

  const handleHelpfulVote = async (articleId: string, vote: 'yes' | 'no') => {
    setHelpfulFeedbackGiven((prev) => ({ ...prev, [articleId]: vote }));
    if (vote === 'yes') {
      try {
        await markHelpArticleHelpful(articleId);
        setArticles((prev) =>
          prev.map((a) => (a.id === articleId ? { ...a, helpful_count: (a.helpful_count || 0) + 1 } : a)),
        );
        if (selectedArticle?.id === articleId) {
          setSelectedArticle((prev) => (prev ? { ...prev, helpful_count: (prev.helpful_count || 0) + 1 } : prev));
        }
      } catch {
        /* silent */
      }
    }
  };

  const openArticleDetail = async (article: HelpArticle) => {
    setSelectedArticle(article);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const full = await getHelpArticle(article.id);
      setSelectedArticle(full);
    } catch {
      /* silent */
    }
  };

  const toggleAccordion = async (article: HelpArticle, e: React.MouseEvent) => {
    e.stopPropagation();
    if (expandedId === article.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(article.id);
    try {
      const full = await getHelpArticle(article.id);
      setArticles((prev) => prev.map((a) => (a.id === article.id ? full : a)));
    } catch {
      /* silent */
    }
  };

  const categories = useMemo(() => {
    return Array.from(new Set(articles.map((a) => a.category))).filter(Boolean);
  }, [articles]);

  const totalViews = useMemo(() => {
    return articles.reduce((sum, a) => sum + (a.view_count || 0), 0);
  }, [articles]);

  const totalHelpful = useMemo(() => {
    return articles.reduce((sum, a) => sum + (a.helpful_count || 0), 0);
  }, [articles]);

  const filteredArticles = useMemo(() => {
    if (activeCategory === 'all') return articles;
    return articles.filter((a) => a.category.toLowerCase() === activeCategory.toLowerCase());
  }, [articles, activeCategory]);

  const popularPills = [
    { label: 'Pay dues', query: 'payment' },
    { label: 'Course registration', query: 'course registration' },
    { label: 'Sign course form', query: 'course form' },
    { label: 'Results', query: 'result' },
  ];

  const handleFileTicket = () => {
    navigate('/complaints?new=true');
  };

  const handleAskAssistant = () => {
    window.dispatchEvent(new CustomEvent('open-chatbot'));
  };

  // If viewing a single article detail (Screenshot 1)
  if (selectedArticle) {
    const relatedArticles = articles
      .filter((a) => a.category === selectedArticle.category && a.id !== selectedArticle.id)
      .slice(0, 5);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Article Detail */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-6 sm:p-8 shadow-sm">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400 mb-4">
              <button
                onClick={() => setSelectedArticle(null)}
                className="hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors"
              >
                Support
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-surface-400" />
              <button
                onClick={() => {
                  setActiveCategory(selectedArticle.category);
                  setSelectedArticle(null);
                }}
                className="hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors"
              >
                {selectedArticle.category}
              </button>
            </div>

            {/* Category badge */}
            <div className="mb-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {selectedArticle.category}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-surface-50 tracking-tight leading-snug">
              {selectedArticle.title}
            </h1>

            {/* Metadata */}
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-2">
              {selectedArticle.view_count ?? 0} views · {selectedArticle.helpful_count ?? 0} found helpful
            </p>

            {/* Body */}
            <div className="mt-6">
              <ArticleContentRenderer content={selectedArticle.content} />
            </div>

            {/* Was this helpful card */}
            <div className="mt-8 pt-5 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between flex-wrap gap-4">
              <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">Was this helpful?</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleHelpfulVote(selectedArticle.id, 'yes')}
                  className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    helpfulFeedbackGiven[selectedArticle.id] === 'yes'
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                      : 'border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" /> Yes
                </button>
                <button
                  onClick={() => handleHelpfulVote(selectedArticle.id, 'no')}
                  className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    helpfulFeedbackGiven[selectedArticle.id] === 'no'
                      ? 'bg-surface-700 text-white border-surface-700 shadow-sm'
                      : 'border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:border-surface-400'
                  }`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" /> No
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Still need help + Related articles */}
        <div className="lg:col-span-4 space-y-6">
          <StillNeedHelpCard onFileTicket={handleFileTicket} onAskAssistant={handleAskAssistant} />

          {relatedArticles.length > 0 && (
            <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-bold text-surface-900 dark:text-surface-100 mb-3">Related articles</h3>
              <div className="divide-y divide-surface-100 dark:divide-surface-800">
                {relatedArticles.map((rel) => (
                  <button
                    key={rel.id}
                    onClick={() => openArticleDetail(rel)}
                    className="w-full text-left py-3 flex items-center justify-between gap-3 text-surface-700 dark:text-surface-300 hover:text-primary-600 dark:hover:text-primary-400 group transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-surface-400 group-hover:text-primary-500 shrink-0" />
                      <span className="text-xs font-medium truncate">{rel.title}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-surface-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Blue Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#175cd3] to-[#154fc0] dark:from-[#3b82f6] dark:to-[#2563eb] p-6 sm:p-8 text-white shadow-md">
        {/* Decorative background geometric curves */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none opacity-20 overflow-hidden">
          <svg viewBox="0 0 400 300" className="w-full h-full object-cover">
            <circle cx="350" cy="80" r="140" fill="none" stroke="white" strokeWidth="1.5" />
            <circle cx="350" cy="80" r="220" fill="none" stroke="white" strokeWidth="1.5" />
            <circle cx="350" cy="80" r="300" fill="none" stroke="white" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Hero Content */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center gap-2 text-white/90 text-xs font-bold uppercase tracking-wider">
              <LifeBuoy className="w-4 h-4 text-white" />
              <span>HELP CENTER</span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                How can we help you?
              </h2>
              <p className="text-white/80 text-xs sm:text-sm mt-1">Search the knowledge base or browse by topic.</p>
            </div>

            {/* Search Input Bar */}
            <div className="relative max-w-xl pt-2">
              <div className="relative flex items-center">
                <Search className="absolute left-4 w-5 h-5 text-surface-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search help articles"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch(searchQuery);
                  }}
                  className="w-full pl-11 pr-14 py-3 rounded-full bg-white dark:bg-[#131825] text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-400 text-sm focus:outline-none focus:ring-4 focus:ring-white/30 dark:focus:ring-blue-400/30 shadow-lg transition-all"
                />
                {searchQuery ? (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      fetchArticles();
                    }}
                    className="absolute right-4 p-1 rounded-full text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="absolute right-4 pointer-events-none px-2 py-0.5 rounded border border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 text-surface-400 text-[11px] font-mono">
                    /
                  </span>
                )}
              </div>
            </div>

            {/* Popular Topics Pills */}
            <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
              <span className="text-white/80 font-medium">Popular:</span>
              {popularPills.map((pill) => (
                <button
                  key={pill.label}
                  onClick={() => {
                    setSearchQuery(pill.query);
                    handleSearch(pill.query);
                  }}
                  className="rounded-full border border-white/25 bg-white/10 hover:bg-white/20 text-white text-xs px-3.5 py-1 transition-all backdrop-blur-sm"
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Hero Stats 2x2 Grid */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 p-4 flex flex-col justify-center">
              <span className="text-2xl sm:text-3xl font-extrabold text-white leading-none">{articles.length}</span>
              <span className="text-xs text-white/70 mt-1 font-medium">Articles</span>
            </div>

            <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 p-4 flex flex-col justify-center">
              <span className="text-2xl sm:text-3xl font-extrabold text-white leading-none">{categories.length}</span>
              <span className="text-xs text-white/70 mt-1 font-medium">Categories</span>
            </div>

            <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 p-4 flex flex-col justify-center">
              <span className="text-2xl sm:text-3xl font-extrabold text-white leading-none">{totalViews}</span>
              <span className="text-xs text-white/70 mt-1 font-medium">Total views</span>
            </div>

            <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 p-4 flex flex-col justify-center">
              <span className="text-2xl sm:text-3xl font-extrabold text-white leading-none">{totalHelpful}</span>
              <span className="text-xs text-white/70 mt-1 font-medium">Found helpful</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {searchQuery.trim() ? (
        /* Search Results View (Screenshot 4) or No Results View (Screenshot 3) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            {searching ? (
              <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600 mx-auto" />
                <p className="text-sm text-surface-500 mt-2">Searching articles...</p>
              </div>
            ) : articles.length === 0 ? (
              /* No Results State (Screenshot 3) */
              <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-8 sm:p-12 text-center shadow-sm space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                  <Search className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100">
                    No results for &ldquo;{searchQuery}&rdquo;
                  </h3>
                  <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 mt-1 max-w-md mx-auto">
                    Try a shorter word, check the spelling, or browse a topic below.
                  </p>
                </div>

                {/* Suggested topic pills */}
                <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
                  {categories.slice(0, 6).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSearchQuery('');
                        setActiveCategory(cat);
                        fetchArticles();
                      }}
                      className="px-3.5 py-1.5 rounded-full border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-xs font-medium text-surface-700 dark:text-surface-300 hover:border-primary-400 transition-colors"
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Quick actions */}
                <div className="flex items-center justify-center gap-3 pt-4">
                  <button
                    onClick={handleFileTicket}
                    className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
                  >
                    <HelpCircle className="w-4 h-4" /> File a ticket
                  </button>
                  <button
                    onClick={handleAskAssistant}
                    className="px-5 py-2.5 bg-white dark:bg-surface-900 hover:bg-primary-50 dark:hover:bg-primary-950/30 text-primary-600 dark:text-primary-400 border border-surface-200 dark:border-surface-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
                  >
                    <Sparkles className="w-4 h-4" /> Ask the assistant
                  </button>
                </div>
              </div>
            ) : (
              /* Search Results List (Screenshot 4) */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100">
                      {articles.length} result{articles.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
                    </h3>
                    <p className="text-xs text-surface-400">Best matches first</p>
                  </div>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      fetchArticles();
                    }}
                    className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Clear search
                  </button>
                </div>

                <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 divide-y divide-surface-100 dark:divide-surface-800 overflow-hidden shadow-sm">
                  {articles.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => openArticleDetail(art)}
                      className="p-4 sm:p-5 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors cursor-pointer group flex items-start gap-3.5"
                    >
                      <ChevronRight className="w-4 h-4 text-surface-400 group-hover:text-primary-600 shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {art.category}
                          </span>
                          <span className="text-[11px] text-surface-400">
                            {art.view_count || 0} views · {art.helpful_count || 0} helpful
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-surface-900 dark:text-surface-100 group-hover:text-primary-600 transition-colors">
                          <HighlightMatch text={art.title} query={searchQuery} />
                        </h4>
                        <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">
                          {art.content.split('\n')[0]}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Did not find what you need banner */}
                <div className="bg-blue-50/70 dark:bg-transparent border border-blue-200 dark:border-blue-500/70 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-surface-800 text-primary-600 dark:text-primary-400 flex items-center justify-center shadow-sm shrink-0">
                      <Lightbulb className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-surface-900 dark:text-surface-100">
                        Did not find what you need?
                      </p>
                      <p className="text-[11px] text-surface-500 dark:text-surface-400">
                        File a ticket and the department will reply.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleFileTicket}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all shrink-0"
                  >
                    File a ticket
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4">
            <StillNeedHelpCard onFileTicket={handleFileTicket} onAskAssistant={handleAskAssistant} />
          </div>
        </div>
      ) : (
        /* Standard Overview View (Screenshot 2) */
        <div className="space-y-8">
          {/* Browse by topic */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100">Browse by topic</h3>
              <button
                onClick={() => {
                  setActiveCategory('all');
                  const el = document.getElementById('all-articles-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
              >
                View all articles
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {categories.map((cat) => {
                const Icon = getCategoryIcon(cat);
                const count = articles.filter((a) => a.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                      const el = document.getElementById('all-articles-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between gap-3 group ${
                      activeCategory === cat
                        ? 'bg-primary-50/50 dark:bg-primary-950/20 border-primary-500 shadow-sm'
                        : 'bg-white dark:bg-surface-900 border-surface-200/90 dark:border-surface-800 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                          {cat}
                        </p>
                        <p className="text-[11px] text-surface-400 mt-0.5">
                          {count} {count === 1 ? 'article' : 'articles'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-surface-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </button>
                );
              })}

              {/* Quick answers card */}
              <button
                onClick={() => {
                  setActiveCategory('all');
                  const el = document.getElementById('all-articles-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="p-4 rounded-2xl border bg-white dark:bg-surface-900 border-surface-200/90 dark:border-surface-800 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all text-left flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-primary-600 text-white shrink-0">
                    <Lightbulb className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                      Quick answers
                    </p>
                    <p className="text-[11px] text-surface-400 mt-0.5">Most-read help</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-surface-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            </div>
          </div>

          {/* Lower Two-Column Section: All articles & Still need help */}
          <div id="all-articles-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: All Articles list */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100">All articles</h3>
                  <p className="text-xs text-surface-400">
                    {filteredArticles.length} {filteredArticles.length === 1 ? 'article' : 'articles'}
                  </p>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setActiveCategory('all')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      activeCategory === 'all'
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-800 hover:bg-surface-50'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        activeCategory === cat
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-800 hover:bg-surface-50'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600 mx-auto" />
                  <p className="text-sm text-surface-500 mt-2">Loading help articles...</p>
                </div>
              ) : filteredArticles.length === 0 ? (
                <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-8">
                  <EmptyState
                    title="No articles in this category"
                    description="Select a different topic or clear your filter."
                  />
                </div>
              ) : (
                <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 divide-y divide-surface-100 dark:divide-surface-800 overflow-hidden shadow-sm">
                  {filteredArticles.map((art) => {
                    const isExpanded = expandedId === art.id;
                    return (
                      <div key={art.id} className="transition-colors">
                        {/* Article Header row */}
                        <div
                          onClick={() => openArticleDetail(art)}
                          className="p-4 sm:p-5 flex items-start gap-3.5 hover:bg-surface-50/70 dark:hover:bg-surface-800/40 cursor-pointer transition-colors group"
                        >
                          <button
                            onClick={(e) => toggleAccordion(art, e)}
                            title={isExpanded ? 'Collapse' : 'Expand preview'}
                            className="p-1 rounded-md text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 mt-0.5 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-primary-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-surface-400 group-hover:text-primary-600 transition-colors" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                {art.category}
                              </span>
                              <span className="text-[11px] text-surface-400">
                                {art.view_count || 0} views · {art.helpful_count || 0} helpful
                              </span>
                            </div>

                            <h4 className="text-sm font-bold text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                              {art.title}
                            </h4>

                            {!isExpanded && (
                              <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 line-clamp-1">
                                {art.content.split('\n')[0]}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Accordion Expanded Preview (Screenshot 2 Item 5) */}
                        {isExpanded && (
                          <div className="px-5 sm:px-6 pb-5 pt-1 bg-surface-50/40 dark:bg-surface-950/30 border-t border-surface-100 dark:border-surface-800">
                            <div className="pl-7">
                              <ArticleContentRenderer content={art.content} />

                              <div className="mt-5 pt-4 border-t border-surface-200/60 dark:border-surface-800 flex items-center justify-between flex-wrap gap-3">
                                <span className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                                  Was this helpful?
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleHelpfulVote(art.id, 'yes')}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                      helpfulFeedbackGiven[art.id] === 'yes'
                                        ? 'bg-primary-600 text-white border-primary-600'
                                        : 'border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:border-primary-500 hover:text-primary-600'
                                    }`}
                                  >
                                    <ThumbsUp className="w-3.5 h-3.5" /> Yes
                                  </button>
                                  <button
                                    onClick={() => handleHelpfulVote(art.id, 'no')}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                      helpfulFeedbackGiven[art.id] === 'no'
                                        ? 'bg-surface-700 text-white border-surface-700'
                                        : 'border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:border-surface-400'
                                    }`}
                                  >
                                    <ThumbsDown className="w-3.5 h-3.5" /> No
                                  </button>
                                  <button
                                    onClick={() => openArticleDetail(art)}
                                    className="ml-2 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
                                  >
                                    Full article <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Still Need Help */}
            <div className="lg:col-span-4">
              <StillNeedHelpCard onFileTicket={handleFileTicket} onAskAssistant={handleAskAssistant} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FeedbackTabProps {
  onBrowseHelpCenter: () => void;
}

interface SubmittedConfirmation {
  reference: string;
  type: string;
  area: string;
  experienceLabel: string;
  experienceEmoji: string;
}

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'recently';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) return past.toLocaleDateString();
  if (diffDays >= 7) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMin > 0) return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
  return 'just now';
}

function MyFeedbackTab({ onBrowseHelpCenter }: FeedbackTabProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'idea' | 'problem' | 'praise'>('all');
  const [submittedConfirmation, setSubmittedConfirmation] = useState<SubmittedConfirmation | null>(null);

  // Form states matching Screenshots 1 & 3
  const [feedbackType, setFeedbackType] = useState<'idea' | 'problem' | 'praise' | 'other'>('idea');
  const [portalPart, setPortalPart] = useState('Course registration');
  const [experience, setExperience] = useState<'poor' | 'fair' | 'okay' | 'good' | 'great'>('good');
  const [description, setDescription] = useState(
    'It would help to see my total units while I pick courses, so I do not go over the limit.',
  );
  const [notifyReplies, setNotifyReplies] = useState(true);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const data = await listMyFeedback();
      setFeedbacks(Array.isArray(data) ? data : []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();

    const handleExternalOpenForm = () => {
      setSubmittedConfirmation(null);
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('open-feedback-form', handleExternalOpenForm);
    return () => {
      window.removeEventListener('open-feedback-form', handleExternalOpenForm);
    };
  }, []);

  const portalParts = [
    'Dashboard',
    'Payments',
    'Course registration',
    'Course form signing',
    'GPA tools',
    'Connect',
    'Support',
    'Other',
  ];

  const experienceOptions: {
    id: 'poor' | 'fair' | 'okay' | 'good' | 'great';
    label: string;
    emoji: string;
    rating: number;
  }[] = [
    { id: 'poor', label: 'Poor', emoji: '😞', rating: 1 },
    { id: 'fair', label: 'Fair', emoji: '🙁', rating: 2 },
    { id: 'okay', label: 'Okay', emoji: '😐', rating: 3 },
    { id: 'good', label: 'Good', emoji: '😊', rating: 4 },
    { id: 'great', label: 'Great', emoji: '😍', rating: 5 },
  ];

  const feedbackTypeOptions = [
    {
      id: 'idea',
      label: 'Idea',
      desc: 'Suggest something new or better',
      icon: Lightbulb,
      color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
    },
    {
      id: 'problem',
      label: 'Problem',
      desc: 'Something is not working',
      icon: AlertTriangle,
      color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    },
    {
      id: 'praise',
      label: 'Praise',
      desc: 'Tell us what you love',
      icon: Award,
      color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'other',
      label: 'Other',
      desc: 'Anything else on your mind',
      icon: MessageSquare,
      color: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);

    const chosenExp = experienceOptions.find((o) => o.id === experience) || experienceOptions[3];
    const ratingVal = chosenExp.rating;
    const title = `[${portalPart}] ${feedbackType.toUpperCase()}: ${description.slice(0, 45)}...`;

    try {
      const created = await createFeedback({
        feedback_type: feedbackType,
        title,
        description,
        rating: ratingVal,
      });

      const refId = created?.id
        ? `F-${String(created.id).slice(-4).padStart(4, '0')}`
        : `F-${Math.floor(1000 + Math.random() * 9000)}`;

      setSubmittedConfirmation({
        reference: refId,
        type: feedbackType.charAt(0).toUpperCase() + feedbackType.slice(1),
        area: portalPart,
        experienceLabel: chosenExp.label,
        experienceEmoji: chosenExp.emoji,
      });

      setShowForm(false);
      setDescription('');
      fetchFeedbacks();
    } catch {
      /* silent */
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenFormWithType = (type: 'idea' | 'problem' | 'praise' | 'other') => {
    setFeedbackType(type);
    setSubmittedConfirmation(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submittedCount = feedbacks.filter((f) => f.status === 'submitted').length;
  const inReviewCount = feedbacks.filter((f) => f.status === 'under_review').length;
  const implementedCount = feedbacks.filter((f) => f.status === 'implemented').length;

  const ideasCount = feedbacks.filter((f) => f.feedback_type === 'idea' || f.feedback_type === 'feature').length;
  const problemsCount = feedbacks.filter((f) => f.feedback_type === 'problem' || f.feedback_type === 'bug').length;
  const praiseCount = feedbacks.filter((f) => f.feedback_type === 'praise').length;

  const filteredFeedbacks = useMemo(() => {
    if (selectedFilter === 'all') return feedbacks;
    if (selectedFilter === 'idea')
      return feedbacks.filter((f) => f.feedback_type === 'idea' || f.feedback_type === 'feature');
    if (selectedFilter === 'problem')
      return feedbacks.filter((f) => f.feedback_type === 'problem' || f.feedback_type === 'bug');
    if (selectedFilter === 'praise') return feedbacks.filter((f) => f.feedback_type === 'praise');
    return feedbacks;
  }, [feedbacks, selectedFilter]);

  const firstName =
    user?.firstName || (user?.fullName || user?.full_name || (user as any)?.name)?.split(' ')[0] || 'Student';

  // VIEW 1: Confirmation Screen ("Thank you, [Name]!") - Screenshots 3 & 4
  if (submittedConfirmation) {
    return (
      <div className="flex justify-center items-center py-6 sm:py-12">
        <div className="w-full max-w-xl bg-white dark:bg-surface-900 rounded-3xl border border-surface-200/90 dark:border-surface-800 p-8 sm:p-10 shadow-sm text-center space-y-6">
          {/* Centered Checkmark with green circle */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center p-2.5">
              <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-surface-100 tracking-tight">
              Thank you, {firstName}!
            </h2>
            <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 max-w-md mx-auto leading-relaxed">
              Your feedback is with the team. We will reply here and in Communication.
            </p>
          </div>

          {/* Details Summary Card */}
          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-950/40 p-4 sm:p-5 text-left text-xs divide-y divide-surface-200/60 dark:divide-surface-800/80 space-y-2.5">
            <div className="flex items-center justify-between pt-1">
              <span className="text-surface-500 dark:text-surface-400">Reference</span>
              <span className="font-mono font-bold text-surface-900 dark:text-surface-100">
                {submittedConfirmation.reference}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2.5">
              <span className="text-surface-500 dark:text-surface-400">Type</span>
              <span className="font-semibold text-surface-900 dark:text-surface-100">{submittedConfirmation.type}</span>
            </div>
            <div className="flex items-center justify-between pt-2.5">
              <span className="text-surface-500 dark:text-surface-400">Area</span>
              <span className="font-semibold text-surface-900 dark:text-surface-100">{submittedConfirmation.area}</span>
            </div>
            <div className="flex items-center justify-between pt-2.5">
              <span className="text-surface-500 dark:text-surface-400">Experience</span>
              <span className="font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-1.5">
                <span>{submittedConfirmation.experienceEmoji}</span>
                <span>{submittedConfirmation.experienceLabel}</span>
              </span>
            </div>
          </div>

          {/* 3 Step Stepper */}
          <div className="space-y-3 pt-2 text-left">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span className="text-xs font-semibold text-surface-900 dark:text-surface-100">Received</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-surface-300 dark:border-surface-700 shrink-0" />
              <span className="text-xs text-surface-500 dark:text-surface-400">The team reviews it</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-surface-300 dark:border-surface-700 shrink-0" />
              <span className="text-xs text-surface-500 dark:text-surface-400">You get a reply</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => {
                setSubmittedConfirmation(null);
                setShowForm(false);
              }}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-sm transition-all"
            >
              View my feedback
            </button>
            <button
              onClick={() => {
                setSubmittedConfirmation(null);
                setShowForm(false);
                onBrowseHelpCenter();
              }}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300 text-xs font-semibold transition-all"
            >
              Back to Help Center
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VIEW 2: Form View (Screenshots 1 & 3)
  if (showForm) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Share your feedback form */}
        <div className="lg:col-span-8 bg-white dark:bg-surface-900 rounded-3xl border border-surface-200/90 dark:border-surface-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-2xl font-extrabold text-surface-900 dark:text-surface-100 tracking-tight">
              Share your feedback
            </h2>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">It takes about a minute.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: What kind of feedback is it? */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <label className="text-xs font-bold text-surface-900 dark:text-surface-100">
                  What kind of feedback is it?
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-7">
                {feedbackTypeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = feedbackType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFeedbackType(opt.id as any)}
                      className={`p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all ${
                        isSelected
                          ? 'border-primary-600 dark:border-primary-500 bg-primary-50/20 dark:bg-primary-950/20 ring-1 ring-primary-500 shadow-sm'
                          : 'border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-950/40 hover:border-surface-300 dark:hover:border-surface-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2.5 rounded-xl ${opt.color} shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-surface-900 dark:text-surface-100">{opt.label}</p>
                          <p className="text-[11px] text-surface-500 dark:text-surface-400 truncate mt-0.5">
                            {opt.desc}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Which part of the portal? */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <label className="text-xs font-bold text-surface-900 dark:text-surface-100">
                  Which part of the portal?
                </label>
              </div>

              <div className="flex items-center gap-2 flex-wrap pl-7">
                {portalParts.map((part) => {
                  const isSelected = portalPart === part;
                  return (
                    <button
                      key={part}
                      type="button"
                      onClick={() => setPortalPart(part)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'border border-surface-200 dark:border-surface-800 bg-surface-50/70 dark:bg-surface-950/40 text-surface-700 dark:text-surface-300 hover:border-primary-400'
                      }`}
                    >
                      {part}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: How is your experience? */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </span>
                <label className="text-xs font-bold text-surface-900 dark:text-surface-100">
                  How is your experience?
                </label>
              </div>

              <div className="flex items-center gap-6 sm:gap-8 pl-7 pt-1">
                {experienceOptions.map((opt) => {
                  const isSelected = experience === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setExperience(opt.id)}
                      className="flex flex-col items-center gap-1.5 group cursor-pointer"
                    >
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center text-2xl transition-all ${
                          isSelected
                            ? 'ring-2 ring-primary-500 bg-primary-50/50 dark:bg-primary-950/40 scale-110 shadow-sm'
                            : 'hover:scale-105 opacity-80 group-hover:opacity-100'
                        }`}
                      >
                        {opt.emoji}
                      </div>
                      <span
                        className={`text-[11px] font-medium transition-colors ${
                          isSelected ? 'font-bold text-surface-900 dark:text-white' : 'text-surface-400'
                        }`}
                      >
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 4: Tell us more */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  4
                </span>
                <label className="text-xs font-bold text-surface-900 dark:text-surface-100">Tell us more</label>
              </div>

              <div className="pl-7 space-y-2">
                <div className="rounded-2xl border border-primary-500 dark:border-primary-500/80 p-3.5 bg-surface-50/30 dark:bg-surface-950/40 focus-within:ring-2 focus-within:ring-primary-500/30 transition-all">
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                    placeholder="Tell us what works, what does not, and what you would love to see..."
                    className="w-full bg-transparent text-xs sm:text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none resize-none leading-relaxed"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-surface-400 px-1">
                  <span>Be specific. What were you trying to do?</span>
                  <span>{description.length}/1000</span>
                </div>
              </div>
            </div>

            {/* Add a screenshot optional box */}
            <div className="pl-7">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl border border-dashed border-surface-300 dark:border-surface-700 p-3.5 flex items-center justify-between cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 transition-colors bg-surface-50/40 dark:bg-surface-950/20"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-500 shrink-0">
                    <Paperclip className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-surface-900 dark:text-surface-100">
                      {screenshotFile ? screenshotFile.name : 'Add a screenshot'}
                    </p>
                    <p className="text-[11px] text-surface-400">Optional · JPG or PNG</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Browse
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setScreenshotFile(e.target.files[0]);
                  }}
                />
              </div>
            </div>

            {/* Notify me when the team replies */}
            <div className="pl-7">
              <div className="rounded-2xl border border-surface-200 dark:border-surface-800 p-3.5 flex items-center justify-between bg-surface-50/40 dark:bg-surface-950/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-500 shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-surface-900 dark:text-surface-100">
                      Notify me when the team replies
                    </p>
                    <p className="text-[11px] text-surface-400">You will get a message in Communication.</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifyReplies}
                  onClick={() => setNotifyReplies(!notifyReplies)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    notifyReplies ? 'bg-primary-600' : 'bg-surface-300 dark:bg-surface-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      notifyReplies ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Form actions */}
            <div className="pl-7 pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 text-xs font-semibold text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !description.trim()}
                className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send feedback
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Tips & Need help right now */}
        <div className="lg:col-span-4 space-y-6">
          {/* Tips for great feedback */}
          <div className="bg-white dark:bg-surface-900 rounded-3xl border border-surface-200/90 dark:border-surface-800 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <Lightbulb className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">Tips for great feedback</h3>
            </div>

            <div className="divide-y divide-surface-100 dark:divide-surface-800 text-xs">
              <div className="py-2.5 flex items-start gap-2.5 text-surface-700 dark:text-surface-300">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Say what you were trying to do.</span>
              </div>
              <div className="py-2.5 flex items-start gap-2.5 text-surface-700 dark:text-surface-300">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Share one idea per message.</span>
              </div>
              <div className="py-2.5 flex items-start gap-2.5 text-surface-700 dark:text-surface-300">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Add a screenshot if something looks wrong.</span>
              </div>
              <div className="py-2.5 flex items-start gap-2.5 text-surface-700 dark:text-surface-300">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Tell us how it should work.</span>
              </div>
            </div>
          </div>

          {/* Need help right now? */}
          <div className="bg-white dark:bg-surface-900 rounded-3xl border border-surface-200/90 dark:border-surface-800 p-5 sm:p-6 shadow-sm space-y-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>

            <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">Need help right now?</h3>
            <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
              Feedback is for ideas and issues. For urgent problems with results or payments, file a ticket.
            </p>

            <button
              onClick={() => navigate('/complaints?new=true')}
              className="w-full mt-2 py-2.5 px-4 rounded-xl border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-900 dark:text-surface-100 font-semibold text-xs transition-colors"
            >
              File a ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Helper for Stepper stages
  const getStepProgress = (status: string) => {
    switch (status) {
      case 'implemented':
        return 4;
      case 'planned':
        return 3;
      case 'under_review':
        return 2;
      case 'submitted':
      default:
        return 1;
    }
  };

  // Helper for Emoji from rating
  const getEmojiForRating = (rating?: number) => {
    switch (rating) {
      case 5:
        return '😍';
      case 4:
        return '😊';
      case 3:
        return '😐';
      case 2:
        return '🙁';
      case 1:
        return '😞';
      default:
        return '🙂';
    }
  };

  // VIEW 3: Populated Feedback List View (Screenshots 1 & 5)
  if (!loading && feedbacks.length > 0) {
    return (
      <div className="space-y-6">
        {/* Top 3 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-4 sm:p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 shrink-0">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-surface-400 font-medium">Submitted</p>
              <p className="text-2xl font-extrabold text-surface-900 dark:text-surface-100 leading-tight">
                {submittedCount}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-4 sm:p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-surface-400 font-medium">In review</p>
              <p className="text-2xl font-extrabold text-surface-900 dark:text-surface-100 leading-tight">
                {inReviewCount}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-4 sm:p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-surface-400 font-medium">Implemented</p>
              <p className="text-2xl font-extrabold text-surface-900 dark:text-surface-100 leading-tight">
                {implementedCount}
              </p>
            </div>
          </div>
        </div>

        {/* Category Filters Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedFilter === 'all'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-800 hover:border-surface-300'
              }`}
            >
              All {feedbacks.length}
            </button>
            <button
              onClick={() => setSelectedFilter('idea')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedFilter === 'idea'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-800 hover:border-surface-300'
              }`}
            >
              Ideas {ideasCount}
            </button>
            <button
              onClick={() => setSelectedFilter('problem')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedFilter === 'problem'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-800 hover:border-surface-300'
              }`}
            >
              Problems {problemsCount}
            </button>
            <button
              onClick={() => setSelectedFilter('praise')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedFilter === 'praise'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-800 hover:border-surface-300'
              }`}
            >
              Praise {praiseCount}
            </button>
          </div>

          <span className="text-xs text-surface-400 font-medium">Newest first</span>
        </div>

        {/* 2-Column Content: Feedbacks list on left, Sidebar on right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Feedback cards */}
          <div className="lg:col-span-8 space-y-4">
            {filteredFeedbacks.map((fb) => {
              const stepCount = getStepProgress(fb.status);
              const isIdea = fb.feedback_type === 'idea' || fb.feedback_type === 'feature';
              const isProblem = fb.feedback_type === 'problem' || fb.feedback_type === 'bug';
              const isPraise = fb.feedback_type === 'praise';

              const emoji = getEmojiForRating(fb.rating);
              const timeAgo = formatTimeAgo(fb.created_at);

              // Extract tag like "Course registration" if encoded in title [Area] or fallback
              let areaTag = 'Course registration';
              let displayTitle = fb.title;
              const match = fb.title.match(/^\[(.*?)\]\s*(.*)$/);
              if (match) {
                areaTag = match[1];
                displayTitle = match[2].replace(/^(IDEA|PROBLEM|PRAISE|OTHER):\s*/i, '');
              }

              const typeLabel = isIdea ? 'Idea' : isProblem ? 'Problem' : isPraise ? 'Praise' : 'Other';

              return (
                <div
                  key={fb.id}
                  className={`bg-white dark:bg-surface-900 rounded-3xl border p-5 sm:p-6 shadow-sm transition-all space-y-5 ${
                    fb.status === 'implemented'
                      ? 'border-blue-500/80 dark:border-blue-500/80 ring-1 ring-blue-500/40'
                      : 'border-surface-200/90 dark:border-surface-800'
                  }`}
                >
                  {/* Top Bar: Icon, Category/Area/Time, Emoji & Status */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`p-2.5 rounded-2xl shrink-0 mt-0.5 ${
                          isIdea
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                            : isProblem
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isIdea ? (
                          <Lightbulb className="w-5 h-5" />
                        ) : isProblem ? (
                          <AlertTriangle className="w-5 h-5" />
                        ) : (
                          <Heart className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-surface-400 font-medium">
                          <span
                            className={
                              isIdea
                                ? 'text-blue-600 dark:text-blue-400 font-bold'
                                : isProblem
                                  ? 'text-rose-600 dark:text-rose-400 font-bold'
                                  : 'text-emerald-600 dark:text-emerald-400 font-bold'
                            }
                          >
                            {typeLabel}
                          </span>
                          <span>·</span>
                          <span>{areaTag}</span>
                          <span>·</span>
                          <span>{timeAgo}</span>
                        </div>
                        <h3 className="text-base font-extrabold text-surface-900 dark:text-surface-100 mt-1">
                          {displayTitle}
                        </h3>
                        <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 mt-1.5 leading-relaxed">
                          {fb.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xl">{emoji}</span>
                      {fb.status === 'implemented' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Implemented
                        </span>
                      ) : fb.status === 'under_review' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950 shadow-sm">
                          <Search className="w-3.5 h-3.5 stroke-[2.5]" /> Under review
                        </span>
                      ) : fb.status === 'planned' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30">
                          Planned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30">
                          <Inbox className="w-3.5 h-3.5" /> Received
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Progress Stepper */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between relative">
                      {/* Step 1: Received */}
                      <div className="flex items-center gap-1.5 z-10 bg-white dark:bg-surface-900 pr-2">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            stepCount >= 1 ? 'bg-emerald-500 text-white' : 'bg-surface-300 text-transparent'
                          }`}
                        >
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span className="text-[11px] font-semibold text-surface-900 dark:text-surface-100">
                          Received
                        </span>
                      </div>

                      {/* Bar 1 */}
                      <div
                        className={`flex-1 h-0.5 mx-2 rounded-full ${
                          stepCount >= 2 ? 'bg-emerald-500' : 'bg-surface-200 dark:bg-surface-800'
                        }`}
                      />

                      {/* Step 2: Under review */}
                      <div className="flex items-center gap-1.5 z-10 bg-white dark:bg-surface-900 px-2">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            stepCount >= 2
                              ? 'bg-emerald-500 text-white'
                              : 'bg-surface-300 dark:bg-surface-700 text-transparent'
                          }`}
                        >
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span
                          className={`text-[11px] font-semibold ${
                            stepCount >= 2 ? 'text-surface-900 dark:text-surface-100' : 'text-surface-400'
                          }`}
                        >
                          Under review
                        </span>
                      </div>

                      {/* Bar 2 */}
                      <div
                        className={`flex-1 h-0.5 mx-2 rounded-full ${
                          stepCount >= 3 ? 'bg-emerald-500' : 'bg-surface-200 dark:bg-surface-800'
                        }`}
                      />

                      {/* Step 3: Planned */}
                      <div className="flex items-center gap-1.5 z-10 bg-white dark:bg-surface-900 px-2">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            stepCount >= 3
                              ? 'bg-emerald-500 text-white'
                              : 'bg-surface-300 dark:bg-surface-700 text-transparent'
                          }`}
                        >
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span
                          className={`text-[11px] font-semibold ${
                            stepCount >= 3 ? 'text-surface-900 dark:text-surface-100' : 'text-surface-400'
                          }`}
                        >
                          Planned
                        </span>
                      </div>

                      {/* Bar 3 */}
                      <div
                        className={`flex-1 h-0.5 mx-2 rounded-full ${
                          stepCount >= 4 ? 'bg-emerald-500' : 'bg-surface-200 dark:bg-surface-800'
                        }`}
                      />

                      {/* Step 4: Implemented */}
                      <div className="flex items-center gap-1.5 z-10 bg-white dark:bg-surface-900 pl-2">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            stepCount >= 4
                              ? 'bg-emerald-500 text-white'
                              : 'bg-surface-300 dark:bg-surface-700 text-transparent'
                          }`}
                        >
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span
                          className={`text-[11px] font-semibold ${
                            stepCount >= 4 ? 'text-surface-900 dark:text-surface-100' : 'text-surface-400'
                          }`}
                        >
                          Implemented
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Department Team Response (if present) */}
                  {fb.admin_response && (
                    <div className="rounded-2xl border border-surface-200/90 dark:border-surface-800/80 bg-surface-50/50 dark:bg-surface-950/40 p-4 space-y-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                          <Shield className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-surface-900 dark:text-surface-100">
                          Department team
                        </span>
                        <span className="text-xs text-surface-400">· {timeAgo}</span>
                      </div>
                      <p className="text-xs text-surface-700 dark:text-surface-300 leading-relaxed pl-8">
                        {fb.admin_response}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Column: Your impact & Got more to share? */}
          <div className="lg:col-span-4 space-y-6">
            {/* Your Impact Card */}
            <div className="bg-white dark:bg-surface-900 rounded-3xl border border-emerald-500/40 dark:border-emerald-500/30 p-6 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Star className="w-5 h-5 fill-emerald-500/20" />
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400">Your impact</h3>
                <p className="text-xl font-extrabold text-surface-900 dark:text-surface-100 mt-1">
                  {implementedCount} {implementedCount === 1 ? 'idea' : 'ideas'} shipped
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-1.5 leading-relaxed">
                  Thanks to you, the portal got a little better for everyone.
                </p>
              </div>
            </div>

            {/* Got more to share? */}
            <div className="bg-white dark:bg-surface-900 rounded-3xl border border-surface-200/90 dark:border-surface-800 p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">Got more to share?</h3>
              <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
                Ideas, problems and praise are all welcome.
              </p>

              <button
                onClick={() => {
                  setShowForm(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" /> Submit feedback
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // VIEW 4: Zero Feedback Overview View (clean initial state, zero mock data)
  return (
    <div className="space-y-8">
      {/* 3 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-4 sm:p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 shrink-0">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-surface-400 font-medium">Submitted</p>
            <p className="text-2xl font-extrabold text-surface-900 dark:text-surface-100 leading-tight">
              {submittedCount}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-4 sm:p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 shrink-0">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-surface-400 font-medium">In review</p>
            <p className="text-2xl font-extrabold text-surface-900 dark:text-surface-100 leading-tight">
              {inReviewCount}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-4 sm:p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 shrink-0">
            <Check className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-surface-400 font-medium">Implemented</p>
            <p className="text-2xl font-extrabold text-surface-900 dark:text-surface-100 leading-tight">
              {implementedCount}
            </p>
          </div>
        </div>
      </div>

      {/* Blue Banner: Help shape the portal */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#175cd3] to-[#154fc0] dark:from-[#3b82f6] dark:to-[#2563eb] p-6 sm:p-8 text-white shadow-md">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Content */}
          <div className="lg:col-span-7 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">YOUR VOICE</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Help shape the portal</h2>
            <p className="text-xs sm:text-sm text-white/80 leading-relaxed max-w-xl">
              Tell the team what works, what does not, and what you would love to see next. Every message is read.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-white text-surface-900 hover:bg-white/90 rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                + Submit feedback
              </button>
              <button
                onClick={onBrowseHelpCenter}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white rounded-xl text-xs font-semibold backdrop-blur-sm transition-all"
              >
                Browse help center
              </button>
            </div>
          </div>

          {/* Right Floating Cards */}
          <div className="lg:col-span-5 flex flex-col gap-2.5">
            <div className="rounded-2xl bg-white dark:bg-surface-900/90 text-surface-900 dark:text-white p-3 shadow-lg border border-white/20 dark:border-surface-800 flex items-center gap-3 max-w-xs ml-auto">
              <div className="p-2 rounded-xl bg-blue-500 text-white shrink-0">
                <Lightbulb className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold">Idea</p>
                <p className="text-[11px] text-surface-500 dark:text-surface-400">Add a new feature</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-surface-900/90 text-surface-900 dark:text-white p-3 shadow-lg border border-white/20 dark:border-surface-800 flex items-center gap-3 max-w-xs ml-auto translate-x-3">
              <div className="p-2 rounded-xl bg-amber-400 text-slate-950 shrink-0">
                <AlertTriangle className="w-4 h-4 fill-slate-950 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold">Problem</p>
                <p className="text-[11px] text-surface-500 dark:text-surface-400">Report an issue</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-surface-900/90 text-surface-900 dark:text-white p-3 shadow-lg border border-white/20 dark:border-surface-800 flex items-center gap-3 max-w-xs ml-auto">
              <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0">
                <Heart className="w-4 h-4 fill-white text-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold">Praise</p>
                <p className="text-[11px] text-surface-500 dark:text-surface-400">Say thank you</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What you can share */}
      <div className="space-y-3.5">
        <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">What you can share</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <button
            onClick={() => handleOpenFormWithType('idea')}
            className="p-4 rounded-2xl border border-surface-200/90 dark:border-surface-800 bg-white dark:bg-surface-900 hover:border-primary-400 transition-all text-left flex flex-col gap-2 group shadow-sm cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 w-fit">
              <Lightbulb className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-surface-900 dark:text-surface-100 group-hover:text-primary-600 transition-colors">
              Idea
            </p>
            <p className="text-[11px] text-surface-500 dark:text-surface-400">Suggest something new or better</p>
          </button>

          <button
            onClick={() => handleOpenFormWithType('problem')}
            className="p-4 rounded-2xl border border-surface-200/90 dark:border-surface-800 bg-white dark:bg-surface-900 hover:border-amber-400 transition-all text-left flex flex-col gap-2 group shadow-sm cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 w-fit">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-surface-900 dark:text-surface-100 group-hover:text-amber-600 transition-colors">
              Problem
            </p>
            <p className="text-[11px] text-surface-500 dark:text-surface-400">Something is not working</p>
          </button>

          <button
            onClick={() => handleOpenFormWithType('praise')}
            className="p-4 rounded-2xl border border-surface-200/90 dark:border-surface-800 bg-white dark:bg-surface-900 hover:border-emerald-400 transition-all text-left flex flex-col gap-2 group shadow-sm cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 w-fit">
              <Heart className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-surface-900 dark:text-surface-100 group-hover:text-emerald-600 transition-colors">
              Praise
            </p>
            <p className="text-[11px] text-surface-500 dark:text-surface-400">Tell us what you love</p>
          </button>

          <button
            onClick={() => handleOpenFormWithType('other')}
            className="p-4 rounded-2xl border border-surface-200/90 dark:border-surface-800 bg-white dark:bg-surface-900 hover:border-purple-400 transition-all text-left flex flex-col gap-2 group shadow-sm cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 w-fit">
              <MessageSquare className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-surface-900 dark:text-surface-100 group-hover:text-purple-600 transition-colors">
              Other
            </p>
            <p className="text-[11px] text-surface-500 dark:text-surface-400">Anything else on your mind</p>
          </button>
        </div>
      </div>

      {/* What happens next */}
      <div className="rounded-3xl border border-surface-200/90 dark:border-surface-800 bg-white dark:bg-surface-900 p-5 sm:p-6 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-surface-900 dark:text-surface-100 uppercase tracking-wider">
          What happens next
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-primary-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <div>
              <p className="text-xs font-bold text-surface-900 dark:text-surface-100">You share</p>
              <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
                Pick a type and tell us what is on your mind.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-primary-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <div>
              <p className="text-xs font-bold text-surface-900 dark:text-surface-100">The team reviews</p>
              <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
                Every message is read and tagged by the department.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-primary-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            <div>
              <p className="text-xs font-bold text-surface-900 dark:text-surface-100">You hear back</p>
              <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
                Replies show up here and in Communication.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Real Feedbacks Empty State */}
      {loading ? (
        <div className="bg-white dark:bg-surface-900 rounded-3xl border border-surface-200 dark:border-surface-800 p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600 mx-auto" />
          <p className="text-sm text-surface-500 mt-2">Loading feedback...</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-surface-300 dark:border-surface-800 bg-white/50 dark:bg-surface-900/50 p-6 sm:p-8 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-surface-800 text-surface-500 flex items-center justify-center shrink-0">
              <Inbox className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-surface-900 dark:text-surface-100">No feedback submitted yet</h4>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                Your feedback and the replies you get will be listed here.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 hover:bg-surface-50 dark:hover:bg-surface-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Submit feedback
          </button>
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState<'help' | 'feedback'>('help');

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-surface-50 tracking-tight">
              Support
            </h1>
            <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 mt-0.5">
              {activeTab === 'help'
                ? 'Find answers fast, or get in touch with the team.'
                : 'Share ideas, report problems and see how the team responds.'}
            </p>
          </div>

          {/* Navigation Pill Buttons & Submit button (NO sample data badge) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('help')}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'help'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800'
              }`}
            >
              <HelpCircle className="w-4 h-4" /> Help Center
            </button>
            <button
              onClick={() => setActiveTab('feedback')}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'feedback'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800'
              }`}
            >
              <MessageSquare className="w-4 h-4" /> My Feedback
            </button>
            {activeTab === 'feedback' && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-feedback-form'))}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs sm:text-sm font-bold shadow-sm transition-all ml-1"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" /> Submit feedback
              </button>
            )}
          </div>
        </div>

        {/* Content based on Active Tab */}
        {activeTab === 'help' ? <HelpCenterTab /> : <MyFeedbackTab onBrowseHelpCenter={() => setActiveTab('help')} />}
      </div>
    </div>
  );
}
