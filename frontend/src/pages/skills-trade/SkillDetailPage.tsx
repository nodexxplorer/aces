import { useParams } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { ArrowRightLeft } from 'lucide-react';

const SkillDetailPage = () => {
  const { id } = useParams();
  const { success } = useNotification();

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Skill Listing Details</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Detailed overview of selected skill profile.
        </p>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">React & TypeScript Development</h2>
        <p className="text-xs text-primary-500 mb-4">Provided by John Doe · Expert level</p>
        <p className="text-sm text-surface-700 dark:text-surface-300 mb-6">
          Help build high performance web interfaces. Open to swap with UI design principles.
        </p>
        <Button leftIcon={<ArrowRightLeft className="w-4 h-4" />} className="w-full" onClick={() => success('Initiating Barter', 'Opening barter proposal configurations...')}>
          Propose Swap Barter
        </Button>
      </Card>
    </div>
  );
};

export default SkillDetailPage;
