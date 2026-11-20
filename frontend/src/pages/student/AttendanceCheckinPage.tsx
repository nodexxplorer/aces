import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams, Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import {
  attendanceDevice,
  attendanceLocation,
  submitVerifiedAttendance,
  attendanceDetail,
  type AttendanceDetail,
} from '../../api/verified-attendance';
import { useDashboardPath } from '../../hooks/useDashboardPath';

export default function AttendanceCheckinPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const session = params.get('session');
  const challenge = new URLSearchParams(location.hash.slice(1)).get('challenge') || '';
  const revision = useRef(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  const dashboard = useDashboardPath();
  const valid = params.get('v') === '2' && !!session && !!challenge;
  const [preview, setPreview] = useState<AttendanceDetail | null>(null);
  useEffect(() => {
    let active = true;
    revision.current += 1;
    setPreview(null);
    setDone(false);
    setMessage('');
    if (valid && session)
      attendanceDetail(session)
        .then((data) => {
          if (active) setPreview(data);
        })
        .catch((e) => {
          if (active)
            setMessage(
              e instanceof Error
                ? e.message
                : 'Could not load this lecture. Confirm your course registration or ask the lecturer for help.',
            );
        });
    return () => {
      active = false;
      revision.current += 1;
    };
  }, [session, valid, challenge]);

  async function checkIn() {
    if (!valid || !session || !preview || busy || done) return;
    const rev = revision.current;
    setBusy(true);
    setMessage('');
    try {
      const evidence = await attendanceLocation();
      if (rev !== revision.current) return;
      const record = await submitVerifiedAttendance(session, challenge, attendanceDevice(), evidence);
      if (rev !== revision.current) return;
      setDone(true);
      setMessage(
        record.verification === 'rejected' || record.outcome === 'absent'
          ? 'Your existing attendance was reviewed as absent. View the decision and submit a dispute from Attendance if it is incorrect.'
          : record.verification === 'flagged' || record.verification === 'pending'
            ? 'Check-in received for lecturer review. Location or device uncertainty is not an automatic absence. You can track the decision and raise a dispute from Attendance.'
            : 'Attendance recorded. Verified or approved attendance becomes official after the lecturer finalizes the session.',
      );
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    } catch (e) {
      if (rev !== revision.current) return;
      setMessage(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          (e instanceof Error
            ? e.message
            : 'Could not submit attendance. Retry if this code is still current, or scan the latest code.'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-xl mx-auto p-6">
      <Card className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Lecture check-in</h1>
        {!valid ? (
          <p role="alert">
            This is a legacy or incomplete attendance link. Ask the lecturer for the current rotating attendance code.
            Legacy links do not count toward the new eligibility record.
          </p>
        ) : (
          <>
            {preview ? (
              <div>
                <h2 className="text-lg font-semibold">
                  {preview.courseCode} · {preview.session.title}
                </h2>
                <p>
                  {preview.session.venue} · {new Date(preview.session.scheduled_at).toLocaleString()}
                </p>
              </div>
            ) : (
              <p>Loading lecture details…</p>
            )}
            <p>
              Submit attendance for the lecture you are physically attending. With your permission, this uses one fresh
              location reading and a revocable browser registration credential. Precise coordinates are not retained in
              the attendance record.
            </p>
            <p className="text-sm">
              No face recognition is used. Missing GPS or an unverified/replaced device sends the check-in for review.
              If you cannot check in, ask the lecturer for supervised attendance.
            </p>
            {!done && (
              <Button disabled={busy || !preview} onClick={() => void checkIn()}>
                {busy ? 'Submitting attendance…' : 'Confirm presence and submit'}
              </Button>
            )}
          </>
        )}
        {message && <p role="status">{message}</p>}
        <Link className="block underline" to={dashboard.replace(/\/dashboard$/, '/attendance')}>
          View my attendance and disputes
        </Link>
      </Card>
    </div>
  );
}
