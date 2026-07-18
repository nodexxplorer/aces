import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import SkillCard from '../../components/ui/SkillCard';
import { useNotification } from '../../hooks/useNotification';
import { Search, Plus, Loader2 } from 'lucide-react';
import { getSkillListings, getSkillCategories } from '../../api/skills-trade';
import type { SkillListing, SkillCategory } from '../../types';

const mapListing = (raw: any): SkillListing => ({
  id: raw.id,
  title: raw.title,
  description: raw.description,
  level: raw.skill_level || raw.level || 'beginner',
  isPaid: raw.is_free !== undefined ? !raw.is_free : raw.isPaid ?? false,
  price: raw.price,
  isBarterAvailable: raw.barter_available ?? raw.isBarterAvailable ?? false,
  barterPreferences: raw.barter_description || raw.barterPreferences,
  userId: raw.user_id || raw.userId,
  categoryId: raw.category_id || raw.categoryId,
  isActive: raw.is_active ?? raw.isActive ?? true,
  createdAt: raw.created_at || raw.createdAt,
  updatedAt: raw.updated_at || raw.updatedAt,
  user: raw.user,
  category: raw.category,
  averageRating: raw.average_rating ?? raw.averageRating,
  totalReviews: raw.total_reviews ?? raw.totalReviews,
});

const SkillsMarketplacePage = () => {
  const { error: notifyError } = useNotification();
  const navigate = useNavigate();
  const [listings, setListings] = useState<SkillListing[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [rawListings, cats] = await Promise.all([
          getSkillListings(),
          getSkillCategories(),
        ]);
        setListings(Array.isArray(rawListings) ? rawListings.map(mapListing) : []);
        setCategories(Array.isArray(cats) ? cats : []);
      } catch (err: any) {
        notifyError('Load Failed', err?.message || 'Could not load marketplace');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = listings.filter((s) => {
    const matchesSearch = !search || s.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || s.categoryId === categoryFilter;
    const matchesLevel = !levelFilter || s.level === levelFilter;
    return matchesSearch && matchesCategory && matchesLevel;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Skills Trade</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Swap practical engineering skills, design talent, or study guides via barter deals.
          </p>
        </div>
        <Link to="/skills/create">
          <Button leftIcon={<Plus className="w-4 h-4" />}>
            List a Skill
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 max-w-2xl">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search skills..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          className="px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
        >
          <option value="">All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="expert">Expert</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-surface-500 dark:text-surface-400">No skills found matching your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((s) => (
            <SkillCard
              key={s.id}
              skill={s}
              onClick={() => navigate(`/skills/${s.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SkillsMarketplacePage;
