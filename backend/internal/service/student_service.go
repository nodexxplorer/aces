package service

import (
	"context"
	"errors"
	"math"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
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
		EntryYear:    int32(2025),
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

	var cgpaNum pgtype.Numeric
	cgpaNum.Int.SetInt64(int64(cgpaVal * 100))
	cgpaNum.Exp = -2
	cgpaNum.Valid = true

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

func (s *StudentService) UpdateOnboarding(ctx context.Context, userID uuid.UUID, admissionMode *string, yearAdmitted *int32) (db.Student, error) {
	return s.store.UpdateStudentOnboarding(ctx, db.UpdateStudentOnboardingParams{
		UserID:              userID,
		AdmissionMode:       admissionMode,
		YearAdmitted:        yearAdmitted,
		OnboardingCompleted: true,
	})
}
