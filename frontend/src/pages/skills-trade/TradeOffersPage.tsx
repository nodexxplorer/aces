import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { Check, X, Loader2, RotateCcw } from 'lucide-react';
import { getMyTradeOffers, updateTradeStatus } from '../../api/skills-trade';
import type { TradeOffer } from '../../types';

const mapTrade = (raw: any): TradeOffer => ({
  id: raw.id,
  offererId: raw.from_user_id || raw.offererId,
  recipientId: raw.to_user_id || raw.recipientId,
  offererSkillId: raw.offered_skill_id || raw.offererSkillId,
  recipientSkillId: raw.requested_skill_id || raw.recipientSkillId,
  offererDescription: raw.message || raw.offererDescription,
  status: raw.status,
  createdAt: raw.created_at || raw.createdAt,
  completedAt: raw.completed_at || raw.completedAt,
  offerer: raw.offerer,
  recipient: raw.recipient,
  offererSkill: raw.offered_skill || raw.offererSkill,
  recipientSkill: raw.requested_skill || raw.recipientSkill,
});

const statusColors: Record<string, string> = {
  pending: 'warning',
  accepted: 'info',
  rejected: 'danger',
  completed: 'success',
  cancelled: 'default',
};

const TradeOffersPage = () => {
  const { success, error: notifyError } = useNotification();
  const [trades, setTrades] = useState<TradeOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const raw = await getMyTradeOffers();
      setTrades(Array.isArray(raw) ? raw.map(mapTrade) : []);
    } catch (err: any) {
      notifyError('Load Failed', err?.message || 'Could not load trade offers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  const handleStatus = async (id: string, status: string) => {
    try {
      setActionId(id);
      await updateTradeStatus(id, status);
      setTrades((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: status as TradeOffer['status'] } : t))
      );
      success('Updated', `Trade ${status}.`);
    } catch (err: any) {
      notifyError('Failed', err?.message || 'Could not update trade');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Barter Proposals</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review peer trade requests exchanging skills.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : trades.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-surface-500 dark:text-surface-400">No trade offers yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {trades.map((t) => (
            <Card key={t.id} className="p-6">
              <div className="flex items-center justify-between mb-3">
                <Badge variant={(statusColors[t.status] as any) || 'default'}>{t.status}</Badge>
                <span className="text-xs text-surface-400">
                  {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                </span>
              </div>
              <h3 className="font-semibold text-lg text-surface-900 dark:text-white mb-1">
                Trade with {t.recipient?.firstName || t.offerer?.firstName || 'User'}
              </h3>
              {t.offererSkill && (
                <p className="text-xs text-surface-500 mb-1">
                  Offering: <span className="font-semibold">{t.offererSkill.title}</span>
                </p>
              )}
              {t.recipientSkill && (
                <p className="text-xs text-surface-500 mb-2">
                  Requesting: <span className="font-semibold">{t.recipientSkill.title}</span>
                </p>
              )}
              {t.offererDescription && (
                <p className="text-xs text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-800 p-3 rounded-lg mb-4 line-clamp-2">
                  &quot;{t.offererDescription}&quot;
                </p>
              )}
              <div className="flex gap-2">
                {t.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      variant="success"
                      leftIcon={actionId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      onClick={() => handleStatus(t.id, 'accepted')}
                      disabled={actionId === t.id}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-danger-500 hover:bg-danger-50"
                      leftIcon={actionId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      onClick={() => handleStatus(t.id, 'cancelled')}
                      disabled={actionId === t.id}
                    >
                      Decline
                    </Button>
                  </>
                )}
                {t.status === 'accepted' && (
                  <Button
                    size="sm"
                    variant="success"
                    leftIcon={actionId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    onClick={() => handleStatus(t.id, 'completed')}
                    disabled={actionId === t.id}
                  >
                    Mark Completed
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TradeOffersPage;
