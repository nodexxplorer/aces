import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Mail, Lock, User, UserCheck } from 'lucide-react';
import { isValidMatricNumber } from '../../utils/validators';

const studentSignupSchema = z
  .object({
    firstName: z.string().min(2, 'First name is too short'),
    lastName: z.string().min(2, 'Last name is too short'),
    email: z.string().email('Please enter a valid email address'),
    matricNumber: z.string().refine(isValidMatricNumber, {
      message: 'Format must be like ENG/2022/123',
    }),
    level: z.string().min(1, 'Please select your current level'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  });

type StudentSignupValues = z.infer<typeof studentSignupSchema>;

const StudentSignupPage = () => {
  const { login } = useAuth();
  const { success, error } = useNotification();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StudentSignupValues>({
    resolver: zodResolver(studentSignupSchema),
  });

  const onSubmit = async (data: StudentSignupValues) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const mockUser = {
        id: 'student-new',
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        roles: ['student'] as any,
        activeRole: 'student' as const,
        matricNumber: data.matricNumber,
        level: parseInt(data.level),
        isApproved: false,
        approvalStatus: 'pending' as const,
        createdAt: new Date().toISOString(),
      };

      const mockTokens = {
        accessToken: 'new-student-token',
        refreshToken: 'new-student-refresh-token',
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };

      login(mockUser, mockTokens);
      success('Sign Up Successful', 'Welcome to ACES Zone! Please complete your profile onboarding.');
      navigate('/onboarding');
    } catch {
      error('Sign Up Failed', 'An error occurred during account registration.');
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
          <CardTitle className="text-2xl font-bold tracking-tight">Student Registration</CardTitle>
          <CardDescription>Create your student account to join the ACES academic zone</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              placeholder="e.g. John"
              leftIcon={<User className="w-4 h-4" />}
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <Input
              label="Last Name"
              placeholder="e.g. Doe"
              leftIcon={<User className="w-4 h-4" />}
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>
          <Input
            label="Email Address"
            placeholder="e.g. john.doe@student.uniuyo.edu.ng"
            leftIcon={<Mail className="w-4 h-4" />}
            error={errors.email?.message}
            {...register('email')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Matric Number"
              placeholder="e.g. ENG/2022/123"
              leftIcon={<UserCheck className="w-4 h-4" />}
              error={errors.matricNumber?.message}
              {...register('matricNumber')}
            />
            <Select
              label="Level"
              placeholder="Select Level"
              options={[
                { value: '100', label: '100 Level' },
                { value: '200', label: '200 Level' },
                { value: '300', label: '300 Level' },
                { value: '400', label: '400 Level' },
                { value: '500', label: '500 Level' },
              ]}
              error={errors.level?.message}
              {...register('level')}
            />
          </div>
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

export default StudentSignupPage;
