package tenant_test

import (
	"testing"
)

// The web address code names the department in every URL, so the database must
// refuse a malformed code, must not let two departments share one, and the
// manager must read a good one back.
func TestURLCodeIsValidatedUniqueAndLoaded(t *testing.T) {
	e := newEnv(t)
	tn := e.newTenant("dept-url")

	mustExec(t, e.admin, `UPDATE tenants SET url_code = $2 WHERE id = $1`, tn.ID, "ee")
	got, err := e.mgr.ByID(e.ctx, tn.ID)
	if err != nil {
		t.Fatalf("ByID: %v", err)
	}
	if got.URLCode != "ee" {
		t.Fatalf("URLCode = %q, want ee", got.URLCode)
	}

	for _, bad := range []string{"E", "EE", "e-e", "e_e", "abcdefghijklm", "ee/"} {
		if _, err := e.admin.Exec(e.ctx, `UPDATE tenants SET url_code = $2 WHERE id = $1`, tn.ID, bad); err == nil {
			t.Errorf("the database accepted URL code %q", bad)
		}
	}

	other := e.newTenant("dept-url-two")
	if _, err := e.admin.Exec(e.ctx, `UPDATE tenants SET url_code = $2 WHERE id = $1`, other.ID, "ee"); err == nil {
		t.Fatal("the database let two departments share the URL code ee")
	}

	// A department without a code reads back as empty, not NULL.
	got, err = e.mgr.ByID(e.ctx, other.ID)
	if err != nil {
		t.Fatalf("ByID: %v", err)
	}
	if got.URLCode != "" {
		t.Fatalf("URLCode = %q for a department with no code, want empty", got.URLCode)
	}
}
