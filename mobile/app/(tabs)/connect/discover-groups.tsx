import { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import Text from '../../../src/components/ui/Text';
import Card from '../../../src/components/ui/Card';
import Button from '../../../src/components/ui/Button';
import Badge from '../../../src/components/ui/Badge';
import Screen from '../../../src/components/ui/Screen';
import EmptyState from '../../../src/components/ui/EmptyState';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontFamily, fontSize, spacing } from '../../../src/theme/typography';
import { haptics } from '../../../src/utils/haptics';
import { getPublicGroups, getMyGroups, joinGroup, type PublicGroup } from '../../../src/api/connect';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '?';
}

export default function DiscoverGroupsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [groups, setGroups] = useState<PublicGroup[]>([]);
  const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([getPublicGroups(), getMyGroups()])
      .then(([groupsRes, mineRes]) => {
        if (groupsRes.status === 'fulfilled') setGroups(groupsRes.value);
        if (mineRes.status === 'fulfilled') setMyGroupIds(new Set(mineRes.value.map((g) => g.id)));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleJoin = async (group: PublicGroup) => {
    setJoiningId(group.id);
    haptics.tap();
    try {
      await joinGroup(group.id);
      haptics.success();
      setMyGroupIds((prev) => new Set(prev).add(group.id));
    } catch (err) {
      haptics.error();
      Alert.alert('Could Not Join', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Discover Groups</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <Text style={{ color: theme.textMuted }}>Loading...</Text>
      ) : groups.length === 0 ? (
        <EmptyState title="No public groups yet" description="Be the first to start one." />
      ) : (
        <FlatList
          data={groups}
          scrollEnabled={false}
          keyExtractor={(g) => g.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => {
            const joined = myGroupIds.has(item.id);
            return (
              <Card style={styles.row}>
                <View style={[styles.avatarFallback, { backgroundColor: theme.primary }]}>
                  <Text style={styles.avatarText}>{initials(item.name)}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.itemMeta, { color: theme.textFaint }]}>
                    {item.member_count} member{item.member_count === 1 ? '' : 's'}
                  </Text>
                </View>
                {joined ? (
                  <Badge label="Joined" tone="success" />
                ) : (
                  <Button label="Join" size="sm" loading={joiningId === item.id} onPress={() => handleJoin(item)} />
                )}
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: '#fff',
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
});
