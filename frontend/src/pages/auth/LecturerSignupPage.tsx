import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import AuthVideoShell from '../../components/layout/AuthVideoShell';
import { Mail, Lock, User, Briefcase } from 'lucide-react';
import { lecturerSignup } from '../../api/signup';

const lecturerSignupSchema = z
  .object({
    firstName: z.string().min(2, 'First name is too short'),
    lastName: z.string().min(2, 'Last name is too short'),
    email: z.string().email('Please enter a valid email address'),
    staffId: z.string(),
    // .refine(isValidStaffId, {
    //   message: 'Invalid staff ID format',
    // }),
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
      const response = await lecturerSignup({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        staffId: data.staffId,
        department: 'Computer Engineering', // Default for ACES
      });

      login(response.user, response.tokens);
      success(
        'Registration Successful',
        'Your lecturer account has been queued for Head of Department (HOD) approval.',
      );
      navigate('/dashboard');
    } catch (err) {
      error(
        'Registration Failed',
        err instanceof Error ? err.message : 'An error occurred during account registration.',
      );
    }
  };

  return (
    <AuthVideoShell cardMaxWidth="max-w-lg">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="rounded-2xl border border-white/25 bg-white/10 backdrop-blur-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center gap-1 text-center mb-7">
            <img
              src="/aces-logo.png"
              alt="Aces Logo"
              className="w-14 h-14 rounded-2xl mb-2 object-contain shadow-lg md:hidden"
            />
            <h2 className="text-3xl font-bold tracking-tight text-white">Lecturer Registration</h2>
            <p className="text-sm text-white/70">Register your staff account for department portal access</p>
          </div>
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
          <div className="mt-6 text-center text-xs text-white/60">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-300 hover:text-primary-200 font-semibold transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </motion.div>
    </AuthVideoShell>
  );
};

export default LecturerSignupPage;
