package utils

import (
	"strings"
	"testing"
)

// TestOrgForNamesTheDepartment: a department's receipt carries its own name on
// top, and never the ACES association's name.
func TestOrgForNamesTheDepartment(t *testing.T) {
	names := []string{
		"Department of Computer Engineering",
		"Department of Electrical Engineering",
		"Department of Agricultural Engineering",
	}
	for _, name := range names {
		org := OrgFor(name, "University of Uyo", "", nil)
		top := strings.TrimSpace(org.Name1 + " " + org.Name2)
		if top != strings.ToUpper(name) {
			t.Errorf("letterhead for %q reads %q, want %q", name, top, strings.ToUpper(name))
		}
		if strings.Contains(strings.ToUpper(org.Name1+" "+org.Name2), "ACES") {
			t.Errorf("letterhead for %q still names the ACES association", name)
		}
	}
}
