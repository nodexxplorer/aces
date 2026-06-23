import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X, ShieldCheck } from 'lucide-react';
import Button from '../ui/Button';
import { Link } from 'react-router-dom';

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('aces_cookie_consent');
    if (!consent) {
      // Delay showing the banner slightly for better UX
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

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50"
        >
          <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-xl rounded-xl p-5 md:p-6 glass">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-500/10 text-primary-500 flex items-center justify-center">
                <Cookie className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-sm text-surface-900 dark:text-white flex items-center gap-1.5">
                    Cookie Consent
                  </h4>
                  <button
                    onClick={() => setIsVisible(false)}
                    className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed">
                  We use cookies to optimize portal sessions, secure login details, and compile academic reports. Read our{' '}
                  <Link
                    to="/privacy-policy"
                    className="text-primary-500 hover:underline font-medium"
                    onClick={() => setIsVisible(false)}
                  >
                    Privacy & Cookie Policy
                  </Link>{' '}
                  for more details.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-4 pt-2">
              <Button size="xs" variant="ghost" onClick={handleDecline}>
                Decline
              </Button>
              <Button size="xs" onClick={handleAccept} leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}>
                Accept Cookies
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsent;
