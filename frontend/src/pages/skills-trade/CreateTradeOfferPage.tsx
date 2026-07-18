import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { createTradeOffer, getSkillListings, getMySkillListings } from '../../api/skills-trade';
import type { SkillListing } from '../../types';

const mapListing = (raw: any): SkillListing => ({
  id: raw.id,
  title: raw.title,
  description: raw.description,
  level: raw.skill_level || raw.level || 'beginner',
  isPaid: raw.is_free !== undefined ? !raw.is_free : raw.isPaid ?? false,
  price: raw.price,
  isBarterAvailable: raw.barter_available ?? raw.isBarterAvailable ?? false,
  userId: raw.user_id || raw.userId,
  categoryId: raw.category_id || raw.categoryId,
  isActive: raw.is_active ?? raw.isActive ?? true,
  createdAt: raw.created_at || raw.createdAt,
  updatedAt: raw.updated_at || raw.updatedAt,
  user: raw.user,
  category: raw.category,
});

const CreateTradeOfferPage = () => {
  const { success, error: notifyError } = useNotification();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedSkillId = searchParams.get('skillId') || '';

  const [allListings, setAllListings] = useState<SkillListing[]>([]);
  const [myListings, setMyListings] = useState<SkillListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [targetSkillId, setTargetSkillId] = useState(preselectedSkillId);
  const [offeredSkillId, setOfferedSkillId] = useState('');
  const [requestedSkillId, setRequestedSkillId] = useState('');
  const [message, setMessage] = useState('');
  const [priceOffered, setPriceOffered] = useState('');
  const [isBarter, setIsBarter] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [allRaw, myRaw] = await Promise.all([
          getSkillListings(),
          user?.id ? getMySkillListings(user.id) : Promise.resolve([]),
        ]);
        setAllListings(Array.isArray(allRaw) ? allRaw.map(mapListing) : []);
        setMyListings(Array.isArray(myRaw) ? myRaw.map(mapListing) : []);
      } catch (err: any) {
        notifyError('Load Failed', err?.message || 'Could not load listings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  useEffect(() => {
    if (preselectedSkillId) setTargetSkillId(preselectedSkillId);
  }, [preselectedSkillId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSkillId || !offeredSkillId) return;
    try {
      setSubmitting(true);
      await createTradeOffer({
        to_user_id: allListings.find((l) => l.id === targetSkillId)?.userId || '',
        offered_skill_id: offeredSkillId,
        requested_skill_id: requestedSkillId || undefined,
        message: message.trim() || undefined,
        price_offered: !isBarter && priceOffered ? Number(priceOffered) : undefined,
        is_barter: isBarter,
      });
      success('Proposal Sent', 'Your trade proposal has been dispatched.');
      navigate('/trades/my-trades');
    } catch (err: any) {
      notifyError('Failed', err?.message || 'Could not send proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const availableTargets = allListings.filter((l) => l.userId !== user?.id);

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Propose Barter Swap</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Select target skill listing and configure what you want to swap for it.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Trade Details</CardTitle>
            <CardDescription>Setup barter exchange parameters</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit} className="p-4 pt-0 space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Target Skill</label>
              <select
                className="w-full appearance-none rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                value={targetSkillId}
                onChange={(e) => setTargetSkillId(e.target.value)}
                required
              >
                <option value="">Select a skill...</option>
                {availableTargets.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title} ({l.user?.firstName || 'User'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Your Offered Skill</label>
              <select
                className="w-full appearance-none rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                value={offeredSkillId}
                onChange={(e) => setOfferedSkillId(e.target.value)}
                required
              >
                <option value="">Select your skill...</option>
                {myListings.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Barter Trade</label>
              <button
                type="button"
                onClick={() => setIsBarter(!isBarter)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isBarter ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isBarter ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {!isBarter && (
              <Input
                label="Price Offered (NGN)"
                type="number"
                placeholder="e.g. 5000"
                value={priceOffered}
                onChange={(e) => setPriceOffered(e.target.value)}
              />
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Message (optional)</label>
              <textarea
                placeholder="Explain how this trade is mutually beneficial..."
                className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              leftIcon={submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
            >
              {submitting ? 'Sending...' : 'Submit Proposal'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
};

export default CreateTradeOfferPage;
