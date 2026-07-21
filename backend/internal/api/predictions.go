package api

import (
	"encoding/json"
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type GPAPredictionItem struct {
	CourseCode  string  `json:"course_code"`
	Credits     int32   `json:"credits"`
	TotalScore  int32   `json:"total_score"`
	GradePoints float64 `json:"grade_points"`
	GradeLetter string  `json:"grade_letter"`
}

func (server *Server) getStudentGPAPrediction(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	grades, err := queries.GetStudentGPAPrediction(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var totalCredits float64
	var totalPoints float64
	var items []GPAPredictionItem

	for _, g := range grades {
		item := GPAPredictionItem{
			CourseCode:  g.CourseCode,
			Credits:     g.Credits,
			TotalScore:  g.TotalScore,
			GradePoints: g.GradePoints,
			GradeLetter: g.GradeLetter,
		}
		items = append(items, item)
		totalCredits += float64(g.Credits)
		totalPoints += g.GradePoints * float64(g.Credits)
	}

	var predictedGPA float64
	if totalCredits > 0 {
		predictedGPA = totalPoints / totalCredits
	}

	ctx.JSON(http.StatusOK, gin.H{
		"student_id":      userID,
		"grades":          items,
		"total_credits":   totalCredits,
		"predicted_gpa":   predictedGPA,
		"total_courses":   len(grades),
	})
}

func (server *Server) getAtRiskStudents(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	limit := int32(20)
	if l := ctx.Query("limit"); l != "" {
		var parsed int32
		for _, c := range l {
			if c >= '0' && c <= '9' {
				parsed = parsed*10 + int32(c-'0')
			}
		}
		if parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	students, err := queries.GetAtRiskStudents(ctx, limit)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	stats := map[string]int{"critical": 0, "high": 0, "medium": 0, "low": 0}
	for _, s := range students {
		stats[s.RiskLevel]++
	}

	ctx.JSON(http.StatusOK, gin.H{
		"students": students,
		"stats":    stats,
		"total":    len(students),
	})
}

func (server *Server) getRevenueForecast(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	stats, err := queries.GetRevenueForecast(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	toFloat64 := func(v interface{}) float64 {
		switch val := v.(type) {
		case float64:
			return val
		case int64:
			return float64(val)
		case int32:
			return float64(val)
		default:
			return 0
		}
	}

	totalExpected := toFloat64(stats.TotalExpected)
	totalCollected := toFloat64(stats.TotalCollected)
	var collectionRate float64
	if totalExpected > 0 {
		collectionRate = (totalCollected / totalExpected) * 100
	}

	ctx.JSON(http.StatusOK, gin.H{
		"avg_monthly":          toFloat64(stats.AvgMonthly),
		"max_monthly":          toFloat64(stats.MaxMonthly),
		"min_monthly":          toFloat64(stats.MinMonthly),
		"months_with_data":     stats.MonthsWithData,
		"total_collected":      totalCollected,
		"projected_next_month": toFloat64(stats.ProjectedNextMonth),
		"semester_total":       toFloat64(stats.SemesterTotal),
		"total_expected":       totalExpected,
		"collection_rate":      collectionRate,
	})
}

func (server *Server) getGradeDistribution(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	courseID := uuid.Nil
	if c := ctx.Query("course_id"); c != "" {
		courseID = uuid.MustParse(c)
	}

	distributions, err := queries.GetGradeDistribution(ctx, courseID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, distributions)
}

func (server *Server) getCoursePassRate(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	courseIDStr := ctx.Param("id")
	courseID, err := uuid.Parse(courseIDStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course ID"})
		return
	}

	stats, err := queries.GetCoursePassRate(ctx, courseID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, stats)
}

func (server *Server) storeAIPrediction(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var req struct {
		PredictionType    string      `json:"prediction_type" binding:"required"`
		TargetID          string      `json:"target_id" binding:"required"`
		PredictedValue    interface{} `json:"predicted_value" binding:"required"`
		ConfidenceInterval float64    `json:"confidence_interval"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	targetID, err := uuid.Parse(req.TargetID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid target_id"})
		return
	}

	predictedJSON, _ := json.Marshal(req.PredictedValue)

	pred, err := queries.CreateAIPrediction(ctx, db.CreateAIPredictionParams{
		PredictionType:     db.PredictionType(req.PredictionType),
		TargetID:           targetID,
		PredictedValue:     predictedJSON,
		ConfidenceInterval: &req.ConfidenceInterval,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, pred)
}
