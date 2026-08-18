import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
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

export default function BursarVerifyScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

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

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Pressable style={styles.backRow} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={20} color={theme.primary} />
        <Text style={[styles.backLabel, { color: theme.primary }]}>Bursar Tools</Text>
      </Pressable>

      <Text style={[styles.header, { color: theme.text }]}>Verify Payments</Text>
      <Text style={{ color: theme.textMuted, fontSize: fontSize.sm, marginBottom: spacing.md }}>
        {loading ? 'Loading...' : `${payments.length} payment${payments.length !== 1 ? 's' : ''} awaiting review`}
      </Text>

      {!loading && payments.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="checkmark-circle-outline" size={32} color={theme.success} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>All clear</Text>
          <Text style={{ color: theme.textMuted, fontSize: fontSize.xs }}>No pending verifications</Text>
        </Card>
      ) : (
        payments.map((p, i) => (
          <Animated.View key={p.id} entering={FadeInDown.duration(300).delay(i * 30)}>
            <Card style={styles.paymentCard}>
              <View style={styles.paymentTop}>
                <View style={styles.flex}>
                  <Text style={[styles.studentName, { color: theme.text }]}>{p.student_name}</Text>
                  <Text style={{ color: theme.textFaint, fontSize: fontSize.xs }}>{p.matric_number}</Text>
                </View>
                <Text style={[styles.amount, { color: theme.text }]}>{formatCurrency(p.amount)}</Text>
              </View>
              <View style={styles.paymentMeta}>
                <Text style={{ color: theme.textMuted, fontSize: fontSize.xs }}>{p.due_name}</Text>
                <View style={[styles.methodBadge, { backgroundColor: theme.primaryMuted }]}>
                  <Text style={[styles.methodText, { color: theme.primary }]}>{p.payment_method}</Text>
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
  },
  paymentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  methodBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  methodText: {
    fontFamily: fontFamily.semibold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
});
