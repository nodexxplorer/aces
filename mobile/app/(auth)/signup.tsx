import { useState } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import Text from '../../src/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Button from '../../src/components/ui/Button';
import { signupStudent } from '../../src/api/auth';
import { useAuthStore } from '../../src/store/authStore';
import { getErrorMessage } from '../../src/utils/errors';

const LEVELS = [100, 200, 300, 400, 500];

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  rightElement,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  rightElement?: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textFaint}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={false}
          style={[
            styles.input,
            rightElement ? styles.inputWithRight : undefined,
            { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.text },
          ]}
        />
        {rightElement}
      </View>
    </View>
  );
}

export default function SignupScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [level, setLevel] = useState<number | null>(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !matricNumber.trim() || !level) {
      setError('Fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const { user, tokens } = await signupStudent({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        matricNumber: matricNumber.trim().toUpperCase(),
        level,
      });
      await login(user, tokens);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create your account. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Create Account</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
            Sign up with your student details to get started.
          </Text>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label="First Name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
            </View>
            <View style={styles.flex}>
              <Field label="Last Name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
            </View>
          </View>

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
          />

          <Field
            label="Matric Number"
            value={matricNumber}
            onChangeText={setMatricNumber}
            placeholder="e.g. 20/EG/CO/1477"
            autoCapitalize="none"
          />

          <View>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Level</Text>
            <View style={styles.levelRow}>
              {LEVELS.map((l) => (
                <Pressable
                  key={l}
                  onPress={() => setLevel(l)}
                  style={[
                    styles.levelChip,
                    {
                      backgroundColor: level === l ? theme.primary : theme.card,
                      borderColor: level === l ? theme.primary : theme.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.levelChipText, { color: level === l ? theme.onPrimary : theme.text }]}>
                    {l}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Field
            label="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            placeholder="080..."
            keyboardType="phone-pad"
          />

          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry={!showPassword}
            rightElement={
              <Pressable style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)} hitSlop={12}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textMuted} />
              </Pressable>
            }
          />

          <Field
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter password"
            secureTextEntry={!showPassword}
          />

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.dangerMuted }]}>
              <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            </View>
          ) : null}

          <Button label="Create Account" onPress={handleSignup} loading={loading} fullWidth size="lg" />

          <Pressable onPress={() => router.back()} style={styles.loginLinkRow}>
            <Text style={[styles.loginLinkText, { color: theme.textMuted }]}>
              Already have an account? <Text style={{ color: theme.primary, fontFamily: fontFamily.semibold }}>Sign In</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  headerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    marginTop: spacing.sm,
  },
  headerSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  form: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['4xl'],
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inputRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
  },
  inputWithRight: {
    paddingRight: spacing['3xl'],
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
  },
  levelRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  levelChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  levelChipText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  errorBox: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  loginLinkRow: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  loginLinkText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
});
