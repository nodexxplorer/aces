# ─── Database identifiers ────────────────────────────────────────────────────
CONTAINER_NAME := Moludb
DB_USER        := molu
DB_PASSWORD    ?= incorrect

# Wallet / Custody DB
WALLET_DB_NAME  := chainvault
WALLET_DB_URL   := "postgresql://$(DB_USER):$(DB_PASSWORD)@localhost:5432/$(WALLET_DB_NAME)?sslmode=disable"
WALLET_MIG_DIR  := pkg/db/migration/wallet

# Trading DB
TRADING_DB_NAME := chainvault_trading
TRADING_DB_URL  := "postgresql://$(DB_USER):$(DB_PASSWORD)@localhost:5432/$(TRADING_DB_NAME)?sslmode=disable"
TRADING_MIG_DIR := pkg/db/migration/trading

# Backup helpers
NOW                   := $(shell date +%Y%m%d_%H%M%S)
BACKUP_NAME           := backup_$(NOW).dump
CONTAINER_BACKUP_PATH := /tmp/$(BACKUP_NAME)
HOST_BACKUP_DIR       := ./db_backups
RESTORE_FILE          ?= latest.dump

# ─── Wallet DB targets ───────────────────────────────────────────────────────
createdb:
	docker exec -it $(CONTAINER_NAME) \
		createdb --username=$(DB_USER) --owner=$(DB_USER) $(WALLET_DB_NAME)

dropdb:
	docker exec -it $(CONTAINER_NAME) \
		dropdb -U $(DB_USER) $(WALLET_DB_NAME)

migrateup:
	migrate -path $(WALLET_MIG_DIR) \
		-database $(WALLET_DB_URL) \
		-verbose up

migratedown:
	migrate -path $(WALLET_MIG_DIR) \
		-database $(WALLET_DB_URL) \
		-verbose down

add_migration:
	migrate create -ext sql -dir $(WALLET_MIG_DIR) -seq $(name)

# ─── Trading DB targets ──────────────────────────────────────────────────────
createdb_trading:
	docker exec -it $(CONTAINER_NAME) \
		createdb --username=$(DB_USER) --owner=$(DB_USER) $(TRADING_DB_NAME)

dropdb_trading:
	docker exec -it $(CONTAINER_NAME) \
		dropdb -U $(DB_USER) $(TRADING_DB_NAME)

migrateup_trading:
	migrate -path $(TRADING_MIG_DIR) \
		-database $(TRADING_DB_URL) \
		-verbose up

migratedown_trading:
	migrate -path $(TRADING_MIG_DIR) \
		-database $(TRADING_DB_URL) \
		-verbose down

add_migration_trading:
	migrate create -ext sql -dir $(TRADING_MIG_DIR) -seq $(name)

# ─── Migrate both DBs at once ────────────────────────────────────────────────
migrateup_all: migrateup migrateup_trading

migratedown_all: migratedown migratedown_trading

# ─── SQLC code generation ────────────────────────────────────────────────────
sqlc:
	sqlc generate

# ─── Build targets ───────────────────────────────────────────────────────────
build_plugin:
	mkdir -p vault/plugins
	cd vault-plugin && go build -o ../vault/plugins/vault-plugin .

build_wallet:
	go build -o bin/wallet cmd/wallet/main.go

build_monitor:
	go build -o bin/monitor cmd/monitor/main.go

build_sweeper:
	go build -o bin/sweeper cmd/sweeper/main.go

build_signtx:
	go build -o bin/signtx cmd/signtx/main.go

build_admin:
	go build -o bin/admin cmd/admin/main.go

build_all: build_plugin build_wallet build_monitor build_sweeper build_signtx build_admin

# ─── Tests ───────────────────────────────────────────────────────────────────
test:
	go test -v ./...

# ─── Vault ───────────────────────────────────────────────────────────────────
vault_up:
	./scripts/vault_prod.sh

vault_down:
	killall vault 2>/dev/null || true

# ─── Docker build targets ────────────────────────────────────────────────────
docker_build_wallet:
	docker build -f Dockerfile.wallet -t chainvault-app .

docker_build_monitor:
	docker build -f Dockerfile.monitor -t chainvault-monitor .

docker_build_sweeper:
	docker build -f Dockerfile.sweeper -t chainvault-sweeper .

docker_build_admin:
	cd admin && docker build -t chainvault-admin .

docker_build_frontend:
	cd frontend && docker build -t chainvault-user .

docker_build_team:
	cd team && docker build -t chainvault-team .

docker_build_all: docker_build_wallet docker_build_monitor docker_build_sweeper docker_build_admin docker_build_frontend docker_build_team

# ─── Run targets ─────────────────────────────────────────────────────────────
serve:
	go run cmd/wallet/main.go serve

monitor:
	go run cmd/monitor/main.go

monitor_all:
	go run cmd/monitor/main.go --chains sepolia,bsctestnet,tronnile,solanadevnet,bitcoin,litecoin,dogecoin,dash,bitcoincash,ripple

settle:
	go run cmd/settle/main.go

deploy_evm:
	cd contract/evm && go run script/deploy_vault.go

deploy_tron:
	cd contract/tron && go run script/deploy_vault.go

# ─── Infrastructure ──────────────────────────────────────────────────────────
Init:
	docker start Moludb chainvault-redis
	docker compose -f /home/molu/kafka-docker/docker-compose.yml up -d

start:
	docker start $(CONTAINER_NAME)

host_frontend:
	cd frontend && yarn dev -H 0.0.0.0 -p 3000

# ─── Phony targets ───────────────────────────────────────────────────────────
.PHONY: \
	sqlc \
	createdb dropdb migrateup migratedown add_migration \
	createdb_trading dropdb_trading migrateup_trading migratedown_trading add_migration_trading \
	migrateup_all migratedown_all \
	build_plugin build_wallet build_monitor build_sweeper build_signtx build_admin build_all \
	test \
	vault_up vault_down \
	docker_build_wallet docker_build_monitor docker_build_sweeper \
	docker_build_admin docker_build_frontend docker_build_team docker_build_all \
	serve monitor monitor_all settle deploy_evm deploy_tron \
	Init start host_frontend