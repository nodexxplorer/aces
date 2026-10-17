import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { modoolsLoginUrl, getModoolsStatus } from '../../api/modools';
import { useDepartments } from '../../hooks/useDepartments';
import { departmentSignInPath } from '../../config/department';
import StudentAuthLayout, { AuthNotice, ModoolsButton } from '../../components/auth/StudentAuthLayout';

// Student sign-in: Modools OAuth only (see the /portalsign route for the
// staff email/password portal). The backend starts the handshake with PKCE +
// state cookies and hands the session back in the fragment of this page's address.
const LoginPage = ({ urlCode }: { urlCode?: string } = {}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);
  const [modoolsConfigured, setModoolsConfigured] = useState<boolean | null>(null);
  const { departments, selected, picked, select } = useDepartments(urlCode);

  // On a department's own address, the address follows the choice, so the page
  // and the URL always name the same department.
  const pickDepartment = (slug: string) => {
    select(slug);
    if (!urlCode) return;
    const department = departments.find((d) => d.slug === slug);
    navigate(departmentSignInPath(department, false), { replace: true });
  };

  useEffect(() => {
    // Backend flags OAuth failures back to this page (?error=auth_failed,
    // staff_email, account_deactivated) — show a generic message, never the
    // provider's raw error text.
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
      onSelect={pickDepartment}
      topRight={
        <>
          Don&apos;t have an account?{' '}
          <Link
            to="/signup/student"
            className="font-semibold text-[#1A66D6] transition-colors hover:text-[#134FA8] dark:text-[#5AB0FF] dark:hover:text-[#8CCBFF]"
          >
            Sign up
          </Link>
        </>
      }
    >
      <h1 className="text-2xl font-semibold tracking-tight text-[#0E1B33] dark:text-[#E7EEF9]">
        Welcome back to Admin Park
      </h1>
      <p className="mt-2 text-sm text-[#4A5D7A] dark:text-[#A3B3CC]">Students sign in with their Modools account.</p>

      <div className="mt-8 space-y-4">
        {authError && <AuthNotice message={authError} />}
        <ModoolsButton
          disabled={unavailable}
          unavailable={unavailable}
          onClick={() => {
            window.location.href = modoolsLoginUrl(selected);
          }}
        />
      </div>
    </StudentAuthLayout>
  );
};

export default LoginPage;
