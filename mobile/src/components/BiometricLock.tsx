import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Text from './ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../theme/typography';
import Button from './ui/Button';
import { authenticateWithBiometrics, getBiometricLabel } from '../utils/biometrics';
import { haptics } from '../utils/haptics';
import { useAuthStore } from '../store/authStore';
import { logoutRequest } from '../api/auth';

// A full-screen overlay (not a route) so the underlying Stack/tabs stay
// mounted underneath — it just covers them until the user unlocks, avoiding
// a nav-tree remount on every lock/unlock cycle.
export default function BiometricLock({ onUnlock }: { onUnlock: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const logout = useAuthStore((s) => s.logout);
  const [label, setLabel] = useState('Biometric Login');
  const [authenticating, setAuthenticating] = useState(false);
  const [failed, setFailed] = useState(false);

  const attempt = async () => {
    setAuthenticating(true);
    setFailed(false);
    const success = await authenticateWithBiometrics('Unlock ACES Zone');
    setAuthenticating(false);
    if (success) {
      haptics.success();
      onUnlock();
    } else {
      haptics.error();
      setFailed(true);
    }
  };

  useEffect(() => {
    getBiometricLabel().then(setLabel);
    attempt();
    // Only ever auto-prompt once, right when the lock appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    haptics.warning();
    await logoutRequest();
    await logout();
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[styles.container, { backgroundColor: theme.background, paddingBottom: insets.bottom + spacing.xl }]}
    >
      <View style={styles.center}>
        <View style={[styles.iconWrap, { backgroundColor: theme.primaryMuted }]}>
          <Ionicons name="finger-print" size={48} color={theme.primary} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>ACES Zone Locked</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          {failed ? `Couldn't verify — try ${label} again.` : `Use ${label} to continue.`}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label={`Unlock with ${label}`} onPress={attempt} loading={authenticating} fullWidth size="lg" />
        <Pressable onPress={handleLogout} style={styles.logoutLink} hitSlop={12}>
          <Text style={[styles.logoutText, { color: theme.textMuted }]}>Log out instead</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['4xl'],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  actions: {
    gap: spacing.md,
  },
  logoutLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  logoutText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
});
