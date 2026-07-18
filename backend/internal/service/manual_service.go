package service

import (
	"context"
	"errors"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type ManualService struct {
	store db.Querier
}

func NewManualService(store db.Querier) *ManualService {
	return &ManualService{store: store}
}

func (s *ManualService) Create(ctx context.Context, params db.CreateManualParams) (db.Manual, error) {
	return s.store.CreateManual(ctx, params)
}

func (s *ManualService) GetByID(ctx context.Context, id uuid.UUID) (db.Manual, error) {
	return s.store.GetManual(ctx, id)
}

func (s *ManualService) List(ctx context.Context, limit, offset int32) ([]db.Manual, error) {
	return s.store.ListManuals(ctx, db.ListManualsParams{Limit: limit, Offset: offset})
}

func (s *ManualService) ListByLevel(ctx context.Context, level int32) ([]db.Manual, error) {
	return s.store.ListManualsByLevel(ctx, level)
}

func (s *ManualService) Update(ctx context.Context, params db.UpdateManualParams) (db.Manual, error) {
	return s.store.UpdateManual(ctx, params)
}

func (s *ManualService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteManual(ctx, id)
}

func (s *ManualService) Purchase(ctx context.Context, params db.CreateManualPurchaseParams) (db.ManualPurchase, error) {
	purchased, err := s.store.CheckManualPurchased(ctx, db.CheckManualPurchasedParams{
		StudentID: params.StudentID,
		ManualID:  params.ManualID,
	})
	if err == nil && purchased {
		return db.ManualPurchase{}, errors.New("manual already purchased")
	}
	return s.store.CreateManualPurchase(ctx, params)
}

func (s *ManualService) ListStudentPurchases(ctx context.Context, studentID uuid.UUID) ([]db.ListStudentManualPurchasesRow, error) {
	return s.store.ListStudentManualPurchases(ctx, studentID)
}

func (s *ManualService) ListPurchasesByManual(ctx context.Context, manualID uuid.UUID, limit, offset int32) ([]db.ListManualPurchasesByManualRow, error) {
	return s.store.ListManualPurchasesByManual(ctx, db.ListManualPurchasesByManualParams{
		ManualID: manualID, Limit: limit, Offset: offset,
	})
}

func (s *ManualService) MarkCollected(ctx context.Context, id uuid.UUID) (db.ManualPurchase, error) {
	return s.store.MarkManualCollected(ctx, id)
}

func (s *ManualService) AddToPrintQueue(ctx context.Context, params db.CreatePrintQueueItemParams) (db.ManualPrintQueue, error) {
	return s.store.CreatePrintQueueItem(ctx, params)
}

func (s *ManualService) ListPrintQueue(ctx context.Context, status *string, limit, offset int32) ([]db.ListPrintQueueRow, error) {
	var statusVal string
	if status != nil {
		statusVal = *status
	}
	return s.store.ListPrintQueue(ctx, db.ListPrintQueueParams{
		Status: statusVal, Limit: limit, Offset: offset,
	})
}

func (s *ManualService) UpdatePrintQueueStatus(ctx context.Context, id uuid.UUID, status string, processedBy *uuid.UUID) (db.ManualPrintQueue, error) {
	var processedByUUID pgtype.UUID
	if processedBy != nil {
		processedByUUID = pgtype.UUID{Bytes: *processedBy, Valid: true}
	}
	return s.store.UpdatePrintQueueStatus(ctx, db.UpdatePrintQueueStatusParams{
		ID: id, Status: status, ProcessedBy: processedByUUID,
	})
}

func (s *ManualService) EnrollPractical(ctx context.Context, params db.CreatePracticalEnrollmentParams) (db.PracticalEnrollment, error) {
	enrolled, err := s.store.CheckPracticalEnrolled(ctx, db.CheckPracticalEnrolledParams{
		StudentID: params.StudentID, CourseID: params.CourseID, SessionID: params.SessionID,
	})
	if err == nil && enrolled {
		return db.PracticalEnrollment{}, errors.New("already enrolled in this practical")
	}
	return s.store.CreatePracticalEnrollment(ctx, params)
}
