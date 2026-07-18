import { Monitor, Smartphone } from 'lucide-react';

const AdminMobileGuard = ({ children }: { children: React.ReactNode }) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-warning-50 flex items-center justify-center mb-4">
          <Smartphone className="w-8 h-8 text-warning-500" />
        </div>
        <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">
          Large Screen Required
        </h2>
        <p className="text-sm text-surface-500 dark:text-surface-400 max-w-sm">
          The admin panel requires a larger screen. Please use a desktop or tablet in landscape mode.
        </p>
        <div className="flex items-center gap-2 mt-4 text-xs text-surface-400">
          <Monitor className="w-4 h-4" />
          <span>Minimum width: 768px</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminMobileGuard;
