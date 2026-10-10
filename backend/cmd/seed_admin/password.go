package main

import (
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"os"
)

// seedPasswordAlphabet leaves out characters that are easy to confuse when a
// password is copied by hand: 0 and O, 1, l and I.
const seedPasswordAlphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// seedPasswordLength gives about 116 bits of entropy over that alphabet.
const seedPasswordLength = 20

// generateSeedPassword returns a random password for a newly seeded account.
// Each department's seeded account gets its own, so no two are the same.
func generateSeedPassword() (string, error) {
	limit := big.NewInt(int64(len(seedPasswordAlphabet)))
	out := make([]byte, seedPasswordLength)
	for i := range out {
		n, err := rand.Int(rand.Reader, limit)
		if err != nil {
			return "", fmt.Errorf("cannot generate a password: %w", err)
		}
		out[i] = seedPasswordAlphabet[n.Int64()]
	}
	return string(out), nil
}

// refuseSeedPasswordEnv stops a run that still sets a password variable. The
// seeder no longer reads one. Ignoring it silently would hide that a shared
// password was about to be used for another department.
func refuseSeedPasswordEnv(name string) {
	if os.Getenv(name) != "" {
		log.Fatalf("%s is no longer used: seed_admin gives each department its own generated password and prints it once. Unset %s and run again.", name, name)
	}
}

// reportSeedPassword prints the generated password once. Nothing else stores
// it, so the operator must copy it now.
func reportSeedPassword(email, slug, password string) {
	fmt.Printf("\nSeeded %s in department %s.\nPassword (shown once, store it now): %s\n\n", email, slug, password)
}

// reportResetPassword prints the new password once, as reportSeedPassword does.
// Access tokens already issued stay valid until they expire (JWT_ACCESS_MINUTES);
// the refresh token stops working at once.
func reportResetPassword(email, slug, password string) {
	fmt.Printf("\nPassword reset for %s in department %s. The account is signed out of every session and unlocked.\nNew password (shown once, store it now): %s\n\n", email, slug, password)
}
