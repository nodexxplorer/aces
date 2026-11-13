# Notifications: delivery and Railway rollout

This change is notification-only. Backup/restore remains on hold; nothing here
turns the existing backup screen into a recovery system.

## What is connected

| Activity | Notification behaviour |
| --- | --- |
| Password login | Successful sign-in alert under Authentication |
| Modools login | Web session creation and successful native code exchange alert |
| Signup/invitation acceptance | Welcome/account-ready alert under Authentication |
| Payments | Existing completion, verification and status-change hooks now enqueue durable jobs; legacy invalid notification-type labels are normalized to the database enum |
| Course registration | Student submission acknowledgement, class-rep review alerts and student approval/rejection/status updates under Academic updates |
| Course-form signing | Draft-upload acknowledgement and actual signed-form-ready alert; uploading a draft is **not** signing completion |
| Connect DM/group messages | Recipient-only alerts, including image/voice messages; queued atomically with message creation, not on idempotent resend |
| Connect social | Connection request/acceptance and directly-added group-member alerts |
| Complaints | Submission acknowledgement, assignee and student assignment alerts, existing status/resolution alerts under System |
| Other existing hooks | Results, announcements, account approvals, profile review, birthdays and study reminders use the same central channel dispatcher |

This does not invent new business workflows: CRF rejection or complaint replies
that have no existing action are not added. Invitation/reset-code emails remain
explicit security flows outside the optional activity-notification dispatcher.
Future business features need explicit event hooks; there is no catch-all that
reliably infers every action. Chat email is immediate when enabled, **not a digest**.

## Preferences and devices

- Account-wide in-app/email/push switches and per-topic email/push switches are
  enforced at enqueue and rechecked before external sending. Turning off in-app
  stops new history rows; it does not erase existing history or chat messages.
- Partial preference updates preserve omitted fields. Set both quiet-hour values
  to `null` to disable them. Both values must be supplied together if changed.
- Quiet hours defer email and push, not in-app history. Time zone is explicitly
  **Africa/Lagos (UTC+1)**. Overnight/daytime windows work; equal start/end is off.
  Authentication alerts bypass quiet hours but still respect channel switches.
- The website's **Enable this browser** control requests OS permission **and**
  registers a PushSubscription. Account push preference alone cannot obtain that
  permission. The website's Save button still saves account/topic preferences.
- Browser push needs HTTPS, a production service worker, valid VAPID keys, and a
  supported push provider. Allowed endpoints are FCM, Mozilla, Apple Web Push and
  Windows notification hosts; arbitrary user-supplied endpoints are rejected to
  prevent SSRF. iPhone/iPad browser push requires a supported installed Home
  Screen web app. Plain Vite development mode has no production push worker.
- The production Workbox service worker imports `push-events.js`. It stores only
  the active account binding, suppresses alerts/clicks belonging to another or
  signed-out account, and refuses external action navigation. No notification
  body is cached by this handler. Refresh/reload after first deployment so the
  new worker and account binding are active.
- Native push needs a physical-device development/production build and OS
  permission. The native push toggle retries permission/registration and reports
  failures. Notification taps open the matching Connect conversation, or the
  communication inbox for other alerts, only for the matching account/tenant.
- Multiple devices are supported (maximum 20 active registrations/user/tenant).
  Registrations are refreshed at sign-in/app startup; registrations not refreshed
  within 30 days are not used. Expired provider registrations are deactivated.
  Normal logout removes the current registration and unsubscribes/unregisters
  locally. Local/forced logout also attempts platform unregistration. Cleanup is
  best effort if the device is offline; already displayed OS/email copies cannot
  be recalled. Test shared-device/account-switch behaviour before broad rollout.
- External Connect previews are generic; complaint external alerts contain no
  complaint text. Conversation eligibility is rechecked before external chat
  alerts. Authorization still applies when opening the app/downloads.

Defaults match the existing backend preference defaults; no bulk rewrite of
saved user choices occurs. In particular System push is initially off: enable
it if you want the settings-page System-topic test to exercise push.

## Delivery semantics

Migration **000020** adds tenant-RLS `notification_events`,
`notification_deliveries` and `notification_devices`. Existing saved native
push tokens are copied into device records once. Subsequent sends use devices.
The legacy push-token API stays compatible and now registers a device too.

The central service saves history/events/channel jobs in one transaction. It
never contacts providers in the HTTP request. Connect message creation includes
notification enqueue in the **same domain transaction**; level-promotion confirmation also enqueues within its domain transaction. Most
other existing handlers synchronously enqueue **after** their business operation, with entity-based
retry keys where available. This reduces the old fire-and-forget gap, but does
**not** claim atomic domain+notification writes for every legacy operation:
process/database failure between an older business write and enqueue can still
lose that event. Some pre-existing bulk producers (for example new-dues
broadcasts) still discover recipients in a detached background task; their
fanout itself is not yet durable. Enqueue failures are logged and require
investigation. The delivery jobs already queued remain durable.

The worker runs independently of `ENABLE_IN_APP_SCHEDULERS`, every three seconds,
with tenant-scoped batches. Atomic claims, `SKIP LOCKED` and expiring two-minute
leases permit multiple API replicas and recovery after worker death. A failed
transport retries with exponential delays, up to six attempts, then remains
failed for operator investigation. Quiet-hour deferral does not consume provider
retry attempts. Preferences/device/conversation changes can skip a pending job.

Statuses:
- `queued`: pending, retry scheduled or deferred by quiet hours.
- `processing`: leased by a worker.
- `accepted`: in-app live event dispatched, or external provider accepted the
  request. **Not proof of inbox arrival, OS display or a human reading it.**
- `simulated`: mock transport; **nothing sent externally**.
- `skipped`: channel/eligibility/device no longer permits sending.
- `failed`: retry budget exhausted or invalid persisted payload.

SMTP/Expo/Web Push do not provide exactly-once delivery here. A crash/timeout
following provider acceptance but before status persistence can result in a
retry/duplicate. In-app history/event keys and Connect messages are deduplicated;
web alerts use an event tag and web stores ignore duplicate notification IDs.
Expo ticket errors are checked even for HTTP 200, including DeviceNotRegistered.
Expo receipt polling and email bounce/complaint webhooks are **not** implemented.

SMTP connections enforce timeouts and TLS (except a local development SMTP
server); header fields are sanitized. Mock sends no longer log email bodies,
push tokens or push bodies. Reset-code flows should never be tested against
production users casually.

## Real test controls

Web/mobile **Send a test notification** calls `POST /notifications/test` with a
stable request ID. It queues an actual **System-topic** event to the current
user; disabled topics/channels and missing devices produce no corresponding
jobs. The web test button requires saved settings. Five new tests per ten minutes
are allowed per user/tenant. Retrying the same ID reuses the event.

**Refresh test status** reads the persisted jobs. There is no timer-based fake
success toast. The delivery-status endpoint reports simulated/live/unconfigured
transport setup without exposing private keys, tokens or subscriptions. Live
means the transport is configured for attempts, not that credentials have been
verified by a delivery. Test/status endpoints are owner/tenant-scoped and no-store.

## Railway deployment (not executed in this session)

1. Apply migrations through **000020** using the migration owner, including the
   earlier Connect migration. Refresh runtime-role grants (`make runtime-role`)
   for the three new tables; keep the API role non-owner and non-BYPASSRLS.
2. Configure Railway secrets, without committing them:
   - `SMTP_MOCK=false`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`,
     `SMTP_PASSWORD`, `SMTP_FROM`; use a provider reachable from your Railway
     plan/network and configure sender SPF/DKIM/DMARC with that provider.
   - `PUSH_MOCK=false` for real Expo and browser sends.
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto/HTTPS).
     Generate a matching P-256 VAPID key pair using a trusted tool; keep the
     private key only in server secrets. Changing keys requires resubscription.
   - Correct HTTPS `FRONTEND_PUBLIC_URL`, `API_PUBLIC_URL`, allowed origins and
     existing cookie/CSRF configuration. Use real public URLs, not localhost.
3. Verify Expo project/APNs/FCM credentials in the native build configuration.
   Deploy the production web build so the push service worker is installed;
   rebuild/release native clients and obtain permissions on real phones.
4. Keep the API service awake for timely delivery. If Railway sleeping/serverless
   is enabled, arrange an authenticated scheduled request to
   `POST /api/v1/internal/cron/notifications` using `INTERNAL_CRON_SECRET` through
   the established `X-Internal-Secret` header, or run the API worker continuously.
   The cron endpoint is bounded; large queues need continuous processing.
5. Observe real test job statuses, SMTP/provider dashboards and real inboxes/OS
   trays, then exercise the actual business actions in the matrix above. Confirm
   foreground/background/cold-start, offline retry, quiet hours, logout/account
   switching, and revoked group/DM access. Do not treat the UI toast as evidence.
6. Monitor queued/failed counts and oldest due job **per tenant**, database growth,
   provider limits and processing latency. Retention/archiving of outbox history
   is an operator policy still to define; this change does not automatically
   delete notification audit/history records or endlessly retry failed jobs.

Rollback requires stopping notification clients/workers before rolling down
000020. Do not roll it down under a running Connect sender: enqueue is now part
of the message transaction.

## Validation

- React production build passed; complete web suite: **228 tests in 47 files
  passed**. Lint: **0 errors, 100 existing warnings**.
- Native TypeScript and Android JS/Hermes export passed. These are not device tests.
- Broad Go race suite passed with the unrelated, pre-existing
  `TestDepartmentLogoFolderNames` failure excluded (expected logo count mismatch).
- Go race tests passed for dispatch/quiet hours/provider error parsing and restricted
  PostgreSQL integration: retry/recovery, simulation, exhaustion, disabled-device
  cleanup, preference PATCH/null semantics, endpoint safety, owner-only test
  reports/rate limits, deduplication and transaction/tenant isolation.
- Sandbox PostgreSQL tests use an external test-only UUID-function shim where
  native extensions are unavailable; production migrations are not rewritten.
- No live SMTP/Expo/APNs/FCM/browser delivery or Railway deployment was verified.
