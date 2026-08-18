import { Pressable } from 'react-native';
import Text from '../../src/components/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import ClassRepAttendance from '../../src/components/ClassRepAttendance';
import { StyleSheet } from 'react-native';

// Dedicated class-rep attendance screen, reached only from the Class Rep
// Tools hub (app/class-rep/index.tsx) — deliberately separate from the
// (tabs)/attendance.tsx bottom-tab screen, which always shows the plain
// student view regardless of active role. Renders the same
// ClassRepAttendance component the earlier tab-swap approach used, just
// relocated to its own screen instead of replacing student content.
export default function ClassRepAttendanceScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <Screen>
      <Pressable style={styles.backRow} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={20} color={theme.primary} />
        <Text style={[styles.backLabel, { color: theme.primary }]}>Class Rep Tools</Text>
      </Pressable>

      <Text style={[styles.header, { color: theme.text }]}>Take Attendance</Text>
      <Text style={{ color: theme.textMuted, fontSize: fontSize.sm, marginBottom: spacing.md }}>
        Open a session, share the QR code, and review who's checked in.
      </Text>

      <ClassRepAttendance />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -spacing.sm,
  },
  backLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    marginLeft: 2,
  },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    marginTop: spacing.sm,
  },
});
