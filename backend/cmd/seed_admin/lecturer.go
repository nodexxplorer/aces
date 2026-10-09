package main

import (
	"context"
	"errors"
	"log"
	"os"
	"strconv"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/service"
	"github.com/aces/backend/internal/tenant"
)

// seedLecturer creates a lecturer in one department. It goes through the same
// sign-up path as the website, so the lecturer is filed under the department's
// name, and then approves the account as an admin would. It reads
// LECTURER_EMAIL and LECTURER_STAFF_ID (both required), and the optional
// LECTURER_FIRST_NAME and LECTURER_LAST_NAME. It generates the lecturer's
// password and prints it once, as for admins.
func seedLecturer(ctx context.Context, slug string) {
	dbSource := os.Getenv("DB_SOURCE")
	if dbSource == "" {
		log.Fatal("DB_SOURCE environment variable is required. See .env.example for reference.")
	}
	email := os.Getenv("LECTURER_EMAIL")
	staffID := os.Getenv("LECTURER_STAFF_ID")
	if email == "" || staffID == "" {
		log.Fatal("LECTURER_EMAIL and LECTURER_STAFF_ID are required with -role lecturer.")
	}
	refuseSeedPasswordEnv("LECTURER_PASSWORD")
	password, err := generateSeedPassword()
	if err != nil {
		log.Fatal(err)
	}
	firstName := os.Getenv("LECTURER_FIRST_NAME")
	if firstName == "" {
		firstName = "Lecturer"
	}
	lastName := os.Getenv("LECTURER_LAST_NAME")
	if lastName == "" {
		lastName = "Account"
	}

	tenants, err := tenant.NewManager(ctx, dbSource, tenant.Options{DefaultSlug: slug})
	if err != nil {
		log.Fatalf("cannot connect to db: %v", err)
	}
	defer tenants.Close()

	// As for admins: seeding runs with the restricted runtime role, so row-level
	// security applies to the account it writes.
	allowBypass, _ := strconv.ParseBool(os.Getenv("DB_ALLOW_RLS_BYPASS"))
	if err := tenants.CheckRuntimeRole(ctx, allowBypass); err != nil {
		log.Fatalf("database role check failed: %v", err)
	}

	t, err := tenants.Resolve(ctx, slug)
	if err != nil {
		log.Fatalf("department %q: %v (create it with cmd/tenant)", slug, err)
	}
	if !t.IsActive {
		log.Fatalf("department %q is not active", t.Slug)
	}
	ctx = tenant.With(ctx, t)

	store := db.New(tenants.DB())
	auth := service.NewAuthService(store)
	department := tenant.ShortName(t.Name)
	result, err := auth.LecturerSignup(ctx, email, password, firstName, lastName, "", staffID, department, "")
	if errors.Is(err, service.ErrEmailTaken) {
		log.Printf("Lecturer already exists in %q: %s", t.Slug, email)
		return
	}
	if err != nil {
		log.Fatalf("cannot create lecturer: %v", err)
	}
	// Print the password before anything else can fail: this is the only copy.
	reportSeedPassword(email, t.Slug, password)

	if _, err := tenants.DB().Exec(ctx, "UPDATE users SET is_approved = true, is_active = true WHERE id = $1", result.User.ID); err != nil {
		log.Fatalf("cannot approve lecturer: %v", err)
	}
	if _, err := tenants.DB().Exec(ctx, "UPDATE signup_approvals SET status = 'approved' WHERE user_id = $1", result.User.ID); err != nil {
		log.Fatalf("cannot approve the lecturer's sign-up request: %v", err)
	}
	log.Printf("Successfully seeded lecturer %s in %q (department %q)", email, t.Slug, department)
}
