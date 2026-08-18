import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Text from '../../src/components/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import { getDefaulters, type Defaulter } from '../../src/api/payments';

const LEVEL_OPTIONS = ['all', 100, 200, 300, 400, 500] as const;

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

export default function BursarDefaultersScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [levelFilter, setLevelFilter] = useState<(typeof LEVEL_OPTIONS)[number]>('all');

  const load = () => {
    return getDefaulters()
      .then(setDefaulters)
      .catch(() => setDefaulters([]));
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(
    () => (levelFilter === 'all' ? defaulters : defaulters.filter((d) => d.level === levelFilter)),
    [defaulters, levelFilter],
  );

  const totalOutstanding = useMemo(() => filtered.reduce((sum, d) => sum + Number(d.total_outstanding), 0), [filtered]);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Pressable style={styles.backRow} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={20} color={theme.primary} />
        <Text style={[styles.backLabel, { color: theme.primary }]}>Bursar Tools</Text>
      </Pressable>

      <Text style={[styles.header, { color: theme.text }]}>Defaulter List</Text>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.text }]}>{loading ? '—' : filtered.length}</Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Students</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.danger }]}>
            {loading ? '—' : formatCurrency(totalOutstanding)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Outstanding</Text>
        </Card>
      </View>

      <View style={styles.chipRow}>
        {LEVEL_OPTIONS.map((l) => {
          const active = levelFilter === l;
          return (
            <Pressable
              key={l}
              onPress={() => setLevelFilter(l)}
              style={[
                styles.filterChip,
                { borderColor: active ? theme.primary : theme.cardBorder, backgroundColor: active ? theme.primaryMuted : 'transparent' },
              ]}
            >
              <Text style={[styles.filterChipText, { color: active ? theme.primary : theme.text }]}>
                {l === 'all' ? 'All Levels' : `${l} Level`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ color: theme.textMuted, fontSize: fontSize.sm, marginTop: spacing.md, marginBottom: spacing.sm }}>
        {loading ? 'Loading...' : `${filtered.length} defaulter${filtered.length !== 1 ? 's' : ''}`}
      </Text>

      {!loading && filtered.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="checkmark-circle-outline" size={28} color={theme.success} />
          <Text style={{ color: theme.textMuted, fontSize: fontSize.xs }}>No defaulters — everyone's paid up</Text>
        </Card>
      ) : (
        filtered.map((d, i) => (
          <Animated.View key={d.student_id} entering={FadeInDown.duration(300).delay(Math.min(i, 10) * 30)}>
            <Card style={styles.defaulterCard}>
              <View style={styles.flex}>
                <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>
                  {d.full_name}
                </Text>
                <Text style={{ color: theme.textFaint, fontSize: fontSize.xs }}>
                  {d.matric_number} · {d.level} Level
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
                  {d.unpaid_dues_count} unpaid due{d.unpaid_dues_count !== 1 ? 's' : ''}
                </Text>
              </View>
              <Text style={[styles.outstanding, { color: theme.danger }]}>{formatCurrency(Number(d.total_outstanding))}</Text>
            </Card>
          </Animated.View>
        ))
      )}
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
    marginBottom: spacing.md,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  defaulterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  studentName: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  outstanding: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
  },
});
