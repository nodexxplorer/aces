package db

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type ComplaintStatusHistory struct {
	ID             uuid.UUID          `json:"id"`
	ComplaintID    uuid.UUID          `json:"complaint_id"`
	FromStatus     *ComplaintStatus   `json:"from_status"`
	ToStatus       ComplaintStatus    `json:"to_status"`
	ChangedBy      uuid.UUID          `json:"changed_by"`
	ChangedByRole  string             `json:"changed_by_role"`
	Note           *string            `json:"note"`
	CreatedAt      pgtype.Timestamptz `json:"created_at"`
}

func (q *Queries) AssignComplaint(ctx context.Context, id, assignedTo uuid.UUID) (Complaint, error) {
	var c Complaint
	err := q.db.QueryRow(ctx, `
		UPDATE complaints
		SET assigned_to = $2, status = 'in_review', updated_at = NOW()
		WHERE id = $1
		RETURNING id, student_id, category, subject, body, priority, status, assigned_to, resolution, resolved_at, resolved_by, created_at, updated_at
	`, id, assignedTo).Scan(
		&c.ID, &c.StudentID, &c.Category, &c.Subject, &c.Body, &c.Priority, &c.Status,
		&c.AssignedTo, &c.Resolution, &c.ResolvedAt, &c.ResolvedBy, &c.CreatedAt, &c.UpdatedAt,
	)
	return c, err
}

func (q *Queries) ResolveComplaint(ctx context.Context, id uuid.UUID, resolution string, resolvedBy uuid.UUID, status ComplaintStatus) (Complaint, error) {
	var c Complaint
	err := q.db.QueryRow(ctx, `
		UPDATE complaints
		SET resolution = $2, resolved_at = NOW(), resolved_by = $3, status = $4, updated_at = NOW()
		WHERE id = $1
		RETURNING id, student_id, category, subject, body, priority, status, assigned_to, resolution, resolved_at, resolved_by, created_at, updated_at
	`, id, resolution, resolvedBy, status).Scan(
		&c.ID, &c.StudentID, &c.Category, &c.Subject, &c.Body, &c.Priority, &c.Status,
		&c.AssignedTo, &c.Resolution, &c.ResolvedAt, &c.ResolvedBy, &c.CreatedAt, &c.UpdatedAt,
	)
	return c, err
}

type CreateComplaintStatusHistoryParams struct {
	ComplaintID   uuid.UUID
	FromStatus    *ComplaintStatus
	ToStatus      ComplaintStatus
	ChangedBy     uuid.UUID
	ChangedByRole string
	Note          *string
}

func (q *Queries) CreateComplaintStatusHistory(ctx context.Context, arg CreateComplaintStatusHistoryParams) (ComplaintStatusHistory, error) {
	var h ComplaintStatusHistory
	err := q.db.QueryRow(ctx, `
		INSERT INTO complaint_status_history (complaint_id, from_status, to_status, changed_by, changed_by_role, note)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, complaint_id, from_status, to_status, changed_by, changed_by_role, note, created_at
	`, arg.ComplaintID, arg.FromStatus, arg.ToStatus, arg.ChangedBy, arg.ChangedByRole, arg.Note).Scan(
		&h.ID, &h.ComplaintID, &h.FromStatus, &h.ToStatus, &h.ChangedBy, &h.ChangedByRole, &h.Note, &h.CreatedAt,
	)
	return h, err
}

func (q *Queries) ListComplaintStatusHistory(ctx context.Context, complaintID uuid.UUID) ([]ComplaintStatusHistory, error) {
	rows, err := q.db.Query(ctx, `
		SELECT id, complaint_id, from_status, to_status, changed_by, changed_by_role, note, created_at
		FROM complaint_status_history
		WHERE complaint_id = $1
		ORDER BY created_at ASC
	`, complaintID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []ComplaintStatusHistory{}
	for rows.Next() {
		var h ComplaintStatusHistory
		if err := rows.Scan(&h.ID, &h.ComplaintID, &h.FromStatus, &h.ToStatus, &h.ChangedBy, &h.ChangedByRole, &h.Note, &h.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, h)
	}
	return items, rows.Err()
}
