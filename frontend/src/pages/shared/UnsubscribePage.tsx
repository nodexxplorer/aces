import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MailX, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { unsubscribeFromEmails } from '../../api/notifications';

const UnsubscribePage = () => {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This unsubscribe link is missing its token.');
      return;
    }
    unsubscribeFromEmails(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.message || "You've been unsubscribed from email notifications.");
      })
      .catch(() => {
        setStatus('error');
        setMessage('This unsubscribe link is invalid or has expired.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
            {status === 'loading' && <Loader2 className="w-7 h-7 text-primary-500 animate-spin" />}
            {status === 'success' && <CheckCircle2 className="w-7 h-7 text-success-500" />}
            {status === 'error' && <XCircle className="w-7 h-7 text-danger-500" />}
          </div>

          <div className="flex items-center justify-center gap-2 text-surface-400">
            <MailX className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Email Notifications</span>
          </div>

          <h1 className="text-xl font-bold text-surface-900 dark:text-white">
            {status === 'loading'
              ? 'Unsubscribing...'
              : status === 'success'
                ? "You're Unsubscribed"
                : 'Something Went Wrong'}
          </h1>

          <p className="text-sm text-surface-500 dark:text-surface-400">
            {status === 'loading' ? 'One moment while we update your preferences.' : message}
          </p>

          {status === 'success' && (
            <p className="text-xs text-surface-400 dark:text-surface-500">
              Changed your mind, or want finer control over which emails you get? You can re-enable email notifications
              or manage individual categories anytime from Notification Settings once logged in.
            </p>
          )}

          <div className="pt-2">
            <Link to="/login">
              <Button variant="outline" className="w-full">
                Back to ACES Zone
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default UnsubscribePage;
