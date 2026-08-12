import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import Badge from '../../src/components/ui/Badge';
import { useAuthStore } from '../../src/store/authStore';
import { getTimetable, type TimetableEntry } from '../../src/api/timetable';
import { addTimetableEntryToCalendar } from '../../src/utils/calendar';
import { haptics } from '../../src/utils/haptics';
import { getErrorMessage } from '../../src/utils/errors';

const DAY_NAMES: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };
const DAY_ORDER = [1, 2, 3, 4, 5];

// start_time/end_time come back as full timestamps with a placeholder
// 1970-01-01 date (the columns are really TIME, not TIMESTAMP) — mirrors
// web's TimetablePage formatTime so both surfaces show a plain "8:00 AM"
// instead of the raw "1970-01-01 08:00:00+00" string.
function formatTime(v: string) {
  if (!v) return '';
  const timePart = v.includes(' ') ? v.split(' ')[1] : v;
  const parts = timePart.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parts[1] || '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${suffix}`;
}

export default function TimetableScreen() {
  const { theme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const todayDow = useMemo(() => new Date().getDay(), []); // 0=Sun..6=Sat, matches DAY_NAMES keys 1-5

  const fetchData = useCallback(async () => {
    try {
      const data = await getTimetable(user?.level);
      setEntries(Array.isArray(data) ? data.filter((e) => e.is_published) : []);
    } catch {
      // keep previous state; pull-to-refresh is right there
    }
  }, [user?.level]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const [addingId, setAddingId] = useState<string | null>(null);

  const handleAddToCalendar = async (entry: TimetableEntry) => {
    haptics.tap();
    setAddingId(entry.id);
    try {
      await addTimetableEntryToCalendar(entry.id);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err, 'Could not add this class to your calendar'));
    } finally {
      setAddingId(null);
    }
  };

  const grouped = DAY_ORDER.map((day) => ({
    day,
    label: DAY_NAMES[day],
    isToday: day === todayDow,
    items: entries
      .filter((e) => e.day_of_week === day)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  }));

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={[styles.header, { color: theme.text }]}>Timetable</Text>
      <Text style={[styles.subheader, { color: theme.textMuted }]}>
        {user?.level ? `Level ${user.level}` : 'Your'} weekly class schedule
      </Text>

      {!loading && entries.length === 0 ? (
        <Card>
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={32} color={theme.textFaint} />
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: spacing.sm }}>
              No published timetable yet.
            </Text>
          </View>
        </Card>
      ) : (
        <View style={{ gap: spacing.lg }}>
          {grouped.map(
            (group, groupIndex) =>
              group.items.length > 0 && (
                <Animated.View key={group.day} entering={FadeInDown.duration(350).delay(groupIndex * 60)}>
                  <View style={styles.dayHeaderRow}>
                    <Text
                      style={[
                        styles.dayLabel,
                        { color: group.isToday ? theme.primary : theme.text },
                      ]}
                    >
                      {group.label}
                    </Text>
                    {group.isToday && <Badge label="Today" tone="primary" />}
                  </View>

                  <View style={{ gap: spacing.sm }}>
                    {group.items.map((entry) => (
                      <Card key={entry.id} style={styles.entryCard}>
                        <View
                          style={[
                            styles.timeStripe,
                            { backgroundColor: group.isToday ? theme.primary : theme.divider },
                          ]}
                        />
                        <View style={styles.flex}>
                          <Text style={[styles.courseTitle, { color: theme.text }]}>
                            {entry.courseCode} · {entry.courseTitle}
                          </Text>
                          <View style={styles.metaRow}>
                            <View style={styles.metaItem}>
                              <Ionicons name="time-outline" size={13} color={theme.textMuted} />
                              <Text style={[styles.metaText, { color: theme.textMuted }]}>
                                {formatTime(entry.start_time)}–{formatTime(entry.end_time)}
                              </Text>
                            </View>
                            <View style={styles.metaItem}>
                              <Ionicons name="location-outline" size={13} color={theme.textMuted} />
                              <Text style={[styles.metaText, { color: theme.textMuted }]}>{entry.venue}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.entryActions}>
                          {entry.class_type && <Badge label={entry.class_type} tone="neutral" />}
                          <Pressable
                            onPress={() => handleAddToCalendar(entry)}
                            disabled={addingId === entry.id}
                            hitSlop={8}
                            style={[styles.calendarButton, { backgroundColor: theme.primaryMuted }]}
                          >
                            <Ionicons
                              name={addingId === entry.id ? 'hourglass-outline' : 'calendar-outline'}
                              size={16}
                              color={theme.primary}
                            />
                          </Pressable>
                        </View>
                      </Card>
                    ))}
                  </View>
                </Animated.View>
              ),
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
  },
  subheader: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    marginTop: -spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dayLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    overflow: 'hidden',
  },
  entryActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  calendarButton: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeStripe: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: radius.full,
  },
  courseTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  metaText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
});
