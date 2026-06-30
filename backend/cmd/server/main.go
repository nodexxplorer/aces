package main

import (
	"context"
	"log"
	"os"

	"github.com/aces/backend/internal/api"
	"github.com/aces/backend/internal/db/sql"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	// Setup context
	ctx := context.Background()

	// 1. Get configuration
	dbSource := os.Getenv("DB_SOURCE")
	if dbSource == "" {
		// Fallback to the DB settings from Makefile
		dbSource = "postgresql://molu:incorrect@localhost:5432/chainvault?sslmode=disable"
	}

	serverAddress := os.Getenv("SERVER_ADDRESS")
	if serverAddress == "" {
		serverAddress = "0.0.0.0:8080"
	}

	// 2. Connect to the database
	log.Printf("Connecting to database...")
	connPool, err := pgxpool.New(ctx, dbSource)
	if err != nil {
		log.Fatalf("cannot connect to db: %v", err)
	}
	defer connPool.Close()

	// Verify connection
	if err := connPool.Ping(ctx); err != nil {
		log.Fatalf("database ping failed: %v", err)
	}
	log.Println("Database connection established")

	// 3. Setup the store
	store := db.New(connPool)

	// 4. Initialize server
	server := api.NewServer(store)

	// 5. Start the server
	log.Printf("Starting HTTP server on %s", serverAddress)
	err = server.Start(serverAddress)
	if err != nil {
		log.Fatalf("cannot start server: %v", err)
	}
}
