package main

import (
	db "github.com/aces/backend/internal/db/sql"
	"testing"
)

func TestSeededAccountForMapsEachRoleToItsOwnVariables(t *testing.T) {
	admin, err := seededAccountFor("admin")
	if err != nil {
		t.Fatal(err)
	}
	if admin.emailEnv != "ADMIN_EMAIL" || admin.passwordEnv != "ADMIN_PASSWORD" || admin.role != db.UserRoleAdmin {
		t.Fatalf("admin maps to %+v", admin)
	}

	lecturer, err := seededAccountFor("lecturer")
	if err != nil {
		t.Fatal(err)
	}
	if lecturer.emailEnv != "LECTURER_EMAIL" || lecturer.passwordEnv != "LECTURER_PASSWORD" || lecturer.role != db.UserRoleLecturer {
		t.Fatalf("lecturer maps to %+v", lecturer)
	}
}

func TestSeededAccountForRefusesOtherRoles(t *testing.T) {
	for _, role := range []string{"student", "hod", "", "Admin"} {
		if _, err := seededAccountFor(role); err == nil {
			t.Fatalf("role %q was accepted; reset must only work on seeded admin and lecturer accounts", role)
		}
	}
}
