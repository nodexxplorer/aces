// import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { useDashboardPath } from '../../hooks/useDashboardPath';
import { useNotification } from '../../hooks/useNotification';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Check, AlertTriangle } from 'lucide-react';
import { lecturerSignup } from '../../api/signup';
import { useDepartments } from '../../hooks/useDepartments';
import { departmentShortName } from '../../components/branding/department';
import AdminPackAuthLayout from '../../components/layout/AdminPackAuthLayout';
import FancyDepartmentSelector from '../../components/auth/FancyDepartmentSelector';

const lecturerSignupSchema = z
  .object({
    firstName: z.string().min(2, 'First name is required'),
    lastName: z.string().min(2, 'Last name is required'),
    email: z.string().email('Please enter a valid school email address'),
    staffId: z.string().min(3, 'Staff ID is required'),
    password: z.string().min(6, 'Password must be 6 to 72 characters').max(72),
    confirmPassword: z.string().min(6, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type LecturerSignupValues = z.infer<typeof lecturerSignupSchema>;

const LecturerSignupPage = () => {
  const { login } = useAuth();
  const { success, error } = useNotification();
  const navigate = useNavigate();
  const dashboardPath = useDashboardPath();
  const { departments, selected, select } = useDepartments();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LecturerSignupValues>({
    resolver: zodResolver(lecturerSignupSchema),
  });

  const pwd = watch('password') || '';
  const confirmPwd = watch('confirmPassword') || '';
  const pwdMismatch = confirmPwd.length > 0 && pwd !== confirmPwd;

  // Strength score
  const getStrengthScore = (val: string) => {
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/[0-9]/.test(val) || /[^A-Za-z0-9]/.test(val)) score++;
    return score;
  };
  const strengthScore = getStrengthScore(pwd);
  const strengthLabel = strengthScore >= 3 ? 'Strong' : strengthScore >= 2 ? 'Medium' : 'Weak';

  const onSubmit = async (data: LecturerSignupValues) => {
    try {
      const chosen = departments.find((d) => d.slug === selected);
      const response = await lecturerSignup({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        staffId: data.staffId,
        department: departmentShortName(chosen?.name) ?? '',
        tenant: selected,
      });

      login(response.user, response.tokens);
      success(
        'Registration Successful',
        'Your lecturer account has been queued for Head of Department (HOD) approval.',
      );
      navigate(dashboardPath);
    } catch (err) {
      error(
        'Registration Failed',
        err instanceof Error ? err.message : 'An error occurred during account registration.',
      );
    }
  };

  const currentStaffPath = import.meta.env.VITE_STAFF_PORTAL_PATH || '/portalsign';

  return (
    <AdminPackAuthLayout cardMaxWidth="max-w-[500px]">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl border border-[#1e2a42] bg-[#0c1322]/95 backdrop-blur-2xl shadow-2xl p-7 sm:p-9 text-slate-100"
      >
        <div className="flex flex-col items-start mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-white">Lecturer registration</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Create your staff account. The HOD approves it before you can sign in.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Department */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Department</label>
            <FancyDepartmentSelector departments={departments} selected={selected} onSelect={select} fullWidth={true} />
          </div>

          {/* Staff ID */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Staff ID</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                {...register('staffId')}
                placeholder="e.g. ENG/12345"
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-[#080d18] border border-[#1e2a42] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec] focus:border-transparent font-mono"
              />
            </div>
            {errors.staffId && <p className="text-[11px] text-rose-400">{errors.staffId.message}</p>}
          </div>

          {/* Row 2: First Name & Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">First name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  {...register('firstName')}
                  placeholder="e.g. Dr. Jane"
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-[#080d18] border border-[#1e2a42] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec] focus:border-transparent"
                />
              </div>
              {errors.firstName && <p className="text-[11px] text-rose-400">{errors.firstName.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Last name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  {...register('lastName')}
                  placeholder="e.g. Smith"
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-[#080d18] border border-[#1e2a42] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec] focus:border-transparent"
                />
              </div>
              {errors.lastName && <p className="text-[11px] text-rose-400">{errors.lastName.message}</p>}
            </div>
          </div>

          {/* School email */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">School email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                {...register('email')}
                placeholder="e.g. janesmith@uniuyo.edu.ng"
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl bg-[#080d18] border border-[#1e2a42] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec] focus:border-transparent"
              />
            </div>
            <p className="text-[11px] text-slate-400">Use your uniuyo.edu.ng address</p>
            {errors.email && <p className="text-[11px] text-rose-400">{errors.email.message}</p>}
          </div>

          {/* Password & Confirm password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  {...register('password')}
                  placeholder="••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-[#080d18] border border-[#1e2a42] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec] focus:border-transparent font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Confirm password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  {...register('confirmPassword')}
                  placeholder="••••••••"
                  className={`w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-[#080d18] border ${
                    pwdMismatch ? 'border-rose-500/80 ring-1 ring-rose-500/40' : 'border-[#1e2a42]'
                  } text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec] focus:border-transparent font-mono`}
                />
              </div>
            </div>
          </div>

          {/* Password mismatch error feedback */}
          {pwdMismatch && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium pt-0.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Passwords do not match</span>
            </div>
          )}

          {/* Strength bar */}
          <div className="space-y-1.5 pt-1">
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    pwd.length === 0
                      ? 'bg-slate-700/40'
                      : step <= strengthScore
                        ? strengthScore >= 3
                          ? 'bg-emerald-400'
                          : strengthScore >= 2
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        : 'bg-slate-700/40'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 font-medium">
              <span
                className={
                  strengthScore >= 3 ? 'text-emerald-400' : strengthScore >= 2 ? 'text-amber-400' : 'text-slate-400'
                }
              >
                {pwd.length > 0 ? strengthLabel : ''}
              </span>
              <span>6 to 72 characters</span>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-[#1d68ec] hover:bg-[#195bcf] active:scale-[0.99] text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#1d68ec]/25 transition-all disabled:opacity-50 cursor-pointer mt-3"
          >
            <Check className="w-4 h-4" />
            <span>{isSubmitting ? 'Registering...' : 'Register account'}</span>
          </button>

          <div className="text-center pt-2 text-xs text-slate-400">
            <span>Already have an account? </span>
            <Link
              to={`${currentStaffPath}/login`}
              className="text-[#3b82f6] hover:text-[#60a5fa] font-semibold transition-colors"
            >
              Sign in
            </Link>
          </div>
        </form>
      </motion.div>
    </AdminPackAuthLayout>
  );
};

export default LecturerSignupPage;
