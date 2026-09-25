package db

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// Note: batch confirmation is transactional at the API layer — the server
// wraps GenerateLevelPromotionProposals / ApplyLevelPromotionBatch calls in
// a pgx transaction via its pool and passes the tx-backed Queries in.

// ── Session roll-over: batch level promotion ────────────────────────────
// Levels are not derived from results (on hold). When a new session is
// created, every student gets a *proposal*: promoted (level+100) if they
// completed the previous cycle (dues paid AND CRF signed or courses
// registered), otherwise carried over at their current level. HOD/admin
// reviews per level, may flip individuals, then confirms — confirmation
// atomically bumps levels and rolls students into the new session.

// LevelPromotion is one student's proposed/confirmed outcome for a
// session roll-over.
type LevelPromotion struct {
	ID            uuid.UUID          `json:"id"`
	StudentID     uuid.UUID          `json:"student_id"`
	UserID        uuid.UUID          `json:"user_id"`
	FullName      string             `json:"full_name"`
	MatricNumber  string             `json:"matric_number"`
	Level         int32              `json:"level"` // current (from) level
	FromSessionID pgtype.UUID        `json:"from_session_id"`
	ToSessionID   uuid.UUID          `json:"to_session_id"`
	FromLevel     int32              `json:"from_level"`
	ToLevel       int32              `json:"to_level"`
	Status        string             `json:"status"`
	Reason        string             `json:"reason"`
	ConfirmedBy   pgtype.UUID        `json:"confirmed_by"`
	ConfirmedAt   pgtype.Timestamptz `json:"confirmed_at"`
	CreatedAt     pgtype.Timestamptz `json:"created_at"`
}

const levelPromotionColumns = `lp.id, lp.student_id, s.user_id, u.full_name, s.matric_number,
	s.level, lp.from_session_id, lp.to_session_id, lp.from_level, lp.to_level,
	lp.status, lp.reason, lp.confirmed_by, lp.confirmed_at, lp.created_at`

const levelPromotionJoins = `FROM level_promotions lp
	JOIN students s ON s.id = lp.student_id
	JOIN users u ON u.id = s.user_id`

func scanLevelPromotion(row pgx.Row) (LevelPromotion, error) {
	var p LevelPromotion
	err := row.Scan(
		&p.ID, &p.StudentID, &p.UserID, &p.FullName, &p.MatricNumber,
		&p.Level, &p.FromSessionID, &p.ToSessionID, &p.FromLevel, &p.ToLevel,
		&p.Status, &p.Reason, &p.ConfirmedBy, &p.ConfirmedAt, &p.CreatedAt,
	)
	return p, err
}

// GenerateLevelPromotionProposals creates one proposal per active student
// for rolling into toSessionID, based on completion of the *previous*
// session's cycle (the most recent session before toSessionID).
// Eligible = dues paid in the previous session AND (an approved CRF or a
// submitted/approved course registration in any of its semesters).
// Everyone else is proposed as carryover. Existing proposals for the
// session are left untouched (idempotent re-runs). 500L students are
// never proposed for promotion — final year is terminal.
func (q *Queries) GenerateLevelPromotionProposals(ctx context.Context, toSessionID uuid.UUID) (int64, error) {
	tag, err := q.db.Exec(ctx, `
		WITH prev AS (
			SELECT s.id
			FROM sessions s
			WHERE s.id <> $1
			  AND s.created_at < (SELECT created_at FROM sessions WHERE id = $1)
			ORDER BY s.created_at DESC
			LIMIT 1
		),
		eligible AS (
			SELECT st.id AS student_id, st.level AS from_level, prev.id AS from_session_id
			FROM students st
			JOIN prev ON true
			WHERE st.level < 500
			  AND EXISTS (
				SELECT 1 FROM payments p
				JOIN dues d ON d.id = p.due_id
				WHERE p.student_id = st.id
				  AND p.status = 'completed'
				  AND d.session_id = prev.id
			  )
			  AND (
				EXISTS (
					SELECT 1 FROM crf_signing_submissions c
					JOIN semesters sem ON sem.id = c.semester_id
					WHERE c.user_id = st.user_id AND c.status = 'completed'
					  AND sem.session_id = prev.id
				)
				OR EXISTS (
					SELECT 1 FROM course_registrations cr
					WHERE cr.student_id = st.id
					  AND cr.session_id = prev.id
					  AND cr.status IN ('submitted', 'approved')
				)
			  )
		)
		INSERT INTO level_promotions
			(student_id, from_session_id, to_session_id, from_level, to_level, status, reason)
		SELECT e.student_id, e.from_session_id, $1, e.from_level, e.from_level + 100, 'proposed', 'auto'
		FROM eligible e
		ON CONFLICT (student_id, to_session_id) DO NOTHING
	`, toSessionID)
	if err != nil {
		return 0, fmt.Errorf("generate promotion proposals: %w", err)
	}
	return tag.RowsAffected(), nil
}

// ListLevelPromotionProposals returns every proposal for a session,
// optionally filtered by the student's current (from) level.
func (q *Queries) ListLevelPromotionProposals(ctx context.Context, toSessionID uuid.UUID, fromLevel *int32) ([]LevelPromotion, error) {
	sql := `SELECT ` + levelPromotionColumns + ` ` + levelPromotionJoins + `
		WHERE lp.to_session_id = $1`
	args := []interface{}{toSessionID}
	if fromLevel != nil {
		sql += ` AND s.level = $2`
		args = append(args, *fromLevel)
	}
	sql += ` ORDER BY s.level, u.full_name`

	rows, err := q.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("list promotion proposals: %w", err)
	}
	defer rows.Close()

	out := make([]LevelPromotion, 0)
	for rows.Next() {
		p, err := scanLevelPromotion(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// LevelPromotionSummary aggregates proposal counts per level for a session.
type LevelPromotionSummary struct {
	Level       int32 `json:"level"`
	Proposed    int64 `json:"proposed"`
	Carryover   int64 `json:"carryover"`
	Confirmed   int64 `json:"confirmed"`
	HeldBack    int64 `json:"held_back"`
}

// SummarizeLevelPromotions returns per-level counts for a roll-over.
func (q *Queries) SummarizeLevelPromotions(ctx context.Context, toSessionID uuid.UUID) ([]LevelPromotionSummary, error) {
	rows, err := q.db.Query(ctx, `
		SELECT s.level,
			COUNT(*) FILTER (WHERE lp.status = 'proposed' AND lp.to_level > lp.from_level),
			COUNT(*) FILTER (WHERE lp.status = 'proposed' AND lp.to_level = lp.from_level),
			COUNT(*) FILTER (WHERE lp.status = 'confirmed'),
			COUNT(*) FILTER (WHERE lp.status = 'held_back')
		FROM level_promotions lp
		JOIN students s ON s.id = lp.student_id
		WHERE lp.to_session_id = $1
		GROUP BY s.level
		ORDER BY s.level
	`, toSessionID)
	if err != nil {
		return nil, fmt.Errorf("summarize promotions: %w", err)
	}
	defer rows.Close()

	out := make([]LevelPromotionSummary, 0)
	for rows.Next() {
		var s LevelPromotionSummary
		if err := rows.Scan(&s.Level, &s.Proposed, &s.Carryover, &s.Confirmed, &s.HeldBack); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// SetLevelPromotionStatus flips one student's proposal between
// proposed-promotion, proposed-carryover and held_back, before
// confirmation. Flipping adjusts to_level so the batch applies the right
// outcome: carryover keeps the current level, promote goes +100.
// Confirmed rows are immutable via this path.
func (q *Queries) SetLevelPromotionStatus(ctx context.Context, promotionID uuid.UUID, status, reason string) (LevelPromotion, error) {
	row := q.db.QueryRow(ctx, `
		UPDATE level_promotions
		SET status = $2,
			reason = $3,
			to_level = CASE
				WHEN $3 = 'carryover' THEN from_level
				WHEN $3 = 'manual_advance' THEN from_level + 100
				ELSE to_level
			END,
			updated_at = NOW()
		WHERE id = $1 AND status = 'proposed'
		RETURNING `+levelPromotionColumns, promotionID, status, reason)
	p, err := scanLevelPromotion(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return LevelPromotion{}, fmt.Errorf("proposal not found or already confirmed")
		}
		return LevelPromotion{}, err
	}
	return p, nil
}

// ApplyLevelPromotionBatch applies every remaining 'proposed' row for the
// session: promoted students get level+100 (capped at 500), carryovers
// keep their level; ALL active students then have current_session_id
// rolled to the new session. Confirmed/held_back rows are left as-is so
// the batch can be re-run safely after partial confirmation rounds.
// The caller owns the transaction (Begin/Rollback/Commit).
func (q *Queries) ApplyLevelPromotionBatch(ctx context.Context, toSessionID uuid.UUID, confirmedBy uuid.UUID) (promoted, carriedOver int64, err error) {
	// 1. Mark every still-proposed row confirmed.
	if _, err = q.db.Exec(ctx, `
		UPDATE level_promotions
		SET status = CASE WHEN to_level > from_level THEN 'confirmed' ELSE 'carried_over' END,
			confirmed_by = $2, confirmed_at = NOW(), updated_at = NOW()
		WHERE to_session_id = $1 AND status = 'proposed'
	`, toSessionID, confirmedBy); err != nil {
		return 0, 0, fmt.Errorf("mark confirmed: %w", err)
	}

	// 2. Bump levels for confirmed students (cap at 500).
	tag, err := q.db.Exec(ctx, `
		UPDATE students s
		SET level = LEAST(lp.to_level, 500), updated_at = NOW()
		FROM level_promotions lp
		WHERE lp.student_id = s.id
		  AND lp.to_session_id = $1
		  AND lp.status = 'confirmed'
	`, toSessionID)
	if err != nil {
		return 0, 0, fmt.Errorf("apply level bumps: %w", err)
	}
	promoted = tag.RowsAffected()

	// 3. Roll every active student (promoted or not) into the new session.
	tag, err = q.db.Exec(ctx, `
		UPDATE students s
		SET current_session_id = $1, updated_at = NOW()
		WHERE s.current_session_id IS DISTINCT FROM $1
		  AND EXISTS (SELECT 1 FROM users u WHERE u.id = s.user_id AND u.is_active = true AND u.deleted_at IS NULL)
	`, toSessionID)
	if err != nil {
		return 0, 0, fmt.Errorf("roll session: %w", err)
	}
	carriedOver = tag.RowsAffected()

	// 4. Deactivate the previous active session and activate the new one.
	if _, err := q.db.Exec(ctx, `
		UPDATE sessions SET is_active = false WHERE is_active = true AND id <> $1
	`, toSessionID); err != nil {
		return 0, 0, fmt.Errorf("deactivate old session: %w", err)
	}
	if _, err := q.db.Exec(ctx, `
		UPDATE sessions SET is_active = true WHERE id = $1
	`, toSessionID); err != nil {
		return 0, 0, fmt.Errorf("activate new session: %w", err)
	}

	return promoted, carriedOver, nil
}

// GetSessionName returns the session's display name.
func (q *Queries) GetSessionName(ctx context.Context, sessionID uuid.UUID) (string, error) {
	var name string
	err := q.db.QueryRow(ctx, `SELECT name FROM sessions WHERE id = $1`, sessionID).Scan(&name)
	return name, err
}

// CountLevelPromotionProposals returns how many proposals exist for a
// session (used by the UI to warn before re-generating).
func (q *Queries) CountLevelPromotionProposals(ctx context.Context, toSessionID uuid.UUID) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM level_promotions WHERE to_session_id = $1
	`, toSessionID).Scan(&n)
	return n, err
}
