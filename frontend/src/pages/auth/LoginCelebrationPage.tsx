import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ChevronRight, GraduationCap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import type { UserRole } from '../../types';

const roleConfig: Record<UserRole, { label: string; color: string }> = {
  student: { label: 'Student', color: 'bg-accent-500/20 text-accent-400 border-accent-500/30' },
  lecturer: { label: 'Lecturer', color: 'bg-secondary-500/20 text-secondary-400 border-secondary-500/30' },
  hod: { label: 'Head of Department', color: 'bg-primary-500/20 text-primary-300 border-primary-500/30' },
  delegated_admin: { label: 'Admin', color: 'bg-primary-500/20 text-primary-300 border-primary-500/30' },
  class_rep: { label: 'Class Representative', color: 'bg-accent-500/20 text-accent-400 border-accent-500/30' },
  class_bursar: { label: 'Class Bursar', color: 'bg-secondary-500/20 text-secondary-400 border-secondary-500/30' },
  dept_bursar: { label: 'Departmental Bursar', color: 'bg-secondary-500/20 text-secondary-400 border-secondary-500/30' },
  alumni: { label: 'Alumni', color: 'bg-primary-500/20 text-primary-300 border-primary-500/30' },
  project_coordinator: { label: 'Project Coordinator', color: 'bg-primary-500/20 text-primary-300 border-primary-500/30' },
  event_coordinator: { label: 'Event Coordinator', color: 'bg-primary-500/20 text-primary-300 border-primary-500/30' },
  alumni_rep: { label: 'Alumni Representative', color: 'bg-primary-500/20 text-primary-300 border-primary-500/30' },
  admin: { label: 'Admin', color: 'bg-primary-500/20 text-primary-300 border-primary-500/30' },
};

const particles = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  size: Math.random() * 6 + 2,
  x: Math.random() * 100,
  y: Math.random() * 100,
  delay: Math.random() * 5,
  duration: Math.random() * 4 + 4,
  color: ['bg-primary-400/30', 'bg-accent-400/30', 'bg-secondary-400/30', 'bg-white/20'][i % 4],
}));

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const LoginCelebrationPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(6);

  const role = user?.activeRole ?? 'student';
  const config = roleConfig[role] ?? roleConfig.student;

  useEffect(() => {
    sessionStorage.removeItem('just_logged_in');
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [countdown, navigate]);

  const initials = useMemo(() => {
    if (!user) return 'A';
    return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'A';
  }, [user]);

  const displayName = useMemo(() => {
    if (!user) return 'aboard';
    const name = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (!name) return user.email;
    if (name.includes('@')) {
      const part = name.split('@')[0];
      return part
        .replace(/[^a-zA-Z]/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
    }
    return name;
  }, [user]);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 select-none">
      {/* Ambient glow blobs */}
      <div className="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary-500/15 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] rounded-full bg-secondary-500/8 blur-[120px] pointer-events-none" />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <div
            key={p.id}
            className={`absolute rounded-full ${p.color}`}
            style={{
              width: p.size,
              height: p.size,
              left: `${p.x}%`,
              top: `${p.y}%`,
              animation: `float ${p.duration}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <motion.div
        className="relative z-10 w-full max-w-md px-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-10 shadow-2xl shadow-primary-900/50"
          variants={itemVariants}
        >
          {/* Top accent bar */}
          <div className="absolute top-0 left-8 right-8 h-1 bg-gradient-to-r from-primary-500 via-accent-500 to-secondary-500 rounded-full" />

          {/* Avatar & Icon */}
          <motion.div className="flex flex-col items-center gap-3 mb-8" variants={itemVariants}>
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center shadow-lg shadow-primary-500/30 animate-pulse-glow">
                <span className="text-2xl font-bold text-white tracking-wide">{initials}</span>
              </div>
              <motion.div
                className="absolute -top-1 -right-1"
                animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Sparkles className="w-6 h-6 text-accent-400" />
              </motion.div>
            </div>
          </motion.div>

          {/* Welcome text */}
          <motion.div className="text-center mb-6" variants={itemVariants}>
            <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">
              Welcome, {displayName}!
            </h1>
            <p className="text-white/50 text-sm">You've successfully signed in to <span className="text-accent-400 font-semibold">ACES Zone</span></p>
          </motion.div>

          {/* Role badge */}
          <motion.div className="flex justify-center mb-8" variants={itemVariants}>
            <div className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-xs font-medium ${config.color}`}>
              <GraduationCap className="w-3.5 h-3.5" />
              {config.label}
            </div>
          </motion.div>

          {/* Decorative divider */}
          <motion.div className="flex items-center gap-3 mb-8" variants={itemVariants}>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="w-2 h-2 rotate-45 border border-white/20" />
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </motion.div>

          {/* Countdown progress */}
          <motion.div className="mb-8" variants={itemVariants}>
            <div className="flex items-center justify-between text-xs text-white/40 mb-2">
              <span>Redirecting to dashboard</span>
              <span>{countdown}s</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary-500 via-accent-500 to-secondary-500 rounded-full"
                initial={{ width: '100%' }}
                animate={{ width: `${(countdown / 6) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>

          {/* Action buttons */}
          <motion.div className="space-y-3" variants={itemVariants}>
            <Button
              className="w-full bg-gradient-to-r from-primary-500 to-accent-600 hover:from-primary-600 hover:to-accent-700 text-white border-0 shadow-lg shadow-primary-500/25"
              size="lg"
              rightIcon={<ChevronRight className="w-4 h-4" />}
              onClick={() => navigate('/dashboard', { replace: true })}
            >
              Enter Dashboard
            </Button>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.p
          className="text-center text-xs text-white/20 mt-6 tracking-wider uppercase"
          variants={itemVariants}
        >
          &copy; {new Date().getFullYear()} ACES Zone &mdash; All rights reserved
        </motion.p>
      </motion.div>
    </div>
  );
};

export default LoginCelebrationPage;
