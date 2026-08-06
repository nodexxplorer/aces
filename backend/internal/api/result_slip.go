package api

import (
	"fmt"
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/aces/backend/internal/utils"
)

type resultSlipQuery struct {
	SessionID  string `form:"session_id"  binding:"required,uuid"`
	SemesterID string `form:"semester_id" binding:"required,uuid"`
	StudentID  string `form:"student_id"  binding:"omitempty,uuid"`
}

// downloadResultSlip GET /results/slip — a single semester's results as a
// branded PDF, distinct from the full multi-year transcript request/approval
// flow, for things like scholarship applications.
func (server *Server) downloadResultSlip(ctx *gin.Context) {
	var q resultSlipQuery
	if err := ctx.ShouldBindQuery(&q); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "session_id and semester_id are required"})
		return
	}

	studentID, err := server.resolveStudentIDForPaymentRead(ctx, q.StudentID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
	}

	sessionID, err := uuid.Parse(q.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}
	semesterID, err := uuid.Parse(q.SemesterID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid semester_id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	student, err := server.store.GetStudent(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "student not found"})
		return
	}
	user, err := server.store.GetUser(ctx, student.UserID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "student not found"})
		return
	}
	session, err := server.store.GetSession(ctx, sessionID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}
	semester, err := server.store.GetSemester(ctx, semesterID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "semester not found"})
		return
	}

	rows, err := queries.ListStudentResultsBySemester(ctx, studentID, sessionID, semesterID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if len(rows) == 0 {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "no approved results found for that session/semester"})
		return
	}

	var totalGradePoints, totalUnits float64
	courses := make([]utils.ResultSlipCourse, 0, len(rows))
	for _, r := range rows {
		score, _ := r.TotalScore.Float64()
		gp, _ := r.GradePoint.Float64()
		totalGradePoints += gp * float64(r.Unit)
		totalUnits += float64(r.Unit)
		courses = append(courses, utils.ResultSlipCourse{
			CourseCode: r.CourseCode, CourseTitle: r.CourseTitle, Unit: int(r.Unit),
			Score: score, Grade: r.Grade, GradePoint: gp,
		})
	}
	semesterGPA := 0.0
	if totalUnits > 0 {
		semesterGPA = totalGradePoints / totalUnits
	}

	cumulativeCGPA := 0.0
	if cgpaResult, err := server.students.CalculateCGPA(ctx, studentID); err == nil {
		cumulativeCGPA = cgpaResult.CGPA
	}

	pdfBytes, err := utils.GenerateResultSlipPDF(utils.ResultSlipInput{
		StudentName:    user.FullName,
		MatricNumber:   student.MatricNumber,
		Level:          int(student.Level),
		SessionName:    session.Name,
		SemesterName:   string(semester.Name),
		Courses:        courses,
		SemesterGPA:    semesterGPA,
		CumulativeCGPA: cumulativeCGPA,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	filename := fmt.Sprintf("result-slip-%s-%s.pdf", student.MatricNumber, semester.Name)
	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	ctx.Data(http.StatusOK, "application/pdf", pdfBytes)
}
