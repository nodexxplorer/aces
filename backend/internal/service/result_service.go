package service

import (
	"context"
	"errors"
	"math/big"
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
	StudentID    string
	CourseID     string
	SessionID    string
	SemesterID   string
	CaScore      decimal.Decimal
	ExamScore    decimal.Decimal
	TotalScore   decimal.Decimal
	Grade        string
	GradePoint   float64
	Status       string
	IsCarryover  bool
	MatricNumber *string
}

func (s *ResultService) Create(ctx context.Context, input CreateResultInput) (db.Result, error) {
	courseID, _ := uuid.Parse(input.CourseID)
	sessionID, _ := uuid.Parse(input.SessionID)
	semesterID, _ := uuid.Parse(input.SemesterID)

	status := input.Status
	if status == "" {
		status = "pending"
	}

	arg := db.CreateResultParams{
		CourseID:     courseID,
		SessionID:    sessionID,
		SemesterID:   semesterID,
		CaScore:      input.CaScore,
		ExamScore:    input.ExamScore,
		TotalScore:   input.TotalScore,
		Status:       db.ResultStatus(status),
		IsCarryover:  input.IsCarryover,
		MatricNumber: input.MatricNumber,
	}

	if input.StudentID != "" {
		studentID, err := uuid.Parse(input.StudentID)
		if err == nil {
			arg.StudentID = &studentID
		}
	}

	if input.Grade != "" {
		g := db.Grade(input.Grade)
		arg.Grade = &g
	}

	arg.GradePoint.Int = new(big.Int)
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

	arg.GradePoint.Int = new(big.Int)
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

func (s *ResultService) NotFound(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}
