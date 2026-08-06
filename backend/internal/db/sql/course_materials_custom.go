package db

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type CourseMaterial struct {
	ID            uuid.UUID          `json:"id"`
	CourseID      uuid.UUID          `json:"course_id"`
	UploadedBy    uuid.UUID          `json:"uploaded_by"`
	SessionID     pgtype.UUID        `json:"session_id"`
	Title         string             `json:"title"`
	Description   *string            `json:"description"`
	MaterialType  string             `json:"material_type"`
	FileUrl       string             `json:"file_url"`
	FileName      string             `json:"file_name"`
	FileSize      int32              `json:"file_size"`
	DownloadCount int32              `json:"download_count"`
	IsActive      bool               `json:"is_active"`
	CreatedAt     pgtype.Timestamptz `json:"created_at"`
	UpdatedAt     pgtype.Timestamptz `json:"updated_at"`
}

// CourseMaterialWithCourse joins in course code/title for list views.
type CourseMaterialWithCourse struct {
	CourseMaterial
	CourseCode      string `json:"course_code"`
	CourseTitle     string `json:"course_title"`
	UploaderName    string `json:"uploader_name"`
}

type CreateCourseMaterialParams struct {
	CourseID     uuid.UUID
	UploadedBy   uuid.UUID
	SessionID    pgtype.UUID
	Title        string
	Description  *string
	MaterialType string
	FileUrl      string
	FileName     string
	FileSize     int32
}

func (q *Queries) CreateCourseMaterial(ctx context.Context, arg CreateCourseMaterialParams) (CourseMaterial, error) {
	var m CourseMaterial
	err := q.db.QueryRow(ctx, `
		INSERT INTO course_materials (course_id, uploaded_by, session_id, title, description, material_type, file_url, file_name, file_size)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, course_id, uploaded_by, session_id, title, description, material_type, file_url, file_name, file_size, download_count, is_active, created_at, updated_at
	`, arg.CourseID, arg.UploadedBy, arg.SessionID, arg.Title, arg.Description, arg.MaterialType, arg.FileUrl, arg.FileName, arg.FileSize).Scan(
		&m.ID, &m.CourseID, &m.UploadedBy, &m.SessionID, &m.Title, &m.Description, &m.MaterialType,
		&m.FileUrl, &m.FileName, &m.FileSize, &m.DownloadCount, &m.IsActive, &m.CreatedAt, &m.UpdatedAt,
	)
	return m, err
}

func (q *Queries) GetCourseMaterial(ctx context.Context, id uuid.UUID) (CourseMaterial, error) {
	var m CourseMaterial
	err := q.db.QueryRow(ctx, `
		SELECT id, course_id, uploaded_by, session_id, title, description, material_type, file_url, file_name, file_size, download_count, is_active, created_at, updated_at
		FROM course_materials WHERE id = $1
	`, id).Scan(
		&m.ID, &m.CourseID, &m.UploadedBy, &m.SessionID, &m.Title, &m.Description, &m.MaterialType,
		&m.FileUrl, &m.FileName, &m.FileSize, &m.DownloadCount, &m.IsActive, &m.CreatedAt, &m.UpdatedAt,
	)
	return m, err
}

func (q *Queries) ListCourseMaterialsByCourse(ctx context.Context, courseID uuid.UUID) ([]CourseMaterialWithCourse, error) {
	rows, err := q.db.Query(ctx, `
		SELECT cm.id, cm.course_id, cm.uploaded_by, cm.session_id, cm.title, cm.description, cm.material_type,
		       cm.file_url, cm.file_name, cm.file_size, cm.download_count, cm.is_active, cm.created_at, cm.updated_at,
		       c.code, c.title, u.full_name
		FROM course_materials cm
		JOIN courses c ON c.id = cm.course_id
		JOIN users u ON u.id = cm.uploaded_by
		WHERE cm.course_id = $1 AND cm.is_active = true
		ORDER BY cm.created_at DESC
	`, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []CourseMaterialWithCourse{}
	for rows.Next() {
		var m CourseMaterialWithCourse
		if err := rows.Scan(
			&m.ID, &m.CourseID, &m.UploadedBy, &m.SessionID, &m.Title, &m.Description, &m.MaterialType,
			&m.FileUrl, &m.FileName, &m.FileSize, &m.DownloadCount, &m.IsActive, &m.CreatedAt, &m.UpdatedAt,
			&m.CourseCode, &m.CourseTitle, &m.UploaderName,
		); err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	return items, rows.Err()
}

func (q *Queries) ListCourseMaterialsByLecturer(ctx context.Context, lecturerID uuid.UUID) ([]CourseMaterialWithCourse, error) {
	rows, err := q.db.Query(ctx, `
		SELECT cm.id, cm.course_id, cm.uploaded_by, cm.session_id, cm.title, cm.description, cm.material_type,
		       cm.file_url, cm.file_name, cm.file_size, cm.download_count, cm.is_active, cm.created_at, cm.updated_at,
		       c.code, c.title, u.full_name
		FROM course_materials cm
		JOIN courses c ON c.id = cm.course_id
		JOIN users u ON u.id = cm.uploaded_by
		WHERE cm.uploaded_by = $1 AND cm.is_active = true
		ORDER BY cm.created_at DESC
	`, lecturerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []CourseMaterialWithCourse{}
	for rows.Next() {
		var m CourseMaterialWithCourse
		if err := rows.Scan(
			&m.ID, &m.CourseID, &m.UploadedBy, &m.SessionID, &m.Title, &m.Description, &m.MaterialType,
			&m.FileUrl, &m.FileName, &m.FileSize, &m.DownloadCount, &m.IsActive, &m.CreatedAt, &m.UpdatedAt,
			&m.CourseCode, &m.CourseTitle, &m.UploaderName,
		); err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	return items, rows.Err()
}

func (q *Queries) DeleteCourseMaterial(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, `UPDATE course_materials SET is_active = false, updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (q *Queries) IncrementCourseMaterialDownloadCount(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, `UPDATE course_materials SET download_count = download_count + 1 WHERE id = $1`, id)
	return err
}

// IsLecturerOrPrimaryForCourse checks both the many-to-many
// lecturer_course_assignments table and the course's primary lecturer_id,
// since a lecturer can be tied to a course either way.
func (q *Queries) IsLecturerOrPrimaryForCourse(ctx context.Context, lecturerID, courseID uuid.UUID) (bool, error) {
	var exists bool
	err := q.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM courses WHERE id = $2 AND lecturer_id = $1
			UNION
			SELECT 1 FROM lecturer_course_assignments WHERE course_id = $2 AND lecturer_id = $1
		)
	`, lecturerID, courseID).Scan(&exists)
	return exists, err
}
