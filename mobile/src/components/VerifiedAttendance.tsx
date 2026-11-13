import { useEffect, useRef, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useRouter } from 'expo-router';
import Text from './ui/Text';
import Card from './ui/Card';
import Button from './ui/Button';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import { WEB_ORIGIN } from '../config';
import {
  verifiedCatalog,
  verifiedSessions,
  verifiedEligibility,
  verifiedDetail,
  verifiedAction,
  verifiedCode,
  type VerifiedCourse,
  type VerifiedSession,
  type VerifiedDetail,
  type VerifiedEligibility,
} from '../api/verified-attendance';

const errorText = (e: unknown) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
  'Could not load attendance. Please retry.';
export default function VerifiedAttendance() {
  const { theme } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [courses, setCourses] = useState<VerifiedCourse[]>([]);
  const [course, setCourse] = useState<VerifiedCourse | null>(null);
  const [sessions, setSessions] = useState<VerifiedSession[]>([]);
  const [report, setReport] = useState<VerifiedEligibility | null>(null);
  const [detail, setDetail] = useState<VerifiedDetail | null>(null);
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [expires, setExpires] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    revision.current++;
    setCourses([]);
    setCourse(null);
    setSessions([]);
    setDetail(null);
    setReport(null);
    verifiedCatalog()
      .then((data) => {
        if (active) {
          setCourses(data.courses);
          setCourse(data.courses[0] ?? null);
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
      revision.current++;
    };
  }, [user?.id, user?.tenant?.slug]);
  async function load(c: VerifiedCourse, rev: number) {
    const [list, eligibility] = await Promise.all([verifiedSessions(c), verifiedEligibility(c)]);
    if (rev === revision.current) {
      setSessions(list);
      setReport(eligibility);
    }
  }
  useEffect(() => {
    const rev = ++revision.current;
    setDetail(null);
    setSessions([]);
    setReport(null);
    setError('');
    if (course)
      void load(course, rev).catch((e) => {
        if (rev === revision.current) setError(errorText(e));
      });
  }, [course]);
  const id = detail?.session.id;
  const canCode = detail?.canOperate && detail.session.status === 'open';
  useEffect(() => {
    setCode('');
    setExpires('');
    if (!id || !canCode) return;
    let active = true;
    const tick = async () => {
      try {
        const c = await verifiedCode(id);
        const url = `${WEB_ORIGIN}/${user?.tenant?.urlCode || 'co'}/i/attendance/checkin?v=2&session=${id}#challenge=${encodeURIComponent(c.challenge)}`;
        if (active) {
          setCode(url);
          setExpires(c.expiresAt);
        }
      } catch (e) {
        if (active) {
          setCode('');
          setError(errorText(e));
        }
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, canCode, user?.tenant?.urlCode]);
  async function select(id: string) {
    const rev = ++revision.current;
    setDetail(null);
    setReason('');
    setError('');
    try {
      const d = await verifiedDetail(id);
      if (rev === revision.current) setDetail(d);
    } catch (e) {
      if (rev === revision.current) setError(errorText(e));
    }
  }
  async function act(action: string, input: object = {}) {
    if (!detail || !course || busy) return;
    const rev = revision.current;
    setBusy(true);
    setError('');
    try {
      await verifiedAction(detail.session.id, action, input);
      const d = await verifiedDetail(detail.session.id);
      if (rev === revision.current) {
        setDetail(d);
        setReason('');
      }
      await load(course, rev);
    } catch (e) {
      if (rev === revision.current) setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.stack}>
      <Text style={[styles.heading, { color: theme.text }]}>Verified attendance</Text>
      <Card>
        <Text style={{ color: theme.text }}>
          75% pilot · Only finalized sessions count. Legacy sheets are excluded. This pilot does not automatically bar
          students from exams.
        </Text>
        <Text style={{ color: theme.textMuted, marginTop: 8 }}>
          Location and device checks are reviewable signals. Ask the lecturer for supervised attendance if your phone or
          connection fails.
        </Text>
      </Card>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: theme.danger }}>
          {error}
        </Text>
      )}
      <Button label="Scan lecture QR" onPress={() => router.push('/scan')} />
      {courses.map((c) => (
        <Pressable
          disabled={busy}
          key={`${c.id}:${c.semester_id}`}
          onPress={() => setCourse(c)}
          style={[
            styles.choice,
            {
              borderColor:
                course?.id === c.id && course?.semester_id === c.semester_id ? theme.primary : theme.cardBorder,
            },
          ]}
        >
          <Text style={{ color: theme.text }}>
            {c.code} · {c.academic_year} {c.semester} — {c.title}
          </Text>
        </Pressable>
      ))}
      {!courses.length && (
        <Text style={{ color: theme.textMuted }}>No accessible course registration or attendance history found.</Text>
      )}
      {course && (
        <Button
          label="Refresh records"
          variant="outline"
          disabled={busy}
          onPress={() => {
            void load(course, revision.current)
              .then(async () => {
                if (detail) {
                  const rev = revision.current;
                  const d = await verifiedDetail(detail.session.id);
                  if (rev === revision.current) setDetail(d);
                }
              })
              .catch((e) => setError(errorText(e)));
          }}
        />
      )}
      {report?.results.map((r) => (
        <Card key={r.user_id}>
          <Text style={{ color: theme.text }}>
            Credited {r.credited} / {r.total} finalized sessions ·{' '}
            {r.percentage === null ? 'Not assessable' : `${r.percentage.toFixed(2)}%`}
          </Text>
          <Text style={{ color: theme.text }}>
            {r.decision.replace(/_/g, ' ')} · {r.pending} unresolved sessions
          </Text>
        </Card>
      ))}
      {sessions.map((s) => (
        <Pressable disabled={busy} key={s.id} onPress={() => void select(s.id)}>
          <Card>
            <Text style={{ color: theme.text }}>
              {s.title} · {s.status}
            </Text>
            <Text style={{ color: theme.textMuted }}>
              {new Date(s.scheduled_at).toLocaleString()} · {s.venue}
            </Text>
          </Card>
        </Pressable>
      ))}
      {detail && (
        <Card>
          <View style={styles.stack}>
            <Text style={[styles.heading, { color: theme.text }]}>{detail.session.title}</Text>
            {detail.canOperate && detail.session.status === 'draft' && (
              <Button disabled={busy} label="Open lecturer-approved session" onPress={() => void act('open')} />
            )}
            {detail.canOperate && detail.session.status === 'open' && (
              <Button disabled={busy} label="Close check-in" onPress={() => void act('close')} />
            )}
            {!!code && (
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: 'white',
                  padding: 12,
                }}
              >
                <QRCode value={code} size={240} />
                <Text style={{ color: '#111', marginTop: 8 }}>
                  Rotates every 20 seconds · expires {new Date(expires).toLocaleTimeString()}
                </Text>
              </View>
            )}
            {detail.canOperate && (
              <Text style={{ color: theme.textMuted }}>
                Only the assigned lecturer can review exceptions and finalize attendance, using the web portal.
              </Text>
            )}
            {detail.records.map((r) => (
              <View key={r.user_id} style={styles.record}>
                <Text style={{ color: theme.text }}>
                  {r.name} · {r.matric}
                </Text>
                <Text style={{ color: theme.text }}>
                  {r.outcome} · {r.verification}
                </Text>
                <Text style={{ color: theme.textMuted }}>
                  {r.flags.join(', ') || 'No review flags'}
                  {r.review_reason ? ` · ${r.review_reason}` : ''}
                </Text>
              </View>
            ))}
            {detail.disputes.map((d) => (
              <Text key={d.id} style={{ color: theme.text }}>
                Dispute: {d.reason} · {d.status}
                {d.resolution ? ` — ${d.resolution}` : ''}
              </Text>
            ))}
            {['closed', 'finalized'].includes(detail.session.status) &&
              detail.records.some((r) => r.user_id === user?.id) &&
              !detail.disputes.some((d) => d.user_id === user?.id && d.status === 'open') && (
                <>
                  <TextInput
                    accessibilityLabel="Attendance dispute reason"
                    placeholder="Explain a technical failure or incorrect record"
                    placeholderTextColor={theme.textMuted}
                    multiline
                    maxLength={2000}
                    value={reason}
                    onChangeText={setReason}
                    style={[styles.input, { color: theme.text, borderColor: theme.cardBorder }]}
                  />
                  <Button
                    disabled={busy || reason.trim().length < 5}
                    label="Submit dispute"
                    onPress={() => void act('dispute', { reason })}
                  />
                </>
              )}
          </View>
        </Card>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  stack: { gap: 14 },
  heading: { fontSize: 22, fontWeight: '700' },
  choice: { borderWidth: 1, padding: 12, borderRadius: 10 },
  record: { paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 90 },
});
