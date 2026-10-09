package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/tenant"
	"github.com/aces/backend/internal/util"
	"github.com/jackc/pgx/v5"
)

// seededAccount says which seeded account a reset works on, for a -role value.
type seededAccount struct {
	emailEnv    string
	passwordEnv string
	role        db.UserRole
}

// seededAccountFor maps -role to the account seed_admin creates for it.
func seededAccountFor(role string) (seededAccount, error) {
	switch role {
	case "admin":
		return seededAccount{emailEnv: "ADMIN_EMAIL", passwordEnv: "ADMIN_PASSWORD", role: db.UserRoleAdmin}, nil
	case "lecturer":
		return seededAccount{emailEnv: "LECTURER_EMAIL", passwordEnv: "LECTURER_PASSWORD", role: db.UserRoleLecturer}, nil
	}
	return seededAccount{}, fmt.Errorf("unknown -role %q: use admin or lecturer", role)
}

var errNoSeededAccount = errors.New("no such account in this department")

// applySeedPasswordReset gives the account with this email a new password hash
// and signs it out of every session. Both changes run in one transaction, so
// either both happen or neither does. An account with another role is refused,
// so a reset cannot change a student's password by mistake.
func applySeedPasswordReset(ctx context.Context, dbh *tenant.DB, email string, role db.UserRole, passwordHash string) error {
	tx, err := dbh.Begin(ctx)
	if err != nil {
		return fmt.Errorf("cannot start the reset: %w", err)
	}
	defer tx.Rollback(ctx) // does nothing once the transaction is committed

	q := db.New(tx)
	user, err := q.GetUserByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		return errNoSeededAccount
	}
	if err != nil {
		return fmt.Errorf("cannot find the account: %w", err)
	}
	if user.Role != role {
		return fmt.Errorf("%s has the role %q, not %q, so it is not reset here", email, user.Role, role)
	}
	if err := q.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{PasswordHash: passwordHash, ID: user.ID}); err != nil {
		return fmt.Errorf("cannot set the password: %w", err)
	}
	if err := q.DeleteUserSessions(ctx, user.ID); err != nil {
		return fmt.Errorf("cannot sign the account out: %w", err)
	}
	return tx.Commit(ctx)
}

// resetSeedPassword gives the seeded account in department slug a new password.
// The password is generated and printed once, as a first password is. The
// account is also signed out of every session. It works on the account named
// by ADMIN_EMAIL, or by LECTURER_EMAIL with -role lecturer.
func resetSeedPassword(ctx context.Context, slug, role string) {
	acct, err := seededAccountFor(role)
	if err != nil {
		log.Fatal(err)
	}
	dbSource := os.Getenv("DB_SOURCE")
	if dbSource == "" {
		log.Fatal("DB_SOURCE environment variable is required. See .env.example for reference.")
	}
	email := os.Getenv(acct.emailEnv)
	if email == "" {
		log.Fatalf("%s environment variable is required.", acct.emailEnv)
	}
	refuseSeedPasswordEnv(acct.passwordEnv)

	password, err := generateSeedPassword()
	if err != nil {
		log.Fatal(err)
	}
	hashed, err := util.HashPassword(password)
	if err != nil {
		log.Fatalf("cannot hash password: %v", err)
	}

	tenants, err := tenant.NewManager(ctx, dbSource, tenant.Options{DefaultSlug: slug})
	if err != nil {
		log.Fatalf("cannot connect to db: %v", err)
	}
	defer tenants.Close()

	// As for seeding: the restricted runtime role, so row-level security applies.
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

	err = applySeedPasswordReset(ctx, tenants.DB(), email, acct.role, hashed)
	if errors.Is(err, errNoSeededAccount) {
		log.Fatalf("no %s account for %s in department %q. Seed it first with seed_admin.", role, email, t.Slug)
	}
	if err != nil {
		log.Fatalf("reset not applied; the old password still works. %v", err)
	}
	// Printed only after the commit, so the printed password is the one in use.
	reportResetPassword(email, t.Slug, password)
}
