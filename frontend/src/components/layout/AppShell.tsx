import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { isAdminArea } from '../../config/departmentAdminPaths';
import { useRBAC } from '../../hooks/useRBAC';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import AdminNavbar from './AdminNavbar';
import StaffNavbar from './StaffNavbar';
import CookieConsent from '../feedback/CookieConsent';
import AdminMobileGuard from './AdminMobileGuard';
import OfflineBanner from '../feedback/OfflineBanner';
import ChatbotWidget from '../ai/ChatbotWidget';

const AppShell = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const { activeRole } = useRBAC();
  const isAdmin =
    isAdminArea(pathname) || activeRole === 'hod' || activeRole === 'admin' || activeRole === 'delegated_admin';
  const isStaff = activeRole === 'lecturer' || activeRole === 'dept_bursar' || activeRole === 'class_bursar';

  return (
    <div className="h-dvh bg-[var(--bg)] text-[var(--text)] flex flex-col overflow-hidden transition-colors duration-200 print:h-auto print:block print:overflow-visible">
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
            {isAdmin ? (
              <AdminNavbar onMenuClick={() => setMobileSidebarOpen(true)} />
            ) : isStaff ? (
              <StaffNavbar onMenuClick={() => setMobileSidebarOpen(true)} />
            ) : (
              <Navbar onMenuClick={() => setMobileSidebarOpen(true)} />
            )}
          </div>
          {/* print:overflow-visible/h-auto so a page's "Print" button (window.print())
              only outputs <main>'s content at natural height — without this, the
              scroll container clips to viewport height and everything outside it
              (sidebar, navbar, footer) still occupies page space in the printout. */}
          <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-7 overflow-y-auto overflow-x-hidden print:p-0 print:overflow-visible print:h-auto">
            {isAdmin ? (
              <AdminMobileGuard>
                <Outlet />
              </AdminMobileGuard>
            ) : (
              <Outlet />
            )}
          </main>
          <div className="print:hidden">
            <CookieConsent />
          </div>
        </div>
      </div>
      <div className="print:hidden">
        <ChatbotWidget />
        <OfflineBanner />
      </div>
    </div>
  );
};

export default AppShell;
