package main

import (
	"strings"
	"testing"
)

func TestGenerateSeedPasswordIsRandomAndWellFormed(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 200; i++ {
		p, err := generateSeedPassword()
		if err != nil {
			t.Fatal(err)
		}
		if len(p) != seedPasswordLength {
			t.Fatalf("password %q has length %d, want %d", p, len(p), seedPasswordLength)
		}
		for _, c := range p {
			if !strings.ContainsRune(seedPasswordAlphabet, c) {
				t.Fatalf("password %q contains %q, which is outside the alphabet", p, c)
			}
		}
		if seen[p] {
			t.Fatalf("password %q was generated twice", p)
		}
		seen[p] = true
	}
}

func TestSeedPasswordAlphabetLeavesOutAmbiguousCharacters(t *testing.T) {
	for _, c := range "0O1lI" {
		if strings.ContainsRune(seedPasswordAlphabet, c) {
			t.Fatalf("alphabet contains the ambiguous character %q", c)
		}
	}
}

func TestSeedPasswordFitsTheAPIPasswordLimits(t *testing.T) {
	// The API accepts 6 to 72 characters (binding on the sign-up and reset
	// requests). A generated password must pass that check.
	if seedPasswordLength < 6 || seedPasswordLength > 72 {
		t.Fatalf("seedPasswordLength %d is outside the 6 to 72 range the API accepts", seedPasswordLength)
	}
}
