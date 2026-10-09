package tenant

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestValidURLCode(t *testing.T) {
	for _, ok := range []string{"co", "ee", "ce", "pe", "ae", "fe", "cv", "me", "abc123", "ab", "abcdefghijkl"} {
		if err := ValidURLCode(ok); err != nil {
			t.Errorf("ValidURLCode(%q) = %v, want nil", ok, err)
		}
	}
	for _, bad := range []string{"", "c", "CO", "co-ee", "co_ee", "co.ee", "abcdefghijklm", "co/ee", " co"} {
		if err := ValidURLCode(bad); err == nil {
			t.Errorf("ValidURLCode(%q) = nil, want an error", bad)
		}
	}
}

func TestValidURLCodeRefusesWebAppPages(t *testing.T) {
	for _, reserved := range []string{"admin", "dashboard", "login", "api", "uploads", "gpa"} {
		if err := ValidURLCode(reserved); err == nil {
			t.Errorf("ValidURLCode(%q) = nil, want a refusal: the web app uses that path", reserved)
		}
	}
}

func TestDefaultURLCodeComesFromTheMatricCode(t *testing.T) {
	cases := map[string]string{
		"EG/CO": "co",
		"EG/CE": "ce",
		"EG/ME": "me",
		"eg/ee": "ee",
		"":      "",
		"CO":    "",
		"EG/":   "",
		"EG/C0": "c0",
	}
	for matric, want := range cases {
		if got := DefaultURLCode(matric); got != want {
			t.Errorf("DefaultURLCode(%q) = %q, want %q", matric, got, want)
		}
	}
}

// routerSegment matches a quoted route path in frontend/src/router.tsx and
// captures its first segment: '/login', 'lecturer/signup', and the staff
// portal's '/portalsign' inside its expression.
var routerSegment = regexp.MustCompile(`'/?([a-z][a-z0-9-]*)[/']`)

// TestReservedURLCodesCoverTheWebRouter fails when the web app gains a page
// whose first segment could be a department's web address code but is not
// reserved. A code that is also a page would never reach its department.
func TestReservedURLCodesCoverTheWebRouter(t *testing.T) {
	src, err := os.ReadFile(filepath.Join("..", "..", "..", "frontend", "src", "router.tsx"))
	if os.IsNotExist(err) {
		t.Skip("frontend/src/router.tsx is not in this checkout")
	}
	if err != nil {
		t.Fatal(err)
	}

	segments := map[string]bool{}
	for _, line := range strings.Split(string(src), "\n") {
		if !strings.Contains(line, "path:") {
			continue
		}
		for _, m := range routerSegment.FindAllStringSubmatch(line, -1) {
			segments[m[1]] = true
		}
	}
	if len(segments) < 20 {
		t.Fatalf("found only %d route segments in router.tsx; the pattern no longer matches the file", len(segments))
	}

	for segment := range segments {
		if !urlCodePattern.MatchString(segment) {
			continue // too long or hyphenated, so it cannot be a code anyway
		}
		if !reservedURLCodes[segment] {
			t.Errorf("the web app has the page %q, which a department code could shadow: add it to reservedURLCodes", segment)
		}
	}
}
