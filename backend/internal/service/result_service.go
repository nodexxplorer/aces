package service

import (
	"context"
	"errors"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
)

type ResultService struct {
	store db.Querier
}

func NewResultService(store db.Querier) *ResultService {
	return &ResultService{store: store}
}

type CreateResultInput struct {
	StudentID   string
	CourseID    string
	SessionID   string
	SemesterID  string
	CaScore     decimal.Decimal
	ExamScore   decimal.Decimal
	TotalScore  decimal.Decimal
	Grade       string
	GradePoint  float64
	Status      string
	IsCarryover bool
}

func (s *ResultService) Create(ctx context.Context, input CreateResultInput) (db.Result, error) {
	studentID, _ := uuid.Parse(input.StudentID)
	courseID, _ := uuid.Parse(input.CourseID)
	sessionID, _ := uuid.Parse(input.SessionID)
	semesterID, _ := uuid.Parse(input.SemesterID)

	status := input.Status
	if status == "" {
		status = "pending"
	}

	arg := db.CreateResultParams{
		StudentID:   studentID,
		CourseID:    courseID,
		SessionID:   sessionID,
		SemesterID:  semesterID,
		CaScore:     input.CaScore,
		ExamScore:   input.ExamScore,
		TotalScore:  input.TotalScore,
		Status:      db.ResultStatus(status),
		IsCarryover: input.IsCarryover,
	}

	if input.Grade != "" {
		g := db.Grade(input.Grade)
		arg.Grade = &g
	}

	arg.GradePoint.Int.SetInt64(int64(input.GradePoint * 100))
	arg.GradePoint.Exp = -2
	arg.GradePoint.Valid = true

	return s.store.CreateResult(ctx, arg)
}

func (s *ResultService) GetByID(ctx context.Context, id uuid.UUID) (db.Result, error) {
	return s.store.GetResult(ctx, id)
}

func (s *ResultService) ListByStudent(ctx context.Context, studentID uuid.UUID) ([]db.Result, error) {
	return s.store.ListStudentResults(ctx, studentID)
}

func (s *ResultService) ListByCourse(ctx context.Context, courseID, sessionID uuid.UUID) ([]db.Result, error) {
	return s.store.ListCourseResults(ctx, db.ListCourseResultsParams{
		CourseID:  courseID,
		SessionID: sessionID,
	})
}

type UpdateResultInput struct {
	CaScore    decimal.Decimal
	ExamScore  decimal.Decimal
	TotalScore decimal.Decimal
	Grade      string
	GradePoint float64
	Status     string
}

func (s *ResultService) Update(ctx context.Context, id uuid.UUID, input UpdateResultInput) (db.Result, error) {
	arg := db.UpdateResultParams{
		ID:         id,
		CaScore:    input.CaScore,
		ExamScore:  input.ExamScore,
		TotalScore: input.TotalScore,
		Status:     db.ResultStatus(input.Status),
	}

	if input.Grade != "" {
		g := db.Grade(input.Grade)
		arg.Grade = &g
	}

	arg.GradePoint.Int.SetInt64(int64(input.GradePoint * 100))
	arg.GradePoint.Exp = -2
	arg.GradePoint.Valid = true

	return s.store.UpdateResult(ctx, arg)
}

func (s *ResultService) UpdateStatus(ctx context.Context, id uuid.UUID, status string, approvedBy *uuid.UUID, rejectionReason *string) (db.Result, error) {
	arg := db.UpdateResultStatusParams{
		ID:     id,
		Status: db.ResultStatus(status),
	}

	if approvedBy != nil {
		arg.ApprovedBy = pgtype.UUID{Bytes: *approvedBy, Valid: true}
	}

	arg.ApprovedAt = pgtype.Timestamptz{Time: time.Now(), Valid: true}

	if rejectionReason != nil {
		arg.RejectionReason = rejectionReason
	}

	return s.store.UpdateResultStatus(ctx, arg)
}

func (s *ResultService) CreateAuditLog(ctx context.Context, resultID uuid.UUID, fieldChanged string, oldValue, newValue *string, reason string, editedBy uuid.UUID, ipAddress, userAgent *string) (db.ResultAuditLog, error) {
	return s.store.CreateResultAuditLog(ctx, db.CreateResultAuditLogParams{
		ResultID:     resultID,
		FieldChanged: fieldChanged,
		OldValue:     oldValue,
		NewValue:     newValue,
		Reason:       reason,
		EditedBy:     editedBy,
		IpAddress:    ipAddress,
		UserAgent:    userAgent,
	})
}

func (s *ResultService) ListAuditLogs(ctx context.Context, resultID uuid.UUID) ([]db.ResultAuditLog, error) {
	return s.store.ListResultAuditLogs(ctx, resultID)
}

type CreateCarryoverInput struct {
	StudentID         string
	CourseID          string
	OriginalResultID  string
	OriginalSessionID string
	AttemptCount      int32
	MaxAttempts       int32
}

func (s *ResultService) CreateCarryover(ctx context.Context, input CreateCarryoverInput) (db.CarryoverCourse, error) {
	studentID, _ := uuid.Parse(input.StudentID)
	courseID, _ := uuid.Parse(input.CourseID)
	originalResultID, _ := uuid.Parse(input.OriginalResultID)
	originalSessionID, _ := uuid.Parse(input.OriginalSessionID)

	maxAttempts := input.MaxAttempts
	if maxAttempts <= 0 {
		maxAttempts = 3
	}

	attemptCount := input.AttemptCount
	if attemptCount <= 0 {
		attemptCount = 1
	}

	return s.store.CreateCarryoverCourse(ctx, db.CreateCarryoverCourseParams{
		StudentID:         studentID,
		CourseID:          courseID,
		OriginalResultID:  originalResultID,
		OriginalSessionID: originalSessionID,
		AttemptCount:      attemptCount,
		MaxAttempts:       maxAttempts,
	})
}

func (s *ResultService) GetCarryover(ctx context.Context, id uuid.UUID) (db.CarryoverCourse, error) {
	return s.store.GetCarryoverCourse(ctx, id)
}

func (s *ResultService) UpdateCarryover(ctx context.Context, id uuid.UUID, attemptCount int32, isResolved bool, resolvedResultID *string) (db.CarryoverCourse, error) {
	arg := db.UpdateCarryoverCourseParams{
		ID:           id,
		AttemptCount: attemptCount,
		IsResolved:   isResolved,
	}

	if resolvedResultID != nil {
		resolvedID, _ := uuid.Parse(*resolvedResultID)
		arg.ResolvedResultID = pgtype.UUID{Bytes: resolvedID, Valid: true}
	}

	return s.store.UpdateCarryoverCourse(ctx, arg)
}

func (s *ResultService) ListCarryovers(ctx context.Context, studentID uuid.UUID) ([]db.CarryoverCourse, error) {
	return s.store.ListStudentCarryoverCourses(ctx, studentID)
}

func (s *ResultService) DeleteCarryover(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteCarryoverCourse(ctx, id)
}

func (s *ResultService) NotFound(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}
