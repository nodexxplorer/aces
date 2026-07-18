.PHONY: build dev test migrate-up migrate-down migrate-create sqlc-generate docker-up docker-down docker-build lint clean install

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

seed-admin:
	go run cmd/seed_admin/main.go
