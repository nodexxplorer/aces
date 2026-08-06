package db

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// CarryoverCourseDetailed enriches a carryover row with course and session
// names so a student-facing list doesn't need N follow-up lookups.
type CarryoverCourseDetailed struct {
	ID                uuid.UUID          `json:"id"`
	StudentID         uuid.UUID          `json:"student_id"`
	CourseID          uuid.UUID          `json:"course_id"`
	CourseCode        string             `json:"course_code"`
	CourseTitle       string             `json:"course_title"`
	Unit              int32              `json:"unit"`
	OriginalSessionID uuid.UUID          `json:"original_session_id"`
	OriginalSessionName string           `json:"original_session_name"`
	AttemptCount      int32              `json:"attempt_count"`
	MaxAttempts       int32              `json:"max_attempts"`
	IsResolved        bool               `json:"is_resolved"`
	ResolvedResultID  pgtype.UUID        `json:"resolved_result_id"`
	CreatedAt         pgtype.Timestamptz `json:"created_at"`
}

func (q *Queries) ListStudentCarryoverCoursesDetailed(ctx context.Context, studentID uuid.UUID) ([]CarryoverCourseDetailed, error) {
	rows, err := q.db.Query(ctx, `
		SELECT cc.id, cc.student_id, cc.course_id, c.code, c.title, c.unit,
		       cc.original_session_id, s.name, cc.attempt_count, cc.max_attempts,
		       cc.is_resolved, cc.resolved_result_id, cc.created_at
		FROM carryover_courses cc
		JOIN courses c ON c.id = cc.course_id
		JOIN sessions s ON s.id = cc.original_session_id
		WHERE cc.student_id = $1
		ORDER BY cc.is_resolved ASC, cc.created_at DESC
	`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []CarryoverCourseDetailed{}
	for rows.Next() {
		var c CarryoverCourseDetailed
		if err := rows.Scan(
			&c.ID, &c.StudentID, &c.CourseID, &c.CourseCode, &c.CourseTitle, &c.Unit,
			&c.OriginalSessionID, &c.OriginalSessionName, &c.AttemptCount, &c.MaxAttempts,
			&c.IsResolved, &c.ResolvedResultID, &c.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}
