import { motion } from 'framer-motion';
import { ServerCrash, RefreshCw, Home } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Link } from 'react-router-dom';

const ServerErrorPage = () => {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="flex items-center justify-center min-h-[75vh] px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg"
      >
        <Card glass className="p-8 md:p-10 text-center shadow-2xl relative overflow-hidden border border-surface-200/50 dark:border-surface-800/50">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />
          
          <div className="mx-auto w-20 h-20 rounded-2xl bg-red-500/10 dark:bg-red-500/20 text-red-500 flex items-center justify-center mb-6 animate-pulse">
            <ServerCrash className="w-10 h-10" />
          </div>

          <h1 className="text-8xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent mb-2 select-none tracking-tighter">
            500
          </h1>
          
          <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-3">
            Internal Server Error
          </h2>
          
          <p className="text-sm text-surface-500 dark:text-surface-400 max-w-sm mx-auto mb-8 leading-relaxed">
            The servers are having a brief issue processing this operation. Please try reloading or check back in a few minutes.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              onClick={handleReload}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800/80 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Reload Page
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

export default ServerErrorPage;
