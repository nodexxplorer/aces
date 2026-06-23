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
import { Mail, Lock, User, Briefcase } from 'lucide-react';
import { isValidStaffId } from '../../utils/validators';

const lecturerSignupSchema = z
  .object({
    firstName: z.string().min(2, 'First name is too short'),
    lastName: z.string().min(2, 'Last name is too short'),
    email: z.string().email('Please enter a valid email address'),
    staffId: z.string().refine(isValidStaffId, {
      message: 'Format must be like ENG/12345',
    }),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  });

type LecturerSignupValues = z.infer<typeof lecturerSignupSchema>;

const LecturerSignupPage = () => {
  const { login } = useAuth();
  const { success, error } = useNotification();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LecturerSignupValues>({
    resolver: zodResolver(lecturerSignupSchema),
  });

  const onSubmit = async (data: LecturerSignupValues) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const mockUser = {
        id: 'lecturer-new',
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        roles: ['lecturer'] as any,
        activeRole: 'lecturer' as const,
        staffId: data.staffId,
        officeRoom: '',
        isApproved: false,
        approvalStatus: 'pending' as const,
        createdAt: new Date().toISOString(),
      };

      const mockTokens = {
        accessToken: 'new-lecturer-token',
        refreshToken: 'new-lecturer-refresh-token',
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };

      login(mockUser, mockTokens);
      success('Registration Successful', 'Your lecturer account has been queued for Head of Department (HOD) approval.');
      navigate('/dashboard');
    } catch {
      error('Registration Failed', 'An error occurred during account registration.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-lg mx-auto"
    >
      <Card glass className="p-8">
        <CardHeader className="flex-col items-center gap-1 text-center mb-6">
          <img src="/aces-logo.png" alt="Aces Logo" className="w-12 h-12 rounded-2xl mb-2 object-contain shadow-lg" />
          <CardTitle className="text-2xl font-bold tracking-tight">Lecturer Registration</CardTitle>
          <CardDescription>Register your staff account for department portal access</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              placeholder="e.g. Dr. Jane"
              leftIcon={<User className="w-4 h-4" />}
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <Input
              label="Last Name"
              placeholder="e.g. Smith"
              leftIcon={<User className="w-4 h-4" />}
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>
          <Input
            label="Email Address"
            placeholder="e.g. janesmith@uniuyo.edu.ng"
            leftIcon={<Mail className="w-4 h-4" />}
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Staff ID"
            placeholder="e.g. ENG/12345"
            leftIcon={<Briefcase className="w-4 h-4" />}
            error={errors.staffId?.message}
            {...register('staffId')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </div>
          <Button type="submit" className="w-full mt-2" isLoading={isSubmitting}>
            Register Account
          </Button>
        </form>
        <div className="mt-6 text-center text-xs text-surface-400">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-400 hover:text-primary-300 font-semibold transition-colors">
            Sign In
          </Link>
        </div>
      </Card>
    </motion.div>
  );
};

export default LecturerSignupPage;
