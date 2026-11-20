package attendance

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/aces/backend/internal/tenant"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Beginner interface {
	Begin(context.Context) (pgx.Tx, error)
}
type Service struct{ Pool Beginner }
type Session struct {
	ID          uuid.UUID  `json:"id"`
	CourseID    uuid.UUID  `json:"courseId"`
	SemesterID  uuid.UUID  `json:"semesterId"`
	LecturerID  uuid.UUID  `json:"lecturerId"`
	DelegateID  *uuid.UUID `json:"delegateId"`
	Title       string     `json:"title"`
	Venue       string     `json:"venue"`
	ScheduledAt time.Time  `json:"scheduledAt"`
	Duration    int        `json:"durationMinutes"`
	Latitude    *float64   `json:"latitude"`
	Longitude   *float64   `json:"longitude"`
	Radius      int        `json:"radiusM"`
	Status      string     `json:"status"`
	Secret      string     `json:"-"`
	OpenedAt    *time.Time `json:"openedAt"`
	ClosesAt    *time.Time `json:"closesAt"`
	Revision    int        `json:"revision"`
}
type CreateRequest struct {
	CourseID    uuid.UUID `json:"courseId"`
	SemesterID  uuid.UUID `json:"semesterId"`
	Title       string    `json:"title"`
	Venue       string    `json:"venue"`
	ScheduledAt time.Time `json:"scheduledAt"`
	Duration    int       `json:"durationMinutes"`
	Latitude    *float64  `json:"latitude"`
	Longitude   *float64  `json:"longitude"`
	Radius      int       `json:"radiusM"`
}

const sessionColumns = `id,course_id,semester_id,lecturer_id,delegate_id,title,venue,scheduled_at,duration_minutes,latitude,longitude,radius_m,status,secret,opened_at,closes_at,revision`

func scan(row pgx.Row) (Session, error) {
	var x Session
	err := row.Scan(&x.ID, &x.CourseID, &x.SemesterID, &x.LecturerID, &x.DelegateID, &x.Title, &x.Venue, &x.ScheduledAt, &x.Duration, &x.Latitude, &x.Longitude, &x.Radius, &x.Status, &x.Secret, &x.OpenedAt, &x.ClosesAt, &x.Revision)
	return x, err
}
func (s *Service) begin(ctx context.Context, actor uuid.UUID) (pgx.Tx, uuid.UUID, error) {
	t, ok := tenant.From(ctx)
	if !ok || !t.IsActive || actor == uuid.Nil {
		return nil, uuid.Nil, ErrForbidden
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, t.ID, err
	}
	fail := func(e error) (pgx.Tx, uuid.UUID, error) { _ = tx.Rollback(ctx); return nil, t.ID, e }
	if _, err = tx.Exec(ctx, `SELECT set_config('app.tenant_id',$1,true)`, t.ID.String()); err != nil {
		return fail(err)
	}
	// Serializes pilot mutations and snapshot generation. Can be narrowed to
	// per-course locks after measuring contention; never rely on Redis for truth.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, "attendance-v2:"+t.ID.String()); err != nil {
		return fail(err)
	}
	var active bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE tenant_id=$1 AND id=$2 AND is_active AND is_approved AND deleted_at IS NULL)`, t.ID, actor).Scan(&active)
	if err != nil {
		return fail(err)
	}
	if !active {
		return fail(ErrForbidden)
	}
	return tx, t.ID, nil
}

const teachingRole = `EXISTS(SELECT 1 FROM users teaching_user WHERE teaching_user.tenant_id=$1 AND teaching_user.id=$2 AND (teaching_user.role IN ('lecturer','hod') OR EXISTS(SELECT 1 FROM user_role_assignments teaching_role WHERE teaching_role.tenant_id=$1 AND teaching_role.user_id=$2 AND teaching_role.is_active AND teaching_role.role IN ('lecturer','hod'))))`

func teacher(ctx context.Context, tx pgx.Tx, t, actor, course, semester uuid.UUID) (bool, error) {
	var yes bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM courses c JOIN semesters sm ON sm.tenant_id=c.tenant_id AND sm.id=$4 WHERE c.tenant_id=$1 AND c.id=$3 AND (c.lecturer_id=$2 OR EXISTS(SELECT 1 FROM lecturer_course_assignments a WHERE a.tenant_id=$1 AND a.course_id=c.id AND a.lecturer_id=$2 AND a.session_id=sm.session_id AND a.semester=sm.name::text)) AND `+teachingRole+`)`, t, actor, course, semester).Scan(&yes)
	return yes, err
}
func staff(ctx context.Context, tx pgx.Tx, t, actor uuid.UUID) (bool, error) {
	var yes bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users u WHERE u.tenant_id=$1 AND u.id=$2 AND (u.role='hod' OR EXISTS(SELECT 1 FROM user_role_assignments r WHERE r.tenant_id=$1 AND r.user_id=$2 AND r.role='hod' AND r.is_active) OR ((u.role='admin' OR EXISTS(SELECT 1 FROM user_role_assignments ar WHERE ar.tenant_id=$1 AND ar.user_id=$2 AND ar.role='admin' AND ar.is_active)) AND EXISTS(SELECT 1 FROM admin_permissions p WHERE p.tenant_id=$1 AND p.user_id=$2 AND p.is_active AND (p.expires_at IS NULL OR p.expires_at>now()) AND p.can_manage_courses))))`, t, actor).Scan(&yes)
	return yes, err
}

// Delegation is session-specific and requires a still-active class-rep role.
func delegated(ctx context.Context, tx pgx.Tx, t, actor uuid.UUID, x Session) (bool, error) {
	if x.DelegateID == nil || *x.DelegateID != actor {
		return false, nil
	}
	var yes bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users u WHERE u.tenant_id=$1 AND u.id=$2 AND (u.role='class_rep' OR EXISTS(SELECT 1 FROM user_role_assignments a WHERE a.tenant_id=$1 AND a.user_id=$2 AND a.role='class_rep' AND a.is_active)))`, t, actor).Scan(&yes)
	return yes, err
}
func owns(ctx context.Context, tx pgx.Tx, t, actor uuid.UUID, x Session) (bool, error) {
	return teacher(ctx, tx, t, actor, x.CourseID, x.SemesterID)
}
func load(ctx context.Context, tx pgx.Tx, t, id uuid.UUID) (Session, error) {
	x, err := scan(tx.QueryRow(ctx, `SELECT `+sessionColumns+` FROM attendance_v2_sessions WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, t, id))
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrForbidden
	}
	if err == nil && x.Status == "open" && x.ClosesAt != nil && !time.Now().Before(*x.ClosesAt) {
		_, _ = tx.Exec(ctx, `UPDATE attendance_v2_sessions SET status='closed' WHERE tenant_id=$1 AND id=$2`, t, id)
		x.Status = "closed"
	}
	return x, err
}
func audit(ctx context.Context, tx pgx.Tx, t, id, actor uuid.UUID, action string, data any) error {
	b, err := json.Marshal(data)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO attendance_v2_events(tenant_id,session_id,actor_id,action,evidence)VALUES($1,$2,$3,$4,$5)`, t, id, actor, action, b)
	return err
}
func jsonRows(ctx context.Context, tx pgx.Tx, q string, args ...any) (json.RawMessage, error) {
	var b []byte
	err := tx.QueryRow(ctx, q, args...).Scan(&b)
	return json.RawMessage(b), err
}
func (s *Service) Create(ctx context.Context, actor uuid.UUID, r CreateRequest) (Session, error) {
	var empty Session
	r.Title = strings.TrimSpace(r.Title)
	r.Venue = strings.TrimSpace(r.Venue)
	if r.CourseID == uuid.Nil || r.SemesterID == uuid.Nil || len(r.Title) < 1 || len(r.Title) > 200 || len(r.Venue) < 1 || len(r.Venue) > 200 || r.Duration < 1 || r.Duration > 180 || r.Radius < 20 || r.Radius > 1000 || r.ScheduledAt.IsZero() || (r.Latitude == nil) != (r.Longitude == nil) {
		return empty, ErrInvalid
	}
	if r.Latitude != nil && !validCoordinates(*r.Latitude, *r.Longitude) {
		return empty, ErrInvalid
	}
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return empty, err
	}
	defer tx.Rollback(ctx)
	yes, err := teacher(ctx, tx, t, actor, r.CourseID, r.SemesterID)
	if err != nil {
		return empty, err
	}
	if !yes {
		return empty, ErrForbidden
	}
	var valid bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM semesters sm JOIN courses c ON c.tenant_id=sm.tenant_id AND c.id=$4 WHERE sm.tenant_id=$1 AND sm.id=$2 AND sm.is_active AND c.is_active AND $3::timestamptz BETWEEN sm.start_date AND sm.end_date)`, t, r.SemesterID, r.ScheduledAt, r.CourseID).Scan(&valid)
	if err != nil {
		return empty, err
	}
	if !valid {
		return empty, ErrInvalid
	}
	secret := make([]byte, 32)
	if _, err = rand.Read(secret); err != nil {
		return empty, err
	}
	x, err := scan(tx.QueryRow(ctx, `INSERT INTO attendance_v2_sessions(tenant_id,course_id,semester_id,lecturer_id,title,venue,scheduled_at,duration_minutes,latitude,longitude,radius_m,secret)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING `+sessionColumns, t, r.CourseID, r.SemesterID, actor, r.Title, r.Venue, r.ScheduledAt, r.Duration, r.Latitude, r.Longitude, r.Radius, hex.EncodeToString(secret)))
	if err != nil {
		return empty, err
	}
	if err = audit(ctx, tx, t, x.ID, actor, "created", r); err != nil {
		return empty, err
	}
	return x, tx.Commit(ctx)
}

type ActionRequest struct {
	DelegateID *uuid.UUID `json:"delegateId"`
	Reason     string     `json:"reason"`
	Held       bool       `json:"held"`
}

func (s *Service) Act(ctx context.Context, actor, id uuid.UUID, action string, r ActionRequest) (Session, error) {
	var empty Session
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return empty, err
	}
	defer tx.Rollback(ctx)
	x, err := load(ctx, tx, t, id)
	if err != nil {
		return empty, err
	}
	isTeacher, err := owns(ctx, tx, t, actor, x)
	if err != nil {
		return empty, err
	}
	delegate, err := delegated(ctx, tx, t, actor, x)
	if err != nil {
		return empty, err
	}
	if !isTeacher && !(delegate && (action == "open" || action == "close")) {
		return empty, ErrForbidden
	}
	switch action {
	case "delegate":
		if x.Status != "draft" {
			return empty, ErrConflict
		}
		if r.DelegateID != nil {
			var valid bool
			err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users u JOIN students st ON st.tenant_id=u.tenant_id AND st.user_id=u.id JOIN courses c ON c.tenant_id=u.tenant_id AND c.id=$3 WHERE u.tenant_id=$1 AND u.id=$2 AND u.is_active AND u.is_approved AND u.deleted_at IS NULL AND st.level=c.level AND (u.role='class_rep' OR EXISTS(SELECT 1 FROM user_role_assignments a WHERE a.tenant_id=$1 AND a.user_id=u.id AND a.role='class_rep' AND a.is_active)))`, t, *r.DelegateID, x.CourseID).Scan(&valid)
			if err != nil {
				return empty, err
			}
			if !valid {
				return empty, ErrForbidden
			}
		}
		_, err = tx.Exec(ctx, `UPDATE attendance_v2_sessions SET delegate_id=$3 WHERE tenant_id=$1 AND id=$2`, t, id, r.DelegateID)
	case "open":
		if x.Status != "draft" {
			return empty, ErrConflict
		}
		if time.Now().Before(x.ScheduledAt.Add(-30*time.Minute)) || time.Now().After(x.ScheduledAt.Add(3*time.Hour)) {
			return empty, errors.New("cannot open session: check-in can only be opened between 30 minutes before and 3 hours after scheduled start time")
		}
		// Auto-close any expired open sessions for this course and semester first
		_, _ = tx.Exec(ctx, `UPDATE attendance_v2_sessions SET status='closed' WHERE tenant_id=$1 AND course_id=$2 AND semester_id=$3 AND status='open' AND closes_at IS NOT NULL AND closes_at <= now()`, t, x.CourseID, x.SemesterID)

		var another bool
		err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM attendance_v2_sessions WHERE tenant_id=$1 AND course_id=$2 AND semester_id=$3 AND status='open')`, t, x.CourseID, x.SemesterID).Scan(&another)
		if err != nil {
			return empty, err
		}
		if another {
			return empty, errors.New("cannot open session: another session is currently open for this course")
		}
		// Auto-approve any pending submitted course registrations for this semester
		_, _ = tx.Exec(ctx, `UPDATE course_registrations SET status='approved', approved_at=COALESCE(approved_at, now()) WHERE tenant_id=$1 AND semester_id=$2 AND status='submitted'`, t, x.SemesterID)

		_, err = tx.Exec(ctx, `INSERT INTO attendance_v2_records(tenant_id,session_id,user_id) SELECT DISTINCT $1::uuid,$2::uuid,s.user_id FROM registered_courses rc JOIN course_registrations cr ON cr.tenant_id=rc.tenant_id AND cr.id=rc.registration_id JOIN students s ON s.tenant_id=cr.tenant_id AND s.id=cr.student_id WHERE rc.tenant_id=$1 AND rc.course_id=$3 AND cr.semester_id=$4 AND cr.status='approved' AND rc.status='enrolled'`, t, id, x.CourseID, x.SemesterID)
		if err != nil {
			return empty, err
		}
		var count int
		err = tx.QueryRow(ctx, `SELECT count(*) FROM attendance_v2_records WHERE tenant_id=$1 AND session_id=$2`, t, id).Scan(&count)
		if err != nil {
			return empty, err
		}
		if count == 0 {
			return empty, errors.New("cannot open session: no approved enrolled students found for this course in this semester")
		}
		_, err = tx.Exec(ctx, `UPDATE attendance_v2_sessions SET status='open',opened_at=now(),closes_at=now()+duration_minutes*interval '1 minute' WHERE tenant_id=$1 AND id=$2`, t, id)
	case "close":
		if x.Status != "open" {
			return empty, ErrConflict
		}
		_, err = tx.Exec(ctx, `UPDATE attendance_v2_sessions SET status='closed' WHERE tenant_id=$1 AND id=$2`, t, id)
	case "finalize":
		if x.Status != "closed" || !r.Held {
			return empty, ErrConflict
		}
		var unresolved bool
		err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM attendance_v2_records WHERE tenant_id=$1 AND session_id=$2 AND verification='flagged') OR EXISTS(SELECT 1 FROM attendance_v2_disputes WHERE tenant_id=$1 AND session_id=$2 AND status='open')`, t, id).Scan(&unresolved)
		if err != nil {
			return empty, err
		}
		if unresolved {
			return empty, ErrConflict
		}
		_, err = tx.Exec(ctx, `UPDATE attendance_v2_sessions SET status='finalized',finalized_at=now() WHERE tenant_id=$1 AND id=$2`, t, id)
	case "cancel":
		if x.Status == "cancelled" || len(strings.TrimSpace(r.Reason)) < 5 || len(r.Reason) > 2000 {
			return empty, ErrInvalid
		}
		_, err = tx.Exec(ctx, `UPDATE attendance_v2_sessions SET status='cancelled',revision=revision+1 WHERE tenant_id=$1 AND id=$2`, t, id)
	default:
		return empty, ErrInvalid
	}
	if err != nil {
		return empty, err
	}
	if err = audit(ctx, tx, t, id, actor, action, r); err != nil {
		return empty, err
	}
	x, err = load(ctx, tx, t, id)
	if err != nil {
		return empty, err
	}
	return x, tx.Commit(ctx)
}
