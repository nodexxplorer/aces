package api

import (
	"net/http"
	"strconv"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type createTimetableEntryRequest struct {
	CourseID     string  `json:"courseId" binding:"required"`
	DayOfWeek    int32   `json:"dayOfWeek" binding:"required,min=1,max=5"`
	StartTime    string  `json:"startTime" binding:"required"`
	EndTime      string  `json:"endTime" binding:"required"`
	Venue        string  `json:"venue" binding:"required"`
	Level        int32   `json:"level" binding:"required"`
	EntryType    string  `json:"entryType" binding:"required,oneof=class exam"`
	ClassType    *string `json:"classType"`
	ExamType     *string `json:"examType"`
	LecturerID   *string `json:"lecturerId"`
	Invigilators *string `json:"invigilators"`
}

type updateTimetableEntryRequest struct {
	CourseID     string  `json:"courseId" binding:"required"`
	DayOfWeek    int32   `json:"dayOfWeek" binding:"required,min=1,max=5"`
	StartTime    string  `json:"startTime" binding:"required"`
	EndTime      string  `json:"endTime" binding:"required"`
	Venue        string  `json:"venue" binding:"required"`
	Level        int32   `json:"level" binding:"required"`
	EntryType    string  `json:"entryType" binding:"required,oneof=class exam"`
	ClassType    *string `json:"classType"`
	ExamType     *string `json:"examType"`
	LecturerID   *string `json:"lecturerId"`
	Invigilators *string `json:"invigilators"`
}

func (server *Server) createTimetableEntry(ctx *gin.Context) {
	var req createTimetableEntryRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid courseId"})
		return
	}

	var lecturerID *uuid.UUID
	if req.LecturerID != nil {
		lid, err := uuid.Parse(*req.LecturerID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid lecturerId"})
			return
		}
		lecturerID = &lid
	}

	id, err := server.timetables.Create(ctx, service.CreateTimetableInput{
		CourseID:     courseID,
		DayOfWeek:    req.DayOfWeek,
		StartTime:    req.StartTime,
		EndTime:      req.EndTime,
		Venue:        req.Venue,
		Level:        req.Level,
		EntryType:    req.EntryType,
		ClassType:    req.ClassType,
		ExamType:     req.ExamType,
		LecturerID:   lecturerID,
		Invigilators: req.Invigilators,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	entry, err := server.timetables.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusCreated, gin.H{"id": id})
		return
	}

	ctx.JSON(http.StatusCreated, entry)
}

func (server *Server) getTimetableEntry(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid timetable id"})
		return
	}

	entry, err := server.timetables.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "timetable entry not found"})
		return
	}

	ctx.JSON(http.StatusOK, entry)
}

func (server *Server) listTimetableEntries(ctx *gin.Context) {
	entryType := ctx.DefaultQuery("entryType", "")
	levelStr := ctx.DefaultQuery("level", "")

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if entryType == "class" || entryType == "exam" {
		var level *int32
		if levelStr != "" {
			if v, err := strconv.ParseInt(levelStr, 10, 32); err == nil {
				l := int32(v)
				level = &l
			}
		}
		entries, err := queries.ListTimetableByType(ctx, db.ListTimetableByTypeParams{
			EntryType: entryType,
			Level:     level,
		})
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		ctx.JSON(http.StatusOK, entries)
		return
	}

	entries, err := queries.ListAllTimetableEntries(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, entries)
}

func (server *Server) updateTimetableEntry(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid timetable id"})
		return
	}

	var req updateTimetableEntryRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid courseId"})
		return
	}

	var lecturerID *uuid.UUID
	if req.LecturerID != nil {
		lid, err := uuid.Parse(*req.LecturerID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid lecturerId"})
			return
		}
		lecturerID = &lid
	}

	_ = courseID
	err = server.timetables.Update(ctx, id, service.UpdateTimetableInput{
		DayOfWeek:    req.DayOfWeek,
		StartTime:    req.StartTime,
		EndTime:      req.EndTime,
		Venue:        req.Venue,
		Level:        req.Level,
		EntryType:    req.EntryType,
		ClassType:    req.ClassType,
		ExamType:     req.ExamType,
		LecturerID:   lecturerID,
		Invigilators: req.Invigilators,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	entry, err := server.timetables.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusOK, gin.H{"id": id})
		return
	}

	ctx.JSON(http.StatusOK, entry)
}

func (server *Server) deleteTimetableEntry(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid timetable id"})
		return
	}

	if err := server.timetables.Delete(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "timetable entry deleted successfully"})
}

type publishRequest struct {
	EntryType string `json:"entry_type" binding:"required,oneof=class exam"`
	Publish   bool   `json:"publish"`
}

func (server *Server) publishTimetable(ctx *gin.Context) {
	var req publishRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if req.Publish {
		err := queries.PublishTimetableByType(ctx, req.EntryType)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"message": req.EntryType + " timetable published"})
	} else {
		err := queries.UnpublishTimetableByType(ctx, req.EntryType)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"message": req.EntryType + " timetable unpublished"})
	}
}

type checkConflictsRequest struct {
	EntryType string `json:"entry_type" binding:"required,oneof=class exam"`
	Level     *int32 `json:"level"`
}

func (server *Server) checkTimetableConflicts(ctx *gin.Context) {
	entryType := ctx.Query("entryType")
	if entryType == "" {
		entryType = "class"
	}

	var level *int32
	if levelStr := ctx.Query("level"); levelStr != "" {
		if v, err := strconv.ParseInt(levelStr, 10, 32); err == nil {
			l := int32(v)
			level = &l
		}
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	entries, err := queries.CheckTimetableConflicts(ctx, db.ListTimetableByTypeParams{
		EntryType: entryType,
		Level:     level,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type conflict struct {
		Type     string `json:"type"`
		Message  string `json:"message"`
		Entry1ID string `json:"entry1_id"`
		Entry2ID string `json:"entry2_id"`
	}

	conflicts := []conflict{}

	// Detect venue + day + time overlaps
	for i := 0; i < len(entries); i++ {
		for j := i + 1; j < len(entries); j++ {
			a, b := entries[i], entries[j]

			// Same day check for class timetable
			if a.DayOfWeek != nil && b.DayOfWeek != nil {
				if *a.DayOfWeek != *b.DayOfWeek {
					continue
				}
			}

			// Time overlap check (string comparison works for HH:MM format)
			if a.StartTime < b.EndTime && b.StartTime < a.EndTime {
				// Venue clash
				if a.Venue == b.Venue {
					conflicts = append(conflicts, conflict{
						Type:     "venue_clash",
						Message:  a.CourseCode + " and " + b.CourseCode + " both in " + a.Venue + " at overlapping times",
						Entry1ID: a.ID.String(),
						Entry2ID: b.ID.String(),
					})
				}

				// Level clash
				if a.Level != nil && b.Level != nil && *a.Level == *b.Level {
					conflicts = append(conflicts, conflict{
						Type:     "level_clash",
						Message:  strconv.Itoa(int(*a.Level)) + "L has " + a.CourseCode + " and " + b.CourseCode + " at overlapping times",
						Entry1ID: a.ID.String(),
						Entry2ID: b.ID.String(),
					})
				}

				// Lecturer clash
				if a.LecturerID != nil && b.LecturerID != nil && *a.LecturerID == *b.LecturerID {
					conflicts = append(conflicts, conflict{
						Type:     "lecturer_clash",
						Message:  "Lecturer assigned to both " + a.CourseCode + " and " + b.CourseCode + " at overlapping times",
						Entry1ID: a.ID.String(),
						Entry2ID: b.ID.String(),
					})
				}
			}
		}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"conflict_count": len(conflicts),
		"conflicts":      conflicts,
	})
}

func (server *Server) bulkDeleteTimetable(ctx *gin.Context) {
	entryType := ctx.Query("entryType")
	levelStr := ctx.Query("level")

	if entryType == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "entryType is required"})
		return
	}

	query := "DELETE FROM timetable WHERE entry_type = $1"
	args := []interface{}{entryType}
	idx := 2
	if levelStr != "" {
		if _, err := strconv.ParseInt(levelStr, 10, 32); err == nil {
			query += " AND level = $" + strconv.Itoa(idx)
			args = append(args, levelStr)
			idx++
		}
	}

	if dbq, ok := server.store.(interface{ GetDB() db.DBTX }); ok {
		result, err := dbq.GetDB().Exec(ctx, query, args...)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		rowsAffected := result.RowsAffected()
		ctx.JSON(http.StatusOK, gin.H{"deleted": rowsAffected})
		return
	}

	ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
}
