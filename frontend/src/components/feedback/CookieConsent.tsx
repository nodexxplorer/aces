import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X, ShieldCheck } from 'lucide-react';
import Button from '../ui/Button';
import { Link } from 'react-router-dom';

interface CookieConsentProps {
  /** Use the dark strip for pages on a dark background (the sign-in pages). */
  dark?: boolean;
}

/**
 * The cookie notice. It is a strip in the page flow, not a floating card, so
 * it never covers the content above it or the footer below it. It shows once,
 * after a short delay, until the visitor makes a choice.
 */
const CookieConsent = ({ dark = false }: CookieConsentProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('aces_cookie_consent');
    if (!consent) {
      // Delay showing the notice slightly for better UX
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('aces_cookie_consent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('aces_cookie_consent', 'declined');
    setIsVisible(false);
  };

  const surface = dark
    ? 'border-white/10 bg-surface-950/90 text-white/70'
    : 'border-surface-200 bg-white/95 text-surface-600 dark:border-surface-800 dark:bg-surface-900/95 dark:text-surface-400';
  const heading = dark ? 'text-white' : 'text-surface-900 dark:text-white';
  const iconTone = dark ? 'bg-white/10 text-primary-300' : 'bg-primary-500/10 text-primary-500';

  return (
    <AnimatePresence initial={false}>
      {isVisible && (
        <motion.div
          key="cookie-notice"
          role="region"
          aria-label="Cookie notice"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`relative z-20 w-full shrink-0 border-t px-4 py-3 backdrop-blur md:px-6 ${surface}`}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconTone}`}>
                <Cookie aria-hidden="true" className="h-4 w-4" />
              </div>
              <p className="text-xs leading-relaxed">
                <span className={`font-semibold ${heading}`}>Cookie Consent. </span>
                We use cookies to optimize portal sessions, secure login details, and compile academic reports. Read our{' '}
                <Link
                  to="/privacy-policy"
                  className="font-medium text-primary-500 hover:underline"
                  onClick={() => setIsVisible(false)}
                >
                  Privacy & Cookie Policy
                </Link>{' '}
                for more details.
              </p>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2">
              <Button size="xs" variant="ghost" onClick={handleDecline}>
                Decline
              </Button>
              <Button size="xs" onClick={handleAccept} leftIcon={<ShieldCheck className="h-3.5 w-3.5" />}>
                Accept Cookies
              </Button>
              <button
                type="button"
                onClick={() => setIsVisible(false)}
                aria-label="Hide the cookie notice"
                className="ml-1 text-surface-400 transition-colors hover:text-surface-600 dark:hover:text-surface-200"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsent;
