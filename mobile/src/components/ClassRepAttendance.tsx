import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Alert, Pressable, TextInput } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Text from './ui/Text';
import Card from './ui/Card';
import Button from './ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, type Href } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../theme/typography';
import { WEB_ORIGIN } from '../config';
import { haptics } from '../utils/haptics';
import { getErrorMessage } from '../utils/errors';
import { getCourses } from '../api/courses';
import {
  getClassRepTimetable,
  listMyAttendanceSessions,
  createAttendanceSession,
  openAttendanceSession,
  closeAttendanceSession,
  listAttendanceCheckins,
  getRegisteredStudentsForAttendance,
  submitAttendanceSession,
  downloadAttendancePDF,
  checkInStudent,
  type TimetableEntry,
  type AttendanceSession,
  type AttendanceCheckin,
  type RegisteredStudentAttendance,
} from '../api/class-rep';

type StatusType = 'present' | 'absent' | 'late' | 'excused';
const STATUS_FILTERS: ('all' | StatusType)[] = ['all', 'present', 'absent', 'late', 'excused'];
const METHODS: { key: string; label: string }[] = [
  { key: 'manual', label: 'Manual' },
  { key: 'qr', label: 'QR Scan' },
  { key: 'digital_sheet', label: 'Digital Sheet' },
];

function getStudentStatus(checkins: AttendanceCheckin[], userId: string): StatusType {
  const checkin = checkins.find((c) => c.student_id === userId);
  if (!checkin) return 'absent';
  if (checkin.remark === 'late') return 'late';
  if (checkin.remark === 'excused') return 'excused';
  return checkin.present ? 'present' : 'absent';
}

// The class-rep half of attendance — starting a session (course + method +
// venue), sharing a self-check-in QR, scanning student QR codes, and a
// manual 4-state roster (present/absent/late/excused) with search and bulk
// actions. Ported from the web app's class-rep AttendancePage.tsx, reusing
// the same backend endpoints; the student-side check-in flow already lives
// in app/(tabs)/attendance.tsx and app/scan.tsx.
export default function ClassRepAttendance() {
  const { theme } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [roster, setRoster] = useState<RegisteredStudentAttendance[]>([]);
  const [checkins, setCheckins] = useState<AttendanceCheckin[]>([]);
  const [starting, setStarting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState('manual');
  const [venue, setVenue] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StatusType>('all');

  const load = useCallback(async () => {
    try {
      const [ttRes, sessions] = await Promise.allSettled([getClassRepTimetable(), listMyAttendanceSessions()]);

      let level = 400;
      let list: TimetableEntry[] = [];
      if (ttRes.status === 'fulfilled') {
        if (ttRes.value.level) level = ttRes.value.level;
        if (ttRes.value.entries?.length > 0) list = ttRes.value.entries;
      }

      // Timetable entries are frequently empty in practice — fall back to
      // the department's course list for the class rep's level so there's
      // always a way to start a session, same fallback the web app uses.
      if (list.length === 0) {
        try {
          const courses = await getCourses({ level });
          const source = courses.length > 0 ? courses : await getCourses();
          list = source.map((c) => ({
            timetable_entry_id: c.id,
            course_id: c.id,
            course_code: c.code,
            course_title: c.title,
            lecturer_name: 'Department Lecturer',
            venue: '',
            day_of_week: null,
            start_time: '',
            end_time: '',
            card_status: 'upcoming' as const,
          }));
        } catch {
          // leave list empty — the empty state below handles it
        }
      }
      setEntries(list);

      // listMyAttendanceSessions() returns every session this rep has ever
      // created, with no date filtering — only 'open' counts as "resume
      // this", matching web's AttendancePage.tsx exactly. Including 'closed'
      // here was the bug: any old closed-but-unsubmitted session (even a
      // stale one from testing) would permanently take over this screen,
      // with no way back to course selection, QR, or the scanner.
      const active = sessions.status === 'fulfilled' ? (sessions.value.find((s) => s.status === 'open') ?? null) : null;
      setSession(active);
      if (active) {
        const [rosterRes, checkinsRes] = await Promise.all([
          getRegisteredStudentsForAttendance(active.course_id),
          listAttendanceCheckins(active.id),
        ]);
        setRoster(rosterRes.students ?? []);
        setCheckins(checkinsRes);
      }
    } catch {
      // a failed load just shows the empty states
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleStart = async (entry: TimetableEntry) => {
    setStarting(entry.course_id);
    try {
      const created = await createAttendanceSession(entry.course_id, method, venue || undefined);
      const opened = await openAttendanceSession(created.id);
      haptics.success();
      setSession(opened);
      const rosterRes = await getRegisteredStudentsForAttendance(entry.course_id);
      setRoster(rosterRes.students ?? []);
      setCheckins([]);
    } catch (err) {
      Alert.alert('Could Not Start Attendance', getErrorMessage(err, 'Please try again'));
    } finally {
      setStarting(null);
    }
  };

  const handleUpdateStatus = async (studentUserId: string, newStatus: StatusType) => {
    if (!session || session.status !== 'open') return;
    haptics.tap();
    const present = newStatus === 'present' || newStatus === 'late';
    const remark = newStatus === 'late' || newStatus === 'excused' ? newStatus : undefined;
    try {
      const updated = await checkInStudent(session.id, studentUserId, 'manual', present, remark);
      setCheckins((prev) => [...prev.filter((c) => c.student_id !== studentUserId), updated]);
    } catch (err) {
      Alert.alert('Could Not Update', getErrorMessage(err, 'Please try again'));
    }
  };

  const handleMarkAll = async (status: StatusType) => {
    if (!session) return;
    setBusy(true);
    try {
      for (const s of filteredRoster) {
        await handleUpdateStatus(s.user_id, status);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSendToLecturer = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await submitAttendanceSession(session.id);
      await closeAttendanceSession(session.id);
      haptics.success();
      Alert.alert('Submitted', 'Attendance has been sent to your lecturer for review.');
      setSession(null);
      setRoster([]);
      setCheckins([]);
      setShowFinalize(false);
    } catch (err) {
      Alert.alert('Could Not Submit', getErrorMessage(err, 'Please try again'));
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await downloadAttendancePDF(session.id);
      await closeAttendanceSession(session.id);
      haptics.success();
      setSession(null);
      setRoster([]);
      setCheckins([]);
      setShowFinalize(false);
    } catch (err) {
      Alert.alert('Could Not Download PDF', getErrorMessage(err, 'Please try again'));
    } finally {
      setBusy(false);
    }
  };

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roster.filter((s) => {
      const matchesSearch = !q || s.full_name.toLowerCase().includes(q) || s.matric_number.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || getStudentStatus(checkins, s.user_id) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [roster, checkins, search, statusFilter]);

  if (loading) {
    return (
      <Card style={styles.center}>
        <Text style={{ color: theme.textMuted }}>Loading...</Text>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card style={{ gap: spacing.md }}>
        <Text style={[styles.title, { color: theme.text }]}>Start Attendance</Text>

        <View>
          <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>Method</Text>
          <View style={styles.chipRow}>
            {METHODS.map((m) => {
              const active = method === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => {
                    haptics.select();
                    setMethod(m.key);
                  }}
                  style={[
                    styles.methodChip,
                    { borderColor: active ? theme.primary : theme.cardBorder, backgroundColor: active ? theme.primaryMuted : 'transparent' },
                  ]}
                >
                  <Text style={[styles.methodChipText, { color: active ? theme.primary : theme.text }]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <Text style={[styles.fieldLabel, { color: theme.textFaint }]}>Venue (optional)</Text>
          <TextInput
            value={venue}
            onChangeText={setVenue}
            placeholder="e.g. LT 301 / ETF Lab"
            placeholderTextColor={theme.textFaint}
            style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
          />
        </View>

        {entries.length === 0 ? (
          <Text style={{ color: theme.textMuted }}>No courses found for your level right now.</Text>
        ) : (
          entries.map((entry) => (
            <View key={entry.timetable_entry_id} style={[styles.entryRow, { borderColor: theme.divider }]}>
              <View style={styles.flex}>
                <Text style={[styles.entryCode, { color: theme.text }]}>{entry.course_code}</Text>
                <Text style={{ color: theme.textMuted, fontSize: fontSize.xs }}>{entry.course_title}</Text>
              </View>
              <Button
                label="Start"
                size="sm"
                loading={starting === entry.course_id}
                disabled={starting !== null}
                onPress={() => handleStart(entry)}
              />
            </View>
          ))
        )}
      </Card>
    );
  }

  const isOpen = session.status === 'open';
  const presentCount = roster.filter((s) => getStudentStatus(checkins, s.user_id) === 'present').length;
  const lateCount = roster.filter((s) => getStudentStatus(checkins, s.user_id) === 'late').length;
  const excusedCount = roster.filter((s) => getStudentStatus(checkins, s.user_id) === 'excused').length;
  const absentCount = roster.length - (presentCount + lateCount + excusedCount);
  const rate = roster.length > 0 ? Math.round(((presentCount + lateCount) / roster.length) * 100) : 0;

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.statsGrid}>
        {[
          { label: 'Registered', value: roster.length, color: theme.text },
          { label: 'Present', value: presentCount, color: theme.success },
          { label: 'Absent', value: absentCount, color: theme.danger },
          { label: 'Late', value: lateCount, color: theme.warning },
          { label: 'Excused', value: excusedCount, color: theme.primary },
          { label: 'Rate', value: `${rate}%`, color: theme.primary },
        ].map((stat) => (
          <Card key={stat.label} style={styles.statCard}>
            <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>{stat.label}</Text>
          </Card>
        ))}
      </View>

      {isOpen && (
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => {
              haptics.select();
              setShowQR((v) => !v);
            }}
            style={[styles.actionChip, { borderColor: theme.cardBorder }]}
          >
            <Ionicons name="qr-code-outline" size={16} color={theme.text} />
            <Text style={[styles.actionChipText, { color: theme.text }]}>{showQR ? 'Hide QR' : 'Display QR'}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptics.select();
              // useFocusEffect above reloads everything, checkins included,
              // the moment this screen regains focus after the scan screen
              // calls router.back().
              router.push(`/class-rep/scan-checkin?sessionId=${session.id}` as Href);
            }}
            style={[styles.actionChip, { borderColor: theme.cardBorder }]}
          >
            <Ionicons name="scan-outline" size={16} color={theme.text} />
            <Text style={[styles.actionChipText, { color: theme.text }]}>Scan Student QR</Text>
          </Pressable>
        </View>
      )}

      {isOpen && showQR && (
        <Card style={styles.qrCard}>
          <View style={[styles.qrWrap, { backgroundColor: '#fff' }]}>
            <QRCode
              value={`${WEB_ORIGIN}/attendance/checkin?session=${session.id}`}
              size={160}
              color={theme.primary}
              backgroundColor="#fff"
            />
          </View>
          <Text style={[styles.qrTitle, { color: theme.text }]}>Have students scan this</Text>
          <Text style={{ color: theme.textMuted, fontSize: fontSize.xs, textAlign: 'center' }}>
            {presentCount} of {roster.length} checked in
          </Text>
        </Card>
      )}

      <View>
        <View style={[styles.searchRow, { borderColor: theme.cardBorder }]}>
          <Ionicons name="search" size={16} color={theme.textFaint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search student or matric..."
            placeholderTextColor={theme.textFaint}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
        <View style={styles.chipRow}>
          {STATUS_FILTERS.map((s) => {
            const active = statusFilter === s;
            return (
              <Pressable
                key={s}
                onPress={() => setStatusFilter(s)}
                style={[
                  styles.filterChip,
                  { borderColor: active ? theme.primary : theme.cardBorder, backgroundColor: active ? theme.primaryMuted : 'transparent' },
                ]}
              >
                <Text style={[styles.filterChipText, { color: active ? theme.primary : theme.text }]}>
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {isOpen && (
        <View style={styles.bulkRow}>
          <Button label="Mark All Present" variant="outline" size="sm" loading={busy} onPress={() => handleMarkAll('present')} />
          <Button label="Mark All Absent" variant="outline" size="sm" loading={busy} onPress={() => handleMarkAll('absent')} />
        </View>
      )}

      <Card padded={false}>
        <Text style={[styles.rosterHeader, { color: theme.text }]}>Roster ({filteredRoster.length})</Text>
        {filteredRoster.length === 0 ? (
          <Text style={[styles.rosterEmpty, { color: theme.textMuted }]}>No students match.</Text>
        ) : (
          filteredRoster.map((student) => {
            const status = getStudentStatus(checkins, student.user_id);
            return (
              <View key={student.student_id} style={[styles.studentRow, { borderColor: theme.divider }]}>
                <View style={styles.flex}>
                  <Text style={{ color: theme.text, fontFamily: fontFamily.medium }} numberOfLines={1}>
                    {student.full_name}
                  </Text>
                  <Text style={{ color: theme.textFaint, fontSize: fontSize.xs }}>{student.matric_number}</Text>
                </View>
                {isOpen ? (
                  <View style={[styles.segmented, { borderColor: theme.cardBorder }]}>
                    {(
                      [
                        { key: 'present' as StatusType, icon: 'checkmark' as const, color: theme.success },
                        { key: 'absent' as StatusType, icon: 'close' as const, color: theme.danger },
                        { key: 'late' as StatusType, icon: 'time' as const, color: theme.warning },
                        { key: 'excused' as StatusType, icon: 'alert-circle' as const, color: theme.primary },
                      ]
                    ).map((opt) => {
                      const active = status === opt.key;
                      return (
                        <Pressable
                          key={opt.key}
                          onPress={() => handleUpdateStatus(student.user_id, opt.key)}
                          style={[styles.segment, active && { backgroundColor: opt.color }]}
                        >
                          <Ionicons name={opt.icon} size={14} color={active ? '#fff' : theme.textFaint} />
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Ionicons
                    name={status === 'present' || status === 'late' ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={status === 'present' || status === 'late' ? theme.success : theme.textFaint}
                  />
                )}
              </View>
            );
          })
        )}
      </Card>

      {isOpen && !showFinalize && (
        <Button
          label="Finalize Session"
          variant="secondary"
          onPress={() => {
            haptics.select();
            setShowFinalize(true);
          }}
          fullWidth
        />
      )}

      {isOpen && showFinalize && (
        <Card style={{ gap: spacing.sm }}>
          <Text style={[styles.title, { color: theme.text }]}>Finalize Attendance</Text>
          <Pressable
            onPress={handleSendToLecturer}
            style={[styles.finalizeOption, { borderColor: theme.primary, backgroundColor: theme.primaryMuted }]}
          >
            <Ionicons name="send" size={20} color={theme.primary} />
            <View style={styles.flex}>
              <Text style={[styles.finalizeTitle, { color: theme.text }]}>Send to Lecturer</Text>
              <Text style={{ color: theme.textMuted, fontSize: fontSize.xs }}>Submits for verification and approval.</Text>
            </View>
          </Pressable>
          <Pressable onPress={handleDownloadPDF} style={[styles.finalizeOption, { borderColor: theme.cardBorder }]}>
            <Ionicons name="document-outline" size={20} color={theme.text} />
            <View style={styles.flex}>
              <Text style={[styles.finalizeTitle, { color: theme.text }]}>Download PDF</Text>
              <Text style={{ color: theme.textMuted, fontSize: fontSize.xs }}>Branded attendance sheet for printing.</Text>
            </View>
          </Pressable>
          <Button label="Cancel" variant="outline" onPress={() => setShowFinalize(false)} disabled={busy} fullWidth />
        </Card>
      )}

      {!isOpen && (
        <Button label="Submit to Lecturer" loading={busy} onPress={handleSendToLecturer} fullWidth />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
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
    marginTop: spacing.sm,
  },
  methodChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  methodChipText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  entryCode: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flexBasis: '30%',
    flexGrow: 1,
    gap: 2,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
  statLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  actionChipText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
  },
  qrCard: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  qrWrap: {
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.xs,
  },
  qrTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
  },
  bulkRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rosterHeader: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  rosterEmpty: {
    fontSize: fontSize.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  segment: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalizeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  finalizeTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
});
