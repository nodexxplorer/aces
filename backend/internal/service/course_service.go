package service

import (
	"context"
	"errors"
	"strings"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type CourseService struct {
	store db.Querier
}

func NewCourseService(store db.Querier) *CourseService {
	return &CourseService{store: store}
}

type CreateCourseInput struct {
	Code           string
	Title          string
	Description    *string
	Unit           int32
	Level          int32
	Semester       string
	LecturerID     *string
	PrerequisiteID *string
	MaxCreditHours *int32
	IsActive       bool
	CourseType     string
}

func (s *CourseService) Create(ctx context.Context, input CreateCourseInput) (db.Course, error) {
	courseType := input.CourseType
	if courseType == "" {
		courseType = "departmental"
	}

	arg := db.CreateCourseParams{
		Code:        strings.ToUpper(strings.TrimSpace(input.Code)),
		Title:       strings.TrimSpace(input.Title),
		Description: input.Description,
		Unit:        input.Unit,
		Level:       input.Level,
		Semester:    db.SemesterSeason(input.Semester),
		IsActive:    input.IsActive,
		CourseType:  courseType,
	}

	if input.LecturerID != nil {
		id, err := uuid.Parse(*input.LecturerID)
		if err != nil {
			return db.Course{}, errors.New("invalid lecturer_id")
		}
		arg.LecturerID = pgtype.UUID{Bytes: id, Valid: true}
	}

	if input.PrerequisiteID != nil {
		id, err := uuid.Parse(*input.PrerequisiteID)
		if err != nil {
			return db.Course{}, errors.New("invalid prerequisite_id")
		}
		arg.PrerequisiteID = pgtype.UUID{Bytes: id, Valid: true}
	}

	arg.MaxCreditHours = input.MaxCreditHours

	return s.store.CreateCourse(ctx, arg)
}

func (s *CourseService) GetByID(ctx context.Context, id uuid.UUID) (db.Course, error) {
	return s.store.GetCourse(ctx, id)
}

func (s *CourseService) GetByCode(ctx context.Context, code string) (db.Course, error) {
	return s.store.GetCourseByCode(ctx, strings.ToUpper(code))
}

func (s *CourseService) GetByIDOrCode(ctx context.Context, idOrCode string) (db.Course, error) {
	id, err := uuid.Parse(idOrCode)
	if err != nil {
		course, err := s.store.GetCourseByCode(ctx, strings.ToUpper(idOrCode))
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return db.Course{}, errors.New("course not found")
			}
			return db.Course{}, err
		}
		return course, nil
	}

	course, err := s.store.GetCourse(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Course{}, errors.New("course not found")
		}
		return db.Course{}, err
	}
	return course, nil
}

func (s *CourseService) List(ctx context.Context, limit, offset int32) ([]db.Course, error) {
	return s.store.ListCourses(ctx, db.ListCoursesParams{Limit: limit, Offset: offset})
}

type UpdateCourseInput struct {
	Title       string
	Description *string
	Unit        int32
	Level       int32
	Semester    string
	LecturerID  *string
	IsActive    bool
	CourseType  string
}

func (s *CourseService) Update(ctx context.Context, id uuid.UUID, input UpdateCourseInput) (db.Course, error) {
	courseType := input.CourseType
	if courseType == "" {
		courseType = "departmental"
	}

	arg := db.UpdateCourseParams{
		ID:          id,
		Title:       strings.TrimSpace(input.Title),
		Description: input.Description,
		Unit:        input.Unit,
		Level:       input.Level,
		Semester:    db.SemesterSeason(input.Semester),
		IsActive:    input.IsActive,
		CourseType:  courseType,
	}

	if input.LecturerID != nil {
		lecturerID, err := uuid.Parse(*input.LecturerID)
		if err != nil {
			return db.Course{}, errors.New("invalid lecturer_id")
		}
		arg.LecturerID = pgtype.UUID{Bytes: lecturerID, Valid: true}
	}

	return s.store.UpdateCourse(ctx, arg)
}

func (s *CourseService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteCourse(ctx, id)
}
