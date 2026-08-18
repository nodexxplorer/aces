import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import Text from '../../src/components/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import Badge from '../../src/components/ui/Badge';
import { getClassRepClassList, type ClassRepStudent } from '../../src/api/class-rep';

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export default function ClassListScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [students, setStudents] = useState<ClassRepStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getClassRepClassList()
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.matric_number.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Screen>
      <Pressable style={styles.backRow} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={20} color={theme.primary} />
        <Text style={[styles.backLabel, { color: theme.primary }]}>Class Rep Tools</Text>
      </Pressable>

      <Text style={[styles.header, { color: theme.text }]}>Class List</Text>
      <Text style={{ color: theme.textMuted, fontSize: fontSize.sm }}>
        {loading ? 'Loading...' : `${filtered.length} student${filtered.length !== 1 ? 's' : ''}`}
      </Text>

      <View style={[styles.searchRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Ionicons name="search" size={16} color={theme.textFaint} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or matric number"
          placeholderTextColor={theme.textFaint}
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>

      {!loading && filtered.length === 0 && (
        <Text style={{ color: theme.textFaint, textAlign: 'center', marginTop: spacing.xl }}>
          {students.length === 0 ? 'No students found in your class level' : 'No students match your search'}
        </Text>
      )}

      {filtered.map((s, i) => (
        <Animated.View key={s.id} entering={FadeInDown.duration(300).delay(Math.min(i, 10) * 30)}>
          <Card style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarText}>{initials(s.full_name)}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={[styles.name, { color: theme.text }]}>{s.full_name}</Text>
              <Text style={{ color: theme.textFaint, fontSize: fontSize.xs }}>{s.matric_number}</Text>
            </View>
            {s.is_defaulter && <Badge label="Defaulter" tone="danger" />}
          </Card>
        </Animated.View>
      ))}
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: '#ffffff',
  },
  name: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
});
