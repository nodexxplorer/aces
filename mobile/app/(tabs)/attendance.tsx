import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import Button from '../../src/components/ui/Button';
import { getStudentDashboard, type StudentDashboard } from '../../src/api/dashboard';

export default function AttendanceScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<StudentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setData(await getStudentDashboard());
    } catch {
      // pull-to-refresh is right there
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const attendance = data?.attendance;
  const rate = Math.round(attendance?.attendance_rate ?? 0);
  const rateColor = rate >= 75 ? theme.success : rate >= 50 ? theme.warning : theme.danger;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={[styles.header, { color: theme.text }]}>Attendance</Text>

      <Animated.View entering={FadeInDown.duration(400)}>
        <Card style={styles.rateCard}>
          <View style={[styles.rateRing, { borderColor: rateColor }]}>
            <Text style={[styles.rateValue, { color: rateColor }]}>{loading ? '—' : `${rate}%`}</Text>
          </View>
          <Text style={[styles.rateLabel, { color: theme.text }]}>Overall Attendance Rate</Text>
          <View style={styles.rateStatsRow}>
            <View style={styles.rateStat}>
              <Text style={[styles.rateStatValue, { color: theme.text }]}>{attendance?.total_classes ?? 0}</Text>
              <Text style={[styles.rateStatLabel, { color: theme.textMuted }]}>Total Classes</Text>
            </View>
            <View style={[styles.rateStatDivider, { backgroundColor: theme.divider }]} />
            <View style={styles.rateStat}>
              <Text style={[styles.rateStatValue, { color: theme.success }]}>{attendance?.attended ?? 0}</Text>
              <Text style={[styles.rateStatLabel, { color: theme.textMuted }]}>Attended</Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(120)}>
        <Card style={styles.checkinCard}>
          <View style={[styles.checkinIconWrap, { backgroundColor: theme.primaryMuted }]}>
            <Ionicons name="qr-code-outline" size={28} color={theme.primary} />
          </View>
          <Text style={[styles.checkinTitle, { color: theme.text }]}>Mark Yourself Present</Text>
          <Text style={[styles.checkinBody, { color: theme.textMuted }]}>
            When your class rep opens attendance, scan the QR code they display to check yourself in.
          </Text>
          <Button
            label="Scan to Check In"
            icon={<Ionicons name="qr-code-outline" size={18} color={theme.onPrimary} />}
            onPress={() => router.push('/scan')}
            fullWidth
            size="lg"
          />
        </Card>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
  },
  rateCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  rateRing: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  rateValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
  },
  rateLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  rateStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    width: '100%',
  },
  rateStat: {
    flex: 1,
    alignItems: 'center',
  },
  rateStatDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
  },
  rateStatValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
  rateStatLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  checkinCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkinIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
  },
  checkinBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
