import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../../components/ui/Button';
import AuthVideoShell from '../../components/layout/AuthVideoShell';
import { GraduationCap, ShieldOff, LogIn } from 'lucide-react';
import { modoolsLoginUrl, getModoolsStatus } from '../../api/modools';

// Student registration: Modools OAuth only. Accounts are created
// automatically on first sign-in; profile details (matric number, level,
// phone, DOB, emergency contact) are collected in the onboarding flow
// afterwards. There is no manual form here anymore — the /auth/signup/student
// endpoint still exists for the mobile app, but the web flow is Modools-only.
const StudentSignupPage = () => {
  const [searchParams] = useSearchParams();
  const [authError, setAuthError] = useState<string | null>(null);
  const [modoolsConfigured, setModoolsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const errParam = searchParams.get('error');
    if (errParam === 'auth_failed') {
      setAuthError('Modools sign-in was cancelled or failed. Please try again.');
    } else if (errParam === 'staff_email') {
      setAuthError('This email belongs to a staff account. Staff sign in at the staff portal.');
    } else if (errParam === 'account_deactivated') {
      setAuthError('This account has been deactivated. Contact the department office.');
    }
    getModoolsStatus()
      .then((s) => setModoolsConfigured(s.configured))
      .catch(() => setModoolsConfigured(false));
  }, [searchParams]);

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
            <h2 className="text-3xl font-bold tracking-tight text-white">Join ACES Zone</h2>
            <p className="text-sm text-white/70">Sign up with Modools your account is created automatically</p>
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

            <Button
              type="button"
              className="w-full"
              disabled={modoolsConfigured === false}
              onClick={() => {
                window.location.href = modoolsLoginUrl();
              }}
              leftIcon={
                modoolsConfigured === false ? <LogIn className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />
              }
            >
              {modoolsConfigured === false ? 'Modools sign-in unavailable' : 'Continue with Modools'}
            </Button>

            <ul className="text-xs text-white/50 space-y-1.5 max-w-xs mx-auto">
              <li> After your first sign-in you'll set up your matric number, level and contact details.</li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 text-center text-xs text-white/60">
            <div>
              Already have an account?{' '}
              <Link to="/login" className="text-primary-300 hover:text-primary-200 font-semibold transition-colors">
                Sign In
              </Link>
            </div>
            <div className="pt-2">
              Don't have a Modool Account?{' '}
              <Link
                to="https://cpeuniuyo.modools.app/"
                className="text-primary-300 hover:text-primary-200 font-semibold transition-colors"
              >
                Create a Modool account
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </AuthVideoShell>
  );
};

export default StudentSignupPage;
