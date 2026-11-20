import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useAuthStore } from '../../stores/authStore';
import {
  attendanceCatalog,
  attendanceSessions,
  attendanceDetail,
  attendanceAction,
  attendanceCode,
  attendanceEligibility,
  attendanceSnapshots,
  publishAttendanceSnapshot,
  createVerifiedSession,
  attendanceLocation,
  type AttendanceCourse,
  type VerifiedSession,
  type AttendanceDetail,
  type EligibilityReport,
  type EligibilitySnapshot,
} from '../../api/verified-attendance';

const field = 'w-full rounded border border-surface-300 bg-transparent p-2 dark:border-surface-600';
const message = (e: unknown) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
  (e instanceof Error ? e.message : 'Attendance request failed.');
const label = (s: string) => s.replace(/_/g, ' ');

export default function VerifiedAttendancePage() {
  const user = useAuthStore((s) => s.user);
  const [courses, setCourses] = useState<AttendanceCourse[]>([]);
  const [choice, setChoice] = useState('');
  const [sessions, setSessions] = useState<VerifiedSession[]>([]);
  const [detail, setDetail] = useState<AttendanceDetail | null>(null);
  const [report, setReport] = useState<EligibilityReport | null>(null);
  const [snapshots, setSnapshots] = useState<EligibilitySnapshot[]>([]);
  const [qr, setQr] = useState('');
  const [link, setLink] = useState('');
  const [expires, setExpires] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewUser, setReviewUser] = useState('');
  const [outcome, setOutcome] = useState('present');
  const [reason, setReason] = useState('');
  const [approveDevice, setApproveDevice] = useState(false);
  const [delegate, setDelegate] = useState('');
  const [held, setHeld] = useState(false);
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [scheduled, setScheduled] = useState('');
  const [duration, setDuration] = useState(15);
  const [radius, setRadius] = useState(100);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const course = courses.find((c) => `${c.id}:${c.semester_id}` === choice);
  const generation = useRef(0);
  const selection = useRef(0);

  useEffect(() => {
    let active = true;
    generation.current += 1;
    setCourses([]);
    setChoice('');
    setSessions([]);
    setDetail(null);
    setReport(null);
    setSnapshots([]);
    setNotice('');
    setError('');
    attendanceCatalog()
      .then((data) => {
        if (!active) return;
        setCourses(data.courses);
        if (data.courses[0]) setChoice(`${data.courses[0].id}:${data.courses[0].semester_id}`);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
      generation.current += 1;
    };
  }, [user?.id, user?.tenant?.slug]);

  async function loadCourse(c: AttendanceCourse, revision = generation.current) {
    const [list, eligibility] = await Promise.all([
      attendanceSessions(c.id, c.semester_id),
      attendanceEligibility(c.id, c.semester_id),
    ]);
    if (revision !== generation.current) return;
    setSessions(list);
    setReport(eligibility);
    // Student snapshot responses contain only their own published results.
    try {
      const data = await attendanceSnapshots(c.id, c.semester_id);
      if (revision === generation.current) setSnapshots(data);
    } catch {
      if (revision === generation.current) setSnapshots([]);
    }
  }
  useEffect(() => {
    const rev = ++generation.current;
    setDetail(null);
    setSnapshots([]);
    setSessions([]);
    setReport(null);
    setError('');
    setReason('');
    setHeld(false);
    if (course)
      void loadCourse(course, rev).catch((e) => {
        if (rev === generation.current) setError(message(e));
      });
    // choice identifies the course and semester; course objects are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice]);

  const sessionId = detail?.session.id;
  const canCode = detail?.canOperate && detail.session.status === 'open';
  useEffect(() => {
    setQr('');
    setLink('');
    setExpires('');
    if (!sessionId || !canCode) return;
    let active = true;
    const tick = async () => {
      try {
        const code = await attendanceCode(sessionId);
        const url = new URL(`/${user?.tenant?.urlCode || 'co'}/i/attendance/checkin`, window.location.origin);
        url.searchParams.set('session', sessionId);
        url.searchParams.set('v', '2');
        url.hash = new URLSearchParams({ challenge: code.challenge }).toString();
        const image = await QRCode.toDataURL(url.toString(), { width: 280, margin: 2 });
        if (active) {
          setQr(image);
          setLink(url.toString());
          setExpires(code.expiresAt);
        }
      } catch (e) {
        if (active) {
          setQr('');
          setLink('');
          setError(message(e));
        }
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [sessionId, canCode, user?.tenant?.urlCode]);

  async function run(work: () => Promise<unknown>) {
    if (busy || !course) return;
    const rev = generation.current;
    const c = course;
    const id = detail?.session.id;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      if (rev !== generation.current) return;
      await loadCourse(c, rev);
      if (id) {
        const d = await attendanceDetail(id);
        if (rev === generation.current) setDetail(d);
      }
      if (rev === generation.current) {
        setNotice('Saved.');
        setReason('');
        setHeld(false);
      }
    } catch (e) {
      if (rev === generation.current) setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function selectSession(id: string) {
    const rev = generation.current;
    const pick = ++selection.current;
    setError('');
    setReason('');
    setReviewUser('');
    setHeld(false);
    setDetail(null);
    try {
      const d = await attendanceDetail(id);
      if (rev === generation.current && pick === selection.current) {
        setDetail(d);
        setDelegate(d.session.delegate_id || '');
      }
    } catch (e) {
      if (rev === generation.current && pick === selection.current) setError(message(e));
    }
  }
  const ownRecord = detail?.records.find((r) => r.user_id === user?.id);
  return (
    <div className="space-y-5 p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">Verified attendance</h1>
      <Card className="p-4">
        <p>
          <strong>Pilot · 75% per course</strong> · Only finalized sessions count. Late attendance receives full credit
          in pilot policy {report?.policyVersion || 'pilot-session-75-v1'}; excuses require a lecturer’s recorded
          decision. This pilot does not automatically bar anyone from examinations.
        </p>
        <p className="mt-2 text-sm">
          Location and device registration are supporting signals, not proof of identity. Technical failures can be
          reviewed. Legacy sheets are not included.
        </p>
      </Card>
      {error && (
        <p role="alert" className="text-danger-600">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <label className="block">
        Course and semester
        <select className={field} value={choice} disabled={busy} onChange={(e) => setChoice(e.target.value)}>
          <option value="">Select a course</option>
          {courses.map((c) => (
            <option key={`${c.id}:${c.semester_id}`} value={`${c.id}:${c.semester_id}`}>
              {c.code} · {c.academic_year} {c.semester}
              {c.is_active === false ? ' (archived)' : ''} — {c.title}
            </option>
          ))}
        </select>
      </label>
      {!courses.length && (
        <p>
          No accessible courses available. Attendance requires approved course registration or a teaching assignment.
        </p>
      )}
      {course?.can_manage && course.is_active !== false && (
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Plan a lecture attendance session</h2>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() =>
                createVerifiedSession({
                  courseId: course.id,
                  semesterId: course.semester_id,
                  title,
                  venue,
                  scheduledAt: new Date(scheduled).toISOString(),
                  durationMinutes: duration,
                  radiusM: radius,
                  latitude: latitude === '' ? null : Number(latitude),
                  longitude: longitude === '' ? null : Number(longitude),
                }),
              );
            }}
          >
            <label>
              Session title
              <input
                className={field}
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Venue
              <input
                className={field}
                required
                maxLength={200}
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
              />
            </label>
            <label>
              Scheduled start (your local time)
              <input
                className={field}
                type="datetime-local"
                required
                value={scheduled}
                onChange={(e) => setScheduled(e.target.value)}
              />
            </label>
            <label>
              Check-in window (minutes)
              <input
                className={field}
                type="number"
                min={1}
                max={180}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </label>
            <label>
              Venue latitude (optional)
              <input
                className={field}
                type="number"
                min={-90}
                max={90}
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </label>
            <label>
              Venue longitude (optional)
              <input
                className={field}
                type="number"
                min={-180}
                max={180}
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </label>
            <label>
              Review radius (metres)
              <input
                className={field}
                type="number"
                min={20}
                max={1000}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                void attendanceLocation().then((p) => {
                  if (p) {
                    setLatitude(String(p.latitude));
                    setLongitude(String(p.longitude));
                  } else setError('Location unavailable. Enter a verified venue location or use supervised review.');
                });
              }}
            >
              Use current location as venue
            </Button>
            <Button disabled={busy} type="submit">
              Create draft
            </Button>
          </form>
        </Card>
      )}
      {course && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void run(async () => undefined)}>
            Refresh records
          </Button>
          {course.can_manage && (
            <Button
              disabled={busy}
              onClick={() => void run(() => publishAttendanceSnapshot(course.id, course.semester_id))}
            >
              Publish pilot eligibility snapshot
            </Button>
          )}
        </div>
      )}
      {report && (
        <Card className="p-4 overflow-x-auto">
          <h2 className="font-semibold">Live eligibility preview</h2>
          <table className="w-full text-sm mt-3">
            <thead>
              <tr>
                <th className="text-left">Student</th>
                <th>Credited / held</th>
                <th>Percentage</th>
                <th>Unresolved sessions</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {report.results.map((r) => (
                <tr key={r.user_id} className="border-t">
                  <td className="py-3">
                    {r.name}
                    <br />
                    {r.matric}
                  </td>
                  <td className="text-center">
                    {r.credited} / {r.total}
                  </td>
                  <td className="text-center">{r.percentage === null ? '—' : `${r.percentage.toFixed(2)}%`}</td>
                  <td className="text-center">{r.pending}</td>
                  <td className="text-center">{label(r.decision)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs mt-2">
            Decisions use the exact ratio, not rounded display percentages. Open/closed sessions and unresolved disputes
            hold the decision for review.
          </p>
        </Card>
      )}
      <Card className="p-4">
        <h2 className="font-semibold">Sessions</h2>
        <div className="divide-y">
          {sessions.map((s) => (
            <button
              key={s.id}
              disabled={busy}
              className="block w-full py-3 text-left"
              onClick={() => void selectSession(s.id)}
            >
              <strong>{s.title}</strong> · {label(s.status)}
              <br />
              <span className="text-sm">
                {new Date(s.scheduled_at).toLocaleString()} · {s.venue} · revision {s.revision}
              </span>
            </button>
          ))}
        </div>
        {!sessions.length && <p className="mt-2">No sessions yet.</p>}
      </Card>
      {detail && (
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold">
            {detail.session.title} · {label(detail.session.status)}
          </h2>
          {detail.canOperate && (
            <div className="flex flex-wrap gap-2">
              {detail.session.status === 'draft' && (
                <Button disabled={busy} onClick={() => void run(() => attendanceAction(detail.session.id, 'open'))}>
                  Open and freeze approved roster
                </Button>
              )}
              {detail.session.status === 'open' && (
                <Button disabled={busy} onClick={() => void run(() => attendanceAction(detail.session.id, 'close'))}>
                  Close check-in
                </Button>
              )}
            </div>
          )}
          {detail.canManage && detail.session.status === 'draft' && (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => attendanceAction(detail.session.id, 'delegate', { delegateId: delegate || null }));
              }}
            >
              <label>
                Delegate a class representative (optional)
                <select className={field} value={delegate} onChange={(e) => setDelegate(e.target.value)}>
                  <option value="">No delegate / revoke delegation</option>
                  {detail.delegates?.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.matric} — {rep.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={busy}>
                Save delegation
              </Button>
            </form>
          )}
          {qr && (
            <div className="space-y-2">
              <img src={qr} alt="Rotating attendance check-in QR" className="w-64 h-64" />
              <p className="text-sm">
                Code expires at {new Date(expires).toLocaleTimeString()}. Keep this screen open; codes rotate every 59
                seconds.
              </p>
              <a className="underline break-all" href={link}>
                Current check-in link
              </a>
            </div>
          )}
          {detail.canManage && detail.session.status === 'closed' && (
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={held} onChange={(e) => setHeld(e.target.checked)} />I confirm this
                lecture was actually held and the roster and exceptions have been reviewed.
              </label>
              <Button
                disabled={busy || !held}
                onClick={() => void run(() => attendanceAction(detail.session.id, 'finalize', { held: true }))}
              >
                Finalize official pilot records
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Student</th>
                  <th>Outcome</th>
                  <th>Verification</th>
                  <th>Review flags</th>
                </tr>
              </thead>
              <tbody>
                {detail.records.map((r) => (
                  <tr key={r.user_id} className="border-t">
                    <td className="py-3">
                      {r.name}
                      <br />
                      {r.matric}
                    </td>
                    <td>{r.outcome}</td>
                    <td>{label(r.verification)}</td>
                    <td>
                      {r.flags.map(label).join(', ') || '—'}
                      {r.review_reason && <p>Decision: {r.review_reason}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detail.disputes.length > 0 && (
            <div>
              <h3 className="font-semibold">Disputes</h3>
              {detail.disputes.map((d) => (
                <p key={d.id} className="py-2">
                  {detail.records.find((r) => r.user_id === d.user_id)?.name}: {d.reason} · {d.status}
                  {d.resolution && ` — ${d.resolution}`}
                </p>
              ))}
            </div>
          )}
          {detail.canManage && ['closed', 'finalized'].includes(detail.session.status) && (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() =>
                  attendanceAction(detail.session.id, 'review', { userId: reviewUser, outcome, reason, approveDevice }),
                );
              }}
            >
              <h3 className="font-semibold">Review, supervised fallback, or audited correction</h3>
              <select className={field} required value={reviewUser} onChange={(e) => setReviewUser(e.target.value)}>
                <option value="">Select student</option>
                {detail.records
                  .filter((r) => r.user_id !== user?.id)
                  .map((r) => (
                    <option key={r.user_id} value={r.user_id}>
                      {r.matric} — {r.name}
                    </option>
                  ))}
              </select>
              <select
                aria-label="Attendance outcome"
                className={field}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              >
                <option value="present">Present</option>
                <option value="late">Late (full pilot credit)</option>
                <option value="absent">Absent / rejected</option>
              </select>
              <label>
                Decision reason
                <textarea
                  className={field}
                  minLength={5}
                  maxLength={2000}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <label className="flex gap-2">
                <input type="checkbox" checked={approveDevice} onChange={(e) => setApproveDevice(e.target.checked)} />I
                supervised identity re-verification and approve this submitted device (replaces prior approval).
              </label>
              <Button disabled={busy} type="submit">
                Save decision and resolve open dispute
              </Button>
            </form>
          )}
          {!detail.canManage &&
            ownRecord &&
            ['closed', 'finalized'].includes(detail.session.status) &&
            !detail.disputes.some((d) => d.user_id === user?.id && d.status === 'open') && (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => attendanceAction(detail.session.id, 'dispute', { reason }));
                }}
              >
                <label>
                  Report a missing/incorrect attendance or technical failure
                  <textarea
                    className={field}
                    minLength={5}
                    maxLength={2000}
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <Button disabled={busy} type="submit">
                  Submit dispute
                </Button>
              </form>
            )}
          {detail.canManage && detail.session.status !== 'cancelled' && (
            <form
              className="space-y-2 border-t pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  window.confirm(
                    'Cancel this session? Published snapshots remain unchanged; generate a new version after correction.',
                  )
                )
                  void run(() => attendanceAction(detail.session.id, 'cancel', { reason }));
              }}
            >
              <label>
                Cancellation reason
                <input
                  className={field}
                  minLength={5}
                  maxLength={2000}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <Button type="submit" variant="outline" disabled={busy}>
                Cancel session with audit
              </Button>
            </form>
          )}
          {detail.events.length > 0 && (
            <details>
              <summary>Immutable audit history</summary>
              {detail.events.map((e) => (
                <div key={e.id} className="border-t py-2 text-sm">
                  <strong>{label(e.action)}</strong> · {new Date(e.created_at).toLocaleString()} · actor {e.actor_id}
                  <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(e.evidence, null, 2)}</pre>
                </div>
              ))}
            </details>
          )}
        </Card>
      )}
      {snapshots.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold">Published pilot snapshots</h2>
          <p className="text-sm">
            Corrections do not overwrite earlier snapshots. Publish a new version to reflect changes.
          </p>
          {snapshots.map((s) => (
            <details key={s.id} className="py-2 border-t">
              <summary>
                Version {s.version} · {new Date(s.created_at).toLocaleString()} · {s.policy_version}
              </summary>
              <ul className="space-y-2 py-3">
                {s.results.map((r) => (
                  <li key={r.user_id}>
                    <strong>
                      {r.name} · {r.matric}
                    </strong>{' '}
                    — {r.credited}/{r.total} credited sessions ·{' '}
                    {r.percentage === null ? '—' : `${r.percentage.toFixed(2)}%`} · {label(r.decision)}
                    {r.pending > 0 ? ` (${r.pending} unresolved)` : ''}
                  </li>
                ))}
              </ul>
              <details>
                <summary>Calculation basis and revisions</summary>
                <pre className="overflow-x-auto text-xs whitespace-pre-wrap">{JSON.stringify(s.basis, null, 2)}</pre>
              </details>
            </details>
          ))}
        </Card>
      )}
      <p className="text-sm">
        Legacy attendance remains available at the legacy attendance address and never contributes to this pilot.
      </p>
    </div>
  );
}
