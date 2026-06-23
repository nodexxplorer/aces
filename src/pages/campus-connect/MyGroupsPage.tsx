import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Link } from 'react-router-dom';

const mockMyGroups = [
  { id: 'group-1', name: 'Embedded Systems Lab Partners', description: 'Collaborating on EEE 511 assembly codes.' },
];

const MyGroupsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">My Groups</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review and access study groups you are currently a member of.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {mockMyGroups.map((g) => (
          <Card key={g.id} className="p-6">
            <h3 className="font-semibold text-lg text-surface-900 dark:text-white mb-2">{g.name}</h3>
            <p className="text-xs text-surface-500 mb-4">{g.description}</p>
            <Link to={`/connect/groups/${g.id}`} className="block">
              <Button variant="outline" className="w-full justify-center">
                Open Group Chat
              </Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MyGroupsPage;
