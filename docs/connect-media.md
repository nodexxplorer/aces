# Connect images and recorded voice notes (V1)

React web and Expo native use the same authenticated Go API for direct chats and
groups. This replaces the web's local-only file/voice placeholders; messages and
attachment metadata now persist in PostgreSQL. Existing text-only clients remain
compatible. This is **not end-to-end encryption**, nor WhatsApp's algorithm.

## User experience and limits

- Send text, up to **four images**, or **one recorded voice note**. Captions are
  optional. Voice and images cannot be mixed in one message.
- JPEG/PNG/WebP web originals (up to 25 MiB) are resized automatically. Native
  chooses images only and converts through the platform image manipulator.
  Clients target 1600px on the longest edge and JPEG quality 88 before upload.
- The server validates decoded content, not filename or declared MIME. Image
  input is limited to 8 MiB, 12 megapixels and 12000px per dimension. It applies
  JPEG EXIF orientation, flattens transparency onto white, resizes to at most
  1600px, strips metadata and re-encodes JPEG quality 88 (at most 3 MiB).
  Text/lecture-note legibility still needs visual testing on representative files;
  this is lossy standard compression, not an original-quality document transfer.
- Record using the microphone, **stop and preview**, then explicitly send or
  discard. Maximum recording time is five minutes. No existing-audio picker is
  available. Server recording intents are short-lived/single-use, but **cannot
  prove microphone origin against a modified client**.
- The server accepts actual WebM/Ogg/MP4 audio containers with exactly one audio
  stream and no video/subtitle streams. It transcodes to mono 24kHz, 32kbps AAC
  in M4A, strips source metadata, and checks the resulting duration (300.5-second
  tolerance for container/encoder padding). Input <=8 MiB; output <2 MiB.
- Video, documents, arbitrary files and existing-audio attachment controls are
  disabled. Backend container/stream validation also rejects disguised video.
- Received media loads **only on request**, showing size first. Web audio uses
  standard playback/seek controls; native provides play/pause and 10-second seek.
  Full images can be opened for reading. There is no automatic media prefetch.
- Progress and errors are displayed. Retry keeps upload and message nonces stable
  within the live draft; ambiguous send results lock editing. Repeating a send
  cannot create another message for that nonce. Discard is **not recall**: a
  message already accepted by the server remains sent. Reloading/leaving the
  conversation discards the local draft; drafts are not persisted offline.
- Messages/captions are limited to 8000 Unicode characters server-side (clients
  use an 8000 UTF-16-unit input limit). Histories return the latest 200 messages,
  ascending; older-history pagination is outside this change.

## Authorization and storage

Actors must be active, approved members of the bound tenant. DMs require an
accepted connection; groups require current membership. Attachments must belong
to the sender and exact conversation before transactional message binding.
Pending uploads are not readable. Downloads reauthorize current participants,
so removed group members/revoked connections cannot fetch additional media.
Already downloaded copies cannot be remotely revoked. Live group recipients are
resolved from current database membership, not stale WebSocket rooms.

Files live in `STORAGE_LOCAL_PATH/.connect-private`, not the public signed-upload
namespace. Media content/metadata and message histories/send responses use
`Cache-Control: no-store`; media is served with fixed validated MIME and
`nosniff`. The generic upload route explicitly denies this directory. Storage
must not be independently exposed by a CDN/static server. Restrict filesystem
access and include private files in the same backup/restore plan as the database.
Multiple API replicas must see the **same durable storage volume**. This V1 uses
local/shared filesystem storage, not object-storage signed links.

Uploads are reserved before processing: 100 uploads and 100 MiB input per actor
per rolling 24 hours. Usage survives discard/failed decoding; completed nonce
retries are not billed again. Recording intents: 30 per 10 minutes. Redis-backed
media rate limiting: 120 requests/minute per tenant/user. Processor concurrency
is two per API process; voice probe/transcode timeouts are 10/45 seconds. Upload
handlers alone extend the general HTTP deadlines for slow mobile connections;
configure the upstream proxy/body limit for at least 9 MiB and 150 seconds.

## Rollout checklist (not executed against production)

1. Back up the DB and storage. Apply migration **000019** using the normal
   migration owner. It adds message nonce columns/indexes, the group message
   tenant identity index, media, intent and durable usage tables with tenant RLS.
2. Ensure the runtime role has SELECT/INSERT/UPDATE/DELETE on
   `connect_media`, `connect_recording_intents`, `connect_media_usage`, and
   its existing messages/group membership/users/connection grants. Use the
   established migration-owner/default-privileges convention (`make runtime-role`
   as the migration owner refreshes existing grants); never make the API
   owner/BYPASSRLS just to bypass missing grants.
3. Deploy backend **with ffmpeg and ffprobe** and writable durable private storage.
   The Docker image installs ffmpeg and includes the maintenance binary.
   Optional `CONNECT_FFMPEG_PATH` / `CONNECT_FFPROBE_PATH` override executable
   paths. Without them on PATH, image/text work but voice processing returns 503.
4. Deploy React web. Microphone access needs HTTPS and supported MediaRecorder
   (WebM/Opus, MP4 or Ogg). Verify browser microphone permissions and playback.
5. **Rebuild the native app**: new `expo-audio` module/plugin and microphone
   permissions cannot be delivered by JavaScript-only OTA. Background recording
   and playback are disabled. Test Android/iOS permission denial, five-minute
   auto-stop, stop/preview/discard, interruption, switching conversations/account,
   backgrounding while recording, and backgrounding a finished preview.
6. Test image orientation and screenshot/lecture-note legibility, both directions
   of DM, group delivery, offline retry (including a lost send response), seek,
   expired access tokens/reload and former-member denial on real devices.
7. Schedule cleanup below, inspect its dry-run output and monitor 400/409/429/503
   rates, processing latency, disk use, and orphan count before wider release.

### Maintenance

Administrative DSN must be the media-table owner or BYPASSRLS/superuser with
visibility across tenants and DML grants for all three media tables. Never use
that DSN for API requests. Use the API's storage mount and environment-secret
mechanism (do not put credentials in command arguments/history).

```sh
# Dry run is the default; minimum age is 24h.
./connect-media-cleanup -storage "$STORAGE_LOCAL_PATH" -age 24h
# After inspecting the dry run:
./connect-media-cleanup -storage "$STORAGE_LOCAL_PATH" -age 24h -apply
```

The job locks and rechecks pending rows before deletion to avoid racing send.
It removes abandoned processing/ready uploads, orphan UUID media files and stale
atomic-write temporary files, expired unreferenced recording intents, and usage
older than seven days. Attached media is retained. DB deletion commits before
unlinking files; interruption can leave a harmless orphan for the next sweep,
not a ready row pointing at an intentionally deleted file. A crash or failed
compensation after account deactivation can leave reservations until this job.
Do not roll back migration 000019 while media clients are live: rollback removes
metadata/nonces and leaves files to be swept or restored from backup.

## Automated validation

- `cd frontend && npm run build && npm test && npm run lint`
- `cd mobile && npx tsc --noEmit` and `npx expo export --platform android`
- `cd backend && go test -race ./internal/connectmedia ./internal/api ./internal/ws`
- Connect integration tests require an administrative `DB_SOURCE` able to create
  disposable DBs/roles and a PostgreSQL install supporting the baseline UUID
  extensions. Tests run the service under a separate restricted runtime role.
  `ACES_MIGRATIONS_DIR` optionally points at a test migration directory.
- Processor tests use real ffmpeg/ffprobe when installed; otherwise voice tests
  explicitly skip. Tests cover resizing/metadata/orientation, malformed content,
  overlong/disguised video, tenant/participant privacy, group removal, durable
  quotas, upload retries, concurrent message retries, voice binding, and migration
  rollback/reapply. UI tests cover DM/group explicit sends, selection limits,
  preview/cancel, uncertain-send retry and on-demand download/error retry.

Device recording/playback and full browser-to-backend interaction remain manual
release gates; typechecks/bundle export do not replace them.
