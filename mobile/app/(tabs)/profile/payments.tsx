import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import Text from '../../../src/components/ui/Text';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../../src/theme/typography';
import Screen from '../../../src/components/ui/Screen';
import Card from '../../../src/components/ui/Card';
import Badge from '../../../src/components/ui/Badge';
import EmptyState from '../../../src/components/ui/EmptyState';
import { useAuthStore } from '../../../src/store/authStore';
import { getStudentPayments, type Payment } from '../../../src/api/payments';

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

const STATUS_TONE: Record<Payment['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  completed: 'success',
  pending: 'warning',
  failed: 'danger',
  refunded: 'neutral',
};

const STATUS_FILTERS = ['all', 'completed', 'pending', 'failed', 'refunded'] as const;

export default function TransactionHistoryScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all');

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    try {
      setPayments(await getStudentPayments(user.id));
    } catch {
      // pull-to-refresh is right there
    }
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesSearch =
        !q ||
        p.item_name.toLowerCase().includes(q) ||
        (p.paystack_reference ?? '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [payments, search, statusFilter]);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Pressable style={styles.backRow} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={20} color={theme.primary} />
        <Text style={[styles.backLabel, { color: theme.primary }]}>Payments</Text>
      </Pressable>

      <Text style={[styles.header, { color: theme.text }]}>Transaction History</Text>

      <View style={[styles.searchInputWrap, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Ionicons name="search" size={16} color={theme.textFaint} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or reference..."
          placeholderTextColor={theme.textFaint}
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>

      <View style={styles.filterChipsRow}>
        {STATUS_FILTERS.map((s) => {
          const active = statusFilter === s;
          return (
            <Pressable
              key={s}
              onPress={() => setStatusFilter(s)}
              style={[
                styles.chip,
                { borderColor: active ? theme.primary : theme.cardBorder, backgroundColor: active ? theme.primaryMuted : 'transparent' },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? theme.primary : theme.textMuted }]}>
                {s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        scrollEnabled={false}
        keyExtractor={(p) => p.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          !loading ? (
            <Card>
              <EmptyState
                title={payments.length === 0 ? 'No transactions yet' : 'No matching transactions'}
                description={
                  payments.length === 0 ? 'Your payment history will show up here.' : 'Try a different search or filter.'
                }
              />
            </Card>
          ) : null
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.duration(350).delay(index * 40)}>
            <Card style={styles.row}>
              <View style={styles.flex}>
                <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                  {item.item_name}
                </Text>
                <Text style={[styles.itemMeta, { color: theme.textFaint }]}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                <Text style={[styles.amount, { color: theme.text }]}>{formatCurrency(item.amount)}</Text>
                <Badge label={item.status} tone={STATUS_TONE[item.status]} />
              </View>
            </Card>
          </Animated.View>
        )}
      />
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
  },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    height: '100%',
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemName: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  itemMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  amount: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
  },
});
