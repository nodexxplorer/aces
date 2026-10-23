import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import {
  Search,
  Sun,
  Moon,
  LogOut,
  Menu,
  User,
  Users,
  BookOpen,
  FileSignature,
  Wrench,
  Monitor,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useRBAC } from '../../hooks/useRBAC';
import { useSearch } from '../../hooks/useSearch';
import { useCurrentDepartment } from '../branding/department';
import NotificationBell from '../notifications/NotificationBell';
import { getMediaUrl } from '../../api/client';
import { departmentAdminPath } from '../../config/departmentAdminPaths';
import { useAuthStore } from '../../stores/authStore';

interface AdminNavbarProps {
  onMenuClick?: () => void;
}

export default function AdminNavbar({ onMenuClick }: AdminNavbarProps) {
  const navigate = useNavigate();
  const { user, logout, switchRole } = useAuth();
  const { setQuery } = useSearch();
  const department = useCurrentDepartment();
  const { mode, setMode, toggle, isDark } = useDarkMode();
  const { activeRole } = useRBAC();
  const urlCode = useAuthStore((s) => s.user?.tenant?.urlCode);

  const [searchValue, setSearchValue] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      setQuery(searchValue.trim());
      navigate(departmentAdminPath(urlCode, `/admin/users?search=${encodeURIComponent(searchValue.trim())}`));
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setRoleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = user?.firstName
    ? `${user.firstName.charAt(0)}${(user.lastName || '').charAt(0)}`.toUpperCase()
    : 'BS';

  const roleLabel =
    activeRole === 'hod'
      ? 'HOD'
      : activeRole === 'delegated_admin' || activeRole === 'admin'
        ? 'ADMIN'
        : activeRole.toUpperCase();

  const userRoles = user?.roles || [];
  const hasMultipleRoles = userRoles.length > 1;

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-surface-900/80 backdrop-blur border-b border-surface-200 dark:border-surface-800 flex items-center justify-between px-3 md:px-6 transition-colors duration-200">
      {/* Mobile Header: Hamburger + "Admin Portal" */}
      <div className="flex items-center gap-3 md:hidden">
        <button
          onClick={onMenuClick}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface-200 dark:border-surface-700 bg-transparent text-surface-900 dark:text-white transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>
        <span className="text-base font-bold text-surface-900 dark:text-white">Admin Portal</span>
      </div>

      {/* Desktop Search Bar (Exact match to design): Quick search users, courses, dues [Enter] */}
      <div className="hidden md:flex items-center flex-1 max-w-md">
        <div className="relative flex items-center w-full px-3.5 py-1.5 rounded-full border border-surface-200 dark:border-surface-700/80 bg-surface-50/60 dark:bg-surface-800/40 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 transition-all">
          <Search className="w-4 h-4 text-surface-400 mr-2 shrink-0" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Quick search users, courses, dues"
            className="w-full bg-transparent text-xs text-surface-900 dark:text-surface-100 focus:outline-none placeholder:text-surface-400 dark:placeholder:text-surface-500"
          />
          <kbd className="hidden sm:inline-block rounded-md border border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 text-[10px] font-semibold text-surface-500 select-none">
            Enter
          </kbd>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Role Badge (Solid blue pill e.g. "HOD") with role switcher support */}
        <div ref={roleDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => hasMultipleRoles && setRoleMenuOpen(!roleMenuOpen)}
            className={`inline-flex items-center gap-1 bg-primary-600 text-white font-bold text-xs px-3.5 py-1 rounded-full shadow-sm transition-opacity ${
              hasMultipleRoles ? 'hover:opacity-90 cursor-pointer' : 'cursor-default'
            }`}
            title={hasMultipleRoles ? 'Switch Role' : `Role: ${roleLabel}`}
          >
            <span>{roleLabel}</span>
            {hasMultipleRoles && <ChevronDown className="w-3 h-3 ml-0.5" />}
          </button>

          {roleMenuOpen && hasMultipleRoles && (
            <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-scale-in">
              <div className="px-3 py-1.5 border-b border-surface-100 dark:border-surface-800 text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                Switch Role
              </div>
              {userRoles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    switchRole(r);
                    setRoleMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-xs font-medium text-left flex items-center justify-between transition-colors ${
                    activeRole === r
                      ? 'bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 font-bold'
                      : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800'
                  }`}
                >
                  <span className="capitalize">{r.replace('_', ' ')}</span>
                  {activeRole === r && <span className="w-1.5 h-1.5 rounded-full bg-primary-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle (Circular outline button with Sun/Moon) */}
        <button
          onClick={toggle}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          aria-label="Toggle theme"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications (Bell with red unread count badge e.g. "2") */}
        <NotificationBell />

        {/* Admin Profile Avatar & Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white text-xs font-bold shadow-sm hover:opacity-95 transition-opacity"
            aria-label="Admin profile menu"
          >
            {user?.avatar ? (
              <img
                src={getMediaUrl(user.avatar) ?? undefined}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              initials
            )}
            {/* Online indicator */}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-surface-900" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-[280px] bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-scale-in">
              {/* Header */}
              <div className="bg-primary-600 p-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white text-primary-600 text-xs font-bold flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                    {user?.avatar ? (
                      <img
                        src={getMediaUrl(user.avatar) ?? undefined}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate leading-tight">
                      {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Administrator'}
                    </h4>
                    <p className="text-[11px] text-blue-100 truncate mt-0.5">
                      {activeRole === 'hod' ? 'Head of Department' : 'Department Admin'}
                    </p>
                    <p className="text-[10px] text-blue-200 truncate mt-0.5">
                      {department?.name || 'Dept. of Computer Eng.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Admin Menu Links */}
              <div className="px-2 py-2 space-y-0.5 border-b border-surface-100 dark:border-surface-800">
                <Link
                  to={departmentAdminPath(urlCode, '/admin/profile')}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                >
                  <User className="w-4 h-4 text-surface-400" />
                  <span>Admin Profile</span>
                </Link>

                <Link
                  to={departmentAdminPath(urlCode, '/admin')}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                >
                  <Wrench className="w-4 h-4 text-surface-400" />
                  <span>Admin Dashboard</span>
                </Link>

                <Link
                  to={departmentAdminPath(urlCode, '/admin/users')}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                >
                  <Users className="w-4 h-4 text-surface-400" />
                  <span>User Directory</span>
                </Link>

                <Link
                  to={departmentAdminPath(urlCode, '/admin/course-hub')}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-surface-400" />
                  <span>Course Hub</span>
                </Link>

                <Link
                  to={departmentAdminPath(urlCode, '/admin/crf-signing')}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                >
                  <FileSignature className="w-4 h-4 text-surface-400" />
                  <span>CRF Signatures</span>
                </Link>

                <Link
                  to={departmentAdminPath(urlCode, '/admin/profile?tab=preferences')}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                >
                  <SlidersHorizontal className="w-4 h-4 text-surface-400" />
                  <span>Preferences</span>
                </Link>
              </div>

              {/* Appearance */}
              <div className="px-4 py-2 border-b border-surface-100 dark:border-surface-800">
                <span className="text-[10px] font-bold tracking-wider text-surface-400 dark:text-surface-500 uppercase block mb-1.5">
                  APPEARANCE
                </span>
                <div className="p-1 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center border border-surface-200/60 dark:border-surface-700/60 gap-1">
                  <button
                    type="button"
                    onClick={() => setMode('light')}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs flex items-center justify-center gap-1 transition-all ${
                      mode === 'light'
                        ? 'bg-primary-600 text-white font-semibold shadow-sm'
                        : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Light</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('dark')}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs flex items-center justify-center gap-1 transition-all ${
                      mode === 'dark'
                        ? 'bg-primary-600 text-white font-semibold shadow-sm'
                        : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Dark</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('system')}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs flex items-center justify-center gap-1 transition-all ${
                      mode === 'system'
                        ? 'bg-primary-600 text-white font-semibold shadow-sm'
                        : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Auto</span>
                  </button>
                </div>
              </div>

              {/* Sign out */}
              <div className="px-4 py-2.5">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-2 text-xs font-semibold text-danger-500 hover:text-danger-600 transition-colors w-full text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
