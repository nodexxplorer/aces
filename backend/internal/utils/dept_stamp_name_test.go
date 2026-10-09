package utils

import "testing"

// TestStampConfigForNamesTheDepartment checks the stamp's top line: every
// department's stamp reads "DEPARTMENT OF <NAME>" with that department's own
// name, and the bottom line stays the faculty's.
func TestStampConfigForNamesTheDepartment(t *testing.T) {
	cases := map[string]string{
		"Department of Computer Engineering":     "DEPARTMENT OF COMPUTER ENGINEERING",
		"Department of Electrical Engineering":   "DEPARTMENT OF ELECTRICAL ENGINEERING",
		"Department of Agricultural Engineering": "DEPARTMENT OF AGRICULTURAL ENGINEERING",
		"Computer Engineering":                   "DEPARTMENT OF COMPUTER ENGINEERING",
		"  department   of  Food Engineering  ":  "DEPARTMENT OF FOOD ENGINEERING",
	}
	for name, want := range cases {
		cfg, err := StampConfigFor(name)
		if err != nil {
			t.Fatalf("StampConfigFor(%q): %v", name, err)
		}
		if cfg.CompanyName != want {
			t.Errorf("StampConfigFor(%q).CompanyName = %q, want %q", name, cfg.CompanyName, want)
		}
		if cfg.AddressLine != "FACULTY OF ENGINEERING UNIUYO" {
			t.Errorf("StampConfigFor(%q).AddressLine = %q", name, cfg.AddressLine)
		}
	}
}

// TestStampConfigForRefusesABlankDepartment: a stamp is never made without a
// department name to print.
func TestStampConfigForRefusesABlankDepartment(t *testing.T) {
	for _, name := range []string{"", "   ", "Department of", "department of  "} {
		if _, err := StampConfigFor(name); err == nil {
			t.Errorf("StampConfigFor(%q) should refuse: there is no department name", name)
		}
	}
}
