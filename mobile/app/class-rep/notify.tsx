import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import Text from '../../src/components/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import Button from '../../src/components/ui/Button';
import { haptics } from '../../src/utils/haptics';
import { getErrorMessage } from '../../src/utils/errors';
import { getClassRepClassList, createClassNotice, type ClassRepStudent } from '../../src/api/class-rep';

export default function NotifyStudentsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [students, setStudents] = useState<ClassRepStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getClassRepClassList()
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    haptics.tap();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Missing Info', 'Title and message are required');
      return;
    }
    setSending(true);
    try {
      // Notices target by user_id, not students.id — resolve each selected
      // roster row (see NotifyStudentsPage.tsx, web, for the same note).
      const targetUserIds =
        selected.size > 0 && selected.size < students.length
          ? Array.from(selected)
              .map((id) => students.find((s) => s.id === id)?.user_id)
              .filter((id): id is string => !!id)
          : undefined;

      await createClassNotice({ title: title.trim(), content: message.trim(), target_user_ids: targetUserIds });
      haptics.success();
      Alert.alert(
        'Notice Posted',
        targetUserIds && targetUserIds.length > 0
          ? `Sent to ${targetUserIds.length} selected student${targetUserIds.length !== 1 ? 's' : ''}.`
          : 'Sent to everyone in your level.',
      );
      setTitle('');
      setMessage('');
      setSelected(new Set());
    } catch (err) {
      Alert.alert('Could Not Post', getErrorMessage(err, 'Failed to post notice'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <Pressable style={styles.backRow} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={20} color={theme.primary} />
        <Text style={[styles.backLabel, { color: theme.primary }]}>Class Rep Tools</Text>
      </Pressable>

      <Text style={[styles.header, { color: theme.text }]}>Notify Classmates</Text>
      <Text style={{ color: theme.textMuted, fontSize: fontSize.sm }}>
        Posts to the Class Notice Board, visible only to your level.
      </Text>

      <Card style={{ gap: spacing.sm }}>
        <Text style={[styles.label, { color: theme.text }]}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Meeting Reminder"
          placeholderTextColor={theme.textFaint}
          style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
        />
        <Text style={[styles.label, { color: theme.text, marginTop: spacing.sm }]}>Message</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Type your message here..."
          placeholderTextColor={theme.textFaint}
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.textarea, { color: theme.text, borderColor: theme.cardBorder }]}
        />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <View style={styles.recipientsHeader}>
          <Text style={[styles.label, { color: theme.text }]}>Recipients</Text>
          <Text style={{ color: theme.textFaint, fontSize: fontSize.xs }}>
            {selected.size === 0 ? 'Everyone in your level' : `${selected.size} selected`}
          </Text>
        </View>
        {loading ? (
          <Text style={{ color: theme.textMuted }}>Loading...</Text>
        ) : (
          students.map((s) => {
            const active = selected.has(s.id);
            return (
              <Pressable key={s.id} onPress={() => toggle(s.id)} style={styles.studentRow}>
                <Ionicons
                  name={active ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={active ? theme.primary : theme.textFaint}
                />
                <View style={styles.flex}>
                  <Text style={{ color: theme.text, fontFamily: fontFamily.medium, fontSize: fontSize.sm }}>
                    {s.full_name}
                  </Text>
                  <Text style={{ color: theme.textFaint, fontSize: fontSize.xs }}>{s.matric_number}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </Card>

      <Button
        label={sending ? 'Posting...' : 'Post Notice'}
        loading={sending}
        disabled={sending || !title.trim() || !message.trim()}
        onPress={handleSend}
        fullWidth
        size="lg"
        icon={<Ionicons name="send" size={16} color={theme.onPrimary} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -spacing.sm,
  },
  backLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    marginLeft: 2,
  },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    marginTop: spacing.sm,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  textarea: {
    minHeight: 100,
  },
  recipientsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
