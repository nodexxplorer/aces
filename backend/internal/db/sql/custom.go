package db

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

// GetDB returns the underlying DBTX database connection/transaction.
func (q *Queries) GetDB() DBTX {
	return q.db
}

// UpdateUserEmailAndRole updates email and role fields of a user.
func (q *Queries) UpdateUserEmailAndRole(ctx context.Context, id uuid.UUID, email string, role UserRole) (User, error) {
	var i User
	err := q.db.QueryRow(ctx, `
		UPDATE users
		SET email = $2, role = $3, updated_at = NOW()
		WHERE id = $1
		RETURNING id, email, password_hash, role, full_name, phone, avatar_url, is_active, email_verified, two_factor_enabled, last_login_at, created_at, updated_at, deleted_at, created_by_hod_id, is_approved, approved_by, approved_at
	`, id, strings.ToLower(strings.TrimSpace(email)), string(role)).Scan(
		&i.ID, &i.Email, &i.PasswordHash, &i.Role, &i.FullName, &i.Phone, &i.AvatarUrl,
		&i.IsActive, &i.EmailVerified, &i.TwoFactorEnabled, &i.LastLoginAt,
		&i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.CreatedByHodID,
		&i.IsApproved, &i.ApprovedBy, &i.ApprovedAt,
	)
	return i, err
}

// UpdateStudentOnboardingFields updates additional student onboarding fields.
func (q *Queries) UpdateStudentOnboardingFields(ctx context.Context, userID uuid.UUID, matricNumber, level, admissionMode, yearAdmitted, dateOfBirth, emergencyContactName, emergencyContactPhone, homeAddress *string, profilePhotoURL *string) error {
	_, err := q.db.Exec(ctx, `
		UPDATE students
		SET
			matric_number = COALESCE($2, matric_number),
			level = COALESCE($3::int, level),
			admission_mode = COALESCE($4, admission_mode),
			year_admitted = COALESCE($5::int, year_admitted),
			onboarding_completed = true
		WHERE user_id = $1
	`, userID,
		derefStr(matricNumber),
		derefStr(level),
		derefStr(admissionMode),
		derefStr(yearAdmitted),
	)
	return err
}

func derefStr(s *string) interface{} {
	if s == nil {
		return nil
	}
	v := strings.TrimSpace(*s)
	if v == "" {
		return nil
	}
	return v
}

// UpdateUserPhoneAvatarBio updates phone, avatar_url fields for user.
func (q *Queries) UpdateUserPhoneAvatarBio(ctx context.Context, id uuid.UUID, phone, avatarURL, bio *string) (User, error) {
	var i User
	err := q.db.QueryRow(ctx, `
		UPDATE users
		SET
			phone = COALESCE($2, phone),
			avatar_url = COALESCE($3, avatar_url),
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, email, password_hash, role, full_name, phone, avatar_url, is_active, email_verified, two_factor_enabled, last_login_at, created_at, updated_at, deleted_at, created_by_hod_id, is_approved, approved_by, approved_at
	`, id, phone, avatarURL).Scan(
		&i.ID, &i.Email, &i.PasswordHash, &i.Role, &i.FullName, &i.Phone, &i.AvatarUrl,
		&i.IsActive, &i.EmailVerified, &i.TwoFactorEnabled, &i.LastLoginAt,
		&i.CreatedAt, &i.UpdatedAt, &i.DeletedAt, &i.CreatedByHodID,
		&i.IsApproved, &i.ApprovedBy, &i.ApprovedAt,
	)
	return i, err
}

// GetStudentByUserID fetches a student record by user_id, returns pgx.ErrNoRows if not found.
func (q *Queries) GetStudentByUserIDFull(ctx context.Context, userID uuid.UUID) (Student, error) {
	var i Student
	err := q.db.QueryRow(ctx, `
		SELECT id, user_id, matric_number, level, entry_year, current_session_id, current_semester,
			cgpa, total_credits_earned, total_credits_required, academic_standing, graduation_status,
			is_defaulter, defaulter_reason, created_at, updated_at, admission_mode, year_admitted, onboarding_completed
		FROM students WHERE user_id = $1
	`, userID).Scan(
		&i.ID, &i.UserID, &i.MatricNumber, &i.Level, &i.EntryYear, &i.CurrentSessionID, &i.CurrentSemester,
		&i.Cgpa, &i.TotalCreditsEarned, &i.TotalCreditsRequired, &i.AcademicStanding, &i.GraduationStatus,
		&i.IsDefaulter, &i.DefaulterReason, &i.CreatedAt, &i.UpdatedAt, &i.AdmissionMode, &i.YearAdmitted, &i.OnboardingCompleted,
	)
	return i, err
}

// UserExtraFields holds the extra profile fields added via migration 000004.
type UserExtraFields struct {
	DateOfBirth          *string
	EmergencyContactName *string
	EmergencyContactPhone *string
	HomeAddress          *string
}

// GetUserExtraFields fetches date_of_birth, emergency_contact_name, emergency_contact_phone, home_address for a user.
func (q *Queries) GetUserExtraFields(ctx context.Context, userID uuid.UUID) (UserExtraFields, error) {
	var f UserExtraFields
	err := q.db.QueryRow(ctx, `
		SELECT date_of_birth::text, emergency_contact_name, emergency_contact_phone, home_address
		FROM users WHERE id = $1
	`, userID).Scan(
		&f.DateOfBirth, &f.EmergencyContactName, &f.EmergencyContactPhone, &f.HomeAddress,
	)
	return f, err
}

// UpdateUserExtraFields updates the extra profile columns on the users table.
func (q *Queries) UpdateUserExtraFields(ctx context.Context, userID uuid.UUID, dateOfBirth, emergencyContactName, emergencyContactPhone, homeAddress *string) error {
	_, err := q.db.Exec(ctx, `
		UPDATE users
		SET
			date_of_birth = COALESCE($2::date, date_of_birth),
			emergency_contact_name = COALESCE($3, emergency_contact_name),
			emergency_contact_phone = COALESCE($4, emergency_contact_phone),
			home_address = COALESCE($5, home_address),
			updated_at = NOW()
		WHERE id = $1
	`, userID,
		derefStr(dateOfBirth),
		derefStr(emergencyContactName),
		derefStr(emergencyContactPhone),
		derefStr(homeAddress),
	)
	return err
}

// UpdateStudentFieldsByAdmin updates student-specific fields by user_id.
func (q *Queries) UpdateStudentFieldsByAdmin(ctx context.Context, userID uuid.UUID, matricNumber, level, admissionMode, yearAdmitted *string) error {
	_, err := q.db.Exec(ctx, `
		UPDATE students
		SET
			matric_number = COALESCE($2, matric_number),
			level = COALESCE($3::int, level),
			admission_mode = COALESCE($4, admission_mode),
			year_admitted = COALESCE($5::int, year_admitted),
			updated_at = NOW()
		WHERE user_id = $1
	`, userID,
		derefStr(matricNumber),
		derefStr(level),
		derefStr(admissionMode),
		derefStr(yearAdmitted),
	)
	return err
}

// UpdateStudentAcademicByHod updates academic fields by student_id with COALESCE.
func (q *Queries) UpdateStudentAcademicByHod(ctx context.Context, studentID uuid.UUID, academicStanding, graduationStatus *string) error {
	_, err := q.db.Exec(ctx, `
		UPDATE students
		SET
			academic_standing = COALESCE($2::academic_standing, academic_standing),
			graduation_status = COALESCE($3, graduation_status),
			updated_at = NOW()
		WHERE id = $1
	`, studentID,
		derefStr(academicStanding),
		derefStr(graduationStatus),
	)
	return err
}

// DeleteUserHard permanently deletes a user and cascades to related records.
func (q *Queries) DeleteUserHard(ctx context.Context, userID uuid.UUID) error {
	_, err := q.db.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
	return err
}

// ListAllResults fetches all results with course code and student name joined.
type ListAllResultsRow struct {
	ID             uuid.UUID  `json:"id"`
	StudentID      uuid.UUID  `json:"student_id"`
	CourseID       uuid.UUID  `json:"course_id"`
	CaScore        string     `json:"ca_score"`
	ExamScore      string     `json:"exam_score"`
	TotalScore     string     `json:"total_score"`
	Grade          string     `json:"grade"`
	GradePoint     float64    `json:"grade_point"`
	Status         string     `json:"status"`
	ApprovedBy     *uuid.UUID `json:"approved_by"`
	RejectionReason *string   `json:"rejection_reason"`
	IsCarryover    bool       `json:"is_carryover"`
	CreatedAt      string     `json:"created_at"`
	CourseCode     string     `json:"courseCode"`
	CourseTitle    string     `json:"courseTitle"`
	StudentName    string     `json:"studentName"`
}

func (q *Queries) ListAllResults(ctx context.Context, limit, offset int32) ([]ListAllResultsRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT r.id, r.student_id, r.course_id,
			r.ca_score::text, r.exam_score::text, r.total_score::text,
			r.grade, r.grade_point, r.status, r.approved_by, r.rejection_reason,
			r.is_carryover, r.created_at::text,
			COALESCE(c.code, '') as course_code,
			COALESCE(c.title, '') as course_title,
			COALESCE(u.full_name, '') as student_name
		FROM results r
		LEFT JOIN courses c ON c.id = r.course_id
		LEFT JOIN students s ON s.id = r.student_id
		LEFT JOIN users u ON u.id = s.user_id
		ORDER BY r.created_at DESC
		LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ListAllResultsRow{}
	for rows.Next() {
		var i ListAllResultsRow
		if err := rows.Scan(
			&i.ID, &i.StudentID, &i.CourseID,
			&i.CaScore, &i.ExamScore, &i.TotalScore,
			&i.Grade, &i.GradePoint, &i.Status, &i.ApprovedBy, &i.RejectionReason,
			&i.IsCarryover, &i.CreatedAt,
			&i.CourseCode, &i.CourseTitle, &i.StudentName,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

// ==================== LIST USERS WITH STUDENT DATA ====================

type UserWithStudent struct {
	ID                  uuid.UUID  `json:"id"`
	Email               string     `json:"email"`
	FullName            string     `json:"fullName"`
	Phone               *string    `json:"phone"`
	AvatarUrl           *string    `json:"avatarUrl"`
	Role                UserRole   `json:"role"`
	IsActive            bool       `json:"isActive"`
	IsApproved          bool       `json:"isApproved"`
	CreatedAt           *string    `json:"createdAt"`
	StudentID           *uuid.UUID `json:"studentId,omitempty"`
	MatricNumber        *string    `json:"matricNumber,omitempty"`
	Level               *int32     `json:"level,omitempty"`
	Cgpa                *float64   `json:"cgpa,omitempty"`
	AcademicStanding    *string    `json:"academicStanding,omitempty"`
	AllRoles            string     `json:"allRoles"`
}

func (q *Queries) ListUsersWithStudents(ctx context.Context, limit, offset int32, roleFilter string, search string) ([]UserWithStudent, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if roleFilter != "" {
		where += fmt.Sprintf(" AND u.role = $%d", argIdx)
		args = append(args, roleFilter)
		argIdx++
	}
	if search != "" {
		where += fmt.Sprintf(" AND (LOWER(u.full_name) LIKE $%d OR LOWER(u.email) LIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+strings.ToLower(search)+"%")
		argIdx++
	}

	// Check if user_role_assignments table exists
	var tableExists bool
	err := q.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'user_role_assignments')`).Scan(&tableExists)
	if err != nil {
		tableExists = false
	}

	rolesSubquery := "u.role::text"
	if tableExists {
		rolesSubquery = `(SELECT COALESCE(string_agg(DISTINCT ura.role::text, ','), u.role::text) FROM user_role_assignments ura WHERE ura.user_id = u.id AND ura.is_active = true)`
	}

	query := fmt.Sprintf(`
		SELECT u.id, u.email, u.full_name, u.phone, u.avatar_url, u.role, u.is_active, u.is_approved, u.created_at::text,
			s.id, s.matric_number, s.level, s.cgpa::text, s.academic_standing::text,
			%s as all_roles
		FROM users u
		LEFT JOIN students s ON s.user_id = u.id
		%s
		ORDER BY u.created_at DESC
		LIMIT $%d OFFSET $%d
	`, rolesSubquery, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := q.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []UserWithStudent{}
	for rows.Next() {
		var i UserWithStudent
		var cgpaStr, academicStandingStr *string
		if err := rows.Scan(
			&i.ID, &i.Email, &i.FullName, &i.Phone, &i.AvatarUrl, &i.Role, &i.IsActive, &i.IsApproved, &i.CreatedAt,
			&i.StudentID, &i.MatricNumber, &i.Level, &cgpaStr, &academicStandingStr, &i.AllRoles,
		); err != nil {
			return nil, err
		}
		if cgpaStr != nil {
			if v, err := strconv.ParseFloat(*cgpaStr, 64); err == nil {
				i.Cgpa = &v
			}
		}
		i.AcademicStanding = academicStandingStr
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

// ==================== TIMETABLE ====================

type TimetableListItem struct {
	ID              uuid.UUID  `json:"id"`
	CourseID        uuid.UUID  `json:"course_id"`
	DayOfWeek       *int32     `json:"day_of_week"`
	StartTime       string     `json:"start_time"`
	EndTime         string     `json:"end_time"`
	Venue           string     `json:"venue"`
	Level           *int32     `json:"level"`
	CourseCode      string     `json:"courseCode"`
	CourseTitle     string     `json:"courseTitle"`
	EntryType       string     `json:"entry_type"`
	ClassType       *string    `json:"class_type"`
	ExamType        *string    `json:"exam_type"`
	LecturerID      *uuid.UUID `json:"lecturer_id"`
	LecturerName    *string    `json:"lecturer_name"`
	Invigilators    *string    `json:"invigilators"`
	IsPublished     bool       `json:"is_published"`
	HasConflict     bool       `json:"has_conflict"`
	ConflictDetails []byte     `json:"conflict_details"`
}

type ListTimetableByTypeParams struct {
	EntryType string
	Level     *int32
}

func (q *Queries) ListTimetableByType(ctx context.Context, arg ListTimetableByTypeParams) ([]TimetableListItem, error) {
	query := `
		SELECT t.id, t.course_id, t.day_of_week,
			t.start_time::text, t.end_time::text, t.venue, t.level,
			COALESCE(c.code, '') as course_code,
			COALESCE(c.title, '') as course_title,
			t.entry_type, t.class_type, t.exam_type, t.lecturer_id,
			(SELECT full_name FROM users WHERE id = t.lecturer_id) as lecturer_name,
			t.invigilators, t.is_published, t.has_conflict, t.conflict_details
		FROM timetable t
		LEFT JOIN courses c ON c.id = t.course_id
		WHERE t.entry_type = $1
	`
	args := []interface{}{arg.EntryType}
	idx := 2
	if arg.Level != nil {
		query += fmt.Sprintf(" AND (t.level IS NULL OR t.level = $%d)", idx)
		args = append(args, *arg.Level)
		idx++
	}
	query += " ORDER BY t.day_of_week NULLS LAST, t.exam_date NULLS LAST, t.start_time"

	rows, err := q.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []TimetableListItem{}
	for rows.Next() {
		var i TimetableListItem
		if err := rows.Scan(
			&i.ID, &i.CourseID, &i.DayOfWeek,
			&i.StartTime, &i.EndTime, &i.Venue, &i.Level,
			&i.CourseCode, &i.CourseTitle,
			&i.EntryType, &i.ClassType, &i.ExamType, &i.LecturerID,
			&i.LecturerName, &i.Invigilators, &i.IsPublished, &i.HasConflict, &i.ConflictDetails,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (q *Queries) ListAllTimetableEntries(ctx context.Context) ([]TimetableListItem, error) {
	rows, err := q.db.Query(ctx, `
		SELECT t.id, t.course_id, t.day_of_week,
			t.start_time::text, t.end_time::text, t.venue, t.level,
			COALESCE(c.code, '') as course_code,
			COALESCE(c.title, '') as course_title,
			t.entry_type, t.class_type, t.exam_type, t.lecturer_id,
			(SELECT full_name FROM users WHERE id = t.lecturer_id) as lecturer_name,
			t.invigilators, t.is_published, t.has_conflict, t.conflict_details
		FROM timetable t
		LEFT JOIN courses c ON c.id = t.course_id
		ORDER BY t.entry_type, t.day_of_week NULLS LAST, t.exam_date NULLS LAST, t.start_time
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []TimetableListItem{}
	for rows.Next() {
		var i TimetableListItem
		if err := rows.Scan(
			&i.ID, &i.CourseID, &i.DayOfWeek,
			&i.StartTime, &i.EndTime, &i.Venue, &i.Level,
			&i.CourseCode, &i.CourseTitle,
			&i.EntryType, &i.ClassType, &i.ExamType, &i.LecturerID,
			&i.LecturerName, &i.Invigilators, &i.IsPublished, &i.HasConflict, &i.ConflictDetails,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (q *Queries) PublishTimetableByType(ctx context.Context, entryType string) error {
	_, err := q.db.Exec(ctx, `UPDATE timetable SET is_published = true, published_at = NOW() WHERE entry_type = $1`, entryType)
	return err
}

func (q *Queries) UnpublishTimetableByType(ctx context.Context, entryType string) error {
	_, err := q.db.Exec(ctx, `UPDATE timetable SET is_published = false, published_at = NULL WHERE entry_type = $1`, entryType)
	return err
}

type TimetableConflictRow struct {
	ID          uuid.UUID `json:"id"`
	CourseCode  string    `json:"course_code"`
	Venue       string    `json:"venue"`
	StartTime   string    `json:"start_time"`
	EndTime     string    `json:"end_time"`
	DayOfWeek   *int32    `json:"day_of_week"`
	Level       *int32    `json:"level"`
	LecturerID  *uuid.UUID `json:"lecturer_id"`
}

func (q *Queries) CheckTimetableConflicts(ctx context.Context, arg ListTimetableByTypeParams) ([]TimetableConflictRow, error) {
	query := `
		SELECT t.id, COALESCE(c.code, '') as course_code, t.venue,
			t.start_time::text, t.end_time::text, t.day_of_week, t.level, t.lecturer_id
		FROM timetable t
		LEFT JOIN courses c ON c.id = t.course_id
		WHERE t.entry_type = $1
	`
	args := []interface{}{arg.EntryType}
	idx := 2
	if arg.Level != nil {
		query += fmt.Sprintf(" AND (t.level IS NULL OR t.level = $%d)", idx)
		args = append(args, *arg.Level)
		idx++
	}
	query += " ORDER BY t.day_of_week, t.start_time"

	rows, err := q.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []TimetableConflictRow{}
	for rows.Next() {
		var i TimetableConflictRow
		if err := rows.Scan(&i.ID, &i.CourseCode, &i.Venue, &i.StartTime, &i.EndTime, &i.DayOfWeek, &i.Level, &i.LecturerID); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

type CreateTimetableEntrySimpleParams struct {
	CourseID    uuid.UUID
	DayOfWeek   int32
	StartTime   string
	EndTime     string
	Venue       string
	Level       int32
	EntryType   string
	ClassType   *string
	ExamType    *string
	LecturerID  *uuid.UUID
	Invigilators *string
}

func (q *Queries) CreateTimetableEntrySimple(ctx context.Context, arg CreateTimetableEntrySimpleParams) (uuid.UUID, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, `
		INSERT INTO timetable (course_id, day_of_week, start_time, end_time, venue, level, exam_date, session_id, semester_id, created_by, entry_type, class_type, exam_type, lecturer_id, invigilators)
		VALUES ($1, $2, ('1970-01-01 ' || $3)::timestamptz, ('1970-01-01 ' || $4)::timestamptz, $5, $6, NOW(), NULL, NULL, NULL, $7, $8, $9, $10, $11)
		RETURNING id
	`, arg.CourseID, arg.DayOfWeek, arg.StartTime, arg.EndTime, arg.Venue, arg.Level, arg.EntryType, arg.ClassType, arg.ExamType, arg.LecturerID, arg.Invigilators).Scan(&id)
	return id, err
}

func (q *Queries) UpdateTimetableEntryFull(ctx context.Context, arg CreateTimetableEntrySimpleParams, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, `
		UPDATE timetable SET
			course_id = $2, day_of_week = $3,
			start_time = ('1970-01-01 ' || $4)::timestamptz,
			end_time = ('1970-01-01 ' || $5)::timestamptz,
			venue = $6, level = $7,
			entry_type = $8, class_type = $9, exam_type = $10,
			lecturer_id = $11, invigilators = $12
		WHERE id = $1
	`, id, arg.CourseID, arg.DayOfWeek, arg.StartTime, arg.EndTime, arg.Venue, arg.Level, arg.EntryType, arg.ClassType, arg.ExamType, arg.LecturerID, arg.Invigilators)
	return err
}

// ==================== BACKUPS ====================

type BackupListItem struct {
	ID        uuid.UUID  `json:"id"`
	FileName  string     `json:"file_name"`
	S3Url     string     `json:"s3_url"`
	SizeMb    *string    `json:"size_mb"`
	Status    string     `json:"status"`
	CreatedBy *uuid.UUID `json:"created_by"`
	CreatedAt string     `json:"created_at"`
}

func (q *Queries) ListBackups(ctx context.Context) ([]BackupListItem, error) {
	rows, err := q.db.Query(ctx, `
		SELECT id, file_name, s3_url, size_mb::text, status::text, created_by, created_at::text
		FROM backups
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []BackupListItem{}
	for rows.Next() {
		var i BackupListItem
		if err := rows.Scan(
			&i.ID, &i.FileName, &i.S3Url, &i.SizeMb, &i.Status, &i.CreatedBy, &i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (q *Queries) CreateBackup(ctx context.Context, fileName, s3URL string, createdBy uuid.UUID) (uuid.UUID, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, `
		INSERT INTO backups (file_name, s3_url, status, created_by)
		VALUES ($1, $2, 'completed', $3)
		RETURNING id
	`, fileName, s3URL, createdBy).Scan(&id)
	return id, err
}

func (q *Queries) GetBackup(ctx context.Context, id uuid.UUID) (BackupListItem, error) {
	var i BackupListItem
	err := q.db.QueryRow(ctx, `
		SELECT id, file_name, s3_url, size_mb::text, status::text, created_by, created_at::text
		FROM backups
		WHERE id = $1
	`, id).Scan(
		&i.ID, &i.FileName, &i.S3Url, &i.SizeMb, &i.Status, &i.CreatedBy, &i.CreatedAt,
	)
	return i, err
}

func (q *Queries) UpdateBackupStatus(ctx context.Context, id uuid.UUID, status string) error {
	_, err := q.db.Exec(ctx, `
		UPDATE backups SET status = $2 WHERE id = $1
	`, id, status)
	return err
}

// ==================== LECTURER MANAGEMENT ====================

type LecturerProfile struct {
	ID               uuid.UUID      `json:"id"`
	UserID           uuid.UUID      `json:"user_id"`
	StaffID          string         `json:"staff_id"`
	Department       string         `json:"department"`
	Title            sql.NullString `json:"title"`
	FirstName        sql.NullString `json:"first_name"`
	LastName         sql.NullString `json:"last_name"`
	FullName         string         `json:"full_name"`
	Email            string         `json:"email"`
	Phone            sql.NullString `json:"phone"`
	AvatarURL        sql.NullString `json:"avatar_url"`
	Rank             sql.NullString `json:"rank"`
	Specialization   sql.NullString `json:"specialization"`
	EmploymentType   sql.NullString `json:"employment_type"`
	EmploymentStatus sql.NullString `json:"employment_status"`
	Qualifications   []byte         `json:"qualifications"`
	Bio              sql.NullString `json:"bio"`
	OfficeLocation   sql.NullString `json:"office_location"`
	OfficeHours      []byte         `json:"office_hours"`
	DateJoined       sql.NullTime   `json:"date_joined"`
	CreatedAt        sql.NullTime   `json:"created_at"`
}

func (q *Queries) ListLecturers(ctx context.Context) ([]LecturerProfile, error) {
	rows, err := q.db.Query(ctx, `
		SELECT s.id, s.user_id, s.staff_id, s.department, s.title, s.first_name, s.last_name,
		       u.full_name, u.email, u.phone, u.avatar_url,
		       s.rank, s.specialization, s.employment_type, s.employment_status,
		       COALESCE(s.qualifications, '[]'::jsonb), s.bio, s.office_location,
		       COALESCE(s.office_hours, '{}'::jsonb), s.date_joined, s.created_at
		FROM staff s
		JOIN users u ON u.id = s.user_id
		WHERE u.role = 'lecturer' AND u.is_active = true AND u.deleted_at IS NULL
		ORDER BY u.full_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []LecturerProfile{}
	for rows.Next() {
		var i LecturerProfile
		if err := rows.Scan(
			&i.ID, &i.UserID, &i.StaffID, &i.Department, &i.Title, &i.FirstName, &i.LastName,
			&i.FullName, &i.Email, &i.Phone, &i.AvatarURL,
			&i.Rank, &i.Specialization, &i.EmploymentType, &i.EmploymentStatus,
			&i.Qualifications, &i.Bio, &i.OfficeLocation,
			&i.OfficeHours, &i.DateJoined, &i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

func (q *Queries) GetLecturerProfileByUserID(ctx context.Context, userID uuid.UUID) (LecturerProfile, error) {
	var i LecturerProfile
	err := q.db.QueryRow(ctx, `
		SELECT s.id, s.user_id, s.staff_id, s.department, s.title, s.first_name, s.last_name,
		       u.full_name, u.email, u.phone, u.avatar_url,
		       s.rank, s.specialization, s.employment_type, s.employment_status,
		       COALESCE(s.qualifications, '[]'::jsonb), s.bio, s.office_location,
		       COALESCE(s.office_hours, '{}'::jsonb), s.date_joined, s.created_at
		FROM staff s
		JOIN users u ON u.id = s.user_id
		WHERE s.user_id = $1
	`, userID).Scan(
		&i.ID, &i.UserID, &i.StaffID, &i.Department, &i.Title, &i.FirstName, &i.LastName,
		&i.FullName, &i.Email, &i.Phone, &i.AvatarURL,
		&i.Rank, &i.Specialization, &i.EmploymentType, &i.EmploymentStatus,
		&i.Qualifications, &i.Bio, &i.OfficeLocation,
		&i.OfficeHours, &i.DateJoined, &i.CreatedAt,
	)
	return i, err
}

type UpdateLecturerProfileParams struct {
	StaffID        string
	Title          *string
	FirstName      *string
	LastName       *string
	Rank           *string
	Specialization *string
	Bio            *string
	OfficeLocation *string
	OfficeHours    *string
}

func (q *Queries) UpdateLecturerProfile(ctx context.Context, userID uuid.UUID, arg UpdateLecturerProfileParams) error {
	_, err := q.db.Exec(ctx, `
		UPDATE staff SET
			title = COALESCE($2, title),
			first_name = COALESCE($3, first_name),
			last_name = COALESCE($4, last_name),
			rank = COALESCE($5, rank),
			specialization = COALESCE($6, specialization),
			bio = COALESCE($7, bio),
			office_location = COALESCE($8, office_location),
			office_hours = COALESCE($9::jsonb, office_hours),
			updated_at = NOW()
		WHERE user_id = $1
	`, userID, arg.Title, arg.FirstName, arg.LastName, arg.Rank, arg.Specialization, arg.Bio, arg.OfficeLocation, arg.OfficeHours)
	return err
}

type LecturerCourseAssignmentRow struct {
	ID           uuid.UUID    `json:"id"`
	LecturerID   uuid.UUID    `json:"lecturer_id"`
	CourseID     uuid.UUID    `json:"course_id"`
	CourseCode   string       `json:"course_code"`
	CourseTitle  string       `json:"course_title"`
	CourseUnit   int32        `json:"course_unit"`
	Level        int32        `json:"level"`
	SessionID    uuid.UUID    `json:"session_id"`
	Semester     string       `json:"semester"`
	IsPrimary    bool         `json:"is_primary"`
	AssignedBy   uuid.UUID    `json:"assigned_by"`
	AssignedByName string     `json:"assigned_by_name"`
	CreatedAt    sql.NullTime `json:"created_at"`
}

func (q *Queries) ListLecturerAssignments(ctx context.Context, lecturerID uuid.UUID) ([]LecturerCourseAssignmentRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT lca.id, lca.lecturer_id, lca.course_id, c.code, c.title, c.unit, c.level,
		       lca.session_id, lca.semester, lca.is_primary, lca.assigned_by,
		       u.full_name, lca.created_at
		FROM lecturer_course_assignments lca
		JOIN courses c ON c.id = lca.course_id
		JOIN users u ON u.id = lca.assigned_by
		WHERE lca.lecturer_id = $1
		ORDER BY c.level, c.code
	`, lecturerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []LecturerCourseAssignmentRow{}
	for rows.Next() {
		var i LecturerCourseAssignmentRow
		if err := rows.Scan(
			&i.ID, &i.LecturerID, &i.CourseID, &i.CourseCode, &i.CourseTitle, &i.CourseUnit, &i.Level,
			&i.SessionID, &i.Semester, &i.IsPrimary, &i.AssignedBy,
			&i.AssignedByName, &i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

type AssignCourseToLecturerParams struct {
	LecturerID uuid.UUID
	CourseID   uuid.UUID
	SessionID  uuid.UUID
	Semester   string
	AssignedBy uuid.UUID
	IsPrimary  bool
}

func (q *Queries) AssignCourseToLecturer(ctx context.Context, arg AssignCourseToLecturerParams) (uuid.UUID, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, `
		INSERT INTO lecturer_course_assignments (lecturer_id, course_id, session_id, semester, assigned_by, is_primary)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (course_id, session_id, semester) DO UPDATE
		SET lecturer_id = EXCLUDED.lecturer_id, is_primary = EXCLUDED.is_primary, assigned_by = EXCLUDED.assigned_by, updated_at = NOW()
		RETURNING id
	`, arg.LecturerID, arg.CourseID, arg.SessionID, arg.Semester, arg.AssignedBy, arg.IsPrimary).Scan(&id)
	return id, err
}

func (q *Queries) RemoveCourseAssignment(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, `DELETE FROM lecturer_course_assignments WHERE id = $1`, id)
	return err
}

func (q *Queries) GetLecturerWorkload(ctx context.Context, lecturerID uuid.UUID, sessionID uuid.UUID) (int32, error) {
	var total int32
	err := q.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(c.unit), 0)::int
		FROM lecturer_course_assignments lca
		JOIN courses c ON c.id = lca.course_id
		WHERE lca.lecturer_id = $1 AND lca.session_id = $2
	`, lecturerID, sessionID).Scan(&total)
	return total, err
}

type CreateLeaveRequestParams struct {
	LecturerID       uuid.UUID
	LeaveType        string
	StartDate        string
	EndDate          string
	Reason           string
	CourseHandover   string
}

type LecturerLeaveRow struct {
	ID             uuid.UUID    `json:"id"`
	LecturerID     uuid.UUID    `json:"lecturer_id"`
	LecturerName   string       `json:"lecturer_name"`
	LeaveType      string       `json:"leave_type"`
	StartDate      string       `json:"start_date"`
	EndDate        string       `json:"end_date"`
	Reason         string       `json:"reason"`
	CourseHandover []byte       `json:"course_handover"`
	Status         string       `json:"status"`
	ApprovedBy     *uuid.UUID   `json:"approved_by"`
	ApprovedAt     sql.NullTime `json:"approved_at"`
	CreatedAt      sql.NullTime `json:"created_at"`
}

func (q *Queries) CreateLeaveRequest(ctx context.Context, arg CreateLeaveRequestParams) (LecturerLeaveRow, error) {
	var i LecturerLeaveRow
	err := q.db.QueryRow(ctx, `
		INSERT INTO lecturer_leave (lecturer_id, leave_type, start_date, end_date, reason, course_handover)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb)
		RETURNING id, lecturer_id, leave_type, start_date, end_date, reason, course_handover, status, approved_by, approved_at, created_at
	`, arg.LecturerID, arg.LeaveType, arg.StartDate, arg.EndDate, arg.Reason, arg.CourseHandover).Scan(
		&i.ID, &i.LecturerID, &i.LeaveType, &i.StartDate, &i.EndDate, &i.Reason, &i.CourseHandover,
		&i.Status, &i.ApprovedBy, &i.ApprovedAt, &i.CreatedAt,
	)
	if err == nil {
		i.LecturerName = ""
	}
	return i, err
}

func (q *Queries) ListLeaveRequests(ctx context.Context, lecturerID uuid.UUID) ([]LecturerLeaveRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT ll.id, ll.lecturer_id, u.full_name, ll.leave_type, ll.start_date::text, ll.end_date::text,
		       ll.reason, COALESCE(ll.course_handover, '{}'::jsonb), ll.status, ll.approved_by, ll.approved_at, ll.created_at
		FROM lecturer_leave ll
		JOIN users u ON u.id = ll.lecturer_id
		WHERE ll.lecturer_id = $1
		ORDER BY ll.created_at DESC
	`, lecturerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []LecturerLeaveRow{}
	for rows.Next() {
		var i LecturerLeaveRow
		if err := rows.Scan(
			&i.ID, &i.LecturerID, &i.LecturerName, &i.LeaveType, &i.StartDate, &i.EndDate,
			&i.Reason, &i.CourseHandover, &i.Status, &i.ApprovedBy, &i.ApprovedAt, &i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

func (q *Queries) ListAllLeaveRequests(ctx context.Context) ([]LecturerLeaveRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT ll.id, ll.lecturer_id, u.full_name, ll.leave_type, ll.start_date::text, ll.end_date::text,
		       ll.reason, COALESCE(ll.course_handover, '{}'::jsonb), ll.status, ll.approved_by, ll.approved_at, ll.created_at
		FROM lecturer_leave ll
		JOIN users u ON u.id = ll.lecturer_id
		ORDER BY ll.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []LecturerLeaveRow{}
	for rows.Next() {
		var i LecturerLeaveRow
		if err := rows.Scan(
			&i.ID, &i.LecturerID, &i.LecturerName, &i.LeaveType, &i.StartDate, &i.EndDate,
			&i.Reason, &i.CourseHandover, &i.Status, &i.ApprovedBy, &i.ApprovedAt, &i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

func (q *Queries) UpdateLeaveStatus(ctx context.Context, id uuid.UUID, status string, approvedBy uuid.UUID) error {
	_, err := q.db.Exec(ctx, `
		UPDATE lecturer_leave
		SET status = $2, approved_by = $3, approved_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE approved_at END, updated_at = NOW()
		WHERE id = $1
	`, id, status, approvedBy)
	return err
}

// ==================== BURSAR DASHBOARD ====================

type BursarDashboardStats struct {
	TotalRevenue         float64 `json:"total_revenue"`
	TotalCollected       float64 `json:"total_collected"`
	TotalOutstanding     float64 `json:"total_outstanding"`
	TodayCollection      float64 `json:"today_collection"`
	TodayTransactions    int     `json:"today_transactions"`
	PendingVerifications int     `json:"pending_verifications"`
	TotalStudents        int     `json:"total_students"`
	FullyPaidStudents    int     `json:"fully_paid_students"`
	UnpaidStudents       int     `json:"unpaid_students"`
}

func (q *Queries) GetBursarDashboardStats(ctx context.Context) (BursarDashboardStats, error) {
	var s BursarDashboardStats

	_ = q.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(d.amount), 0) FROM dues d WHERE d.is_active = true
	`).Scan(&s.TotalRevenue)

	_ = q.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.status = 'completed'
	`).Scan(&s.TotalCollected)

	s.TotalOutstanding = s.TotalRevenue - s.TotalCollected
	if s.TotalOutstanding < 0 {
		s.TotalOutstanding = 0
	}

	_ = q.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(p.amount), 0), COUNT(*)::int
		FROM payments p
		WHERE p.status = 'completed' AND p.created_at::date = CURRENT_DATE
	`).Scan(&s.TodayCollection, &s.TodayTransactions)

	_ = q.db.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM payments WHERE status = 'pending'
	`).Scan(&s.PendingVerifications)

	_ = q.db.QueryRow(ctx, `SELECT COUNT(*)::int FROM students`).Scan(&s.TotalStudents)

	return s, nil
}

type PendingPaymentRow struct {
	ID                 uuid.UUID      `json:"id"`
	StudentID          uuid.UUID      `json:"student_id"`
	StudentName        string         `json:"student_name"`
	MatricNumber       string         `json:"matric_number"`
	Level              int32          `json:"level"`
	DueID              uuid.UUID      `json:"due_id"`
	DueName            string         `json:"due_name"`
	Amount             float64        `json:"amount"`
	PaystackReference  sql.NullString `json:"paystack_reference"`
	PaymentMethod      string         `json:"payment_method"`
	BankReference      sql.NullString `json:"bank_reference"`
	BankName           sql.NullString `json:"bank_name"`
	Status             string         `json:"status"`
	CreatedAt          sql.NullTime   `json:"created_at"`
}

func (q *Queries) ListPendingPayments(ctx context.Context, limit int32) ([]PendingPaymentRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT p.id, p.student_id, u.full_name, s.matric_number, s.level,
		       p.due_id, d.name, p.amount, p.paystack_reference,
		       COALESCE(p.payment_method, 'paystack'), p.bank_reference, p.bank_name,
		       p.status, p.created_at
		FROM payments p
		JOIN students st ON st.id = p.student_id
		JOIN users u ON u.id = st.user_id
		JOIN dues d ON d.id = p.due_id
		JOIN students s ON s.id = p.student_id
		WHERE p.status = 'pending'
		ORDER BY p.created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []PendingPaymentRow{}
	for rows.Next() {
		var i PendingPaymentRow
		if err := rows.Scan(
			&i.ID, &i.StudentID, &i.StudentName, &i.MatricNumber, &i.Level,
			&i.DueID, &i.DueName, &i.Amount, &i.PaystackReference,
			&i.PaymentMethod, &i.BankReference, &i.BankName,
			&i.Status, &i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

type RecentPaymentRow struct {
	ID                 uuid.UUID      `json:"id"`
	StudentName        string         `json:"student_name"`
	MatricNumber       string         `json:"matric_number"`
	DueName            string         `json:"due_name"`
	Amount             float64        `json:"amount"`
	PaystackReference  sql.NullString `json:"paystack_reference"`
	PaymentMethod      string         `json:"payment_method"`
	Status             string         `json:"status"`
	CreatedAt          sql.NullTime   `json:"created_at"`
}

func (q *Queries) ListRecentPayments(ctx context.Context, limit int32) ([]RecentPaymentRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT p.id, u.full_name, s.matric_number, d.name, p.amount,
		       p.paystack_reference, COALESCE(p.payment_method, 'paystack'), p.status, p.created_at
		FROM payments p
		JOIN students st ON st.id = p.student_id
		JOIN users u ON u.id = st.user_id
		JOIN students s ON s.id = p.student_id
		JOIN dues d ON d.id = p.due_id
		ORDER BY p.created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []RecentPaymentRow{}
	for rows.Next() {
		var i RecentPaymentRow
		if err := rows.Scan(
			&i.ID, &i.StudentName, &i.MatricNumber, &i.DueName, &i.Amount,
			&i.PaystackReference, &i.PaymentMethod, &i.Status, &i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

// ─── Universal Subcategories ──────────────────────────────────────────

type SubcategoryItem struct {
	ID           uuid.UUID  `json:"id"`
	Module       string     `json:"module"`
	Name         string     `json:"name"`
	Description  *string    `json:"description"`
	Color        *string    `json:"color"`
	SortOrder    int32      `json:"sort_order"`
	IsActive     bool       `json:"is_active"`
	CreatedAt    sql.NullTime `json:"created_at"`
	UpdatedAt    sql.NullTime `json:"updated_at"`
}

func (q *Queries) ListSubcategories(ctx context.Context, module string) ([]SubcategoryItem, error) {
	var rows_data []SubcategoryItem
	rows, err := q.db.Query(ctx, `
		SELECT id, module::text, name, description, color, sort_order, is_active, created_at, updated_at
		FROM subcategories
		WHERE ($1 = '' OR module::text = $1)
		ORDER BY sort_order, name
	`, module)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var i SubcategoryItem
		if err := rows.Scan(&i.ID, &i.Module, &i.Name, &i.Description, &i.Color, &i.SortOrder, &i.IsActive, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, err
		}
		rows_data = append(rows_data, i)
	}
	return rows_data, rows.Err()
}

func (q *Queries) CreateSubcategory(ctx context.Context, module string, name string, description *string, color *string, sortOrder int32) (uuid.UUID, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, `
		INSERT INTO subcategories (module, name, description, color, sort_order)
		VALUES ($1::subcategory_module, $2, $3, $4, $5)
		RETURNING id
	`, module, name, description, color, sortOrder).Scan(&id)
	return id, err
}

func (q *Queries) UpdateSubcategory(ctx context.Context, id uuid.UUID, name *string, description *string, color *string, sortOrder *int32, isActive *bool) error {
	_, err := q.db.Exec(ctx, `
		UPDATE subcategories SET
			name = COALESCE($2, name),
			description = COALESCE($3, description),
			color = COALESCE($4, color),
			sort_order = COALESCE($5, sort_order),
			is_active = COALESCE($6, is_active),
			updated_at = NOW()
		WHERE id = $1
	`, id, name, description, color, sortOrder, isActive)
	return err
}

func (q *Queries) DeleteSubcategory(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, `DELETE FROM subcategories WHERE id = $1`, id)
	return err
}

func (q *Queries) ReorderSubcategories(ctx context.Context, module string, ids []uuid.UUID) error {
	for idx, id := range ids {
		_, err := q.db.Exec(ctx, `
			UPDATE subcategories SET sort_order = $1, updated_at = NOW()
			WHERE id = $2 AND module::text = $3
		`, int32(idx), id, module)
		if err != nil {
			return err
		}
	}
	return nil
}

// ─── Analytics Aggregation ────────────────────────────────────────────

type AnalyticsEnrollment struct {
	Level string  `json:"level"`
	Count int32   `json:"count"`
}

type AnalyticsRevenue struct {
	Month  string  `json:"month"`
	Amount float64 `json:"amount"`
}

type AnalyticsAttendance struct {
	Date   string  `json:"date"`
	Rate   float64 `json:"rate"`
}

type AnalyticsCGPADistribution struct {
	Range string `json:"range"`
	Count int32  `json:"count"`
}

type AnalyticsOverview struct {
	TotalStudents     int32                  `json:"total_students"`
	TotalCourses      int32                  `json:"total_courses"`
	TotalComplaints   int32                  `json:"total_complaints"`
	OpenComplaints    int32                  `json:"open_complaints"`
	TotalPayments     int32                  `json:"total_payments"`
	TotalRevenue      float64                `json:"total_revenue"`
	PendingPayments   int32                  `json:"pending_payments"`
	TotalResults      int32                  `json:"total_results"`
	TotalBackups      int32                  `json:"total_backups"`
	ActiveUsers       int32                  `json:"active_users"`
	EnrollmentByLevel []AnalyticsEnrollment  `json:"enrollment_by_level"`
	CGPADistribution  []AnalyticsCGPADistribution `json:"cgpa_distribution"`
	ComplaintsByStatus []struct {
		Status string `json:"status"`
		Count  int32  `json:"count"`
	} `json:"complaints_by_status"`
}

func (q *Queries) GetAnalyticsOverview(ctx context.Context) (*AnalyticsOverview, error) {
	var overview AnalyticsOverview

	q.db.QueryRow(ctx, `SELECT COUNT(*) FROM students`).Scan(&overview.TotalStudents)
	q.db.QueryRow(ctx, `SELECT COUNT(*) FROM courses`).Scan(&overview.TotalCourses)
	q.db.QueryRow(ctx, `SELECT COUNT(*) FROM complaints`).Scan(&overview.TotalComplaints)
	q.db.QueryRow(ctx, `SELECT COUNT(*) FROM complaints WHERE status IN ('open','in_review')`).Scan(&overview.OpenComplaints)
	q.db.QueryRow(ctx, `SELECT COUNT(*) FROM payments`).Scan(&overview.TotalPayments)
	q.db.QueryRow(ctx, `SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'verified'`).Scan(&overview.TotalRevenue)
	q.db.QueryRow(ctx, `SELECT COUNT(*) FROM payments WHERE status = 'pending'`).Scan(&overview.PendingPayments)
	q.db.QueryRow(ctx, `SELECT COUNT(*) FROM results`).Scan(&overview.TotalResults)
	q.db.QueryRow(ctx, `SELECT COUNT(*) FROM backups`).Scan(&overview.TotalBackups)
	q.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE is_active = true`).Scan(&overview.ActiveUsers)

	rows, err := q.db.Query(ctx, `
		SELECT COALESCE(level::text, 'Unknown') as level, COUNT(*) as cnt
		FROM students GROUP BY level ORDER BY level
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var e AnalyticsEnrollment
			rows.Scan(&e.Level, &e.Count)
			overview.EnrollmentByLevel = append(overview.EnrollmentByLevel, e)
		}
	}

	rows2, err := q.db.Query(ctx, `
		SELECT CASE
			WHEN cgpa >= 3.5 THEN '3.5-4.0'
			WHEN cgpa >= 3.0 THEN '3.0-3.49'
			WHEN cgpa >= 2.5 THEN '2.5-2.99'
			WHEN cgpa >= 2.0 THEN '2.0-2.49'
			WHEN cgpa >= 1.5 THEN '1.5-1.99'
			WHEN cgpa >= 1.0 THEN '1.0-1.49'
			WHEN cgpa >= 0 THEN '0.0-0.99'
			ELSE 'N/A'
		END as range, COUNT(*) as cnt
		FROM students GROUP BY range ORDER BY range
	`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var d AnalyticsCGPADistribution
			rows2.Scan(&d.Range, &d.Count)
			overview.CGPADistribution = append(overview.CGPADistribution, d)
		}
	}

	rows3, err := q.db.Query(ctx, `
		SELECT status::text, COUNT(*) FROM complaints GROUP BY status
	`)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var s struct {
				Status string `json:"status"`
				Count  int32  `json:"count"`
			}
			rows3.Scan(&s.Status, &s.Count)
			overview.ComplaintsByStatus = append(overview.ComplaintsByStatus, s)
		}
	}

	return &overview, nil
}

func (q *Queries) GetAnalyticsTrend(ctx context.Context, days int32) ([]AnalyticsEnrollment, error) {
	rows, err := q.db.Query(ctx, `
		SELECT COALESCE(level::text, 'Unknown') as level, COUNT(*) as cnt
		FROM students GROUP BY level ORDER BY level
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []AnalyticsEnrollment
	for rows.Next() {
		var e AnalyticsEnrollment
		rows.Scan(&e.Level, &e.Count)
		items = append(items, e)
	}
	return items, nil
}

// ─── Backup Enhancements ──────────────────────────────────────────────

type BackupSummary struct {
	TotalBackups   int32   `json:"total_backups"`
	CompletedCount int32   `json:"completed_count"`
	FailedCount    int32   `json:"failed_count"`
	TotalSizeMB    float64 `json:"total_size_mb"`
}

func (q *Queries) GetBackupSummary(ctx context.Context) (*BackupSummary, error) {
	var s BackupSummary
	q.db.QueryRow(ctx, `
		SELECT COUNT(*),
		       COUNT(*) FILTER (WHERE status = 'completed'),
		       COUNT(*) FILTER (WHERE status = 'failed'),
		       COALESCE(SUM(size_mb), 0)
		FROM backups
	`).Scan(&s.TotalBackups, &s.CompletedCount, &s.FailedCount, &s.TotalSizeMB)
	return &s, nil
}

func (q *Queries) GetBackupByID(ctx context.Context, id uuid.UUID) (*BackupListItem, error) {
	var i BackupListItem
	err := q.db.QueryRow(ctx, `
		SELECT id, file_name, s3_url, COALESCE(size_mb::text, '0'), status::text, created_by, created_at::text
		FROM backups WHERE id = $1
	`, id).Scan(&i.ID, &i.FileName, &i.S3Url, &i.SizeMb, &i.Status, &i.CreatedBy, &i.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &i, nil
}

// ─── Alumni queries ────────────────────────────────────────────────────

type AlumniStatusFull struct {
	ID                   interface{} `json:"id"`
	UserID               interface{} `json:"user_id"`
	GraduationYear       interface{} `json:"graduation_year"`
	GraduationClass      interface{} `json:"graduation_class"`
	VerificationStatus   interface{} `json:"verification_status"`
	VerifiedBy           interface{} `json:"verified_by"`
	VerifiedAt           interface{} `json:"verified_at"`
	IsMentorAvailable    bool        `json:"is_mentor_available"`
	MentorSpecialization interface{} `json:"mentor_specialization"`
	CurrentCompany       interface{} `json:"current_company"`
	CurrentPosition      interface{} `json:"current_position"`
	LinkedInURL          interface{} `json:"linkedin_url"`
	Bio                  interface{} `json:"bio"`
	CreatedAt            interface{} `json:"created_at"`
	UpdatedAt            interface{} `json:"updated_at"`
	Location             interface{} `json:"location"`
	PortfolioURL         interface{} `json:"portfolio_url"`
	PrivacyLevel         interface{} `json:"privacy_level"`
	MentorshipTopics     interface{} `json:"mentorship_topics"`
	Skills               interface{} `json:"skills"`
	WillingToSpeak       interface{} `json:"willing_to_speak"`
	Industry             interface{} `json:"industry"`
	FullName             interface{} `json:"full_name"`
	Email                interface{} `json:"email"`
	AvatarURL            interface{} `json:"avatar_url"`
}

func (q *Queries) GetMyAlumniStatus(ctx context.Context, userID uuid.UUID) (*AlumniStatusFull, error) {
	var s AlumniStatusFull
	err := q.db.QueryRow(ctx, `
		SELECT a.id, a.user_id, a.graduation_year, a.graduation_class, a.verification_status, a.verified_by, a.verified_at,
		       a.is_mentor_available, a.mentor_specialization, a.current_company, a.current_position, a.linkedin_url, a.bio,
		       a.created_at, a.updated_at, a.location, a.portfolio_url, a.privacy_level, a.mentorship_topics, a.skills,
		       a.willing_to_speak, a.industry, COALESCE(u.full_name, ''), COALESCE(u.email, ''), u.avatar_url
		FROM alumni_status a JOIN users u ON u.id = a.user_id
		WHERE a.user_id = $1
	`, userID).Scan(
		&s.ID, &s.UserID, &s.GraduationYear, &s.GraduationClass,
		&s.VerificationStatus, &s.VerifiedBy, &s.VerifiedAt,
		&s.IsMentorAvailable, &s.MentorSpecialization, &s.CurrentCompany,
		&s.CurrentPosition, &s.LinkedInURL, &s.Bio,
		&s.CreatedAt, &s.UpdatedAt, &s.Location, &s.PortfolioURL,
		&s.PrivacyLevel, &s.MentorshipTopics, &s.Skills,
		&s.WillingToSpeak, &s.Industry, &s.FullName, &s.Email, &s.AvatarURL,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

type MentorItem struct {
	ID                   interface{} `json:"id"`
	UserID               interface{} `json:"user_id"`
	GraduationYear       interface{} `json:"graduation_year"`
	GraduationClass      interface{} `json:"graduation_class"`
	IsMentorAvailable    bool        `json:"is_mentor_available"`
	MentorSpecialization interface{} `json:"mentor_specialization"`
	CurrentCompany       interface{} `json:"current_company"`
	CurrentPosition      interface{} `json:"current_position"`
	Bio                  interface{} `json:"bio"`
	FullName             string      `json:"full_name"`
	Email                string      `json:"email"`
	Industry             interface{} `json:"industry"`
	Location             interface{} `json:"location"`
}

func (q *Queries) ListAvailableMentors(ctx context.Context) ([]MentorItem, error) {
	rows, err := q.db.Query(ctx, `
		SELECT a.id, a.user_id, a.graduation_year, a.graduation_class,
		       a.is_mentor_available, a.mentor_specialization, a.current_company, a.current_position, a.bio,
		       COALESCE(u.full_name, ''), COALESCE(u.email, ''), a.industry, a.location
		FROM alumni_status a
		JOIN users u ON u.id = a.user_id
		WHERE a.is_mentor_available = true AND a.verification_status = 'verified'
		ORDER BY a.current_company, u.full_name
		LIMIT 50
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var mentors []MentorItem
	for rows.Next() {
		var m MentorItem
		if err := rows.Scan(&m.ID, &m.UserID, &m.GraduationYear, &m.GraduationClass,
			&m.IsMentorAvailable, &m.MentorSpecialization, &m.CurrentCompany, &m.CurrentPosition, &m.Bio,
			&m.FullName, &m.Email, &m.Industry, &m.Location); err != nil {
			return nil, err
		}
		mentors = append(mentors, m)
	}
	return mentors, nil
}

type MentorshipRequestItem struct {
	ID          interface{} `json:"id"`
	StudentID   interface{} `json:"student_id"`
	MentorID    interface{} `json:"mentor_id"`
	Topic       string      `json:"topic"`
	Status      string      `json:"status"`
	Message     *string     `json:"message"`
	StudentName string      `json:"student_name"`
	CreatedAt   interface{} `json:"created_at"`
}

func (q *Queries) ListMyMentorshipRequests(ctx context.Context, mentorID uuid.UUID) ([]MentorshipRequestItem, error) {
	rows, err := q.db.Query(ctx, `
		SELECT mr.id, mr.student_id, mr.mentor_id, mr.topic, mr.status, mr.message, mr.created_at,
		       COALESCE(u.full_name, '')
		FROM mentorship_requests mr
		JOIN users u ON u.id = mr.student_id
		WHERE mr.mentor_id = $1
		ORDER BY mr.created_at DESC
	`, mentorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []MentorshipRequestItem
	for rows.Next() {
		var i MentorshipRequestItem
		if err := rows.Scan(&i.ID, &i.StudentID, &i.MentorID, &i.Topic, &i.Status, &i.Message, &i.CreatedAt, &i.StudentName); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, nil
}

func (q *Queries) UpdateAlumniProfile(ctx context.Context, userID uuid.UUID, isMentor *bool, specialization *string, company *string, position *string, linkedinURL *string, bio *string) error {
	_, err := q.db.Exec(ctx, `
		UPDATE alumni_status SET
			is_mentor_available = COALESCE($2, is_mentor_available),
			mentor_specialization = COALESCE($3, mentor_specialization),
			current_company = COALESCE($4, current_company),
			current_position = COALESCE($5, current_position),
			linkedin_url = COALESCE($6, linkedin_url),
			bio = COALESCE($7, bio),
			updated_at = NOW()
		WHERE user_id = $1
	`, userID, isMentor, specialization, company, position, linkedinURL, bio)
	return err
}

// ─── Alumni Enhanced Queries ─────────────────────────────────────────

func (q *Queries) UpdateAlumniProfileFull(ctx context.Context, userID uuid.UUID,
	location *string, portfolioURL *string, bio *string, linkedinURL *string,
	isMentor *bool, mentorTopics []byte, skills []byte,
	willingToSpeak *bool, eventInterests []byte, privacyLevel *string,
	industry *string, jobTitle *string, currentCompany *string) error {
	_, err := q.db.Exec(ctx, `
		UPDATE alumni_status SET
			location = COALESCE($2, location),
			portfolio_url = COALESCE($3, portfolio_url),
			bio = COALESCE($4, bio),
			linkedin_url = COALESCE($5, linkedin_url),
			is_mentor_available = COALESCE($6, is_mentor_available),
			mentorship_topics = COALESCE($7, mentorship_topics),
			skills = COALESCE($8, skills),
			willing_to_speak = COALESCE($9, willing_to_speak),
			event_interests = COALESCE($10, event_interests),
			privacy_level = COALESCE($11, privacy_level),
			industry = COALESCE($12, industry),
			job_title = COALESCE($13, job_title),
			current_company = COALESCE($14, current_company),
			updated_at = NOW()
		WHERE user_id = $1
	`, userID, location, portfolioURL, bio, linkedinURL, isMentor,
		mentorTopics, skills, willingToSpeak, eventInterests, privacyLevel,
		industry, jobTitle, currentCompany)
	return err
}
