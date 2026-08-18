import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import Text from '../../src/components/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import Button from '../../src/components/ui/Button';
import { haptics } from '../../src/utils/haptics';
import { getErrorMessage } from '../../src/utils/errors';
import { getAllDues, createDue, deleteDue, type DuePayment } from '../../src/api/payments';

type Tab = 'class_dues' | 'dept_dues';

const TAB_CONFIG: Record<Tab, { label: string; placeholder: string }> = {
  class_dues: { label: 'Class Dues', placeholder: 'e.g. 500 Level Class Dues' },
  dept_dues: { label: 'Department Dues', placeholder: 'e.g. Department Dues 2025/2026' },
};

const LEVELS = [100, 200, 300, 400, 500];

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

export default function BursarDuesScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('class_dues');
  const [dues, setDues] = useState<DuePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    return getAllDues()
      .then(setDues)
      .catch(() => setDues([]));
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const resetForm = () => {
    setName('');
    setAmount('');
    setDescription('');
    setLevel(null);
  };

  const handleCreate = async () => {
    if (!name.trim() || !amount) return;
    setSaving(true);
    try {
      await createDue({
        name: name.trim(),
        description: description.trim() || undefined,
        type: tab,
        amount,
        level: level ?? undefined,
      });
      haptics.success();
      resetForm();
      setShowForm(false);
      load();
    } catch (err) {
      Alert.alert('Could Not Create Due', getErrorMessage(err, 'Please try again'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (due: DuePayment) => {
    Alert.alert('Deactivate Due', `Deactivate "${due.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDue(due.id);
            haptics.success();
            setDues((prev) => prev.filter((d) => d.id !== due.id));
          } catch (err) {
            Alert.alert('Could Not Deactivate', getErrorMessage(err, 'Please try again'));
          }
        },
      },
    ]);
  };

  const filtered = dues.filter((d) => d.type === tab);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Pressable style={styles.backRow} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={20} color={theme.primary} />
        <Text style={[styles.backLabel, { color: theme.primary }]}>Bursar Tools</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: theme.text }]}>Dues Management</Text>
        <Pressable
          onPress={() => {
            haptics.select();
            setShowForm((v) => !v);
          }}
          style={[styles.addButton, { backgroundColor: theme.primaryMuted }]}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={20} color={theme.primary} />
        </Pressable>
      </View>

      <View style={[styles.tabRow, { borderColor: theme.divider }]}>
        {(['class_dues', 'dept_dues'] as const).map((t) => (
          <Text
            key={t}
            onPress={() => {
              haptics.select();
              setTab(t);
            }}
            style={[
              styles.tabLabel,
              { color: tab === t ? theme.primary : theme.textMuted },
              tab === t && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
            ]}
          >
            {TAB_CONFIG[t].label}
          </Text>
        ))}
      </View>

      {showForm && (
        <Animated.View entering={FadeInDown.duration(250)}>
          <Card style={{ gap: spacing.md }}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={TAB_CONFIG[tab].placeholder}
              placeholderTextColor={theme.textFaint}
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
            />
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="Amount (₦)"
              placeholderTextColor={theme.textFaint}
              keyboardType="numeric"
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              placeholderTextColor={theme.textFaint}
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
            />
            <View>
              <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>
                Level {tab === 'dept_dues' ? '(optional — leave blank for all levels)' : ''}
              </Text>
              <View style={styles.chipRow}>
                {LEVELS.map((l) => {
                  const active = level === l;
                  return (
                    <Pressable
                      key={l}
                      onPress={() => {
                        haptics.select();
                        setLevel(active ? null : l);
                      }}
                      style={[
                        styles.levelChip,
                        {
                          borderColor: active ? theme.primary : theme.cardBorder,
                          backgroundColor: active ? theme.primaryMuted : 'transparent',
                        },
                      ]}
                    >
                      <Text style={[styles.levelChipText, { color: active ? theme.primary : theme.text }]}>{l}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Button
              label={saving ? 'Creating...' : 'Create Due'}
              loading={saving}
              disabled={!name.trim() || !amount}
              onPress={handleCreate}
              fullWidth
            />
          </Card>
        </Animated.View>
      )}

      <Text style={{ color: theme.textMuted, fontSize: fontSize.sm, marginTop: spacing.md, marginBottom: spacing.sm }}>
        {loading ? 'Loading...' : `${filtered.length} due${filtered.length !== 1 ? 's' : ''}`}
      </Text>

      {!loading && filtered.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="pricetags-outline" size={28} color={theme.textFaint} />
          <Text style={{ color: theme.textMuted, fontSize: fontSize.xs }}>No {TAB_CONFIG[tab].label.toLowerCase()} yet</Text>
        </Card>
      ) : (
        filtered.map((due, i) => (
          <Animated.View key={due.id} entering={FadeInDown.duration(300).delay(i * 30)}>
            <Card style={styles.dueCard}>
              <View style={styles.flex}>
                <Text style={[styles.dueName, { color: theme.text }]}>{due.name}</Text>
                <Text style={{ color: theme.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
                  {due.level ? `${due.level} Level` : 'All Levels'}
                  {due.description ? ` · ${due.description}` : ''}
                </Text>
              </View>
              <Text style={[styles.dueAmount, { color: theme.text }]}>{formatCurrency(due.amount)}</Text>
              <Pressable onPress={() => handleDelete(due)} hitSlop={10} style={{ marginLeft: spacing.sm }}>
                <Ionicons name="trash-outline" size={18} color={theme.danger} />
              </Pressable>
            </Card>
          </Animated.View>
        ))
      )}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  tabLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    paddingBottom: spacing.sm,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  levelChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  levelChipText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  dueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dueName: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  dueAmount: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
  },
});
