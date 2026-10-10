import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '../../src/components/ui/Text';
import Button from '../../src/components/ui/Button';
import DepartmentPicker from '../../src/components/DepartmentPicker';
import ModoolsAuthLayout from '../../src/components/auth/ModoolsAuthLayout';
import SignInLookPicker from '../../src/components/auth/SignInLookPicker';
import { useDepartmentChoice, type DepartmentChoice } from '../../src/hooks/useDepartmentChoice';
import { useSignInLook } from '../../src/hooks/useSignInLook';
import { useModoolsSignIn } from '../../src/hooks/useModoolsSignIn';
import { AccentScope, useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import { resolveLoginTemplate } from '../../src/config/signInLook';
import { departmentShortName } from '../../src/utils/department';

// Students sign up with Modools, as on the website. The account is created the
// first time they sign in there; the matric number is checked at onboarding.
export default function SignupScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const dept = useDepartmentChoice(typeof params.code === 'string' ? params.code : undefined);
  const accent = dept.departments.find((d) => d.slug === dept.slug)?.accentColor;
  return (
    <AccentScope accent={accent}>
      <SignupForm dept={dept} />
    </AccentScope>
  );
}

function SignupForm({ dept }: { dept: DepartmentChoice }) {
  const { theme } = useTheme();
  const router = useRouter();
  const { configured, busy, error, signIn } = useModoolsSignIn();
  const chosen = dept.departments.find((d) => d.slug === dept.slug);
  const lookControls = useSignInLook(dept.slug);
  const template = resolveLoginTemplate(lookControls.look.template, Boolean(lookControls.look.imageUri));
  const loginHref = chosen?.urlCode
    ? { pathname: '/(auth)/login', params: { code: chosen.urlCode } }
    : '/(auth)/login';
  const unavailable = configured === false;

  return (
    <ModoolsAuthLayout
      departmentName={departmentShortName(chosen?.name) ?? 'Your department'}
      template={template}
      imageUri={lookControls.look.imageUri}
      picker={
        <SignInLookPicker
          slug={dept.slug}
          look={lookControls.look}
          onTemplate={lookControls.setTemplate}
          onImage={lookControls.setImage}
          onRemoveImage={lookControls.removeImage}
        />
      }
      title="Create your account"
      subtitle="Sign up with your Modools account. You set up your profile after."
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
        Your account is created the first time you sign in with Modools. Then you enter your matric number and finish
        your profile.
      </Text>

      <Pressable onPress={() => router.replace(loginHref)} style={styles.linkRow}>
        <Text style={[styles.linkText, { color: theme.textMuted }]}>
          Already have an account?{' '}
          <Text style={{ color: theme.primary, fontFamily: fontFamily.semibold }}>Sign In</Text>
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
