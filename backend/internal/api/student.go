package api

import (
	"net/http"
	"strings"

	"github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type createStudentRequest struct {
	UserID           string `json:"user_id" binding:"required,uuid"`
	MatricNumber     string `json:"matric_number" binding:"required,min=5,max=50"`
	Level            int32  `json:"level" binding:"required,min=100,max=700"`
	EntryYear        int32  `json:"entry_year" binding:"required"`
	CurrentSessionID string `json:"current_session_id" binding:"omitempty,uuid"`
	CurrentSemester  string `json:"current_semester" binding:"omitempty,oneof=harmattan rain"`
}

func (server *Server) createStudent(ctx *gin.Context) {
	var req createStudentRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}

	arg := db.CreateStudentParams{
		UserID:       userID,
		MatricNumber: strings.ToUpper(strings.TrimSpace(req.MatricNumber)), // standardize matric numbers to uppercase
		Level:        req.Level,
		EntryYear:    req.EntryYear,
	}

	if req.CurrentSessionID != "" {
		sessionID, err := uuid.Parse(req.CurrentSessionID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid current_session_id"})
			return
		}
		arg.CurrentSessionID = pgtype.UUID{Bytes: sessionID, Valid: true}
	}

	if req.CurrentSemester != "" {
		arg.CurrentSemester = db.NullSemesterSeason{
			SemesterSeason: db.SemesterSeason(req.CurrentSemester),
			Valid:          true,
		}
	}

	student, err := server.store.CreateStudent(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, student)
}
