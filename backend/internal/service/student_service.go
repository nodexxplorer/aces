package service

import (
	"context"
	"errors"
	"math"
	"math/big"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
)

type StudentService struct {
	store db.Querier
}

func NewStudentService(store db.Querier) *StudentService {
	return &StudentService{store: store}
}

func (s *StudentService) Create(ctx context.Context, userID uuid.UUID, matricNumber string, level int32) (db.Student, error) {
	return s.store.CreateStudent(ctx, db.CreateStudentParams{
		UserID:       userID,
		MatricNumber: matricNumber,
		Level:        level,
		EntryYear:    int32(time.Now().Year()),
	})
}

func (s *StudentService) GetByID(ctx context.Context, id uuid.UUID) (db.Student, error) {
	return s.store.GetStudent(ctx, id)
}

func (s *StudentService) GetByUserID(ctx context.Context, userID uuid.UUID) (db.Student, error) {
	return s.store.GetStudentByUserId(ctx, userID)
}

func (s *StudentService) GetByMatric(ctx context.Context, matricNumber string) (db.Student, error) {
	return s.store.GetStudentByMatric(ctx, matricNumber)
}

func (s *StudentService) List(ctx context.Context, limit, offset int32) ([]db.Student, error) {
	return s.store.ListStudents(ctx, db.ListStudentsParams{Limit: limit, Offset: offset})
}

type CGPAResult struct {
	StudentID        string  `json:"student_id"`
	CGPA             float64 `json:"cgpa"`
	TotalCreditsEarned int32 `json:"total_credits_earned"`
	AcademicStanding string  `json:"academic_standing"`
}

func (s *StudentService) CalculateCGPA(ctx context.Context, studentID uuid.UUID) (*CGPAResult, error) {
	student, err := s.store.GetStudent(ctx, studentID)
	if err != nil {
		return nil, errors.New("student record not found")
	}

	results, err := s.store.GetStudentApprovedResultsWithUnits(ctx, studentID)
	if err != nil {
		return nil, errors.New("failed to fetch student results: " + err.Error())
	}

	var totalGradePoints float64
	var totalUnits int32

	for _, res := range results {
		var gpVal float64
		if res.GradePoint.Valid {
			f, err := res.GradePoint.Float64Value()
			if err == nil {
				gpVal = f.Float64
			}
		}
		totalGradePoints += gpVal * float64(res.Unit)
		totalUnits += res.Unit
	}

	cgpaVal := 0.0
	if totalUnits > 0 {
		cgpaVal = totalGradePoints / float64(totalUnits)
		cgpaVal = math.Round(cgpaVal*100) / 100
	}

	standingRules, err := s.store.GetAcademicStandingRules(ctx)
	standing := "good_standing"
	if err == nil {
		for _, rule := range standingRules {
			minVal, _ := rule.MinCgpa.Float64()
			maxVal, _ := rule.MaxCgpa.Float64()
			if cgpaVal >= minVal && cgpaVal <= maxVal {
				standing = rule.Standing
				break
			}
		}
	}

	// pgtype.Numeric's zero value has a nil .Int — calling SetInt64 on that
	// nil *big.Int panicked on every single call to this function, for every
	// caller (self-service and staff alike). big.NewInt allocates a real one.
	// cgpaVal is already rounded to 2dp above, but re-multiplying by 100 in
	// float64 can still land a hair below the intended integer (e.g. 2.30*100
	// == 229.99999999999997) — int64() truncates toward zero, silently
	// storing 2.29 instead of 2.30. math.Round fixes that final cast.
	cgpaNum := pgtype.Numeric{Int: big.NewInt(int64(math.Round(cgpaVal * 100))), Exp: -2, Valid: true}

	academicStanding := db.AcademicStanding(standing)

	_, err = s.store.UpdateStudentAcademicRecord(ctx, db.UpdateStudentAcademicRecordParams{
		ID:                 studentID,
		Cgpa:               cgpaNum,
		TotalCreditsEarned: &totalUnits,
		AcademicStanding:   &academicStanding,
		GraduationStatus:   student.GraduationStatus,
	})
	if err != nil {
		return nil, errors.New("failed to update student academic record: " + err.Error())
	}

	return &CGPAResult{
		StudentID:          studentID.String(),
		CGPA:               cgpaVal,
		TotalCreditsEarned: totalUnits,
		AcademicStanding:   standing,
	}, nil
}

// ScoreOverride is a hypothetical score for one course, keyed by course ID.
// If the course already has an approved result, its grade is replaced for
// the simulation; if it doesn't (a course in progress, or a retake), it's
// added as a new weighted entry.
type ScoreOverride struct {
	CourseID uuid.UUID
	Score    float64
}

type SimulatedCourse struct {
	CourseID    uuid.UUID `json:"course_id"`
	CourseCode  string    `json:"course_code"`
	CourseTitle string    `json:"course_title"`
	Unit        int32     `json:"unit"`
	Grade       string    `json:"grade"`
	GradePoint  float64   `json:"grade_point"`
	IsOverride  bool      `json:"is_override"`
}

type CGPASimulation struct {
	CurrentCGPA   float64           `json:"current_cgpa"`
	ProjectedCGPA float64           `json:"projected_cgpa"`
	TotalUnits    int32             `json:"total_units"`
	Breakdown     []SimulatedCourse `json:"breakdown"`
}

// GetApprovedResultsDetailed returns a student's real approved results with
// course details, used to seed the CGPA what-if simulator.
func (s *StudentService) GetApprovedResultsDetailed(ctx context.Context, studentID uuid.UUID) ([]db.StudentResultDetail, error) {
	q, ok := s.store.(*db.Queries)
	if !ok {
		return nil, errors.New("this operation requires direct database access")
	}
	return q.GetStudentApprovedResultsDetailed(ctx, studentID)
}

// SimulateCGPA computes what a student's CGPA would become if they scored a
// hypothetical amount in one or more courses, without persisting anything —
// a pure "what if" projection layered on top of their real approved results.
func (s *StudentService) SimulateCGPA(ctx context.Context, studentID uuid.UUID, overrides []ScoreOverride) (*CGPASimulation, error) {
	q, ok := s.store.(*db.Queries)
	if !ok {
		return nil, errors.New("simulation requires direct database access")
	}

	results, err := q.GetStudentApprovedResultsDetailed(ctx, studentID)
	if err != nil {
		return nil, errors.New("failed to fetch student results: " + err.Error())
	}

	breakdown := make([]SimulatedCourse, 0, len(results)+len(overrides))
	seen := make(map[uuid.UUID]int) // courseID -> index in breakdown

	var currentGradePoints, projectedGradePoints float64
	var totalUnits int32

	for _, r := range results {
		gpVal, _ := r.GradePoint.Float64()
		currentGradePoints += gpVal * float64(r.Unit)
		totalUnits += r.Unit
		seen[r.CourseID] = len(breakdown)
		breakdown = append(breakdown, SimulatedCourse{
			CourseID: r.CourseID, CourseCode: r.CourseCode, CourseTitle: r.CourseTitle,
			Unit: r.Unit, Grade: r.Grade, GradePoint: gpVal,
		})
	}
	projectedGradePoints = currentGradePoints

	for _, o := range overrides {
		scoreDecimal := decimal.NewFromFloat(o.Score)
		grade, gradePoint := ScoreToGrade(scoreDecimal)

		if idx, exists := seen[o.CourseID]; exists {
			// Replace an existing course's contribution with the hypothetical grade.
			old := breakdown[idx]
			projectedGradePoints -= old.GradePoint * float64(old.Unit)
			projectedGradePoints += gradePoint * float64(old.Unit)
			breakdown[idx].Grade = grade
			breakdown[idx].GradePoint = gradePoint
			breakdown[idx].IsOverride = true
			continue
		}

		course, err := q.GetCourse(ctx, o.CourseID)
		if err != nil {
			continue // unknown course — skip rather than fail the whole simulation
		}
		projectedGradePoints += gradePoint * float64(course.Unit)
		totalUnits += course.Unit
		breakdown = append(breakdown, SimulatedCourse{
			CourseID: course.ID, CourseCode: course.Code, CourseTitle: course.Title,
			Unit: course.Unit, Grade: grade, GradePoint: gradePoint, IsOverride: true,
		})
	}

	var currentTotalUnits int32
	for _, r := range results {
		currentTotalUnits += r.Unit
	}

	currentCGPA := 0.0
	if currentTotalUnits > 0 {
		currentCGPA = math.Round((currentGradePoints/float64(currentTotalUnits))*100) / 100
	}
	projectedCGPA := 0.0
	if totalUnits > 0 {
		projectedCGPA = math.Round((projectedGradePoints/float64(totalUnits))*100) / 100
	}

	return &CGPASimulation{
		CurrentCGPA:   currentCGPA,
		ProjectedCGPA: projectedCGPA,
		TotalUnits:    totalUnits,
		Breakdown:     breakdown,
	}, nil
}

func (s *StudentService) UpdateOnboarding(ctx context.Context, userID uuid.UUID, admissionMode *string, yearAdmitted *int32) (db.Student, error) {
	return s.store.UpdateStudentOnboarding(ctx, db.UpdateStudentOnboardingParams{
		UserID:              userID,
		AdmissionMode:       admissionMode,
		YearAdmitted:        yearAdmitted,
		OnboardingCompleted: true,
	})
}
