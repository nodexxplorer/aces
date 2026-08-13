import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import Text from '../../src/components/ui/Text';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import Badge from '../../src/components/ui/Badge';
import { useAuthStore } from '../../src/store/authStore';
import { getMyDues, getStudentPayments, getStudentPaymentSummary, type DuePayment, type Payment } from '../../src/api/payments';

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

const STATUS_TONE: Record<Payment['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  completed: 'success',
  pending: 'warning',
  failed: 'danger',
  refunded: 'neutral',
};

export default function PaymentsScreen() {
  const { theme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'dues' | 'history'>('dues');
  const [dues, setDues] = useState<DuePayment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<{ amount_paid: number; amount_pending: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    const [duesData, paymentsData, summaryData] = await Promise.allSettled([
      getMyDues(user.level),
      getStudentPayments(user.id),
      getStudentPaymentSummary(user.id),
    ]);
    if (duesData.status === 'fulfilled') setDues(duesData.value);
    if (paymentsData.status === 'fulfilled') setPayments(paymentsData.value);
    if (summaryData.status === 'fulfilled') setSummary(summaryData.value);
  }, [user?.id, user?.level]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const paidDueNames = new Set(payments.filter((p) => p.status === 'completed').map((p) => p.item_name));

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={[styles.header, { color: theme.text }]}>Payments & Dues</Text>

      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Paid</Text>
          <Text style={[styles.summaryValue, { color: theme.success }]}>
            {formatCurrency(summary?.amount_paid ?? 0)}
          </Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Outstanding</Text>
          <Text style={[styles.summaryValue, { color: theme.warning }]}>
            {formatCurrency(summary?.amount_pending ?? 0)}
          </Text>
        </Card>
      </View>

      <View style={[styles.tabRow, { borderColor: theme.divider }]}>
        {(['dues', 'history'] as const).map((t) => (
          <Text
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tabLabel,
              { color: tab === t ? theme.primary : theme.textMuted },
              tab === t && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
            ]}
          >
            {t === 'dues' ? 'Dues to Pay' : 'Transaction History'}
          </Text>
        ))}
      </View>

      {tab === 'dues' ? (
        <FlatList
          data={dues.filter((d) => d.is_active && !paidDueNames.has(d.name))}
          scrollEnabled={false}
          keyExtractor={(d) => d.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <Card>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  No outstanding dues. You're all caught up.
                </Text>
              </Card>
            ) : null
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(350).delay(index * 40)}>
              <Card style={styles.row}>
                <View style={styles.flex}>
                  <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                  {item.deadline && (
                    <Text style={[styles.itemMeta, { color: theme.textFaint }]}>
                      Due {new Date(item.deadline).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <Text style={[styles.amount, { color: theme.text }]}>{formatCurrency(item.amount)}</Text>
              </Card>
            </Animated.View>
          )}
        />
      ) : (
        <FlatList
          data={payments}
          scrollEnabled={false}
          keyExtractor={(p) => p.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <Card>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  No transactions yet.
                </Text>
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
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
  },
  summaryLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
  summaryValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    marginTop: spacing.xs,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xl,
  },
  tabLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    paddingBottom: spacing.sm,
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
