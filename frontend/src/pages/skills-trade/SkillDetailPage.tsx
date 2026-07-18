import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { ArrowRightLeft, Loader2, Star, DollarSign, ArrowLeft } from 'lucide-react';
import { getSkillListing } from '../../api/skills-trade';
import type { SkillListing } from '../../types';

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
  portfolioUrl: raw.portfolio_url || raw.portfolioUrl,
});

const levelColors: Record<string, string> = {
  beginner: 'info',
  intermediate: 'warning',
  advanced: 'primary',
  expert: 'success',
};

const SkillDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { error: notifyError } = useNotification();
  const [listing, setListing] = useState<SkillListing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        setLoading(true);
        const raw = await getSkillListing(id);
        setListing(mapListing(raw));
      } catch (err: any) {
        notifyError('Load Failed', err?.message || 'Could not load listing');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="text-center py-20">
        <p className="text-surface-500">Listing not found.</p>
        <Link to="/skills" className="text-primary-500 text-sm mt-2 inline-block">Back to marketplace</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
          <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-400" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Skill Details</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Detailed overview of this skill listing.
          </p>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-400 to-primary-500 flex items-center justify-center text-white text-sm font-semibold">
            {listing.user?.firstName?.[0]}{listing.user?.lastName?.[0] || '??'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-surface-900 dark:text-white">{listing.title}</h2>
            <p className="text-xs text-surface-500">
              {listing.user?.firstName} {listing.user?.lastName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-4">
          <Badge variant={(levelColors[listing.level] as any) || 'default'}>{listing.level}</Badge>
          {listing.category && <Badge variant="outline">{listing.category.name}</Badge>}
          {listing.averageRating !== undefined && (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <Star className="w-3.5 h-3.5 fill-current" /> {listing.averageRating.toFixed(1)}
            </span>
          )}
        </div>

        {listing.description && (
          <p className="text-sm text-surface-700 dark:text-surface-300 mb-4">{listing.description}</p>
        )}

        <div className="flex flex-wrap gap-4 mb-6 text-sm text-surface-600 dark:text-surface-400">
          {listing.isBarterAvailable && (
            <span className="flex items-center gap-1">
              <ArrowRightLeft className="w-4 h-4" /> Barter available
            </span>
          )}
          {listing.isPaid && listing.price !== undefined && (
            <span className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" /> ₦{listing.price.toLocaleString()}
            </span>
          )}
          {!listing.isPaid && (
            <span className="text-success-500 font-medium">Free</span>
          )}
        </div>

        {listing.barterPreferences && (
          <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4 mb-6">
            <p className="text-xs font-medium text-surface-500 mb-1">Looking for</p>
            <p className="text-sm text-surface-700 dark:text-surface-300">{listing.barterPreferences}</p>
          </div>
        )}

        {listing.portfolioUrl && (
          <a
            href={listing.portfolioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-500 hover:underline mb-4 inline-block"
          >
            View Portfolio
          </a>
        )}

        <Link to={`/trades/create?skillId=${listing.id}`}>
          <Button leftIcon={<ArrowRightLeft className="w-4 h-4" />} className="w-full">
            Request Trade
          </Button>
        </Link>
      </Card>
    </div>
  );
};

export default SkillDetailPage;
