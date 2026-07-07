import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Mail, Lock, LogIn } from 'lucide-react';
import { login as apiLogin } from '../../api/auth';

const loginSchema = z.object({
  identifier: z.string().min(3, 'Email, Matric No, or Staff ID is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage = () => {
  const { login } = useAuth();
  const { error } = useNotification();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const { user: userData, tokens } = await apiLogin({ email: data.identifier, password: data.password });
      login(userData, tokens);
      navigate('/login/celebration');
    } catch (err) {
      error('Authentication Failed', err instanceof Error ? err.message : 'Please verify your credentials and try again.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card glass className="p-8">
        <CardHeader className="flex-col items-center gap-1 text-center mb-6">
          <img src="/aces-logo.png" alt="Aces Logo" className="w-12 h-12 rounded-2xl mb-2 object-contain shadow-lg" />
          <CardTitle className="text-2xl font-bold tracking-tight">Welcome Back</CardTitle>
          <CardDescription>Enter your credentials to access the Aces Zone portal</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <Link to="/forgot-password" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full mt-2" isLoading={isSubmitting} leftIcon={<LogIn className="w-4 h-4" />}>
            Sign In
          </Button>
        </form>
        <div className="mt-6 text-center text-xs text-surface-400">
          Don't have an account?{' '}
          <div className="mt-2 flex justify-center gap-4">
            <Link to="/signup/student" className="text-primary-400 hover:text-primary-300 font-semibold transition-colors">
              Student Sign Up
            </Link>
            <span className="text-surface-600">|</span>
            <Link to="/signup/lecturer" className="text-primary-400 hover:text-primary-300 font-semibold transition-colors">
              Lecturer Sign Up
            </Link>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default LoginPage;
