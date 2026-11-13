# Verified attendance and examination eligibility — V1 pilot

## Status and scope

The new React/Go/PostgreSQL workflow is separate from the legacy attendance sheets
and class-rep check-ins. There is **no conversion of old check-ins into examination
eligibility evidence**, no face recognition, and no automatic exam-access block.
The mobile application uses the same authenticated API.

This is a pilot policy, **not a representation that the University of Uyo has
ratified these detailed rules**. Before consequential use, obtain written approval
of the threshold, counting unit, roster/late-registration rules, lateness, excuses,
appeal deadlines, correction authority and publication process. Run one course in
parallel with the official attendance process first.

## What the legacy audit found

- `attendance.go` manages JSON attendance sheets, separate from the class-rep
  `attendance_sessions`/`attendance_checkins` workflow in `dashboard.go`.
- Class reps could create sessions using a level-based authorization fallback.
- Student self-check-in used a static session UUID URL and immediately claimed
  presence; it did not submit a rotating challenge, device or location evidence.
- Lecturer session review existed but was not the new immutable, versioned
  per-student decision/eligibility workflow.
- Existing web API helpers and handlers have some incompatible request/response
  shapes. Mobile used legacy dashboard aggregates rather than a dedicated
  examination-eligibility engine.
- The generic ten-writes-per-minute IP limiter is unsuitable for a class sharing
  campus NAT. V2 has its own authenticated-account limits and a separate coarse
  network ceiling, without weakening limits on other routes.

## Deployment

1. Back up the database and apply migrations through **000018** as the DB owner.
   Migration 000017 is required if the invitation deployment has not happened.
2. Rerun the existing `make runtime-role` procedure to grant access to new tables.
   Use the restricted runtime DB role for the API; never use an owner/BYPASSRLS
   connection in production. Tenant RLS and composite foreign keys apply to V2.
3. Deploy API and React together. Updated attendance screens require migration
   000018 and `/api/v1/verified-attendance` endpoints.
4. Use HTTPS for the web application; browser geolocation requires a secure
   context. Test GPS accuracy in the actual halls before choosing a radius.
5. Install mobile dependencies and **rebuild the native app**: `expo-location` and
   its foreground-only permission configuration were added. Configure the API
   origin as usual and ensure `mobile/src/config.ts`'s web origin is correct.
6. Redis is optional for the pilot but recommended for shared cross-instance
   rate limits. PostgreSQL owns sessions, check-ins and snapshots; restarting
   Redis cannot erase attendance. Local limits are used if Redis fails.
7. Publish an approved privacy notice and retention/access policy before collecting
   evidence. Assess Nigerian data-protection obligations, including the Nigeria
   Data Protection Act 2023. Do not treat this implementation as legal approval.

There is no destructive legacy-data migration. Rolling back 000018 deletes **new
pilot data**; back it up before rollback. Do not roll back a live academic record
without an explicit operational recovery plan.

## Roles and session lifecycle

`draft → open → closed → finalized`; cancellation is a separate audited action.
There is no reopen-after-finalization endpoint.

- Only a currently assigned course lecturer creates sessions, reviews/corrects
  records, confirms a lecture was held, finalizes, cancels or publishes snapshots.
- A lecturer can delegate a **specific draft session** to an active class rep of
  the course's level. That rep may open/close it and display its rotating QR.
  Delegation does not grant creation, record review or finalization authority.
- HODs and active course-management admins have oversight/read access, not a
  blanket bypass to finalize a lecturer's session. A user who is also an assigned
  lecturer can act in that teaching capacity.
- A lecturer cannot approve their own student record.
- Students can see only their own records, disputes and published results.
  Staff snapshot history includes full calculation bases; student responses omit
  other students and the class-wide basis. Delegated reps see the session roster
  but not peers’ dispute text, precise derived location evidence or review reasons.

Opening is allowed from 30 minutes before to 3 hours after the planned start.
The 1–180 minute check-in window starts at opening. Its deadline is enforced by
server time even if the lecturer has not explicitly closed it. Expired open
sessions still need closure and lecturer review; they never automatically become
held lectures. Only one open session per course/semester is allowed. Exact
same-course/semester/start-time duplicates are prevented unless cancelled.

At opening, the system freezes distinct users with **approved registrations and
an enrolled registered-course entry** for this course/semester. Empty rosters
cannot open. Registration withdrawal does not erase existing roster membership;
late registration does not retroactively create an absence. Students omitted
from the frozen roster need enrollment reconciliation and an institution-approved
exception process; there is deliberately no unreviewed roster-insertion endpoint.
Archived-semester history remains accessible when new V2 sessions exist.

## Verification and device recovery

A shared server-generated HMAC challenge rotates every **20 seconds**, is bound
to one session and expires without a grace window. QR and link contain the same
challenge in the URL fragment. The student must explicitly confirm presence.
Old static QR links are not accepted by the updated student check-in screen.

A unique `(tenant, session, student)` record makes acceptance single-effect.
Retries return the existing submission even after closure and never add another
credit. This is intentionally **not** a globally single-use QR: an entire class
must be able to scan one displayed challenge.

Verification and outcome are independent:

- Verification: pending / verified / flagged / approved / rejected.
- Outcome: present / late / absent.
- Unsubmitted roster entries remain absent unless supervised review changes them.
- First device, replacement device, shared credential, missing/stale/inaccurate GPS,
  unconfigured venue or out-of-radius reading produce flags, not an automatic
  academic rejection. Submitted evidence is retained for lecturer review.
- Review happens after closure. Approval/rejection requires a reason. A lecturer
  can explicitly approve a submitted device after supervised identity verification;
  this revokes previous approvals for that student's other credentials. Device
  history remains for shared-device detection. Students can still submit from a
  replacement device, but it needs review.
- A lecturer can record supervised presence/late arrival without any successful
  scan, after closure, for a student on the frozen roster. This is the fallback
  for a lost phone, inaccessible camera, no internet or technical failure.

**Security boundaries:** device registration is a revocable random bearer
credential, not hardware attestation. Browser storage is weaker than native
secure storage; either credential can in principle be copied. Location readings
and timestamps are client evidence and can be spoofed. The server validates
bounds, freshness, accuracy and Haversine distance, but cannot establish that the
GPS source is genuine. QR rotation limits stale sharing, not real-time forwarding.
Anomalies are review signals, not findings of misconduct. Strong native key-based
proof/attestation, BLE and biometrics are future work, not advertised guarantees.

Student coordinates are not retained: records store derived distance, accuracy,
flags and a SHA-256 device-credential hash. Venue coordinates are stored as part
of session configuration. No background location subscription or face collection
is used. Hashing does not make these academic/device records anonymous.

## Finalization, disputes and corrections

The lecturer closes attendance, reviews all flagged submissions, confirms the
lecture actually happened and finalizes. Open disputes or flagged records block
finalization. A pending unsubmitted roster record is an absence, not an unresolved
submission; students must have a practical way to report failed attempts.

Students can dispute a closed or finalized roster record, including missing
attendance. Only one open dispute per student/session is allowed; submissions are
rate-limited. Lecturer review records a reason and resolves the open dispute.
Corrections to finalized records increment record/session revisions and append
before/decision evidence. Cancellation is also audited and excludes the session
from future calculations. Events and published snapshots reject UPDATE/DELETE
through DB triggers, even under the runtime role's blanket table grants. Trusted
DB owners remain an operational trust boundary.

Do not infer that every technical failure is visible to the server: a request
that never arrives cannot be automatically credited. Provide supervised fallback,
publicize disputes and assign review turnaround times before publication.

## Eligibility policy `pilot-session-75-v1`

- Scope: one student, course and semester; session-based, not contact-hours-based.
- Denominator: finalized, non-cancelled V2 sessions on that student's frozen roster.
- Numerator: those sessions with outcome present/late and verification
  verified/approved. Late receives full credit in this pilot.
- No automatic excused-absence credit or denominator exclusion is configured.
- Exact comparison: `credited × 100 >= total × 75`; display rounding is irrelevant.
- Zero eligible sessions: `not_assessable`, never 0% or automatically eligible.
- Open/closed sessions needing finalization, flagged finalized records or open
  disputes yield `pending_review`. This is neither credit nor an exam rejection.
- Otherwise: eligible / not_eligible under the pilot rule.

Publishing creates a new immutable snapshot version with policy identifier,
threshold, numerator, denominator, pending count, decision, timestamp, publisher
and session/record revisions and outcomes. Students can inspect their own
published results. Subsequent corrections do **not** rewrite old snapshots;
publish another version. Live previews always recalculate from current records.
There is no integration that automatically disables examination access.

## API and UI

Authenticated base: `/api/v1/verified-attendance` (all responses `no-store`).

- `GET /catalog`
- `GET /sessions?course=<uuid>&semester=<uuid>`
- `POST /sessions` — draft, camelCase creation fields
- `GET /sessions/:id` — role-filtered roster, disputes, staff audit
- `GET /sessions/:id/code` — lecturer/delegated rep only
- `POST /sessions/:id/{delegate,open,close,finalize,cancel}`
- `POST /sessions/:id/checkin` — challenge, device credential, optional location
- `POST /sessions/:id/review` — userId, outcome, reason, approveDevice
- `POST /sessions/:id/dispute` — reason; caller identity comes from authentication
- `GET /courses/:course/:semester/eligibility`
- `GET|POST /courses/:course/:semester/snapshots`

Web entry points: `/<department>/i/attendance`, `/l/attendance`, `/rep/attendance`,
and `/admin/attendance` under the department prefix. The old lecturer review
address now opens V2; legacy screens remain at the role's `/attendance/legacy`.
The mobile Attendance tab and class-rep attendance screen use V2; the main scanner
accepts new rotating codes. Lecturer review/finalization remains on the web.

Per-account limits: 120 V2 reads/minute, 30 writes/minute. A separate 3,000/minute
IP ceiling bounds classroom traffic without the legacy ten-write shared-NAT cap.
Authentication, CSRF for cookie-authenticated writes, live course authorization,
tenant RLS and database uniqueness are still enforced. No offline write queue
claims success; retries must reach the server, or use the supervised fallback.

## Verification and rollout gates

Automated tests cover exact 75%/rounding/zero/pending decisions, challenge expiry
and binding, soft location, classroom-NAT limits, concurrent idempotent check-ins,
role/tenant/student isolation, first/replaced/shared devices, mandatory lecturer
finalization, dispute impact, corrections and immutable versioned snapshots.
PostgreSQL integration tests use an isolated database and a restricted runtime
role (`DB_SOURCE` owner connection needed only to create/drop test databases).

Before widening the pilot: test actual Android/iOS builds, camera links and
permission denial; indoor GPS; shared campus networks; weak connections; device
replacement; lecturer review workload; missing roster entries; access to student
appeals; privacy/retention and backup recovery. No native-device field trial or
production migration is implied by automated tests. Current pilot transactions
use a department-wide advisory lock for consistent writes/snapshots; measure
contention and narrow lock scope before department-wide high-volume deployment.
