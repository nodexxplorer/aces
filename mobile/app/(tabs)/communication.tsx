import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import Badge from '../../src/components/ui/Badge';
import {
  listMyNotifications,
  listAnnouncementsFeed,
  markNotificationRead,
  type NotificationItem,
  type AnnouncementFeedItem,
} from '../../src/api/communication';

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function CommunicationScreen() {
  const { theme } = useTheme();
  const [tab, setTab] = useState<'notifications' | 'announcements'>('notifications');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    const [notifs, ann] = await Promise.allSettled([listMyNotifications(), listAnnouncementsFeed()]);
    if (notifs.status === 'fulfilled') setNotifications(notifs.value);
    if (ann.status === 'fulfilled') setAnnouncements(ann.value);
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

  const handleReadNotification = async (n: NotificationItem) => {
    if (n.is_read) return;
    setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)));
    try {
      await markNotificationRead(n.id);
    } catch {
      // optimistic update stands even if the sync call fails silently
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={[styles.header, { color: theme.text }]}>Communication</Text>

      <View style={[styles.tabRow, { borderColor: theme.divider }]}>
        {(['notifications', 'announcements'] as const).map((t) => (
          <Text
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tabLabel,
              { color: tab === t ? theme.primary : theme.textMuted },
              tab === t && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
            ]}
          >
            {t === 'notifications' ? 'Notifications' : 'Announcements'}
          </Text>
        ))}
      </View>

      {tab === 'notifications' ? (
        <FlatList
          data={notifications}
          scrollEnabled={false}
          keyExtractor={(n) => n.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <Card>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  You're all caught up — no notifications.
                </Text>
              </Card>
            ) : null
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(350).delay(index * 40)}>
              <Pressable onPress={() => handleReadNotification(item)}>
                <Card style={styles.notifCard}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: item.is_read ? 'transparent' : theme.primary },
                    ]}
                  />
                  <View style={styles.flex}>
                    <Text
                      style={[
                        styles.itemName,
                        { color: theme.text, fontFamily: item.is_read ? fontFamily.medium : fontFamily.semibold },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={[styles.itemBody, { color: theme.textMuted }]} numberOfLines={2}>
                      {item.message}
                    </Text>
                    <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{timeAgo(item.created_at)}</Text>
                  </View>
                </Card>
              </Pressable>
            </Animated.View>
          )}
        />
      ) : (
        <FlatList
          data={announcements}
          scrollEnabled={false}
          keyExtractor={(a) => a.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <Card>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  No announcements right now.
                </Text>
              </Card>
            ) : null
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(350).delay(index * 40)}>
              <Card>
                <View style={styles.announcementHeader}>
                  <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.is_pinned && <Ionicons name="pin" size={14} color={theme.primary} />}
                </View>
                <Text style={[styles.itemBody, { color: theme.textMuted }]} numberOfLines={3}>
                  {item.content}
                </Text>
                <View style={styles.announcementFooter}>
                  <Badge label={item.category} tone="neutral" />
                  <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{timeAgo(item.created_at)}</Text>
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
  notifCard: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginTop: 6,
  },
  itemName: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  itemBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 18,
  },
  itemMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  announcementFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
});
