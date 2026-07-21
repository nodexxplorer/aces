import { useState, useEffect } from 'react';
import { HelpCircle, Search, ThumbsUp, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { listHelpArticles, getHelpArticle, markHelpArticleHelpful, searchHelpArticles, type HelpArticle } from '../../api/additional-features';

export default function HelpCenterPage() {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, []);

  useEffect(() => {
    const cats = Array.from(new Set(articles.map((a) => a.category)));
    setCategories(cats);
  }, [articles]);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const data = await listHelpArticles();
      setArticles(data);
    } catch (err) {
      console.error('Failed to load help articles', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchArticles();
      return;
    }
    setSearching(true);
    try {
      const data = await searchHelpArticles(searchQuery);
      setArticles(data);
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setSearching(false);
    }
  };

  const handleExpand = async (article: HelpArticle) => {
    if (expandedId === article.id) {
      setExpandedId(null);
      setSelectedArticle(null);
      return;
    }
    try {
      const full = await getHelpArticle(article.id);
      setSelectedArticle(full);
      setExpandedId(article.id);
    } catch (err) {
      console.error('Failed to load article', err);
    }
  };

  const handleHelpful = async (articleId: string) => {
    try {
      await markHelpArticleHelpful(articleId);
      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, helpful_count: (a.helpful_count || 0) + 1 } : a))
      );
    } catch (err) {
      console.error('Failed to mark helpful', err);
    }
  };

  const filtered =
    activeCategory === 'all' ? articles : articles.filter((a) => a.category === activeCategory);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <HelpCircle className="w-8 h-8 text-primary-500" />
          <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50">Help Center</h1>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
          <input
            type="text"
            placeholder="Search help articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-50 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                fetchArticles();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-surface-400 hover:text-surface-600"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-700'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading || searching ? (
          <div className="text-center py-16 text-surface-400">Loading articles...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-12 text-center">
            <BookOpen className="w-12 h-12 text-surface-300 mx-auto mb-4" />
            <p className="text-surface-500 dark:text-surface-400 text-lg">No articles found.</p>
            <p className="text-surface-400 dark:text-surface-500 text-sm mt-1">
              Try a different search or category.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((article) => (
              <div
                key={article.id}
                className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => handleExpand(article)}
                  className="w-full text-left p-4 flex items-start gap-4 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                >
                  <span className="mt-0.5 text-surface-400">
                    {expandedId === article.id ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300">
                        {article.category}
                      </span>
                    </div>
                    <h3 className="text-surface-900 dark:text-surface-50 font-semibold">
                      {article.title}
                    </h3>
                    <div className="flex gap-4 mt-1 text-xs text-surface-400">
                      <span>{article.view_count ?? 0} views</span>
                      <span>{article.helpful_count ?? 0} found helpful</span>
                    </div>
                  </div>
                </button>

                {expandedId === article.id && selectedArticle && (
                  <div className="px-4 pb-4 border-t border-surface-100 dark:border-surface-800">
                    <div className="pt-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-surface-700 dark:text-surface-300">
                      {selectedArticle.content}
                    </div>
                    <div className="mt-4 pt-3 border-t border-surface-100 dark:border-surface-800 flex items-center gap-2">
                      <button
                        onClick={() => handleHelpful(article.id)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-surface-600 dark:text-surface-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 transition-colors"
                      >
                        <ThumbsUp className="w-4 h-4" />
                        Was this helpful?
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
