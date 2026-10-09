package tenant_test

import (
	"testing"
)

// The approval address is where the approval page sends students, so the
// database must refuse an address that cannot receive mail, and the manager
// must read a good one back.
func TestApprovalEmailIsValidatedAndLoaded(t *testing.T) {
	e := newEnv(t)
	tn := e.newTenant("dept-approval")

	mustExec(t, e.admin, `UPDATE tenants SET approval_email = $2 WHERE id = $1`, tn.ID, "hod@dept.example.edu")
	got, err := e.mgr.ByID(e.ctx, tn.ID)
	if err != nil {
		t.Fatalf("ByID: %v", err)
	}
	if got.ApprovalEmail != "hod@dept.example.edu" {
		t.Fatalf("ApprovalEmail = %q, want the stored address", got.ApprovalEmail)
	}

	for _, bad := range []string{"no-at-sign", "a b@example.com", "a@nodot", "a@.example.com", "@example.com"} {
		if _, err := e.admin.Exec(e.ctx, `UPDATE tenants SET approval_email = $2 WHERE id = $1`, tn.ID, bad); err == nil {
			t.Errorf("the database accepted approval email %q", bad)
		}
	}
}
