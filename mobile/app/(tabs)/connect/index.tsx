import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../../src/theme/typography';
import Screen from '../../../src/components/ui/Screen';
import Card from '../../../src/components/ui/Card';
import Button from '../../../src/components/ui/Button';
import Badge from '../../../src/components/ui/Badge';
import { haptics } from '../../../src/utils/haptics';
import { useAuthStore } from '../../../src/store/authStore';
import { useWebSocket, getChatSocketUrl } from '../../../src/hooks/useWebSocket';
import { PROFILE_SCAN_PARAM } from '../../../src/config';
import {
  getDirectory,
  getMyConnections,
  getPendingRequests,
  sendConnectionRequest,
  respondToConnection,
  getConnectionUserIds,
  getUnreadCounts,
  type DirectoryUser,
  type Connection,
  type ChatMessage,
} from '../../../src/api/connect';

const TABS = [
  { key: 'connections', label: 'Connections' },
  { key: 'requests', label: 'Requests' },
  { key: 'directory', label: 'Directory' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '?';
}

function Avatar({ url, name, size = 44 }: { url: string | null; name: string; size?: number }) {
  const { theme } = useTheme();
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
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

  const [tab, setTab] = useState<TabKey>('connections');
  const [search, setSearch] = useState('');
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [requests, setRequests] = useState<Connection[]>([]);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { lastMessage } = useWebSocket(user ? getChatSocketUrl() : undefined);

  const fetchAll = useCallback(async () => {
    const [dir, conns, reqs, ids, counts] = await Promise.allSettled([
      getDirectory(),
      getMyConnections(),
      getPendingRequests(),
      getConnectionUserIds(),
      getUnreadCounts(),
    ]);
    if (dir.status === 'fulfilled') setDirectory(dir.value);
    if (conns.status === 'fulfilled') setConnections(conns.value);
    if (reqs.status === 'fulfilled') setRequests(reqs.value);
    if (ids.status === 'fulfilled') setConnectedIds(new Set(ids.value));
    if (counts.status === 'fulfilled') setUnread(counts.value);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  // A message arriving anywhere in the app while Connect itself is on screen
  // should update badges live, same as the web version.
  useEffect(() => {
    if (!lastMessage) return;
    try {
      const frame = JSON.parse(lastMessage) as { type: string; payload: ChatMessage };
      if (frame.type === 'chat') {
        getUnreadCounts()
          .then(setUnread)
          .catch(() => {});
      }
    } catch {
      // ignore malformed frames
    }
  }, [lastMessage]);

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

  const totalUnread = Object.values(unread).reduce((sum, n) => sum + n, 0);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={[styles.header, { color: theme.text }]}>Connect</Text>

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
              {t.key === 'connections' && totalUnread > 0 && (
                <View style={[styles.countBadge, { backgroundColor: theme.danger }]}>
                  <Text style={styles.countBadgeText}>{totalUnread > 9 ? '9+' : totalUnread}</Text>
                </View>
              )}
            </View>
          </Pressable>
        ))}
      </View>

      {tab === 'directory' && (
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

      {tab === 'connections' && (
        <FlatList
          data={connections}
          scrollEnabled={false}
          keyExtractor={(c) => c.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <Card>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  No connections yet — find classmates in Directory.
                </Text>
              </Card>
            ) : null
          }
          renderItem={({ item, index }) => {
            const otherId = item.requester_id === user?.id ? item.receiver_id : item.requester_id;
            const unreadCount = unread[otherId] ?? 0;
            return (
              <Animated.View entering={FadeInDown.duration(300).delay(index * 40)}>
                <Pressable
                  onPress={() => router.push(`/connect/chat/${otherId}?name=${encodeURIComponent(item.full_name)}`)}
                >
                  <Card style={styles.row}>
                    <Avatar url={item.avatar_url} name={item.full_name} />
                    <View style={styles.flex}>
                      <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                        {item.full_name}
                      </Text>
                      <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{item.role}</Text>
                    </View>
                    {unreadCount > 0 ? (
                      <View style={[styles.countBadge, { backgroundColor: theme.primary }]}>
                        <Text style={styles.countBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
                    )}
                  </Card>
                </Pressable>
              </Animated.View>
            );
          }}
        />
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

      {tab === 'directory' && (
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
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
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
