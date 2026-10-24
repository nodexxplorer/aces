import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Search, Sun, Moon, LogOut, Menu, ScanLine, User, QrCode, CreditCard, HelpCircle, Monitor } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDarkMode } from '../../hooks/useDarkMode';
import RoleSwitcher from '../ui/RoleSwitcher';
import { useMultiRole } from '../../hooks/useMultiRole';
import NotificationBell from '../notifications/NotificationBell';
import { getMediaUrl } from '../../api/client';
import { useSearch } from '../../hooks/useSearch';
import { useRBAC } from '../../hooks/useRBAC';
import { useProfilePath } from '../../hooks/useDashboardPath';

interface NavbarProps {
  onMenuClick?: () => void;
}

const Navbar = ({ onMenuClick }: NavbarProps) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { mode, setMode, toggle, isDark } = useDarkMode();
  const { setQuery } = useSearch();
  const { activeRole } = useRBAC();
  // A student who also holds another role (e.g. class rep) needs the switcher to reach it.
  const { hasMultipleRoles } = useMultiRole();
  const profilePath = useProfilePath();
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
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-surface-900/80 backdrop-blur border-b border-surface-200 dark:border-surface-800 flex items-center justify-between px-3 md:px-6 transition-colors duration-200">
      {/* Mobile Header: Hamburger + "Dashboard" Title */}
      <div className="flex items-center gap-3 md:hidden">
        <button
          onClick={onMenuClick}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-transparent text-[var(--text)] transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>
        <span className="text-lg font-bold text-[var(--text)]">Dashboard</span>
      </div>

      {/* Desktop Search Bar: Search courses, payments, messages + Enter shortcut */}
      <div className="hidden md:flex items-center flex-1 max-w-sm">
        <div className="relative flex items-center w-full px-3.5 py-1.5 rounded-xl border border-[var(--border)] bg-transparent dark:bg-[#16181d] focus-within:border-[var(--primary)] focus-within:ring-1 focus-within:ring-[var(--primary)] transition-all">
          <Search className="w-4 h-4 text-[var(--text-muted)] mr-2 shrink-0" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search courses, payments, messages"
            className="w-full bg-transparent text-xs text-[var(--text)] focus:outline-none placeholder:text-[var(--text-muted)]"
          />
          <kbd className="hidden sm:inline-block rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)] select-none">
            Enter
          </kbd>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Mobile: Notification Bell & Theme Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          {hasMultipleRoles && <RoleSwitcher />}
          <NotificationBell />
          <button
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Desktop: Theme Toggle, Messages, Notifications, Profile (Exact match to mockup) */}
        <div className="hidden md:flex items-center gap-2.5">
          {(!isStudent || hasMultipleRoles) && <RoleSwitcher />}

          <button
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
            aria-label="Toggle theme"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <Link
            to="/i/scan"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
            title="QR Scanner"
          >
            <ScanLine className="w-5 h-5" />
          </Link>

          <NotificationBell />

          <div ref={dropdownRef} className="relative ml-0.5">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#1a66d6] text-white text-xs font-bold shadow-sm hover:opacity-95 transition-opacity"
              aria-label="User profile"
            >
              {user?.avatar ? (
                <img
                  src={getMediaUrl(user.avatar) ?? undefined}
                  alt=""
                  className="w-full h-full rounded-full object-cover"
                />
              ) : user?.firstName ? (
                user.firstName.charAt(0).toUpperCase()
              ) : (
                'F'
              )}
              {/* Online indicator badge */}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#16181d]" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-[300px] sm:w-[320px] bg-white dark:bg-[#181a20] border border-slate-200/90 dark:border-[#22252b] rounded-2xl shadow-2xl z-50 overflow-hidden animate-scale-in">
                {/* ── Top Vibrant Blue Banner ── */}
                <div className="bg-[#1d68ec] p-4 text-white flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-full bg-white text-[#1d68ec] text-sm font-bold flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                    {user?.avatar ? (
                      <img
                        src={getMediaUrl(user.avatar) ?? undefined}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : user?.firstName ? (
                      `${user.firstName.charAt(0)}${user.lastName ? user.lastName.charAt(0) : ''}`.toUpperCase()
                    ) : (
                      '?'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate leading-tight">
                      {user?.firstName
                        ? `${user.firstName} ${user.lastName || ''}`.trim()
                        : user?.fullName || user?.full_name || 'Student'}
                    </h4>
                    <p className="text-[11px] text-blue-100/90 truncate mt-0.5">{user?.email || '—'}</p>
                    <div className="inline-block border border-white/30 bg-white/15 px-2.5 py-0.5 rounded-full mt-1.5">
                      <span className="text-[10px] font-semibold text-white tracking-wide">
                        {isStudent ? 'Student' : user?.activeRole || 'Student'} ·{' '}
                        {user?.matricNumber || user?.matric_number || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Profile Strength ── */}
                <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-100 dark:border-slate-800/60">
                  {(() => {
                    const fields = [
                      user?.firstName,
                      user?.lastName,
                      user?.email,
                      user?.matricNumber || user?.matric_number,
                      user?.phone,
                      user?.avatar,
                      // user?.bio,
                      user?.level,
                    ];
                    const filled = fields.filter(Boolean).length;
                    const strength = Math.min(100, Math.max(40, Math.round((filled / fields.length) * 100)));
                    return (
                      <>
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800 dark:text-slate-200">Profile strength</span>
                          <span className="text-[#1d68ec] dark:text-[#3b82f6]">{strength}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#1d68ec] transition-all duration-300"
                            style={{ width: `${strength}%` }}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* ── Menu Items ── */}
                <div className="px-2 py-2 space-y-0.5">
                  <Link
                    to={profilePath}
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                    <span>My profile</span>
                  </Link>

                  <div className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <Link
                      to={profilePath}
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 flex-1"
                    >
                      <QrCode className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                      <span>Academic ID</span>
                    </Link>
                    <Link
                      to={profilePath}
                      onClick={() => setProfileOpen(false)}
                      className="text-[11px] font-semibold text-[#1d68ec] dark:text-[#3b82f6] hover:underline"
                    >
                      Show QR
                    </Link>
                  </div>

                  <Link
                    to="/i/payments"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <CreditCard className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                    <span>Payments & dues</span>
                  </Link>

                  <Link
                    to="/i/complaints"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <HelpCircle className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                    <span>Help & support</span>
                  </Link>
                </div>

                {/* ── Appearance Segmented Pill ── */}
                <div className="px-4 pt-1 pb-1">
                  <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase block mb-1.5">
                    APPEARANCE
                  </span>
                  <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center border border-slate-200/60 dark:border-slate-700/60 gap-1 mb-2">
                    <button
                      type="button"
                      onClick={() => setMode('light')}
                      className={`flex-1 py-1 px-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all ${
                        mode === 'light'
                          ? 'bg-[#1d68ec] text-white font-semibold shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('dark')}
                      className={`flex-1 py-1 px-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all ${
                        mode === 'dark'
                          ? 'bg-[#1d68ec] text-white font-semibold shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('system')}
                      className={`flex-1 py-1 px-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all ${
                        mode === 'system'
                          ? 'bg-[#1d68ec] text-white font-semibold shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>Auto</span>
                    </button>
                  </div>
                </div>

                {/* ── Sign out ── */}
                <div className="border-t border-slate-100 dark:border-slate-800/80 px-4 py-2.5">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                    }}
                    className="flex items-center gap-2 text-xs font-semibold text-red-500 hover:text-red-600 transition-colors w-full text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
