package service

import (
	"context"
	"testing"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
)

// fakeRoleHolders supplies the (user, role) pairs; the embedded Querier is nil and must not be called.
type fakeRoleHolders struct {
	db.Querier
	holders []db.RoleHolder
}

func (f fakeRoleHolders) ListRoleHolders(ctx context.Context) ([]db.RoleHolder, error) {
	return f.holders, nil
}

func countOf(roles []SystemRoleInfo, name string) (int, bool) {
	for _, r := range roles {
		if r.Name == name {
			return r.UserCount, true
		}
	}
	return 0, false
}

func TestListAllSystemRolesCountsExtraRolesAndDisplayNames(t *testing.T) {
	ada := uuid.New()  // primary student, extra class_rep
	ben := uuid.New()  // primary bursar_class (stored name), no extras
	cara := uuid.New() // primary student, extra class_rep and bursar_dept
	dan := uuid.New()  // primary admin (stored name for delegated_admin)

	store := fakeRoleHolders{holders: []db.RoleHolder{
		{UserID: ada, Role: "student"},
		{UserID: ada, Role: "class_rep"},
		{UserID: ben, Role: "bursar_class"},
		{UserID: cara, Role: "student"},
		{UserID: cara, Role: "class_rep"},
		{UserID: cara, Role: "bursar_dept"},
		{UserID: dan, Role: "admin"},
	}}

	roles, err := NewRoleService(store).ListAllSystemRoles(context.Background())
	if err != nil {
		t.Fatalf("ListAllSystemRoles: %v", err)
	}

	want := map[string]int{
		"student":         2, // ada and cara
		"class_rep":       2, // ada (extra) and cara (extra)
		"class_bursar":    1, // ben, stored as bursar_class
		"dept_bursar":     1, // cara (extra), stored as bursar_dept
		"delegated_admin": 1, // dan, stored as admin
	}
	for name, n := range want {
		got, ok := countOf(roles, name)
		if !ok {
			t.Fatalf("role %q missing from the list", name)
		}
		if got != n {
			t.Errorf("%s: got %d users, want %d", name, got, n)
		}
	}

	if _, ok := countOf(roles, "admin"); ok {
		t.Errorf("the dead 'admin' row should not be listed")
	}
}
