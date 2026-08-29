import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Alert, TextInput, ScrollView } from 'react-native';
import Text from '../../src/components/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import Button from '../../src/components/ui/Button';
import { haptics } from '../../src/utils/haptics';
import { getErrorMessage } from '../../src/utils/errors';
import { getBursarDashboard, verifyPayment, type PendingPayment } from '../../src/api/bursar';

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

const METHOD_FILTER_ALL = 'all';
const LEVEL_FILTER_ALL = 'all';

export default function BursarVerifyScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState(METHOD_FILTER_ALL);
  const [levelFilter, setLevelFilter] = useState<string>(LEVEL_FILTER_ALL);

  const load = () => {
    return getBursarDashboard()
      .then((res) => setPayments(res.pending_payments ?? []))
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

  const handleVerify = async (payment: PendingPayment) => {
    setVerifyingId(payment.id);
    try {
      await verifyPayment(payment.id);
      haptics.success();
      setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    } catch (err) {
      Alert.alert('Could Not Verify', getErrorMessage(err, 'Please try again'));
    } finally {
      setVerifyingId(null);
    }
  };

  const methodOptions = useMemo(() => {
    const distinct = Array.from(new Set(payments.map((p) => p.payment_method).filter(Boolean)));
    return [METHOD_FILTER_ALL, ...distinct];
  }, [payments]);

  const levelOptions = useMemo(() => {
    const distinct = Array.from(new Set(payments.map((p) => p.level))).sort((a, b) => a - b);
    return [LEVEL_FILTER_ALL, ...distinct.map(String)];
  }, [payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      const matchesSearch =
        !q || p.student_name.toLowerCase().includes(q) || p.matric_number.toLowerCase().includes(q);
      const matchesMethod = methodFilter === METHOD_FILTER_ALL || p.payment_method === methodFilter;
      const matchesLevel = levelFilter === LEVEL_FILTER_ALL || String(p.level) === levelFilter;
      return matchesSearch && matchesMethod && matchesLevel;
    });
  }, [payments, search, methodFilter, levelFilter]);

  const totalPendingAmount = useMemo(() => filtered.reduce((sum, p) => sum + p.amount, 0), [filtered]);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Pressable style={styles.backRow} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={20} color={theme.primary} />
        <Text style={[styles.backLabel, { color: theme.primary }]}>Bursar Tools</Text>
      </Pressable>

      <Text style={[styles.header, { color: theme.text }]}>Verify Payments</Text>

      {/* Summary strip */}
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {loading ? '—' : filtered.length}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Awaiting Review</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text
            style={[styles.summaryValue, { color: theme.warning }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {loading ? '—' : formatCurrency(totalPendingAmount)}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Total Pending</Text>
        </Card>
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Ionicons name="search" size={16} color={theme.textFaint} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or matric number..."
          placeholderTextColor={theme.textFaint}
          style={[styles.searchInput, { color: theme.text }]}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={theme.textFaint} />
          </Pressable>
        )}
      </View>

      {/* Level filter chips */}
      {levelOptions.length > 2 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {levelOptions.map((lvl) => {
            const active = levelFilter === lvl;
            return (
              <Pressable
                key={lvl}
                onPress={() => setLevelFilter(lvl)}
                style={[
                  styles.chip,
                  { backgroundColor: active ? theme.primary : theme.card, borderColor: theme.cardBorder },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? theme.onPrimary : theme.textMuted }]}>
                  {lvl === LEVEL_FILTER_ALL ? 'All Levels' : `${lvl}L`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Payment method filter chips */}
      {methodOptions.length > 2 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {methodOptions.map((m) => {
            const active = methodFilter === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMethodFilter(m)}
                style={[
                  styles.chip,
                  { backgroundColor: active ? theme.primary : theme.card, borderColor: theme.cardBorder },
                ]}
              >
                <Text
                  style={[styles.chipText, { color: active ? theme.onPrimary : theme.textMuted }]}
                  numberOfLines={1}
                >
                  {m === METHOD_FILTER_ALL ? 'All Methods' : m}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {!loading && filtered.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons
            name={payments.length === 0 ? 'checkmark-circle-outline' : 'file-tray-outline'}
            size={32}
            color={payments.length === 0 ? theme.success : theme.textFaint}
          />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {payments.length === 0 ? 'All clear' : 'No matches'}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: fontSize.xs }}>
            {payments.length === 0 ? 'No pending verifications' : 'Try a different search or filter'}
          </Text>
        </Card>
      ) : (
        filtered.map((p, i) => (
          <Animated.View key={p.id} entering={FadeInDown.duration(300).delay(i * 30)}>
            <Card style={styles.paymentCard}>
              <View style={styles.paymentTop}>
                <View style={styles.flex}>
                  <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>
                    {p.student_name}
                  </Text>
                  <Text style={{ color: theme.textFaint, fontSize: fontSize.xs }} numberOfLines={1}>
                    {p.matric_number} · {p.level}L
                  </Text>
                </View>
                <Text style={[styles.amount, { color: theme.text }]} numberOfLines={1}>
                  {formatCurrency(p.amount)}
                </Text>
              </View>
              <View style={styles.paymentMeta}>
                <Text
                  style={{ color: theme.textMuted, fontSize: fontSize.xs, flex: 1 }}
                  numberOfLines={1}
                >
                  {p.due_name}
                </Text>
                <View style={[styles.methodBadge, { backgroundColor: theme.primaryMuted }]}>
                  <Text style={[styles.methodText, { color: theme.primary }]} numberOfLines={1}>
                    {p.payment_method}
                  </Text>
                </View>
              </View>
              <Button
                label={verifyingId === p.id ? 'Verifying...' : 'Verify'}
                size="sm"
                loading={verifyingId === p.id}
                disabled={verifyingId !== null}
                icon={<Ionicons name="checkmark" size={16} color={theme.onPrimary} />}
                onPress={() => handleVerify(p)}
                fullWidth
              />
            </Card>
          </Animated.View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
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
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 2,
  },
  summaryValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
  summaryLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    padding: 0,
  },
  chipRow: {
    marginBottom: spacing.sm,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
  },
  chipText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  paymentCard: {
    gap: spacing.sm,
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
    flexShrink: 0,
  },
  paymentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  methodBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    flexShrink: 0,
    maxWidth: 120,
  },
  methodText: {
    fontFamily: fontFamily.semibold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
});
