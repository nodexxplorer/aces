package api

import (
	"errors"
	"log"
	"net/http"

	"github.com/aces/backend/internal/attendance"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

func (server *Server) verifiedAttendance() *attendance.Service {
	return &attendance.Service{Pool: server.dbPool}
}
func attendanceResponse(ctx *gin.Context, data any, err error) {
	if err == nil {
		ctx.JSON(http.StatusOK, gin.H{"data": data})
		return
	}
	var dbError *pgconn.PgError
	if errors.As(err, &dbError) && dbError.Code == "23505" {
		err = attendance.ErrConflict
	}
	status := http.StatusInternalServerError
	message := "attendance service unavailable"
	switch {
	case errors.Is(err, attendance.ErrInvalid):
		status = 400
		message = err.Error()
	case errors.Is(err, attendance.ErrForbidden):
		status = 403
		message = err.Error()
	case errors.Is(err, attendance.ErrConflict):
		status = 409
		message = err.Error()
	case errors.Is(err, attendance.ErrChallenge):
		status = 400
		message = err.Error()
	case errors.Is(err, attendance.ErrLimit):
		status = 429
		message = err.Error()
	default:
		log.Printf("[verified-attendance] %v", err)
	}
	ctx.JSON(status, gin.H{"error": message})
}
func (server *Server) attendanceCatalogV2(ctx *gin.Context) {
	data, err := server.verifiedAttendance().Catalog(ctx.Request.Context(), getUserID(ctx))
	attendanceResponse(ctx, data, err)
}
func (server *Server) attendanceCreateV2(ctx *gin.Context) {
	var req attendance.CreateRequest
	if ctx.ShouldBindJSON(&req) != nil {
		attendanceResponse(ctx, nil, attendance.ErrInvalid)
		return
	}
	data, err := server.verifiedAttendance().Create(ctx.Request.Context(), getUserID(ctx), req)
	attendanceResponse(ctx, data, err)
}
func (server *Server) attendanceSessionsV2(ctx *gin.Context) {
	course, e := uuid.Parse(ctx.Query("course"))
	semester, e2 := uuid.Parse(ctx.Query("semester"))
	if e != nil || e2 != nil {
		attendanceResponse(ctx, nil, attendance.ErrInvalid)
		return
	}
	data, err := server.verifiedAttendance().List(ctx.Request.Context(), getUserID(ctx), course, semester)
	attendanceResponse(ctx, data, err)
}
func (server *Server) attendanceDetailV2(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		attendanceResponse(ctx, nil, attendance.ErrInvalid)
		return
	}
	data, err := server.verifiedAttendance().Detail(ctx.Request.Context(), getUserID(ctx), id)
	attendanceResponse(ctx, data, err)
}
func (server *Server) attendanceCodeV2(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		attendanceResponse(ctx, nil, attendance.ErrInvalid)
		return
	}
	data, err := server.verifiedAttendance().Code(ctx.Request.Context(), getUserID(ctx), id)
	attendanceResponse(ctx, data, err)
}
func (server *Server) attendanceActionV2(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		attendanceResponse(ctx, nil, attendance.ErrInvalid)
		return
	}
	svc := server.verifiedAttendance()
	actor := getUserID(ctx)
	c := ctx.Request.Context()
	switch ctx.Param("action") {
	case "checkin":
		var req attendance.CheckinRequest
		if ctx.ShouldBindJSON(&req) != nil {
			attendanceResponse(ctx, nil, attendance.ErrInvalid)
			return
		}
		data, e := svc.Checkin(c, actor, id, req)
		attendanceResponse(ctx, data, e)
	case "review":
		var req attendance.ReviewRequest
		if ctx.ShouldBindJSON(&req) != nil {
			attendanceResponse(ctx, nil, attendance.ErrInvalid)
			return
		}
		attendanceResponse(ctx, gin.H{"saved": true}, svc.Review(c, actor, id, req))
	case "dispute":
		var req struct {
			Reason string `json:"reason"`
		}
		if ctx.ShouldBindJSON(&req) != nil {
			attendanceResponse(ctx, nil, attendance.ErrInvalid)
			return
		}
		attendanceResponse(ctx, gin.H{"saved": true}, svc.Dispute(c, actor, id, req.Reason))
	default:
		var req attendance.ActionRequest
		if ctx.ShouldBindJSON(&req) != nil {
			attendanceResponse(ctx, nil, attendance.ErrInvalid)
			return
		}
		data, e := svc.Act(c, actor, id, ctx.Param("action"), req)
		attendanceResponse(ctx, data, e)
	}
}
func (server *Server) attendanceEligibilityV2(ctx *gin.Context) {
	if ctx.Request.Method == http.MethodGet && ctx.Param("report") != "eligibility" && ctx.Param("report") != "snapshots" {
		attendanceResponse(ctx, nil, attendance.ErrInvalid)
		return
	}
	course, e := uuid.Parse(ctx.Param("course"))
	semester, e2 := uuid.Parse(ctx.Param("semester"))
	if e != nil || e2 != nil {
		attendanceResponse(ctx, nil, attendance.ErrInvalid)
		return
	}
	svc := server.verifiedAttendance()
	var data any
	var err error
	if ctx.Param("report") == "snapshots" && ctx.Request.Method == http.MethodGet {
		data, err = svc.Snapshots(ctx.Request.Context(), getUserID(ctx), course, semester)
	} else {
		data, err = svc.Eligibility(ctx.Request.Context(), getUserID(ctx), course, semester, ctx.Request.Method == http.MethodPost)
	}
	attendanceResponse(ctx, data, err)
}
