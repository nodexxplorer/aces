package main

import (
	"bufio"
	"context"
	"flag"
	"log"
	"os"
	"strconv"
	"strings"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/tenant"
	"github.com/aces/backend/internal/util"
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

// Usage: seed_admin [-tenant <slug>]
//
// Creates the first admin account for a department. Accounts are per
// department, so the same email can be an admin in several.
func main() {
	ctx := context.Background()

	tenantSlug := flag.String("tenant", os.Getenv("DEFAULT_TENANT_SLUG"), "department slug to seed (default: DEFAULT_TENANT_SLUG, else uniuyo-ce)")
	role := flag.String("role", "admin", "account to seed: admin (default) or lecturer")
	flag.Parse()
	if *tenantSlug == "" {
		*tenantSlug = "uniuyo-ce"
	}
	switch *role {
	case "admin":
	case "lecturer":
		seedLecturer(ctx, *tenantSlug)
		return
	default:
		log.Fatalf("unknown -role %q: use admin or lecturer", *role)
	}

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
	tenants, err := tenant.NewManager(ctx, dbSource, tenant.Options{DefaultSlug: *tenantSlug})
	if err != nil {
		log.Fatalf("cannot connect to db: %v", err)
	}
	defer tenants.Close()

	// Seeding reads and writes accounts, so it is subject to row-level security
	// like the server. Run it with the restricted runtime role's connection
	// string, not the migration owner's: as an owner it would see every
	// department's accounts.
	allowBypass, _ := strconv.ParseBool(os.Getenv("DB_ALLOW_RLS_BYPASS"))
	if err := tenants.CheckRuntimeRole(ctx, allowBypass); err != nil {
		log.Fatalf("database role check failed: %v", err)
	}

	t, err := tenants.Resolve(ctx, *tenantSlug)
	if err != nil {
		log.Fatalf("department %q: %v (create it with cmd/tenant)", *tenantSlug, err)
	}
	if !t.IsActive {
		log.Fatalf("department %q is not active", t.Slug)
	}
	// Everything below runs inside the department, so the lookup and the new
	// account are both scoped to it.
	ctx = tenant.With(ctx, t)
	store := db.New(tenants.DB())
	log.Printf("Seeding department %q", t.Slug)

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
		FirstName:    "System",
		LastName:     "Admin",
	}

	user, err = store.CreateUser(ctx, arg)
	if err != nil {
		log.Fatalf("cannot create admin user: %v", err)
	}

	_, err = tenants.DB().Exec(ctx, "UPDATE users SET is_approved = true, is_active = true WHERE id = $1", user.ID)
	if err != nil {
		log.Fatalf("cannot approve admin user: %v", err)
	}

	log.Printf("Successfully seeded admin user: %s (Role: %s)", user.Email, user.Role)
}
