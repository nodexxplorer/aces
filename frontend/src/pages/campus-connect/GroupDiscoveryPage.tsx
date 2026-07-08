import { useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const mockGroups = [
  { id: 'group-1', name: 'Embedded Systems Lab Partners', description: 'Collaborating on EEE 511 assembly codes.' },
];

const GroupDiscoveryPage = () => {
  const { success } = useNotification();
  const [list] = useState(mockGroups);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Discover Groups</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Join core academic interest groups or study partner chats.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {list.map((g) => (
          <Card key={g.id} className="p-6">
            <h3 className="font-semibold text-lg text-surface-900 dark:text-white mb-2">{g.name}</h3>
            <p className="text-xs text-surface-500 mb-4">{g.description}</p>
            <div className="flex gap-2">
              <Link to={`/connect/groups/${g.id}`} className="flex-1">
                <Button variant="outline" className="w-full justify-center">
                  View Group
                </Button>
              </Link>
              <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => success('Joined Group', 'Added to study group directory.')}>
                Join Group
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default GroupDiscoveryPage;
