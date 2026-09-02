import { useEffect, useState } from 'react';
import { View, StyleSheet, TextInput, Pressable, Switch, Alert } from 'react-native';
import Text from '../../../src/components/ui/Text';
import Card from '../../../src/components/ui/Card';
import Button from '../../../src/components/ui/Button';
import Screen from '../../../src/components/ui/Screen';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../../src/theme/typography';
import { haptics } from '../../../src/utils/haptics';
import { createGroup, getMyConversations, type DMConversation } from '../../../src/api/connect';

const CATEGORIES = [
  { key: 'study', label: 'Study Group' },
  { key: 'project', label: 'Project' },
  { key: 'interest', label: 'Interest' },
  { key: 'class', label: 'Class' },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '?';
}

export default function NewGroupScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('study');
  const [isPrivate, setIsPrivate] = useState(false);
  const [connections, setConnections] = useState<DMConversation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyConversations()
      .then(setConnections)
      .catch(() => {});
  }, []);

  const toggleMember = (id: string) => {
    haptics.select();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    haptics.tap();
    try {
      const group = await createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        is_private: isPrivate,
        member_ids: Array.from(selectedIds),
      });
      haptics.success();
      router.replace(
        `/connect/group/${group.id}?name=${encodeURIComponent(group.name)}&memberCount=${selectedIds.size + 1}` as never,
      );
    } catch (err) {
      haptics.error();
      Alert.alert('Could Not Create Group', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>New Group</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ gap: spacing.lg }}>
        <View>
          <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>Group Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. CPE 500 Study Group"
            placeholderTextColor={theme.textFaint}
            style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
          />
        </View>

        <View>
          <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>Description (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What's this group about?"
            placeholderTextColor={theme.textFaint}
            multiline
            numberOfLines={3}
            style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.cardBorder }]}
          />
        </View>

        <View>
          <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>Category</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => {
              const active = category === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => {
                    haptics.select();
                    setCategory(c.key);
                  }}
                  style={[
                    styles.chip,
                    { borderColor: active ? theme.primary : theme.cardBorder, backgroundColor: active ? theme.primaryMuted : 'transparent' },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? theme.primary : theme.text }]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={[styles.fieldLabel, { color: theme.text, marginBottom: 0 }]}>Private Group</Text>
            <Text style={{ color: theme.textFaint, fontSize: fontSize.xs }}>Invite only — hidden from Discover</Text>
          </View>
          <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ true: theme.primary }} />
        </View>

        {connections.length > 0 && (
          <View>
            <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>Add Members (optional)</Text>
            <Card style={{ gap: 0, padding: 0 }}>
              {connections.map((c) => {
                const checked = selectedIds.has(c.other_user_id);
                return (
                  <Pressable
                    key={c.other_user_id}
                    onPress={() => toggleMember(c.other_user_id)}
                    style={[styles.memberRow, { borderColor: theme.divider }]}
                  >
                    <View style={[styles.avatarFallback, { backgroundColor: theme.primaryMuted }]}>
                      <Text style={[styles.avatarText, { color: theme.primary }]}>{initials(c.other_full_name)}</Text>
                    </View>
                    <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
                      {c.other_full_name}
                    </Text>
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={checked ? theme.primary : theme.textFaint}
                    />
                  </Pressable>
                );
              })}
            </Card>
          </View>
        )}

        <Button label="Create Group" onPress={handleCreate} loading={saving} disabled={!name.trim()} fullWidth />
      </View>
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
  fieldLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
  },
  memberName: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
});
