import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import Text from '../../src/components/ui/Text';
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
  listClassNotices,
  listNoticeComments,
  createNoticeComment,
  type NotificationItem,
  type AnnouncementFeedItem,
  type ClassNotice,
  type NoticeComment,
} from '../../src/api/communication';
import { listDepartmentalEvents, type CalendarEvent } from '../../src/api/calendar';

const EVENT_TYPE_LABELS: Record<string, string> = {
  academic: 'Academic',
  social: 'Social',
  deadline: 'Deadline',
  holiday: 'Holiday',
  exam: 'Exam',
  meeting: 'Meeting',
  other: 'Other',
};

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
}

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
  const [tab, setTab] = useState<'notifications' | 'announcements' | 'notices' | 'calendar'>('notifications');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementFeedItem[]>([]);
  const [notices, setNotices] = useState<ClassNotice[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, NoticeComment[]>>({});
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchAll = useCallback(async () => {
    const [notifs, ann, notic, evts] = await Promise.allSettled([
      listMyNotifications(),
      listAnnouncementsFeed(),
      listClassNotices(),
      listDepartmentalEvents(new Date().toISOString()),
    ]);
    if (notifs.status === 'fulfilled') setNotifications(notifs.value);
    if (ann.status === 'fulfilled') setAnnouncements(ann.value);
    if (notic.status === 'fulfilled') setNotices(notic.value);
    if (evts.status === 'fulfilled') {
      setEvents(
        [...evts.value].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
      );
    }
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

  const handleToggleNotice = (noticeId: string) => {
    const opening = expandedNoticeId !== noticeId;
    setExpandedNoticeId(opening ? noticeId : null);
    setCommentText('');
    if (opening && !commentsMap[noticeId]) {
      setLoadingComments(true);
      listNoticeComments(noticeId)
        .then((comments) => setCommentsMap((prev) => ({ ...prev, [noticeId]: comments })))
        .catch(() => {})
        .finally(() => setLoadingComments(false));
    }
  };

  const handleSubmitComment = async (noticeId: string) => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const newComment = await createNoticeComment(noticeId, commentText.trim());
      setCommentsMap((prev) => ({ ...prev, [noticeId]: [...(prev[noticeId] ?? []), newComment] }));
      setCommentText('');
    } catch {
      // input keeps its text on failure so the student can retry
    } finally {
      setSubmittingComment(false);
    }
  };

  const pinnedNotices = notices.filter((n) => n.is_pinned);
  const regularNotices = notices.filter((n) => !n.is_pinned);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={[styles.header, { color: theme.text }]}>Communication</Text>

      <View style={[styles.tabRow, { borderColor: theme.divider }]}>
        {(['notifications', 'announcements', 'notices', 'calendar'] as const).map((t) => (
          <Text
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tabLabel,
              { color: tab === t ? theme.primary : theme.textMuted },
              tab === t && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
            ]}
          >
            {t === 'notifications'
              ? 'Notifications'
              : t === 'announcements'
                ? 'Announcements'
                : t === 'notices'
                  ? 'Notice Board'
                  : 'Calendar'}
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
      ) : tab === 'announcements' ? (
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
      ) : tab === 'notices' ? (
        <View style={{ gap: spacing.lg }}>
          {!loading && notices.length === 0 && (
            <Card>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                No notices posted yet.
              </Text>
            </Card>
          )}

          {pinnedNotices.length > 0 && (
            <View style={{ gap: spacing.sm }}>
              <View style={styles.noticeSectionHeader}>
                <Ionicons name="pin" size={14} color={theme.warning} />
                <Text style={[styles.noticeSectionLabel, { color: theme.warning }]}>PINNED</Text>
              </View>
              {pinnedNotices.map((n) => renderNotice(n))}
            </View>
          )}

          {regularNotices.length > 0 && (
            <View style={{ gap: spacing.sm }}>
              {pinnedNotices.length > 0 && (
                <View style={styles.noticeSectionHeader}>
                  <Ionicons name="megaphone" size={14} color={theme.textFaint} />
                  <Text style={[styles.noticeSectionLabel, { color: theme.textFaint }]}>RECENT</Text>
                </View>
              )}
              {regularNotices.map((n) => renderNotice(n))}
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={events}
          scrollEnabled={false}
          keyExtractor={(e) => e.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <Card>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  No upcoming events.
                </Text>
              </Card>
            ) : null
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(350).delay(index * 40)}>
              <Card style={[styles.eventCard, { borderLeftColor: item.color || theme.primary }]}>
                <View style={styles.announcementHeader}>
                  <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Badge label={EVENT_TYPE_LABELS[item.event_type] ?? item.event_type} tone="neutral" />
                </View>
                {item.description ? (
                  <Text style={[styles.itemBody, { color: theme.textMuted }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                <View style={styles.noticeMetaRow}>
                  <View style={styles.noticeMetaItem}>
                    <Ionicons name="calendar-outline" size={12} color={theme.textFaint} />
                    <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{formatEventDate(item.start_time)}</Text>
                  </View>
                  {!item.is_all_day && (
                    <View style={styles.noticeMetaItem}>
                      <Ionicons name="time-outline" size={12} color={theme.textFaint} />
                      <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{formatEventTime(item.start_time)}</Text>
                    </View>
                  )}
                  {item.venue ? (
                    <View style={styles.noticeMetaItem}>
                      <Ionicons name="location-outline" size={12} color={theme.textFaint} />
                      <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{item.venue}</Text>
                    </View>
                  ) : null}
                </View>
              </Card>
            </Animated.View>
          )}
        />
      )}
    </Screen>
  );

  function renderNotice(notice: ClassNotice) {
    const isExpanded = expandedNoticeId === notice.id;
    const comments = commentsMap[notice.id] ?? [];

    return (
      <Card
        key={notice.id}
        style={[notice.is_pinned && { borderLeftWidth: 3, borderLeftColor: theme.warning }]}
      >
        <Pressable onPress={() => handleToggleNotice(notice.id)}>
          <View style={styles.announcementHeader}>
            <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
              {notice.title}
            </Text>
            <Ionicons name="chatbubble-outline" size={14} color={theme.textFaint} />
          </View>
          <Text
            style={[styles.itemBody, { color: theme.textMuted }]}
            numberOfLines={isExpanded ? undefined : 2}
          >
            {notice.content}
          </Text>
          <View style={styles.noticeMetaRow}>
            {notice.author_name && (
              <Text style={[styles.itemMeta, { color: theme.textMuted, fontFamily: fontFamily.medium }]}>
                {notice.author_name}
              </Text>
            )}
            <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{timeAgo(notice.created_at)}</Text>
            <View style={styles.noticeMetaItem}>
              <Ionicons name="chatbubble-outline" size={11} color={theme.textFaint} />
              <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{notice.comment_count ?? 0}</Text>
            </View>
          </View>
        </Pressable>

        {isExpanded && (
          <View style={[styles.commentsBlock, { borderTopColor: theme.divider }]}>
            {loadingComments && !commentsMap[notice.id] ? (
              <Text style={{ color: theme.textFaint, fontFamily: fontFamily.regular, fontSize: fontSize.xs }}>
                Loading comments...
              </Text>
            ) : comments.length === 0 ? (
              <Text style={{ color: theme.textFaint, fontFamily: fontFamily.regular, fontSize: fontSize.xs }}>
                No comments yet. Be the first to comment.
              </Text>
            ) : (
              comments.map((c) => (
                <View key={c.id} style={[styles.commentBubble, { backgroundColor: theme.background }]}>
                  <View style={styles.noticeMetaItem}>
                    <Text style={[styles.commentAuthor, { color: theme.text }]}>{c.author_name}</Text>
                    <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{timeAgo(c.created_at)}</Text>
                  </View>
                  <Text style={[styles.itemBody, { color: theme.textMuted, marginTop: 2 }]}>{c.content}</Text>
                </View>
              ))
            )}

            <View style={styles.commentInputRow}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Write a comment..."
                placeholderTextColor={theme.textFaint}
                style={[styles.commentInput, { backgroundColor: theme.background, color: theme.text }]}
                onSubmitEditing={() => handleSubmitComment(notice.id)}
              />
              <Pressable
                onPress={() => handleSubmitComment(notice.id)}
                disabled={!commentText.trim() || submittingComment}
                style={[
                  styles.commentSendButton,
                  { backgroundColor: theme.primary, opacity: !commentText.trim() || submittingComment ? 0.5 : 1 },
                ]}
              >
                <Ionicons name="send" size={14} color={theme.onPrimary} />
              </Pressable>
            </View>
          </View>
        )}
      </Card>
    );
  }
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
  noticeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  noticeSectionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    letterSpacing: 0.5,
  },
  noticeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  noticeMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  commentsBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  commentBubble: {
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  commentAuthor: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  commentInput: {
    flex: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  commentSendButton: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCard: {
    borderLeftWidth: 3,
  },
  announcementFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
});
