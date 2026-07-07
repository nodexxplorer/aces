import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useRBAC } from '../../hooks/useRBAC';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../utils/cn';
import {
  LayoutDashboard, BookOpen, CreditCard, FileText, HelpCircle,
  Calendar, User, BookMarked, Users, Award, ShieldAlert,
  Settings, Briefcase, GraduationCap, DollarSign, Database,
  TrendingUp, ClipboardList, Printer, MessageSquare, ListTodo,
  ChevronLeft, ChevronDown, LogOut, X, Download
} from 'lucide-react';
import type { UserRole } from '../../types';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

interface MenuItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
}

interface NavSection {
  title: string;
  icon: string;
  key: string;
  items: (MenuItem & { icon: React.ComponentType<{ className?: string }> })[];
  locked?: boolean;
  lockMessage?: string;
  roles?: UserRole[];
}

const menuItems: MenuItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },

  { label: 'My Results', path: '/results', icon: Award, roles: ['student'] },
  { label: 'Course Registration', path: '/courses/register', icon: BookMarked, roles: ['student'] },
  { label: 'Transcripts', path: '/transcripts', icon: FileText, roles: ['student'] },
  { label: 'Practicals & Lab', path: '/practicals', icon: ClipboardList, roles: ['student'] },
  { label: 'Timetable', path: '/timetable', icon: Calendar, roles: ['student'] },
  { label: 'Manuals Marketplace', path: '/manuals', icon: BookOpen, roles: ['student'] },
  { label: 'Complaints', path: '/complaints', icon: HelpCircle, roles: ['student'] },

  { label: 'Payments & Dues', path: '/payments', icon: CreditCard, roles: ['student'] },

  { label: 'Campus Connect', path: '/connect', icon: MessageSquare },
  { label: 'Skills & Trade', path: '/skills', icon: TrendingUp },

  { label: 'Alumni Portal', path: '/alumni', icon: GraduationCap, roles: ['student', 'alumni', 'hod', 'delegated_admin'] },
  { label: 'Job Board', path: '/alumni/jobs', icon: Briefcase, roles: ['alumni', 'hod', 'delegated_admin'] },
  { label: 'Mentorship Hub', path: '/alumni/mentorship', icon: Users, roles: ['alumni', 'hod', 'delegated_admin'] },
  { label: 'Give Back', path: '/alumni/give-back', icon: DollarSign, roles: ['alumni', 'hod', 'delegated_admin'] },

  { label: 'Lecturer Portal', path: '/lecturer', icon: LayoutDashboard, roles: ['lecturer'] },
  { label: 'Enter Scores', path: '/lecturer/scores', icon: ClipboardList, roles: ['lecturer'] },
  { label: 'Bulk Upload', path: '/lecturer/bulk-upload', icon: Database, roles: ['lecturer'] },
  { label: 'Manage Assignments', path: '/lecturer/assignments', icon: ListTodo, roles: ['lecturer'] },
  { label: 'Class List', path: '/lecturer/class-list', icon: Users, roles: ['lecturer'] },

  { label: 'Class Rep Portal', path: '/class-rep', icon: LayoutDashboard, roles: ['class_rep'] },
  { label: 'Track Attendance', path: '/class-rep/attendance', icon: ClipboardList, roles: ['class_rep'] },
  { label: 'Submit Assignments', path: '/class-rep/assignments', icon: ListTodo, roles: ['class_rep'] },
  { label: 'Pending Registrations', path: '/class-rep/pending', icon: ShieldAlert, roles: ['class_rep'] },

  { label: 'Bursar Portal', path: '/bursar', icon: LayoutDashboard, roles: ['class_bursar', 'dept_bursar'] },
  { label: 'Verify Payments', path: '/bursar/verify', icon: DollarSign, roles: ['class_bursar', 'dept_bursar'] },
  { label: 'Defaulters List', path: '/bursar/defaulters', icon: ShieldAlert, roles: ['class_bursar', 'dept_bursar'] },

  { label: 'Admin Portal', path: '/admin', icon: LayoutDashboard, roles: ['hod', 'delegated_admin'] },
  { label: 'Results Approval', path: '/admin/results', icon: ClipboardList, roles: ['hod', 'delegated_admin'] },
  { label: 'User Directory', path: '/admin/users', icon: Users, roles: ['hod', 'delegated_admin'] },
  { label: 'Dues & Sessions', path: '/admin/sessions', icon: Settings, roles: ['hod', 'delegated_admin'] },
  { label: 'Print Queue', path: '/admin/print-queue', icon: Printer, roles: ['hod', 'delegated_admin'] },
  { label: 'Download Vault', path: '/manuals/my', icon: Download, roles: ['hod', 'delegated_admin'] },
  { label: 'Backups', path: '/admin/backups', icon: Database, roles: ['hod', 'delegated_admin'] },

  { label: 'Profile', path: '/profile', icon: User },
];

const mobileSections: NavSection[] = [
  {
    title: 'ACADEMICS',
    icon: '\u{1F4DA}',
    key: 'academics',
    roles: ['student'],
    items: [
      { label: 'My Results', path: '/results', icon: Award },
      { label: 'Course Registration', path: '/courses/register', icon: BookMarked },
      { label: 'Transcripts', path: '/transcripts', icon: FileText },
      { label: 'Practicals & Lab', path: '/practicals', icon: ClipboardList },
      { label: 'Timetable', path: '/timetable', icon: Calendar },
      { label: 'Manuals Marketplace', path: '/manuals', icon: BookOpen },
    ],
  },
  {
    title: 'COMMUNITY',
    icon: '\u{1F4AC}',
    key: 'community',
    items: [
      { label: 'Campus Connect', path: '/connect', icon: MessageSquare },
      { label: 'Skills & Trade', path: '/skills', icon: TrendingUp },
    ],
  },
  {
    title: 'FINANCE',
    icon: '\u{1F4B3}',
    key: 'finance',
    roles: ['student'],
    items: [
      { label: 'Payments & Dues', path: '/payments', icon: CreditCard },
    ],
  },
  {
    title: 'ALUMNI',
    icon: '\u{1F393}',
    key: 'alumni',
    locked: true,
    lockMessage: 'Available for graduates (Year 5+)',
    items: [
      { label: 'Alumni Portal', path: '/alumni', icon: GraduationCap },
    ],
  },
];

const Sidebar = ({ collapsed, onToggleCollapse, mobileOpen, onMobileClose }: SidebarProps) => {
  const { activeRole } = useRBAC();
  const { user, logout } = useAuth();
  const [expandedSections, setExpandedSections] = useState<string[]>(['academics']);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const filteredItems = menuItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(activeRole);
  });

  const isAlumni = user?.roles.includes('alumni');

  return (
    <>
      {/* ─── Mobile overlay backdrop ─── */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden transition-opacity duration-200',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onMobileClose}
      />

      {/* ─── Mobile drawer ─── */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 z-50 w-80 bg-white dark:bg-surface-900 shadow-2xl md:hidden flex flex-col transition-transform duration-300 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-2">
            <img src="/aces-logo.png" alt="Aces Logo" className="w-8 h-8 rounded-lg object-contain shadow-md" />
            <span className="font-bold text-lg text-surface-900 dark:text-white tracking-wide">ACES ZONE</span>
          </div>
          <button
            onClick={onMobileClose}
            className="p-2 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile user profile */}
        {user && (
          <div className="px-4 py-4 border-b border-surface-100 dark:border-surface-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400 capitalize">{activeRole.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Mobile navigation */}
        <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
          {/* Dashboard (always visible) */}
          <NavLink
            to="/dashboard"
            onClick={onMobileClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 mx-2 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/20 dark:text-primary-400'
                  : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800'
              )
            }
          >
            <LayoutDashboard className="w-5 h-5 shrink-0" />
            Dashboard
          </NavLink>

          {/* Collapsible sections */}
          {mobileSections.map((section) => {
            const hasAccess = !section.roles || section.roles.some((r) => user?.roles.includes(r));
            const isExpanded = expandedSections.includes(section.key);
            const showLocked = section.locked && !isAlumni;

            if (!hasAccess && !section.locked) return null;

            return (
              <div key={section.key} className="mt-1">
                <button
                  onClick={() => {
                    if (showLocked) return;
                    toggleSection(section.key);
                  }}
                  className={cn(
                    'flex items-center justify-between w-full px-4 py-2.5 mx-2 text-xs font-semibold uppercase tracking-widest rounded-lg transition-colors',
                    showLocked
                      ? 'text-surface-400 dark:text-surface-600 cursor-default'
                      : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base">{section.icon}</span>
                    {section.title}
                    {showLocked && (
                      <span className="text-[10px] uppercase tracking-wider text-surface-400 dark:text-surface-500 ml-1 px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800">
                        Locked
                      </span>
                    )}
                  </span>
                  {!showLocked && (
                    <ChevronDown
                      className={cn('w-4 h-4 transition-transform duration-200', isExpanded && 'rotate-180')}
                    />
                  )}
                </button>

                {isExpanded && !showLocked && (
                  <div className="ml-6 pl-2 border-l-2 border-surface-200 dark:border-surface-700 space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          onClick={onMobileClose}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                              isActive
                                ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/20 dark:text-primary-400'
                                : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-800 dark:hover:text-surface-200'
                            )
                          }
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          {item.label}
                        </NavLink>
                      );
                    })}
                    {section.locked && (
                      <p className="px-3 py-2 text-xs text-surface-400 dark:text-surface-500 italic">
                        {section.lockMessage}
                      </p>
                    )}
                  </div>
                )}

                {showLocked && (
                  <div className="ml-6 pl-2 border-l-2 border-surface-200 dark:border-surface-700 ml-6 pl-2">
                    <p className="px-3 py-2 text-xs text-surface-400 dark:text-surface-500 italic">
                      {section.lockMessage}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Mobile footer */}
        <div className="border-t border-surface-200 dark:border-surface-800 px-4 py-3 space-y-1">
          <NavLink
            to="/profile"
            onClick={onMobileClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/20 dark:text-primary-400'
                  : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800'
              )
            }
          >
            <Settings className="w-5 h-5 shrink-0" />
            Settings
          </NavLink>
          <button
            onClick={() => {
              logout();
              onMobileClose();
            }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-950/20 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      {/* ─── Desktop sidebar (in-flow) ─── */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-white/95 dark:bg-surface-900/95 backdrop-blur-xl border-r border-surface-200 dark:border-surface-800 transition-all duration-300 ease-out shadow-2xl',
          'relative h-full',
          'w-16', !collapsed && 'md:w-72'
        )}
      >
        <div className={cn('h-16 flex items-center justify-center border-b border-surface-200 dark:border-surface-800', !collapsed && 'md:justify-start md:px-6')}>
          <div className={cn('flex items-center', !collapsed ? 'md:gap-2' : 'flex-col')}>
            <img src="/aces-logo.png" alt="Aces Logo" className="w-8 h-8 rounded-lg object-contain shadow-md" />
            {!collapsed && <span className="hidden md:block font-bold text-lg text-surface-900 dark:text-white tracking-wide">ACES ZONE</span>}
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 scrollbar-thin">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-center mx-1.5 p-2.5 rounded-xl transition-all duration-150',
                    !collapsed && 'md:gap-3 md:px-3 md:py-2.5 md:mx-2 md:text-sm md:font-medium md:justify-start',
                    isActive
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/20 dark:text-primary-400'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100'
                  )
                }
                title={item.label}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="hidden md:inline">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>
        <div className={cn('border-t border-surface-200 dark:border-surface-800', 'p-1.5', !collapsed && 'md:p-4')}>
          <button
            onClick={onToggleCollapse}
            className={cn(
              'hidden md:flex items-center w-full justify-center p-2.5 rounded-xl transition-all duration-150 mb-1 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800',
              !collapsed && 'md:gap-3 md:px-3 md:py-2.5 md:text-sm md:font-medium'
            )}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronLeft className={cn('w-4 h-4 shrink-0 transition-transform', collapsed && 'rotate-180')} />
            {!collapsed && <span className="hidden md:inline">Collapse</span>}
          </button>
          <button
            onClick={() => logout()}
            className={cn(
              'flex items-center w-full justify-center p-2.5 rounded-xl transition-all duration-150 text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-950/20',
              !collapsed && 'md:gap-3 md:px-3 md:py-2.5 md:text-sm md:font-medium'
            )}
            title="Logout"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="hidden md:inline">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
