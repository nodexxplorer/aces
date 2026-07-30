import { useState, useEffect } from 'react';
import { HelpCircle, Search, ThumbsUp, ChevronDown, ChevronRight, BookOpen, Lightbulb, FileText, CreditCard, Bug, Mail, Phone } from 'lucide-react';
import { listHelpArticles, getHelpArticle, markHelpArticleHelpful, searchHelpArticles, type HelpArticle } from '../../api/additional-features';

const quickLinks = [
  { icon: FileText, label: 'How to Check Results', query: 'result' },
  { icon: BookOpen, label: 'Course Registration Guide', query: 'course registration' },
  { icon: CreditCard, label: 'Making Payments', query: 'payment' },
  { icon: Bug, label: 'Common Issues & Fixes', query: 'troubleshoot' },
];

export default function HelpCenterPage() {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => { fetchArticles(); }, []);

  useEffect(() => {
    const cats = Array.from(new Set(articles.map((a) => a.category)));
    setCategories(cats);
  }, [articles]);

  const fetchArticles = async () => {
    setLoading(true);
    try { setArticles(await listHelpArticles()); } catch { /* silent */ } finally { setLoading(false); }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { fetchArticles(); return; }
    setSearching(true);
    try { setArticles(await searchHelpArticles(searchQuery)); } catch { /* silent */ } finally { setSearching(false); }
  };

  const handleExpand = async (article: HelpArticle) => {
    if (expandedId === article.id) { setExpandedId(null); setSelectedArticle(null); return; }
    try { setSelectedArticle(await getHelpArticle(article.id)); setExpandedId(article.id); } catch { /* silent */ }
  };

  const handleHelpful = async (articleId: string) => {
    try {
      await markHelpArticleHelpful(articleId);
      setArticles((prev) => prev.map((a) => (a.id === articleId ? { ...a, helpful_count: (a.helpful_count || 0) + 1 } : a)));
    } catch { /* silent */ }
  };

  const quickSearch = (q: string) => {
    setSearchQuery(q);
    if (q) {
      setSearching(true);
      searchHelpArticles(q).then(setArticles).catch(() => {}).finally(() => setSearching(false));
    } else { fetchArticles(); }
  };

  const totalViews = articles.reduce((sum, a) => sum + (a.view_count || 0), 0);
  const totalHelpful = articles.reduce((sum, a) => sum + (a.helpful_count || 0), 0);
  const filtered = activeCategory === 'all' ? articles : articles.filter((a) => a.category === activeCategory);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <HelpCircle className="w-8 h-8 text-primary-500" />
          <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50">Help Center</h1>
        </div>

        {/* Welcome Banner */}
        <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl p-6 text-white">
          <h2 className="text-xl font-bold">How can we help you?</h2>
          <p className="text-primary-100 text-sm mt-1">Search our knowledge base or browse categories below.</p>
          <div className="relative mt-4 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-300" />
            <input
              type="text"
              placeholder="Search help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); fetchArticles(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/70 hover:text-white">Clear</button>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-4 text-center">
            <p className="text-2xl font-bold text-surface-900 dark:text-white">{articles.length}</p>
            <p className="text-xs text-surface-500 mt-1">Articles</p>
          </div>
          <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-4 text-center">
            <p className="text-2xl font-bold text-surface-900 dark:text-white">{categories.length}</p>
            <p className="text-xs text-surface-500 mt-1">Categories</p>
          </div>
          <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-4 text-center">
            <p className="text-2xl font-bold text-surface-900 dark:text-white">{totalViews}</p>
            <p className="text-xs text-surface-500 mt-1">Total Views</p>
          </div>
          <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-4 text-center">
            <p className="text-2xl font-bold text-surface-900 dark:text-white">{totalHelpful}</p>
            <p className="text-xs text-surface-500 mt-1">Found Helpful</p>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4" /> Quick Answers</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <button key={link.label} onClick={() => quickSearch(link.query)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all text-left"
                >
                  <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{link.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveCategory('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === 'all' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-700'}`}>All</button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === cat ? 'bg-primary-500 text-white' : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-700'}`}>{cat}</button>
          ))}
        </div>

        {loading || searching ? (
          <div className="text-center py-16 text-surface-400">Loading articles...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-12 text-center">
            <BookOpen className="w-12 h-12 text-surface-300 mx-auto mb-4" />
            <p className="text-surface-500 dark:text-surface-400 text-lg">No articles found.</p>
            <p className="text-surface-400 dark:text-surface-500 text-sm mt-1">Try a different search or category.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((article) => (
              <div key={article.id} className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
                <button onClick={() => handleExpand(article)} className="w-full text-left p-4 flex items-start gap-4 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                  <span className="mt-0.5 text-surface-400">{expandedId === article.id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300">{article.category}</span>
                    </div>
                    <h3 className="text-surface-900 dark:text-surface-50 font-semibold">{article.title}</h3>
                    <div className="flex gap-4 mt-1 text-xs text-surface-400">
                      <span>{article.view_count ?? 0} views</span>
                      <span>{article.helpful_count ?? 0} found helpful</span>
                    </div>
                  </div>
                </button>
                {expandedId === article.id && selectedArticle && (
                  <div className="px-4 pb-4 border-t border-surface-100 dark:border-surface-800">
                    <div className="pt-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-surface-700 dark:text-surface-300">{selectedArticle.content}</div>
                    <div className="mt-4 pt-3 border-t border-surface-100 dark:border-surface-800 flex items-center gap-2">
                      <button onClick={() => handleHelpful(article.id)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-surface-600 dark:text-surface-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 transition-colors">
                        <ThumbsUp className="w-4 h-4" /> Was this helpful?
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Contact Support */}
        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">Still need help?</h3>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">Our support team is here to assist you with any issues.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-800/50">
              <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Email Support</p>
                <p className="text-xs text-surface-500">support@aceszone.edu.ng</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-800/50">
              <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Phone Support</p>
                <p className="text-xs text-surface-500">+234 800 ACES HELP</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
