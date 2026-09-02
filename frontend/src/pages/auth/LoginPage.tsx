import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import AuthVideoShell from '../../components/layout/AuthVideoShell';
import { Mail, Lock, LogIn, X, ShieldOff } from 'lucide-react';
import { login as apiLogin } from '../../api/auth';
import { getErrorMessage } from '../../utils/errors';

const loginSchema = z.object({
  identifier: z.string().min(3, 'Email, Matric No, or Staff ID is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage = () => {
  const { login } = useAuth();
  const { error } = useNotification();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setAuthError(null);
    try {
      const { user: userData, tokens } = await apiLogin({ email: data.identifier, password: data.password });
      sessionStorage.setItem('just_logged_in', 'true');
      login(userData, tokens);
      navigate('/login/celebration');
    } catch (err) {
      const msg = getErrorMessage(err, 'Please verify your credentials and try again.');
      setAuthError(msg);
      error('Wrong Credentials', msg);
    }
  };

  return (
    <AuthVideoShell>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="rounded-2xl border border-white/25 bg-white/10 backdrop-blur-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center gap-1 text-center mb-7">
            <img
              src="/aces-logo.png"
              alt="Aces Logo"
              className="w-14 h-14 rounded-2xl mb-2 object-contain shadow-lg md:hidden"
            />
            <h2 className="text-3xl font-bold tracking-tight text-white">Welcome Back</h2>
            <p className="text-sm text-white/70">Enter your credentials to access the Aces Zone portal</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <AnimatePresence>
              {authError && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="relative overflow-hidden rounded-xl border border-danger-200 dark:border-danger-800/40 bg-gradient-to-r from-danger-50 via-danger-50/80 to-danger-100/60 dark:from-danger-950/30 dark:via-danger-950/20 dark:to-danger-900/20"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-danger-500 rounded-l-xl" />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-danger-500/5 to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
                  />
                  <div className="relative flex items-start gap-3 p-4">
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-danger-500/10 dark:bg-danger-500/20 flex items-center justify-center mt-0.5">
                      <ShieldOff className="w-5 h-5 text-danger-500 dark:text-danger-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-danger-700 dark:text-danger-300">
                        Authentication Failed
                      </p>
                      <p className="text-xs text-danger-600/80 dark:text-danger-400/70 mt-0.5 leading-relaxed">
                        {authError}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAuthError(null)}
                      className="shrink-0 p-1 rounded-md text-danger-400 hover:text-danger-600 hover:bg-danger-100 dark:hover:bg-danger-900/30 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <Input
              label="Email, Matric No, or Staff ID"
              placeholder="e.g. ENG/2026/001 or lecturer@aces.com"
              leftIcon={<Mail className="w-4 h-4" />}
              error={errors.identifier?.message}
              {...register('identifier')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
              error={errors.password?.message}
              {...register('password')}
            />
            <div className="flex items-center justify-between text-xs pt-1">
              <Link
                to="/forgot-password"
                className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <Button
              type="submit"
              className="w-full mt-2"
              isLoading={isSubmitting}
              leftIcon={<LogIn className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </form>
          <div className="mt-6 text-center text-xs text-white/60">
            Don't have an account?{' '}
            <div className="mt-2 flex justify-center gap-4">
              <Link
                to="/signup/student"
                className="text-primary-300 hover:text-primary-200 font-semibold transition-colors"
              >
                Student Sign Up
              </Link>
              <span className="text-white/30">|</span>
              <Link
                to="/signup/lecturer"
                className="text-primary-300 hover:text-primary-200 font-semibold transition-colors"
              >
                Lecturer Sign Up
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </AuthVideoShell>
  );
};

export default LoginPage;
