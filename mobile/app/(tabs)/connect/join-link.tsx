import { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable, Alert } from 'react-native';
import Text from '../../../src/components/ui/Text';
import Card from '../../../src/components/ui/Card';
import Button from '../../../src/components/ui/Button';
import Badge from '../../../src/components/ui/Badge';
import Screen from '../../../src/components/ui/Screen';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../../src/theme/typography';
import { haptics } from '../../../src/utils/haptics';
import { getGroupByInviteCode, joinGroup, type GroupPreview } from '../../../src/api/connect';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '?';
}

function extractCode(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const fromParam = url.searchParams.get('g');
    if (fromParam) return fromParam;
  } catch {
    // not a full URL — treat the whole input as a bare code
  }
  return trimmed;
}

export default function JoinByLinkScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [value, setValue] = useState('');
  const [looking, setLooking] = useState(false);
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  const handlePreview = async () => {
    const code = extractCode(value);
    if (!code) return;
    setLooking(true);
    setPreview(null);
    setJoined(false);
    try {
      const group = await getGroupByInviteCode(code);
      setPreview(group);
    } catch {
      Alert.alert('Invalid Link', 'This invite link or code is invalid or has expired.');
    } finally {
      setLooking(false);
    }
  };

  const handleJoin = async () => {
    if (!preview) return;
    setJoining(true);
    haptics.tap();
    try {
      await joinGroup(preview.id);
      haptics.success();
      setJoined(true);
      setTimeout(() => {
        router.replace(`/connect/group/${preview.id}?name=${encodeURIComponent(preview.name)}` as never);
      }, 400);
    } catch (err) {
      haptics.error();
      Alert.alert('Could Not Join', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Join a Group</Text>
        <View style={{ width: 24 }} />
      </View>

      <View>
        <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>Invite link or code</Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Paste an invite link or code"
          placeholderTextColor={theme.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
        />
      </View>

      <Button label="Continue" onPress={handlePreview} loading={looking} disabled={!value.trim()} fullWidth />

      {preview && (
        <Card style={styles.previewRow}>
          <View style={[styles.avatarFallback, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>{initials(preview.name)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
              {preview.name}
            </Text>
            <Text style={[styles.itemMeta, { color: theme.textFaint }]}>
              {preview.member_count} member{preview.member_count === 1 ? '' : 's'}
            </Text>
          </View>
          {joined ? (
            <Badge label="Joined" tone="success" />
          ) : (
            <Button label="Join" size="sm" loading={joining} onPress={handleJoin} />
          )}
        </Card>
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
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
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
  },
});
