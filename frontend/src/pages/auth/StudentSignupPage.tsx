import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { modoolsLoginUrl, getModoolsStatus } from '../../api/modools';
import { useDepartments } from '../../hooks/useDepartments';
import StudentAuthLayout, { AuthNotice, ModoolsButton } from '../../components/auth/StudentAuthLayout';
import FancyDepartmentSelector from '../../components/auth/FancyDepartmentSelector';

// Student registration: Modools OAuth only. Accounts are created automatically
// on first sign-in; profile details are collected in the onboarding flow
// afterwards. The /auth/signup/student endpoint still exists for the mobile app.
const StudentSignupPage = () => {
  const [searchParams] = useSearchParams();
  const [authError, setAuthError] = useState<string | null>(null);
  const [modoolsConfigured, setModoolsConfigured] = useState<boolean | null>(null);
  const { departments, selected, picked, select } = useDepartments();

  useEffect(() => {
    const errParam = searchParams.get('error');
    if (errParam === 'auth_failed') {
      setAuthError('Modools sign-in was cancelled or failed. Please try again.');
    } else if (errParam === 'staff_email') {
      setAuthError('This email belongs to a staff account. Staff sign in at the staff portal.');
    } else if (errParam === 'account_deactivated') {
      setAuthError('This account has been deactivated. Contact the department office.');
    } else if (errParam === 'unknown_department') {
      setAuthError('That department is not available for sign-in. Choose another department.');
    }
    getModoolsStatus()
      .then((s) => setModoolsConfigured(s.configured))
      .catch(() => setModoolsConfigured(false));
  }, [searchParams]);

  const unavailable = modoolsConfigured === false;

  return (
    <StudentAuthLayout
      departments={departments}
      selected={selected}
      picked={picked}
      onSelect={select}
      topRight={
        <div className="flex items-center gap-1.5">
          <span>Already have an account?</span>
          <Link to="/login" className="font-semibold text-[var(--primary-text)] hover:underline transition-colors">
            Sign in
          </Link>
        </div>
      }
    >
      <div className="w-full text-left">
        <div className="mb-4 sm:mb-6 lg:mb-7">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text)]">
            Join ADMIN PACK
          </h1>
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            Choose your department and sign up with Modools. Your account is created automatically.
          </p>
        </div>

        {authError && (
          <div className="mb-4 sm:mb-5">
            <AuthNotice message={authError} />
          </div>
        )}

        <div className="space-y-4 sm:space-y-5">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
              Department
            </label>
            <FancyDepartmentSelector departments={departments} selected={selected} onSelect={select} fullWidth={true} />
          </div>

          <div className="pt-1">
            <ModoolsButton
              disabled={unavailable}
              unavailable={unavailable}
              onClick={() => {
                window.location.href = modoolsLoginUrl(selected);
              }}
            />
          </div>

          <p className="pt-2 text-center text-xs text-[var(--text-muted)] leading-relaxed">
            Don&apos;t have a Modools account?{' '}
            <a
              href="https://cpeuniuyo.modools.app/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[var(--primary-text)] hover:underline"
            >
              Create one
            </a>
          </p>
        </div>
      </div>
    </StudentAuthLayout>
  );
};

export default StudentSignupPage;
