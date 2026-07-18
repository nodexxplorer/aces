package service

import (
	"context"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type AlumniService struct {
	store db.Querier
}

func NewAlumniService(store db.Querier) *AlumniService {
	return &AlumniService{store: store}
}

// Alumni Status
func (s *AlumniService) CreateStatus(ctx context.Context, params db.CreateAlumniStatusParams) (db.AlumniStatus, error) {
	return s.store.CreateAlumniStatus(ctx, params)
}

func (s *AlumniService) GetStatus(ctx context.Context, userID uuid.UUID) (db.AlumniStatus, error) {
	return s.store.GetAlumniStatus(ctx, userID)
}

func (s *AlumniService) ListAlumni(ctx context.Context, limit, offset int32) ([]db.ListAlumniRow, error) {
	return s.store.ListAlumni(ctx, db.ListAlumniParams{Limit: limit, Offset: offset})
}

func (s *AlumniService) UpdateStatus(ctx context.Context, params db.UpdateAlumniStatusParams) (db.AlumniStatus, error) {
	return s.store.UpdateAlumniStatus(ctx, params)
}

func (s *AlumniService) Verify(ctx context.Context, userID uuid.UUID, status string, verifiedBy uuid.UUID) (db.AlumniStatus, error) {
	return s.store.VerifyAlumni(ctx, db.VerifyAlumniParams{
		UserID:             userID,
		VerificationStatus: db.AlumniVerificationStatus(status),
		VerifiedBy:         pgtype.UUID{Bytes: verifiedBy, Valid: true},
	})
}

func (s *AlumniService) ListPendingVerifications(ctx context.Context) ([]db.ListPendingAlumniVerificationsRow, error) {
	return s.store.ListPendingAlumniVerifications(ctx)
}

// Mentorship
func (s *AlumniService) RequestMentorship(ctx context.Context, params db.CreateMentorshipRequestParams) (db.MentorshipRequest, error) {
	return s.store.CreateMentorshipRequest(ctx, params)
}

func (s *AlumniService) ListStudentMentorships(ctx context.Context, studentID uuid.UUID) ([]db.ListStudentMentorshipRequestsRow, error) {
	return s.store.ListStudentMentorshipRequests(ctx, studentID)
}

func (s *AlumniService) ListMentorRequests(ctx context.Context, mentorID uuid.UUID) ([]db.ListMentorMentorshipRequestsRow, error) {
	return s.store.ListMentorMentorshipRequests(ctx, mentorID)
}

func (s *AlumniService) UpdateMentorshipStatus(ctx context.Context, id uuid.UUID, status string) (db.MentorshipRequest, error) {
	return s.store.UpdateMentorshipStatus(ctx, db.UpdateMentorshipStatusParams{
		ID: id, Status: db.MentorshipStatus(status),
	})
}

// Job Posts
func (s *AlumniService) CreateJobPost(ctx context.Context, params db.CreateJobPostParams) (db.JobPost, error) {
	return s.store.CreateJobPost(ctx, params)
}

func (s *AlumniService) GetJobPost(ctx context.Context, id uuid.UUID) (db.GetJobPostRow, error) {
	return s.store.GetJobPost(ctx, id)
}

func (s *AlumniService) ListJobPosts(ctx context.Context, limit, offset int32) ([]db.ListJobPostsRow, error) {
	return s.store.ListJobPosts(ctx, db.ListJobPostsParams{Limit: limit, Offset: offset})
}

func (s *AlumniService) ListUserJobPosts(ctx context.Context, userID uuid.UUID) ([]db.JobPost, error) {
	return s.store.ListUserJobPosts(ctx, userID)
}

func (s *AlumniService) ApplyForJob(ctx context.Context, params db.CreateJobApplicationParams) (db.JobApplication, error) {
	return s.store.CreateJobApplication(ctx, params)
}

func (s *AlumniService) ListJobApplications(ctx context.Context, jobID uuid.UUID) ([]db.ListJobApplicationsRow, error) {
	return s.store.ListJobApplications(ctx, jobID)
}

func (s *AlumniService) UpdateApplicationStatus(ctx context.Context, id uuid.UUID, status string, reviewedBy uuid.UUID) (db.JobApplication, error) {
	return s.store.UpdateJobApplicationStatus(ctx, db.UpdateJobApplicationStatusParams{
		ID:         id,
		Status:     db.ApplicationStatus(status),
		ReviewedBy: pgtype.UUID{Bytes: reviewedBy, Valid: true},
	})
}

func (s *AlumniService) ListStudentJobApplications(ctx context.Context, applicantID uuid.UUID) ([]db.ListStudentJobApplicationsRow, error) {
	return s.store.ListStudentJobApplications(ctx, applicantID)
}

func (s *AlumniService) DeleteJobPost(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteJobPost(ctx, id)
}

// Events
func (s *AlumniService) CreateEvent(ctx context.Context, params db.CreateAlumniEventParams) (db.AlumniEvent, error) {
	return s.store.CreateAlumniEvent(ctx, params)
}

func (s *AlumniService) ListEvents(ctx context.Context, limit, offset int32) ([]db.ListAlumniEventsRow, error) {
	return s.store.ListAlumniEvents(ctx, db.ListAlumniEventsParams{Limit: limit, Offset: offset})
}

func (s *AlumniService) RegisterForEvent(ctx context.Context, eventID, userID uuid.UUID) (db.EventAttendee, error) {
	return s.store.RegisterForEvent(ctx, db.RegisterForEventParams{EventID: eventID, UserID: userID})
}

func (s *AlumniService) ListEventAttendees(ctx context.Context, eventID uuid.UUID) ([]db.ListEventAttendeesRow, error) {
	return s.store.ListEventAttendees(ctx, eventID)
}
