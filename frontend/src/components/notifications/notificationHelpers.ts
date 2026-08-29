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
} from 'lucide-react';

const categoryConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> =
  {
    auth: { icon: Shield, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    result: { icon: Award, color: 'text-green-500', bg: 'bg-green-500/10' },
    due: { icon: CreditCard, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    message: { icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    connect: { icon: Users, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    skill: { icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    alumni: { icon: GraduationCap, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    approval: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    announcement: { icon: Megaphone, color: 'text-red-500', bg: 'bg-red-500/10' },
    system: { icon: Settings, color: 'text-surface-500', bg: 'bg-surface-500/10' },
    general: { icon: Bell, color: 'text-surface-500', bg: 'bg-surface-500/10' },
    course: { icon: BookMarked, color: 'text-teal-500', bg: 'bg-teal-500/10' },
  };

export function getCategoryConfig(category: string) {
  return categoryConfig[category] || categoryConfig.general;
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
