package tenant_test

import (
	"testing"
)

// The contact email is printed on receipts, so the database must refuse an
// address that cannot be a contact, and the manager must read a good one back.
func TestContactEmailIsValidatedAndLoaded(t *testing.T) {
	e := newEnv(t)
	tn := e.newTenant("dept-contact")

	mustExec(t, e.admin, `UPDATE tenants SET contact_email = $2 WHERE id = $1`, tn.ID, "ee@dept.example.edu")
	got, err := e.mgr.ByID(e.ctx, tn.ID)
	if err != nil {
		t.Fatalf("ByID: %v", err)
	}
	if got.ContactEmail != "ee@dept.example.edu" {
		t.Fatalf("ContactEmail = %q, want the stored address", got.ContactEmail)
	}

	for _, bad := range []string{"no-at-sign", "a b@example.com", "a@nodot", "a@.example.com", "@example.com"} {
		if _, err := e.admin.Exec(e.ctx, `UPDATE tenants SET contact_email = $2 WHERE id = $1`, tn.ID, bad); err == nil {
			t.Errorf("the database accepted contact email %q", bad)
		}
	}
}
