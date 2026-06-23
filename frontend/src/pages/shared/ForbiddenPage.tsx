import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { motion } from 'framer-motion';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';
import Card from '../../components/ui/Card';

const ForbiddenPage = () => {
  return (
    <div className="flex items-center justify-center min-h-[75vh] px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg"
      >
        <Card glass className="p-8 md:p-10 text-center shadow-2xl relative overflow-hidden border border-surface-200/50 dark:border-surface-800/50">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-danger-500 via-warning-500 to-danger-500" />
          
          <div className="mx-auto w-20 h-20 rounded-2xl bg-danger-500/10 dark:bg-danger-500/20 text-danger-500 flex items-center justify-center mb-6 animate-bounce">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <h1 className="text-8xl font-black bg-gradient-to-r from-danger-500 to-warning-500 bg-clip-text text-transparent mb-2 select-none tracking-tighter">
            403
          </h1>
          
          <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-3">
            Access Forbidden
          </h2>
          
          <p className="text-sm text-surface-500 dark:text-surface-400 max-w-sm mx-auto mb-8 leading-relaxed">
            You don't have authorization or necessary clearance roles to view this restricted module.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              onClick={() => window.history.back()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800/80 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>
            <Link to="/dashboard" className="w-full sm:w-auto">
              <Button className="w-full" leftIcon={<Home className="w-4 h-4" />}>
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default ForbiddenPage;
