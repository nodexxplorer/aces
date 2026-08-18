import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import Text from '../../src/components/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import Button from '../../src/components/ui/Button';
import Badge from '../../src/components/ui/Badge';
import { haptics } from '../../src/utils/haptics';
import { getErrorMessage } from '../../src/utils/errors';
import {
  listPendingCourseRegistrations,
  approveCourseRegistration,
  listPendingStudentRegistrations,
  approveStudentRegistration,
  type PendingCourseRegistration,
  type PendingStudentRegistration,
} from '../../src/api/class-rep';

type Tab = 'forms' | 'accounts';

export default function PendingRequestsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('forms');
  const [forms, setForms] = useState<PendingCourseRegistration[]>([]);
  const [accounts, setAccounts] = useState<PendingStudentRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      listPendingCourseRegistrations().catch(() => []),
      listPendingStudentRegistrations().catch(() => []),
    ])
      .then(([f, a]) => {
        setForms(f);
        setAccounts(a);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const approveForm = async (id: string, name: string) => {
    setApprovingId(id);
    try {
      await approveCourseRegistration(id);
      setForms((prev) => prev.filter((f) => f.id !== id));
      haptics.success();
    } catch (err) {
      Alert.alert('Could Not Approve', getErrorMessage(err, `Failed to verify ${name}'s registration`));
    } finally {
      setApprovingId(null);
    }
  };

  const approveAccount = async (id: string, name: string) => {
    setApprovingId(id);
    try {
      await approveStudentRegistration(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      haptics.success();
    } catch (err) {
      Alert.alert('Could Not Approve', getErrorMessage(err, `Failed to approve ${name}`));
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <Screen>
      <Pressable style={styles.backRow} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={20} color={theme.primary} />
        <Text style={[styles.backLabel, { color: theme.primary }]}>Class Rep Tools</Text>
      </Pressable>

      <Text style={[styles.header, { color: theme.text }]}>Pending Requests</Text>

      <View style={styles.tabRow}>
        {(['forms', 'accounts'] as Tab[]).map((t) => {
          const active = t === tab;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[
                styles.tabChip,
                { backgroundColor: active ? theme.primary : theme.primaryMuted },
              ]}
            >
              <Text style={[styles.tabChipText, { color: active ? theme.onPrimary : theme.primary }]}>
                {t === 'forms' ? `Course Forms (${forms.length})` : `New Accounts (${accounts.length})`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <Text style={{ color: theme.textMuted, textAlign: 'center', marginTop: spacing.xl }}>Loading...</Text>
      ) : tab === 'forms' ? (
        forms.length === 0 ? (
          <Text style={{ color: theme.textFaint, textAlign: 'center', marginTop: spacing.xl }}>
            No pending course registrations to review
          </Text>
        ) : (
          forms.map((reg, i) => (
            <Animated.View key={reg.id} entering={FadeInDown.duration(300).delay(Math.min(i, 10) * 30)}>
              <Card style={{ gap: spacing.sm }}>
                <View style={styles.cardHeaderRow}>
                  <Text style={[styles.name, { color: theme.text }]}>{reg.student_name}</Text>
                  <Badge label={`${reg.level} Level`} tone="neutral" />
                </View>
                <Text style={{ color: theme.textFaint, fontSize: fontSize.xs }}>
                  {reg.matric_number} · {reg.courses_count} course{reg.courses_count !== 1 ? 's' : ''}
                </Text>
                <Button
                  label={approvingId === reg.id ? 'Verifying...' : 'Verify Form'}
                  size="sm"
                  loading={approvingId === reg.id}
                  disabled={approvingId !== null}
                  onPress={() => approveForm(reg.id, reg.student_name)}
                />
              </Card>
            </Animated.View>
          ))
        )
      ) : accounts.length === 0 ? (
        <Text style={{ color: theme.textFaint, textAlign: 'center', marginTop: spacing.xl }}>
          No pending student registrations to review
        </Text>
      ) : (
        accounts.map((reg, i) => (
          <Animated.View key={reg.id} entering={FadeInDown.duration(300).delay(Math.min(i, 10) * 30)}>
            <Card style={{ gap: spacing.sm }}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.name, { color: theme.text }]}>{reg.full_name}</Text>
                <Badge label={reg.type === 'signup' ? 'New Signup' : 'Unapproved'} tone="warning" />
              </View>
              <Text style={{ color: theme.textFaint, fontSize: fontSize.xs }}>
                {reg.matric_number || '—'} · {reg.level} Level
              </Text>
              <Button
                label={approvingId === reg.id ? 'Approving...' : 'Approve'}
                size="sm"
                loading={approvingId === reg.id}
                disabled={approvingId !== null}
                onPress={() => approveAccount(reg.id, reg.full_name)}
              />
            </Card>
          </Animated.View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: spacing.sm,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tabChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  tabChipText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
});
