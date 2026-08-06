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

	complaint, err := s.store.CreateComplaint(ctx, db.CreateComplaintParams{
		StudentID: student.ID,
		Category:  db.ComplaintCategory(input.Category),
		Subject:   input.Subject,
		Body:      input.Body,
		Priority:  db.ComplaintPriority(priority),
		Status:    db.ComplaintStatusOpen,
	})
	if err != nil {
		return db.Complaint{}, err
	}

	s.recordHistory(ctx, complaint.ID, nil, complaint.Status, studentID, "student", nil)
	return complaint, nil
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

// History returns the full status timeline for a complaint, oldest first.
func (s *ComplaintService) History(ctx context.Context, complaintID uuid.UUID) ([]db.ComplaintStatusHistory, error) {
	q, ok := s.store.(*db.Queries)
	if !ok {
		return nil, errors.New("this operation requires direct database access")
	}
	return q.ListComplaintStatusHistory(ctx, complaintID)
}

func (s *ComplaintService) UpdateStatus(ctx context.Context, id uuid.UUID, status string, changedBy uuid.UUID, changedByRole string) (db.Complaint, error) {
	existing, err := s.store.GetComplaint(ctx, id)
	if err != nil {
		return db.Complaint{}, errors.New("complaint not found")
	}

	updated, err := s.store.UpdateComplaint(ctx, db.UpdateComplaintParams{
		ID:       id,
		Category: existing.Category,
		Subject:  existing.Subject,
		Body:     existing.Body,
		Priority: existing.Priority,
		Status:   db.ComplaintStatus(status),
	})
	if err != nil {
		return db.Complaint{}, err
	}

	s.recordHistory(ctx, id, &existing.Status, updated.Status, changedBy, changedByRole, nil)
	return updated, nil
}

func (s *ComplaintService) Assign(ctx context.Context, id uuid.UUID, assignedTo uuid.UUID, changedBy uuid.UUID, changedByRole string) (db.Complaint, error) {
	q, ok := s.store.(*db.Queries)
	if !ok {
		return db.Complaint{}, errors.New("this operation requires direct database access")
	}

	existing, err := s.store.GetComplaint(ctx, id)
	if err != nil {
		return db.Complaint{}, errors.New("complaint not found")
	}

	updated, err := q.AssignComplaint(ctx, id, assignedTo)
	if err != nil {
		return db.Complaint{}, err
	}

	s.recordHistory(ctx, id, &existing.Status, updated.Status, changedBy, changedByRole, nil)
	return updated, nil
}

func (s *ComplaintService) Resolve(ctx context.Context, id uuid.UUID, resolution string, changedBy uuid.UUID, changedByRole string) (db.Complaint, error) {
	q, ok := s.store.(*db.Queries)
	if !ok {
		return db.Complaint{}, errors.New("this operation requires direct database access")
	}

	existing, err := s.store.GetComplaint(ctx, id)
	if err != nil {
		return db.Complaint{}, errors.New("complaint not found")
	}

	resolution = strings.TrimSpace(resolution)
	updated, err := q.ResolveComplaint(ctx, id, resolution, changedBy, db.ComplaintStatusResolved)
	if err != nil {
		return db.Complaint{}, err
	}

	note := resolution
	s.recordHistory(ctx, id, &existing.Status, updated.Status, changedBy, changedByRole, &note)
	return updated, nil
}

func (s *ComplaintService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteComplaint(ctx, id)
}

// recordHistory best-effort logs a status transition; a logging failure never
// fails the underlying status change itself.
func (s *ComplaintService) recordHistory(ctx context.Context, complaintID uuid.UUID, from *db.ComplaintStatus, to db.ComplaintStatus, changedBy uuid.UUID, changedByRole string, note *string) {
	q, ok := s.store.(*db.Queries)
	if !ok {
		return
	}
	_, _ = q.CreateComplaintStatusHistory(ctx, db.CreateComplaintStatusHistoryParams{
		ComplaintID:   complaintID,
		FromStatus:    from,
		ToStatus:      to,
		ChangedBy:     changedBy,
		ChangedByRole: changedByRole,
		Note:          note,
	})
}
