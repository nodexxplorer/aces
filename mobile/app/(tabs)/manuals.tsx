import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import Text from '../../src/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import Badge from '../../src/components/ui/Badge';
import { getManuals, getMyPurchases, type Manual, type ManualPurchase } from '../../src/api/manuals';

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

export default function ManualsScreen() {
  const { theme } = useTheme();
  const [tab, setTab] = useState<'browse' | 'mine'>('browse');
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [purchases, setPurchases] = useState<ManualPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    const [manualsData, purchasesData] = await Promise.allSettled([getManuals(), getMyPurchases()]);
    if (manualsData.status === 'fulfilled') setManuals(manualsData.value);
    if (purchasesData.status === 'fulfilled') setPurchases(purchasesData.value);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const purchasedIds = new Set(purchases.map((p) => p.manual_id));

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={[styles.header, { color: theme.text }]}>Manuals</Text>

      <View style={[styles.tabRow, { borderColor: theme.divider }]}>
        {(['browse', 'mine'] as const).map((t) => (
          <Text
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tabLabel,
              { color: tab === t ? theme.primary : theme.textMuted },
              tab === t && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
            ]}
          >
            {t === 'browse' ? 'Browse' : `My Manuals (${purchases.length})`}
          </Text>
        ))}
      </View>

      {tab === 'browse' ? (
        <FlatList
          data={manuals.filter((m) => m.is_active)}
          scrollEnabled={false}
          keyExtractor={(m) => m.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <Card>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  No manuals available right now.
                </Text>
              </Card>
            ) : null
          }
          renderItem={({ item, index }) => {
            const owned = purchasedIds.has(item.id);
            return (
              <Animated.View entering={FadeInDown.duration(350).delay(index * 40)}>
                <Card style={styles.row}>
                  <View style={[styles.iconWrap, { backgroundColor: theme.primaryMuted }]}>
                    <Ionicons name="book" size={20} color={theme.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.itemMeta, { color: theme.textFaint }]}>Level {item.level}</Text>
                  </View>
                  {owned ? (
                    <Badge label="Owned" tone="success" />
                  ) : (
                    <Text style={[styles.amount, { color: theme.text }]}>{formatCurrency(item.price)}</Text>
                  )}
                </Card>
              </Animated.View>
            );
          }}
        />
      ) : (
        <FlatList
          data={purchases}
          scrollEnabled={false}
          keyExtractor={(p) => p.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <Card>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  No manuals purchased yet.
                </Text>
              </Card>
            ) : null
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(350).delay(index * 40)}>
              <Card style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: theme.successMuted }]}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                    {item.manual_title}
                  </Text>
                  <Text style={[styles.itemMeta, { color: theme.textFaint }]}>
                    Purchased {new Date(item.purchased_at).toLocaleDateString()}
                  </Text>
                </View>
                <Badge label={item.is_collected ? 'Collected' : 'Not collected'} tone={item.is_collected ? 'success' : 'neutral'} />
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
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
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
