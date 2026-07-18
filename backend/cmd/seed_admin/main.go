package main

import (
	"bufio"
	"context"
	"log"
	"os"
	"strings"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/util"
	"github.com/jackc/pgx/v5/pgxpool"
)

func init() {
	f, err := os.Open(".env")
	if err != nil {
		return
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.Index(line, "=")
		if idx < 1 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		value := strings.TrimSpace(line[idx+1:])
		if len(value) >= 2 && value[0] == '"' && value[len(value)-1] == '"' {
			value = value[1 : len(value)-1]
		}
		if os.Getenv(key) == "" {
			os.Setenv(key, value)
		}
	}
}

func main() {
	ctx := context.Background()

	dbSource := os.Getenv("DB_SOURCE")
	if dbSource == "" {
		log.Fatal("DB_SOURCE environment variable is required. See .env.example for reference.")
	}

	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail == "" {
		log.Fatal("ADMIN_EMAIL environment variable is required.")
	}

	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminPassword == "" {
		log.Fatal("ADMIN_PASSWORD environment variable is required.")
	}
	if len(adminPassword) < 8 {
		log.Fatal("ADMIN_PASSWORD must be at least 8 characters.")
	}

	log.Printf("Connecting to database for seeding...")
	connPool, err := pgxpool.New(ctx, dbSource)
	if err != nil {
		log.Fatalf("cannot connect to db: %v", err)
	}
	defer connPool.Close()

	store := db.New(connPool)

	user, err := store.GetUserByEmail(ctx, adminEmail)
	if err == nil {
		log.Printf("Admin user already exists: %s (Role: %s)", user.Email, user.Role)
		return
	}

	hashedPassword, err := util.HashPassword(adminPassword)
	if err != nil {
		log.Fatalf("cannot hash password: %v", err)
	}

	arg := db.CreateUserParams{
		Email:        adminEmail,
		PasswordHash: hashedPassword,
		Role:         db.UserRoleAdmin,
		FullName:     "System Admin",
	}

	user, err = store.CreateUser(ctx, arg)
	if err != nil {
		log.Fatalf("cannot create admin user: %v", err)
	}

	_, err = connPool.Exec(ctx, "UPDATE users SET is_approved = true, is_active = true WHERE id = $1", user.ID)
	if err != nil {
		log.Fatalf("cannot approve admin user: %v", err)
	}

	log.Printf("Successfully seeded admin user: %s (Role: %s)", user.Email, user.Role)
}
