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
import {
  User, Phone, Image, CheckCircle, ArrowRight, ArrowLeft,
  Calendar, BookOpen, MapPin, AlertCircle, FileText
} from 'lucide-react';
import { isValidPhone } from '../../utils/validators';
import apiClient from '../../api/client';

const onboardingSchema = z.object({
  fullName: z.string().min(3, 'Full name must be at least 3 characters').regex(/^[A-Za-z\s]+$/, 'Name can only contain letters and spaces'),
  dateOfBirth: z.string().min(1, 'Date of birth is required').refine((val) => {
    const dob = new Date(val);
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return age >= 16;
  }, 'You must be at least 16 years old'),
  matricNumber: z.string().min(1, 'Matric number is required').regex(
    /^\d{2}\/[A-Z]{2,10}\/[A-Z]{2,10}\/\d{2,4}$/,
    'Format: 19/ENG/COE/001'
  ),
  level: z.string().min(1, 'Level is required'),
  admissionMode: z.string().min(1, 'Admission mode is required'),
  yearAdmitted: z.string().min(1, 'Year admitted is required').refine((val) => {
    const year = parseInt(val);
    return year >= 1900 && year <= new Date().getFullYear();
  }, 'Enter a valid year'),
  phone: z.string().refine(isValidPhone, { message: 'Enter a valid Nigerian phone number' }),
  profilePhotoUrl: z.string().url('Enter a valid URL').or(z.literal('')),
  emergencyContact: z.string().min(3, 'Emergency contact name is required'),
  emergencyContactPhone: z.string().refine(isValidPhone, { message: 'Enter a valid phone number' }),
  homeAddress: z.string().max(200, 'Address must be 200 characters or less').optional(),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

const StudentOnboardingPage = () => {
  const { user, updateUser } = useAuth();
  const { success } = useNotification();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      admissionMode: 'UTME',
      level: '',
      yearAdmitted: new Date().getFullYear().toString(),
    },
  });

  const watchedValues = watch();

  const stepFields: Record<number, (keyof OnboardingValues)[]> = {
    1: ['fullName', 'dateOfBirth', 'profilePhotoUrl'],
    2: ['matricNumber', 'level', 'admissionMode', 'yearAdmitted'],
    3: ['phone', 'emergencyContact', 'emergencyContactPhone', 'homeAddress'],
    4: [],
  };

  const nextStep = async () => {
    const fields = stepFields[step];
    if (fields.length > 0) {
      const valid = await trigger(fields);
      if (valid) setStep((s) => Math.min(s + 1, totalSteps));
    } else {
      setStep((s) => Math.min(s + 1, totalSteps));
    }
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const onSubmit = async (data: OnboardingValues) => {
    try {
      await apiClient.post('/auth/onboarding', {
        phone: data.phone,
        bio: '',
        avatar: data.profilePhotoUrl || '',
        full_name: data.fullName,
        date_of_birth: data.dateOfBirth,
        matric_number: data.matricNumber,
        level: data.level,
        admission_mode: data.admissionMode,
        year_admitted: data.yearAdmitted,
        emergency_contact: data.emergencyContact,
        emergency_contact_phone: data.emergencyContactPhone,
        home_address: data.homeAddress || '',
        profile_photo_url: data.profilePhotoUrl || '',
      });
      updateUser({
        onboardingCompleted: true,
        phone: data.phone,
        avatar: data.profilePhotoUrl || undefined,
        fullName: data.fullName,
      });
      success('Profile Set Up Complete', 'Welcome aboard! Your registration is now pending verification.');
      navigate('/dashboard');
    } catch {
      // handled by interceptor
    }
  };

  const getAge = (dob: string) => {
    if (!dob) return '';
    const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return `${age} years old`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950">
      <Card className="max-w-lg w-full p-8 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-xl rounded-2xl">
        <CardHeader className="flex-col items-center gap-1 text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-primary-500/10 text-primary-500 flex items-center justify-center mb-2">
            <User className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Set Up Your Profile</CardTitle>
          <CardDescription>Step {step} of {totalSteps} — Complete your details</CardDescription>

          {/* Progress bar */}
          <div className="w-full mt-3">
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                    i < step ? 'bg-primary-500' : 'bg-surface-200 dark:bg-surface-700'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-surface-400">
              <span>Personal</span>
              <span>Academic</span>
              <span>Contact</span>
              <span>Review</span>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <AnimatePresence mode="wait">
            {/* Step 1: Personal Information */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
                  <User className="w-4 h-4" /> Personal Information
                </h3>

                <Input
                  label="Full Name"
                  placeholder="e.g. John Adebayo Smith"
                  leftIcon={<User className="w-4 h-4" />}
                  error={errors.fullName?.message}
                  {...register('fullName')}
                />

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                    Date of Birth
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                      type="date"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                      {...register('dateOfBirth')}
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 16)).toISOString().split('T')[0]}
                    />
                  </div>
                  {errors.dateOfBirth && <p className="text-xs text-danger-500 mt-1">{errors.dateOfBirth.message}</p>}
                  {watchedValues.dateOfBirth && (
                    <p className="text-xs text-surface-400 mt-1">{getAge(watchedValues.dateOfBirth)}</p>
                  )}
                </div>

                <Input
                  label="Profile Photo URL (optional)"
                  placeholder="https://example.com/photo.jpg"
                  leftIcon={<Image className="w-4 h-4" />}
                  error={errors.profilePhotoUrl?.message}
                  {...register('profilePhotoUrl')}
                />

                <Button type="button" className="w-full mt-4" onClick={nextStep} rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Continue
                </Button>
              </motion.div>
            )}

            {/* Step 2: Academic Information */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Academic Information
                </h3>

                <Input
                  label="Matric Number / Reg No"
                  placeholder="e.g. 19/ENG/COE/001"
                  leftIcon={<FileText className="w-4 h-4" />}
                  error={errors.matricNumber?.message}
                  {...register('matricNumber')}
                />

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                    Level
                  </label>
                  <select
                    className="w-full px-4 py-2.5 text-sm bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    {...register('level')}
                  >
                    <option value="">Select your level</option>
                    <option value="100">100 Level</option>
                    <option value="200">200 Level</option>
                    <option value="300">300 Level</option>
                    <option value="400">400 Level</option>
                    <option value="500">500 Level</option>
                  </select>
                  {errors.level && <p className="text-xs text-danger-500 mt-1">{errors.level.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Admission Mode
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="UTME"
                        className="w-4 h-4 text-primary-500 focus:ring-primary-500/20"
                        {...register('admissionMode')}
                      />
                      <span className="text-sm text-surface-700 dark:text-surface-300">UTME</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="Direct Entry"
                        className="w-4 h-4 text-primary-500 focus:ring-primary-500/20"
                        {...register('admissionMode')}
                      />
                      <span className="text-sm text-surface-700 dark:text-surface-300">Direct Entry</span>
                    </label>
                  </div>
                  {errors.admissionMode && <p className="text-xs text-danger-500 mt-1">{errors.admissionMode.message}</p>}
                </div>

                <Input
                  label="Year Admitted"
                  type="number"
                  placeholder="e.g. 2024"
                  leftIcon={<Calendar className="w-4 h-4" />}
                  error={errors.yearAdmitted?.message}
                  {...register('yearAdmitted')}
                />

                <div className="flex gap-4 mt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={prevStep} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                    Back
                  </Button>
                  <Button type="button" className="flex-1" onClick={nextStep} rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Continue
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Contact Information */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Contact Information
                </h3>

                <Input
                  label="Phone Number"
                  placeholder="e.g. 08012345678 or +2348012345678"
                  leftIcon={<Phone className="w-4 h-4" />}
                  error={errors.phone?.message}
                  {...register('phone')}
                />

                <div className="border-t border-surface-200 dark:border-surface-700 pt-4">
                  <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Emergency Contact</h4>

                  <Input
                    label="Contact Name"
                    placeholder="e.g. Jane Doe"
                    leftIcon={<User className="w-4 h-4" />}
                    error={errors.emergencyContact?.message}
                    {...register('emergencyContact')}
                  />

                  <div className="mt-3">
                    <Input
                      label="Contact Phone"
                      placeholder="e.g. 08098765432"
                      leftIcon={<Phone className="w-4 h-4" />}
                      error={errors.emergencyContactPhone?.message}
                      {...register('emergencyContactPhone')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                    Home Address (optional)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-surface-400" />
                    <textarea
                      placeholder="Enter your home address (max 200 chars)"
                      maxLength={200}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none h-20"
                      {...register('homeAddress')}
                    />
                  </div>
                  {errors.homeAddress && <p className="text-xs text-danger-500 mt-1">{errors.homeAddress.message}</p>}
                  {watchedValues.homeAddress && (
                    <p className="text-xs text-surface-400 mt-1 text-right">{(watchedValues.homeAddress || '').length}/200</p>
                  )}
                </div>

                <div className="flex gap-4 mt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={prevStep} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                    Back
                  </Button>
                  <Button type="button" className="flex-1" onClick={nextStep} rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Review
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Review & Submit */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Review Your Details
                </h3>

                <div className="bg-surface-50 dark:bg-surface-800/50 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-surface-400 font-medium">Full Name</p>
                      <p className="text-surface-900 dark:text-white">{watchedValues.fullName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-400 font-medium">Date of Birth</p>
                      <p className="text-surface-900 dark:text-white">{watchedValues.dateOfBirth || '—'} {watchedValues.dateOfBirth ? `(${getAge(watchedValues.dateOfBirth)})` : ''}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-400 font-medium">Matric Number</p>
                      <p className="text-surface-900 dark:text-white">{watchedValues.matricNumber || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-400 font-medium">Level</p>
                      <p className="text-surface-900 dark:text-white">{watchedValues.level ? `${watchedValues.level} Level` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-400 font-medium">Admission Mode</p>
                      <p className="text-surface-900 dark:text-white">{watchedValues.admissionMode || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-400 font-medium">Year Admitted</p>
                      <p className="text-surface-900 dark:text-white">{watchedValues.yearAdmitted || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-400 font-medium">Phone</p>
                      <p className="text-surface-900 dark:text-white">{watchedValues.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-400 font-medium">Emergency Contact</p>
                      <p className="text-surface-900 dark:text-white">{watchedValues.emergencyContact || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-surface-400 font-medium">Emergency Phone</p>
                      <p className="text-surface-900 dark:text-white">{watchedValues.emergencyContactPhone || '—'}</p>
                    </div>
                    {watchedValues.homeAddress && (
                      <div className="col-span-2">
                        <p className="text-xs text-surface-400 font-medium">Home Address</p>
                        <p className="text-surface-900 dark:text-white">{watchedValues.homeAddress}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-primary-50 dark:bg-primary-950/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-primary-700 dark:text-primary-300">
                    Please verify all details are correct. Some information may require admin approval to change later.
                  </p>
                </div>

                <div className="flex gap-4 mt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={prevStep} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" leftIcon={<CheckCircle className="w-4 h-4" />}>
                    Complete Setup
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
