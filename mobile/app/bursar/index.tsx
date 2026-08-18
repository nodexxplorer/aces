import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Text from '../../src/components/ui/Text';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import { getBursarDashboard, type BursarDashboardStats, type BursarDashboardResponse } from '../../src/api/bursar';

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

// The bursar hub, reached from Profile once a user has switched into
// class_bursar/dept_bursar mode — same pattern as the Class Rep Tools hub
// (app/class-rep/index.tsx).
export default function BursarHubScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [stats, setStats] = useState<BursarDashboardStats | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeDues, setActiveDues] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBursarDashboard()
      .then((res: BursarDashboardResponse) => {
        setStats(res.stats);
        setPendingCount(res.pending_payments?.length ?? 0);
        setActiveDues(res.active_dues ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen>
      <Pressable style={styles.backRow} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={20} color={theme.primary} />
        <Text style={[styles.backLabel, { color: theme.primary }]}>Profile</Text>
      </Pressable>

      <Text style={[styles.header, { color: theme.text }]}>Bursar Tools</Text>
      <Text style={{ color: theme.textMuted, fontSize: fontSize.sm, marginBottom: spacing.md }}>
        Tools available while you're in Bursar mode.
      </Text>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {loading ? '—' : formatCurrency(stats?.total_outstanding ?? 0)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Outstanding</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.success }]}>
            {loading ? '—' : formatCurrency(stats?.today_collection ?? 0)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Today</Text>
        </Card>
      </View>

      <Animated.View entering={FadeInDown.duration(350)}>
        <Pressable onPress={() => router.push('/bursar/verify' as Href)}>
          <Card style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons name="checkmark-done-outline" size={20} color={theme.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>Verify Payments</Text>
              <Text style={[styles.rowDesc, { color: theme.textMuted }]}>
                {loading ? 'Loading...' : `${pendingCount} payment${pendingCount !== 1 ? 's' : ''} awaiting review`}
              </Text>
            </View>
            {pendingCount > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.warning }]}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
          </Card>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(350).delay(40)}>
        <Pressable onPress={() => router.push('/bursar/dues' as Href)}>
          <Card style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons name="pricetags-outline" size={20} color={theme.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>Dues Management</Text>
              <Text style={[styles.rowDesc, { color: theme.textMuted }]}>
                {loading ? 'Loading...' : `${activeDues ?? 0} active due${activeDues === 1 ? '' : 's'}`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
          </Card>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(350).delay(80)}>
        <Pressable onPress={() => router.push('/bursar/payment-history' as Href)}>
          <Card style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons name="receipt-outline" size={20} color={theme.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>Payment History</Text>
              <Text style={[styles.rowDesc, { color: theme.textMuted }]}>Full transaction ledger</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
          </Card>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(350).delay(120)}>
        <Pressable onPress={() => router.push('/bursar/defaulters' as Href)}>
          <Card style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons name="alert-circle-outline" size={20} color={theme.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>Defaulter List</Text>
              <Text style={[styles.rowDesc, { color: theme.textMuted }]}>Students with unpaid dues</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
          </Card>
        </Pressable>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    gap: 2,
  },
  statValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
  statLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  rowDesc: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: '#fff',
  },
});
