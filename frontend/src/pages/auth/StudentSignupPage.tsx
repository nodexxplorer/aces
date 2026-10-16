import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { modoolsLoginUrl, getModoolsStatus } from '../../api/modools';
import { useDepartments } from '../../hooks/useDepartments';
import StudentAuthLayout, { AuthNotice, ModoolsButton } from '../../components/auth/StudentAuthLayout';

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
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-[#1A66D6] transition-colors hover:text-[#134FA8] dark:text-[#5AB0FF] dark:hover:text-[#8CCBFF]"
          >
            Sign in
          </Link>
        </>
      }
    >
      <h1 className="text-3xl font-bold tracking-tight text-[#0E1B33] dark:text-[#E7EEF9]">Join Admin Park</h1>
      <p className="mt-2 text-sm text-[#4A5D7A] dark:text-[#A3B3CC]">
        Sign up with Modools. Your account is created automatically.
      </p>

      <div className="mt-8 space-y-4">
        {authError && <AuthNotice message={authError} />}
        <ModoolsButton
          disabled={unavailable}
          unavailable={unavailable}
          onClick={() => {
            window.location.href = modoolsLoginUrl(selected);
          }}
        />
        <p className="pt-2 text-center text-xs text-[#4A5D7A] dark:text-[#A3B3CC]">
          Don&apos;t have a Modools account?{' '}
          <a
            href="https://cpeuniuyo.modools.app/"
            className="font-semibold text-[#1A66D6] hover:text-[#134FA8] dark:text-[#5AB0FF] dark:hover:text-[#8CCBFF]"
          >
            Create one
          </a>
        </p>
      </div>
    </StudentAuthLayout>
  );
};

export default StudentSignupPage;
