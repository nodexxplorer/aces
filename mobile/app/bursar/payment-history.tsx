import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import Text from '../../src/components/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import type { Theme } from '../../src/theme/colors';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import { getAllPayments, type Payment } from '../../src/api/payments';

const STATUS_OPTIONS = ['all', 'completed', 'pending', 'failed', 'refunded'] as const;

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}


function statusColors(theme: Theme, status: string) {
  switch (status) {
    case 'completed':
      return { text: theme.success, bg: theme.successMuted };
    case 'pending':
      return { text: theme.warning, bg: theme.warningMuted };
    case 'failed':
      return { text: theme.danger, bg: theme.dangerMuted };
    default:
      return { text: theme.textMuted, bg: theme.primaryMuted };
  }
}

export default function BursarPaymentHistoryScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>('all');

  const load = () => {
    return getAllPayments()
      .then(setPayments)
      .catch(() => setPayments([]));
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.student_name?.toLowerCase().includes(q) ||
        p.matric_number?.toLowerCase().includes(q) ||
        p.due_name?.toLowerCase().includes(q) ||
        p.item_name?.toLowerCase().includes(q) ||
        p.paystack_reference?.toLowerCase().includes(q)
      );
    });
  }, [payments, search, statusFilter]);

  const totalCollected = useMemo(
    () => payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0),
    [payments],
  );

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Pressable style={styles.backRow} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={20} color={theme.primary} />
        <Text style={[styles.backLabel, { color: theme.primary }]}>Bursar Tools</Text>
      </Pressable>

      <Text style={[styles.header, { color: theme.text }]}>Payment History</Text>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.text }]}>{loading ? '—' : payments.length}</Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Transactions</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.success }]}>
            {loading ? '—' : formatCurrency(totalCollected)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Collected</Text>
        </Card>
      </View>

      <View style={[styles.searchRow, { borderColor: theme.cardBorder }]}>
        <Ionicons name="search" size={16} color={theme.textFaint} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, matric, reference..."
          placeholderTextColor={theme.textFaint}
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>

      <View style={styles.chipRow}>
        {STATUS_OPTIONS.map((s) => {
          const active = statusFilter === s;
          return (
            <Pressable
              key={s}
              onPress={() => setStatusFilter(s)}
              style={[
                styles.filterChip,
                { borderColor: active ? theme.primary : theme.cardBorder, backgroundColor: active ? theme.primaryMuted : 'transparent' },
              ]}
            >
              <Text style={[styles.filterChipText, { color: active ? theme.primary : theme.text }]}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ color: theme.textMuted, fontSize: fontSize.sm, marginTop: spacing.md, marginBottom: spacing.sm }}>
        {loading ? 'Loading...' : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}
      </Text>

      {!loading && filtered.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="receipt-outline" size={28} color={theme.textFaint} />
          <Text style={{ color: theme.textMuted, fontSize: fontSize.xs }}>No transactions found</Text>
        </Card>
      ) : (
        filtered.map((p, i) => (
          <Animated.View key={p.id} entering={FadeInDown.duration(300).delay(Math.min(i, 10) * 30)}>
            <Card style={styles.paymentCard}>
              <View style={styles.paymentTop}>
                <View style={styles.flex}>
                  <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>
                    {p.student_name ?? 'Unknown'}
                  </Text>
                  <Text style={{ color: theme.textFaint, fontSize: fontSize.xs }}>{p.matric_number ?? '—'}</Text>
                </View>
                <Text style={[styles.amount, { color: theme.text }]}>{formatCurrency(Number(p.amount))}</Text>
              </View>
              <View style={styles.paymentMeta}>
                <Text style={{ color: theme.textMuted, fontSize: fontSize.xs }} numberOfLines={1}>
                  {p.due_name ?? p.item_name}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColors(theme, p.status).bg }]}>
                  <Text style={[styles.statusText, { color: statusColors(theme, p.status).text }]}>{p.status}</Text>
                </View>
              </View>
              <Text style={{ color: theme.textFaint, fontSize: 11, marginTop: 2 }}>{formatDate(p.created_at)}</Text>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
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
  paymentCard: {
    gap: 4,
    marginBottom: spacing.sm,
  },
  paymentTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  studentName: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  amount: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
  },
  paymentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusText: {
    fontFamily: fontFamily.semibold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
});
