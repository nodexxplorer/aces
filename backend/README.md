# ACES Backend

Go backend server for the ACES platform.

## Prerequisites

- Go 1.x
- PostgreSQL running locally (or a remote instance)

## Environment Variables

Copy `.env.example` to `.env` and adjust values:

| Variable         | Description                  | Default                                      |
|------------------|------------------------------|----------------------------------------------|
| `DB_SOURCE`      | PostgreSQL connection string | `postgresql://molu:incorrect@localhost:5432/chainvault?sslmode=disable` |
| `SERVER_ADDRESS` | Server listen address        | `0.0.0.0:8080`                               |

## Getting Started

```bash
# Copy environment file
cp .env.example .env

# Run the server
go run cmd/server/main.go
```

The server starts on `http://localhost:8080` by default.
