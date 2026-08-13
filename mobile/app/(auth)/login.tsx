import { useState } from 'react';
import {
  View,
  TextInput,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import Text from '../../src/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import { palette } from '../../src/theme/colors';
import Button from '../../src/components/ui/Button';
import { login as loginRequest } from '../../src/api/auth';
import { useAuthStore } from '../../src/store/authStore';
import { getErrorMessage } from '../../src/utils/errors';

export default function LoginScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { user, tokens } = await loginRequest(email.trim(), password);
      await login(user, tokens);
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={[palette.primary[500], palette.primary[700]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}
        >
          <Animated.View entering={FadeInUp.duration(600).springify()} style={styles.heroContent}>
            <View style={styles.logoWrap}>
              <Image source={require('../../assets/aces-logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.heroTitle}>ACES Zone</Text>
            <Text style={styles.heroSubtitle}>Association of Computer Engineering Students</Text>
          </Animated.View>
        </LinearGradient>

        <Animated.View
          entering={FadeInDown.duration(500).delay(150).springify()}
          style={[styles.sheet, { backgroundColor: theme.background }]}
        >
          <Text style={[styles.welcome, { color: theme.text }]}>Welcome back</Text>
          <Text style={[styles.welcomeSub, { color: theme.textMuted }]}>Sign in to continue to your dashboard.</Text>

          <View style={styles.form}>
            <View>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Email or Matric Number</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.textFaint}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                style={[
                  styles.input,
                  { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.text },
                ]}
              />
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textFaint}
                  secureTextEntry={!showPassword}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.text },
                  ]}
                />
                <Pressable style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)} hitSlop={12}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={theme.textMuted}
                  />
                </Pressable>
              </View>
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: theme.dangerMuted }]}>
                <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
              </View>
            ) : null}

            <Button label="Sign In" onPress={handleLogin} loading={loading} fullWidth size="lg" />

            <Pressable onPress={() => router.push('/(auth)/signup')} style={styles.signupLinkRow}>
              <Text style={[styles.signupLinkText, { color: theme.textMuted }]}>
                Don't have an account?{' '}
                <Text style={{ color: theme.primary, fontFamily: fontFamily.semibold }}>Sign Up</Text>
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    height: '38%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: radius['2xl'],
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logo: {
    width: 60,
    height: 60,
  },
  heroTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: palette.white,
  },
  heroSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  sheet: {
    flex: 1,
    marginTop: -radius['2xl'],
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
  },
  welcome: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
  },
  welcomeSub: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  form: {
    marginTop: spacing['2xl'],
    gap: spacing.lg,
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: spacing['3xl'],
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
  },
  errorBox: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  signupLinkRow: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  signupLinkText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
});
