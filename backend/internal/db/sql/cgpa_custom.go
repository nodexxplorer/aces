package db

import (
	"context"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// StudentResultDetail is a student's approved result enriched with course
// details, used to seed the CGPA what-if simulator with the student's real
// academic record.
type StudentResultDetail struct {
	CourseID   uuid.UUID       `json:"course_id"`
	CourseCode string          `json:"course_code"`
	CourseTitle string         `json:"course_title"`
	Unit       int32           `json:"unit"`
	Score      decimal.Decimal `json:"score"`
	Grade      string          `json:"grade"`
	GradePoint decimal.Decimal `json:"grade_point"`
}

func (q *Queries) GetStudentApprovedResultsDetailed(ctx context.Context, studentID uuid.UUID) ([]StudentResultDetail, error) {
	rows, err := q.db.Query(ctx, `
		SELECT c.id, c.code, c.title, c.unit, r.total_score, r.grade, r.grade_point
		FROM results r
		JOIN courses c ON c.id = r.course_id
		WHERE r.student_id = $1 AND r.status = 'approved'
		ORDER BY c.code
	`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []StudentResultDetail{}
	for rows.Next() {
		var d StudentResultDetail
		if err := rows.Scan(&d.CourseID, &d.CourseCode, &d.CourseTitle, &d.Unit, &d.Score, &d.Grade, &d.GradePoint); err != nil {
			return nil, err
		}
		items = append(items, d)
	}
	return items, rows.Err()
}
