import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, CheckCircle, Send, ArrowLeft, AlertCircle } from 'lucide-react';
import { requestPasswordReset, resetPasswordWithOTP } from '../../api/additional-features';
import { getErrorMessage } from '../../utils/errors';
import AdminPackAuthLayout from '../../components/layout/AdminPackAuthLayout';
import { useDepartments } from '../../hooks/useDepartments';

export default function PasswordResetOTPPage() {
  const navigate = useNavigate();
  const { selected } = useDepartments();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentSuccess, setSentSuccess] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1 = request reset link, 2 = enter new password/otp if needed

  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetComplete, setResetComplete] = useState(false);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your school email');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email.trim(), undefined, selected);
      setSentSuccess(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send password reset link'));
    } finally {
      setLoading(false);
    }
  };

  const handleFinalReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Please enter the verification code');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPasswordWithOTP(email.trim(), otp.trim(), newPassword, selected);
      setResetComplete(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to reset password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminPackAuthLayout cardMaxWidth="max-w-[460px]">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl border border-[#1e2a42] bg-[#0c1322]/95 backdrop-blur-2xl shadow-2xl p-7 sm:p-9 text-slate-100"
      >
        {/* Top Lock Icon */}
        <div className="flex flex-col items-start mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#111c30] border border-[#1f2f4c] flex items-center justify-center mb-4 text-[#2563eb]">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Reset your password</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Enter your school email. We will send a link to choose a new password.
          </p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {step === 1 ? (
          <form onSubmit={handleSendLink} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">School email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="janesmith@uniuyo.edu.ng"
                  required
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl bg-[#080d18] border border-[#1e2a42] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1d68ec] hover:bg-[#195bcf] active:scale-[0.99] text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#1d68ec]/25 transition-all disabled:opacity-50 cursor-pointer mt-2"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Sending link...' : 'Send reset link'}</span>
            </button>

            {/* Success alert exactly like PDF */}
            <AnimatePresence>
              {sentSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-xs flex items-start gap-3 mt-3"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="leading-relaxed">
                      Check your email. If an account exists for this address, a link is on its way. It works for 30
                      minutes.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-[11px] font-semibold text-emerald-400 underline hover:text-emerald-300"
                    >
                      Already have an OTP code? Enter it here
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-center pt-3 text-xs">
              <Link
                to="/login"
                className="text-[#3b82f6] hover:text-[#60a5fa] font-semibold transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to sign in</span>
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleFinalReset} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Verification OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code from email"
                className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl bg-[#080d18] border border-[#1e2a42] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec] font-mono tracking-widest text-center"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl bg-[#080d18] border border-[#1e2a42] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl bg-[#080d18] border border-[#1e2a42] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec]"
              />
            </div>

            {resetComplete ? (
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs text-center font-medium">
                Password updated! Redirecting to sign in...
              </div>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1d68ec] hover:bg-[#195bcf] active:scale-[0.99] text-white font-medium text-xs sm:text-sm shadow-lg shadow-[#1d68ec]/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Updating password...' : 'Update Password'}
              </button>
            )}

            <div className="text-center pt-2 text-xs">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                Back to email request
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </AdminPackAuthLayout>
  );
}
