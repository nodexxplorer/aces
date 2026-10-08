package main

import "testing"

func TestNormalizeMatricCode(t *testing.T) {
	for in, want := range map[string]string{
		"":        "", // unset
		"  ":      "", // unset
		"EG/EE":   "EG/EE",
		"eg/ee":   "EG/EE",
		" EG/CO ": "EG/CO",
	} {
		got, err := normalizeMatricCode(in)
		if err != nil || got != want {
			t.Errorf("normalizeMatricCode(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, bad := range []string{"EE", "EG-EE", "EG/EEE", "E1/EE", "EG/E"} {
		if _, err := normalizeMatricCode(bad); err == nil {
			t.Errorf("normalizeMatricCode(%q) accepted a malformed code", bad)
		}
	}
}
