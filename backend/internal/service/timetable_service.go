package service

import (
	"context"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type TimetableService struct {
	store db.Querier
}

func NewTimetableService(store db.Querier) *TimetableService {
	return &TimetableService{store: store}
}

type CreateTimetableInput struct {
	CourseID     uuid.UUID
	StartTime    string
	EndTime      string
	Venue        string
	Level        int32
	DayOfWeek    int32
	EntryType    string
	ClassType    *string
	ExamType     *string
	LecturerID   *uuid.UUID
	Invigilators *string
}

func (s *TimetableService) Create(ctx context.Context, input CreateTimetableInput) (uuid.UUID, error) {
	queries, ok := s.store.(*db.Queries)
	if !ok {
		return uuid.Nil, nil
	}
	return queries.CreateTimetableEntrySimple(ctx, db.CreateTimetableEntrySimpleParams{
		CourseID:     input.CourseID,
		DayOfWeek:    input.DayOfWeek,
		StartTime:    input.StartTime,
		EndTime:      input.EndTime,
		Venue:        input.Venue,
		Level:        input.Level,
		EntryType:    input.EntryType,
		ClassType:    input.ClassType,
		ExamType:     input.ExamType,
		LecturerID:   input.LecturerID,
		Invigilators: input.Invigilators,
	})
}

func (s *TimetableService) GetByID(ctx context.Context, id uuid.UUID) (db.Timetable, error) {
	return s.store.GetTimetableEntry(ctx, id)
}

func (s *TimetableService) List(ctx context.Context, sessionID, semesterID uuid.UUID) ([]db.Timetable, error) {
	return s.store.ListTimetableEntries(ctx, db.ListTimetableEntriesParams{
		SessionID:  pgtype.UUID{Bytes: sessionID, Valid: true},
		SemesterID: pgtype.UUID{Bytes: semesterID, Valid: true},
	})
}

type UpdateTimetableInput struct {
	StartTime    string
	EndTime      string
	Venue        string
	Level        int32
	DayOfWeek    int32
	EntryType    string
	ClassType    *string
	ExamType     *string
	LecturerID   *uuid.UUID
	Invigilators *string
}

func (s *TimetableService) Update(ctx context.Context, id uuid.UUID, input UpdateTimetableInput) error {
	queries, ok := s.store.(*db.Queries)
	if !ok {
		return nil
	}
	course, err := queries.GetTimetableEntry(ctx, id)
	if err != nil {
		return err
	}
	_ = time.Now()
	return queries.UpdateTimetableEntryFull(ctx, db.CreateTimetableEntrySimpleParams{
		CourseID:     course.CourseID,
		DayOfWeek:    input.DayOfWeek,
		StartTime:    input.StartTime,
		EndTime:      input.EndTime,
		Venue:        input.Venue,
		Level:        input.Level,
		EntryType:    input.EntryType,
		ClassType:    input.ClassType,
		ExamType:     input.ExamType,
		LecturerID:   input.LecturerID,
		Invigilators: input.Invigilators,
	}, id)
}

func (s *TimetableService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteTimetableEntry(ctx, id)
}
