import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, CreditCard, User, Shield, Sun, Moon, Building, BookOpen } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDashboardPath } from '../../hooks/useDashboardPath';
import { useDarkMode } from '../../hooks/useDarkMode';
import { formatDepartmentDisplayName } from '../../config/department';

const TOTAL_COUNTDOWN = 5;

const LoginCelebrationPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isDark, toggle } = useDarkMode();
  const dashboardPath = useDashboardPath();
  const [countdown, setCountdown] = useState(TOTAL_COUNTDOWN);

  useEffect(() => {
    sessionStorage.removeItem('just_logged_in');
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      navigate(dashboardPath, { replace: true });
    }
  }, [countdown, navigate, dashboardPath]);

  const role = user?.activeRole || user?.role || 'student';
  const isAdmin = role === 'hod' || role === 'delegated_admin' || role === 'admin';
  const isLecturer = role === 'lecturer';
  const deptName = user?.tenant?.name ? formatDepartmentDisplayName(user.tenant.name) : '';

  const defaultTitle = isAdmin ? 'Admin' : isLecturer ? 'Lecturer' : 'Student';
  const firstName = user?.firstName || defaultTitle;
  const fullName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || defaultTitle;
  const level = user?.level || '—';
  const academicStanding = user?.academicStanding || user?.academic_standing || 'Good standing';

  const handleSignOut = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  // Progress percentage for circular ring and progress bar
  const progressRatio = (TOTAL_COUNTDOWN - countdown) / TOTAL_COUNTDOWN;
  const ringCircumference = 2 * Math.PI * 18; // ~113.1

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#f3f4f6] dark:bg-[#0d0e12] text-slate-900 dark:text-white transition-colors duration-200 select-none overflow-x-hidden">
      {/* LEFT PANEL - Royal Blue Showcase */}
      <div className="relative w-full md:w-[48%] lg:w-[45%] xl:w-[42%] bg-[#1d68ec] dark:bg-[#1a62dc] flex flex-col justify-between p-6 sm:p-10 lg:p-14 text-white overflow-hidden shrink-0 min-h-[460px] md:min-h-screen">
        {/* Top Brand Logo */}
        <div className="relative z-20 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white dark:bg-black text-[#1d68ec] dark:text-white shadow-sm transition-colors">
            <Shield className="w-4 h-4 stroke-[2.2]" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">
            Admin Pack
            {/* {isAdmin ? 'Admin Console' : isLecturer ? 'Staff Portal' : 'Student Portal'} */}
          </span>
        </div>

        {/* Center: Hero Checkmark with Concentric Rings + Greeting */}
        <div className="relative z-10 my-auto py-8 sm:py-12">
          {/* Checkmark Circle with Concentric Rings centered behind it */}
          <div className="relative inline-flex mb-8 sm:mb-10">
            {/* Concentric circular rings radiating from checkmark */}
            <div
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
            >
              <div className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] rounded-full border border-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              <div className="w-[300px] h-[300px] sm:w-[360px] sm:h-[360px] rounded-full border border-white/15 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              <div className="w-[440px] h-[440px] sm:w-[520px] sm:h-[520px] rounded-full border border-white/10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              <div className="w-[600px] h-[600px] sm:w-[700px] sm:h-[700px] rounded-full border border-white/5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>

            {/* Main Checkmark Badge */}
            <div className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center bg-white dark:bg-black text-[#1d68ec] dark:text-white shadow-xl dark:shadow-2xl transition-colors">
              <Check className="w-10 h-10 sm:w-12 sm:h-12 stroke-[3]" />
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.1] mb-4">
            You're in,
            <br />
            {firstName}.
          </h1>

          {/* Subtitle */}
          <p className="text-white/85 text-xs sm:text-sm max-w-sm leading-relaxed mb-8 sm:mb-10">
            {isAdmin
              ? `Signed in as ${fullName}. We're getting your admin console ready.`
              : isLecturer
                ? `Signed in as ${fullName}. We're getting your dashboard ready.`
                : `Signed in as ${fullName}. We're getting your student dashboard ready.`}
          </p>

          {/* Verification Checklist */}
          <div className="space-y-3.5 max-w-xs">
            {/* Item 1: Account verified */}
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-white dark:bg-black text-[#1d68ec] dark:text-white shrink-0 shadow-sm transition-colors">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-white">Account verified</span>
            </div>

            {/* Item 2: Role check */}
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-white dark:bg-black text-[#1d68ec] dark:text-white shrink-0 shadow-sm transition-colors">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-white">
                {isAdmin ? 'Privileges verified' : isLecturer ? 'courses Assignment checked' : 'Dues checked'}
              </span>
            </div>

            {/* Item 3: Preparing your dashboard */}
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white/30 dark:border-white/30 border-t-white dark:border-t-white animate-spin shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-white/95">
                {isAdmin ? 'Preparing admin console' : 'Preparing your dashboard'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Copyright */}
        <div className="relative z-10 pt-4 text-[10px] sm:text-xs font-semibold tracking-wider text-white/60 uppercase">
          &copy; {new Date().getFullYear()} ADMIN PACK. ALL RIGHTS RESERVED
        </div>
      </div>

      {/* RIGHT PANEL - Dashboard Ready Status Card */}
      <div className="relative flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-16 bg-[#f3f4f6] dark:bg-[#0d0e12] transition-colors duration-200">
        {/* Top Bar with subtle Theme Toggle */}
        <div className="flex items-center justify-end w-full">
          <button
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 dark:border-[#262833] bg-white dark:bg-[#16181d] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors"
            aria-label="Toggle theme"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Center Card Content */}
        <div className="my-auto mx-auto w-full max-w-md py-6">
          {/* Header row with Circular Countdown Ring */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-[11px] sm:text-xs font-bold tracking-wider text-[#1d68ec] dark:text-[#38bdf8] uppercase mb-1">
                YOUR DASHBOARD IS READY
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Here's what's waiting
              </h2>
            </div>

            {/* Circular Countdown Progress Badge */}
            <div className="relative flex items-center justify-center w-11 h-11 shrink-0 ml-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  className="stroke-slate-200 dark:stroke-[#232630]"
                  strokeWidth="3.5"
                  fill="transparent"
                />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  className="stroke-[#1d68ec] dark:stroke-[#38bdf8] transition-all duration-1000 ease-linear"
                  strokeWidth="3.5"
                  fill="transparent"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringCircumference * (1 - progressRatio)}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-xs font-bold text-slate-900 dark:text-white">{countdown}s</span>
            </div>
          </div>

          {/* Enclosed Status Summary Card */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-[#22252d] bg-white dark:bg-[#16181d] shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden mb-6 transition-colors">
            {isAdmin ? (
              <>
                {/* Admin Row 1: Access Status */}
                <div className="flex items-center justify-between p-4 px-5">
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <Shield className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-xs sm:text-sm font-medium">Administrative access</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    {role === 'hod' ? 'HOD · Full Access' : 'Verified Admin'}
                  </span>
                </div>
                {/* Subtle Divider */}
                <div className="h-px bg-slate-100 dark:bg-[#22252d]" />
                {/* Admin Row 2: Department */}
                <div className="flex items-center justify-between p-4 px-5">
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <Building className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-xs sm:text-sm font-medium">Department</span>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">{deptName}</span>
                </div>
              </>
            ) : isLecturer ? (
              <>
                {/* Lecturer Row 1: Faculty standing */}
                <div className="flex items-center justify-between p-4 px-5">
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <BookOpen className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-xs sm:text-sm font-medium">courses assigned</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    Verified
                  </span>
                </div>
                {/* Subtle Divider */}
                <div className="h-px bg-slate-100 dark:bg-[#22252d]" />
                {/* Lecturer Row 2: Department */}
                <div className="flex items-center justify-between p-4 px-5">
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <Building className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-xs sm:text-sm font-medium">Department</span>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">{deptName}</span>
                </div>
              </>
            ) : (
              <>
                {/* Student Row 1: Outstanding dues */}
                <div className="flex items-center justify-between p-4 px-5">
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <CreditCard className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-xs sm:text-sm font-medium">Outstanding dues</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    Cleared
                  </span>
                </div>
                {/* Subtle Divider */}
                <div className="h-px bg-slate-100 dark:bg-[#22252d]" />
                {/* Student Row 2: Student status */}
                <div className="flex items-center justify-between p-4 px-5">
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <User className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-xs sm:text-sm font-medium">Student status</span>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                    Level {level} &middot; {academicStanding}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Horizontal Progress Bar */}
          <div className="w-full h-1.5 sm:h-2 bg-slate-200 dark:bg-[#22252d] rounded-full overflow-hidden mb-5">
            <div
              className="h-full bg-[#1d68ec] dark:bg-[#2563eb] rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${Math.min(100, Math.max(15, progressRatio * 100))}%` }}
            />
          </div>

          {/* Primary Action Button */}
          <button
            onClick={() => navigate(dashboardPath, { replace: true })}
            className="w-full py-3.5 px-6 rounded-2xl bg-[#1d68ec] hover:bg-[#1655c4] dark:bg-[#2563eb] dark:hover:bg-[#1d4ed8] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
          >
            <span>Enter Dashboard</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Bottom Footer Text */}
          <div className="flex items-center justify-between pt-4 text-xs text-slate-500 dark:text-slate-400">
            <span>Redirecting automatically</span>
            <button
              onClick={handleSignOut}
              className="text-[#1d68ec] dark:text-[#38bdf8] font-medium hover:underline transition-colors"
            >
              Not you? Sign out
            </button>
          </div>
        </div>

        {/* Bottom spacer for centering balance */}
        <div className="hidden sm:block h-9" />
      </div>
    </div>
  );
};

export default LoginCelebrationPage;
