import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Text from '../../../../src/components/ui/Text';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../../../src/theme/typography';
import { haptics } from '../../../../src/utils/haptics';
import { useAuthStore } from '../../../../src/store/authStore';
import { useUnreadStore } from '../../../../src/store/unreadStore';
import { useWebSocket, getChatSocketUrl } from '../../../../src/hooks/useWebSocket';
import { getConversation, sendChatMessage, markMessageRead, type ChatMessage } from '../../../../src/api/connect';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '?';
}

export default function ChatScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const myId = useAuthStore((s) => s.user?.id);
  const otherName = name ?? 'Chat';
  const navigation = useNavigation();

  // This screen lives inside the Connect tab's own nested stack, so the
  // parent Tabs navigator keeps its floating (position: absolute) tab bar
  // rendered on top of it by default — hiding the composer underneath.
  // Hide the tab bar while chat is focused, restore it on the way back out.
  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => parent?.setOptions({ tabBarStyle: undefined });
  }, [navigation]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const { lastMessage } = useWebSocket(myId ? getChatSocketUrl() : undefined);

  const loadMessages = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getConversation(userId);
      setMessages(data);
      const unreadFromThem = data.filter((msg) => !msg.is_read && msg.sender_id === userId);
      for (const msg of unreadFromThem) {
        markMessageRead(msg.id).catch(() => {});
      }
      if (unreadFromThem.length > 0) {
        useUnreadStore.getState().decrement(unreadFromThem.length);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Live-append a message pushed over the socket while this chat is open —
  // same behavior as the web version, no reload/re-open needed to see it.
  useEffect(() => {
    if (!lastMessage) return;
    try {
      const frame = JSON.parse(lastMessage) as { type: string; payload: ChatMessage };
      if (frame.type === 'chat' && frame.payload.sender_id === userId) {
        setMessages((prev) => (prev.some((m) => m.id === frame.payload.id) ? prev : [...prev, frame.payload]));
        markMessageRead(frame.payload.id).catch(() => {});
      }
    } catch {
      // ignore malformed frames
    }
  }, [lastMessage, userId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim() || sending || !userId) return;
    const content = text.trim();
    setText('');
    setSending(true);
    haptics.tap();
    try {
      const msg = await sendChatMessage(userId, content);
      setMessages((prev) => [...prev, msg]);
    } catch {
      haptics.error();
      setText(content);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderColor: theme.divider }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <View style={[styles.avatarFallback, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>{initials(otherName)}</Text>
          </View>
          <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
            {otherName}
          </Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messagesContent}
          ListEmptyComponent={
            !loading ? (
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No messages yet. Say hello!</Text>
            ) : null
          }
          renderItem={({ item }) => {
            const isMine = item.sender_id === myId;
            return (
              <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                <View
                  style={[
                    styles.bubble,
                    isMine
                      ? { backgroundColor: theme.primary, borderBottomRightRadius: radius.sm }
                      : { backgroundColor: theme.card, borderBottomLeftRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.cardBorder },
                  ]}
                >
                  <Text style={[styles.bubbleText, { color: isMine ? theme.onPrimary : theme.text }]}>
                    {item.content}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View
          style={[
            styles.inputRow,
            { paddingBottom: insets.bottom + spacing.md, backgroundColor: theme.background, borderColor: theme.divider },
          ]}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={theme.textFaint}
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.text }]}
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || sending}
            style={[styles.sendButton, { backgroundColor: theme.primary, opacity: !text.trim() || sending ? 0.5 : 1 }]}
          >
            <Ionicons name="send" size={18} color={theme.onPrimary} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    marginLeft: -spacing.sm,
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: '#fff',
  },
  headerName: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    flexShrink: 1,
  },
  messagesContent: {
    padding: spacing.lg,
    gap: spacing.sm,
    flexGrow: 1,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: spacing['3xl'],
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
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
    flexDirection: 'row',
    alignItems: 'flex-end',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
