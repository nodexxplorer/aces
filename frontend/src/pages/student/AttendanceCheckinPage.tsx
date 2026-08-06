import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { selfCheckIn } from '../../api/class-rep';

export default function AttendanceCheckinPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setMessage('No attendance session found in this QR code.');
      return;
    }

    selfCheckIn(sessionId)
      .then(() => {
        setStatus('success');
        setMessage('You have been marked present.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err?.response?.data?.error || 'Could not check you in. The session may have closed.');
      });
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="mb-6">
          {status === 'loading' && <Loader2 className="w-16 h-16 text-primary-500 mx-auto animate-spin" />}
          {status === 'success' && <CheckCircle className="w-16 h-16 text-success-500 mx-auto" />}
          {status === 'error' && <XCircle className="w-16 h-16 text-danger-500 mx-auto" />}
        </div>
        <h1 className="text-2xl font-bold mb-2 text-surface-900 dark:text-white">
          {status === 'loading' ? 'Checking you in...' : status === 'success' ? 'Checked In!' : 'Check-In Failed'}
        </h1>
        {status !== 'loading' && <p className="text-surface-500 dark:text-surface-400 text-sm mb-6">{message}</p>}
        {status !== 'loading' && (
          <Link to="/dashboard">
            <Button className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        )}
      </Card>
    </div>
  );
}
