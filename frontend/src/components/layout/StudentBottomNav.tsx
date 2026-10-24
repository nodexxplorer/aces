import { NavLink } from 'react-router-dom';
import { Home, BookMarked, CreditCard, MessageSquare, User } from 'lucide-react';
import { cn } from '../../utils/cn';

interface StudentBottomNavProps {
  unreadCount?: number;
}

export default function StudentBottomNav({ unreadCount = 1 }: StudentBottomNavProps) {
  const navItems = [
    { label: 'Home', path: '/i/dashboard', icon: Home },
    { label: 'Courses', path: '/i/courses', icon: BookMarked },
    { label: 'Pay', path: '/i/payments', icon: CreditCard },
    { label: 'Inbox', path: '/i/communication', icon: MessageSquare, badge: unreadCount > 0 },
    { label: 'Profile', path: '/i/profile', icon: User },
  ];

  return (
    <nav
      aria-label="Student mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[var(--surface)]/95 backdrop-blur-lg border-t border-[var(--border)]/60 px-3 py-2 shadow-lg transition-colors duration-200"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-150',
                  isActive
                    ? 'text-[var(--primary)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon className={cn('w-5 h-5 transition-transform', isActive && 'scale-110')} />
                    {item.badge && (
                      <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--surface)]" />
                    )}
                  </div>
                  <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
