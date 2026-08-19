package db

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// ─── Models ─────────────────────────────────────────────────────────────────

type NotificationFull struct {
	ID          uuid.UUID          `json:"id"`
	UserID      uuid.UUID          `json:"user_id"`
	Type        NotificationType   `json:"type"`
	Title       string             `json:"title"`
	Message     string             `json:"message"`
	IsRead      bool               `json:"is_read"`
	ActionUrl   *string            `json:"action_url"`
	EmailSent   bool               `json:"email_sent"`
	CreatedAt   pgtype.Timestamptz `json:"created_at"`
	Category    string             `json:"category"`
	Priority    string             `json:"priority"`
	SenderID    pgtype.UUID        `json:"sender_id"`
	EntityType  *string            `json:"entity_type"`
	EntityID    pgtype.UUID        `json:"entity_id"`
	ActionLabel *string            `json:"action_label"`
	ImageURL    *string            `json:"image_url"`
	Metadata    json.RawMessage    `json:"metadata"`
	ExpiresAt   pgtype.Timestamptz `json:"expires_at"`
}

type CategoryCount struct {
	Category string `json:"category"`
	Count    int    `json:"count"`
}

type NotificationPreference struct {
	ID             uuid.UUID          `json:"id"`
	UserID         uuid.UUID          `json:"user_id"`
	EmailEnabled   bool               `json:"email_enabled"`
	PushEnabled    bool               `json:"push_enabled"`
	InAppEnabled   bool               `json:"in_app_enabled"`
	EmailAuth      bool               `json:"email_auth"`
	EmailResults   bool               `json:"email_results"`
	EmailDues      bool               `json:"email_dues"`
	EmailMessages  bool               `json:"email_messages"`
	EmailConnect   bool               `json:"email_connect"`
	EmailSkills    bool               `json:"email_skills"`
	EmailAlumni    bool               `json:"email_alumni"`
	EmailSystem    bool               `json:"email_system"`
	PushAuth       bool               `json:"push_auth"`
	PushResults    bool               `json:"push_results"`
	PushDues       bool               `json:"push_dues"`
	PushMessages   bool               `json:"push_messages"`
	PushConnect    bool               `json:"push_connect"`
	PushSkills     bool               `json:"push_skills"`
	PushAlumni     bool               `json:"push_alumni"`
	PushSystem     bool               `json:"push_system"`
	QuietHoursStart *string           `json:"quiet_hours_start"`
	QuietHoursEnd   *string           `json:"quiet_hours_end"`
	PushToken      *string            `json:"-"`
	WebPushSubscription *string       `json:"-"`
	UpdatedAt      pgtype.Timestamptz `json:"updated_at"`
}

type CreateNotificationFullParams struct {
	UserID      uuid.UUID
	Type        string
	Title       string
	Message     string
	ActionURL   *string
	EmailSent   bool
	Category    string
	Priority    string
	SenderID    *uuid.UUID
	EntityType  *string
	EntityID    *uuid.UUID
	ActionLabel *string
	ImageURL    *string
	Metadata    map[string]interface{}
	ExpiresAt   *time.Time
}

type UpsertNotificationPreferencesParams struct {
	UserID         uuid.UUID
	EmailEnabled   *bool
	PushEnabled    *bool
	InAppEnabled   *bool
	EmailAuth      *bool
	EmailResults   *bool
	EmailDues      *bool
	EmailMessages  *bool
	EmailConnect   *bool
	EmailSkills    *bool
	EmailAlumni    *bool
	EmailSystem    *bool
	PushAuth       *bool
	PushResults    *bool
	PushDues       *bool
	PushMessages   *bool
	PushConnect    *bool
	PushSkills     *bool
	PushAlumni     *bool
	PushSystem     *bool
	QuietHoursStart *string
	QuietHoursEnd   *string
}

// ─── Full column list used in SELECTs ───────────────────────────────────────

const notificationFullColumns = `id, user_id, type, title, message, is_read, action_url, email_sent, created_at,
 category, priority, sender_id, entity_type, entity_id, action_label, image_url, metadata, expires_at`

// ─── Queries ────────────────────────────────────────────────────────────────

func (q *Queries) CreateNotificationFull(ctx context.Context, arg CreateNotificationFullParams) (NotificationFull, error) {
	category := arg.Category
	if category == "" {
		category = "general"
	}
	priority := arg.Priority
	if priority == "" {
		priority = "medium"
	}

	var metadataJSON []byte
	if arg.Metadata != nil {
		var err error
		metadataJSON, err = json.Marshal(arg.Metadata)
		if err != nil {
			return NotificationFull{}, fmt.Errorf("marshal metadata: %w", err)
		}
	} else {
		metadataJSON = []byte(`{}`)
	}

	query := `INSERT INTO notifications (
		user_id, type, title, message, action_url, email_sent,
		category, priority, sender_id, entity_type, entity_id,
		action_label, image_url, metadata, expires_at
	) VALUES (
		$1, $2, $3, $4, $5, $6,
		$7, $8, $9, $10, $11,
		$12, $13, $14, $15
	) RETURNING ` + notificationFullColumns

	var senderID pgtype.UUID
	if arg.SenderID != nil {
		senderID = pgtype.UUID{Bytes: *arg.SenderID, Valid: true}
	}

	var entityID pgtype.UUID
	if arg.EntityID != nil {
		entityID = pgtype.UUID{Bytes: *arg.EntityID, Valid: true}
	}

	var expiresAt pgtype.Timestamptz
	if arg.ExpiresAt != nil {
		expiresAt = pgtype.Timestamptz{Time: *arg.ExpiresAt, Valid: true}
	}

	row := q.db.QueryRow(ctx, query,
		arg.UserID, arg.Type, arg.Title, arg.Message, arg.ActionURL, arg.EmailSent,
		category, priority, senderID, arg.EntityType, entityID,
		arg.ActionLabel, arg.ImageURL, metadataJSON, expiresAt,
	)

	var n NotificationFull
	err := row.Scan(
		&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message, &n.IsRead,
		&n.ActionUrl, &n.EmailSent, &n.CreatedAt,
		&n.Category, &n.Priority, &n.SenderID, &n.EntityType, &n.EntityID,
		&n.ActionLabel, &n.ImageURL, &n.Metadata, &n.ExpiresAt,
	)
	return n, err
}

func (q *Queries) GetNotificationFull(ctx context.Context, id uuid.UUID) (NotificationFull, error) {
	query := `SELECT ` + notificationFullColumns + ` FROM notifications WHERE id = $1`

	row := q.db.QueryRow(ctx, query, id)
	var n NotificationFull
	err := row.Scan(
		&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message, &n.IsRead,
		&n.ActionUrl, &n.EmailSent, &n.CreatedAt,
		&n.Category, &n.Priority, &n.SenderID, &n.EntityType, &n.EntityID,
		&n.ActionLabel, &n.ImageURL, &n.Metadata, &n.ExpiresAt,
	)
	return n, err
}

func (q *Queries) ListUserNotificationsFull(ctx context.Context, userID uuid.UUID, category string, status string, limit, offset int32) ([]NotificationFull, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("user_id = $%d", argIdx))
	args = append(args, userID)
	argIdx++

	if category != "" {
		conditions = append(conditions, fmt.Sprintf("category = $%d", argIdx))
		args = append(args, category)
		argIdx++
	}

	switch status {
	case "unread":
		conditions = append(conditions, "is_read = false")
	case "read":
		conditions = append(conditions, "is_read = true")
	}

	conditions = append(conditions, "(expires_at IS NULL OR expires_at > NOW())")

	whereClause := strings.Join(conditions, " AND ")

	query := fmt.Sprintf(
		`SELECT %s FROM notifications WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		notificationFullColumns, whereClause, argIdx, argIdx+1,
	)
	args = append(args, limit, offset)

	rows, err := q.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []NotificationFull
	for rows.Next() {
		var n NotificationFull
		if err := rows.Scan(
			&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message, &n.IsRead,
			&n.ActionUrl, &n.EmailSent, &n.CreatedAt,
			&n.Category, &n.Priority, &n.SenderID, &n.EntityType, &n.EntityID,
			&n.ActionLabel, &n.ImageURL, &n.Metadata, &n.ExpiresAt,
		); err != nil {
			return nil, err
		}
		items = append(items, n)
	}
	return items, rows.Err()
}

func (q *Queries) CountUnreadNotifications(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := q.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false AND (expires_at IS NULL OR expires_at > NOW())`,
		userID,
	).Scan(&count)
	return count, err
}

func (q *Queries) CountUnreadByCategory(ctx context.Context, userID uuid.UUID) ([]CategoryCount, error) {
	rows, err := q.db.Query(ctx,
		`SELECT category, COUNT(*)::int AS count
		 FROM notifications
		 WHERE user_id = $1 AND is_read = false AND (expires_at IS NULL OR expires_at > NOW())
		 GROUP BY category
		 ORDER BY count DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []CategoryCount
	for rows.Next() {
		var c CategoryCount
		if err := rows.Scan(&c.Category, &c.Count); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}

func (q *Queries) MarkNotificationAsReadFull(ctx context.Context, id, userID uuid.UUID) (NotificationFull, error) {
	query := `UPDATE notifications SET is_read = true
		WHERE id = $1 AND user_id = $2
		RETURNING ` + notificationFullColumns

	row := q.db.QueryRow(ctx, query, id, userID)
	var n NotificationFull
	err := row.Scan(
		&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message, &n.IsRead,
		&n.ActionUrl, &n.EmailSent, &n.CreatedAt,
		&n.Category, &n.Priority, &n.SenderID, &n.EntityType, &n.EntityID,
		&n.ActionLabel, &n.ImageURL, &n.Metadata, &n.ExpiresAt,
	)
	return n, err
}

func (q *Queries) MarkAllNotificationsAsRead(ctx context.Context, userID uuid.UUID) error {
	_, err := q.db.Exec(ctx,
		`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
		userID,
	)
	return err
}

func (q *Queries) DeleteNotificationFull(ctx context.Context, id, userID uuid.UUID) error {
	_, err := q.db.Exec(ctx,
		`DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	return err
}

func (q *Queries) DeleteExpiredNotifications(ctx context.Context) error {
	_, err := q.db.Exec(ctx,
		`DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at < NOW()`,
	)
	return err
}

func (q *Queries) GetNotificationPreferences(ctx context.Context, userID uuid.UUID) (NotificationPreference, error) {
	query := `SELECT id, user_id, email_enabled, push_enabled, in_app_enabled,
		email_auth, email_results, email_dues, email_messages, email_connect,
		email_skills, email_alumni, email_system,
		push_auth, push_results, push_dues, push_messages, push_connect,
		push_skills, push_alumni, push_system,
		quiet_hours_start::text, quiet_hours_end::text, push_token, updated_at
		FROM notification_preferences WHERE user_id = $1`

	row := q.db.QueryRow(ctx, query, userID)
	var p NotificationPreference
	err := row.Scan(
		&p.ID, &p.UserID, &p.EmailEnabled, &p.PushEnabled, &p.InAppEnabled,
		&p.EmailAuth, &p.EmailResults, &p.EmailDues, &p.EmailMessages, &p.EmailConnect,
		&p.EmailSkills, &p.EmailAlumni, &p.EmailSystem,
		&p.PushAuth, &p.PushResults, &p.PushDues, &p.PushMessages, &p.PushConnect,
		&p.PushSkills, &p.PushAlumni, &p.PushSystem,
		&p.QuietHoursStart, &p.QuietHoursEnd, &p.PushToken, &p.UpdatedAt,
	)
	return p, err
}

func (q *Queries) SetUserPushToken(ctx context.Context, userID uuid.UUID, token string) (NotificationPreference, error) {
	row := q.db.QueryRow(ctx, `
		INSERT INTO notification_preferences (user_id, push_token)
		VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET push_token = $2, updated_at = NOW()
		RETURNING id, user_id, email_enabled, push_enabled, in_app_enabled,
			email_auth, email_results, email_dues, email_messages, email_connect,
			email_skills, email_alumni, email_system,
			push_auth, push_results, push_dues, push_messages, push_connect,
			push_skills, push_alumni, push_system,
			quiet_hours_start::text, quiet_hours_end::text, push_token, updated_at
	`, userID, token)

	var p NotificationPreference
	err := row.Scan(
		&p.ID, &p.UserID, &p.EmailEnabled, &p.PushEnabled, &p.InAppEnabled,
		&p.EmailAuth, &p.EmailResults, &p.EmailDues, &p.EmailMessages, &p.EmailConnect,
		&p.EmailSkills, &p.EmailAlumni, &p.EmailSystem,
		&p.PushAuth, &p.PushResults, &p.PushDues, &p.PushMessages, &p.PushConnect,
		&p.PushSkills, &p.PushAlumni, &p.PushSystem,
		&p.QuietHoursStart, &p.QuietHoursEnd, &p.PushToken, &p.UpdatedAt,
	)
	return p, err
}

func (q *Queries) UpsertNotificationPreferences(ctx context.Context, arg UpsertNotificationPreferencesParams) (NotificationPreference, error) {
	emailEnabled := true
	if arg.EmailEnabled != nil {
		emailEnabled = *arg.EmailEnabled
	}
	pushEnabled := true
	if arg.PushEnabled != nil {
		pushEnabled = *arg.PushEnabled
	}
	inAppEnabled := true
	if arg.InAppEnabled != nil {
		inAppEnabled = *arg.InAppEnabled
	}
	emailAuth := true
	if arg.EmailAuth != nil {
		emailAuth = *arg.EmailAuth
	}
	emailResults := true
	if arg.EmailResults != nil {
		emailResults = *arg.EmailResults
	}
	emailDues := true
	if arg.EmailDues != nil {
		emailDues = *arg.EmailDues
	}
	emailMessages := true
	if arg.EmailMessages != nil {
		emailMessages = *arg.EmailMessages
	}
	emailConnect := false
	if arg.EmailConnect != nil {
		emailConnect = *arg.EmailConnect
	}
	emailSkills := false
	if arg.EmailSkills != nil {
		emailSkills = *arg.EmailSkills
	}
	emailAlumni := true
	if arg.EmailAlumni != nil {
		emailAlumni = *arg.EmailAlumni
	}
	emailSystem := true
	if arg.EmailSystem != nil {
		emailSystem = *arg.EmailSystem
	}
	pushAuth := true
	if arg.PushAuth != nil {
		pushAuth = *arg.PushAuth
	}
	pushResults := true
	if arg.PushResults != nil {
		pushResults = *arg.PushResults
	}
	pushDues := true
	if arg.PushDues != nil {
		pushDues = *arg.PushDues
	}
	pushMessages := true
	if arg.PushMessages != nil {
		pushMessages = *arg.PushMessages
	}
	pushConnect := true
	if arg.PushConnect != nil {
		pushConnect = *arg.PushConnect
	}
	pushSkills := true
	if arg.PushSkills != nil {
		pushSkills = *arg.PushSkills
	}
	pushAlumni := true
	if arg.PushAlumni != nil {
		pushAlumni = *arg.PushAlumni
	}
	pushSystem := false
	if arg.PushSystem != nil {
		pushSystem = *arg.PushSystem
	}

	query := `INSERT INTO notification_preferences (
		user_id, email_enabled, push_enabled, in_app_enabled,
		email_auth, email_results, email_dues, email_messages, email_connect,
		email_skills, email_alumni, email_system,
		push_auth, push_results, push_dues, push_messages, push_connect,
		push_skills, push_alumni, push_system,
		quiet_hours_start, quiet_hours_end
	) VALUES (
		$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
		$13, $14, $15, $16, $17, $18, $19, $20, $21, $22
	)
	ON CONFLICT (user_id) DO UPDATE SET
		email_enabled = COALESCE(EXCLUDED.email_enabled, notification_preferences.email_enabled),
		push_enabled = COALESCE(EXCLUDED.push_enabled, notification_preferences.push_enabled),
		in_app_enabled = COALESCE(EXCLUDED.in_app_enabled, notification_preferences.in_app_enabled),
		email_auth = COALESCE(EXCLUDED.email_auth, notification_preferences.email_auth),
		email_results = COALESCE(EXCLUDED.email_results, notification_preferences.email_results),
		email_dues = COALESCE(EXCLUDED.email_dues, notification_preferences.email_dues),
		email_messages = COALESCE(EXCLUDED.email_messages, notification_preferences.email_messages),
		email_connect = COALESCE(EXCLUDED.email_connect, notification_preferences.email_connect),
		email_skills = COALESCE(EXCLUDED.email_skills, notification_preferences.email_skills),
		email_alumni = COALESCE(EXCLUDED.email_alumni, notification_preferences.email_alumni),
		email_system = COALESCE(EXCLUDED.email_system, notification_preferences.email_system),
		push_auth = COALESCE(EXCLUDED.push_auth, notification_preferences.push_auth),
		push_results = COALESCE(EXCLUDED.push_results, notification_preferences.push_results),
		push_dues = COALESCE(EXCLUDED.push_dues, notification_preferences.push_dues),
		push_messages = COALESCE(EXCLUDED.push_messages, notification_preferences.push_messages),
		push_connect = COALESCE(EXCLUDED.push_connect, notification_preferences.push_connect),
		push_skills = COALESCE(EXCLUDED.push_skills, notification_preferences.push_skills),
		push_alumni = COALESCE(EXCLUDED.push_alumni, notification_preferences.push_alumni),
		push_system = COALESCE(EXCLUDED.push_system, notification_preferences.push_system),
		quiet_hours_start = COALESCE(EXCLUDED.quiet_hours_start, notification_preferences.quiet_hours_start),
		quiet_hours_end = COALESCE(EXCLUDED.quiet_hours_end, notification_preferences.quiet_hours_end),
		updated_at = NOW()
	RETURNING id, user_id, email_enabled, push_enabled, in_app_enabled,
		email_auth, email_results, email_dues, email_messages, email_connect,
		email_skills, email_alumni, email_system,
		push_auth, push_results, push_dues, push_messages, push_connect,
		push_skills, push_alumni, push_system,
		quiet_hours_start::text, quiet_hours_end::text, push_token, updated_at`

	row := q.db.QueryRow(ctx, query,
		arg.UserID, emailEnabled, pushEnabled, inAppEnabled,
		emailAuth, emailResults, emailDues, emailMessages, emailConnect,
		emailSkills, emailAlumni, emailSystem,
		pushAuth, pushResults, pushDues, pushMessages, pushConnect,
		pushSkills, pushAlumni, pushSystem,
		arg.QuietHoursStart, arg.QuietHoursEnd,
	)

	var p NotificationPreference
	err := row.Scan(
		&p.ID, &p.UserID, &p.EmailEnabled, &p.PushEnabled, &p.InAppEnabled,
		&p.EmailAuth, &p.EmailResults, &p.EmailDues, &p.EmailMessages, &p.EmailConnect,
		&p.EmailSkills, &p.EmailAlumni, &p.EmailSystem,
		&p.PushAuth, &p.PushResults, &p.PushDues, &p.PushMessages, &p.PushConnect,
		&p.PushSkills, &p.PushAlumni, &p.PushSystem,
		&p.QuietHoursStart, &p.QuietHoursEnd, &p.PushToken, &p.UpdatedAt,
	)
	return p, err
}

// ListUsersByRole returns user IDs for a set of roles.
func (q *Queries) ListUsersByRole(ctx context.Context, roles []string) ([]uuid.UUID, error) {
	if len(roles) == 0 {
		return nil, nil
	}
	placeholders := make([]string, len(roles))
	args := make([]interface{}, len(roles))
	for i, r := range roles {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = r
	}
	query := fmt.Sprintf(
		`SELECT id FROM users WHERE role IN (%s) AND deleted_at IS NULL`,
		strings.Join(placeholders, ", "),
	)
	rows, err := q.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// ListStudentUserIDsByLevel returns user IDs for students at a given level.
func (q *Queries) ListStudentUserIDsByLevel(ctx context.Context, level int32) ([]uuid.UUID, error) {
	rows, err := q.db.Query(ctx,
		`SELECT s.user_id FROM students s
		 JOIN users u ON u.id = s.user_id
		 WHERE s.level = $1 AND u.deleted_at IS NULL`,
		level,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// ListAllActiveUserIDs returns IDs of all non-deleted users.
func (q *Queries) ListAllActiveUserIDs(ctx context.Context) ([]uuid.UUID, error) {
	rows, err := q.db.Query(ctx, `SELECT id FROM users WHERE deleted_at IS NULL`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// ListAllStudentUserIDs returns user IDs for every student, regardless of level.
func (q *Queries) ListAllStudentUserIDs(ctx context.Context) ([]uuid.UUID, error) {
	rows, err := q.db.Query(ctx,
		`SELECT s.user_id FROM students s
		 JOIN users u ON u.id = s.user_id
		 WHERE u.deleted_at IS NULL`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// ListAlumniUserIDs returns user IDs for everyone with an alumni status record.
func (q *Queries) ListAlumniUserIDs(ctx context.Context) ([]uuid.UUID, error) {
	rows, err := q.db.Query(ctx,
		`SELECT al.user_id FROM alumni_status al
		 JOIN users u ON u.id = al.user_id
		 WHERE u.deleted_at IS NULL`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}


func (q *Queries) ListLecturerUserIDs(ctx context.Context, departments []string) ([]uuid.UUID, error) {
	query := `SELECT st.user_id FROM staff st
		 JOIN users u ON u.id = st.user_id
		 WHERE u.deleted_at IS NULL AND u.role IN ('lecturer', 'hod')`
	args := []interface{}{}
	if len(departments) > 0 {
		query += ` AND st.department = ANY($1::text[])`
		args = append(args, departments)
	}

	rows, err := q.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}


func (q *Queries) ResolveAnnouncementTargetUserIDs(ctx context.Context, targetAudience []string, targetLevels []int32, targetDepartments []string) ([]uuid.UUID, error) {
	seen := make(map[uuid.UUID]struct{})
	var result []uuid.UUID
	add := func(ids []uuid.UUID) {
		for _, id := range ids {
			if _, ok := seen[id]; !ok {
				seen[id] = struct{}{}
				result = append(result, id)
			}
		}
	}

	levels := map[int32]struct{}{}
	for _, l := range targetLevels {
		levels[l] = struct{}{}
	}

	wantAllStudents := len(targetAudience) == 0
	wantAlumni := false
	wantLecturers := false

	for _, a := range targetAudience {
		switch strings.ToLower(strings.TrimSpace(a)) {
		case "all", "student", "students":
			wantAllStudents = true
		case "alumni":
			wantAlumni = true
		case "lecturer", "lecturers", "staff":
			wantLecturers = true
		default:
			if lvl, err := strconv.Atoi(a); err == nil {
				levels[int32(lvl)] = struct{}{}
			}
		}
	}

	if wantAllStudents {
		ids, err := q.ListAllStudentUserIDs(ctx)
		if err != nil {
			return nil, err
		}
		add(ids)
	} else {
		for lvl := range levels {
			ids, err := q.ListStudentUserIDsByLevel(ctx, lvl)
			if err != nil {
				return nil, err
			}
			add(ids)
		}
	}

	if wantLecturers {
		ids, err := q.ListLecturerUserIDs(ctx, targetDepartments)
		if err != nil {
			return nil, err
		}
		add(ids)
	}

	if wantAlumni {
		ids, err := q.ListAlumniUserIDs(ctx)
		if err != nil {
			return nil, err
		}
		add(ids)
	}

	return result, nil
}
