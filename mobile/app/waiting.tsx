import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Linking, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../src/theme/typography';
import Card from '../src/components/ui/Card';
import Button from '../src/components/ui/Button';
import { useAuthStore } from '../src/store/authStore';
import { getMe, logoutRequest } from '../src/api/auth';
import { haptics } from '../src/utils/haptics';

const HOD_EMAIL = 'hod@computer.engineering.uniuyo.edu.ng';

type ApprovalStatus = 'pending' | 'rejected' | 'approved';

export default function WaitingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [checking, setChecking] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const status: ApprovalStatus =
    user?.isApproved === false && user?.isActive === false
      ? 'rejected'
      : user?.isApproved === true
        ? 'approved'
        : 'pending';

  const fetchStatus = useCallback(async () => {
    try {
      const freshUser = await getMe();
      if (freshUser) setUser(freshUser);
    } catch {
      // keep last known status — the periodic poll or manual check will retry
    }
  }, [setUser]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
    // Once approved, Stack.Protected in app/_layout.tsx swaps this screen
    // out for (tabs) automatically — no manual navigation needed here.
  }, [fetchStatus]);

  const handleCheckStatus = async () => {
    haptics.tap();
    setChecking(true);
    await fetchStatus();
    setChecking(false);
  };

  const handleLogout = async () => {
    haptics.warning();
    setLoggingOut(true);
    await logoutRequest();
    await logout();
  };

  const contactHOD = (subject: string, body?: string) => {
    const params = new URLSearchParams({ subject, ...(body ? { body } : {}) });
    Linking.openURL(`mailto:${HOD_EMAIL}?${params.toString()}`).catch(() => {});
  };

  const displayName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Student';
  const statusConfig = {
    pending: { color: theme.warning, bg: theme.warningMuted, label: 'Under Review', icon: 'time-outline' as const },
    approved: { color: theme.success, bg: theme.successMuted, label: 'Approved', icon: 'checkmark-circle' as const },
    rejected: { color: theme.danger, bg: theme.dangerMuted, label: 'Rejected', icon: 'close-circle' as const },
  }[status];

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Card style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: statusConfig.bg }]}>
            <Ionicons name={statusConfig.icon} size={36} color={statusConfig.color} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>
            {status === 'approved' ? 'Approved!' : status === 'rejected' ? 'Registration Rejected' : 'Waiting for Approval'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {status === 'approved'
              ? 'Redirecting you to your dashboard...'
              : status === 'rejected'
                ? 'Your registration was not approved. Reach out to the HOD to find out why.'
                : 'Your account is being reviewed by the Department of Computer Engineering.'}
          </Text>

          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(80)}>
        <Card style={{ gap: spacing.md }}>
          <InfoRow label="Name" value={displayName} />
          <InfoRow label="Matric Number" value={user?.matricNumber || 'N/A'} />
          <InfoRow label="Level" value={user?.level ? `Level ${user.level}` : 'N/A'} />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(140)} style={{ gap: spacing.md }}>
        {status === 'pending' && (
          <Button label="Check Status" onPress={handleCheckStatus} loading={checking} fullWidth size="lg" />
        )}
        {status === 'rejected' && (
          <Button
            label="Contact HOD"
            variant="danger"
            icon={<Ionicons name="mail-outline" size={18} color={theme.onPrimary} />}
            onPress={() =>
              contactHOD(
                'ACES Zone Registration Appeal',
                `Hello HOD,\n\nI am writing regarding my rejected registration on ACES Zone.\n\nMy name: ${displayName}\nMatric Number: ${user?.matricNumber || 'N/A'}\n\nPlease let me know if there are any issues I can address.\n\nThank you.`,
              )
            }
            fullWidth
            size="lg"
          />
        )}
        <Button
          label="Contact HOD (General Inquiry)"
          variant="outline"
          icon={<Ionicons name="mail-outline" size={18} color={theme.text} />}
          onPress={() => contactHOD('ACES Zone Registration Inquiry')}
          fullWidth
          size="lg"
        />
        <Button label="Log Out" variant="ghost" onPress={handleLogout} loading={loggingOut} fullWidth size="md" />
      </Animated.View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: theme.textFaint }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  statusBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusBadgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
});
