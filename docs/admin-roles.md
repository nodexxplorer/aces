# Administrator roles and access

## Names matter

There are not two independent privilege tiers named `admin` and `delegated_admin`.
The database/JWT role **`admin`** is presented in normal API responses as
**`delegated_admin`** (`ParseRoleName` in `backend/internal/service/role_service.go`).
Both names are recognized as the grant-controlled admin tier.

**`hod`** is the full department authority. It is not subject to delegated-admin
grant flags. All of these roles remain scoped to their department, not every
other tenant on the platform.

## Responsibilities

A HOD oversees the department, appoints/revokes administrators, and decides which
admin areas each delegate may use. Only the HOD may grant/revoke the privileged
`hod` and `admin` roles or manage `/admin-permissions`.

Delegated admins carry out only the areas explicitly granted by the HOD:

| Grant | Responsibilities |
|---|---|
| `can_manage_results` | Results, grades, assignments and CGPA rules |
| `can_manage_users` | Users, staff, lecturers, class reps, approvals and profile requests |
| `can_manage_finance` | Dues, payments, expenses, graduation fees and bursar tools |
| `can_manage_courses` | Courses, registrations, attendance and materials |
| `can_view_analytics` | Analytics, reports and predictions |
| `can_manage_announcements` | Announcements, notifications, class notices and help articles |
| `can_backup_data` | Backups and restores |
| `can_manage_complaints` | Complaints, feedback and campus reports |
| `can_manage_alumni` | Alumni, mentorship, jobs, events and donations |
| `can_manage_course_forms` | Course-form history and signatures |
| `can_manage_settings` | Sessions, semesters, rollover, calendar and settings |

An active admin role **without an active grant gives no admin-area capability**.
A delegate cannot appoint another admin/HOD or expand their own grant, even when
they have user-management permission. Other roles held by that person, such as
lecturer or bursar, retain their own permissions. A particular action must also
be allowed by its server route; a grant does not override HOD-only routes.

## Getting delegated-admin access

1. Obtain an account in the correct department. Public signup does not confer
   administrator privileges.
2. Ask that department's HOD to assign the delegated-admin role. The existing
   role API accepts `POST /api/v1/roles/assign` with `user_id`,
   `role: "delegated_admin"`, and an optional `reason`.
3. In **User Management → Permissions**, the HOD selects that person, enables the
   required admin grant flags and saves. The server accepts this only after the
   person holds the admin role. The corresponding endpoint is
   `POST /api/v1/admin-permissions`; later changes use
   `PUT /api/v1/admin-permissions/:user_id`.
4. Sign out and sign in again after a role assignment to obtain updated token
   claims. Grant changes are checked server-side on authenticated requests.

The HOD may revoke the grant while retaining the role, or remove the role.
Neither grants alone nor a client-side role selection grants server access.

## Getting HOD/full department authority

An existing HOD can assign `hod` through the protected role-management API.
Users cannot self-promote, and a delegated admin cannot perform this assignment.

For a new department, use the operator-authorized first-HOD email invitation
below. This creates HOD authority only after explicit acceptance. The legacy
`seed_admin` command creates a delegated admin, not a HOD.

## Email invitations (implemented)

The invitation workflow supersedes manual account/password distribution for new
staff. `admin` still means the grant-controlled delegated-admin tier.

### Deployment

Apply migration **000017_access_invitations**, then rerun `make runtime-role`
(as the migration owner) so the restricted API role can access the new tables.
Configure `FRONTEND_PUBLIC_URL` to the HTTPS web origin and configure SMTP.
`SMTP_MOCK=true` is for development only: it logs mail rather than delivering it.
Never enable mock email in production, since invitation links are credentials.

### Establishing the first HOD

Run the existing operator CLI with the migration owner's DSN. Supply the intended
HOD's personal account email, not a department contact/approval mailbox:

```sh
# During department creation:
go run ./cmd/tenant create -slug uniuyo-ee -name "Electrical Engineering" \
  -matric-code EG/EE -hod-email hod@example.edu -hod-name "Jane Doe"

# Or after creating a department (including departments created by `ensure`):
go run ./cmd/tenant invite-hod -slug uniuyo-ee \
  -email hod@example.edu -name "Jane Doe"

# Rotate and resend an unused setup invitation (UUID is printed by the CLI):
go run ./cmd/tenant invite-hod -slug uniuyo-ee -resend INVITATION_UUID
# Revoke a mistaken setup invitation before issuing another:
go run ./cmd/tenant invite-hod -slug uniuyo-ee -revoke INVITATION_UUID
```

These operator commands have no equivalent public/delegated-admin endpoint.
They refuse a second open bootstrap invitation and refuse bootstrap forever once
HOD setup is complete. Migration 000017 also closes bootstrap for departments
with historical HOD records. Losing the last HOD requires an audited operator
recovery procedure; it does not reopen setup automatically.

`seed_admin` remains a legacy delegated-admin/password-recovery tool. It is no
longer the recommended first-account workflow and does not grant HOD authority.

### Sending and approving invitations

Open **People & Access → Invitations** (`/:code/admin/invitations`).

- A HOD can send lecturer, delegated-admin and additional-HOD invitations.
- A delegate with an active user-management grant can send lecturer invitations
  directly, and request admin/HOD invitations for HOD approval.
- Pending privileged requests notify active HOD accounts. Recipients receive no
  actionable access link until a HOD approves the exact role and grants.
- The HOD can approve, revoke, or resend approved invitations. Requesters who
  retain user-management permission can revoke their requests or resend their
  approved invitations, but cannot approve privileged requests.
- A delegated-admin invitation replaces any existing admin grant set with exactly
  the checked grants; it does not silently union permissions.
- Additional HOD access does not remove any current HOD. Leadership transfer is
  still a separate procedure, not an invitation side effect.

The page lists the latest 100 department invitations, delivery failures and
per-invitation event history. Open states are pending approval or sent; expired,
accepted and revoked states are shown separately. The role/recipient/grants of a
request are immutable: revoke and create a new request to change them.

### Accepting

Links open `/accept-invitation` with the secret in the URL fragment, not the query
string. The page removes that fragment and retains the invitation temporarily in
session storage so the user can sign in and return.

Opening/previewing never creates an account or grants a role. New users explicitly
accept while setting their name and a 12–72-byte password; the email link verifies
the invited address. Existing users must sign into the matching department/email
account (including Modools where applicable). Acceptance never resets their
password or overwrites their primary role. A fresh session opens the invited
role's department dashboard.

Invitations expire after 72 hours. Acceptance rechecks current authorizer
permissions and atomically creates/links the account, assigns the role, applies
approved grants, records audit events and consumes the token. Duplicate/concurrent
acceptance cannot create multiple accounts. Revoked/expired/rotated tokens fail.
Only token hashes are stored in the database. Resends invalidate the previous
link, are limited to once per minute and five sends per hour per invitation;
creation is capped at 30 requests per department per hour (with HTTP IP limits
as well). Email delivery failures remain visible and can be retried.

### API

All management routes require a tenant-bound authenticated session and live
user-management/HOD authority:

- `GET /api/v1/invitations`
- `POST /api/v1/invitations` — `{email, name, role, grants}`
- `POST /api/v1/invitations/:id/approve|resend|revoke`
- `GET /api/v1/invitations/:id/events`

Rate-limited public/token-addressed routes:

- `POST /api/v1/auth/invitations/inspect` — `{tenant, token}`
- `POST /api/v1/auth/invitations/accept` — `{tenant, token, firstName?, lastName?, password?}`

Acceptance of an existing account additionally requires that account's valid
session and CSRF protection when cookie-authenticated. Inspection is read-only
and CSRF-exempt. Invitation responses are marked `Cache-Control: no-store`.
