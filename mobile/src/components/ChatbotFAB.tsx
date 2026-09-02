import { useEffect, useRef, useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Linking,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import Text from './ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { sendChatMessage, getQuickActions, type QuickAction } from '../api/ai';
import { WEB_ORIGIN } from '../config';
import { TAB_BAR_FOOTPRINT } from './FloatingTabBar';

const FAB_SIZE = 56;
const EDGE_MARGIN = spacing.lg;
// Clears FloatingTabBar's full floating footprint plus a small gap above it.
const DEFAULT_BOTTOM_OFFSET = TAB_BAR_FOOTPRINT + spacing.md;
// Below this total drag distance, a gesture is treated as a tap (open the
// chat) rather than a reposition.
const TAP_SLOP = 6;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
}

function MarkdownText({ content, style }: { content: string; style: StyleProp<TextStyle> }) {
  const cleaned = content
    .split('\n')
    .map((line) => {
      const bulletLink = line.match(/^\s*\*\s*\[([^\]]+)\]\([^)]*\)\s*$/);
      if (bulletLink) return `• ${bulletLink[1]}`;
      const bullet = line.match(/^\s*\*\s+(.+)$/);
      if (bullet) return `• ${bullet[1]}`;
      return line.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    })
    .join('\n');

  const parts = cleaned.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return (
    <Text style={style}>
      {parts.map((part, i) => {
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        return boldMatch ? (
          <Text key={i} style={styles.bold}>
            {boldMatch[1]}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        );
      })}
    </Text>
  );
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const WEB_ONLY_HINTS = ['bulk upload', 'admin dashboard', 'print', 'export', 'spreadsheet', 'csv'];

export default function ChatbotFAB() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const sessionId = useRef(newId());
  const listRef = useRef<FlatList>(null);
  const scale = useSharedValue(1);


  const defaultX = screenWidth - EDGE_MARGIN - FAB_SIZE;
  const defaultY = screenHeight - insets.bottom - DEFAULT_BOTTOM_OFFSET - FAB_SIZE;
  const posX = useSharedValue(defaultX);
  const posY = useSharedValue(defaultY);
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  const openChat = () => {
    haptics.select();
    setOpen(true);
  };

  const panGesture = Gesture.Pan()

    .minDistance(0)
    .onBegin(() => {
      dragStartX.value = posX.value;
      dragStartY.value = posY.value;
      scale.value = withSpring(0.92);
    })
    .onUpdate((e) => {
      posX.value = dragStartX.value + e.translationX;
      posY.value = dragStartY.value + e.translationY;
    })
    .onEnd((e) => {
      scale.value = withSpring(1);
      const moved = Math.abs(e.translationX) > TAP_SLOP || Math.abs(e.translationY) > TAP_SLOP;
      if (!moved) {
        runOnJS(openChat)();
        return;
      }
    
      const minY = insets.top + spacing.lg;
      const maxY = screenHeight - insets.bottom - FAB_SIZE - spacing.lg;
      const clampedY = Math.min(Math.max(posY.value, minY), maxY);
      const bubbleCenterX = posX.value + FAB_SIZE / 2;
      const targetX = bubbleCenterX < screenWidth / 2 ? EDGE_MARGIN : screenWidth - EDGE_MARGIN - FAB_SIZE;

      posX.value = withSpring(targetX, { damping: 16 });
      posY.value = withSpring(clampedY, { damping: 16 });
      runOnJS(haptics.tap)();
    });

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: posX.value }, { translateY: posY.value }, { scale: scale.value }],
  }));

  useEffect(() => {
    if (open && messages.length === 0) {
      getQuickActions()
        .then(setQuickActions)
        .catch(() => {});
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content:
            "Hi! I'm your ACES Assistant. I can help with schedules, grades, dues, courses, and more, what do you need?",
          suggestions: ['Check my grades', 'How to pay dues'],
        },
      ]);
    }
  }, [open, messages.length]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: newId(), role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    haptics.tap();
    try {
      const res = await sendChatMessage(text, sessionId.current);
      const lower = res.reply.toLowerCase();
      const webOnly = WEB_ONLY_HINTS.some((hint) => lower.includes(hint));
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: webOnly ? `${res.reply}\n\nThis is easier on the ACES Zone website — want me to open it?` : res.reply,
          suggestions: res.suggestions,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'assistant', content: "I'm having trouble connecting right now. Please try again shortly." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.fabWrap, fabAnimatedStyle]}>
          <View style={[styles.fab, { backgroundColor: theme.primary }]}>
            <Ionicons name="sparkles" size={24} color={theme.onPrimary} />
          </View>
        </Animated.View>
      </GestureDetector>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.flex, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + spacing.sm, backgroundColor: theme.primary }]}>
              <View style={styles.headerLeft}>
                <View style={styles.botIconWrap}>
                  <Ionicons name="sparkles" size={18} color="#fff" />
                </View>
                <View>
                  <Text style={styles.headerTitle}>ACES Assistant</Text>
                  <Text style={styles.headerSubtitle}>Online · Powered by AI</Text>
                </View>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>

            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
              ListFooterComponent={
                messages.length <= 1 && quickActions.length > 0 ? (
                  <View style={styles.quickGrid}>
                    {quickActions.map((qa) => (
                      <Pressable
                        key={qa.id}
                        onPress={() => send(qa.query)}
                        style={[styles.quickChip, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                      >
                        <Text style={styles.quickChipIcon}>{qa.icon}</Text>
                        <Text style={[styles.quickChipLabel, { color: theme.textMuted }]} numberOfLines={2}>
                          {qa.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <Animated.View entering={FadeInDown.duration(250)}>
                  <View style={[styles.bubbleRow, item.role === 'user' ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                    {item.role === 'assistant' && (
                      <View style={[styles.botAvatar, { backgroundColor: theme.primaryMuted }]}>
                        <Ionicons name="sparkles" size={14} color={theme.primary} />
                      </View>
                    )}
                    <View
                      style={[
                        styles.bubble,
                        item.role === 'user'
                          ? { backgroundColor: theme.primary, borderBottomRightRadius: radius.sm }
                          : {
                              backgroundColor: theme.card,
                              borderBottomLeftRadius: radius.sm,
                              borderWidth: StyleSheet.hairlineWidth,
                              borderColor: theme.cardBorder,
                            },
                      ]}
                    >
                      <MarkdownText
                        content={item.content}
                        style={[styles.bubbleText, { color: item.role === 'user' ? theme.onPrimary : theme.text }]}
                      />
                      {item.content.includes('ACES Zone website') && (
                        <Pressable
                          onPress={() => Linking.openURL(WEB_ORIGIN)}
                          style={styles.webLinkRow}
                        >
                          <Ionicons name="open-outline" size={14} color={theme.primary} />
                          <Text style={[styles.webLinkText, { color: theme.primary }]}>Open website</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                  {item.suggestions && item.suggestions.length > 0 && (
                    <View style={styles.suggestionsRow}>
                      {item.suggestions.map((s: string, i: number) => (
                        <Pressable
                          key={i}
                          onPress={() => send(s)}
                          style={[styles.suggestionChip, { backgroundColor: theme.primaryMuted }]}
                        >
                          <Text style={[styles.suggestionText, { color: theme.primary }]}>{s}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </Animated.View>
              )}
            />

            {loading && (
              <Animated.View entering={FadeIn.duration(150)} style={styles.typingRow}>
                <View style={[styles.botAvatar, { backgroundColor: theme.primaryMuted }]}>
                  <Ionicons name="sparkles" size={14} color={theme.primary} />
                </View>
                <View style={[styles.bubble, { backgroundColor: theme.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.cardBorder }]}>
                  <Text style={[styles.bubbleText, { color: theme.textMuted }]}>Typing...</Text>
                </View>
              </Animated.View>
            )}

            <View style={[styles.inputRow, { paddingBottom: insets.bottom + spacing.sm, borderColor: theme.divider }]}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask me anything..."
                placeholderTextColor={theme.textFaint}
                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.text }]}
                multiline
                textAlignVertical="top"
              />
              <Pressable
                onPress={() => send(input)}
                disabled={!input.trim() || loading}
                style={[styles.sendButton, { backgroundColor: theme.primary, opacity: !input.trim() || loading ? 0.5 : 1 }]}
              >
                <Ionicons name="send" size={18} color={theme.onPrimary} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fabWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 50,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  botIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: '#fff',
  },
  headerSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.8)',
  },
  messagesContent: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowTheirs: {
    justifyContent: 'flex-start',
  },
  botAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
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
  bold: {
    fontFamily: fontFamily.bold,
  },
  webLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  webLinkText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginLeft: 34,
  },
  suggestionChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  suggestionText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  quickChip: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickChipIcon: {
    fontSize: 20,
  },
  quickChipLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    textAlign: 'center',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
