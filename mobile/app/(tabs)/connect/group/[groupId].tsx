import ConnectComposer from "../../../../src/components/ConnectComposer";
import ConnectAttachments from "../../../../src/components/ConnectAttachments";
import SwipeableMessage from "../../../../src/components/SwipeableMessage";
import ForwardModal from "../../../../src/components/ForwardModal";
import type { ConnectAttachment } from "../../../../src/api/connect-media";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import Text from "../../../../src/components/ui/Text";
import EmptyState from "../../../../src/components/ui/EmptyState";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../../src/theme/ThemeProvider";
import {
  fontFamily,
  fontSize,
  radius,
  spacing,
} from "../../../../src/theme/typography";
import { useAuthStore } from "../../../../src/store/authStore";
import {
  useWebSocket,
  getChatSocketUrl,
} from "../../../../src/hooks/useWebSocket";
import { getMediaUrl } from "../../../../src/api/client";
import {
  getGroupMessages,
  type GroupMessage,
} from "../../../../src/api/connect";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

function SenderAvatar({
  name,
  url,
  theme,
}: {
  name: string;
  url: string | null;
  theme: { primary: string; primaryMuted: string };
}) {
  const resolvedUrl = getMediaUrl(url);
  if (resolvedUrl) {
    return (
      <Image
        source={{ uri: resolvedUrl }}
        style={styles.senderAvatarImage}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={[styles.senderAvatar, { backgroundColor: theme.primaryMuted }]}
    >
      <Text style={[styles.senderAvatarText, { color: theme.primary }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

export default function GroupChatScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { groupId, name, memberCount } = useLocalSearchParams<{
    groupId: string;
    name?: string;
    memberCount?: string;
  }>();
  const myId = useAuthStore((s) => s.user?.id);
  const groupName = name ?? "Group";
  const navigation = useNavigation();

  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: "none" } });
    return () => parent?.setOptions({ tabBarStyle: undefined });
  }, [navigation]);

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<{ id: string; senderName: string; content: string } | null>(null);
  const [forwardingItem, setForwardingItem] = useState<{ content?: string; attachment?: ConnectAttachment } | null>(null);
  const listRef = useRef<FlatList>(null);

  const handleReply = (item: GroupMessage) => {
    const sender = item.sender_id === myId ? "You" : item.full_name;
    const preview = item.content || (item.attachments?.length ? "📷 Photo" : "Message");
    setReplyingTo({ id: item.id, senderName: sender, content: preview });
  };

  function renderMessageContent(content: string, isMine: boolean) {
    const match = content.match(/^>\s*\*\*([^*]+)\*\*:\s*(.*?)\n\n([\s\S]*)$/);
    if (match) {
      return (
        <View style={{ gap: 4 }}>
          <View
            style={{
              padding: 6,
              borderRadius: radius.sm,
              backgroundColor: isMine ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.08)",
              borderLeftWidth: 3,
              borderLeftColor: isMine ? "#ffffff" : theme.primary,
            }}
          >
            <Text
              style={{
                fontFamily: fontFamily.bold,
                fontSize: 10,
                color: isMine ? theme.onPrimary : theme.primary,
              }}
            >
              {match[1]}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                fontFamily: fontFamily.regular,
                fontSize: 11,
                color: isMine ? theme.onPrimary : theme.textMuted,
              }}
            >
              {match[2]}
            </Text>
          </View>
          <Text
            style={[
              styles.bubbleText,
              { color: isMine ? theme.onPrimary : theme.text },
            ]}
          >
            {match[3]}
          </Text>
        </View>
      );
    }
    return (
      <Text
        style={[
          styles.bubbleText,
          { color: isMine ? theme.onPrimary : theme.text },
        ]}
      >
        {content}
      </Text>
    );
  }

  const { lastMessage } = useWebSocket(myId ? getChatSocketUrl() : undefined);

  const loadMessages = useCallback(async () => {
    if (!groupId) return;
    try {
      const data = await getGroupMessages(groupId);
      setMessages(data);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!lastMessage) return;
    try {
      const frame = JSON.parse(lastMessage) as {
        type: string;
        payload: GroupMessage;
      };
      if (frame.type === "group_chat" && frame.payload.group_id === groupId) {
        setMessages((prev) =>
          prev.some((m) => m.id === frame.payload.id)
            ? prev
            : [...prev, frame.payload],
        );
      }
    } catch {
      // ignore malformed frames
    }
  }, [lastMessage, groupId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + spacing.sm, borderColor: theme.divider },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Pressable>
          <View
            style={[styles.avatarFallback, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.avatarText}>{initials(groupName)}</Text>
          </View>
          <View style={styles.flex}>
            <Text
              style={[styles.headerName, { color: theme.text }]}
              numberOfLines={1}
            >
              {groupName}
            </Text>
            {!!memberCount && (
              <Text style={[styles.headerMeta, { color: theme.textFaint }]}>
                {memberCount} member{memberCount === "1" ? "" : "s"}
              </Text>
            )}
          </View>
          <Pressable
            onPress={() =>
              router.push(
                `/connect/group/${groupId}/members?name=${encodeURIComponent(groupName)}` as never,
              )
            }
            hitSlop={12}
          >
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={theme.textMuted}
            />
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messagesContent}
          ListEmptyComponent={
            !loading ? (
              <EmptyState title="No messages yet" description="Say hello!" />
            ) : null
          }
          renderItem={({ item }) => {
            const isMine = item.sender_id === myId;
            return (
              <SwipeableMessage
                onReply={() => handleReply(item)}
                onLongPress={() =>
                  setForwardingItem({
                    content: item.content,
                    attachment: item.attachments?.[0],
                  })
                }
              >
                <View
                  style={[
                    styles.bubbleRow,
                    isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
                  ]}
                >
                  {!isMine && (
                    <SenderAvatar
                      name={item.full_name}
                      url={item.avatar_url}
                      theme={theme}
                    />
                  )}
                  <View
                    style={[
                      styles.bubble,
                      isMine
                        ? {
                            backgroundColor: theme.primary,
                            borderBottomRightRadius: radius.sm,
                          }
                        : {
                            backgroundColor: theme.card,
                            borderBottomLeftRadius: radius.sm,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: theme.cardBorder,
                          },
                    ]}
                  >
                    {!isMine && (
                      <Text
                        style={[styles.senderName, { color: theme.primary }]}
                        numberOfLines={1}
                      >
                        {item.full_name}
                      </Text>
                    )}
                    <ConnectAttachments
                      items={item.attachments}
                      onForward={(att) => setForwardingItem({ attachment: att })}
                    />
                    {item.content ? renderMessageContent(item.content, isMine) : null}
                  </View>
                </View>
              </SwipeableMessage>
            );
          }}
        />

        <View style={{ paddingBottom: insets.bottom }}>
          <ConnectComposer
            key={`${myId}:group:${groupId}`}
            target={{ kind: "group", id: groupId }}
            text={text}
            onText={setText}
            replyingTo={replyingTo}
            onClearReply={() => setReplyingTo(null)}
            onSent={(m) => {
              setReplyingTo(null);
              setMessages((prev) =>
                prev.some((old) => old.id === m.id)
                  ? prev
                  : [...prev, m as GroupMessage],
              );
            }}
          />
        </View>
      </View>

      <ForwardModal
        visible={!!forwardingItem}
        onClose={() => setForwardingItem(null)}
        content={forwardingItem?.content}
        attachment={forwardingItem?.attachment}
        onForwarded={() => loadMessages()}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    marginLeft: -spacing.sm,
    marginTop: 3,
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: "#fff",
  },
  headerName: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
  },
  headerMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  messagesContent: {
    padding: spacing.lg,
    gap: spacing.sm,
    flexGrow: 1,
  },
  bubbleRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  bubbleRowMine: {
    justifyContent: "flex-end",
  },
  bubbleRowTheirs: {
    justifyContent: "flex-start",
  },
  senderAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  senderAvatarImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignSelf: "flex-end",
  },
  senderAvatarText: {
    fontFamily: fontFamily.bold,
    fontSize: 9,
  },
  senderName: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: "72%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
