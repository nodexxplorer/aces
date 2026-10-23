import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  Megaphone,
  ArrowUpRight,
  Folder,
  FileSignature,
  HelpCircle,
  Calculator,
  Tablet,
  Check,
  Users,
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getStudentDashboard, type StudentDashboard as DashboardData } from '../../api/dashboard';
import StudentBottomNav from '../../components/layout/StudentBottomNav';

/**
 * Semi-circular gauge (half-donut) component for Dues Status.
 */
function SemiCircleGauge({ cleared = true, percentage = 100 }: { cleared?: boolean; percentage?: number }) {
  const radius = 64;
  const strokeWidth = 14;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * Math.min(Math.max(percentage, 0), 100)) / 100;

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg width="160" height="95" viewBox="0 0 160 95" className="overflow-visible">
        {/* Track arc */}
        <path
          d="M 16 85 A 64 64 0 0 1 144 85"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-slate-200 dark:text-[#2a2d33]"
        />
        {/* Filled progress arc */}
        <path
          d="M 16 85 A 64 64 0 0 1 144 85"
          fill="none"
          stroke="url(#duesGaugeGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="duesGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1a66d6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute bottom-2 flex flex-col items-center">
        <span className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)]">
          {cleared ? 'Cleared' : `${percentage}%`}
        </span>
      </div>
    </div>
  );
}

const StudentDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  // No fallback data: if the dashboard cannot be loaded, the page says so and offers a retry.
  useEffect(() => {
    let active = true;
    setLoading(true);
    getStudentDashboard()
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, attempt]);

  const studentName = data?.student.full_name?.split(' ')[0] || user?.firstName || 'Student';
  const studentLevel = data?.student.level || 0;
  const duesOutstanding = data?.payments?.dues_outstanding;
  const isDuesCleared = duesOutstanding === 0;
  const duesLabel =
    duesOutstanding === undefined || duesOutstanding === null
      ? '—'
      : isDuesCleared
        ? 'Cleared'
        : `₦${duesOutstanding.toLocaleString()}`;
  const unreadNotifications = data?.notifications?.unread ?? 0;
  const levelLabel = studentLevel > 0 ? `Level ${studentLevel}` : null;
  const standingLabel = data?.student.academic_standing || null;
  const mobileSubtitle = [levelLabel, standingLabel].filter(Boolean).join(' · ');
  const desktopSubtitle = [levelLabel, 'All you need in one place.'].filter(Boolean).join(' · ');
  const attendanceAttended = data?.attendance?.attended ?? 0;
  const attendanceTotal = data?.attendance?.total_classes ?? 0;
  const amountPaid = data?.payments?.amount_paid ?? 0;
  const amountPending = data?.payments?.amount_pending ?? 0;
  // Share of this student's dues already paid, from the real payment totals.
  const duesBase = amountPaid + (duesOutstanding ?? 0);
  const duesPaidPercent = duesBase > 0 ? Math.round((amountPaid / duesBase) * 100) : 0;
  const announcements = data?.announcements ?? [];

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-[var(--text-muted)]">We could not load your dashboard.</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6 transition-colors duration-200">
      {/* ────────────────── TOP WELCOME HEADER ────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl md:text-4xl">
            Hello, {studentName}!
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--text-muted)]">
            <span className="md:hidden">{mobileSubtitle}</span>
            <span className="hidden md:inline">{desktopSubtitle}</span>
          </p>
        </div>

        {/* Desktop Quick Actions in Header */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            to="/payments"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#1a66d6] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#1554b2] active:scale-95"
          >
            <CreditCard className="h-4 w-4" />
            <span>Pay Dues</span>
          </Link>
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--primary)] text-[var(--primary)] bg-transparent px-5 py-2.5 text-xs font-semibold transition-all hover:bg-blue-50/50 dark:hover:bg-blue-950/20 active:scale-95"
          >
            <span>Register Courses</span>
          </Link>
        </div>
      </div>

      {/* ────────────────── MOBILE HERO CARD: OUTSTANDING DUES (mobile only) ────────────────── */}
      <div className="block md:hidden">
        <Link
          to="/payments"
          className="relative block overflow-hidden rounded-[24px] bg-[#1a66d6] p-6 text-white shadow-xl shadow-blue-500/25 transition-transform active:scale-[0.99]"
        >
          {/* Subtle decorative glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/15 blur-xl"
          />
          <div className="relative z-10">
            <span className="text-xs font-medium text-white/85">Outstanding dues</span>
            <div className="mt-3 flex items-center gap-2">
              <Check className="h-7 w-7 text-white stroke-[3]" />
              <span className="text-3xl font-extrabold tracking-tight">{duesLabel}</span>
            </div>
            <p className="mt-3 text-xs text-white/80">
              {isDuesCleared ? 'No payment needed' : 'Due for the current semester'}
            </p>
          </div>
        </Link>
      </div>

      {/* ────────────────── TOP METRIC CARDS (Desktop: 4 Cards, Mobile: 3 Small Cards) ────────────────── */}
      {/* Mobile 3-Card Row */}
      <div className="grid grid-cols-3 gap-2.5 md:hidden">
        <Link
          to="/communication"
          className="flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-white p-3.5 dark:bg-[#1c1e22] shadow-sm transition-all active:scale-95"
        >
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Notifications</span>
          <span className="mt-2 text-base font-bold text-[var(--text)]">
            {unreadNotifications > 0 ? `${unreadNotifications} new` : '0 new'}
          </span>
        </Link>

        <Link
          to="/courses"
          className="flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-white p-3.5 dark:bg-[#1c1e22] shadow-sm transition-all active:scale-95"
        >
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Attendance</span>
          <span className="mt-2 text-base font-bold text-[var(--text)]">
            {attendanceAttended}/{attendanceTotal}
          </span>
        </Link>

        <Link
          to="/payments"
          className="flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-white p-3.5 dark:bg-[#1c1e22] shadow-sm transition-all active:scale-95"
        >
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Pending</span>
          <span className="mt-2 text-base font-bold text-[var(--text)]">₦{amountPending.toLocaleString()}</span>
        </Link>
      </div>

      {/* Desktop 4-Card Grid */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Outstanding Dues Card */}
        <Link
          to="/payments"
          className="group relative flex flex-col justify-between overflow-hidden rounded-[22px] bg-[#1a66d6] p-5 text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-xl"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/90">Outstanding Dues</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-1.5">
              <Check className="h-6 w-6 text-white stroke-[3]" />
              <span className="text-2xl font-bold tracking-tight">{duesLabel}</span>
            </div>
            <p className="mt-1 text-xs text-white/80">
              {isDuesCleared ? 'No payment needed' : 'Due for current session'}
            </p>
          </div>
        </Link>

        {/* 2. Notifications Card */}
        <Link
          to="/communication"
          className="group relative flex flex-col justify-between overflow-hidden rounded-[22px] border border-[var(--border)] bg-white p-5 dark:bg-[#1c1e22] shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text)]">Notifications</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-all group-hover:border-[var(--primary)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold tracking-tight text-[var(--text)]">
              {unreadNotifications} <span className="text-sm font-normal text-[var(--text-muted)]">new</span>
            </span>
            <p className="mt-1 text-xs text-[var(--text-muted)]">In Communication</p>
          </div>
        </Link>

        {/* 3. Attendance Card */}
        <Link
          to="/courses"
          className="group relative flex flex-col justify-between overflow-hidden rounded-[22px] border border-[var(--border)] bg-white p-5 dark:bg-[#1c1e22] shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text)]">Attendance</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-all group-hover:border-[var(--primary)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold tracking-tight text-[var(--text)]">
              {attendanceAttended}/{attendanceTotal}{' '}
              <span className="text-sm font-normal text-[var(--text-muted)]">classes</span>
            </span>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Nothing recorded yet</p>
          </div>
        </Link>

        {/* 4. Payments Card */}
        <Link
          to="/payments"
          className="group relative flex flex-col justify-between overflow-hidden rounded-[22px] border border-[var(--border)] bg-white p-5 dark:bg-[#1c1e22] shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text)]">Payments</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-all group-hover:border-[var(--primary)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block">Paid</span>
                <span className="text-lg font-bold text-[#186a3c] dark:text-[#4cc38a]">
                  ₦{amountPaid.toLocaleString()}
                </span>
              </div>
              <div className="h-6 w-px bg-[var(--border)]" />
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block">Pending</span>
                <span className="text-lg font-bold text-[var(--text)]">₦{amountPending.toLocaleString()}</span>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">Updated today</p>
          </div>
        </Link>
      </div>

      {/* ────────────────── MOBILE QUICK ACTIONS (2x2 Grid) ────────────────── */}
      <div className="block md:hidden space-y-3">
        <h2 className="text-base font-bold text-[var(--text)]">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/courses"
            className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 dark:bg-[#1c1e22] shadow-sm transition-transform active:scale-95"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1a66d6] dark:bg-blue-950/40 dark:text-[#4f9bff]">
              <Tablet className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold leading-snug text-[var(--text)]">Register courses</span>
          </Link>

          <Link
            to="/course-form-signing"
            className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 dark:bg-[#1c1e22] shadow-sm transition-transform active:scale-95"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1a66d6] dark:bg-blue-950/40 dark:text-[#4f9bff]">
              <FileSignature className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold leading-snug text-[var(--text)]">Sign form</span>
          </Link>

          <Link
            to="/gpa"
            className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 dark:bg-[#1c1e22] shadow-sm transition-transform active:scale-95"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1a66d6] dark:bg-blue-950/40 dark:text-[#4f9bff]">
              <Calculator className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold leading-snug text-[var(--text)]">GPA calculator</span>
          </Link>

          <Link
            to="/complaints"
            className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 dark:bg-[#1c1e22] shadow-sm transition-transform active:scale-95"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1a66d6] dark:bg-blue-950/40 dark:text-[#4f9bff]">
              <HelpCircle className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold leading-snug text-[var(--text)]">Complaint</span>
          </Link>
        </div>
      </div>

      {/* ────────────────── MOBILE REMINDERS CARD (mobile only) ────────────────── */}
      <div className="block md:hidden">
        <div className="rounded-[24px] border border-[var(--border)] bg-white p-5 dark:bg-[#1c1e22] shadow-sm">
          <span className="text-xs font-bold text-[var(--text)]">Reminders</span>
          <h3 className="mt-2 text-sm font-semibold text-[var(--text)] leading-snug">
            Register courses and sign your form
          </h3>
          <Link
            to="/courses"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a66d6] py-3 text-xs font-semibold text-white shadow-md shadow-blue-500/20 active:scale-[0.99]"
          >
            Start
          </Link>
        </div>
      </div>

      {/* ────────────────── DESKTOP MIDDLE ROW (Announcements, Quick Actions, Reminders) ────────────────── */}
      <div className="hidden md:grid md:grid-cols-12 gap-5">
        {/* Column 1: Announcements (5 cols) */}
        <div className="md:col-span-12 lg:col-span-5 flex flex-col justify-between rounded-[24px] border border-[var(--border)] bg-white p-6 dark:bg-[#1c1e22] shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border)]/40 pb-4">
            <div className="flex items-center gap-2 text-[var(--text)]">
              <Megaphone className="h-4 w-4 text-[var(--primary)]" />
              <h2 className="text-sm font-bold tracking-tight">Announcements</h2>
            </div>
            <Link to="/communication" className="text-xs font-semibold text-[var(--primary-text)] hover:underline">
              View all
            </Link>
          </div>

          <div className="my-auto py-8">
            {announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface)] border border-[var(--border)]/60 text-[var(--primary)]">
                  <Folder className="h-6 w-6 stroke-[1.5]" />
                </div>
                <p className="mt-3 text-xs text-[var(--text-muted)]">No announcements right now.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.slice(0, 2).map((ann) => (
                  <div key={ann.id} className="p-3.5 rounded-xl border border-[var(--border)]/70 bg-[var(--surface)]">
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span className="font-semibold text-[var(--text)]">{ann.title}</span>
                      <span>{ann.date}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)] line-clamp-2">{ann.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Quick Actions (4 cols) */}
        <div className="md:col-span-6 lg:col-span-4 rounded-[24px] border border-[var(--border)] bg-white p-6 dark:bg-[#1c1e22] shadow-sm">
          <h2 className="text-sm font-bold text-[var(--text)] border-b border-[var(--border)]/40 pb-4">
            Quick actions
          </h2>

          <div className="divide-y divide-[var(--border)]/50">
            <Link
              to="/courses"
              className="flex items-center gap-3.5 py-3.5 transition-colors hover:text-[var(--primary)] group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#1a66d6] dark:bg-blue-950/40 dark:text-[#4f9bff] transition-transform group-hover:scale-105">
                <Tablet className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-[var(--text)] group-hover:text-[var(--primary-text)]">
                Register courses
              </span>
            </Link>

            <Link
              to="/course-form-signing"
              className="flex items-center gap-3.5 py-3.5 transition-colors hover:text-[var(--primary)] group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#1a66d6] dark:bg-blue-950/40 dark:text-[#4f9bff] transition-transform group-hover:scale-105">
                <FileSignature className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-[var(--text)] group-hover:text-[var(--primary-text)]">
                Sign course form
              </span>
            </Link>

            <Link
              to="/gpa"
              className="flex items-center gap-3.5 py-3.5 transition-colors hover:text-[var(--primary)] group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#1a66d6] dark:bg-blue-950/40 dark:text-[#4f9bff] transition-transform group-hover:scale-105">
                <Calculator className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-[var(--text)] group-hover:text-[var(--primary-text)]">
                GPA calculator
              </span>
            </Link>

            <Link
              to="/complaints"
              className="flex items-center gap-3.5 py-3.5 transition-colors hover:text-[var(--primary)] group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#1a66d6] dark:bg-blue-950/40 dark:text-[#4f9bff] transition-transform group-hover:scale-105">
                <HelpCircle className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-[var(--text)] group-hover:text-[var(--primary-text)]">
                Submit complaint
              </span>
            </Link>
          </div>
        </div>

        {/* Column 3: Reminders (3 cols) */}
        <div className="md:col-span-6 lg:col-span-3 flex flex-col justify-between rounded-[24px] border border-[var(--border)] bg-white p-6 dark:bg-[#1c1e22] shadow-sm">
          <div>
            <span className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Reminders</span>
            <h3 className="mt-3 text-base font-bold text-[var(--text)] leading-snug">
              Register courses and sign your form
            </h3>
            <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
              Two steps to finish your semester setup.
            </p>
          </div>

          <Link
            to="/courses"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#1a66d6] py-3 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-[#1554b2] active:scale-95"
          >
            <FileCheck2 className="h-4 w-4" />
            <span>Start</span>
          </Link>
        </div>
      </div>

      {/* ────────────────── DESKTOP BOTTOM ROW (Dues Status, Connect) ────────────────── */}
      <div className="hidden md:grid md:grid-cols-12 gap-5">
        {/* Column 1: Dues Status (6 cols) */}
        <div className="md:col-span-12 lg:col-span-6 rounded-[24px] border border-[var(--border)] bg-white p-6 dark:bg-[#1c1e22] shadow-sm">
          <h2 className="text-sm font-bold text-[var(--text)] mb-4">Dues status</h2>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-2">
            {/* Left: Semi-circle Arc Gauge */}
            <div className="shrink-0 flex items-center justify-center">
              <SemiCircleGauge cleared={isDuesCleared} percentage={duesPaidPercent} />
            </div>

            {/* Right: Paid / Pending & Action Button */}
            <div className="flex flex-1 flex-col justify-between space-y-4 w-full">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Paid</span>
                  <span className="font-bold text-[#186a3c] dark:text-[#4cc38a]">₦{amountPaid.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Pending</span>
                  <span className="rounded-full bg-[#f9e028] px-2.5 py-0.5 text-[11px] font-bold text-[#0e1b33]">
                    {isDuesCleared ? 'Nothing due' : `₦${amountPending.toLocaleString()}`}
                  </span>
                </div>
              </div>

              <Link
                to="/payments"
                className="inline-flex w-full items-center justify-center rounded-full border border-[var(--primary)] bg-transparent py-2.5 text-xs font-semibold text-[var(--primary)] transition-all hover:bg-blue-50/50 dark:hover:bg-blue-950/20 active:scale-95"
              >
                Payments &amp; Dues
              </Link>
            </div>
          </div>
        </div>

        {/* Column 2: Connect (6 cols) */}
        <div className="md:col-span-12 lg:col-span-6 flex flex-col justify-between rounded-[24px] border border-[var(--border)] bg-white p-6 dark:bg-[#1c1e22] shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-[var(--text)]">Connect</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Meet classmates and join the department community.</p>
          </div>

          <div className="my-6 flex items-center justify-end gap-3">
            {/* Overlapping Classmate Avatars */}
            <div className="flex -space-x-2.5 overflow-hidden">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1a66d6] text-white ring-2 ring-white dark:ring-[#1c1e22]">
                <Users className="h-4 w-4" />
              </div>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#38bdf8] text-white ring-2 ring-white dark:ring-[#1c1e22]">
                <Users className="h-4 w-4" />
              </div>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f59e0b] text-white ring-2 ring-white dark:ring-[#1c1e22]">
                <Users className="h-4 w-4" />
              </div>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1e293b] text-white ring-2 ring-white dark:ring-[#1c1e22]">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <span className="text-[11px] font-medium text-[var(--text-muted)]">Classmates in your department</span>
          </div>

          <Link
            to="/connect"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-transparent px-5 py-2.5 text-xs font-semibold text-[var(--text)] transition-all hover:bg-[var(--surface)] hover:text-[var(--primary)] active:scale-95"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Open Connect</span>
          </Link>
        </div>
      </div>

      {/* ────────────────── MOBILE BOTTOM NAVIGATION BAR ────────────────── */}
      <StudentBottomNav unreadCount={unreadNotifications} />
    </div>
  );
};

export default StudentDashboard;
