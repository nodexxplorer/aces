package tenant

import "testing"

func TestShortName(t *testing.T) {
	cases := map[string]string{
		"Department of Computer Engineering":     "Computer Engineering",
		"department of  Electrical Engineering ": "Electrical Engineering",
		"  Department of Civil Engineering":      "Civil Engineering",
		"Computer Engineering":                   "Computer Engineering",
		"":                                       "",
	}
	for in, want := range cases {
		if got := ShortName(in); got != want {
			t.Errorf("ShortName(%q) = %q, want %q", in, got, want)
		}
	}
}
