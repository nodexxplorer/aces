package db

import (
	"context"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type SemesterResultRow struct {
	CourseCode  string          `json:"course_code"`
	CourseTitle string          `json:"course_title"`
	Unit        int32           `json:"unit"`
	TotalScore  decimal.Decimal `json:"total_score"`
	Grade       string          `json:"grade"`
	GradePoint  decimal.Decimal `json:"grade_point"`
}

// ListStudentResultsBySemester returns one semester's approved results with
// course details, for the result-slip PDF.
func (q *Queries) ListStudentResultsBySemester(ctx context.Context, studentID, sessionID, semesterID uuid.UUID) ([]SemesterResultRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT c.code, c.title, c.unit, r.total_score, r.grade, r.grade_point
		FROM results r
		JOIN courses c ON c.id = r.course_id
		WHERE r.student_id = $1 AND r.session_id = $2 AND r.semester_id = $3 AND r.status = 'approved'
		ORDER BY c.code
	`, studentID, sessionID, semesterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []SemesterResultRow{}
	for rows.Next() {
		var r SemesterResultRow
		if err := rows.Scan(&r.CourseCode, &r.CourseTitle, &r.Unit, &r.TotalScore, &r.Grade, &r.GradePoint); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}
