import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../../components/ui/Button';
import AuthVideoShell from '../../components/layout/AuthVideoShell';
import { AdminPackMark } from '../../components/branding/AdminPackMark';
import { GraduationCap, ShieldOff, LogIn } from 'lucide-react';
import { modoolsLoginUrl, getModoolsStatus } from '../../api/modools';
import { useDepartments } from '../../hooks/useDepartments';
import { departmentSignInPath } from '../../config/department';
import DepartmentSelect from '../../components/auth/DepartmentSelect';
import { DepartmentBrand } from '../../components/branding/DepartmentBrand';
import { Link } from 'react-router-dom';

// Student sign-in: Modools OAuth only (see the /portalsign route for the
// staff email/password portal). The backend starts the handshake with PKCE +
// state cookies and hands the session back in the fragment of this page's address.
const LoginPage = ({ urlCode }: { urlCode?: string } = {}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);
  const [modoolsConfigured, setModoolsConfigured] = useState<boolean | null>(null);
  const { departments, selected, select } = useDepartments(urlCode);

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

  return (
    <AuthVideoShell department={departments.find((d) => d.slug === selected)}>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="rounded-2xl border border-white/25 bg-white/10 backdrop-blur-2xl shadow-2xl p-8 max-w-md mx-auto">
          <div className="flex flex-col items-center gap-1 text-center mb-7">
            <AdminPackMark className="w-14 h-14 rounded-2xl mb-2 shadow-lg md:hidden" />
            <h2 className="text-3xl font-bold tracking-tight text-white">Welcome Back</h2>
            <p className="text-sm text-white/70">Students sign in with their Modools account</p>
          </div>

          <div className="space-y-5">
            {authError && (
              <div className="relative overflow-hidden rounded-xl border border-danger-200 dark:border-danger-800/40 bg-gradient-to-r from-danger-50 via-danger-50/80 to-danger-100/60 dark:from-danger-950/30 dark:via-danger-950/20 dark:to-danger-900/20">
                <div className="absolute top-0 left-0 w-1 h-full bg-danger-500 rounded-l-xl" />
                <div className="relative flex items-start gap-3 p-4">
                  <ShieldOff className="w-5 h-5 text-danger-500 dark:text-danger-400 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-danger-700 dark:text-danger-300">{authError}</p>
                </div>
              </div>
            )}

            <DepartmentSelect departments={departments} value={selected} onChange={pickDepartment} />
            <div className="mt-4 md:hidden">
              <DepartmentBrand department={departments.find((d) => d.slug === selected)} />
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={modoolsConfigured === false}
              onClick={() => {
                window.location.href = modoolsLoginUrl(selected);
              }}
              leftIcon={
                modoolsConfigured === false ? <LogIn className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />
              }
            >
              {modoolsConfigured === false ? 'Modools sign-in unavailable' : 'Continue with Modools'}
            </Button>
            <p className="text-center text-xs text-white/50">
              First time? Your account is created automatically, you'll set up your profile right after.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-white/10 text-center text-xs text-white/60">
            Already have an account?{' '}
            <Link
              to="/signup/student"
              className="text-primary-300 hover:text-primary-200 font-semibold transition-colors"
            >
              Sign Up
            </Link>
          </div>

          <div className="mt-6 text-center text-xs text-white/60">
            <p className="mt-2 text-white/40">
              Students don't need an account signing in with Modools creates one automatically.
            </p>
          </div>
        </div>
      </motion.div>
    </AuthVideoShell>
  );
};

export default LoginPage;
