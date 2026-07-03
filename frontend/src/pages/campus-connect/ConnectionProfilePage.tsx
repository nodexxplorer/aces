import { useParams } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { User, MessageSquare } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';

const ConnectionProfilePage = () => {
  const { id } = useParams();
  const { success } = useNotification();

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Connection Profile</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Detailed profile of your connection.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center text-primary-500">
            <User className="w-10 h-10" />
          </div>
          <div>
            <h3 className="font-semibold text-xl text-surface-900 dark:text-white">Jane Smith</h3>
            <p className="text-sm text-surface-500">Student · 500 Level</p>
            <p className="text-xs text-surface-400 mt-1">ID: {id}</p>
          </div>
          <Button leftIcon={<MessageSquare className="w-4 h-4" />} onClick={() => success('Chat Opened', 'Redirecting to direct chat session...')}>
            Send Message
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ConnectionProfilePage;
