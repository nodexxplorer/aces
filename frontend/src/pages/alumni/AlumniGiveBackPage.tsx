import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ProgressBar from '../../components/feedback/ProgressBar';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { Heart, DollarSign } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface Fundraiser {
  id: string;
  title: string;
  description: string;
  goal: number;
  collected: number;
}

const mockFundraisers: Fundraiser[] = [
  { id: 'fund-1', title: 'Electrical Engineering Lab Upgrade', description: 'Procure modern digital oscilloscopes and FPGA developmental kits.', goal: 1000000, collected: 450000 },
];

const AlumniGiveBackPage = () => {
  const { success } = useNotification();
  const [funds, setFunds] = useState<Fundraiser[]>(mockFundraisers);
  const [donateOpen, setDonateOpen] = useState(false);
  const [selectedFund, setSelectedFund] = useState<Fundraiser | null>(null);
  const [amount, setAmount] = useState('20000');
  const [donating, setDonating] = useState(false);

  const handleDonate = async () => {
    if (!selectedFund || !amount) return;
    setDonating(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const val = parseInt(amount);
      setFunds((prev) =>
        prev.map((f) => (f.id === selectedFund.id ? { ...f, collected: f.collected + val } : f))
      );
      success('Donation Received', `Thank you for donating ${formatCurrency(val)} to the "${selectedFund.title}" project!`);
      setDonateOpen(false);
    } finally {
      setDonating(false);
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {funds.map((f) => {
          const percent = (f.collected / f.goal) * 100;
          return (
            <Card key={f.id} className="p-6">
              <h3 className="font-semibold text-lg text-surface-900 dark:text-white mb-2">{f.title}</h3>
              <p className="text-xs text-surface-500 mb-4">{f.description}</p>
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Raised: {formatCurrency(f.collected)}</span>
                  <span>Goal: {formatCurrency(f.goal)}</span>
                </div>
                <ProgressBar value={percent} showPercentage />
              </div>
              <Button
                className="w-full"
                leftIcon={<Heart className="w-4 h-4" />}
                onClick={() => {
                  setSelectedFund(f);
                  setDonateOpen(true);
                }}
              >
                Donate to Project
              </Button>
            </Card>
          );
        })}
      </div>

      <Modal isOpen={donateOpen} onClose={() => setDonateOpen(false)} title="Make Donation Contribution">
        {selectedFund && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-base">{selectedFund.title}</h4>
              <p className="text-xs text-surface-500">Provide financial aid support via Paystack gateway transfer.</p>
            </div>
            <div className="space-y-4 pt-4 border-t border-surface-200 dark:border-surface-800">
              <Input
                label="Donation Value (₦)"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <Button className="w-full" isLoading={donating} leftIcon={<DollarSign className="w-4 h-4" />} onClick={handleDonate}>
                Proceed to Checkout
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AlumniGiveBackPage;
