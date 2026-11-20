import { useState, useEffect } from "react";
import {
  Modal,
  View,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Text from "./ui/Text";
import { useTheme } from "../theme/ThemeProvider";
import { fontFamily, fontSize, radius, spacing } from "../theme/typography";
import { haptics } from "../utils/haptics";
import {
  getMyConversations,
  getMyGroups,
  sendChatMessage,
  sendGroupMessage,
  type DMConversation,
  type GroupConversation,
} from "../api/connect";
import {
  uploadConnectAttachment,
  connectMediaSource,
  type ConnectAttachment,
} from "../api/connect-media";
import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";

interface ForwardModalProps {
  visible: boolean;
  onClose: () => void;
  content?: string;
  attachment?: ConnectAttachment;
  onForwarded?: () => void;
}

export default function ForwardModal({
  visible,
  onClose,
  content,
  attachment,
  onForwarded,
}: ForwardModalProps) {
  const { theme } = useTheme();
  const [search, setSearch] = useState("");
  const [dms, setDms] = useState<DMConversation[]>([]);
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setSearch("");
    Promise.allSettled([getMyConversations(), getMyGroups()])
      .then(([convRes, groupRes]) => {
        if (convRes.status === "fulfilled") setDms(convRes.value);
        if (groupRes.status === "fulfilled") setGroups(groupRes.value);
      })
      .finally(() => setLoading(false));
  }, [visible]);

  const filteredDMs = dms.filter((d) =>
    d.other_full_name.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleSendTo(kind: "dm" | "group", targetId: string) {
    setSendingId(targetId);
    haptics.tap();
    try {
      let attachmentId: string | undefined;
      if (attachment) {
        // Download attachment locally and re-upload for new target
        const source = await connectMediaSource(attachment.id);
        const tempUri = `${FileSystem.cacheDirectory}fwd_${attachment.id}.jpg`;
        await FileSystem.downloadAsync(source.uri, tempUri, {
          headers: source.headers,
        });
        const abortCtrl = new AbortController();
        const uploaded = await uploadConnectAttachment(
          { kind, id: targetId },
          attachment.kind,
          tempUri,
          Crypto.randomUUID(),
          abortCtrl.signal,
          () => {},
        );
        attachmentId = uploaded.id;
      }
      const textToSend = content || (attachmentId ? "" : "Forwarded message");
      const options = {
        attachments: attachmentId ? [attachmentId] : [],
        client_nonce: Crypto.randomUUID(),
      };
      if (kind === "dm") {
        await sendChatMessage(targetId, textToSend, options);
      } else {
        await sendGroupMessage(targetId, textToSend, options);
      }
      haptics.success();
      onForwarded?.();
      onClose();
    } catch {
      haptics.error();
    } finally {
      setSendingId(null);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[styles.modalSheet, { backgroundColor: theme.card }]}
        >
          {/* Header */}
          <View style={[styles.header, { borderColor: theme.divider }]}>
            <Text style={[styles.title, { color: theme.text }]}>
              Forward message
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={theme.textMuted} />
            </Pressable>
          </View>

          {/* Search */}
          <View style={styles.searchRow}>
            <Ionicons
              name="search"
              size={16}
              color={theme.textFaint}
              style={styles.searchIcon}
            />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search chats…"
              placeholderTextColor={theme.textFaint}
              style={[
                styles.searchInput,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.cardBorder,
                  color: theme.text,
                },
              ]}
            />
          </View>

          {/* List */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            <FlatList
              data={[
                ...filteredGroups.map((g) => ({ ...g, itemKind: "group" as const })),
                ...filteredDMs.map((d) => ({ ...d, itemKind: "dm" as const })),
              ]}
              keyExtractor={(item) =>
                item.itemKind === "group" ? `g:${item.id}` : `dm:${item.other_user_id}`
              }
              ItemSeparatorComponent={() => (
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: theme.divider,
                  }}
                />
              )}
              ListEmptyComponent={
                <View style={styles.centerContainer}>
                  <Text style={{ color: theme.textMuted, fontSize: fontSize.sm }}>
                    No conversations found.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isGroup = item.itemKind === "group";
                const targetId = isGroup ? item.id : item.other_user_id;
                const name = isGroup ? item.name : item.other_full_name;
                const isSending = sendingId === targetId;

                return (
                  <Pressable
                    onPress={() => void handleSendTo(item.itemKind, targetId)}
                    disabled={!!sendingId}
                    style={({ pressed }) => [
                      styles.row,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: theme.primaryMuted },
                      ]}
                    >
                      <Ionicons
                        name={isGroup ? "people" : "person"}
                        size={16}
                        color={theme.primary}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Text
                        style={[styles.name, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                      <Text
                        style={[styles.subtitle, { color: theme.textFaint }]}
                      >
                        {isGroup ? "Group" : "Direct Message"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.sendBadge,
                        { backgroundColor: theme.primaryMuted },
                      ]}
                    >
                      {isSending ? (
                        <ActivityIndicator size="small" color={theme.primary} />
                      ) : (
                        <Text
                          style={[styles.sendText, { color: theme.primary }]}
                        >
                          Send
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    height: "75%",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
  },
  searchRow: {
    position: "relative",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  searchIcon: {
    position: "absolute",
    left: spacing.xl + 4,
    zIndex: 1,
  },
  searchInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingLeft: spacing["3xl"],
    paddingRight: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    marginTop: 2,
  },
  sendBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    minWidth: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
  },
});
