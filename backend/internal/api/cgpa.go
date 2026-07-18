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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get CGPA settings: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, settings)
}

func (server *Server) updateCgpaSettings(ctx *gin.Context) {
	var req updateCgpaSettingsRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update CGPA settings: " + err.Error()})
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

	result, err := server.students.CalculateCGPA(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}
