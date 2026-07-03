import { motion } from 'framer-motion';
import { XOctagon, LogOut, Mail } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';

const ApprovalRejectedPage = () => {
  const { logout, user } = useAuth();

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-50 dark:bg-surface-950 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg"
      >
        <Card glass className="p-8 md:p-10 text-center shadow-2xl relative overflow-hidden border border-surface-200/50 dark:border-surface-800/50">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-danger-500 to-danger-600" />
          
          <div className="mx-auto w-20 h-20 rounded-2xl bg-danger-500/10 dark:bg-danger-500/20 text-danger-500 flex items-center justify-center mb-6">
            <XOctagon className="w-10 h-10" />
          </div>

          <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-3">
            Registration Disapproved
          </h2>
          
          <p className="text-sm text-surface-500 dark:text-surface-400 max-w-sm mx-auto mb-6 leading-relaxed">
            Your registration request for the ACES Zone portal has been rejected by department administrators.
          </p>

          {user?.rejectionReason && (
            <div className="p-4 bg-danger-500/5 border border-danger-500/10 rounded-xl text-left mb-8">
              <span className="block text-xs font-semibold text-danger-500 uppercase tracking-wider mb-1">Reason provided:</span>
              <p className="text-sm text-surface-700 dark:text-surface-300 font-medium">
                "{user.rejectionReason}"
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <a
              href="mailto:support@aces.uniuyo.edu.ng"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800/80 transition-colors"
            >
              <Mail className="w-4 h-4" /> Contact Support
            </a>
            <Button
              className="w-full sm:w-auto"
              variant="danger"
              onClick={logout}
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Sign Out
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default ApprovalRejectedPage;
