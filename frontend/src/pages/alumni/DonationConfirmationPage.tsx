import { useSearchParams, Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { CheckCircle, ArrowLeft, Heart } from 'lucide-react';

const DonationConfirmationPage = () => {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('ref') || searchParams.get('reference') || searchParams.get('trxref');

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-surface-900 dark:text-white">Thank You for Your Donation!</h1>
        <p className="text-surface-500 dark:text-surface-400 mb-4">
          Your generous contribution helps support our department and its students.
        </p>
        {reference && (
          <p className="text-surface-400 dark:text-surface-500 text-sm mb-6">Reference: {reference}</p>
        )}
        <div className="flex flex-col gap-3">
          <Link to="/alumni/give-back">
            <Button className="w-full">
              <Heart className="w-4 h-4 mr-2" />
              Back to Give Back
            </Button>
          </Link>
          <Link to="/alumni">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Alumni Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default DonationConfirmationPage;
