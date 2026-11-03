import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { modoolsLoginUrl, getModoolsStatus } from '../../api/modools';
import { useDepartments } from '../../hooks/useDepartments';
import { departmentSignInPath } from '../../config/department';
import StudentAuthLayout, { AuthNotice, ModoolsButton } from '../../components/auth/StudentAuthLayout';
import FancyDepartmentSelector from '../../components/auth/FancyDepartmentSelector';

const LoginPage = ({ urlCode }: { urlCode?: string } = {}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [authError, setAuthError] = useState<string | null>(null);
  const [modoolsConfigured, setModoolsConfigured] = useState<boolean | null>(null);
  const { departments, selected, picked, select } = useDepartments(urlCode);

  const activeDept = departments.find((d) => d.slug === selected);

  // On a department's own address, the address follows the choice
  const pickDepartment = (slug: string) => {
    select(slug);
    if (!urlCode) return;
    const department = departments.find((d) => d.slug === slug);
    navigate(departmentSignInPath(department, false), { replace: true });
  };

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
      onSelect={pickDepartment}
      topRight={
        <div className="flex items-center gap-1.5">
          <span>Don&apos;t have an account?</span>
          <Link
            to="/signup/student"
            className="font-semibold text-[var(--primary-text)] hover:underline transition-colors"
          >
            Sign Up
          </Link>
        </div>
      }
    >
      <div className="w-full text-left">
        {/* Header */}
        <div className="mb-4 sm:mb-6 lg:mb-7">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text)]">
            {activeDept ? `Welcome to ${activeDept.name}` : 'Welcome to ACES Portal'}
          </h1>
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            Select your engineering department and continue with your Modools university account.
          </p>
        </div>

        {authError && (
          <div className="mb-4 sm:mb-5">
            <AuthNotice message={authError} />
          </div>
        )}

        <div className="space-y-4 sm:space-y-5">
          {/* Department Selector - Placed right before Continue with Modool */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
              Department
            </label>
            <FancyDepartmentSelector
              departments={departments}
              selected={selected}
              onSelect={pickDepartment}
              fullWidth={true}
            />
          </div>

          {/* Primary SSO Action */}
          <div className="pt-1">
            <ModoolsButton
              disabled={unavailable}
              unavailable={unavailable}
              onClick={() => {
                window.location.href = modoolsLoginUrl(selected);
              }}
            />
          </div>

          {/* Informational reassurance */}
          <p className="text-center text-xs text-[var(--text-muted)] leading-relaxed pt-2">
            First time signing in? Your student profile and course records are linked automatically through Modools.
          </p>
        </div>
      </div>
    </StudentAuthLayout>
  );
};

export default LoginPage;
