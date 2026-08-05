package api

import (
	"fmt"
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type createCourseRequest struct {
	Code           string  `json:"code" binding:"required"`
	Title          string  `json:"title" binding:"required"`
	Description    *string `json:"description" binding:"omitempty"`
	Unit           int32   `json:"unit" binding:"required,min=1"`
	Level          int32   `json:"level" binding:"required,min=100"`
	Semester       string  `json:"semester" binding:"required,oneof=first second harmattan rain"`
	LecturerID     *string `json:"lecturer_id" binding:"omitempty,uuid"`
	PrerequisiteID *string `json:"prerequisite_id" binding:"omitempty,uuid"`
	MaxCreditHours *int32  `json:"max_credit_hours" binding:"omitempty,min=1"`
	IsActive       bool    `json:"is_active"`
	CourseType     string  `json:"course_type" binding:"omitempty,oneof=departmental non_departmental"`
}

func (server *Server) createCourse(ctx *gin.Context) {
	var req createCourseRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	course, err := server.courses.Create(ctx, service.CreateCourseInput{
		Code:           req.Code,
		Title:          req.Title,
		Description:    req.Description,
		Unit:           req.Unit,
		Level:          req.Level,
		Semester:       req.Semester,
		LecturerID:     req.LecturerID,
		PrerequisiteID: req.PrerequisiteID,
		MaxCreditHours: req.MaxCreditHours,
		IsActive:       req.IsActive,
		CourseType:     req.CourseType,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if req.LecturerID != nil && *req.LecturerID != "" {
		queries, ok := server.store.(*db.Queries)
		if ok {
			lecUUID, errLec := uuid.Parse(*req.LecturerID)
			if errLec == nil {
				actualLecturerID := lecUUID
				var profileID uuid.UUID
				if errP := queries.GetDB().QueryRow(ctx, `SELECT id FROM lecturers WHERE id = $1 OR user_id = $1`, lecUUID).Scan(&profileID); errP == nil {
					actualLecturerID = profileID
				}
				sessionID := uuid.Nil
				sem := req.Semester
				var si struct {
					ID       uuid.UUID
					Semester string
				}
				_ = queries.GetDB().QueryRow(ctx, `
					SELECT s.id, COALESCE(sem.name, 'first') as semester
					FROM sessions s
					LEFT JOIN semesters sem ON sem.session_id = s.id AND sem.is_active = true
					WHERE s.is_active = true
					ORDER BY s.created_at DESC LIMIT 1
				`).Scan(&si.ID, &si.Semester)
				if si.ID != uuid.Nil {
					sessionID = si.ID
					sem = si.Semester
				}
				actorID := getUserID(ctx)
				_, _ = queries.AssignCourseToLecturer(ctx, db.AssignCourseToLecturerParams{
					LecturerID: actualLecturerID,
					CourseID:   course.ID,
					SessionID:  sessionID,
					Semester:   sem,
					AssignedBy: actorID,
					IsPrimary:  true,
				})
			}
		}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": course})
}

func (server *Server) getCourse(ctx *gin.Context) {
	idStr := ctx.Param("id")

	course, err := server.courses.GetByIDOrCode(ctx, idStr)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": course})
}

type listCoursesRequest struct {
	PageID   int32 `form:"page_id" binding:"required,min=1"`
	PageSize int32 `form:"page_size" binding:"required,min=5,max=100"`
}

func (server *Server) listCourses(ctx *gin.Context) {
	var req listCoursesRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	courses, err := server.courses.List(ctx, req.PageSize, (req.PageID-1)*req.PageSize)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": courses, "total": len(courses), "page": req.PageID, "perPage": req.PageSize, "totalPages": 1})
}

type updateCourseRequest struct {
	Title           *string `json:"title"`
	TitleCamel      *string `json:"titleCamel"`
	Description     *string `json:"description"`
	Unit            *int32  `json:"unit"`
	Level           *int32  `json:"level"`
	Semester        *string `json:"semester"`
	LecturerID      *string `json:"lecturer_id"`
	LecturerIDCamel *string `json:"lecturerId"`
	IsActive        *bool   `json:"is_active"`
	IsActiveCamel   *bool   `json:"isActive"`
	CourseType      *string `json:"course_type"`
}

func (server *Server) updateCourse(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	var req updateCourseRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	existing, err := server.courses.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
		return
	}

	title := existing.Title
	if req.Title != nil {
		title = *req.Title
	} else if req.TitleCamel != nil {
		title = *req.TitleCamel
	}

	description := existing.Description
	if req.Description != nil {
		description = req.Description
	}

	unit := existing.Unit
	if req.Unit != nil {
		unit = *req.Unit
	}

	level := existing.Level
	if req.Level != nil {
		level = *req.Level
	}

	semester := string(existing.Semester)
	if req.Semester != nil {
		semester = *req.Semester
	}

	var lecturerID *string
	if req.LecturerID != nil {
		lecturerID = req.LecturerID
	} else if req.LecturerIDCamel != nil {
		lecturerID = req.LecturerIDCamel
	} else if existing.LecturerID.Valid {
		uid := uuid.UUID(existing.LecturerID.Bytes).String()
		lecturerID = &uid
	}

	if (req.LecturerID != nil && *req.LecturerID == "") || (req.LecturerIDCamel != nil && *req.LecturerIDCamel == "") {
		lecturerID = nil
	}

	isActive := existing.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	} else if req.IsActiveCamel != nil {
		isActive = *req.IsActiveCamel
	}

	courseType := existing.CourseType
	if req.CourseType != nil {
		courseType = *req.CourseType
	}

	course, err := server.courses.Update(ctx, id, service.UpdateCourseInput{
		Title:       title,
		Description: description,
		Unit:        unit,
		Level:       level,
		Semester:    semester,
		LecturerID:  lecturerID,
		IsActive:    isActive,
		CourseType:  courseType,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if ok && lecturerID != nil {
		if *lecturerID == "" {
			_, _ = queries.GetDB().Exec(ctx, `DELETE FROM lecturer_course_assignments WHERE course_id = $1`, id)
		} else {
			lecUUID, errLec := uuid.Parse(*lecturerID)
			if errLec == nil {
				actualLecturerID := lecUUID
				var profileID uuid.UUID
				if errP := queries.GetDB().QueryRow(ctx, `SELECT id FROM lecturers WHERE id = $1 OR user_id = $1`, lecUUID).Scan(&profileID); errP == nil {
					actualLecturerID = profileID
				}
				sessionID := uuid.Nil
				sem := semester
				if sem == "" {
					sem = "first"
				}
				var si struct {
					ID       uuid.UUID
					Semester string
				}
				_ = queries.GetDB().QueryRow(ctx, `
					SELECT s.id, COALESCE(sem.name, 'first') as semester
					FROM sessions s
					LEFT JOIN semesters sem ON sem.session_id = s.id AND sem.is_active = true
					WHERE s.is_active = true
					ORDER BY s.created_at DESC LIMIT 1
				`).Scan(&si.ID, &si.Semester)
				if si.ID != uuid.Nil {
					sessionID = si.ID
					sem = si.Semester
				}
				actorID := getUserID(ctx)
				_, _ = queries.AssignCourseToLecturer(ctx, db.AssignCourseToLecturerParams{
					LecturerID: actualLecturerID,
					CourseID:   id,
					SessionID:  sessionID,
					Semester:   sem,
					AssignedBy: actorID,
					IsPrimary:  true,
				})
			}
		}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": course})
}

func (server *Server) deleteCourse(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	err = server.courses.Delete(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "course deleted"})
}

func (server *Server) listCoursesByLevelAndSemester(ctx *gin.Context) {
	levelStr := ctx.Query("level")
	semester := ctx.Query("semester")

	if levelStr == "" || semester == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "level and semester query params required"})
		return
	}

	var level int32
	if _, err := fmt.Sscanf(levelStr, "%d", &level); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid level"})
		return
	}

	if semester != "harmattan" && semester != "rain" && semester != "first" && semester != "second" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "semester must be first, second, harmattan or rain"})
		return
	}

	courses, err := server.store.ListCoursesByLevelAndSemester(ctx, db.ListCoursesByLevelAndSemesterParams{
		Level:    level,
		Semester: db.SemesterSeason(semester),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": courses})
}

func (server *Server) countCourses(ctx *gin.Context) {
	count, err := server.store.CountCourses(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"count": count})
}

func (server *Server) getCourseClassList(ctx *gin.Context) {
	courseIDStr := ctx.Param("id")
	courseID, err := uuid.Parse(courseIDStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	type ClassListStudent struct {
		StudentID    string `json:"student_id"`
		MatricNumber string `json:"matric_number"`
		Name         string `json:"name"`
		CourseCode   string `json:"course_code"`
		Status       string `json:"status"`
	}

	rows, err := queries.GetDB().Query(ctx, `
		SELECT DISTINCT ON (COALESCE(s.matric_number, u.email))
			COALESCE(s.id::text, '') AS student_id,
			COALESCE(s.matric_number, '—') AS matric_number,
			COALESCE(u.full_name, u.email, 'Student') AS name,
			COALESCE(c.code, '') AS course_code,
			COALESCE(r.status::text, rc.status, cr.status, 'enrolled') AS status
		FROM registered_courses rc
		JOIN course_registrations cr ON cr.id = rc.registration_id
		JOIN students s ON s.id = cr.student_id
		JOIN users u ON u.id = s.user_id
		JOIN courses c ON c.id = rc.course_id
		LEFT JOIN (
			SELECT res.student_id, res.course_id, res.status
			FROM results res
			WHERE res.course_id = $1
		) r ON r.student_id = s.id
		WHERE rc.course_id = $1

		UNION

		SELECT
			COALESCE(res.student_id::text, st.id::text, '') AS student_id,
			COALESCE(res.matric_number, st.matric_number, '—') AS matric_number,
			COALESCE(us.full_name, us.email, 'Student') AS name,
			COALESCE(c.code, '') AS course_code,
			res.status::text AS status
		FROM results res
		JOIN courses c ON c.id = res.course_id
		LEFT JOIN students st ON st.id = res.student_id
		LEFT JOIN users us ON us.id = st.user_id
		WHERE res.course_id = $1
		  AND (res.student_id IS NULL OR res.student_id NOT IN (
			SELECT cr.student_id
			FROM registered_courses rc2
			JOIN course_registrations cr ON cr.id = rc2.registration_id
			WHERE rc2.course_id = $1
		  ))
	`, courseID)

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	defer rows.Close()

	var result []ClassListStudent
	for rows.Next() {
		var item ClassListStudent
		if err := rows.Scan(&item.StudentID, &item.MatricNumber, &item.Name, &item.CourseCode, &item.Status); err == nil {
			result = append(result, item)
		}
	}

	if result == nil {
		result = []ClassListStudent{}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": result})
}
