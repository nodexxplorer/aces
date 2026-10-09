package tenant_test

import (
	"testing"
)

// The accent is shown to every visitor of the department's sign-in page, so the
// database must refuse anything that is not a #rrggbb colour, and the manager
// must read a good one back.
func TestAccentIsValidatedAndLoaded(t *testing.T) {
	e := newEnv(t)
	tn := e.newTenant("dept-accent")

	mustExec(t, e.admin, `UPDATE tenants SET accent_color = $2 WHERE id = $1`, tn.ID, "#1b65a7")
	got, err := e.mgr.ByID(e.ctx, tn.ID)
	if err != nil {
		t.Fatalf("ByID: %v", err)
	}
	if got.AccentColor != "#1b65a7" {
		t.Fatalf("AccentColor = %q, want the stored colour", got.AccentColor)
	}

	for _, bad := range []string{"1b65a7", "#1B65A7", "#1b65a", "#1b65a7ff", "blue"} {
		if _, err := e.admin.Exec(e.ctx, `UPDATE tenants SET accent_color = $2 WHERE id = $1`, tn.ID, bad); err == nil {
			t.Errorf("the database accepted accent %q", bad)
		}
	}

	// A department with no accent reads back as empty, not NULL, so clients get
	// the platform colour. The manager caches departments, so this uses a new
	// department rather than rereading the one above.
	none := e.newTenant("dept-no-accent")
	got, err = e.mgr.ByID(e.ctx, none.ID)
	if err != nil {
		t.Fatalf("ByID: %v", err)
	}
	if got.AccentColor != "" {
		t.Fatalf("AccentColor = %q for a department with no accent, want empty", got.AccentColor)
	}

	// Clearing the accent (as cmd/tenant does when the logo is removed) leaves NULL.
	mustExec(t, e.admin, `UPDATE tenants SET accent_color = NULL WHERE id = $1`, tn.ID)
	var cleared *string
	if err := e.admin.QueryRow(e.ctx, `SELECT accent_color FROM tenants WHERE id = $1`, tn.ID).Scan(&cleared); err != nil {
		t.Fatalf("read accent: %v", err)
	}
	if cleared != nil {
		t.Fatalf("accent_color = %q after clearing, want NULL", *cleared)
	}
}
