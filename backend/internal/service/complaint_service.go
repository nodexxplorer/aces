package service

import (
	"context"
	"errors"
	"strings"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
)

type ComplaintService struct {
	store db.Querier
}

func NewComplaintService(store db.Querier) *ComplaintService {
	return &ComplaintService{store: store}
}

type CreateComplaintInput struct {
	Category string
	Subject  string
	Body     string
	Priority string
}

func (s *ComplaintService) Create(ctx context.Context, studentID uuid.UUID, input CreateComplaintInput) (db.Complaint, error) {
	student, err := s.store.GetStudentByUserId(ctx, studentID)
	if err != nil {
		return db.Complaint{}, errors.New("student record not found")
	}

	priority := "medium"
	if input.Priority != "" {
		priority = input.Priority
	}

	return s.store.CreateComplaint(ctx, db.CreateComplaintParams{
		StudentID: student.ID,
		Category:  db.ComplaintCategory(input.Category),
		Subject:   input.Subject,
		Body:      input.Body,
		Priority:  db.ComplaintPriority(priority),
		Status:    db.ComplaintStatusOpen,
	})
}

func (s *ComplaintService) GetByID(ctx context.Context, id uuid.UUID) (db.Complaint, error) {
	complaint, err := s.store.GetComplaint(ctx, id)
	if err != nil {
		return db.Complaint{}, errors.New("complaint not found")
	}
	return complaint, nil
}

func (s *ComplaintService) ListAll(ctx context.Context) ([]db.Complaint, error) {
	return s.store.ListComplaints(ctx)
}

func (s *ComplaintService) ListByStudent(ctx context.Context, studentID uuid.UUID) ([]db.Complaint, error) {
	return s.store.ListStudentComplaints(ctx, studentID)
}

func (s *ComplaintService) UpdateStatus(ctx context.Context, id uuid.UUID, status string) (db.Complaint, error) {
	existing, err := s.store.GetComplaint(ctx, id)
	if err != nil {
		return db.Complaint{}, errors.New("complaint not found")
	}

	return s.store.UpdateComplaint(ctx, db.UpdateComplaintParams{
		ID:       id,
		Category: existing.Category,
		Subject:  existing.Subject,
		Body:     existing.Body,
		Priority: existing.Priority,
		Status:   db.ComplaintStatus(status),
	})
}

func (s *ComplaintService) Assign(ctx context.Context, id uuid.UUID, assignedTo uuid.UUID) (db.Complaint, error) {
	existing, err := s.store.GetComplaint(ctx, id)
	if err != nil {
		return db.Complaint{}, errors.New("complaint not found")
	}

	_ = assignedTo
	return s.store.UpdateComplaint(ctx, db.UpdateComplaintParams{
		ID:       id,
		Category: existing.Category,
		Subject:  existing.Subject,
		Body:     existing.Body,
		Priority: existing.Priority,
		Status:   db.ComplaintStatusInReview,
	})
}

func (s *ComplaintService) Resolve(ctx context.Context, id uuid.UUID, resolution string) (db.Complaint, error) {
	existing, err := s.store.GetComplaint(ctx, id)
	if err != nil {
		return db.Complaint{}, errors.New("complaint not found")
	}

	_ = strings.TrimSpace(resolution)
	return s.store.UpdateComplaint(ctx, db.UpdateComplaintParams{
		ID:       id,
		Category: existing.Category,
		Subject:  existing.Subject,
		Body:     existing.Body,
		Priority: existing.Priority,
		Status:   db.ComplaintStatusResolved,
	})
}

func (s *ComplaintService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteComplaint(ctx, id)
}
