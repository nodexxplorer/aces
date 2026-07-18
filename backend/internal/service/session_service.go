package service

import (
	"context"
	"errors"
	"strings"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type SessionService struct {
	store db.Querier
}

func NewSessionService(store db.Querier) *SessionService {
	return &SessionService{store: store}
}

func parseFlexibleDate(dateStr string) (time.Time, error) {
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02T15:04:05",
		"2006-01-02",
		"01/02/2006",
	}
	for _, format := range formats {
		if t, err := time.Parse(format, dateStr); err == nil {
			return t, nil
		}
	}
	return time.Time{}, errors.New("invalid date format, use RFC3339 or YYYY-MM-DD")
}

func (s *SessionService) Create(ctx context.Context, name, startDateStr, endDateStr string) (db.Session, error) {
	startDate, err := parseFlexibleDate(startDateStr)
	if err != nil {
		return db.Session{}, errors.New("invalid start_date: " + err.Error())
	}

	endDate, err := parseFlexibleDate(endDateStr)
	if err != nil {
		return db.Session{}, errors.New("invalid end_date: " + err.Error())
	}

	return s.store.CreateSession(ctx, db.CreateSessionParams{
		Name:      strings.TrimSpace(name),
		StartDate: pgtype.Timestamptz{Time: startDate, Valid: true},
		EndDate:   pgtype.Timestamptz{Time: endDate, Valid: true},
	})
}

func (s *SessionService) GetByID(ctx context.Context, id uuid.UUID) (db.Session, error) {
	session, err := s.store.GetSession(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Session{}, errors.New("session not found")
		}
		return db.Session{}, err
	}
	return session, nil
}

func (s *SessionService) GetActive(ctx context.Context) (db.Session, error) {
	session, err := s.store.GetActiveSession(ctx)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Session{}, errors.New("no active session found")
		}
		return db.Session{}, err
	}
	return session, nil
}

func (s *SessionService) GetByIDOrActive(ctx context.Context, idOrActive string) (db.Session, error) {
	if idOrActive == "active" {
		return s.GetActive(ctx)
	}
	id, err := uuid.Parse(idOrActive)
	if err != nil {
		return db.Session{}, errors.New("invalid session id")
	}
	return s.GetByID(ctx, id)
}

func (s *SessionService) List(ctx context.Context, limit, offset int32) ([]db.Session, error) {
	return s.store.ListSessions(ctx, db.ListSessionsParams{Limit: limit, Offset: offset})
}

type UpdateSessionInput struct {
	Name       string
	StartDate  string
	EndDate    string
	IsActive   *bool
	IsArchived *bool
}

func (s *SessionService) Update(ctx context.Context, id uuid.UUID, input UpdateSessionInput) (db.Session, error) {
	current, err := s.store.GetSession(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Session{}, errors.New("session not found")
		}
		return db.Session{}, err
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = strings.TrimSpace(current.Name)
	}

	var startDateValue pgtype.Timestamptz = current.StartDate
	if input.StartDate != "" {
		startDate, err := parseFlexibleDate(input.StartDate)
		if err != nil {
			return db.Session{}, errors.New("invalid start_date: " + err.Error())
		}
		startDateValue = pgtype.Timestamptz{Time: startDate, Valid: true}
	}

	var endDateValue pgtype.Timestamptz = current.EndDate
	if input.EndDate != "" {
		endDate, err := parseFlexibleDate(input.EndDate)
		if err != nil {
			return db.Session{}, errors.New("invalid end_date: " + err.Error())
		}
		endDateValue = pgtype.Timestamptz{Time: endDate, Valid: true}
	}

	isActive := current.IsActive
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	isArchived := current.IsArchived
	if input.IsArchived != nil {
		isArchived = *input.IsArchived
	}

	return s.store.UpdateSession(ctx, db.UpdateSessionParams{
		ID:         id,
		Name:       name,
		StartDate:  startDateValue,
		EndDate:    endDateValue,
		IsActive:   isActive,
		IsArchived: isArchived,
	})
}

func (s *SessionService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteSession(ctx, id)
}

type SemesterService struct {
	store db.Querier
}

func NewSemesterService(store db.Querier) *SemesterService {
	return &SemesterService{store: store}
}

func (s *SemesterService) Create(ctx context.Context, sessionID uuid.UUID, name, startDateStr, endDateStr string) (db.Semester, error) {
	startDate, err := parseFlexibleDate(startDateStr)
	if err != nil {
		return db.Semester{}, errors.New("invalid start_date: " + err.Error())
	}

	endDate, err := parseFlexibleDate(endDateStr)
	if err != nil {
		return db.Semester{}, errors.New("invalid end_date: " + err.Error())
	}

	return s.store.CreateSemester(ctx, db.CreateSemesterParams{
		SessionID: sessionID,
		Name:      db.SemesterSeason(name),
		StartDate: pgtype.Timestamptz{Time: startDate, Valid: true},
		EndDate:   pgtype.Timestamptz{Time: endDate, Valid: true},
	})
}

func (s *SemesterService) GetByID(ctx context.Context, id uuid.UUID) (db.Semester, error) {
	return s.store.GetSemester(ctx, id)
}

func (s *SemesterService) GetActive(ctx context.Context) (db.Semester, error) {
	return s.store.GetActiveSemester(ctx)
}

func (s *SemesterService) ListBySession(ctx context.Context, sessionID uuid.UUID) ([]db.Semester, error) {
	return s.store.ListSessionSemesters(ctx, sessionID)
}

func (s *SemesterService) GetByIDOrActive(ctx context.Context, idOrActive string) (db.Semester, error) {
	if idOrActive == "active" {
		semester, err := s.store.GetActiveSemester(ctx)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return db.Semester{}, errors.New("no active semester found")
			}
			return db.Semester{}, err
		}
		return semester, nil
	}
	id, err := uuid.Parse(idOrActive)
	if err != nil {
		return db.Semester{}, errors.New("invalid semester id")
	}
	semester, err := s.store.GetSemester(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Semester{}, errors.New("semester not found")
		}
		return db.Semester{}, err
	}
	return semester, nil
}

type UpdateSemesterInput struct {
	SessionID            uuid.UUID
	Name                 string
	StartDate            string
	EndDate              string
	RegistrationDeadline string
	IsActive             bool
}

func (s *SemesterService) Update(ctx context.Context, id uuid.UUID, input UpdateSemesterInput) (db.Semester, error) {
	startDate, err := parseFlexibleDate(input.StartDate)
	if err != nil {
		return db.Semester{}, errors.New("invalid start_date: " + err.Error())
	}

	endDate, err := parseFlexibleDate(input.EndDate)
	if err != nil {
		return db.Semester{}, errors.New("invalid end_date: " + err.Error())
	}

	arg := db.UpdateSemesterParams{
		ID:        id,
		SessionID: input.SessionID,
		Name:      db.SemesterSeason(input.Name),
		StartDate: pgtype.Timestamptz{Time: startDate, Valid: true},
		EndDate:   pgtype.Timestamptz{Time: endDate, Valid: true},
		IsActive:  input.IsActive,
	}

	if input.RegistrationDeadline != "" {
		regDeadline, err := parseFlexibleDate(input.RegistrationDeadline)
		if err != nil {
			return db.Semester{}, errors.New("invalid registration_deadline: " + err.Error())
		}
		arg.RegistrationDeadline = pgtype.Timestamptz{Time: regDeadline, Valid: true}
	} else {
		arg.RegistrationDeadline = pgtype.Timestamptz{Valid: false}
	}

	return s.store.UpdateSemester(ctx, arg)
}

func (s *SemesterService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteSemester(ctx, id)
}
