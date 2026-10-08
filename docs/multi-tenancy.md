# Multi-tenancy

One ACES deployment can serve several departments. Each department is a **tenant**. It has its own accounts, students, courses, results, announcements, payments and receipt numbers, and no department can read or change another department's data.

**Status:** the backend, the database and the web app are implemented. The mobile app is not department-aware yet, and it signs in to the default department (see [Mobile app](#mobile-app)).

## Decisions

| Question | Decision |
|---|---|
| What is a tenant? | One department. |
| Where is the data? | One shared PostgreSQL database. Each tenant-owned table has a `tenant_id` column. |
| How is isolation enforced? | PostgreSQL row-level security (RLS) on every tenant table, connections bound to one department, and foreign keys that cannot cross departments. |
| Do accounts span departments? | No. Accounts are per department. The same email or matric number can exist once in each department. |
| How is the department chosen? | At sign-in. It is carried in the access and refresh tokens. There are no subdomains and no per-request header. |

## Concepts

- **Registry.** The `tenants` table holds each department's `slug` (its identifier in requests, for example `unilag-ce`), `name`, `institution`, `faculty` and `is_active`. The API can read it but cannot change it.
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
| `GET /api/v1/tenants` (public) | The active departments: slug, name, institution, faculty and whether each is the default. It exposes no account data. |

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
3. **Create departments as the owner.** `DB_SOURCE=<owner DSN> go run ./cmd/tenant create -slug unilag-ce -name "Department of Computer Engineering" -institution "University of Lagos" -faculty "Faculty of Engineering"`
4. **Create each department's first admin as the runtime role.** `DB_SOURCE=<runtime DSN> ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password> go run ./cmd/seed_admin -tenant unilag-ce`
5. **Run the server as the runtime role.** Set `DB_SOURCE` to the runtime DSN and set `DEFAULT_TENANT_SLUG`.

Pass the owner's DSN on the command line for owner-level steps. Keep only the runtime DSN in `.env`.

### Existing single-department deployment

1. Back up the database.
2. Run migration `000004_multi_tenancy` as the owner. Existing rows are assigned to `uniuyo-ce`, and existing tokens keep working as that department.
3. Run `make runtime-role` as the owner.
4. Change the server's `DB_SOURCE` from its current superuser or owner connection to the runtime role. Until you do, the server refuses to start.
5. Deploy. The sign-in pages show a department picker once two departments are active.

### Rolling back

`000004_multi_tenancy.down.sql` folds the departments back into one dataset. It works only while a single department exists. Once two departments share an email or matric number, restoring the old unique constraints fails.

## Day-to-day operations

- **List departments.** `go run ./cmd/tenant list`.
- **Add a department.** Create it with `cmd/tenant create` (owner connection), then seed its first admin with `cmd/seed_admin -tenant <slug>` (runtime connection). It appears in `GET /api/v1/tenants` straight away.
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
- **Tests.** `DB_SOURCE=<a role that may create databases and roles> go test ./internal/tenant/` runs the database integration tests. They create and drop their own database and a non-login role. Without `DB_SOURCE` they are skipped.

## Department picker in the web app

The sign-in and sign-up pages list the active departments from `GET /api/v1/tenants` and show a picker when there are two or more. The choice is remembered in the browser under `aces_department`. Modools sign-in passes the chosen department through the provider round trip.

## API changes

- Login, signup and password-reset requests accept a new optional `tenant` field (a department slug).
- Login responses include a `tenant` object: `{slug, name, institution, faculty}`.
- `GET /api/v1/tenants` is new and public.
- Access and refresh tokens carry `tenant_id` and `tenant_slug`.
- Some JSON responses that serialize database rows gain a `tenant_id` field. The change is additive.
- `GET /api/v1/auth/modools/login` accepts `?tenant=`.

## Mobile app

The mobile app sends no department, so it signs in to `DEFAULT_TENANT_SLUG`. It keeps working as long as the default department is active. Making the mobile app department-aware is a follow-up.

## Known gaps

These are not fixed by this change.

1. **Branding is still Uyo and Computer Engineering.** Examples:
   - web app: the page title and description (`index.html`, `vite.config.ts`, `src/utils/constants.ts`), auth-page taglines (`AuthVideoShell.tsx`), the Modools signup link (`StudentSignupPage.tsx`), and the waiting and rejection pages (`WaitingDashboardPage.tsx`, `ApprovalRejectedPage.tsx`);
   - backend: the email footers (`service/notification_service_full.go`), the department stamp, receipts and printed result slips, which embed the University of Uyo logo (`utils/dept_stamp.go`, `utils/duesreceipt.go`, `utils/result_slip_printer.go`), and the AI assistant's system prompt (`service/ai_service.go`).

   These should read from the tenant record.
2. **Uploaded files are public and shared.** `/uploads` is a static directory with no authentication and no department prefix. Anyone with a file's URL can read it, whichever department owns the file. Serve files through an authorized endpoint and store them per department before departments with sensitive files share this server.
3. **Modools sign-in uses one OAuth client** (the `MODOOLS_*` settings). The department the person picks decides where the account is created. If departments use different Modools sites, each needs its own client.
4. **The mobile app** is not department-aware (see above).
5. **Existing issues, not caused by this change.** `GET /users/:id` returns 500 for an unknown ID. A foreign ID gets the same response, so this does not leak data. The web app's `forgotPassword` and `resetPassword` helpers in `src/api/auth.ts` call endpoints that do not exist, and nothing uses them.

## Testing

- **Backend.** `DB_SOURCE=<a role that may create databases and roles> go test ./...` runs the unit tests and the database integration tests. The integration tests cover row-level security, composite foreign keys, token and reference lookups, the runtime-role check and deactivation.
- **Web app.** Vitest covers the department picker, the department hook, the Modools URL builder and the sign-in page.
- **Scratch-environment checks.** A run against a freshly migrated database covered: the same email signing in to two departments with different passwords; a password from one department rejected by the other; unknown and forged departments rejected; refresh keeping the department; the same student signing up in two departments; and a deactivated department refusing sign-in and then existing tokens.
