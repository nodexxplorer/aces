package utils

import (
	"strings"
	"testing"
)

func TestBrandLabel(t *testing.T) {
	if got := brandLabel(""); got != "Admin Pack" {
		t.Errorf("no department name must give the platform name, got %q", got)
	}
	if got := brandLabel("  Department of Electrical Engineering "); got != "Department of Electrical Engineering" {
		t.Errorf("got %q", got)
	}
}

func TestSplitBrandName(t *testing.T) {
	cases := map[string][2]string{
		"DEPARTMENT OF COMPUTER ENGINEERING": {"DEPARTMENT OF", "COMPUTER ENGINEERING"},
		"ACES":                               {"ACES", ""},
		"":                                   {"", ""},
	}
	for in, want := range cases {
		a, b := splitBrandName(in)
		if a != want[0] || b != want[1] {
			t.Errorf("splitBrandName(%q) = (%q, %q), want (%q, %q)", in, a, b, want[0], want[1])
		}
	}
}

func TestOrgForDepartment(t *testing.T) {
	logo := []byte("logo")
	org := OrgFor("Department of Petroleum Engineering", "University of Uyo", "pe@example.edu", logo)
	if org.Name1 != "DEPARTMENT OF" || org.Name2 != "PETROLEUM ENGINEERING" {
		t.Errorf("name lines: %q / %q", org.Name1, org.Name2)
	}
	if org.Chapter != "UNIVERSITY OF UYO" || org.Email != "Email: pe@example.edu" {
		t.Errorf("chapter %q, email %q", org.Chapter, org.Email)
	}
	if string(org.LogoRight) != "logo" || len(org.LogoLeft) == 0 {
		t.Error("the department logo goes on the right and the University crest on the left")
	}
	if strings.Contains(org.Name1+org.Name2+org.Chapter+org.Email, "ACES") {
		t.Error("a department's letterhead must not carry the association's name")
	}
	if bare := OrgFor("Dept", "", "", nil); bare.Email != "" || bare.LogoRight != nil {
		t.Errorf("no contact email and no logo must leave those lines empty: %+v", bare)
	}
}
