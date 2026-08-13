import { useState } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import Text from '../../../src/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../../src/theme/typography';
import Screen from '../../../src/components/ui/Screen';
import Card from '../../../src/components/ui/Card';
import Button from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/authStore';
import { logoutRequest } from '../../../src/api/auth';
import { haptics } from '../../../src/utils/haptics';
import { WEB_ORIGIN, PROFILE_SCAN_PARAM } from '../../../src/config';

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIconWrap, { backgroundColor: theme.primaryMuted }]}>
        <Ionicons name={icon} size={16} color={theme.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.infoLabel, { color: theme.textFaint }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: 'default' | 'primary';
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const iconColor = tone === 'primary' ? theme.primary : theme.text;
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.6 }]}
      onPress={() => {
        haptics.select();
        onPress();
      }}
    >
      <View style={[styles.menuIconWrap, { backgroundColor: theme.primaryMuted }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[styles.menuLabel, { color: theme.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    haptics.warning();
    setLoggingOut(true);
    await logoutRequest();
    await logout();
    // No manual navigation needed — Stack.Protected in app/_layout.tsx
    // switches to the (auth) group the moment isAuthenticated flips to false.
  };

  return (
    <Screen>
      <Text style={[styles.header, { color: theme.text }]}>Profile</Text>

      <Animated.View entering={FadeInDown.duration(400)}>
        <Card style={styles.identityCard}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarText}>{initials(user?.firstName, user?.lastName)}</Text>
            </View>
          )}
          <Text style={[styles.name, { color: theme.text }]}>{user?.fullName ?? 'Student'}</Text>
          <Text style={[styles.email, { color: theme.textMuted }]}>{user?.email}</Text>
        </Card>
      </Animated.View>

      {user?.id && (
        <Animated.View entering={FadeInDown.duration(400).delay(30)}>
          <Card style={styles.qrCard}>
            <View style={styles.qrWrap}>
              <QRCode
                value={`${WEB_ORIGIN}/connect?${PROFILE_SCAN_PARAM}=${user.id}`}
                size={148}
                color={theme.primary}
                backgroundColor={theme.card}
              />
            </View>
            <Text style={[styles.qrTitle, { color: theme.text }]}>My Student QR</Text>
            <Text style={[styles.qrHint, { color: theme.textMuted }]}>
              Let a classmate or class rep scan this to connect or check you in.
            </Text>
          </Card>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.duration(400).delay(60)}>
        <Card style={{ gap: spacing.lg }}>
          {user?.matricNumber && <InfoRow icon="card-outline" label="Matric Number" value={user.matricNumber} />}
          {user?.level != null && <InfoRow icon="school-outline" label="Level" value={String(user.level)} />}
          <InfoRow icon="shield-checkmark-outline" label="Role" value={user?.activeRole ?? user?.role ?? 'Student'} />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(120)}>
        <Card padded={false}>
          <MenuRow icon="cash-outline" label="Payments & Dues" onPress={() => router.push('/profile/payments')} />
          <View style={[styles.menuDivider, { backgroundColor: theme.divider }]} />
          <MenuRow icon="create-outline" label="Edit Profile" onPress={() => router.push('/profile/edit')} />
          <View style={[styles.menuDivider, { backgroundColor: theme.divider }]} />
          <MenuRow icon="settings-outline" label="Settings" onPress={() => router.push('/profile/settings')} />
          <View style={[styles.menuDivider, { backgroundColor: theme.divider }]} />
          <MenuRow icon="help-buoy-outline" label="Support" onPress={() => router.push('/profile/support')} />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(180)}>
        <Button
          label="Log Out"
          variant="danger"
          icon={<Ionicons name="log-out-outline" size={18} color={theme.onPrimary} />}
          onPress={handleLogout}
          loading={loggingOut}
          fullWidth
          size="lg"
        />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
  },
  identityCard: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: '#ffffff',
  },
  name: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
  email: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  qrCard: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  qrWrap: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#ffffff',
    marginBottom: spacing.xs,
  },
  qrTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
  },
  qrHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  infoValue: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg + 34 + spacing.md,
  },
});
