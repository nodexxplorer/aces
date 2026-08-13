import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Footer from './Footer';
import CookieConsent from '../feedback/CookieConsent';
import AdminMobileGuard from './AdminMobileGuard';
import OfflineBanner from '../feedback/OfflineBanner';
import ChatbotWidget from '../ai/ChatbotWidget';

const AppShell = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');

  return (
    <div className="h-dvh bg-surface-50 dark:bg-surface-950 flex flex-col overflow-hidden print:h-auto print:block print:overflow-visible">
      <div className="flex-1 flex w-full min-h-0 print:block">
        <div className="print:hidden">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />
        </div>
        <div className="flex flex-col flex-1 min-w-0 print:block">
          <div className="print:hidden">
            <Navbar onMenuClick={() => setMobileSidebarOpen(true)} />
          </div>
          {/* print:overflow-visible/h-auto so a page's "Print" button (window.print())
              only outputs <main>'s content at natural height — without this, the
              scroll container clips to viewport height and everything outside it
              (sidebar, navbar, footer) still occupies page space in the printout. */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto print:p-0 print:overflow-visible print:h-auto">
            {isAdmin ? (
              <AdminMobileGuard>
                <Outlet />
              </AdminMobileGuard>
            ) : (
              <Outlet />
            )}
          </main>
          <div className="print:hidden">
            <Footer />
          </div>
        </div>
      </div>
      <div className="print:hidden">
        <ChatbotWidget />
        <OfflineBanner />
        <CookieConsent />
      </div>
    </div>
  );
};

export default AppShell;
