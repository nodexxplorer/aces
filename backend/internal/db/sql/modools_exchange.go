package db

import (
	"context"

	"github.com/google/uuid"
)

// One-time codes for the mobile Modools sign-in (see migration 000011). These
// are hand-written, like the other Modools methods in modools_custom.go.

// ModoolsCodeClaim is what a claimed one-time code leads to. The name differs
// from the table's generated model on purpose (see sqlc.yaml).
type ModoolsCodeClaim struct {
	UserID        uuid.UUID
	CodeChallenge string
}

// CreateModoolsExchangeCode stores a one-time code for userID in tenantID. The
// code is stored as its SHA-256 hash and expires 60 seconds from now, by the
// database clock. Codes that have already expired are removed first.
func (q *Queries) CreateModoolsExchangeCode(ctx context.Context, tenantID uuid.UUID, codeHash []byte, userID uuid.UUID, codeChallenge string) error {
	if _, err := q.db.Exec(ctx, `DELETE FROM modools_exchange_codes WHERE expires_at <= now()`); err != nil {
		return err
	}
	_, err := q.db.Exec(ctx, `
		INSERT INTO modools_exchange_codes (code_hash, tenant_id, user_id, code_challenge, expires_at)
		VALUES ($1, $2, $3, $4, now() + interval '60 seconds')
	`, codeHash, tenantID, userID, codeChallenge)
	return err
}

// ClaimModoolsExchangeCode uses a code. It marks an unused, unexpired code as
// used and returns what the code leads to. The claim is one statement, so two
// requests with the same code cannot both succeed. pgx.ErrNoRows means the code
// is unknown, used or expired, or it belongs to another department: row-level
// security hides it there, and the claim does not use it up.
func (q *Queries) ClaimModoolsExchangeCode(ctx context.Context, codeHash []byte) (ModoolsCodeClaim, error) {
	var c ModoolsCodeClaim
	err := q.db.QueryRow(ctx, `
		UPDATE modools_exchange_codes
		SET used_at = now()
		WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now()
		RETURNING user_id, code_challenge
	`, codeHash).Scan(&c.UserID, &c.CodeChallenge)
	return c, err
}
