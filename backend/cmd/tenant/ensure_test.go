package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseDepartmentFileChecksEveryDepartment(t *testing.T) {
	good := `[
		{"slug": "dept-ee", "name": "Department of Electrical Engineering", "matric_code": "EG/EE"},
		{"slug": " Dept-CV ", "name": " Department of Civil Engineering ", "matric_code": "eg/cv",
		 "url_code": "cv", "institution": "University of Uyo", "faculty": "Faculty of Engineering"}
	]`
	specs, err := parseDepartmentFile([]byte(good))
	if err != nil {
		t.Fatalf("parse a valid file: %v", err)
	}
	if len(specs) != 2 {
		t.Fatalf("got %d departments, want 2", len(specs))
	}
	if specs[1].Slug != "dept-cv" {
		t.Errorf("slug not normalised: %q", specs[1].Slug)
	}
	if specs[1].MatricCode != "EG/CV" {
		t.Errorf("matric code not upper-cased: %q", specs[1].MatricCode)
	}
	if specs[1].Name != "Department of Civil Engineering" {
		t.Errorf("name not trimmed: %q", specs[1].Name)
	}
	// The URL code comes from the matric code when the file leaves it out.
	if specs[0].URLCode != "ee" {
		t.Errorf("EG/EE should default to the web address code ee, got %q", specs[0].URLCode)
	}
}

func TestParseDepartmentFileRefusesAFileItCannotStore(t *testing.T) {
	bad := map[string]string{
		"not json":               `nope`,
		"not a list":             `{"slug": "dept-ee"}`,
		"empty list":             `[]`,
		"unknown field":          `[{"slug": "dept-ee", "name": "EE", "matric": "EG/EE"}]`,
		"no name":                `[{"slug": "dept-ee", "matric_code": "EG/EE"}]`,
		"bad slug":               `[{"slug": "Dept EE", "name": "EE", "matric_code": "EG/EE"}]`,
		"no slug":                `[{"name": "EE", "matric_code": "EG/EE"}]`,
		"bad matric code":        `[{"slug": "dept-ee", "name": "EE", "matric_code": "EE"}]`,
		"bad url code":           `[{"slug": "dept-ee", "name": "EE", "matric_code": "EG/EE", "url_code": "admin"}]`,
		"slug listed twice":      `[{"slug": "dept-ee", "name": "EE", "matric_code": "EG/EE"}, {"slug": "dept-ee", "name": "EE2", "matric_code": "EG/CV"}]`,
		"matric code twice":      `[{"slug": "dept-ee", "name": "EE", "matric_code": "EG/EE"}, {"slug": "dept-ee2", "name": "EE2", "matric_code": "eg/ee"}]`,
		"content after the list": `[{"slug": "dept-ee", "name": "EE", "matric_code": "EG/EE"}] {"slug": "x"}`,
	}
	for name, body := range bad {
		if _, err := parseDepartmentFile([]byte(body)); err == nil {
			t.Errorf("%s: accepted a file that cannot be stored", name)
		}
	}
}

// The shipped list is what most faculties start from, so it must parse, and
// every department in it must have a logo file to drop into the logo folder.
func TestShippedDepartmentsFile(t *testing.T) {
	path := shippedDepartmentsFile()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read the shipped department file: %v", err)
	}
	specs, err := parseDepartmentFile(data)
	if err != nil {
		t.Fatalf("the shipped department file: %v", err)
	}
	if len(specs) != 8 {
		t.Errorf("the shipped file lists %d departments, want the 8 of the faculty", len(specs))
	}

	logoDir := filepath.Join("..", "..", "..", "branding", "department-logos")
	seenCode := map[string]bool{}
	seenURL := map[string]bool{}
	for _, s := range specs {
		if s.MatricCode == "" {
			t.Errorf("%s: no matric code, so its students could not sign up", s.Slug)
			continue
		}
		if !strings.HasPrefix(s.MatricCode, "EG/") {
			t.Errorf("%s: matric code %s is not in faculty EG", s.Slug, s.MatricCode)
		}
		if seenCode[s.MatricCode] {
			t.Errorf("matric code %s used twice", s.MatricCode)
		}
		seenCode[s.MatricCode] = true
		if s.URLCode == "" {
			t.Errorf("%s: no web address code, so it has no /<code> sign-in page", s.Slug)
		}
		if seenURL[s.URLCode] {
			t.Errorf("web address code %s used twice", s.URLCode)
		}
		seenURL[s.URLCode] = true
		if _, err := os.Stat(filepath.Join(logoDir, logoFileNameFor(s.MatricCode))); err != nil {
			t.Errorf("%s: no %s in the logo folder", s.Slug, logoFileNameFor(s.MatricCode))
		}
	}
	// The legacy department must keep its slug: its id is hard-coded in the
	// migration and old tokens resolve to it.
	var hasLegacy bool
	for _, s := range specs {
		if s.Slug == "uniuyo-ce" {
			hasLegacy = true
			if s.MatricCode != "EG/CO" {
				t.Errorf("uniuyo-ce must keep matric code EG/CO, got %s", s.MatricCode)
			}
		}
	}
	if !hasLegacy {
		t.Error("the shipped file does not list uniuyo-ce, the legacy department")
	}
}

func TestLogoFileNameFor(t *testing.T) {
	if got, want := logoFileNameFor("EG/CO"), "EG-CO.png"; got != want {
		t.Errorf("logoFileNameFor(EG/CO) = %q, want %q", got, want)
	}
}
