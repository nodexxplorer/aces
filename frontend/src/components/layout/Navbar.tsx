import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Bell, Search, Sun, Moon, LogOut, ShoppingCart, Menu } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useNotification } from '../../hooks/useNotification';
import RoleSwitcher from '../ui/RoleSwitcher';
import BadgeNotification from '../feedback/BadgeNotification';
import { getInitials } from '../../utils/formatters';
import { useSearch } from '../../hooks/useSearch';
import { useCartStore } from '../../stores/cartStore';
import { useRBAC } from '../../hooks/useRBAC';

interface NavbarProps {
  onMenuClick?: () => void;
}

const Navbar = ({ onMenuClick }: NavbarProps) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toggle, isDark } = useDarkMode();
  const { unreadCount } = useNotification();
  const { setQuery } = useSearch();
  const { activeRole } = useRBAC();
  const getItemCount = useCartStore((s) => s.getItemCount);
  const [profileOpen, setProfileOpen] = useState(false);
  const isStudent = activeRole === 'student';
  const [searchValue, setSearchValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      setQuery(searchValue.trim());
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-surface-900/80 backdrop-blur border-b border-surface-200 dark:border-surface-800 flex items-center justify-between px-3 md:px-6">
      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 md:hidden transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2 max-w-xs w-64 px-3 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
          <Search className="w-4 h-4 text-surface-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Quick search... (press Enter)"
            className="w-full bg-transparent text-xs text-surface-700 dark:text-surface-300 focus:outline-none placeholder:text-surface-400"
          />
        </div>
      </div>
      <div className="flex items-center gap-1 md:gap-2">
        <RoleSwitcher />
        <button
          onClick={toggle}
          className="p-2 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        {isStudent && (
          <div className="flex items-center gap-1 md:hidden">
            <Link to="/manuals">
              <button
                className="relative p-2 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                aria-label="Shopping cart"
              >
                <ShoppingCart className="w-5 h-5" />
                {getItemCount() > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-danger-500 rounded-full">
                    {getItemCount()}
                  </span>
                )}
              </button>
            </Link>
          </div>
        )}
        <Link to="/notifications">
          <button
          className="p-2 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 md:hidden transition-colors"
            aria-label="Notifications"
          >
            <BadgeNotification count={unreadCount}>
              <Bell className="w-5 h-5" />
            </BadgeNotification>
          </button>
        </Link>
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              getInitials(user?.firstName || 'A', user?.lastName || 'Z')
            )}
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-dropdown py-1 z-50 animate-scale-in">
              <div className="px-4 py-2.5 border-b border-surface-200 dark:border-surface-700">
                <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400 truncate">{user?.email}</p>
              </div>
              <Link
                to="/profile"
                onClick={() => setProfileOpen(false)}
                className="block w-full text-left px-4 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
              >
                My Profile
              </Link>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  logout();
                }}
                className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
