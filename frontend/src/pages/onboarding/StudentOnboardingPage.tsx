import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { User, Phone, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { isValidPhone } from '../../utils/validators';

const onboardingSchema = z.object({
  bio: z.string().min(10, 'Biography must be at least 10 characters'),
  emergencyName: z.string().min(3, 'Emergency contact name is required'),
  emergencyRelation: z.string().min(2, 'Relation type is required (e.g. Father)'),
  emergencyPhone: z.string().refine(isValidPhone, {
    message: 'Please enter a valid phone number',
  }),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

const StudentOnboardingPage = () => {
  const { user, updateUser } = useAuth();
  const { success } = useNotification();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
  });

  const nextStep = async () => {
    if (step === 1) {
      const valid = await trigger('bio');
      if (valid) setStep(2);
    }
  };

  const prevStep = () => {
    setStep(1);
  };

  const onSubmit = async (data: OnboardingValues) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      updateUser({
        bio: data.bio,
        emergencyContact: {
          name: data.emergencyName,
          relation: data.emergencyRelation,
          phone: data.emergencyPhone,
        },
      });
      success('Profile Set Up Complete', 'Welcome aboard! Your registration is now pending Class Rep and HOD verification.');
      navigate('/dashboard');
    } catch {
      // handled
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-xl rounded-2xl">
        <CardHeader className="flex-col items-center gap-1 text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-primary-500/10 text-primary-500 flex items-center justify-center mb-2">
            <User className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Set Up Profile</CardTitle>
          <CardDescription>Step {step} of 2 — Customize your profile settings</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Tell us about yourself
                  </label>
                  <textarea
                    placeholder="Enter a brief biography, academic interests, or skills..."
                    className="w-full h-32 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-surface-100 p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                    {...register('bio')}
                  />
                  {errors.bio && <p className="text-xs text-danger-500">{errors.bio.message}</p>}
                </div>
                <Button type="button" className="w-full mt-4" onClick={nextStep} rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Continue
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <Input
                  label="Emergency Contact Name"
                  placeholder="e.g. Jane Doe"
                  leftIcon={<User className="w-4 h-4" />}
                  error={errors.emergencyName?.message}
                  {...register('emergencyName')}
                />
                <Input
                  label="Relation to Contact"
                  placeholder="e.g. Mother, Father, Guardian"
                  leftIcon={<User className="w-4 h-4" />}
                  error={errors.emergencyRelation?.message}
                  {...register('emergencyRelation')}
                />
                <Input
                  label="Phone Number"
                  placeholder="e.g. 08012345678"
                  leftIcon={<Phone className="w-4 h-4" />}
                  error={errors.emergencyPhone?.message}
                  {...register('emergencyPhone')}
                />
                <div className="flex gap-4 mt-6">
                  <Button type="button" variant="outline" className="flex-1" onClick={prevStep} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" leftIcon={<CheckCircle className="w-4 h-4" />}>
                    Finish Setup
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </Card>
    </div>
  );
};

export default StudentOnboardingPage;
