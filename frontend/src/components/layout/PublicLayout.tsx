import { Outlet } from 'react-router-dom';
import ThemeToggle from '../ui/ThemeToggle';
import { ToastContainer } from '../feedback/Toast';
import CookieConsent from '../feedback/CookieConsent';

const PublicLayout = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 via-secondary-700 to-accent-800 dark:from-surface-900 dark:via-surface-950 dark:to-surface-900 p-4 md:p-6 select-none relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary-500/20 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <Outlet />
      </div>
      <ThemeToggle />
      <ToastContainer />
      <CookieConsent />
    </div>
  );
};

export default PublicLayout;
