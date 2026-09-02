import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, TextInput, Image } from 'react-native';
import Text from '../../../src/components/ui/Text';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../../src/theme/typography';
import Screen from '../../../src/components/ui/Screen';
import Card from '../../../src/components/ui/Card';
import Button from '../../../src/components/ui/Button';
import Badge from '../../../src/components/ui/Badge';
import EmptyState from '../../../src/components/ui/EmptyState';
import { haptics } from '../../../src/utils/haptics';
import { useAuthStore } from '../../../src/store/authStore';
import { useUnreadStore } from '../../../src/store/unreadStore';
import { useWebSocket, getChatSocketUrl } from '../../../src/hooks/useWebSocket';
import { getMediaUrl } from '../../../src/api/client';
import { PROFILE_SCAN_PARAM } from '../../../src/config';
import {
  getDirectory,
  getPendingRequests,
  sendConnectionRequest,
  respondToConnection,
  getConnectionUserIds,
  getMyConversations,
  getMyGroups,
  type DirectoryUser,
  type Connection,
  type DMConversation,
  type GroupConversation,
  type ChatMessage,
  type GroupMessage,
} from '../../../src/api/connect';

const TABS = [
  { key: 'chats', label: 'Chats' },
  { key: 'discover', label: 'Discover' },
  { key: 'requests', label: 'Requests' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '?';
}

function timeLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function Avatar({ url, name, size = 44 }: { url: string | null; name: string; size?: number }) {
  const { theme } = useTheme();
  const resolvedUrl = getMediaUrl(url);
  if (resolvedUrl) {
    return (
      <Image
        source={{ uri: resolvedUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.primary },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

function QuickConnectBanner({
  targetId,
  directory,
  connectedIds,
  onSendRequest,
  onDismiss,
  busy,
}: {
  targetId: string;
  directory: DirectoryUser[];
  connectedIds: Set<string>;
  onSendRequest: (id: string) => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  const { theme } = useTheme();
  const target = directory.find((d) => d.id === targetId);
  const alreadyConnected = connectedIds.has(targetId);

  return (
    <Card style={[styles.scanBanner, { borderColor: theme.primary, backgroundColor: theme.primaryMuted }]}>
      <View style={[styles.scanIconWrap, { backgroundColor: theme.card }]}>
        <Ionicons name="scan" size={18} color={theme.primary} />
      </View>
      {!target ? (
        <Text style={[styles.scanBannerText, { color: theme.textMuted }]}>
          Couldn't find that student in the directory.
        </Text>
      ) : (
        <>
          <Avatar url={target.avatar_url} name={target.full_name} size={38} />
          <View style={styles.flex}>
            <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
              {target.full_name}
            </Text>
            <Text style={[styles.itemMeta, { color: theme.textFaint }]}>
              {target.matric_number} · Level {target.level}
            </Text>
          </View>
          {alreadyConnected ? (
            <Badge label="Connected" tone="success" />
          ) : (
            <Pressable
              onPress={() => onSendRequest(targetId)}
              disabled={busy}
              style={[styles.iconButton, { backgroundColor: theme.card }]}
            >
              <Ionicons name="person-add-outline" size={16} color={theme.primary} />
            </Pressable>
          )}
        </>
      )}
      <Pressable onPress={onDismiss} hitSlop={8}>
        <Ionicons name="close" size={18} color={theme.textFaint} />
      </Pressable>
    </Card>
  );
}

export default function ConnectScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { [PROFILE_SCAN_PARAM]: scannedUserId } = useLocalSearchParams<{ [PROFILE_SCAN_PARAM]?: string }>();
  const [scanDismissed, setScanDismissed] = useState(false);

  const [tab, setTab] = useState<TabKey>('chats');
  const [search, setSearch] = useState('');
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [requests, setRequests] = useState<Connection[]>([]);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { lastMessage } = useWebSocket(user ? getChatSocketUrl() : undefined);
  const setUnreadCounts = useUnreadStore((s) => s.setCounts);

  const fetchAll = useCallback(async () => {
    const [dir, convos, grps, reqs, ids] = await Promise.allSettled([
      getDirectory(),
      getMyConversations(),
      getMyGroups(),
      getPendingRequests(),
      getConnectionUserIds(),
    ]);
    if (dir.status === 'fulfilled') setDirectory(dir.value);
    if (convos.status === 'fulfilled') {
      setConversations(convos.value);
      const counts: Record<string, number> = {};
      for (const c of convos.value) {
        if (c.unread_count > 0) counts[c.other_user_id] = c.unread_count;
      }
      setUnreadCounts(counts);
    }
    if (grps.status === 'fulfilled') setGroups(grps.value);
    if (reqs.status === 'fulfilled') setRequests(reqs.value);
    if (ids.status === 'fulfilled') setConnectedIds(new Set(ids.value));
  }, [setUnreadCounts]);

  // useFocusEffect (not a plain mount-only useEffect) so unread counts and
  // the chat list refresh every time this screen regains focus — including
  // coming back from a conversation, where markMessageRead already fired.
  const hasLoadedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnce.current) {
        hasLoadedOnce.current = true;
        setLoading(true);
        fetchAll().finally(() => setLoading(false));
      } else {
        fetchAll();
      }
    }, [fetchAll]),
  );

  // A message arriving anywhere in the app while Connect itself is on screen
  // should refresh the list live, same as the web version.
  useEffect(() => {
    if (!lastMessage) return;
    try {
      const frame = JSON.parse(lastMessage) as { type: string; payload: ChatMessage & GroupMessage };
      if (frame.type === 'chat' || frame.type === 'group_chat') {
        fetchAll();
      }
    } catch {
      // ignore malformed frames
    }
  }, [lastMessage, fetchAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const handleSendRequest = async (targetId: string) => {
    setBusyId(targetId);
    haptics.tap();
    try {
      await sendConnectionRequest(targetId);
      setConnectedIds((prev) => new Set(prev).add(targetId));
      haptics.success();
    } catch {
      haptics.error();
    } finally {
      setBusyId(null);
    }
  };

  const handleRespond = async (connectionId: string, status: 'accepted' | 'rejected') => {
    setBusyId(connectionId);
    haptics.tap();
    try {
      await respondToConnection(connectionId, status);
      setRequests((prev) => prev.filter((r) => r.id !== connectionId));
      if (status === 'accepted') {
        fetchAll();
      }
      haptics.success();
    } catch {
      haptics.error();
    } finally {
      setBusyId(null);
    }
  };

  const filteredDirectory = directory.filter(
    (d) =>
      !search ||
      d.full_name.toLowerCase().includes(search.toLowerCase()) ||
      d.matric_number?.toLowerCase().includes(search.toLowerCase()),
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: theme.text }]}>Connect</Text>
        {tab === 'chats' && (
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/connect/discover-groups' as never)}
              hitSlop={8}
              style={[styles.headerIconButton, { backgroundColor: theme.card }]}
            >
              <Ionicons name="compass-outline" size={18} color={theme.primary} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/connect/join-link' as never)}
              hitSlop={8}
              style={[styles.headerIconButton, { backgroundColor: theme.card }]}
            >
              <Ionicons name="link-outline" size={18} color={theme.primary} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/connect/new-group' as never)}
              hitSlop={8}
              style={[styles.headerIconButton, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="add" size={20} color={theme.onPrimary} />
            </Pressable>
          </View>
        )}
      </View>

      {scannedUserId && !scanDismissed && scannedUserId !== user?.id && (
        <Animated.View entering={FadeInDown.duration(250)}>
          <QuickConnectBanner
            targetId={scannedUserId}
            directory={directory}
            connectedIds={connectedIds}
            onSendRequest={handleSendRequest}
            onDismiss={() => setScanDismissed(true)}
            busy={busyId === scannedUserId}
          />
        </Animated.View>
      )}

      <View style={[styles.tabRow, { borderColor: theme.divider }]}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tabButton}>
            <View style={styles.tabLabelRow}>
              <Text
                style={[
                  styles.tabLabel,
                  { color: tab === t.key ? theme.primary : theme.textMuted },
                  tab === t.key && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
                ]}
              >
                {t.label}
              </Text>
              {t.key === 'requests' && requests.length > 0 && (
                <View style={[styles.countBadge, { backgroundColor: theme.danger }]}>
                  <Text style={styles.countBadgeText}>{requests.length}</Text>
                </View>
              )}
              {t.key === 'chats' && totalUnread > 0 && (
                <View style={[styles.countBadge, { backgroundColor: theme.danger }]}>
                  <Text style={styles.countBadgeText}>{totalUnread > 9 ? '9+' : totalUnread}</Text>
                </View>
              )}
            </View>
          </Pressable>
        ))}
      </View>

      {tab === 'discover' && (
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={theme.textFaint} style={styles.searchIcon} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or matric no..."
            placeholderTextColor={theme.textFaint}
            style={[styles.searchInput, { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.text }]}
          />
        </View>
      )}

      {tab === 'chats' && (
        <View style={{ gap: spacing.lg }}>
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: theme.textFaint }]}>GROUPS</Text>
            </View>
            {groups.length === 0 ? (
              !loading && (
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  No groups yet — tap + to start one.
                </Text>
              )
            ) : (
              <FlatList
                data={groups}
                scrollEnabled={false}
                keyExtractor={(g) => g.id}
                ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
                renderItem={({ item, index }) => (
                  <Animated.View entering={FadeInDown.duration(300).delay(index * 40)}>
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/connect/group/${item.id}?name=${encodeURIComponent(item.name)}&memberCount=${item.member_count}` as never,
                        )
                      }
                    >
                      <Card style={styles.row}>
                        <Avatar url={item.avatar_url} name={item.name} />
                        <View style={styles.flex}>
                          <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={[styles.itemMeta, { color: theme.textFaint }]} numberOfLines={1}>
                            {item.last_message
                              ? `${item.last_message_sender ? item.last_message_sender.split(' ')[0] + ': ' : ''}${item.last_message}`
                              : `${item.member_count} member${item.member_count === 1 ? '' : 's'}`}
                          </Text>
                        </View>
                        <Text style={[styles.timeLabel, { color: theme.textFaint }]}>
                          {timeLabel(item.last_message_at)}
                        </Text>
                      </Card>
                    </Pressable>
                  </Animated.View>
                )}
              />
            )}
          </View>

          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: theme.textFaint }]}>DIRECT MESSAGES</Text>
            </View>
            {conversations.length === 0 ? (
              !loading && (
                <Card>
                  <EmptyState title="No conversations yet" description="Find classmates in Discover." />
                </Card>
              )
            ) : (
              <FlatList
                data={conversations}
                scrollEnabled={false}
                keyExtractor={(c) => c.connection_id}
                ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
                renderItem={({ item, index }) => (
                  <Animated.View entering={FadeInDown.duration(300).delay(index * 40)}>
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/connect/chat/${item.other_user_id}?name=${encodeURIComponent(item.other_full_name)}` as never,
                        )
                      }
                    >
                      <Card style={styles.row}>
                        <Avatar url={item.other_avatar_url} name={item.other_full_name} />
                        <View style={styles.flex}>
                          <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                            {item.other_full_name}
                          </Text>
                          <Text style={[styles.itemMeta, { color: theme.textFaint }]} numberOfLines={1}>
                            {item.last_message ? `${item.last_message_mine ? 'You: ' : ''}${item.last_message}` : 'Say hello!'}
                          </Text>
                        </View>
                        {item.unread_count > 0 ? (
                          <View style={[styles.countBadge, { backgroundColor: theme.primary }]}>
                            <Text style={styles.countBadgeText}>
                              {item.unread_count > 9 ? '9+' : item.unread_count}
                            </Text>
                          </View>
                        ) : (
                          <Text style={[styles.timeLabel, { color: theme.textFaint }]}>
                            {timeLabel(item.last_message_at)}
                          </Text>
                        )}
                      </Card>
                    </Pressable>
                  </Animated.View>
                )}
              />
            )}
          </View>
        </View>
      )}

      {tab === 'requests' && (
        <FlatList
          data={requests}
          scrollEnabled={false}
          keyExtractor={(r) => r.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <Card>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  No pending requests.
                </Text>
              </Card>
            ) : null
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(300).delay(index * 40)}>
              <Card style={styles.row}>
                <Avatar url={item.avatar_url} name={item.full_name} />
                <View style={styles.flex}>
                  <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                    {item.full_name}
                  </Text>
                  <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{item.role}</Text>
                </View>
                <View style={styles.requestActions}>
                  <Pressable
                    onPress={() => handleRespond(item.id, 'rejected')}
                    disabled={busyId === item.id}
                    style={[styles.iconButton, { backgroundColor: theme.dangerMuted }]}
                  >
                    <Ionicons name="close" size={16} color={theme.danger} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleRespond(item.id, 'accepted')}
                    disabled={busyId === item.id}
                    style={[styles.iconButton, { backgroundColor: theme.successMuted }]}
                  >
                    <Ionicons name="checkmark" size={16} color={theme.success} />
                  </Pressable>
                </View>
              </Card>
            </Animated.View>
          )}
        />
      )}

      {tab === 'discover' && (
        <FlatList
          data={filteredDirectory}
          scrollEnabled={false}
          keyExtractor={(d) => d.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <Card>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  No students found.
                </Text>
              </Card>
            ) : null
          }
          renderItem={({ item, index }) => {
            const connected = connectedIds.has(item.id);
            return (
              <Animated.View entering={FadeInDown.duration(300).delay(index * 30)}>
                <Card style={styles.row}>
                  <Avatar url={item.avatar_url} name={item.full_name} />
                  <View style={styles.flex}>
                    <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                      {item.full_name}
                    </Text>
                    <Text style={[styles.itemMeta, { color: theme.textFaint }]}>
                      {item.matric_number} · Level {item.level}
                    </Text>
                  </View>
                  {connected ? (
                    <Badge label="Connected" tone="success" />
                  ) : (
                    <Pressable
                      onPress={() => handleSendRequest(item.id)}
                      disabled={busyId === item.id}
                      style={[styles.iconButton, { backgroundColor: theme.primaryMuted }]}
                    >
                      <Ionicons name="person-add-outline" size={16} color={theme.primary} />
                    </Pressable>
                  )}
                </Card>
              </Animated.View>
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
  },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  timeLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
  },
  scanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
  },
  scanIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBannerText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabButton: {
    marginRight: spacing.xl,
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tabLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    paddingBottom: spacing.sm,
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginBottom: spacing.sm,
  },
  countBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    color: '#fff',
  },
  searchRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 1,
  },
  searchInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing['3xl'],
    paddingRight: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamily.bold,
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
    textTransform: 'capitalize',
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
