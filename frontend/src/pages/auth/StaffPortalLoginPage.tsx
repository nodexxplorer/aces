import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { login as apiLogin } from '../../api/auth';
import { getErrorMessage } from '../../utils/errors';
import { useDepartments } from '../../hooks/useDepartments';
import { departmentSignInPath } from '../../config/department';
import AdminPackAuthLayout from '../../components/layout/AdminPackAuthLayout';
import FancyDepartmentSelector from '../../components/auth/FancyDepartmentSelector';

const staffLoginSchema = z.object({
  identifier: z.string().min(3, 'Email or Staff ID is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  keepSignedIn: z.boolean().optional(),
});

type StaffLoginFormValues = z.infer<typeof staffLoginSchema>;

const StaffPortalLoginPage = ({ urlCode }: { urlCode?: string } = {}) => {
  const { login } = useAuth();
  const { error } = useNotification();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { departments, selected, select } = useDepartments(urlCode);

  const handleDepartmentSelect = (slug: string) => {
    select(slug);
    const dept = departments.find((d) => d.slug === slug);
    if (urlCode && dept) {
      navigate(departmentSignInPath(dept, true), { replace: true });
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StaffLoginFormValues>({
    resolver: zodResolver(staffLoginSchema),
    defaultValues: {
      keepSignedIn: false,
    },
  });

  const onSubmit = async (data: StaffLoginFormValues) => {
    setAuthError(null);
    try {
      const { user: userData, tokens } = await apiLogin({
        email: data.identifier,
        password: data.password,
        tenant: selected,
      });
      sessionStorage.setItem('just_logged_in', 'true');
      login(userData, tokens);
      navigate('/login/celebration');
    } catch (err) {
      const msg = getErrorMessage(err, 'Please verify your credentials and try again.');
      setAuthError(msg);
      const locked = (err as { response?: { status?: number } } | undefined)?.response?.status === 429;
      error(locked ? 'Account locked' : 'Wrong Credentials', msg);
    }
  };

  const currentStaffPath = import.meta.env.VITE_STAFF_PORTAL_PATH || '/portalsign';

  return (
    <AdminPackAuthLayout cardMaxWidth="max-w-[460px]">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl border border-[#1e2a42] bg-[#0c1322]/95 backdrop-blur-2xl shadow-2xl p-7 sm:p-9 text-slate-100"
      >
        {/* Card header */}
        <div className="flex flex-col items-start mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#111c30] border border-[#1f2f4c] flex items-center justify-center mb-4 overflow-hidden">
            <img
              src="/Adminpack.png"
              alt="Admin Pack"
              className="w-7 h-7 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Staff sign in</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">Email and password only</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <AnimatePresence>
            {authError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Department Select */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Department</label>
            <FancyDepartmentSelector
              departments={departments}
              selected={selected}
              onSelect={handleDepartmentSelect}
              fullWidth={true}
            />
          </div>

          {/* Email or Staff ID */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Email or staff ID</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="text"
                {...register('identifier')}
                placeholder="e.g. ENG/12345 or lecturer@uniuyo.edu.ng"
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl bg-[#080d18] border border-[#1e2a42] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec] focus:border-transparent transition-all"
              />
            </div>
            {errors.identifier && <p className="text-[11px] text-rose-400">{errors.identifier.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-xl bg-[#080d18] border border-[#1e2a42] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec] focus:border-transparent transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-[11px] text-rose-400">{errors.password.message}</p>}
          </div>

          {/* Keep me signed in & Forgot password */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                {...register('keepSignedIn')}
                className="w-4 h-4 rounded border-[#1e2a42] bg-[#080d18] text-[#1d68ec] focus:ring-[#1d68ec]"
              />
              <span>Keep me signed in</span>
            </label>
            <Link to="/forgot-password" className="text-[#3b82f6] hover:text-[#60a5fa] font-medium transition-colors">
              Forgot password?
            </Link>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-[#1d68ec] hover:bg-[#195bcf] active:scale-[0.99] text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#1d68ec]/25 transition-all disabled:opacity-50 cursor-pointer mt-2"
          >
            <LogIn className="w-4 h-4" />
            <span>{isSubmitting ? 'Signing in...' : 'Sign in'}</span>
          </button>

          {/* Security alert box */}
          <div className="p-3 rounded-xl bg-[#0a101d] border border-[#172338] text-[11px] text-slate-400 flex items-start gap-2.5">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span className="leading-snug">
              Authorized staff only. All sign-in attempts are logged and rate-limited.
            </span>
          </div>

          {/* Register link */}
          <div className="text-center pt-2 text-xs text-slate-400">
            <span>New lecturer? </span>
            <Link
              to={`${currentStaffPath}/lecturer/signup`}
              className="text-[#3b82f6] hover:text-[#60a5fa] font-semibold transition-colors"
            >
              Register here
            </Link>
          </div>
        </form>
      </motion.div>
    </AdminPackAuthLayout>
  );
};

export default StaffPortalLoginPage;
