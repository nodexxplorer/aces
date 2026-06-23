import { NavLink } from 'react-router-dom';
import { useRBAC } from '../../hooks/useRBAC';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../utils/cn';
import {
  LayoutDashboard, BookOpen, CreditCard, FileText, HelpCircle,
  Calendar, User, BookMarked, Users, Award, ShieldAlert,
  Settings, Briefcase, GraduationCap, DollarSign, Database,
  TrendingUp, ClipboardList, Printer, MessageSquare, ListTodo
} from 'lucide-react';
import type { UserRole } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

interface MenuItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
}

const menuItems: MenuItem[] = [
  // Shared
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },

  // Student specific
  { label: 'My Results', path: '/results', icon: Award, roles: ['student'] },
  { label: 'Payments & Dues', path: '/payments', icon: CreditCard, roles: ['student'] },
  { label: 'Course Registration', path: '/courses/register', icon: BookMarked, roles: ['student'] },
  { label: 'Transcripts', path: '/transcripts', icon: FileText, roles: ['student'] },
  { label: 'Manuals Marketplace', path: '/manuals', icon: BookOpen, roles: ['student'] },
  { label: 'Practicals & Lab', path: '/practicals', icon: ClipboardList, roles: ['student'] },
  { label: 'Timetable', path: '/timetable', icon: Calendar, roles: ['student'] },
  { label: 'Complaints', path: '/complaints', icon: HelpCircle, roles: ['student'] },

  // Lecturer specific
  { label: 'Lecturer Portal', path: '/lecturer', icon: LayoutDashboard, roles: ['lecturer'] },
  { label: 'Enter Scores', path: '/lecturer/scores', icon: ClipboardList, roles: ['lecturer'] },
  { label: 'Bulk Upload', path: '/lecturer/bulk-upload', icon: Database, roles: ['lecturer'] },
  { label: 'Manage Assignments', path: '/lecturer/assignments', icon: ListTodo, roles: ['lecturer'] },
  { label: 'Class List', path: '/lecturer/class-list', icon: Users, roles: ['lecturer'] },

  // Class Rep specific
  { label: 'Class Rep Portal', path: '/class-rep', icon: LayoutDashboard, roles: ['class_rep'] },
  { label: 'Track Attendance', path: '/class-rep/attendance', icon: ClipboardList, roles: ['class_rep'] },
  { label: 'Submit Assignments', path: '/class-rep/assignments', icon: ListTodo, roles: ['class_rep'] },
  { label: 'Pending Registrations', path: '/class-rep/pending', icon: ShieldAlert, roles: ['class_rep'] },

  // Bursar specific
  { label: 'Bursar Portal', path: '/bursar', icon: LayoutDashboard, roles: ['class_bursar', 'dept_bursar'] },
  { label: 'Verify Payments', path: '/bursar/verify', icon: DollarSign, roles: ['class_bursar', 'dept_bursar'] },
  { label: 'Defaulters List', path: '/bursar/defaulters', icon: ShieldAlert, roles: ['class_bursar', 'dept_bursar'] },

  // Admin specific
  { label: 'Admin Portal', path: '/admin', icon: LayoutDashboard, roles: ['hod', 'delegated_admin'] },
  { label: 'Results Approval', path: '/admin/results', icon: ClipboardList, roles: ['hod', 'delegated_admin'] },
  { label: 'User Directory', path: '/admin/users', icon: Users, roles: ['hod', 'delegated_admin'] },
  { label: 'Dues & Sessions', path: '/admin/sessions', icon: Settings, roles: ['hod', 'delegated_admin'] },
  { label: 'Print Queue', path: '/admin/print-queue', icon: Printer, roles: ['hod', 'delegated_admin'] },
  { label: 'Backups', path: '/admin/backups', icon: Database, roles: ['hod', 'delegated_admin'] },

  // Campus Connect
  { label: 'Campus Connect', path: '/connect', icon: MessageSquare },
  { label: 'Skills & Trade', path: '/skills', icon: TrendingUp },

  // Alumni Hub
  { label: 'Alumni Portal', path: '/alumni', icon: GraduationCap, roles: ['alumni', 'hod', 'delegated_admin'] },
  { label: 'Job Board', path: '/alumni/jobs', icon: Briefcase, roles: ['alumni', 'hod', 'delegated_admin'] },
  { label: 'Mentorship Hub', path: '/alumni/mentorship', icon: Users, roles: ['alumni', 'hod', 'delegated_admin'] },
  { label: 'Give Back', path: '/alumni/give-back', icon: DollarSign, roles: ['alumni', 'hod', 'delegated_admin'] },

  // Settings
  { label: 'Profile', path: '/profile', icon: User },
];

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { activeRole } = useRBAC();
  const { logout } = useAuth();

  const filteredItems = menuItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(activeRole);
  });

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden transition-opacity duration-200',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-40 w-64 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 transition-transform duration-200 ease-in-out md:translate-x-0 flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-16 flex items-center px-6 border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-2">
            <img src="/aces-logo.png" alt="Aces Logo" className="w-8 h-8 rounded-lg object-contain shadow-md" />
            <span className="font-bold text-lg text-surface-900 dark:text-white tracking-wide">ACES ZONE</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1 scrollbar-thin">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150',
                    isActive
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/20 dark:text-primary-400'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100'
                  )
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-4 border-t border-surface-200 dark:border-surface-800">
          <button
            onClick={() => {
              logout();
              if (onClose) onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-950/20 rounded-xl transition-all"
          >
            <ShieldAlert className="w-5 h-5 shrink-0" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
