import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Footer from './Footer';
import { ToastContainer } from '../feedback/Toast';
import CookieConsent from '../feedback/CookieConsent';

const AppShell = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col md:pl-64 min-h-screen">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-6 md:p-8">
          <Outlet />
        </main>
        <Footer />
      </div>
      <ToastContainer />
      <CookieConsent />
    </div>
  );
};

export default AppShell;
