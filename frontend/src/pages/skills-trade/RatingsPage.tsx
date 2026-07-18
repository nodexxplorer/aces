import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { Loader2, Star } from 'lucide-react';
import { listUserRatings, getUserReputation } from '../../api/skills-trade';
import type { SkillRating, UserReputation } from '../../types';

const mapRating = (raw: any): SkillRating => ({
  id: raw.id,
  tradeId: raw.trade_id || raw.tradeId,
  raterId: raw.rater_id || raw.raterId,
  rateeId: raw.rated_user_id || raw.rateeId,
  rating: raw.rating,
  review: raw.review,
  createdAt: raw.created_at || raw.createdAt,
  rater: raw.rater,
});

const mapReputation = (raw: any): UserReputation => ({
  id: raw.id,
  userId: raw.user_id || raw.userId,
  totalTrades: raw.total_trades || raw.totalTrades || 0,
  completedTrades: raw.completed_trades || raw.completedTrades || 0,
  averageRating: raw.average_rating || raw.averageRating || 0,
  totalReviews: raw.total_reviews || raw.totalReviews || 0,
  reputationScore: raw.reputation_score || raw.reputationScore || 0,
});

const StarDisplay = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i <= rating ? 'text-amber-400 fill-current' : 'text-surface-300 dark:text-surface-600'}`}
      />
    ))}
  </div>
);

const RatingsPage = () => {
  const { user } = useAuth();
  const { error: notifyError } = useNotification();
  const [ratings, setRatings] = useState<SkillRating[]>([]);
  const [reputation, setReputation] = useState<UserReputation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      try {
        setLoading(true);
        const [rawRatings, rawRep] = await Promise.all([
          listUserRatings(user.id),
          getUserReputation(user.id).catch(() => null),
        ]);
        setRatings(Array.isArray(rawRatings) ? rawRatings.map(mapRating) : []);
        if (rawRep) setReputation(mapReputation(rawRep));
      } catch (err: any) {
        notifyError('Load Failed', err?.message || 'Could not load ratings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Peer Review Ratings</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review feedback received from student swap partners.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          {reputation && (
            <Card className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-surface-900 dark:text-white">{reputation.averageRating.toFixed(1)}</p>
                  <p className="text-xs text-surface-500">Avg Rating</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-surface-900 dark:text-white">{reputation.totalReviews}</p>
                  <p className="text-xs text-surface-500">Reviews</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-surface-900 dark:text-white">{reputation.completedTrades}</p>
                  <p className="text-xs text-surface-500">Trades</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-surface-900 dark:text-white">{reputation.reputationScore}</p>
                  <p className="text-xs text-surface-500">Rep Score</p>
                </div>
              </div>
            </Card>
          )}

          <Card>
            {ratings.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-surface-500 dark:text-surface-400">No ratings yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-100 dark:divide-surface-800">
                {ratings.map((r) => (
                  <div key={r.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-semibold">
                          {r.rater?.firstName?.[0] || '?'}
                        </div>
                        <span className="text-sm font-medium text-surface-900 dark:text-white">
                          {r.rater?.firstName || 'Anonymous'}
                        </span>
                      </div>
                      <StarDisplay rating={r.rating} />
                    </div>
                    {r.review && (
                      <p className="text-sm text-surface-600 dark:text-surface-400 ml-10">{r.review}</p>
                    )}
                    <p className="text-xs text-surface-400 ml-10 mt-1">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default RatingsPage;
