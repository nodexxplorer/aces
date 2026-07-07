import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Footer from './Footer';
import ThemeToggle from '../ui/ThemeToggle';
import { ToastContainer } from '../feedback/Toast';
import CookieConsent from '../feedback/CookieConsent';
import OfflineBanner from '../feedback/OfflineBanner';

const AppShell = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex flex-col overflow-x-hidden">
      <div className="flex-1 flex w-full min-h-0">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
        <div className="flex flex-col flex-1 min-w-0">
          <Navbar onMenuClick={() => setMobileSidebarOpen(true)} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <Outlet />
          </main>
          <Footer />
        </div>
      </div>
      <OfflineBanner />
      <ThemeToggle />
      <ToastContainer />
      <CookieConsent />
    </div>
  );
};

export default AppShell;
