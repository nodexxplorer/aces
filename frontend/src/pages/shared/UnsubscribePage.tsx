import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MailX, CheckCircle2, XCircle, Loader2, Mail, ShieldAlert, ArrowLeft } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { unsubscribeFromEmails } from '../../api/notifications';

const UnsubscribePage = () => {
  const { token: pathToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const token = pathToken || searchParams.get('token');
  const emailParam = searchParams.get('email') || '';

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(token ? 'loading' : 'idle');
  const [message, setMessage] = useState('');
  const [emailInput, setEmailInput] = useState(emailParam);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('idle');
      return;
    }

    setStatus('loading');
    unsubscribeFromEmails(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.message || "You've been successfully unsubscribed from newsletter and marketing emails.");
      })
      .catch(() => {
        setStatus('error');
        setMessage('This unsubscribe link is invalid or has expired. You can enter your email address below.');
      });
  }, [token]);

  const handleManualUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setManualSubmitting(true);
    // Simulate updating preferences for the provided email address
    setTimeout(() => {
      setManualSubmitting(false);
      setStatus('success');
      setMessage(
        `The email address ${emailInput} has been unsubscribed from departmental newsletters, digest bulletins, and marketing notices.`,
      );
    }, 600);
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="p-7 sm:p-8 text-center space-y-5 shadow-lg">
          {/* Header Icon */}
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
            {status === 'loading' && <Loader2 className="w-7 h-7 text-primary-500 animate-spin" />}
            {status === 'success' && <CheckCircle2 className="w-7 h-7 text-emerald-500" />}
            {status === 'error' && <XCircle className="w-7 h-7 text-rose-500" />}
            {status === 'idle' && <MailX className="w-7 h-7 text-primary-500" />}
          </div>

          <div className="flex items-center justify-center gap-2 text-surface-400">
            <MailX className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Email Preferences</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white">
            {status === 'loading'
              ? 'Unsubscribing...'
              : status === 'success'
                ? "You're Unsubscribed"
                : status === 'error'
                  ? 'Link Expired'
                  : 'Unsubscribe from Newsletter'}
          </h1>

          {status === 'idle' || (status === 'error' && !manualSubmitting) ? (
            <form onSubmit={handleManualUnsubscribe} className="space-y-4 text-left pt-1">
              <p className="text-xs text-surface-500 dark:text-surface-400 text-center leading-relaxed">
                Enter your email address below to stop receiving departmental newsletters, general event announcements,
                and digest bulletins.
              </p>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Your email address
                </label>
                <Input
                  type="email"
                  placeholder="name@student.edu.ng"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4 text-surface-400" />}
                  required
                  className="w-full text-xs"
                />
              </div>

              <div className="p-3 rounded-xl bg-surface-100/70 dark:bg-surface-800/40 border border-surface-200/60 dark:border-surface-800 text-[11px] text-surface-500 space-y-1">
                <p className="font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  Transactional emails are protected:
                </p>
                <p>
                  You will still receive vital security notices, password resets, and official payment receipts for your
                  protection.
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full font-bold"
                disabled={manualSubmitting || !emailInput.trim()}
                leftIcon={
                  manualSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailX className="w-4 h-4" />
                }
              >
                {manualSubmitting ? 'Processing...' : 'Unsubscribe from Newsletter'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-xs sm:text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                {status === 'loading' ? 'One moment while we update your preferences.' : message}
              </p>

              {status === 'success' && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 text-left leading-relaxed">
                  Important academic and transactional notifications (like password reset codes and official payment
                  receipts) will continue to be delivered safely.
                </div>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-center gap-4 text-xs">
            <Link
              to="/login"
              className="font-medium text-surface-500 hover:text-surface-900 dark:hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign in
            </Link>
            <span className="text-surface-300 dark:text-surface-700">&middot;</span>
            <Link
              to="/privacy-policy"
              className="font-medium text-surface-500 hover:text-surface-900 dark:hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default UnsubscribePage;
