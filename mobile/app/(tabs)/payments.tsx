import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, ScrollView, Linking, Alert } from 'react-native';
import Text from '../../src/components/ui/Text';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import EmptyState from '../../src/components/ui/EmptyState';
import { haptics } from '../../src/utils/haptics';
import { useAuthStore } from '../../src/store/authStore';
import {
  getMyDues,
  getStudentPayments,
  addToCart,
  clearStudentCart,
  checkoutCart,
  type DuePayment,
  type Payment,
} from '../../src/api/payments';

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

const TONE_KEYS = {
  primary: { icon: 'primary', muted: 'primaryMuted' },
  success: { icon: 'success', muted: 'successMuted' },
  warning: { icon: 'warning', muted: 'warningMuted' },
  danger: { icon: 'danger', muted: 'dangerMuted' },
} as const;

const TYPE_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; tone: keyof typeof TONE_KEYS }> = {
  dept_dues: { label: 'Dept Dues', icon: 'business-outline', tone: 'primary' },
  class_dues: { label: 'Class Dues', icon: 'people-outline', tone: 'success' },
  materials: { label: 'Materials', icon: 'book-outline', tone: 'warning' },
  transcript_fee: { label: 'Transcript', icon: 'document-text-outline', tone: 'danger' },
  other: { label: 'Other', icon: 'wallet-outline', tone: 'primary' },
};

export default function PaymentsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [dues, setDues] = useState<DuePayment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [payingId, setPayingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    const [duesData, paymentsData] = await Promise.allSettled([
      getMyDues(user.level),
      getStudentPayments(user.id),
    ]);
    if (duesData.status === 'fulfilled') setDues(duesData.value);
    if (paymentsData.status === 'fulfilled') setPayments(paymentsData.value);
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

  const outstandingDues = useMemo(() => {
    const paidDueNames = new Set(payments.filter((p) => p.status === 'completed').map((p) => p.item_name));
    return dues.filter((d) => d.is_active && !paidDueNames.has(d.name));
  }, [dues, payments]);

  const types = useMemo(() => Array.from(new Set(outstandingDues.map((d) => d.type))), [outstandingDues]);

  const filteredDues = useMemo(() => {
    const q = search.trim().toLowerCase();
    return outstandingDues.filter((d) => {
      const matchesType = typeFilter === 'all' || d.type === typeFilter;
      const matchesSearch =
        !q || d.name.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [outstandingDues, search, typeFilter]);

  const handlePay = async (due: DuePayment) => {
    if (payingId) return;
    setPayingId(due.id);
    haptics.tap();
    try {
      // Clear first so this "tap a due, pay it" flow always checks out
      // exactly this one due — not whatever else might be sitting in the
      // shared cart from a different session (e.g. the web app).
      await clearStudentCart();
      await addToCart(due.id, due.amount);
      const res = await checkoutCart();
      if (res?.authorization_url) {
        haptics.success();
        await Linking.openURL(res.authorization_url);
      } else {
        Alert.alert('Checkout Error', 'No payment link was returned. Please try again.');
      }
    } catch (err) {
      haptics.error();
      Alert.alert('Could Not Start Payment', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setPayingId(null);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: theme.text }]}>Payments</Text>
        <Pressable
          onPress={() => router.push('/(tabs)/profile/payments')}
          hitSlop={10}
          style={[styles.iconButton, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        >
          <Ionicons name="time-outline" size={20} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.toolRow}>
        {searchOpen ? (
          <View style={[styles.searchInputWrap, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Ionicons name="search" size={16} color={theme.textFaint} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search dues..."
              placeholderTextColor={theme.textFaint}
              autoFocus
              style={[styles.searchInput, { color: theme.text }]}
            />
            <Pressable
              onPress={() => {
                setSearchOpen(false);
                setSearch('');
              }}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={theme.textFaint} />
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsRow}
              style={styles.flex}
            >
              <FilterChip label="All" active={typeFilter === 'all'} onPress={() => setTypeFilter('all')} />
              {types.map((t) => (
                <FilterChip
                  key={t}
                  label={TYPE_META[t]?.label ?? t}
                  active={typeFilter === t}
                  onPress={() => setTypeFilter(t)}
                />
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setSearchOpen(true)}
              hitSlop={10}
              style={[styles.iconButton, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <Ionicons name="search" size={18} color={theme.text} />
            </Pressable>
          </>
        )}
      </View>

      {!loading && filteredDues.length === 0 ? (
        <Card>
          <EmptyState
            title={outstandingDues.length === 0 ? "You're all caught up" : 'No matching dues'}
            description={
              outstandingDues.length === 0 ? 'No outstanding dues to pay right now.' : 'Try a different search or filter.'
            }
          />
        </Card>
      ) : (
        <View style={styles.grid}>
          {filteredDues.map((due, index) => {
            const meta = TYPE_META[due.type] ?? TYPE_META.other;
            const toneKeys = TONE_KEYS[meta.tone];
            const busy = payingId === due.id;
            return (
              <Animated.View
                key={due.id}
                entering={FadeInDown.duration(300).delay(index * 40)}
                style={styles.tileWrap}
              >
                <Pressable
                  onPress={() => handlePay(due)}
                  disabled={!!payingId}
                  style={({ pressed }) => [
                    styles.tile,
                    { backgroundColor: theme.card, borderColor: theme.cardBorder },
                    (pressed || busy) && { opacity: 0.7 },
                  ]}
                >
                  <View style={[styles.tileIconWrap, { backgroundColor: theme[toneKeys.muted] }]}>
                    <Ionicons
                      name={busy ? 'hourglass-outline' : meta.icon}
                      size={22}
                      color={theme[toneKeys.icon]}
                    />
                  </View>
                  <Text style={[styles.tileName, { color: theme.text }]} numberOfLines={2}>
                    {due.name}
                  </Text>
                  <Text style={[styles.tileAmount, { color: theme.primary }]}>{formatCurrency(due.amount)}</Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? theme.primary : theme.cardBorder,
          backgroundColor: active ? theme.primaryMuted : 'transparent',
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? theme.primary : theme.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filterChipsRow: {
    flexDirection: 'row',
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
  searchInputWrap: {
    flex: 1,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tileWrap: {
    width: '30%',
  },
  tile: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileName: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    textAlign: 'center',
    minHeight: 28,
  },
  tileAmount: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
  },
});
