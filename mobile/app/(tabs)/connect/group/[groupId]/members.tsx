import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, Share, Alert } from 'react-native';
import Text from '../../../../../src/components/ui/Text';
import Card from '../../../../../src/components/ui/Card';
import Button from '../../../../../src/components/ui/Button';
import Screen from '../../../../../src/components/ui/Screen';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../../../../src/theme/typography';
import { haptics } from '../../../../../src/utils/haptics';
import { useAuthStore } from '../../../../../src/store/authStore';
import {
  getGroupMembers,
  getGroupInviteCode,
  addGroupMember,
  getMyConversations,
  type GroupMember,
  type DMConversation,
} from '../../../../../src/api/connect';
import { WEB_ORIGIN } from '../../../../../src/config';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '?';
}

export default function GroupMembersScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { groupId, name } = useLocalSearchParams<{ groupId: string; name?: string }>();
  const groupName = name ?? 'Group';
  const myId = useAuthStore((s) => s.user?.id);

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [connections, setConnections] = useState<DMConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    const [membersRes, connectionsRes] = await Promise.allSettled([
      getGroupMembers(groupId),
      getMyConversations(),
    ]);
    if (membersRes.status === 'fulfilled') setMembers(membersRes.value);
    if (connectionsRes.status === 'fulfilled') setConnections(connectionsRes.value);
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const myRole = members.find((m) => m.user_id === myId)?.role;
  const canAddMembers = myRole === 'admin' || myRole === 'moderator';
  const existingIds = new Set(members.map((m) => m.user_id));
  const candidates = connections.filter((c) => !existingIds.has(c.other_user_id));

  const handleShare = async () => {
    if (!groupId) return;
    setSharing(true);
    haptics.tap();
    try {
      const { invite_code } = await getGroupInviteCode(groupId);
      const link = `${WEB_ORIGIN}/connect?g=${invite_code}`;
      await Share.share({ message: `Join "${groupName}" on ACES Zone: ${link}` });
    } catch {
      Alert.alert('Could Not Share', 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const handleAdd = async (userId: string) => {
    if (!groupId) return;
    setAddingId(userId);
    haptics.tap();
    try {
      await addGroupMember(groupId, userId);
      haptics.success();
      load();
    } catch (err) {
      haptics.error();
      Alert.alert('Could Not Add', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>{groupName}</Text>
      </View>

      <Button
        label="Share Invite Link"
        icon={<Ionicons name="share-outline" size={18} color={theme.onPrimary} />}
        onPress={handleShare}
        loading={sharing}
        fullWidth
      />

      {canAddMembers && (
        <Pressable onPress={() => setShowAddPanel((v) => !v)} style={styles.addToggle}>
          <Ionicons name={showAddPanel ? 'chevron-up' : 'person-add-outline'} size={16} color={theme.primary} />
          <Text style={[styles.addToggleText, { color: theme.primary }]}>
            {showAddPanel ? 'Hide' : 'Add Members'}
          </Text>
        </Pressable>
      )}

      {canAddMembers && showAddPanel && (
        <Card style={{ gap: spacing.xs }}>
          {candidates.length === 0 ? (
            <Text style={{ color: theme.textMuted }}>All your connections are already in this group.</Text>
          ) : (
            candidates.map((c) => (
              <View key={c.other_user_id} style={[styles.memberRow, { borderColor: theme.divider }]}>
                <View style={[styles.avatarFallback, { backgroundColor: theme.primaryMuted }]}>
                  <Text style={[styles.avatarText, { color: theme.primary }]}>{initials(c.other_full_name)}</Text>
                </View>
                <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
                  {c.other_full_name}
                </Text>
                <Button
                  label="Add"
                  size="sm"
                  loading={addingId === c.other_user_id}
                  onPress={() => handleAdd(c.other_user_id)}
                />
              </View>
            ))
          )}
        </Card>
      )}

      <Text style={[styles.sectionLabel, { color: theme.textFaint }]}>
        {members.length} MEMBER{members.length === 1 ? '' : 'S'}
      </Text>

      <FlatList
        data={members}
        scrollEnabled={false}
        keyExtractor={(m) => m.id}
        ListEmptyComponent={!loading ? <Text style={{ color: theme.textMuted }}>No members yet.</Text> : null}
        renderItem={({ item }) => (
          <View style={[styles.memberRow, { borderColor: theme.divider }]}>
            <View style={[styles.avatarFallback, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarText}>{initials(item.full_name)}</Text>
            </View>
            <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
              {item.full_name}
            </Text>
            {item.role !== 'member' && (
              <View style={[styles.roleBadge, { backgroundColor: theme.primaryMuted }]}>
                <Text style={[styles.roleBadgeText, { color: theme.primary }]}>{item.role}</Text>
              </View>
            )}
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    flexShrink: 1,
  },
  addToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  addToggleText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  sectionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: '#fff',
  },
  memberName: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  roleBadgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 10,
    textTransform: 'capitalize',
  },
});
