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
| `POST /api/v1/auth/modools/exchange` | `tenant` in the body. The one-time code from a mobile sign-in works only in the department it was issued in. |
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
| `POST /api/v1/auth/signup/student` | Email sign-up, kept for existing clients. Neither app uses it now: both sign-up pages use Modools. Mobile sends no department, so it is checked against the default department. |

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
| `accent_color` | Computed from the logo by `cmd/tenant update -logo` and `cmd/tenant logos`. `-remove-logo` clears it. Not set by hand. | Web app: the primary colour of the sign-in page and the signed-in pages (see the accent rule under [Branding](#branding)) |
| `contact_email` | `cmd/tenant update -contact-email <address>` (`""` clears it) | Dues receipts |
| `approval_email` | `cmd/tenant update -approval-email <address>` (`""` clears it; without one the approval page uses `contact_email`) | Approval page: the "Contact the department" link |

- **Logo rules.** The file must be a PNG, JPEG or WebP image of at most 256 KiB. The server checks the file's contents, not its extension. SVG is refused because it can carry script, and GIF is refused as well. `-remove-logo` removes it. A department without a logo shows a neutral building icon in its place, never another organisation's mark.
- **Accent colour.** A department's accent is computed from its logo when the logo is set, and cleared with the logo. Only PNG and JPEG logos are read. A WebP logo is stored, but it gets no accent, and the command says so. The hue is the saturation-weighted circular mean of the logo's opaque, clearly coloured pixels (saturation at least 0.35, lightness from 0.20 to 0.80). If those hues point in different directions, or fewer than 50 pixels qualify, there is no accent. The accent keeps a saturation of 0.72. Its lightness is the lightest value, scanning down from 45% in 1% steps, at which white text has a contrast of at least 6.0:1. A logo larger than 4,000 pixels on a side, or 4 million pixels in all, is not read. The Computer Engineering logo (`EG-CO.png`) gives `#1b65a7`, with white text at 6.1:1. The web app uses the accent as its primary colour: the sign-in page takes the colour of the department being chosen, and every signed-in page takes the signed-in department's colour. A department with no accent keeps the platform blue, `#0066CC`. The mobile app does not use the accent yet. Migration 000009 adds the column but cannot read images, so run `cmd/tenant logos -dir branding/department-logos` once after migrating to fill in the accents of existing logos.
- **Serving.** `GET /api/v1/tenants/:slug/logo` returns the logo with its image type. It is public, because the sign-in page shows the logo before anyone has signed in. It is cached for five minutes. A missing, inactive or logo-less department gets `404`.
- **Where the user's department comes from.** The `user` object in every auth response, and `GET /api/v1/auth/me`, carry the user's `tenant` (slug, name, institution, faculty, matric code, description, `logoUrl` and, when the department has them, `contactEmail` (the dues receipts print it) and `approvalContactEmail` (the approval address, or the contact address when there is none)). The dashboard and the approval page read it from there. The public list in `GET /api/v1/tenants` leaves the contact address out.
- **Department output.** Emails, the password-reset email, dues receipts, result slips, attendance sheets, calendar feeds, the assistant's replies and the welcome, sign-in and approval messages name the department. Each email is sent from the department's name, and each recipient gets the brand of their own department. Emails and dues receipts show the logo; a department without one gets its name only. Emails link the logo from `API_PUBLIC_URL`, which defaults to `FRONTEND_PUBLIC_URL`.
- **Admin Pack.** The platform's name appears only where no department applies: the mobile app's refusals, the help center, and mail sent with no department bound. The CRF department stamp is the one stamp that names a department: its top line reads `DEPARTMENT OF <NAME>` with the department's own name (the stamp is refused when the department has no name), and its bottom line stays `FACULTY OF ENGINEERING UNIUYO`, because every department is in faculty EG. The `aces.zone` UID domain and the `ACES-` payment references are left as they are. The references and UIDs are identifiers, not display text.
- **Logo folder.** `branding/department-logos/` holds one file per department, named after its matric code: `EG-EE.png` is the logo for `EG/EE`. `EG-CO.png` is the ACES logo. The other files are placeholders, which the apply step skips until they are replaced. See the README in that folder. The folder is only the drop point: applying it stores each image in the database (`tenants.logo`), and the app serves it from there at `GET /api/v1/tenants/:slug/logo`. A department must exist before its logo can be applied, because the logo is matched to it by matric code. Create the departments with [`tenant ensure`](#adding-several-departments-at-once) first.

## Sign-in look

Each department picks how its sign-in and sign-up pages look, in Settings → Department → Sign-in and sign-up look (admins only; others see it read-only). Three templates, on the web and in the app:

- **classic** (default): the video background on the web, the platform mark on the brand gradient in the app. No image.
- **split**: the uploaded image fills the left half on the web (a band on top on phones), with the form beside it.
- **centered**: the uploaded image is the full-screen backdrop, with the form in a card.

Split and centered show the image an admin uploads (PNG, JPEG or WebP, 4 MB or less; the type is read from the bytes, so an SVG is refused). Without an image they draw classic. Switching the template keeps the image; removing the image keeps the template.

The look is stored per department in `department_login_looks` (migration 000013, row-level security), not on the registry, so the admin's upload needs no `cmd/tenant` access. The API: `GET /tenants/:slug/login-look` and `GET /tenants/:slug/login-image` are public; `GET /department/login-look` is for any signed-in user; `PUT /department/login-look`, `PUT /department/login-image` and `DELETE /department/login-image` are admin-only. After a migration that adds a table, re-run `deploy/postgres/runtime-role.sql` so the runtime role can use it.

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
3. **Create departments as the owner.** `DB_SOURCE=<owner DSN> go run ./cmd/tenant create -slug unilag-ce -name "Department of Computer Engineering" -matric-code EG/CO -institution "University of Lagos" -faculty "Faculty of Engineering"`. A department created without `-matric-code` cannot onboard or sign up students until you set one (see [Matric numbers](#matric-numbers)). To open a whole faculty at once, use [`tenant ensure`](#adding-several-departments-at-once) with `deploy/departments.json`.
4. **Create each department's first admin as the runtime role.** `DB_SOURCE=<runtime DSN> ADMIN_EMAIL=<email> go run ./cmd/seed_admin -tenant unilag-ce`. seed_admin generates the password and prints it once, so store it then. Each department gets a different password, and setting `ADMIN_PASSWORD` is an error.

   **Lost password.** Run the same command with `-reset-password` (and the same `ADMIN_EMAIL`). It only changes the account in that department, prints a new password once, signs it out of every session, and unlocks the account if it is locked. The refresh token stops working at once; an access token already issued lasts until it expires (`JWT_ACCESS_MINUTES`, 60 by default). It refuses an account that is not an admin (or, with `-role lecturer`, not a lecturer).
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

## Adding several departments at once

Departments are created with `cmd/tenant`, never from the app. The registry is a shared table with no row-level security, and the server's database role has `SELECT` on it and nothing else, so a department cannot be created through the API without handing the server the keys to every department. The command runs on its own, with the owner's connection string.

`deploy/departments.json` ships with the eight departments of the Faculty of Engineering, each with its matric code. Edit the file for your own departments, then:

```sh
cd backend
DB_SOURCE=<owner DSN> go run ./cmd/tenant ensure -file deploy/departments.json -dry-run
DB_SOURCE=<owner DSN> go run ./cmd/tenant ensure -file deploy/departments.json
```

Each line of the file is one department:

```json
[
  {
    "slug": "dept-me",
    "name": "Department of Mechanical Engineering",
    "matric_code": "EG/ME",
    "url_code": "me",
    "institution": "University of Uyo",
    "faculty": "Faculty of Engineering"
  }
]
```

| Field | Required | Notes |
|---|---|---|
| `slug` | yes | Lowercase letters, digits and single hyphens. It is the department's identifier, and it cannot be changed afterwards. |
| `name` | yes | Shown everywhere the department is named. |
| `matric_code` | no | The faculty and department pair, `EG/ME`. Without it students cannot sign up or finish onboarding. Two departments cannot share one. |
| `url_code` | no | The department's web address: `me` gives `/me` and `/me/admin`. Defaults to the matric code's suffix. |
| `institution` | no | Shown on the sign-in page, receipts and PDFs. |
| `faculty` | no | Shown with the institution. |

What it does:

- A department whose slug is already there is **left exactly as it is**, and the run says `keep`. Running it twice changes nothing the second time, so it is safe against a database that already holds some of the departments.
- A department that is missing is created, with the next step printed after it: `seed_admin -tenant <slug>`.
- A matric code that another department already uses is refused, naming that department. A matric number maps to one department, so the code cannot be shared.
- The whole file is checked before anything is written, so a typo stops the run instead of leaving half the departments behind. `-dry-run` shows what would happen without writing.

Afterwards, for each new department:

1. Seed its first admin: `DB_SOURCE=<runtime DSN> ADMIN_EMAIL=<email> go run ./cmd/seed_admin -tenant <slug>`. It prints the generated password once.
2. Drop its logo into `branding/department-logos/` as `EG-ME.png` and apply the folder: `DB_SOURCE=<owner DSN> go run ./cmd/tenant logos -dir ../branding/department-logos` (see [Branding](#branding)).

A department with no admin and no logo still works: it appears on the sign-in page and in `GET /api/v1/tenants` straight away, with the neutral badge instead of a logo.

## Staff lockout

Students sign in with Modools, so the lockout covers the accounts that sign in with a password: lecturers, admins and bursars. After 5 wrong passwords the account is locked for 30 minutes. A correct password before the lock refuses nothing and clears the count. A locked account is refused even with the right password, and the message says when to try again. The lost-password reset (above) unlocks the account at once. The login rate limit (60 requests a minute per IP) still applies on top.

The lock is per department, because accounts are per department. Migration `000012` makes one lockout row per user, so the count cannot split across duplicate rows.

## Day-to-day operations

- **List departments.** `go run ./cmd/tenant list`. It shows each department's matric code.
- **Add a department.** Create it with `cmd/tenant create -matric-code EG/XX` (owner connection), then seed its first admin with `cmd/seed_admin -tenant <slug>` (runtime connection). Seed a lecturer the same way with `-role lecturer`, setting `LECTURER_EMAIL` and `LECTURER_STAFF_ID`. Its password is generated and printed once, as for admins. Both accounts are approved and belong to that department only. It appears in `GET /api/v1/tenants` straight away. See [Adding several departments at once](#adding-several-departments-at-once) for the bulk form.
- **Reset a lost admin password.** `cmd/seed_admin -tenant <slug> -reset-password` (runtime connection), as in step 4. See the lost-password note there.
- **Sign-in addresses.** Each admin sees the department's addresses on the Settings page, under the Department tab: `/<code>` for students and `/<code>/admin` for staff, built on the address the admin is using. The code is set with `cmd/tenant update -url-code`.
- **Set or change a matric code.** `go run ./cmd/tenant update -slug <slug> -matric-code EG/EE` (owner connection). The code is the faculty and department pair, such as `EG/EE`, not `EE`. `-matric-code ""` clears it, and the department then refuses matric-based sign-up and onboarding. The change takes effect within about a minute.
- **Change a department's name, details or branding.** `go run ./cmd/tenant update -slug <slug> [-name ...] [-institution ...] [-faculty ...] [-description ...] [-contact-email ...] [-approval-email ...] [-url-code ...] [-logo file.png] [-remove-logo]`. Only the flags you pass are changed. `-institution ""`, `-faculty ""` and `-description ""` clear those fields. See [Branding](#branding) for the logo rules.
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

## Web addresses

Each department has a short code, its **web address code**, which names it in the web app. `/co` is the student sign-in page for Computer Engineering, and `/co/admin` is its admin sign-in page. Both open with that department already chosen. `/login` and the staff portal still work without a code, and they remember the last choice.

- **Set it with** `go run ./cmd/tenant update -slug <slug> -url-code co` (`-url-code ""` clears it), or `create -url-code`. Without the flag, `create` takes the matric code's suffix, so `EG/CO` gives `co`. A department that has no code yet takes one from the suffix when you set its matric code.
- **Rules.** The code is 2 to 12 lowercase letters or digits, and each department has its own. The web app uses some words for its own pages, such as `admin`, `dashboard` and `login`, and those cannot be codes: the app's own page would answer first. `TestReservedURLCodesCoverTheWebRouter` checks the list against `frontend/src/router.tsx`, so a new page whose name could be a code fails the backend tests until it is reserved in `internal/tenant/urlcode.go`.
- **Unknown addresses** show the not-found page. A department without a code has no addresses.
- **Picking another department** on an address page moves the address to that department's address.
- **Changing a code** breaks the old addresses. Tell the department's admins before you change one.
- The code is on `GET /api/v1/tenants` and in the `tenant` object as `urlCode`. No page in the web app shows a department's addresses yet. The mobile app opens sign-in from the same short names (see [Mobile app](#mobile-app)).

Migration 000010 gives each existing department the suffix of its matric code, when that suffix is unique. A department whose suffix is shared stays without a code until you set one.

## API changes

- Login, signup and password-reset requests accept a new optional `tenant` field (a department slug).
- Login responses include a `tenant` object: `{slug, name, institution, faculty}`.
- `GET /api/v1/tenants` is new and public. Each department may carry `matricCode` (for example `EG/EE`), `description` and `logoUrl`, which are absent until the department sets them.
- `GET /api/v1/tenants/:slug/logo` is new and public. It serves the department's logo image.
- `GET /api/v1/tenants` entries and the `tenant` object carry `accentColor` (`#rrggbb`) when the department's logo gives one. It is absent otherwise, and clients then use the platform colour.
- `GET /api/v1/tenants` entries and the `tenant` object carry `urlCode`, the department's web address code (see [Web addresses](#web-addresses)), when it has one.
- The `user` object in every auth response, and `GET /api/v1/auth/me`, carry a `tenant` object with the user's department.
- Login and auth responses' `tenant` object may carry `matricCode`.
- Onboarding and email sign-up now check the matric number against the department (see [Matric numbers](#matric-numbers)). Their error messages changed: `wrong reg no` is replaced by the messages in that section, and a department without a code returns `422`.
- `POST /api/v1/auth/onboarding` refusals for a matric number that belongs to another department carry `department: {slug, name}`. The status is still `400`.
- Access and refresh tokens carry `tenant_id` and `tenant_slug`.
- Some JSON responses that serialize database rows gain a `tenant_id` field. The change is additive.
- `GET /api/v1/auth/modools/login` accepts `?tenant=`. The mobile app also sends `client=mobile` and `code_challenge`. A mobile sign-in without a valid challenge is refused.
- `POST /api/v1/auth/modools/exchange` is new. The mobile app trades the one-time code from a sign-in for its session here. The session no longer comes in the return address, so mobile builds from before this change cannot finish a sign-in.
- `POST /api/v1/auth/signup/student` and the lecturer sign-up return `409` when the email or the matric number is already registered in the department. The `error` says which.
- `GET /api/v1/users/:id` returns `404` for an unknown ID. It used to return `500`.

## Mobile app

The mobile app is department-aware for sign-in, sign-up and onboarding. Sign-in and sign-up list the active departments from `GET /api/v1/tenants` and remember the choice on the device. Students sign in and sign up through Modools in the browser, as the website does. The app starts the sign-in with the chosen department (`client=mobile` and `tenant`), so the account belongs to that department.

Sign-up no longer asks for a matric number: Modools creates the account, and the student enters the matric number at onboarding. The server checks it against the department. A matric number from another department is refused, and the message names the department it belongs to. Onboarding sends `matric_number`, which the server checks the same way.

**Sign-in return.** The app starts the sign-in with a PKCE challenge (`code_challenge`, S256). It keeps the verifier, and the browser returns to `aceszone://modools-complete`. On success the return carries a one-time code in the query, `aceszone://modools-complete?code=…`, and no session. The app posts the code, its verifier and the department to `POST /api/v1/auth/modools/exchange`, and gets `{user, tokens}` back. A code works once and expires 60 seconds after it is issued. It works only with the verifier whose challenge started the sign-in. The exchange refuses a code with `invalid_code`, an account that is deactivated with `account_deactivated`, and an account with a staff role with `staff_account`, as password sign-in refuses those roles on mobile. On failure the return carries an `error` code in the query: `staff_email`, `account_deactivated`, `unknown_department` or `auth_failed`. The website comes back to its own `/login` the same way as before: the session is in the fragment, and the page reads it once and clears it.

The sign-in screen shows the chosen department's name under the app's name. The department's logo is not shown in the app yet, and the app's own icon is unchanged.

**Accent.** The app uses the department's accent as its primary colour, as the web app does. Sign-in and sign-up use the colour of the department chosen on them. After sign-in the app uses the signed-in department's colour, which is kept with the stored session, so the colour is right when the app opens again. A department with no accent keeps the platform blue. The ramp is built the same way on both platforms, and `frontend/src/theme/accent.ts` and `mobile/src/theme/accent.ts` must change together. The app's icon and its notification colour are set in the build and do not change.

**Department links.** `aceszone://co` and `aceszone://co/admin` open sign-in with the department whose short name is `co` chosen, as `/co` does on the web. Both lead to the same screen, because the app signs in every role. A signed-in user who opens one goes to the app's home screen. A short name that no department uses is ignored, and sign-in starts at the usual department. Sign-up from that screen starts with the same department.

## Known gaps

These are not fixed by this change.

1. **Some wording is still fixed.** The approval pages show the student's own department's name and its approval address (the contact address when none is set); the web page also shows its logo. The assistant, alumni and support copy, and the mobile sign-in, splash, settings and share text, use the department's name or Admin Pack. One ACES name remains on purpose: the payment and donation reference prefix `ACES-`, an identifier that Paystack and receipts carry. The approval contact for the legacy department is the address its receipts print, not the HOD address the page used to show.
2. **Uploaded files are shared and bearer-linked.** Stored files are served only with a link that the API signed and that has not expired (see the decision on signed links), but the link is a bearer token: whoever holds an unexpired link can read the file, whichever department owns it. Files are not stored per department. Give each department its own storage, or serve files through tenant-checked routes, before departments with sensitive files share this server.
3. **Modools sign-in uses one OAuth client** (the `MODOOLS_*` settings). The department the person picks decides where the account is created. If departments use different Modools sites, each needs its own client.
4. **Modools onboarding does not move the student.** A student whose matric number belongs to another department is sent to sign in there (see [Modools onboarding](#modools-onboarding)). The first account stays incomplete and is not removed. A seamless redirect needs deferred account creation or a move of the account between departments, both larger changes. Reading the department from the sign-in itself also needs the name of the claim that carries the registration number, which Modools must supply. Staff without a registration number would also need a rule.
5. **Web links do not open the mobile app.** `aceszone://co` opens it, but a link on the web domain, such as `https://<web domain>/co`, opens the website. Opening the app from those links needs the web domain to serve Apple's `apple-app-site-association` and Google's `assetlinks.json`, and the app's bundle ID, package name and signing fingerprint for them. None of those are in this repository, so this is a follow-up.
6. **Another app can block a mobile sign-in.** On Android another app could register the `aceszone` scheme and receive the return in place of the app. It cannot turn the one-time code into a session: the code works once, expires after 60 seconds and needs the app's verifier. The sign-in then fails on that device. Verified app links (Android App Links and iOS universal links) would stop this as well. They need the web domain's association files and the app's signing details, which are not in this repository, so this is a follow-up, like gap 5.


## Testing

- **Backend.** `DB_SOURCE=<a role that may create databases and roles> go test ./...` runs the unit tests and the database integration tests. The integration tests cover row-level security, composite foreign keys, token and reference lookups, the runtime-role check and deactivation.
- **Web app.** Vitest covers the department picker, the department hook, the Modools URL builder, the sign-in page, the approval page and the helper that reads a matric refusal's `department`.
- **Branding checks.** A run of the API showed: a logo served with its image type, the cache and sandbox headers, and the exact uploaded bytes; `404` for a department without a logo, an unknown department, a removed logo, and an inactive department; a sign-up response and `GET /auth/me` both carrying the department's `tenant`; `cmd/tenant` refusing SVG, GIF and oversize files.
- **Matric checks.** A run of the API against a freshly migrated database, with departments created by `cmd/tenant`, covered: mobile sign-up refused for another department's matric and accepted for the default department's; sign-up in a chosen department accepted for its own code and refused for another's, with the other department named; a department without a code refused with `422` at sign-up and onboarding; onboarding refused for another department's matric with `department` naming it, and then accepted in that department with the same matric number; a lowercase matric accepted; and an unset code refusing onboarding once the one-minute cache expired.
- **Upload checks.** Unit tests cover signing, expiry, tampering, a different key, non-canonical paths and the response middleware. A run of the API against a migrated database covered: an avatar in login and `/auth/me` carrying a link 24 hours ahead; the signed link returning the file's exact bytes with `nosniff`; a HEAD request; unsigned, forged, tampered and traversal requests answered `404` with the same body as a missing file; and a link refused after its lifetime (one minute in the run) while a fresh link from `/auth/me` was served.
- **Mobile checks.** `tsc --noEmit` in `mobile/` (the app has no test runner). The mobile ramp matched the web's for 3,009 accents, 33,099 steps in all. The theme for a department with an accent, one without, and an unknown accent was checked, and so were the department lookup by short name and the order of the choice. A web build of the app, run in a browser against the API, showed: `/co` and `/co/admin` opening sign-in with Computer Engineering chosen and its accent; `/ee` with Electrical Engineering and the platform blue; an unknown code falling back to the default; `/login` unchanged; sign-up from `/co` starting with the same department; a second code while sign-in was open switching the choice; a code opened while signed in going to the app; and a student signing in, onboarding showing the accent, and the accent surviving a reload.
- **Scratch-environment checks.** A run against a freshly migrated database covered: the same email signing in to two departments with different passwords; a password from one department rejected by the other; unknown and forged departments rejected; refresh keeping the department; the same student signing up in two departments; and a deactivated department refusing sign-in and then existing tokens.
- **Modools exchange checks.** Unit tests check the PKCE challenge against RFC 7636's example, the shape checks, and the refusal of a mobile sign-in without a challenge at the start and at the callback. A database test (`internal/tenant`, `TestModoolsExchangeCodes`) checks single use, the department boundary, expiry and cleanup under the runtime role. A run of the API against a migrated database passed 29 checks. The return carried only a code, the database held its hash, the exchange with the verifier gave the session, and the session worked. A replayed code or callback, a wrong verifier, malformed and expired codes, and another department's attempt were all refused. A linked staff account got `staff_account`, a staff email was refused at the callback, and the website still got its session in the fragment. The mobile PKCE module and the return parser were checked under Node (13 checks), and the mobile web bundle built.

## Decisions recorded

- **Modools sign-ups stay approved on creation.** A Modools sign-up creates an approved student account in the department picked at sign-in, or the default one. Modools sends no role or staff data, so the app cannot tell a staff member from a student. The staff check (`staff_email`) applies only to accounts that already exist. Revisit this only if Modools starts sending role data.
- **Approval address for Computer Engineering.** Approval requests go to `hod@computer.engineering.uniuyo.edu.ng`, as set by migration 000008. Change it with `cmd/tenant update -approval-email`. Receipts keep the contact address.
- **Public uploads are closed with signed links, in three steps. All three are done.**
  1. **Done.** Every response that carries a file or avatar URL signs it. A link is `/uploads/<path>?exp=<unix seconds>&sig=<HMAC>`. The key is derived from `JWT_SECRET`, and the lifetime is `UPLOAD_LINK_MINUTES`, which defaults to 24 hours (the earlier proposal was six). A middleware signs every `/uploads/` string in a JSON response, so avatars and other user-row values are covered wherever they are serialized. Stored paths in course materials, documents, CRF forms, reports and the download redirects are signed where they are built. The group-chat push signs the sender's avatar. The `/uploads` route still accepts unsigned requests, so nothing breaks in this step.
  2. **Done.** `/uploads` checks the signature and the expiry, and answers 404 otherwise, so a probe cannot tell an unsigned link from a missing file. Unsigned links saved before step 1 stopped working at this step. A signed link stops after its lifetime, so a page left open longer than that shows missing images until it reloads.
  3. **Done.** The public static mount is replaced by the checked route. Nothing else serves `/uploads`.

  Step 1 added `/uploads` links to about 25 response paths. Links are signed in one place: a middleware re-signs every `/uploads/` value in a JSON response, so avatars are covered wherever they are serialised.
