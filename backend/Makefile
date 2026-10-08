.PHONY: build dev test migrate-up migrate-down migrate-create sqlc-generate runtime-role docker-up docker-down docker-build lint clean install

# Owner-level targets (migrate, runtime-role) take the migration owner's
# connection string in DB_SOURCE for that command only. The server and
# seed-admin use the restricted runtime role, so keep that DSN in .env.
APP_DB_USER ?= aces_app

build:
	go build -o bin/api ./cmd/server

dev:
	go run cmd/server/main.go

test:
	go test -v -race -count=1 -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

migrate-up:
	@if [ -z "$(DB_SOURCE)" ]; then echo "Error: DB_SOURCE must be set. See .env.example"; exit 1; fi
	migrate -path internal/db/migrations -database "$(DB_SOURCE)" up

migrate-down:
	@if [ -z "$(DB_SOURCE)" ]; then echo "Error: DB_SOURCE must be set. See .env.example"; exit 1; fi
	migrate -path internal/db/migrations -database "$(DB_SOURCE)" down 1

migrate-create:
	migrate create -ext sql -dir internal/db/migrations -seq $(name)

# Creates or updates the restricted runtime role and its grants. Run it after
# migrate-up, as the owner. APP_DB_PASSWORD sets the role's password (the command
# is not echoed, so the password stays out of the terminal log).
runtime-role:
	@if [ -z "$(DB_SOURCE)" ]; then echo "Error: DB_SOURCE must be the migration owner's connection string"; exit 1; fi
	@if [ -z "$(APP_DB_PASSWORD)" ]; then echo "Error: APP_DB_PASSWORD must be set"; exit 1; fi
	@psql "$(DB_SOURCE)" -v ON_ERROR_STOP=1 -v app_role="$(APP_DB_USER)" -v app_password="$(APP_DB_PASSWORD)" -f deploy/postgres/runtime-role.sql

sqlc-generate:
	sqlc generate

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-build:
	docker-compose build

lint:
	golangci-lint run ./...

clean:
	rm -rf bin/
	rm -f coverage.out coverage.html

install:
	go mod download
	go install github.com/cosmtrek/air@latest
	go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
	go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Creates the first admin of a department: make seed-admin ARGS="-tenant unilag-ce"
seed-admin:
	go run ./cmd/seed_admin $(ARGS)
