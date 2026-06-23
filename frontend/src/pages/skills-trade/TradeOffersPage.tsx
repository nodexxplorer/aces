import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { Check, X } from 'lucide-react';

const mockOffers = [
  { id: '1', senderName: 'Jane Smith', skillOffered: 'UI Design Fundamentals', skillRequested: 'React & TS Development', notes: 'Hi, I need help with React code, I can design your web layout.' },
];

const TradeOffersPage = () => {
  const { success, warning } = useNotification();
  const [list, setList] = useState(mockOffers);

  const handleAccept = (id: string, name: string) => {
    setList((prev) => prev.filter((o) => o.id !== id));
    success('Offer Accepted', `Accepted trade agreement with ${name}. Connection established.`);
  };

  const handleReject = (id: string, name: string) => {
    setList((prev) => prev.filter((o) => o.id !== id));
    warning('Offer Declined', `Declined trade proposal from ${name}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Barter Proposals</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review peer trade requests exchanging skills.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {list.map((o) => (
          <Card key={o.id} className="p-6">
            <h3 className="font-semibold text-lg text-surface-900 dark:text-white mb-1">Offer from {o.senderName}</h3>
            <p className="text-xs text-surface-500 mb-2">Swapping: <span className="font-semibold">{o.skillOffered}</span> for <span className="font-semibold">{o.skillRequested}</span></p>
            <p className="text-xs text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-800 p-3 rounded-lg mb-4">
              "{o.notes}"
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="success" leftIcon={<Check className="w-4 h-4" />} onClick={() => handleAccept(o.id, o.senderName)}>
                Accept Swap
              </Button>
              <Button size="sm" variant="outline" className="text-danger-500 hover:bg-danger-50" leftIcon={<X className="w-4 h-4" />} onClick={() => handleReject(o.id, o.senderName)}>
                Decline
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TradeOffersPage;
