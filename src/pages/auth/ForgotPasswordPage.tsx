import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNotification } from '../../hooks/useNotification';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Mail, ArrowLeft, KeyRound } from 'lucide-react';
import { useState } from 'react';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

const ForgotPasswordPage = () => {
  const { success, error } = useNotification();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordValues) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      success('Reset Link Sent', `A password reset link has been dispatched to ${data.email}`);
      setSubmitted(true);
    } catch {
      error('Request Failed', 'Something went wrong. Please try again.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card glass className="p-8">
        <CardHeader className="flex-col items-center gap-1 text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary-500/10 dark:bg-primary-500/20 text-primary-500 flex items-center justify-center mb-2">
            <KeyRound className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Reset Password</CardTitle>
          <CardDescription>
            {submitted
              ? "Check your inbox for further instructions"
              : "Enter your email address and we'll send you a password reset link"}
          </CardDescription>
        </CardHeader>

        {submitted ? (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm">
              We've sent a link to reset your password. Check spam if you don't receive it in a few minutes.
            </div>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 font-medium transition-colors mt-2">
              <ArrowLeft className="w-4 h-4" /> Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email Address"
              placeholder="e.g. name@student.uniuyo.edu.ng"
              leftIcon={<Mail className="w-4 h-4" />}
              error={errors.email?.message}
              {...register('email')}
            />
            <Button type="submit" className="w-full mt-2" isLoading={isSubmitting}>
              Send Reset Link
            </Button>
            <div className="text-center pt-2">
              <Link to="/login" className="inline-flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 font-medium transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </Card>
    </motion.div>
  );
};

export default ForgotPasswordPage;
