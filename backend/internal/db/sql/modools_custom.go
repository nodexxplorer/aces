package db

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// Modools OAuth support methods.
//
// These are hand-written (not sqlc-generated) because they intentionally
// reach across the users/students tables with OAuth-specific semantics
// (find-or-link by IdP subject claim, transactional auto-provisioning).
// The users.modools_sub / users.modools_refresh_token columns come from
// migration 000002.

// GetAttendanceSession is hand-written (no .sql equivalent); it was restored
// here after a regeneration pass dropped it from custom.go.
func (q *Queries) GetAttendanceSession(ctx context.Context, id uuid.UUID) (AttendanceSession, error) {
	var i AttendanceSession
	err := q.db.QueryRow(ctx, `
		SELECT id, course_id, class_rep_id, session_id, semester_id, date, method,
		       venue, status, started_at, closed_at, total_present, total_absent,
		       total_students, created_at
		FROM attendance_sessions
		WHERE id = $1
	`, id).Scan(
		&i.ID, &i.CourseID, &i.ClassRepID, &i.SessionID, &i.SemesterID, &i.Date,
		&i.Method, &i.Venue, &i.Status, &i.StartedAt, &i.ClosedAt, &i.TotalPresent,
		&i.TotalAbsent, &i.TotalStudents, &i.CreatedAt,
	)
	return i, err
}

type CreateModoolsUserParams struct {
	Email        string
	PasswordHash string
	FirstName    string
	LastName     string
	ModoolsSub   string
	RefreshToken *string
	AvatarURL    *string
}

func normalizeModoolsName(firstName, lastName string) string {
	firstName = strings.TrimSpace(firstName)
	lastName = strings.TrimSpace(lastName)
	switch {
	case firstName != "" && lastName != "":
		return firstName + " " + lastName
	case firstName != "":
		return firstName
	case lastName != "":
		return lastName
	default:
		return "Student"
	}
}

// CreateModoolsUser provisions a users row for an OAuth-first student:
// unverified email (the IdP already proved it), no password login
// (placeholder hash — the account is only reachable via Modools), and the
// Modools subject + refresh token stamped for logout revocation.
// The full_name column is DB-generated from first/last names, matching manual signup.
func (q *Queries) CreateModoolsUser(ctx context.Context, arg CreateModoolsUserParams) (uuid.UUID, error) {
	firstName := strings.TrimSpace(arg.FirstName)
	lastName := strings.TrimSpace(arg.LastName)
	if firstName == "" && lastName == "" {
		firstName = "Student"
	}
	row := q.db.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, role, first_name, last_name, avatar_url, is_active, is_approved, email_verified, modools_sub, modools_refresh_token)
		VALUES ($1, $2, 'student', $3, $4, $5, true, true, false, $6, $7)
		RETURNING id
	`, arg.Email, arg.PasswordHash, firstName, lastName, arg.AvatarURL, arg.ModoolsSub, arg.RefreshToken)
	var id uuid.UUID
	err := row.Scan(&id)
	return id, err
}

// CreateModoolsStudentRow creates the students row for a freshly
// provisioned OAuth user. Matric number / entry year stay NULL until the
// student completes onboarding (allowed since migration 000002).
func (q *Queries) CreateModoolsStudentRow(ctx context.Context, userID uuid.UUID) error {
	_, err := q.db.Exec(ctx, `
		INSERT INTO students (user_id) VALUES ($1)
	`, userID)
	return err
}

// GetUserByModoolsSub finds a user by the stable Modools subject claim.
// pgx.ErrNoRows when no account is linked.
func (q *Queries) GetUserByModoolsSub(ctx context.Context, sub string) (User, error) {
	row := q.db.QueryRow(ctx, `
		SELECT id, email, password_hash, role, phone, avatar_url, is_active, email_verified,
		       two_factor_enabled, last_login_at, created_at, updated_at, deleted_at,
		       created_by_hod_id, is_approved, approved_by, approved_at,
		       date_of_birth, emergency_contact_name, emergency_contact_phone, home_address,
		       middle_name, first_name, last_name, full_name, calendar_feed_token,
		       last_birthday_greeted_year, modools_sub, modools_refresh_token
		FROM users WHERE modools_sub = $1 LIMIT 1
	`, sub)
	var u User
	err := row.Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.Phone, &u.AvatarUrl, &u.IsActive, &u.EmailVerified,
		&u.TwoFactorEnabled, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt, &u.DeletedAt,
		&u.CreatedByHodID, &u.IsApproved, &u.ApprovedBy, &u.ApprovedAt,
		&u.DateOfBirth, &u.EmergencyContactName, &u.EmergencyContactPhone, &u.HomeAddress,
		&u.MiddleName, &u.FirstName, &u.LastName, &u.FullName, &u.CalendarFeedToken,
		&u.LastBirthdayGreetedYear, &u.ModoolsSub, &u.ModoolsRefreshToken,
	)
	return u, err
}

// LinkModoolsAccount attaches a Modools subject (+ refresh token for logout
// revocation) to an existing local account. Fails if the subject is already
// claimed by another account.
func (q *Queries) LinkModoolsAccount(ctx context.Context, userID uuid.UUID, sub string, refreshToken *string) error {
	tag, err := q.db.Exec(ctx, `
		UPDATE users
		SET modools_sub = $2, modools_refresh_token = COALESCE($3, modools_refresh_token)
		WHERE id = $1 AND (modools_sub IS NULL OR modools_sub = $2)
	`, userID, sub, refreshToken)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("modools account already linked to another user or user not found")
	}
	return nil
}

// GetModoolsRefreshToken returns the stored IdP refresh token for a user
// (empty string when none), used at logout to revoke the Modools session.
func (q *Queries) GetModoolsRefreshToken(ctx context.Context, userID uuid.UUID) (string, error) {
	var tok *string
	err := q.db.QueryRow(ctx, `SELECT modools_refresh_token FROM users WHERE id = $1`, userID).Scan(&tok)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	if tok == nil {
		return "", nil
	}
	return *tok, nil
}

// UpdateModoolsRefreshToken stores the latest IdP refresh token (rotation).
func (q *Queries) UpdateModoolsRefreshToken(ctx context.Context, userID uuid.UUID, refreshToken *string) error {
	_, err := q.db.Exec(ctx, `
		UPDATE users SET modools_refresh_token = $2 WHERE id = $1
	`, userID, refreshToken)
	return err
}

var _ = pgtype.UUID{}
