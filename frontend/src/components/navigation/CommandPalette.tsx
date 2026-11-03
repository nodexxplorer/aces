import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  BookOpen,
  FileSignature,
  CreditCard,
  User,
  Settings,
  HelpCircle,
  Shield,
  FileText,
  Home,
  X,
  Keyboard,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useRBAC } from '../../hooks/useRBAC';
import { tenantPath, isAdminArea } from '../../config/departmentAdminPaths';

interface NavItem {
  id: string;
  title: string;
  category: 'Academics' | 'Finance' | 'General' | 'Account' | 'Legal';
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  roles?: string[];
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeRole } = useRBAC();

  const urlCode = user?.tenant?.urlCode;
  const isStaff = activeRole === 'lecturer';
  const isAdmin =
    isAdminArea(location.pathname) ||
    activeRole === 'hod' ||
    activeRole === 'admin' ||
    activeRole === 'delegated_admin';

  // Available navigation destinations based on role
  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      {
        id: 'home',
        title: 'Dashboard',
        category: 'General',
        path: isAdmin
          ? tenantPath(urlCode, '/admin/dashboard')
          : isStaff
            ? tenantPath(urlCode, '/l/dashboard')
            : '/i/dashboard',
        icon: Home,
        description: 'View overview and departmental status',
      },
      {
        id: 'courses',
        title: 'Courses',
        category: 'Academics',
        path: isStaff ? tenantPath(urlCode, '/l/class-list') : '/i/courses',
        icon: BookOpen,
        description: 'Course registration and course lists',
      },
      {
        id: 'crf',
        title: 'Course Form Signing',
        category: 'Academics',
        path: '/i/course-form-signing',
        icon: FileSignature,
        description: 'Sign and download your stamped course registration form',
        roles: ['student'],
      },
      {
        id: 'dues',
        title: 'Dues & Payments',
        category: 'Finance',
        path: '/i/payments',
        icon: CreditCard,
        description: 'Pay departmental dues and view payment receipts',
        roles: ['student'],
      },
      {
        id: 'profile',
        title: 'My Profile & Danger Zone',
        category: 'Account',
        path: isAdmin
          ? tenantPath(urlCode, '/admin/profile')
          : isStaff
            ? tenantPath(urlCode, '/l/profile')
            : '/i/profile',
        icon: User,
        description: 'Manage personal details, security, and account settings',
      },
      {
        id: 'notifications',
        title: 'Notification & Email Settings',
        category: 'Account',
        path: '/settings/notifications',
        icon: Settings,
        description: 'Manage email digests, push notifications, and topics',
      },
      {
        id: 'support',
        title: 'Support & Help Desk',
        category: 'General',
        path: '/support',
        icon: HelpCircle,
        description: 'Contact departmental coordinators and read FAQs',
      },
      {
        id: 'privacy',
        title: 'Privacy Policy',
        category: 'Legal',
        path: '/privacy-policy',
        icon: Shield,
        description: 'How your academic and identity data is handled',
      },
      {
        id: 'refund',
        title: 'Refund Policy',
        category: 'Legal',
        path: '/refund-policy',
        icon: FileText,
        description: 'Policy regarding dues and course form payments',
      },
    ];

    return items.filter((item) => {
      if (!item.roles) return true;
      if (item.roles.includes('student') && (isAdmin || isStaff)) return false;
      return true;
    });
  }, [urlCode, isAdmin, isStaff]);

  // Filter items based on user search query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)),
    );
  }, [navItems, query]);

  // Global keydown listener for Ctrl+K, Cmd+K, and '?'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Command Palette with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setQuery('');
        setSelectedIndex(0);
        return;
      }

      // If user presses '?' when not focused on an input/textarea/select
      if (
        e.key === '?' &&
        !isOpen &&
        !showShortcutsModal &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')
      ) {
        e.preventDefault();
        setShowShortcutsModal(true);
        return;
      }

      // Close on Escape
      if (e.key === 'Escape') {
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
        } else if (showShortcutsModal) {
          e.preventDefault();
          setShowShortcutsModal(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showShortcutsModal]);

  // Reset selected index when query results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation within command palette
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filtered.length === 0 ? 0 : (prev + 1) % filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (filtered.length === 0 ? 0 : (prev - 1 + filtered.length) % filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex]);
      }
    }
  };

  const handleSelect = (item: NavItem) => {
    setIsOpen(false);
    navigate(item.path);
  };

  return (
    <>
      {/* ─── COMMAND PALETTE MODAL ─── */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quick navigation search"
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-[#20232e]">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search pages or type a command... (Press Esc to close)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1f222e]"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results List */}
            <div
              ref={listRef}
              className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-50 dark:divide-[#1f222d]/60"
            >
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                  No destinations found matching &quot;{query}&quot;
                </div>
              ) : (
                filtered.map((item, idx) => {
                  const Icon = item.icon;
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/30 text-[#1d68ec] dark:text-blue-400'
                          : 'text-[var(--text)] hover:bg-slate-50 dark:hover:bg-[#1c1f28]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-blue-500 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-[#20232e] text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold truncate">{item.title}</p>
                          {item.description && (
                            <p className="text-[11px] text-[var(--text-muted)] truncate">{item.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#222530] text-[var(--text-muted)]">
                          {item.category}
                        </span>
                        {isSelected && <ArrowRight className="w-3.5 h-3.5 text-[#1d68ec] dark:text-blue-400" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with Keyboard Hints */}
            <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-[#12141a] border-t border-slate-100 dark:border-[#20232e] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#2b2e3c] bg-white dark:bg-[#1a1c24] text-[10px] font-mono">
                    ↑
                  </kbd>
                  <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#2b2e3c] bg-white dark:bg-[#1a1c24] text-[10px] font-mono">
                    ↓
                  </kbd>{' '}
                  to navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#2b2e3c] bg-white dark:bg-[#1a1c24] text-[10px] font-mono">
                    Enter
                  </kbd>{' '}
                  to select
                </span>
              </div>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#2b2e3c] bg-white dark:bg-[#1a1c24] text-[10px] font-mono">
                  Esc
                </kbd>{' '}
                to exit
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── SHORTCUTS HELP MODAL (triggered by '?') ─── */}
      {showShortcutsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard Shortcuts"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#20232e]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center shrink-0">
                  <Keyboard className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text)]">Keyboard Navigation</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1f222e]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-[var(--text)]">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-[#1f222e]">
                <span>Open command palette / Quick jump</span>
                <kbd className="px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2a2d39] bg-slate-50 dark:bg-[#12141a] font-mono text-[11px] font-semibold text-[#1d68ec]">
                  Ctrl + K / ⌘K
                </kbd>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-[#1f222e]">
                <span>Show keyboard shortcuts</span>
                <kbd className="px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2a2d39] bg-slate-50 dark:bg-[#12141a] font-mono text-[11px] font-semibold">
                  ?
                </kbd>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-[#1f222e]">
                <span>Close modal or menu</span>
                <kbd className="px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2a2d39] bg-slate-50 dark:bg-[#12141a] font-mono text-[11px] font-semibold">
                  Esc
                </kbd>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span>Tab / Shift+Tab</span>
                <span className="text-[var(--text-muted)]">Navigate interactive buttons</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowShortcutsModal(false);
                setIsOpen(true);
              }}
              className="w-full py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Open Quick Jump Palette</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
