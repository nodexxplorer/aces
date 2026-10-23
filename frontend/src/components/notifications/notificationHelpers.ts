import {
  Shield,
  Award,
  CreditCard,
  MessageSquare,
  Users,
  TrendingUp,
  GraduationCap,
  CheckCircle,
  Megaphone,
  Settings,
  Bell,
  BookMarked,
  User,
  Mail,
} from 'lucide-react';

const categoryConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> =
  {
    auth: { icon: Shield, color: 'text-[#1d68ec] dark:text-[#3b82f6]', bg: 'bg-[#eff5ff] dark:bg-[#1a2333]' },
    account: { icon: User, color: 'text-[#1d68ec] dark:text-[#3b82f6]', bg: 'bg-[#eff5ff] dark:bg-[#1a2333]' },
    profile: { icon: User, color: 'text-[#1d68ec] dark:text-[#3b82f6]', bg: 'bg-[#eff5ff] dark:bg-[#1a2333]' },
    user: { icon: User, color: 'text-[#1d68ec] dark:text-[#3b82f6]', bg: 'bg-[#eff5ff] dark:bg-[#1a2333]' },
    result: { icon: Award, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    due: { icon: CreditCard, color: 'text-[#1d68ec] dark:text-[#3b82f6]', bg: 'bg-[#eff5ff] dark:bg-[#1a2333]' },
    payment: { icon: CreditCard, color: 'text-[#1d68ec] dark:text-[#3b82f6]', bg: 'bg-[#eff5ff] dark:bg-[#1a2333]' },
    message: { icon: MessageSquare, color: 'text-[#1d68ec] dark:text-[#3b82f6]', bg: 'bg-[#eff5ff] dark:bg-[#1a2333]' },
    chat: { icon: MessageSquare, color: 'text-[#1d68ec] dark:text-[#3b82f6]', bg: 'bg-[#eff5ff] dark:bg-[#1a2333]' },
    email: { icon: Mail, color: 'text-[#1d68ec] dark:text-[#3b82f6]', bg: 'bg-[#eff5ff] dark:bg-[#1a2333]' },
    connect: { icon: Users, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-950/30' },
    skill: { icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30' },
    alumni: { icon: GraduationCap, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
    approval: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    announcement: { icon: Megaphone, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
    system: { icon: Settings, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' },
    general: { icon: Bell, color: 'text-[#1d68ec] dark:text-[#3b82f6]', bg: 'bg-[#eff5ff] dark:bg-[#1a2333]' },
    course: { icon: BookMarked, color: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-950/30' },
  };

export function getCategoryConfig(category?: string) {
  if (!category) return categoryConfig.general;
  const lower = category.toLowerCase();
  return categoryConfig[lower] || categoryConfig.general;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
