package api

import (
	"fmt"
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type generateReportRequest struct {
	ReportType string `json:"report_type" binding:"required,oneof=grade_distribution revenue_forecast at_risk_students"`
}

// numericStr stringifies a pgtype.Numeric (used for SUM/AVG results) for
// PDF display — pgtype.Numeric has no plain String() that's safe to call
// on a NULL/invalid value, so this goes through Float64Value defensively.
func numericStr(n pgtype.Numeric) string {
	if !n.Valid {
		return "-"
	}
	f, err := n.Float64Value()
	if err != nil || !f.Valid {
		return "-"
	}
	return fmt.Sprintf("%.2f", f.Float64)
}

// anyNumericStr formats an aggregate result scanned into interface{}
// (GetRevenueForecastRow's SUM/AVG columns) for PDF display. The runtime
// value is actually a pgtype.Numeric — %v on it dumps its internal
// {Int Exp NaN ...} struct fields verbatim rather than a readable number,
// so this type-asserts to format it properly first.
func anyNumericStr(v interface{}) string {
	if n, ok := v.(pgtype.Numeric); ok {
		return numericStr(n)
	}
	return fmt.Sprintf("%v", v)
}

// generateReport POST /reports — builds one of the supported report types
// from real, already-working queries (the same ones behind the Analytics
// pages) into a PDF, saves it, and records it in the reports table
// (migration 000011, unused until now). Generated synchronously since
// these result sets are small.
func (server *Server) generateReport(ctx *gin.Context) {
	var req generateReportRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid report_type"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var title string
	var pdfInput utils.ReportTableInput
	var rowCount int32

	switch req.ReportType {
	case "grade_distribution":
		title = "Grade Distribution Report"
		distributions, err := queries.GetGradeDistribution(ctx, uuid.Nil)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute grade distribution"})
			return
		}
		pdfInput = utils.ReportTableInput{
			Title:   title,
			Headers: []string{"Course", "Students", "Avg Score", "Pass Rate", "A", "B", "C", "D", "E", "F"},
		}
		for _, d := range distributions {
			pdfInput.Rows = append(pdfInput.Rows, []string{
				d.CourseCode, fmt.Sprintf("%d", d.TotalStudents), numericStr(d.AvgScore), numericStr(d.PassRate) + "%",
				fmt.Sprintf("%d", d.GradeA), fmt.Sprintf("%d", d.GradeB), fmt.Sprintf("%d", d.GradeC),
				fmt.Sprintf("%d", d.GradeD), fmt.Sprintf("%d", d.GradeE), fmt.Sprintf("%d", d.GradeF),
			})
		}
		rowCount = int32(len(distributions))

	case "at_risk_students":
		title = "At-Risk Students Report"
		students, err := queries.GetAtRiskStudents(ctx, 200)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute at-risk students"})
			return
		}
		pdfInput = utils.ReportTableInput{
			Title:   title,
			Headers: []string{"Matric No", "Name", "Level", "CGPA", "Risk", "Reason"},
		}
		for _, s := range students {
			pdfInput.Rows = append(pdfInput.Rows, []string{
				s.MatricNumber, s.FullName, fmt.Sprintf("%d", s.Level),
				fmt.Sprintf("%.2f", s.Cgpa), s.RiskLevel, s.RiskReason,
			})
		}
		rowCount = int32(len(students))

	case "revenue_forecast":
		title = "Revenue Forecast Report"
		forecast, err := queries.GetRevenueForecast(ctx)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute revenue forecast"})
			return
		}
		pdfInput = utils.ReportTableInput{
			Title:   title,
			Headers: []string{"Metric", "Value"},
			Rows: [][]string{
				{"Average Monthly Collections", anyNumericStr(forecast.AvgMonthly)},
				{"Max Monthly Collections", anyNumericStr(forecast.MaxMonthly)},
				{"Min Monthly Collections", anyNumericStr(forecast.MinMonthly)},
				{"Months With Data", fmt.Sprintf("%d", forecast.MonthsWithData)},
				{"Total Collected", anyNumericStr(forecast.TotalCollected)},
				{"Projected Next Month", fmt.Sprintf("%d", forecast.ProjectedNextMonth)},
				{"Semester Total", anyNumericStr(forecast.SemesterTotal)},
				{"Total Expected", anyNumericStr(forecast.TotalExpected)},
			},
		}
		rowCount = int32(len(pdfInput.Rows))
	}

	report, err := server.store.CreateReport(ctx, title, req.ReportType, "pdf", getUserID(ctx))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to record report"})
		return
	}

	pdfBytes, err := utils.GenerateTablePDF(pdfInput)
	if err != nil {
		_ = server.store.FailReport(ctx, report.ID)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate report PDF"})
		return
	}

	relPath, err := server.storage.SaveBytes(pdfBytes, "reports", ".pdf")
	if err != nil {
		_ = server.store.FailReport(ctx, report.ID)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save report file"})
		return
	}

	if err := server.store.CompleteReport(ctx, report.ID, relPath, rowCount); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to finalize report"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"id":          report.ID,
		"title":       title,
		"report_type": req.ReportType,
		"file_url":    relPath,
		"row_count":   rowCount,
		"status":      "completed",
	})
}

// listReports GET /reports — past generated reports, most recent first.
func (server *Server) listReports(ctx *gin.Context) {
	reports, err := server.store.ListReports(ctx, 50)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if reports == nil {
		reports = []db.Report{}
	}
	ctx.JSON(http.StatusOK, gin.H{"data": reports})
}
