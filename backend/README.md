# ACES Backend

Go backend server for the ACES platform. One deployment serves several departments (tenants). Each department has its own accounts and data. See [docs/multi-tenancy.md](../docs/multi-tenancy.md) for the design and the operating rules.

## Prerequisites

- Go (version in `go.mod`)
- PostgreSQL 16, locally or remote (or use Docker Compose)
- The `migrate` CLI for migrations (`make install` installs it)

## Environment variables

Copy `.env.example` to `.env` and adjust the values. The variables that matter most:

| Variable | Description | Default |
|---|---|---|
| `DB_SOURCE` | Connection string for the server and `seed_admin`. Must be the restricted runtime role: never a superuser or a table owner, because the server refuses to start as either. | none (required) |
| `JWT_SECRET` | Token signing secret, at least 32 characters. It also keys the links to stored files, so changing it invalidates every outstanding link. | none (required) |
| `UPLOAD_LINK_MINUTES` | How long a link to a stored file (avatar, document, course material) stays valid | `1440` (24 hours) |
| `SERVER_ADDRESS` | Listen address | `0.0.0.0:8080` |
| `DEFAULT_TENANT_SLUG` | Department used when a request names none. Mobile clients rely on it. | `uniuyo-ce` |
| `API_PUBLIC_URL` | Where the API is reachable from outside, for logo links in emails. | `FRONTEND_PUBLIC_URL` |
| `DB_MAX_CONNS_PER_TENANT` | Connections each department's pool may hold | `4` |
| `DB_ALLOW_RLS_BYPASS` | Development only. Lets the server run as a role that bypasses row-level security, which turns department isolation off. | `false` |

The full list, with comments, is in `.env.example`.

## Database setup

Owner-level steps take the migration owner's connection string in `DB_SOURCE`, for that command only. Keep only the runtime role's connection string in `.env`.

```bash
# 1. Apply migrations as the owner
DB_SOURCE='postgresql://aces_user:…@localhost:5432/aces_zone?sslmode=disable' make migrate-up

# 2. Create or update the restricted runtime role and its grants (after every migration)
DB_SOURCE='postgresql://aces_user:…@localhost:5432/aces_zone?sslmode=disable' \
  APP_DB_USER=aces_app APP_DB_PASSWORD='…' make runtime-role

# 3. Create a department, as the owner. -matric-code is the department part of its
#    matric numbers (EG/CO for 20/EG/CO/1234). Without it the department cannot
#    sign up or onboard students until you run `tenant update`.
DB_SOURCE='postgresql://aces_user:…@localhost:5432/aces_zone?sslmode=disable' \
  go run ./cmd/tenant create -slug unilag-ce -name "Department of Computer Engineering" \
  -matric-code EG/CO -institution "University of Lagos" -faculty "Faculty of Engineering"

# 4. Create that department's first admin, as the runtime role. seed_admin
#    prints a generated password for it once; each department gets its own.
DB_SOURCE='postgresql://aces_app:…@localhost:5432/aces_zone?sslmode=disable' \
  ADMIN_EMAIL=admin@example.edu make seed-admin ARGS="-tenant unilag-ce"
```

If an admin loses the password, give that account a new one. The command below works the same way: it prints the new password once and signs it out of every session. Access tokens already issued last until they expire (`JWT_ACCESS_MINUTES`, 60 by default).

```bash
DB_SOURCE='postgresql://aces_app:…@localhost:5432/aces_zone?sslmode=disable' \
  ADMIN_EMAIL=admin@example.edu make seed-admin ARGS="-tenant unilag-ce -reset-password"
# A lecturer's password: add -role lecturer and set LECTURER_EMAIL instead.
```

To open a whole faculty at once, list the departments in `deploy/departments.json` (the file ships with the eight departments of the Faculty of Engineering) and run `ensure`. It creates the departments that are missing and leaves the ones that are already there alone, so it is safe to run again:

```bash
# See what it would do first
DB_SOURCE='postgresql://aces_user:…@localhost:5432/aces_zone?sslmode=disable' \
  go run ./cmd/tenant ensure -file deploy/departments.json -dry-run

# Then create them
DB_SOURCE='postgresql://aces_user:…@localhost:5432/aces_zone?sslmode=disable' \
  go run ./cmd/tenant ensure -file deploy/departments.json
```

Each new department then needs an admin (step 4 above, once per department) and, when you have it, a logo (`cmd/tenant logos -dir ../branding/department-logos`). The full field list is in `docs/multi-tenancy.md`, under [Adding several departments at once](../../docs/multi-tenancy.md#adding-several-departments-at-once).

`cmd/tenant` also supports `list`, `logos`, `activate` and `deactivate`. `update` changes only the flags you pass:

```bash
# Set or change a department's matric code (EG/EE for 20/EG/EE/1234). "" clears it.
DB_SOURCE='postgresql://aces_user:…@localhost:5432/aces_zone?sslmode=disable' \
  go run ./cmd/tenant update -slug unilag-ce -matric-code EG/CO

# Set the branding shown on the sign-in page and dashboard: a description and a logo
# (PNG, JPEG or WebP, at most 256 KiB). -remove-logo removes the logo.
DB_SOURCE='postgresql://aces_user:…@localhost:5432/aces_zone?sslmode=disable' \
  go run ./cmd/tenant update -slug unilag-ce -description "Computer engineering students" -logo ./logo.png

# Set every department's logo from the folder. Each file is named after its matric code:
# EG-EE.png is the logo for EG/EE. -dry-run lists what would change. Placeholder files are skipped.
DB_SOURCE='postgresql://aces_user:…@localhost:5432/aces_zone?sslmode=disable' \
  go run ./cmd/tenant logos -dir ../branding/department-logos -dry-run

# The email printed on a department's dues receipts. "" clears it.
DB_SOURCE='postgresql://aces_user:…@localhost:5432/aces_zone?sslmode=disable' \
  go run ./cmd/tenant update -slug unilag-ce -contact-email receipts@example.edu
  go run ./cmd/tenant update -slug unilag-ce -approval-email hod@example.edu
```

The migrations create the default department `uniuyo-ce`, which holds all data from before multi-tenancy. Migration `000005` gives it the matric code `EG/CO`. See [docs/multi-tenancy.md](../docs/multi-tenancy.md#matric-numbers) for how matric numbers are checked.

## Running

```bash
cp .env.example .env   # then edit it
go run cmd/server/main.go
```

The server starts on `http://localhost:8080` by default.

## Docker Compose

`docker-compose up -d` starts PostgreSQL, applies the migrations as the owner, creates the runtime role (`aces_app`, password from `APP_DB_PASSWORD`), and starts the API as that role. The default password is for local development only.

## Tests

```bash
DB_SOURCE='postgresql://<role that may create databases and roles>@localhost:5432/<any db>?sslmode=disable' go test -race ./...
```

Without `DB_SOURCE`, the database integration tests are skipped and the rest run.
