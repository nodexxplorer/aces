# Multi-tenancy

One ACES deployment can serve several departments. Each department is a **tenant**. It has its own accounts, students, courses, results, announcements, payments and receipt numbers, and no department can read or change another department's data.

**Status:** the backend, the database, the web app and the mobile app are department-aware (see [Mobile app](#mobile-app)). Modools sign-in creates the account in the department the person picks. If onboarding finds that the registration number belongs to another department, the student is sent there to finish (see [Modools onboarding](#modools-onboarding) and [Known gaps](#known-gaps)).

## Decisions

| Question | Decision |
|---|---|
| What is a tenant? | One department. |
| Where is the data? | One shared PostgreSQL database. Each tenant-owned table has a `tenant_id` column. |
| How is isolation enforced? | PostgreSQL row-level security (RLS) on every tenant table, connections bound to one department, and foreign keys that cannot cross departments. |
| Do accounts span departments? | No. Accounts are per department. The same email or matric number can exist once in each department. |
| How is the department chosen? | At sign-in. It is carried in the access and refresh tokens. There are no subdomains and no per-request header. |

## Concepts

- **Registry.** The `tenants` table holds each department's `slug` (its identifier in requests, for example `unilag-ce`), `name`, `institution`, `faculty`, `matric_code` (see [Matric numbers](#matric-numbers)), `description` and `logo` (see [Branding](#branding)), and `is_active`. The API can read it but cannot change it.
- **Legacy department.** Everything that existed before multi-tenancy belongs to `uniuyo-ce` (ID `00000000-0000-4000-8000-000000000001`). Access tokens issued before the change carry no department claim, and the server treats them as belonging to this department.
- **Default department.** `DEFAULT_TENANT_SLUG` (default `uniuyo-ce`). Requests that name no department use it. Mobile clients depend on it, so it must stay active.
- **Active and inactive.** A deactivated department cannot sign in, and its existing tokens stop working.

## How a request finds its department

| Entry point | Where the department comes from |
|---|---|
| `POST /api/v1/auth/login` | `tenant` in the body. Empty or missing means the default department. |
| `POST /api/v1/auth/signup/student`, `POST /api/v1/auth/signup/lecturer` | `tenant` in the body. |
| `POST /api/v1/auth/request-otp`, `verify-otp`, `reset-with-otp` | `tenant` in the body. |
| `GET /api/v1/auth/modools/login?tenant=…` | `tenant` query parameter. It is kept in a short-lived cookie for the provider round trip. |
| Any authenticated request | The `tenant_id` claim in the access token. The server checks it against the registry on each request, and caches the result for up to a minute. |
| `POST /api/v1/auth/refresh` | The `tenant_id` claim in the refresh token. |
| WebSocket `GET /api/v1/ws` | The authenticated user's department. |
| Calendar feed, email unsubscribe link, Paystack webhook | The department that owns the token or payment reference. A narrow lookup function returns only the owning department's ID. |
| Scheduled jobs (birthday greetings, study-task reminders) | Each active department, in turn. |
| `GET /api/v1/tenants` (public) | The active departments: slug, name, institution, faculty, matric code, description, logo path and whether each is the default. It exposes no account data. |
| `GET /api/v1/tenants/:slug/logo` (public) | The department's logo image, or `404` when it has none or is inactive. |

Errors:

- Unknown department: `400 {"error":"unknown department"}`.
- Deactivated department: `403 {"error":"this department is not active"}`.
- Modools callback for an unknown or inactive department: redirects to `/login?error=unknown_department`.

Tokens carry `tenant_id`, which the server trusts, and `tenant_slug`, which is for display only. Both are inside the signed token, so editing either one invalidates the token.

## How isolation is enforced

1. **Row-level security.** Every tenant table has `tenant_id UUID NOT NULL DEFAULT app_current_tenant()` and the policy `tenant_id = app_current_tenant()` for reads and writes. `app_current_tenant()` returns the department bound to the session (`app.tenant_id`). With no department bound it returns NULL, so queries see no rows and inserts fail. The default is closed.
2. **Bound connections.** The server keeps one connection pool per department. When a physical connection opens, it sets `app.tenant_id` once, so that connection can serve only that department. Each request runs on the pool of the department bound to its context (`internal/tenant`). Work with no department bound goes to a system pool, where RLS hides every tenant row.
3. **Foreign keys within a department.** Foreign keys between tenant tables include `tenant_id`. Referential-integrity checks run without RLS, so without this a row could point at another department's row by UUID.
4. **Uniqueness within a department.** Unique constraints include `tenant_id`. The same email or matric number can exist once per department.
5. **Receipt numbers.** Counters are kept per department (`tenant_counters`), so each department has its own receipt sequence.
6. **Deliberately shared tables.** `tenants` (the registry), `help_articles` and `ai_models` (platform-wide catalogues) have no `tenant_id`.

## Matric numbers

A matric number has the form `20/EG/EE/1234`: the entry year, the faculty (`EG`), the department (`EE`) and a serial number of three to five digits. Each department has a **matric code**, the faculty and department part (`EG/EE`), stored in `tenants.matric_code`.

| Department | Matric code |
|---|---|
| Computer Engineering (`uniuyo-ce`, the legacy department) | `EG/CO` |
| Chemical Engineering | `EG/CE` |
| Electrical Engineering | `EG/EE` |
| Petroleum Engineering | `EG/PE` |
| Agricultural Engineering | `EG/AE` |
| Food Engineering | `EG/FE` |
| Civil Engineering | `EG/CV` |
| Mechanical Engineering | `EG/ME` |

Migration `000005` sets `EG/CO` on `uniuyo-ce`, so its students are checked exactly as before. The other codes are set with `cmd/tenant` (see [Day-to-day operations](#day-to-day-operations)).

**Rules**

- The matric number must match the department the student is signing in to (onboarding) or signing up to (email sign-up). It must have the shape `^\d{2}/<code>/\d{3,5}$`, checked after the matric number is upper-cased.
- A matric number that belongs to another active department is refused, and the message names that department: `This matric number belongs to Department of Electrical Engineering. Choose that department to continue.` The student signs in to that department instead.
- Any other matric number gets `400` with the department's format, for example `Matric numbers for Department of Computer Engineering look like 20/EG/CO/1234.`
- A department with no code refuses the check with `422`: `Matric numbers are not set up for <name> yet. Contact the department office.` This fails closed. No matric number is accepted until a code is set.
- Each code is unique across departments, so a matric number maps to one department. The database enforces this with a unique index and a format check.
- A change to a code takes effect within about a minute, when the server's department cache expires, or on restart. Accounts that already exist are not checked again.

**Where it is checked**

| Endpoint | Used by |
|---|---|
| `POST /api/v1/auth/onboarding` | The web app's onboarding page, after a Modools sign-in. The department is the one the student signed in to. A matric number that belongs to another department is refused with `400` and a `department` object (see [Modools onboarding](#modools-onboarding)). |
| `POST /api/v1/auth/signup/student` | Email sign-up. The web app's sign-up page uses Modools only, so this is the mobile app's path. Mobile sends no department, so it is checked against the default department. |

## Modools onboarding

Modools sign-in creates the account in the department the person picked on the sign-in page, or in the default department. A Modools account has no registration number, so onboarding asks for it.

1. The student completes onboarding with a matric number.
2. If the number belongs to the department they are in, onboarding completes.
3. If the number belongs to another department, onboarding is refused with `400`. The body has the usual `error` and a `department` object with that department's `slug` and `name`. The web page shows the department and a button that starts Modools sign-in for it.
4. The student signs in to that department and completes onboarding there with the same matric number. The dashboard is then that department's.

The account created in the first department stays, with onboarding incomplete and no matric number. Nothing removes it, and nothing moves the student. Accounts are per department, so the two accounts are separate. A seamless redirect would need deferred account creation or a move between departments, which are not in place (see [Known gaps](#known-gaps)).

## Branding

Each department has its own name, description and logo. The sign-in and sign-up pages show them, and so does the dashboard: the navbar, the sidebar and the footer. The product itself is called **Admin Pack**. It is the same for every department.

| Field | Set with | Where it shows |
|---|---|---|
| `name` | `cmd/tenant update -name` | Sign-in and sign-up pages, navbar, sidebar, footer, emails, receipts, PDFs, calendar feed, assistant |
| `description` | `cmd/tenant update -description`, up to 500 characters | Sign-in and sign-up pages, navbar, sidebar, footer |
| `logo` | `cmd/tenant update -logo <file>`, or all departments at once with `cmd/tenant logos -dir branding/department-logos` | Sign-in and sign-up pages, navbar, sidebar, footer, emails, dues receipts |
| `contact_email` | `cmd/tenant update -contact-email <address>` (`""` clears it) | Dues receipts |
| `approval_email` | `cmd/tenant update -approval-email <address>` (`""` clears it; without one the approval page uses `contact_email`) | Approval page: the "Contact the department" link |

- **Logo rules.** The file must be a PNG, JPEG or WebP image of at most 256 KiB. The server checks the file's contents, not its extension. SVG is refused because it can carry script, and GIF is refused as well. `-remove-logo` removes it. A department without a logo shows a neutral building icon in its place, never another organisation's mark.
- **Serving.** `GET /api/v1/tenants/:slug/logo` returns the logo with its image type. It is public, because the sign-in page shows the logo before anyone has signed in. It is cached for five minutes. A missing, inactive or logo-less department gets `404`.
- **Where the user's department comes from.** The `user` object in every auth response, and `GET /api/v1/auth/me`, carry the user's `tenant` (slug, name, institution, faculty, matric code, description, `logoUrl` and, when the department has them, `contactEmail` (the dues receipts print it) and `approvalContactEmail` (the approval address, or the contact address when there is none)). The dashboard and the approval page read it from there. The public list in `GET /api/v1/tenants` leaves the contact address out.
- **Department output.** Emails, the password-reset email, dues receipts, result slips, attendance sheets, calendar feeds, the assistant's replies and the welcome, sign-in and approval messages name the department. Each email is sent from the department's name, and each recipient gets the brand of their own department. Emails and dues receipts show the logo; a department without one gets its name only. Emails link the logo from `API_PUBLIC_URL`, which defaults to `FRONTEND_PUBLIC_URL`.
- **Admin Pack.** The platform's name appears only where no department applies: the mobile app's refusals, the help center, and mail sent with no department bound. The faculty stamp on receipts, the `aces.zone` UID domain and the `ACES-` payment references are left as they are. The stamp is the faculty's, and every department is in faculty EG. The references and UIDs are identifiers, not display text.
- **Logo folder.** `branding/department-logos/` holds one file per department, named after its matric code: `EG-EE.png` is the logo for `EG/EE`. `EG-CO.png` is the ACES logo. The other files are placeholders, which the apply step skips until they are replaced. See the README in that folder.

## Database roles

The database has two roles, and they must stay separate.

| Role (example name) | Used by | Rules |
|---|---|---|
| Owner (`aces_user`) | Migrations, `runtime-role.sql`, `cmd/tenant` | Owns the tables. Table owners bypass RLS, so the server never connects as the owner. |
| Runtime (`aces_app`) | The API server and `cmd/seed_admin` | Not a superuser, no `BYPASSRLS`, not an owner. Created by `backend/deploy/postgres/runtime-role.sql`. |

**Startup check.** The server and `seed_admin` check their connection at startup. A superuser, a `BYPASSRLS` role or a table owner is refused, with an error that names the problem. `DB_ALLOW_RLS_BYPASS=true` lets the process run anyway and logs a warning. Use it only on a development machine. With it set, departments are not isolated from each other.

**Grants.** `backend/deploy/postgres/runtime-role.sql` creates the runtime role if it is missing, and on every run sets its attributes and password (from `APP_DB_PASSWORD`) and grants:

- `CONNECT` on the database and `USAGE` on the `public` schema;
- `SELECT, INSERT, UPDATE, DELETE` on all tables, `USAGE, SELECT, UPDATE` on sequences, and `EXECUTE` on functions;
- nothing on `tenants` except `SELECT`, because the registry is changed with `cmd/tenant`;
- nothing on `schema_migrations`.

Run it after every migration. Tables and sequences that a migration creates have no grants for the runtime role until the script runs again. A missed run shows up as `permission denied`, not as a silent exposure.

## Setting up

### Docker Compose

From `backend/`, `docker-compose up -d` runs these steps in order:

1. `db` starts (PostgreSQL 16).
2. `migrate` applies the migrations as the owner. The migrations create the default department `uniuyo-ce`.
3. `roles` runs `runtime-role.sql`. The runtime role's password comes from `APP_DB_PASSWORD`. The default, `aces_app_pass`, is for local development only, so set your own anywhere else.
4. `api` starts as the runtime role (`APP_DB_USER`, default `aces_app`).

Then create the first admin for each department (see [Day-to-day operations](#day-to-day-operations)).

### New database

Run these steps in order, substituting your own connection strings.

1. **Migrate as the owner.** `DB_SOURCE=<owner DSN> make migrate-up`
2. **Create the runtime role.** `DB_SOURCE=<owner DSN> APP_DB_USER=aces_app APP_DB_PASSWORD=<secret> make runtime-role`
3. **Create departments as the owner.** `DB_SOURCE=<owner DSN> go run ./cmd/tenant create -slug unilag-ce -name "Department of Computer Engineering" -matric-code EG/CO -institution "University of Lagos" -faculty "Faculty of Engineering"`. A department created without `-matric-code` cannot onboard or sign up students until you set one (see [Matric numbers](#matric-numbers)).
4. **Create each department's first admin as the runtime role.** `DB_SOURCE=<runtime DSN> ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password> go run ./cmd/seed_admin -tenant unilag-ce`
5. **Run the server as the runtime role.** Set `DB_SOURCE` to the runtime DSN and set `DEFAULT_TENANT_SLUG`.

Pass the owner's DSN on the command line for owner-level steps. Keep only the runtime DSN in `.env`.

### Existing single-department deployment

1. Back up the database.
2. Run migrations `000004_multi_tenancy` and `000005_matric_codes` as the owner. Existing rows are assigned to `uniuyo-ce`, which gets the matric code `EG/CO`, and existing tokens keep working as that department.
3. Run `make runtime-role` as the owner.
4. Change the server's `DB_SOURCE` from its current superuser or owner connection to the runtime role. Until you do, the server refuses to start.
5. Deploy. The sign-in pages show a department picker once two departments are active.

### Rolling back

`000004_multi_tenancy.down.sql` folds the departments back into one dataset. It works only while a single department exists. Once two departments share an email or matric number, restoring the old unique constraints fails.

`000005_matric_codes.down.sql` removes the matric codes. Without them the server refuses matric-based sign-up and onboarding, so roll back only with the previous release running.

## Day-to-day operations

- **List departments.** `go run ./cmd/tenant list`. It shows each department's matric code.
- **Add a department.** Create it with `cmd/tenant create -matric-code EG/XX` (owner connection), then seed its first admin with `cmd/seed_admin -tenant <slug>` (runtime connection). Seed a lecturer the same way with `-role lecturer`, setting `LECTURER_EMAIL`, `LECTURER_PASSWORD` and `LECTURER_STAFF_ID`. Both accounts are approved and belong to that department only. It appears in `GET /api/v1/tenants` straight away.
- **Set or change a matric code.** `go run ./cmd/tenant update -slug <slug> -matric-code EG/EE` (owner connection). The code is the faculty and department pair, such as `EG/EE`, not `EE`. `-matric-code ""` clears it, and the department then refuses matric-based sign-up and onboarding. The change takes effect within about a minute.
- **Change a department's name, details or branding.** `go run ./cmd/tenant update -slug <slug> [-name ...] [-institution ...] [-faculty ...] [-description ...] [-contact-email ...] [-approval-email ...] [-logo file.png] [-remove-logo]`. Only the flags you pass are changed. `-institution ""`, `-faculty ""` and `-description ""` clear those fields. See [Branding](#branding) for the logo rules.
- **Deactivate a department.** `go run ./cmd/tenant deactivate -slug <slug>`. Sign-in is refused at once, and existing access tokens stop working within about a minute, which is the registry cache lifetime. Use `activate` to reverse it. There is no delete command. Deactivate instead, because the department's rows still reference it.
- **Connection budget.** Each department's pool opens connections when the department is first used, and holds up to `DB_MAX_CONNS_PER_TENANT` (default 4). Budget roughly `departments in use × DB_MAX_CONNS_PER_TENANT + 4` connections, and size PostgreSQL `max_connections` to match.
- **Connection poolers.** Use session pooling or direct connections. A transaction-pooling PgBouncer could hand a request a connection that is not bound to its department.
- **Backups.** One database holds every department, so back it up and restore it as one unit.

## Developer notes

- **Bind before you query.** Every query on a tenant table needs a department bound to its context. Request handlers get one from the middleware. Background work gets one from `tenant.With`, `tenant.Bind`, or `tenant.Detach` (which keeps the binding of the request that started the work and drops its cancellation). Per-department jobs use `forEachActiveTenant`.
- **Keep `ContextWithFallback` on.** `newEngine()` sets it. Handlers pass `*gin.Context` into the database layer, and without this flag the department bound to `c.Request` is invisible there. `TestPlainEngineLosesBoundTenant` shows the failure.
- **New tenant tables.** Add `tenant_id UUID NOT NULL DEFAULT app_current_tenant()` with a foreign key to `tenants`, an index, the `tenant_isolation` policy and tenant-scoped unique constraints. Follow `000004_multi_tenancy.up.sql`. Then re-run `runtime-role.sql`.
- **Composite keys.** Reference tenant tables with keys that include `tenant_id`, not with the bare `id`.
- **sqlc.** `ON CONFLICT` targets on tenant tables must lead with `tenant_id`. Generated models include a `TenantID` field.
- **Tests.** `DB_SOURCE=<a role that may create databases and roles> go test ./internal/tenant/` runs the database integration tests. They create and drop their own database and a non-login role. Without `DB_SOURCE` they are skipped. The matric rules have unit tests in `internal/tenant/matric_test.go` and `internal/api/matric_test.go`.

## Department picker in the web app

The sign-in and sign-up pages list the active departments from `GET /api/v1/tenants` and show a picker when there are two or more. The choice is remembered in the browser under `aces_department`. Modools sign-in passes the chosen department through the provider round trip.

## API changes

- Login, signup and password-reset requests accept a new optional `tenant` field (a department slug).
- Login responses include a `tenant` object: `{slug, name, institution, faculty}`.
- `GET /api/v1/tenants` is new and public. Each department may carry `matricCode` (for example `EG/EE`), `description` and `logoUrl`, which are absent until the department sets them.
- `GET /api/v1/tenants/:slug/logo` is new and public. It serves the department's logo image.
- The `user` object in every auth response, and `GET /api/v1/auth/me`, carry a `tenant` object with the user's department.
- Login and auth responses' `tenant` object may carry `matricCode`.
- Onboarding and email sign-up now check the matric number against the department (see [Matric numbers](#matric-numbers)). Their error messages changed: `wrong reg no` is replaced by the messages in that section, and a department without a code returns `422`.
- `POST /api/v1/auth/onboarding` refusals for a matric number that belongs to another department carry `department: {slug, name}`. The status is still `400`.
- Access and refresh tokens carry `tenant_id` and `tenant_slug`.
- Some JSON responses that serialize database rows gain a `tenant_id` field. The change is additive.
- `GET /api/v1/auth/modools/login` accepts `?tenant=`.
- `POST /api/v1/auth/signup/student` and the lecturer sign-up return `409` when the email or the matric number is already registered in the department. The `error` says which.
- `GET /api/v1/users/:id` returns `404` for an unknown ID. It used to return `500`.

## Mobile app

The mobile app is department-aware for sign-in, sign-up and onboarding. Sign-in and sign-up list the active departments from `GET /api/v1/tenants` and remember the choice on the device. The department's slug goes with the login and the student sign-up, so the session belongs to that department.

Sign-up sends the matric number, and the server checks it against the department. A matric number from another department is refused, and the message names the department it belongs to. Onboarding sends `matric_number`, which the server checks the same way.

The app does not show a department's name or logo outside the picker yet. Its own branding is unchanged.

## Known gaps

These are not fixed by this change.

1. **Some wording is still fixed.** The approval pages show the student's own department's name and its approval address (the contact address when none is set); the web page also shows its logo. The assistant, alumni and support copy, and the mobile sign-in, splash, settings and share text, use the department's name or Admin Pack. One ACES name remains on purpose: the payment and donation reference prefix `ACES-`, an identifier that Paystack and receipts carry. The approval contact for the legacy department is the address its receipts print, not the HOD address the page used to show.
2. **Uploaded files are public and shared.** `/uploads` is a static directory with no authentication and no department prefix. Anyone with a file's URL can read it, whichever department owns the file. Serve files through an authorized endpoint and store them per department before departments with sensitive files share this server.
3. **Modools sign-in uses one OAuth client** (the `MODOOLS_*` settings). The department the person picks decides where the account is created. If departments use different Modools sites, each needs its own client.
4. **Modools onboarding does not move the student.** A student whose matric number belongs to another department is sent to sign in there (see [Modools onboarding](#modools-onboarding)). The first account stays incomplete and is not removed. A seamless redirect needs deferred account creation or a move of the account between departments, both larger changes. Reading the department from the sign-in itself also needs the name of the claim that carries the registration number, which Modools must supply. Staff without a registration number would also need a rule.

5. **Uploads are public.** `/uploads` serves every department's stored files (avatars, course materials, signed course registration forms) to anyone with the link, without signing in, and the files are not separated by department. The fix is to serve them through tenant-checked routes with short-lived links. It is not done yet.

## Testing

- **Backend.** `DB_SOURCE=<a role that may create databases and roles> go test ./...` runs the unit tests and the database integration tests. The integration tests cover row-level security, composite foreign keys, token and reference lookups, the runtime-role check and deactivation.
- **Web app.** Vitest covers the department picker, the department hook, the Modools URL builder, the sign-in page, the approval page and the helper that reads a matric refusal's `department`.
- **Branding checks.** A run of the API showed: a logo served with its image type, the cache and sandbox headers, and the exact uploaded bytes; `404` for a department without a logo, an unknown department, a removed logo, and an inactive department; a sign-up response and `GET /auth/me` both carrying the department's `tenant`; `cmd/tenant` refusing SVG, GIF and oversize files.
- **Matric checks.** A run of the API against a freshly migrated database, with departments created by `cmd/tenant`, covered: mobile sign-up refused for another department's matric and accepted for the default department's; sign-up in a chosen department accepted for its own code and refused for another's, with the other department named; a department without a code refused with `422` at sign-up and onboarding; onboarding refused for another department's matric with `department` naming it, and then accepted in that department with the same matric number; a lowercase matric accepted; and an unset code refusing onboarding once the one-minute cache expired.
- **Scratch-environment checks.** A run against a freshly migrated database covered: the same email signing in to two departments with different passwords; a password from one department rejected by the other; unknown and forged departments rejected; refresh keeping the department; the same student signing up in two departments; and a deactivated department refusing sign-in and then existing tokens.
