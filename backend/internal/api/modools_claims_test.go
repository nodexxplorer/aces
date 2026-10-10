package api

import (
	"context"
	"testing"
)

// With neither an id_token nor an OAuth token there is no identity to read,
// so the sign-in must fail closed rather than create an account.
func TestModoolsLoadClaimsFailsWithoutSubjectAndEmail(t *testing.T) {
	if _, err := modoolsLoadClaims(context.Background(), nil, nil, "", "client-id"); err == nil {
		t.Fatal("expected an error when no id_token or userinfo identity is available")
	}
}
