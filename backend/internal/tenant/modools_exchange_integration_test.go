package tenant_test

import (
	"context"
	"crypto/sha256"
	"errors"
	"testing"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/jackc/pgx/v5"
)

// A one-time code for a mobile Modools sign-in works once, only in the
// department it was issued in, and only until it expires.
func TestModoolsExchangeCodes(t *testing.T) {
	e := newEnv(t)
	ce := e.newTenant("ex-ce")
	ee := e.newTenant("ex-ee")
	student := e.newUser(ce, "student@ex-ce.test")
	const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
	hash := func(code string) []byte {
		h := sha256.Sum256([]byte(code))
		return h[:]
	}
	q := db.New(e.mgr.DB())

	if err := q.CreateModoolsExchangeCode(in(ce), ce.ID, hash("code-a"), student, challenge); err != nil {
		t.Fatalf("store code: %v", err)
	}

	// Another department cannot see the code, so its claim changes nothing.
	if _, err := q.ClaimModoolsExchangeCode(in(ee), hash("code-a")); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("claim from another department: %v, want no rows", err)
	}

	claim, err := q.ClaimModoolsExchangeCode(in(ce), hash("code-a"))
	if err != nil {
		t.Fatalf("claim in its own department: %v", err)
	}
	if claim.UserID != student || claim.CodeChallenge != challenge {
		t.Fatalf("claim = %+v, want user %s with the challenge", claim, student)
	}

	if _, err := q.ClaimModoolsExchangeCode(in(ce), hash("code-a")); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("second claim: %v, want no rows", err)
	}

	if err := q.CreateModoolsExchangeCode(in(ce), ce.ID, hash("code-b"), student, challenge); err != nil {
		t.Fatalf("store code b: %v", err)
	}
	mustExec(t, e.admin, `UPDATE modools_exchange_codes SET expires_at = now() - interval '1 second' WHERE code_hash = $1`, hash("code-b"))
	if _, err := q.ClaimModoolsExchangeCode(in(ce), hash("code-b")); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("expired claim: %v, want no rows", err)
	}

	// A code cannot be stored under another department.
	if err := q.CreateModoolsExchangeCode(in(ce), ee.ID, hash("code-c"), student, challenge); err == nil {
		t.Fatal("a code was stored under another department")
	}

	// Expired codes are removed when the next code is stored.
	if err := q.CreateModoolsExchangeCode(in(ce), ce.ID, hash("code-d"), student, challenge); err != nil {
		t.Fatalf("store code d: %v", err)
	}
	var left int
	if err := e.admin.QueryRow(context.Background(),
		`SELECT count(*) FROM modools_exchange_codes WHERE code_hash = $1`, hash("code-b")).Scan(&left); err != nil {
		t.Fatalf("count expired code: %v", err)
	}
	if left != 0 {
		t.Fatal("the expired code was not removed")
	}
}
