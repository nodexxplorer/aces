package email

import (
	"strings"
	"testing"
)

func TestFormatFrom(t *testing.T) {
	cases := []struct{ name, want string }{
		{"Department of Electrical Engineering", `"Department of Electrical Engineering" <no-reply@aces.zone>`},
		{"", `"Admin Pack" <no-reply@aces.zone>`},
		{`Say "hi" \ now`, `"Say \"hi\" \\ now" <no-reply@aces.zone>`},
	}
	for _, c := range cases {
		if got := formatFrom(c.name, "no-reply@aces.zone"); got != c.want {
			t.Errorf("formatFrom(%q) = %q, want %q", c.name, got, c.want)
		}
	}
	if got := formatFrom("Dép. Génie", "no-reply@aces.zone"); !strings.HasPrefix(got, "=?utf-8?") {
		t.Errorf("a non-ASCII name must be RFC 2047 encoded, got %q", got)
	}
}
