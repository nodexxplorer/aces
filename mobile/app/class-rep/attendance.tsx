import { Pressable } from 'react-native';
import Text from '../../src/components/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import VerifiedAttendance from '../../src/components/VerifiedAttendance';
import { StyleSheet } from 'react-native';

// Dedicated entry from Class Rep Tools. The shared verified-attendance view
// exposes operating controls only for a lecturer-delegated session; students
// retain their personal records and dispute access in either entry point.
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
      <Text
        style={{
          color: theme.textMuted,
          fontSize: fontSize.sm,
          marginBottom: spacing.md,
        }}
      >
        Operate only sessions delegated by your lecturer. Lecturer review and finalization happen on the web portal.
      </Text>

      <VerifiedAttendance />
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
