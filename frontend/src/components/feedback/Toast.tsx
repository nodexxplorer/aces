import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../utils/cn';

const toastIcons = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
  error: <XCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertCircle className="w-5 h-5 text-amber-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
};

export const ToastContainer = () => {
  const { notifications, removeNotification } = useNotificationStore();
  const toastItems = notifications.filter((n) => n.id.startsWith('toast-'));

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toastItems.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-4 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-lg'
            )}
          >
            <div className="shrink-0">
              {toastIcons[toast.type as keyof typeof toastIcons] || toastIcons.info}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-100">{toast.title}</h4>
              {toast.message && <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{toast.message}</p>}
            </div>
            <button
              onClick={() => removeNotification(toast.id)}
              className="shrink-0 p-1 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
