package api

import (
	"net/http"

	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type cgpaRuleRequest struct {
	MinScore   float64 `json:"min_score" binding:"required"`
	MaxScore   float64 `json:"max_score" binding:"required"`
	Grade      string  `json:"grade" binding:"required"`
	GradePoint float64 `json:"grade_point" binding:"required"`
}

type standingRuleRequest struct {
	MinCgpa  float64 `json:"min_cgpa" binding:"required"`
	MaxCgpa  float64 `json:"max_cgpa" binding:"required"`
	Standing string  `json:"standing" binding:"required"`
}

type updateCgpaSettingsRequest struct {
	CgpaRules     []cgpaRuleRequest     `json:"cgpa_rules"`
	StandingRules []standingRuleRequest `json:"standing_rules"`
}

func (server *Server) getCgpaSettings(ctx *gin.Context) {
	settings, err := server.cgpa.GetSettings(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, settings)
}

func (server *Server) updateCgpaSettings(ctx *gin.Context) {
	var req updateCgpaSettingsRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	rules := make([]service.CGPARuleInput, len(req.CgpaRules))
	for i, r := range req.CgpaRules {
		rules[i] = service.CGPARuleInput{
			MinScore:   r.MinScore,
			MaxScore:   r.MaxScore,
			Grade:      r.Grade,
			GradePoint: r.GradePoint,
		}
	}

	standingRules := make([]service.StandingRuleInput, len(req.StandingRules))
	for i, r := range req.StandingRules {
		standingRules[i] = service.StandingRuleInput{
			MinCgpa:  r.MinCgpa,
			MaxCgpa:  r.MaxCgpa,
			Standing: r.Standing,
		}
	}

	err := server.cgpa.UpdateSettings(ctx, service.UpdateCGPASettingsInput{
		CgpaRules:     rules,
		StandingRules: standingRules,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "settings updated successfully"})
}

func (server *Server) calculateCgpa(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("studentId"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student ID"})
		return
	}

	if !requireOwnershipOrStaff(ctx, server.store, studentID) {
		return
	}

	result, err := server.students.CalculateCGPA(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

type cgpaSimulateOverride struct {
	CourseID string  `json:"course_id" binding:"required,uuid"`
	Score    float64 `json:"score"      binding:"required,min=0,max=100"`
}

type cgpaSimulateRequest struct {
	Overrides []cgpaSimulateOverride `json:"overrides" binding:"required,min=1,dive"`
}

// simulateCgpa POST /cgpa/simulate — "what if I score X in course Y" for the
// authenticated student, computed against their real approved results.
func (server *Server) simulateCgpa(ctx *gin.Context) {
	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "internal server error"})
		return
	}

	var req cgpaSimulateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	overrides := make([]service.ScoreOverride, 0, len(req.Overrides))
	for _, o := range req.Overrides {
		courseID, err := uuid.Parse(o.CourseID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
			return
		}
		overrides = append(overrides, service.ScoreOverride{CourseID: courseID, Score: o.Score})
	}

	simulation, err := server.students.SimulateCGPA(ctx, studentID, overrides)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": simulation})
}

// getMyApprovedResults GET /cgpa/my-results — the authenticated student's
// real approved results with course details, used to seed the what-if
// simulator with actual data instead of free-text entry.
func (server *Server) getMyApprovedResults(ctx *gin.Context) {
	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "internal server error"})
		return
	}

	results, err := server.students.GetApprovedResultsDetailed(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": results})
}
