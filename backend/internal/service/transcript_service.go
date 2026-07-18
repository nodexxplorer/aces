package service

import (
	"context"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type TranscriptService struct {
	store db.Querier
}

func NewTranscriptService(store db.Querier) *TranscriptService {
	return &TranscriptService{store: store}
}

type CreateTranscriptInput struct {
	StudentID uuid.UUID
	Purpose   string
}

func (s *TranscriptService) Create(ctx context.Context, input CreateTranscriptInput) (db.TranscriptRequest, error) {
	return s.store.CreateTranscriptRequest(ctx, db.CreateTranscriptRequestParams{
		StudentID: input.StudentID,
		Purpose:   input.Purpose,
		Status:    db.TranscriptStatusRequested,
	})
}

func (s *TranscriptService) GetByID(ctx context.Context, id uuid.UUID) (db.TranscriptRequest, error) {
	return s.store.GetTranscriptRequest(ctx, id)
}

func (s *TranscriptService) ListByStudent(ctx context.Context, studentID uuid.UUID) ([]db.TranscriptRequest, error) {
	return s.store.ListStudentTranscriptRequests(ctx, studentID)
}

func (s *TranscriptService) ListPending(ctx context.Context, limit, offset int32) ([]db.TranscriptRequest, error) {
	return s.store.ListPendingTranscriptRequests(ctx, db.ListPendingTranscriptRequestsParams{
		Limit:  limit,
		Offset: offset,
	})
}

type UpdateTranscriptInput struct {
	Status       string
	ProcessedBy  *uuid.UUID
	FeePaid      bool
	PdfUrl       *string
	SentViaEmail bool
}

func (s *TranscriptService) Update(ctx context.Context, id uuid.UUID, input UpdateTranscriptInput) (db.TranscriptRequest, error) {
	arg := db.UpdateTranscriptRequestParams{
		ID:           id,
		Status:       db.TranscriptStatus(input.Status),
		FeePaid:      input.FeePaid,
		PdfUrl:       input.PdfUrl,
		SentViaEmail: input.SentViaEmail,
	}

	if input.ProcessedBy != nil {
		arg.ProcessedBy = pgtype.UUID{Bytes: *input.ProcessedBy, Valid: true}
	}

	return s.store.UpdateTranscriptRequest(ctx, arg)
}

func (s *TranscriptService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteTranscriptRequest(ctx, id)
}
