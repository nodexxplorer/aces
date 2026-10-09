import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '../../src/components/ui/Text';
import Button from '../../src/components/ui/Button';
import DepartmentPicker from '../../src/components/DepartmentPicker';
import ModoolsAuthLayout from '../../src/components/auth/ModoolsAuthLayout';
import { useDepartmentChoice, type DepartmentChoice } from '../../src/hooks/useDepartmentChoice';
import { useModoolsSignIn } from '../../src/hooks/useModoolsSignIn';
import { AccentScope, useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import { departmentShortName } from '../../src/utils/department';

export default function LoginScreen() {
  // /co (and aceszone://co) arrive here with the department's short name, which
  // chooses that department. The screen then takes the department's colours.
  const params = useLocalSearchParams<{ code?: string }>();
  const dept = useDepartmentChoice(typeof params.code === 'string' ? params.code : undefined);
  const accent = dept.departments.find((d) => d.slug === dept.slug)?.accentColor;
  return (
    <AccentScope accent={accent}>
      <LoginForm dept={dept} />
    </AccentScope>
  );
}

function LoginForm({ dept }: { dept: DepartmentChoice }) {
  const { theme } = useTheme();
  const router = useRouter();
  const { configured, busy, error, signIn } = useModoolsSignIn();
  const chosen = dept.departments.find((d) => d.slug === dept.slug);
  // Sign-up opened from here starts with the department chosen here.
  const signupHref = chosen?.urlCode
    ? { pathname: '/(auth)/signup', params: { code: chosen.urlCode } }
    : '/(auth)/signup';
  const unavailable = configured === false;

  return (
    <ModoolsAuthLayout
      departmentName={departmentShortName(chosen?.name) ?? 'Your department'}
      title="Welcome back"
      subtitle="Students sign in with their Modools account."
    >
      <DepartmentPicker
        departments={dept.departments}
        value={dept.slug}
        onChange={dept.setSlug}
        loading={dept.loading}
        error={dept.error}
        onRetry={dept.reload}
      />

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: theme.dangerMuted }]}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
        </View>
      ) : null}

      <Button
        label={unavailable ? 'Modools sign-in unavailable' : 'Continue with Modools'}
        onPress={() => signIn(dept.slug)}
        loading={busy}
        disabled={unavailable}
        fullWidth
        size="lg"
      />
      <Text style={[styles.note, { color: theme.textMuted }]}>
        First time? Your account is created automatically. You set up your profile right after.
      </Text>

      <Pressable onPress={() => router.push(signupHref)} style={styles.linkRow}>
        <Text style={[styles.linkText, { color: theme.textMuted }]}>
          Don't have an account?{' '}
          <Text style={{ color: theme.primary, fontFamily: fontFamily.semibold }}>Sign Up</Text>
        </Text>
      </Pressable>
    </ModoolsAuthLayout>
  );
}

const styles = StyleSheet.create({
  errorBox: { borderRadius: radius.md, padding: spacing.md },
  errorText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  note: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, textAlign: 'center' },
  linkRow: { alignItems: 'center', marginTop: spacing.sm },
  linkText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
});
