import { useState } from 'react';
import { View, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import Text from '../src/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../src/theme/typography';
import Card from '../src/components/ui/Card';
import Button from '../src/components/ui/Button';
import { useAuthStore } from '../src/store/authStore';
import { getMe, submitOnboarding, type OnboardingPayload } from '../src/api/auth';
import { isValidPhone, isValidDateOfBirth } from '../src/utils/validators';
import { getErrorMessage } from '../src/utils/errors';
import { haptics } from '../src/utils/haptics';

const TOTAL_STEPS = 4;
const STEP_LABELS = ['Personal', 'Academic', 'Contact', 'Review'];

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  error,
  multiline,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  error?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  const { theme } = useTheme();
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textFaint}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        maxLength={maxLength}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          { backgroundColor: theme.card, borderColor: error ? theme.danger : theme.cardBorder, color: theme.text },
        ]}
      />
      {error && <Text style={[styles.fieldError, { color: theme.danger }]}>{error}</Text>}
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.reviewRow}>
      <Text style={[styles.reviewLabel, { color: theme.textFaint }]}>{label}</Text>
      <Text style={[styles.reviewValue, { color: theme.text }]}>{value || '—'}</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const setUser = useAuthStore((s) => s.setUser);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [middleName, setMiddleName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [admissionMode, setAdmissionMode] = useState<'UTME' | 'Direct Entry'>('UTME');
  const [yearAdmitted, setYearAdmitted] = useState(String(new Date().getFullYear()));
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [homeAddress, setHomeAddress] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = (s: number): boolean => {
    const next: Record<string, string> = {};
    if (s === 1) {
      if (!dateOfBirth.trim()) next.dateOfBirth = 'Date of birth is required';
      else if (!isValidDateOfBirth(dateOfBirth.trim())) next.dateOfBirth = 'Use YYYY-MM-DD, and you must be 16+';
    }
    if (s === 2) {
      const year = parseInt(yearAdmitted, 10);
      if (!yearAdmitted.trim() || Number.isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
        next.yearAdmitted = 'Enter a valid year';
      }
    }
    if (s === 3) {
      if (!isValidPhone(phone.trim())) next.phone = 'Enter a valid Nigerian phone number';
      if (!emergencyContact.trim() || emergencyContact.trim().length < 3) {
        next.emergencyContact = 'Emergency contact name is required';
      }
      if (!isValidPhone(emergencyContactPhone.trim())) next.emergencyContactPhone = 'Enter a valid phone number';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const nextStep = () => {
    if (!validateStep(step)) return;
    haptics.tap();
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const prevStep = () => {
    haptics.tap();
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      setStep(1);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const payload: OnboardingPayload = {
        phone: phone.trim(),
        middleName: middleName.trim() || undefined,
        dateOfBirth: dateOfBirth.trim(),
        admissionMode,
        yearAdmitted: yearAdmitted.trim(),
        emergencyContact: emergencyContact.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        homeAddress: homeAddress.trim() || undefined,
        profilePhotoUrl: profilePhotoUrl.trim() || undefined,
      };
      await submitOnboarding(payload);
      haptics.success();
      // Refetch rather than build the user locally — matches waiting.tsx's
      // pattern and guarantees every derived/server-computed field (not just
      // the ones this form collected) is fresh.
      const freshUser = await getMe();
      if (freshUser) setUser(freshUser);
      // Stack.Protected in app/_layout.tsx swaps this screen out for (tabs)
      // automatically once onboardingCompleted flips to true — no manual
      // navigation needed here.
    } catch (err) {
      haptics.error();
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const getAge = (dob: string) => {
    if (!dob) return '';
    const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return Number.isFinite(age) && age >= 0 ? `${age} years old` : '';
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.headerBlock}>
          <View style={[styles.iconWrap, { backgroundColor: theme.primaryMuted }]}>
            <Ionicons name="person-outline" size={28} color={theme.primary} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Set Up Your Profile</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Step {step} of {TOTAL_STEPS} — Complete your details
          </Text>

          <View style={styles.progressRow}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.progressSegment,
                  { backgroundColor: i < step ? theme.primary : theme.divider },
                ]}
              />
            ))}
          </View>
          <View style={styles.progressLabels}>
            {STEP_LABELS.map((l) => (
              <Text key={l} style={[styles.progressLabel, { color: theme.textFaint }]}>
                {l}
              </Text>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(250)} key={step}>
          <Card style={{ gap: spacing.lg }}>
            {step === 1 && (
              <>
                <SectionTitle icon="person-outline" label="Personal Information" />
                <Field label="Middle Name (optional)" value={middleName} onChangeText={setMiddleName} placeholder="e.g. Adebayo" />
                <Field
                  label="Date of Birth"
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                  placeholder="YYYY-MM-DD"
                  error={errors.dateOfBirth}
                />
                {dateOfBirth.length === 10 && !errors.dateOfBirth && (
                  <Text style={[styles.hint, { color: theme.textFaint }]}>{getAge(dateOfBirth)}</Text>
                )}
                <Field
                  label="Profile Photo URL (optional)"
                  value={profilePhotoUrl}
                  onChangeText={setProfilePhotoUrl}
                  placeholder="https://example.com/photo.jpg"
                />
              </>
            )}

            {step === 2 && (
              <>
                <SectionTitle icon="book-outline" label="Academic Information" />
                <View>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Admission Mode</Text>
                  <View style={styles.modeRow}>
                    {(['UTME', 'Direct Entry'] as const).map((mode) => (
                      <Pressable
                        key={mode}
                        onPress={() => setAdmissionMode(mode)}
                        style={[
                          styles.modeChip,
                          {
                            backgroundColor: admissionMode === mode ? theme.primary : theme.card,
                            borderColor: admissionMode === mode ? theme.primary : theme.cardBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.modeChipText,
                            { color: admissionMode === mode ? theme.onPrimary : theme.text },
                          ]}
                        >
                          {mode}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Field
                  label="Year Admitted"
                  value={yearAdmitted}
                  onChangeText={setYearAdmitted}
                  placeholder="e.g. 2024"
                  keyboardType="number-pad"
                  error={errors.yearAdmitted}
                />
              </>
            )}

            {step === 3 && (
              <>
                <SectionTitle icon="call-outline" label="Contact Information" />
                <Field
                  label="Phone Number"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="e.g. 08012345678"
                  keyboardType="phone-pad"
                  error={errors.phone}
                />
                <Text style={[styles.subsectionLabel, { color: theme.textFaint }]}>EMERGENCY CONTACT</Text>
                <Field
                  label="Contact Name"
                  value={emergencyContact}
                  onChangeText={setEmergencyContact}
                  placeholder="e.g. Jane Doe"
                  error={errors.emergencyContact}
                />
                <Field
                  label="Contact Phone"
                  value={emergencyContactPhone}
                  onChangeText={setEmergencyContactPhone}
                  placeholder="e.g. 08098765432"
                  keyboardType="phone-pad"
                  error={errors.emergencyContactPhone}
                />
                <Field
                  label="Home Address (optional)"
                  value={homeAddress}
                  onChangeText={setHomeAddress}
                  placeholder="Enter your home address"
                  multiline
                  maxLength={200}
                />
              </>
            )}

            {step === 4 && (
              <>
                <SectionTitle icon="checkmark-circle-outline" label="Review Your Details" />
                <View style={[styles.reviewBox, { backgroundColor: theme.background }]}>
                  {middleName.trim() !== '' && <ReviewRow label="Middle Name" value={middleName} />}
                  <ReviewRow label="Date of Birth" value={dateOfBirth ? `${dateOfBirth} (${getAge(dateOfBirth)})` : ''} />
                  <ReviewRow label="Admission Mode" value={admissionMode} />
                  <ReviewRow label="Year Admitted" value={yearAdmitted} />
                  <ReviewRow label="Phone" value={phone} />
                  <ReviewRow label="Emergency Contact" value={emergencyContact} />
                  <ReviewRow label="Emergency Phone" value={emergencyContactPhone} />
                  {homeAddress.trim() !== '' && <ReviewRow label="Home Address" value={homeAddress} />}
                </View>

                <View style={[styles.noticeBox, { backgroundColor: theme.primaryMuted }]}>
                  <Ionicons name="information-circle-outline" size={16} color={theme.primary} />
                  <Text style={[styles.noticeText, { color: theme.primary }]}>
                    Please verify all details are correct. Some information may require admin approval to change later.
                  </Text>
                </View>

                {formError && (
                  <View style={[styles.noticeBox, { backgroundColor: theme.dangerMuted }]}>
                    <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
                    <Text style={[styles.noticeText, { color: theme.danger }]}>{formError}</Text>
                  </View>
                )}
              </>
            )}

            <View style={styles.navRow}>
              {step > 1 && (
                <View style={styles.flex}>
                  <Button
                    label="Back"
                    variant="outline"
                    onPress={prevStep}
                    icon={<Ionicons name="arrow-back" size={16} color={theme.text} />}
                    fullWidth
                  />
                </View>
              )}
              <View style={styles.flex}>
                {step < TOTAL_STEPS ? (
                  <Button
                    label="Continue"
                    onPress={nextStep}
                    icon={<Ionicons name="arrow-forward" size={16} color={theme.onPrimary} />}
                    fullWidth
                  />
                ) : (
                  <Button
                    label="Complete Setup"
                    onPress={handleSubmit}
                    loading={submitting}
                    icon={<Ionicons name="checkmark" size={16} color={theme.onPrimary} />}
                    fullWidth
                  />
                )}
              </View>
            </View>
          </Card>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionTitle({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={16} color={theme.textMuted} />
      <Text style={[styles.sectionTitleText, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  headerBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  progressRow: {
    flexDirection: 'row',
    gap: spacing.xs / 2,
    width: '100%',
    marginTop: spacing.md,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: spacing.xs,
  },
  progressLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionTitleText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  subsectionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldError: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: spacing.xs / 2,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: -spacing.sm,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeChip: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modeChipText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  reviewBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  reviewLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    flexShrink: 0,
  },
  reviewValue: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    flexShrink: 1,
    textAlign: 'right',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
