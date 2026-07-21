import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { Heart, DollarSign, Users, Award, Loader2 } from 'lucide-react';
import { createDonation, listMyDonations, listDonations, getDonationStats } from '../../api/alumni';
import { formatCurrency } from '../../utils/formatters';
import type { AlumniDonation, DonationStats, DonationChannel } from '../../types';

const channels: { value: DonationChannel; label: string; desc: string }[] = [
  { value: 'general', label: 'General Fund', desc: 'Support department operations and growth' },
  { value: 'scholarship', label: 'Scholarship Fund', desc: 'Fund scholarships for outstanding juniors' },
  { value: 'project', label: 'Project Fund', desc: 'Support specific lab or infrastructure projects' },
  { value: 'event_sponsorship', label: 'Event Sponsorship', desc: 'Sponsor alumni events and networking gatherings' },
  { value: 'emergency', label: 'Emergency Relief', desc: 'Help alumni or students in urgent need' },
];

const tierColors: Record<string, string> = {
  platinum: 'primary',
  gold: 'warning',
  silver: 'info',
  bronze: 'success',
  none: 'secondary',
};

const GiveBackPage = () => {
  const { success, error: notifyError } = useNotification();
  const [myDonations, setMyDonations] = useState<AlumniDonation[]>([]);
  const [allDonations, setAllDonations] = useState<AlumniDonation[]>([]);
  const [stats, setStats] = useState<DonationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [donateOpen, setDonateOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<DonationChannel>('general');
  const [amount, setAmount] = useState('50000');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [myData, allData, statsData] = await Promise.allSettled([
          listMyDonations(),
          listDonations(),
          getDonationStats(),
        ]);
        if (myData.status === 'fulfilled') setMyDonations(Array.isArray(myData.value) ? myData.value : []);
        if (allData.status === 'fulfilled') setAllDonations(Array.isArray(allData.value) ? allData.value : []);
        if (statsData.status === 'fulfilled') setStats(statsData.value);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDonate = async () => {
    const val = parseInt(amount);
    if (!val || val <= 0) return;
    setSubmitting(true);
    try {
      const result = await createDonation({
        channel: selectedChannel,
        amount: val,
        currency: 'NGN',
        message: message || undefined,
        is_anonymous: anonymous,
      });
      if (result?.authorization_url) {
        window.location.href = result.authorization_url;
      } else {
        success('Donation Received', `Thank you for your ${formatCurrency(val)} contribution!`);
        setDonateOpen(false);
        setAmount('50000');
        setMessage('');
        setAnonymous(false);
        const [myData, allData, statsData] = await Promise.allSettled([listMyDonations(), listDonations(), getDonationStats()]);
        if (myData.status === 'fulfilled') setMyDonations(Array.isArray(myData.value) ? myData.value : []);
        if (allData.status === 'fulfilled') setAllDonations(Array.isArray(allData.value) ? allData.value : []);
        if (statsData.status === 'fulfilled') setStats(statsData.value);
      }
    } catch (err: any) {
      notifyError('Failed', err?.response?.data?.error || 'Could not process donation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Give Back Program</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Support department growth, research labs, or fund scholarships for outstanding juniors.
        </p>
      </div>

      {loading ? (
        <Card>
          <div className="flex items-center justify-center p-12 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
            <span className="text-sm text-surface-500">Loading...</span>
          </div>
        </Card>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="p-4">
                <p className="text-xs text-surface-500">Total Raised</p>
                <p className="text-2xl font-bold text-surface-900 dark:text-white">{formatCurrency(stats.total_donations)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-surface-500">Total Donations</p>
                <p className="text-2xl font-bold text-surface-900 dark:text-white">{stats.donation_count}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-surface-500">Platinum Donors</p>
                <p className="text-2xl font-bold text-surface-900 dark:text-white">{stats.platinum_count}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-surface-500">Gold Donors</p>
                <p className="text-2xl font-bold text-surface-900 dark:text-white">{stats.gold_count}</p>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map((ch) => (
              <Card key={ch.value} hover className="p-5 cursor-pointer" onClick={() => { setSelectedChannel(ch.value); setDonateOpen(true); }}>
                <h3 className="font-semibold text-base text-surface-900 dark:text-white mb-1">{ch.label}</h3>
                <p className="text-xs text-surface-500 mb-4">{ch.desc}</p>
                <Button size="sm" className="w-full" leftIcon={<Heart className="w-4 h-4" />}>
                  Contribute
                </Button>
              </Card>
            ))}
          </div>

          {myDonations.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-3">Your Donation History</h2>
              <div className="space-y-2">
                {myDonations.map((d) => (
                  <Card key={d.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-surface-900 dark:text-white">{channels.find((c) => c.value === d.channel)?.label || d.channel}</p>
                      <p className="text-xs text-surface-500">{new Date(d.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={(tierColors[d.recognized_tier] || 'secondary') as any}>{d.recognized_tier}</Badge>
                      <span className="text-sm font-semibold text-surface-900 dark:text-white">{formatCurrency(d.amount)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {allDonations.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-3">Recent Donations</h2>
              <div className="space-y-2">
                {allDonations.slice(0, 10).map((d) => (
                  <Card key={d.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-600">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-surface-900 dark:text-white">
                          {d.is_anonymous ? 'Anonymous Donor' : d.donor_name || 'Alumni'}
                        </p>
                        <p className="text-xs text-surface-500">{channels.find((c) => c.value === d.channel)?.label || d.channel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={(tierColors[d.recognized_tier] || 'secondary') as any}>{d.recognized_tier}</Badge>
                      <span className="text-sm font-semibold text-surface-900 dark:text-white">{formatCurrency(d.amount)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal isOpen={donateOpen} onClose={() => setDonateOpen(false)} title="Make a Donation">
        <div className="space-y-4">
          <div className="p-3 bg-primary-50 dark:bg-primary-950/20 rounded-lg">
            <p className="text-sm font-medium text-primary-700 dark:text-primary-300">
              {channels.find((c) => c.value === selectedChannel)?.label}
            </p>
            <p className="text-xs text-primary-600/70 dark:text-primary-400/70">
              {channels.find((c) => c.value === selectedChannel)?.desc}
            </p>
          </div>
          <Input
            label="Donation Amount (₦)"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <div className="flex gap-2">
            {['10000', '25000', '50000', '100000', '250000'].map((v) => (
              <Button key={v} size="xs" variant={amount === v ? 'primary' : 'outline'} onClick={() => setAmount(v)}>
                {formatCurrency(parseInt(v))}
              </Button>
            ))}
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Message (optional)</label>
            <textarea
              className="w-full mt-1 h-20 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none resize-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Leave a note with your donation..."
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="anonymous"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="w-4 h-4 text-primary-600 bg-white border-surface-300 rounded"
            />
            <label htmlFor="anonymous" className="text-sm text-surface-700 dark:text-surface-300">Make this donation anonymous</label>
          </div>
          <Button className="w-full" leftIcon={<DollarSign className="w-4 h-4" />} isLoading={submitting} onClick={handleDonate}>
            Donate {formatCurrency(parseInt(amount) || 0)}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default GiveBackPage;
