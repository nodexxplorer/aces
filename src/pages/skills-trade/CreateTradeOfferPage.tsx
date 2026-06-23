import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useNotification } from '../../hooks/useNotification';
import { ArrowRightLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CreateTradeOfferPage = () => {
  const { success } = useNotification();
  const navigate = useNavigate();
  const [partnerSkill, setPartnerSkill] = useState('1');
  const [mySkill, setMySkill] = useState('my-1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    success('Proposal Dispatched', 'Your barter proposal has been sent to the partner.');
    navigate('/trades/my-trades');
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Propose Barter Swap</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Select target skill listing and configure what you want to swap for it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trade Details</CardTitle>
          <CardDescription>Setup barter exchange parameters</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} className="p-4 pt-0 space-y-4">
          <Select
            label="Target Skill Requested"
            options={[
              { value: '1', label: 'React & TypeScript Development (John Doe)' },
            ]}
            value={partnerSkill}
            onChange={(e) => setPartnerSkill(e.target.value)}
          />
          <Select
            label="Offer One of Your Listed Skills"
            options={[
              { value: 'my-1', label: 'UI Design Fundamentals' },
            ]}
            value={mySkill}
            onChange={(e) => setMySkill(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Proposal Details</label>
            <textarea
              placeholder="Explain how this trade is mutually beneficial..."
              className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
              required
            />
          </div>
          <Button type="submit" className="w-full" leftIcon={<ArrowRightLeft className="w-4 h-4" />}>
            Submit Proposal
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default CreateTradeOfferPage;
