import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { Loader2 } from 'lucide-react';
import { getMyTradeOffers } from '../../api/skills-trade';
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

const MyTradesPage = () => {
  const { error: notifyError } = useNotification();
  const [trades, setTrades] = useState<TradeOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const raw = await getMyTradeOffers();
        setTrades(Array.isArray(raw) ? raw.map(mapTrade) : []);
      } catch (err: any) {
        notifyError('Load Failed', err?.message || 'Could not load trades');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Trade History</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review your swap and barter trade logs.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : trades.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-surface-500 dark:text-surface-400">No trades yet.</p>
        </div>
      ) : (
        <Card>
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {trades.map((t) => (
              <div key={t.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={(statusColors[t.status] as any) || 'default'}>{t.status}</Badge>
                    <span className="text-xs text-surface-400">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                    {t.offererSkill?.title || 'Skill offered'} → {t.recipientSkill?.title || 'Skill requested'}
                  </p>
                  <p className="text-xs text-surface-500">
                    {t.recipient?.firstName ? `With ${t.recipient.firstName}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default MyTradesPage;
