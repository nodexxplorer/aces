import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../../src/theme/typography';
import Screen from '../../../src/components/ui/Screen';
import Card from '../../../src/components/ui/Card';
import Button from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/authStore';
import { logoutRequest } from '../../../src/api/auth';

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

export default function ProfileScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logoutRequest();
    await logout();
    // No manual navigation needed — Stack.Protected in app/_layout.tsx
    // switches to the (auth) group the moment isAuthenticated flips to false.
  };

  return (
    <Screen>
      <Text style={[styles.header, { color: theme.text }]}>Profile</Text>

      <Card style={styles.identityCard}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Text style={styles.avatarText}>{initials(user?.firstName, user?.lastName)}</Text>
        </View>
        <Text style={[styles.name, { color: theme.text }]}>{user?.fullName ?? 'Student'}</Text>
        <Text style={[styles.email, { color: theme.textMuted }]}>{user?.email}</Text>
      </Card>

      <Card style={{ gap: spacing.lg }}>
        {user?.matricNumber && <InfoRow icon="card-outline" label="Matric Number" value={user.matricNumber} />}
        {user?.level != null && <InfoRow icon="school-outline" label="Level" value={String(user.level)} />}
        <InfoRow icon="shield-checkmark-outline" label="Role" value={user?.activeRole ?? user?.role ?? 'Student'} />
      </Card>

      <Button
        label="Edit Profile"
        variant="secondary"
        icon={<Ionicons name="create-outline" size={18} color={theme.primary} />}
        onPress={() => router.push('/(tabs)/profile/edit')}
        fullWidth
        size="lg"
      />

      <Button
        label="Log Out"
        variant="danger"
        icon={<Ionicons name="log-out-outline" size={18} color={theme.onPrimary} />}
        onPress={handleLogout}
        loading={loggingOut}
        fullWidth
        size="lg"
      />
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
});
