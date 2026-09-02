import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, KeyRound, Lock, CheckCircle, ArrowRight } from 'lucide-react';
import { requestPasswordReset, verifyPasswordResetOTP, resetPasswordWithOTP } from '../../api/additional-features';
import { getErrorMessage } from '../../utils/errors';
import AuthVideoShell from '../../components/layout/AuthVideoShell';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function PasswordResetOTPPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setStep(2);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }
    setLoading(true);
    try {
      await verifyPasswordResetOTP(email, otpString);
      setStep(3);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Invalid OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await resetPasswordWithOTP(email, otp.join(''), newPassword);
      setStep(4);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to reset password'));
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOTPPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = pasted.split('').concat(Array(6).fill('')).slice(0, 6);
    setOtp(newOtp);
    const focusIndex = Math.min(pasted.length, 5);
    otpRefs.current[focusIndex]?.focus();
  };

  return (
    <AuthVideoShell tagline="Reset your password to get back into your Aces Zone account.">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="rounded-2xl border border-white/25 bg-white/10 backdrop-blur-2xl shadow-2xl p-8">
          <img
            src="/aces-logo.png"
            alt="Aces Logo"
            className="w-14 h-14 rounded-2xl mb-6 object-contain shadow-lg mx-auto md:hidden"
          />

          {step <= 3 && (
            <div className="flex items-center justify-center gap-3 mb-8">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                      step > s
                        ? 'bg-primary-500 text-white'
                        : step === s
                          ? 'bg-primary-500 text-white ring-4 ring-primary-500/30'
                          : 'bg-white/10 text-white/50 border border-white/20'
                    }`}
                  >
                    {step > s ? '✓' : s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`w-12 h-0.5 mx-1 transition-colors ${step > s ? 'bg-primary-500' : 'bg-white/15'}`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {step === 1 && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-primary-300" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
                <p className="text-white/70">Enter your email address and we'll send you a verification code.</p>
              </div>

              <form onSubmit={handleRequestOTP} className="space-y-4">
                {error && (
                  <div className="bg-danger-500/15 border border-danger-500/30 text-danger-200 text-sm p-3 rounded-xl">
                    {error}
                  </div>
                )}

                <Input
                  label="Email Address"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  leftIcon={<Mail className="w-4 h-4" />}
                />

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={loading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Send OTP
                </Button>

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full text-white/60 hover:text-white py-2 text-sm font-medium transition-colors"
                >
                  Back to Login
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="w-8 h-8 text-primary-300" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Enter Verification Code</h1>
                <p className="text-white/70">
                  We've sent a 6-digit code to <span className="font-medium text-white">{email}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-4">
                {error && (
                  <div className="bg-danger-500/15 border border-danger-500/30 text-danger-200 text-sm p-3 rounded-xl">
                    {error}
                  </div>
                )}

                <div className="flex justify-center gap-2" onPaste={handleOTPPaste}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOTPChange(index, e.target.value)}
                      onKeyDown={(e) => handleOTPKeyDown(index, e)}
                      className="w-12 h-12 text-center text-xl font-bold bg-white/10 border border-white/25 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400 text-white"
                    />
                  ))}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={loading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Verify
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError('');
                    setOtp(['', '', '', '', '', '']);
                  }}
                  className="w-full text-white/60 hover:text-white py-2 text-sm font-medium transition-colors"
                >
                  Change email address
                </button>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-primary-300" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Set New Password</h1>
                <p className="text-white/70">Create a strong new password for your account.</p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                {error && (
                  <div className="bg-danger-500/15 border border-danger-500/30 text-danger-200 text-sm p-3 rounded-xl">
                    {error}
                  </div>
                )}

                <Input
                  label="New Password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  leftIcon={<Lock className="w-4 h-4" />}
                />

                <Input
                  label="Confirm Password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  leftIcon={<Lock className="w-4 h-4" />}
                />

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={loading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Reset Password
                </Button>
              </form>
            </>
          )}

          {step === 4 && (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-success-500/15 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-success-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Password Reset Successful</h1>
              <p className="text-white/70 mb-8">
                Your password has been successfully updated. You can now sign in with your new password.
              </p>
              <Button
                className="w-full"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Go to Login
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </AuthVideoShell>
  );
}
