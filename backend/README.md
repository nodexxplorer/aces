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
| `JWT_SECRET` | Token signing secret, at least 32 characters | none (required) |
| `SERVER_ADDRESS` | Listen address | `0.0.0.0:8080` |
| `DEFAULT_TENANT_SLUG` | Department used when a request names none. Mobile clients rely on it. | `uniuyo-ce` |
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

# 3. Create a department, as the owner
DB_SOURCE='postgresql://aces_user:…@localhost:5432/aces_zone?sslmode=disable' \
  go run ./cmd/tenant create -slug unilag-ce -name "Department of Computer Engineering" \
  -institution "University of Lagos" -faculty "Faculty of Engineering"

# 4. Create that department's first admin, as the runtime role
DB_SOURCE='postgresql://aces_app:…@localhost:5432/aces_zone?sslmode=disable' \
  ADMIN_EMAIL=admin@example.edu ADMIN_PASSWORD='…' make seed-admin ARGS="-tenant unilag-ce"
```

`cmd/tenant` also supports `list`, `activate` and `deactivate`.

The migrations create the default department `uniuyo-ce`, which holds all data from before multi-tenancy.

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
