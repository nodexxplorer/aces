package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func (server *Server) getQueries() *db.Queries {
	q, _ := server.store.(*db.Queries)
	return q
}

type updateBasicInfoRequest struct {
	FirstName             *string `json:"firstName"`
	LastName              *string `json:"lastName"`
	Phone                 *string `json:"phone"`
	Address               *string `json:"homeAddress"`
	DateOfBirth           *string `json:"dateOfBirth"`
	EmergencyContactName  *string `json:"emergencyContactName"`
	EmergencyContactPhone *string `json:"emergencyContactPhone"`
}

func (server *Server) updateStudentBasicInfo(ctx *gin.Context) {
	userID := getUserID(ctx)

	var req updateBasicInfoRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	currentUser, err := server.users.GetByID(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	fullName := currentUser.FullName
	if req.FirstName != nil || req.LastName != nil {
		first := currentUser.FullName
		last := ""
		parts := strings.SplitN(currentUser.FullName, " ", 2)
		if len(parts) > 0 {
			first = parts[0]
		}
		if len(parts) > 1 {
			last = parts[1]
		}
		if req.FirstName != nil {
			first = *req.FirstName
		}
		if req.LastName != nil {
			last = *req.LastName
		}
		if last != "" {
			fullName = first + " " + last
		} else {
			fullName = first
		}
	}

	user, err := server.users.UpdatePartial(ctx, userID, service.UpdateUserPartialInput{
		FullName: &fullName,
		Phone:    req.Phone,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update: " + err.Error()})
		return
	}

	q := server.getQueries()
	if q != nil {
		q.UpdateUserExtraFields(ctx, userID,
			req.DateOfBirth,
			req.EmergencyContactName,
			req.EmergencyContactPhone,
			req.Address,
		)
	}

	student, sErr := server.store.GetStudentByUserId(ctx, userID)
	if sErr == nil && q != nil {
		ip := ctx.ClientIP()
		if req.FirstName != nil || req.LastName != nil {
			q.CreateProfileEditLog(ctx, db.CreateProfileEditLogParams{
				StudentID:     student.ID,
				FieldName:     "full_name",
				OldValue:      &currentUser.FullName,
				NewValue:      &fullName,
				ChangedBy:     userID,
				ChangedByRole: "student",
				ChangeType:    db.ProfileChangeTypeSelfEdit,
				Reason:        strPtr("Student self-edit"),
				IpAddress:     &ip,
			})
		}
		if req.Phone != nil {
			oldPhone := ""
			if currentUser.Phone != nil {
				oldPhone = *currentUser.Phone
			}
			q.CreateProfileEditLog(ctx, db.CreateProfileEditLogParams{
				StudentID:     student.ID,
				FieldName:     "phone",
				OldValue:      &oldPhone,
				NewValue:      req.Phone,
				ChangedBy:     userID,
				ChangedByRole: "student",
				ChangeType:    db.ProfileChangeTypeSelfEdit,
				Reason:        strPtr("Student self-edit"),
				IpAddress:     &ip,
			})
		}
	}

	onboardingCompleted := server.auth.IsOnboardingCompleted(ctx, user)
	resp := toUserResponse(user, onboardingCompleted)
	if sErr == nil {
		level := int(student.Level)
		resp.Level = &level
		resp.MatricNumber = &student.MatricNumber
		entryYear := student.EntryYear
		resp.EntryYear = &entryYear
	}

	if q != nil {
		extraFields, eErr := q.GetUserExtraFields(ctx, userID)
		if eErr == nil {
			resp.DateOfBirth = extraFields.DateOfBirth
			resp.EmergencyContactName = extraFields.EmergencyContactName
			resp.EmergencyContactPhone = extraFields.EmergencyContactPhone
			resp.HomeAddress = extraFields.HomeAddress
		}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": resp})
}

func strPtr(s string) *string {
	return &s
}

type hodEditStudentRequest struct {
	FirstName             *string `json:"firstName"`
	LastName              *string `json:"lastName"`
	Phone                 *string `json:"phone"`
	Address               *string `json:"homeAddress"`
	DateOfBirth           *string `json:"dateOfBirth"`
	EmergencyContactName  *string `json:"emergencyContactName"`
	EmergencyContactPhone *string `json:"emergencyContactPhone"`
	MatricNumber          *string `json:"matricNumber"`
	Level                 *string `json:"level"`
	AcademicStanding      *string `json:"academicStanding"`
	GraduationStatus      *string `json:"graduationStatus"`
	AdmissionMode         *string `json:"admissionMode"`
	YearAdmitted          *string `json:"yearAdmitted"`
	Reason                *string `json:"reason"`
}

func (server *Server) hodEditStudent(ctx *gin.Context) {
	targetUserID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student id"})
		return
	}

	userID := getUserID(ctx)
	var req hodEditStudentRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	student, err := server.store.GetStudentByUserId(ctx, targetUserID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "student not found"})
		return
	}

	targetUser, err := server.users.GetByID(ctx, targetUserID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	ip := ctx.ClientIP()
	reason := ""
	if req.Reason != nil {
		reason = *req.Reason
	}

	q := server.getQueries()

	// Update user table fields (basic info)
	if req.FirstName != nil || req.LastName != nil || req.Phone != nil {
		first := targetUser.FullName
		last := ""
		parts := strings.SplitN(targetUser.FullName, " ", 2)
		if len(parts) > 0 {
			first = parts[0]
		}
		if len(parts) > 1 {
			last = parts[1]
		}
		if req.FirstName != nil {
			first = *req.FirstName
		}
		if req.LastName != nil {
			last = *req.LastName
		}
		fullName := first
		if last != "" {
			fullName = first + " " + last
		}

		_, err = server.users.UpdatePartial(ctx, targetUserID, service.UpdateUserPartialInput{
			FullName: &fullName,
			Phone:    req.Phone,
		})
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
			return
		}

		if q != nil && (req.FirstName != nil || req.LastName != nil) {
			q.CreateProfileEditLog(ctx, db.CreateProfileEditLogParams{
				StudentID:     student.ID,
				FieldName:     "full_name",
				OldValue:      &targetUser.FullName,
				NewValue:      &fullName,
				ChangedBy:     userID,
				ChangedByRole: "hod",
				ChangeType:    db.ProfileChangeTypeHodEdit,
				Reason:        &reason,
				IpAddress:     &ip,
			})
		}
	}

	// Update extra fields
	if q != nil && (req.DateOfBirth != nil || req.EmergencyContactName != nil || req.EmergencyContactPhone != nil || req.Address != nil) {
		q.UpdateUserExtraFields(ctx, targetUserID,
			req.DateOfBirth,
			req.EmergencyContactName,
			req.EmergencyContactPhone,
			req.Address,
		)
	}

	// Update student-specific fields
	if q != nil && (req.MatricNumber != nil || req.Level != nil || req.AdmissionMode != nil || req.YearAdmitted != nil) {
		q.UpdateStudentFieldsByAdmin(ctx, targetUserID,
			req.MatricNumber,
			req.Level,
			req.AdmissionMode,
			req.YearAdmitted,
		)

		if req.MatricNumber != nil && *req.MatricNumber != student.MatricNumber {
			q.CreateProfileEditLog(ctx, db.CreateProfileEditLogParams{
				StudentID:     student.ID,
				FieldName:     "matric_number",
				OldValue:      &student.MatricNumber,
				NewValue:      req.MatricNumber,
				ChangedBy:     userID,
				ChangedByRole: "hod",
				ChangeType:    db.ProfileChangeTypeHodEdit,
				Reason:        &reason,
				IpAddress:     &ip,
			})
		}

		if req.Level != nil {
			oldLevel := strconv.Itoa(int(student.Level))
			q.CreateProfileEditLog(ctx, db.CreateProfileEditLogParams{
				StudentID:     student.ID,
				FieldName:     "level",
				OldValue:      &oldLevel,
				NewValue:      req.Level,
				ChangedBy:     userID,
				ChangedByRole: "hod",
				ChangeType:    db.ProfileChangeTypeHodEdit,
				Reason:        &reason,
				IpAddress:     &ip,
			})
		}
	}

	// Update academic fields
	if q != nil && (req.AcademicStanding != nil || req.GraduationStatus != nil) {
		q.UpdateStudentAcademicByHod(ctx, student.ID,
			req.AcademicStanding,
			req.GraduationStatus,
		)

		if req.AcademicStanding != nil && student.AcademicStanding != nil {
			oldStanding := string(*student.AcademicStanding)
			if oldStanding != *req.AcademicStanding {
				q.CreateProfileEditLog(ctx, db.CreateProfileEditLogParams{
					StudentID:     student.ID,
					FieldName:     "academic_standing",
					OldValue:      &oldStanding,
					NewValue:      req.AcademicStanding,
					ChangedBy:     userID,
					ChangedByRole: "hod",
					ChangeType:    db.ProfileChangeTypeHodEdit,
					Reason:        &reason,
					IpAddress:     &ip,
				})
			}
		}
	}

	// Return updated profile
	user, err := server.users.GetByID(ctx, targetUserID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch updated user"})
		return
	}
	onboardingCompleted := server.auth.IsOnboardingCompleted(ctx, user)
	resp := toUserResponse(user, onboardingCompleted)

	student, _ = server.store.GetStudentByUserId(ctx, targetUserID)
	level := int(student.Level)
	resp.Level = &level
	resp.MatricNumber = &student.MatricNumber
	entryYear := student.EntryYear
	resp.EntryYear = &entryYear
	if student.AdmissionMode != nil {
		resp.AdmissionMode = student.AdmissionMode
	}
	if student.YearAdmitted != nil {
		resp.YearAdmitted = student.YearAdmitted
	}
	if student.AcademicStanding != nil {
		standing := string(*student.AcademicStanding)
		resp.AcademicStanding = &standing
	}

	if q != nil {
		extraFields, _ := q.GetUserExtraFields(ctx, targetUserID)
		resp.DateOfBirth = extraFields.DateOfBirth
		resp.EmergencyContactName = extraFields.EmergencyContactName
		resp.EmergencyContactPhone = extraFields.EmergencyContactPhone
		resp.HomeAddress = extraFields.HomeAddress
	}

	ctx.JSON(http.StatusOK, gin.H{"data": resp})
}

func (server *Server) getStudentAuditLogs(ctx *gin.Context) {
	studentIDStr := ctx.Param("student_id")
	studentID, err := uuid.Parse(studentIDStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student id"})
		return
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(ctx.DefaultQuery("per_page", "20"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := int32((page - 1) * perPage)

	q := server.getLogsQueries()
	logs, err := q.ListProfileEditLogsByStudent(ctx, db.ListProfileEditLogsByStudentParams{
		StudentID: studentID,
		Limit:     int32(perPage),
		Offset:    offset,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	total, _ := q.CountProfileEditLogsByStudent(ctx, studentID)

	ctx.JSON(http.StatusOK, gin.H{
		"data":    logs,
		"total":   total,
		"page":    page,
		"per_page": perPage,
	})
}

func (server *Server) getAllAuditLogs(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(ctx.DefaultQuery("per_page", "50"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}
	offset := int32((page - 1) * perPage)

	q := server.getLogsQueries()
	logs, err := q.ListAllProfileEditLogs(ctx, db.ListAllProfileEditLogsParams{
		Limit:  int32(perPage),
		Offset: offset,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": logs})
}

func (server *Server) getLogsQueries() *db.Queries {
	q, _ := server.store.(*db.Queries)
	return q
}

func (server *Server) uploadStudentDocument(ctx *gin.Context) {
	userID := getUserID(ctx)

	file, header, err := ctx.Request.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	defer file.Close()

	docType := ctx.PostForm("doc_type")
	if docType == "" {
		docType = "supporting_doc"
	}

	student, err := server.store.GetStudentByUserId(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "student profile not found"})
		return
	}

	savedPath, err := server.storage.SaveFile(header, "documents")
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file: " + err.Error()})
		return
	}

	q := server.getLogsQueries()
	doc, err := q.CreateStudentDocument(ctx, db.CreateStudentDocumentParams{
		StudentID:  student.ID,
		DocType:    db.DocumentType(docType),
		FileUrl:    savedPath,
		FileName:   header.Filename,
		FileSize:   int32(header.Size),
		UploadedBy: userID,
		Status:     db.DocumentStatusPending,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, doc)
}

func (server *Server) listStudentDocuments(ctx *gin.Context) {
	userID := getUserID(ctx)

	student, err := server.store.GetStudentByUserId(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "student not found"})
		return
	}

	q := server.getLogsQueries()
	docs, err := q.ListStudentDocumentsByStudent(ctx, student.ID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": docs})
}

func (server *Server) listPendingDocuments(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(ctx.DefaultQuery("per_page", "20"))
	if page < 1 {
		page = 1
	}
	offset := int32((page - 1) * perPage)

	q := server.getLogsQueries()
	docs, err := q.ListStudentDocumentsByStatus(ctx, db.ListStudentDocumentsByStatusParams{
		Status: db.DocumentStatusPending,
		Limit:  int32(perPage),
		Offset: offset,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	total, _ := q.CountStudentDocumentsByStatus(ctx, db.DocumentStatusPending)
	ctx.JSON(http.StatusOK, gin.H{"data": docs, "total": total})
}

func (server *Server) verifyDocument(ctx *gin.Context) {
	docID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid document id"})
		return
	}
	userID := getUserID(ctx)

	q := server.getLogsQueries()
	doc, err := q.VerifyStudentDocument(ctx, db.VerifyStudentDocumentParams{
		ID:         docID,
		VerifiedBy: pgtype.UUID{Bytes: userID, Valid: true},
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, doc)
}

func (server *Server) rejectDocument(ctx *gin.Context) {
	docID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid document id"})
		return
	}
	userID := getUserID(ctx)

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "reason is required"})
		return
	}

	q := server.getLogsQueries()
	doc, err := q.RejectStudentDocument(ctx, db.RejectStudentDocumentParams{
		ID:              docID,
		VerifiedBy:      pgtype.UUID{Bytes: userID, Valid: true},
		RejectionReason: &req.Reason,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, doc)
}

func (server *Server) getStudentFullProfile(ctx *gin.Context) {
	targetUserID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	user, err := server.users.GetByID(ctx, targetUserID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	onboardingCompleted := server.auth.IsOnboardingCompleted(ctx, user)
	resp := toUserResponse(user, onboardingCompleted)

	student, sErr := server.store.GetStudentByUserId(ctx, targetUserID)
	if sErr == nil {
		level := int(student.Level)
		resp.Level = &level
		resp.MatricNumber = &student.MatricNumber
		entryYear := student.EntryYear
		resp.EntryYear = &entryYear
		if student.AdmissionMode != nil {
			resp.AdmissionMode = student.AdmissionMode
		}
		if student.YearAdmitted != nil {
			resp.YearAdmitted = student.YearAdmitted
		}
		if student.AcademicStanding != nil {
			standing := string(*student.AcademicStanding)
			resp.AcademicStanding = &standing
		}
	}

	q := server.getLogsQueries()
	if q != nil {
		extraFields, eErr := q.GetUserExtraFields(ctx, targetUserID)
		if eErr == nil {
			resp.DateOfBirth = extraFields.DateOfBirth
			resp.EmergencyContactName = extraFields.EmergencyContactName
			resp.EmergencyContactPhone = extraFields.EmergencyContactPhone
			resp.HomeAddress = extraFields.HomeAddress
		}
	}

	roleNames, rErr := server.roles.ListUserRolesByName(ctx, targetUserID)
	if rErr == nil {
		resp.AllRoles = roleNames
	}

	result := gin.H{"data": resp}

	if sErr == nil && q != nil {
		logs, _ := q.ListProfileEditLogsByStudent(ctx, db.ListProfileEditLogsByStudentParams{
			StudentID: student.ID,
			Limit:     10,
			Offset:    0,
		})
		result["audit_logs"] = logs

		docs, _ := q.ListStudentDocumentsByStudent(ctx, student.ID)
		result["documents"] = docs
	}

	ctx.JSON(http.StatusOK, result)
}

func (server *Server) uploadProfilePhoto(ctx *gin.Context) {
	userID := getUserID(ctx)

	file, header, err := ctx.Request.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	defer file.Close()

	ext := strings.ToLower(header.Filename)
	if !strings.HasSuffix(ext, ".jpg") && !strings.HasSuffix(ext, ".jpeg") && !strings.HasSuffix(ext, ".png") {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "only JPG and PNG files are allowed"})
		return
	}

	if header.Size > 2*1024*1024 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "file size must be less than 2MB"})
		return
	}

	savedPath, err := server.storage.SaveFile(header, "profile-photos")
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file: " + err.Error()})
		return
	}

	avatarURL := fmt.Sprintf("/uploads/%s", savedPath)

	currentUser, err := server.users.GetByID(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	_, err = server.users.UpdatePartial(ctx, userID, service.UpdateUserPartialInput{
		FullName:  &currentUser.FullName,
		AvatarURL: &avatarURL,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update avatar"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"avatar_url": avatarURL})
}

func (server *Server) bulkUpdateStudents(ctx *gin.Context) {
	userID := getUserID(ctx)

	var req struct {
		StudentIDs       []string `json:"student_ids" binding:"required,min=1"`
		Action           string   `json:"action" binding:"required"`
		Level            *string  `json:"level"`
		AcademicStanding *string  `json:"academic_standing"`
		GraduationStatus *string  `json:"graduation_status"`
		Reason           string   `json:"reason" binding:"required,min=10"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ip := ctx.ClientIP()
	updated := 0
	errList := make([]string, 0)
	q := server.getLogsQueries()

	for _, sidStr := range req.StudentIDs {
		sid, err := uuid.Parse(sidStr)
		if err != nil {
			errList = append(errList, fmt.Sprintf("invalid id: %s", sidStr))
			continue
		}

		student, err := server.store.GetStudent(ctx, sid)
		if err != nil {
			errList = append(errList, fmt.Sprintf("student not found: %s", sidStr))
			continue
		}

		if req.Level != nil && q != nil {
			q.UpdateStudentFieldsByAdmin(ctx, student.UserID, nil, req.Level, nil, nil)
			oldLevel := strconv.Itoa(int(student.Level))
			q.CreateProfileEditLog(ctx, db.CreateProfileEditLogParams{
				StudentID:     sid,
				FieldName:     "level",
				OldValue:      &oldLevel,
				NewValue:      req.Level,
				ChangedBy:     userID,
				ChangedByRole: "hod",
				ChangeType:    db.ProfileChangeTypeBulkEdit,
				Reason:        &req.Reason,
				IpAddress:     &ip,
			})
		}

		if q != nil && (req.AcademicStanding != nil || req.GraduationStatus != nil) {
			q.UpdateStudentAcademicByHod(ctx, sid, req.AcademicStanding, req.GraduationStatus)
		}

		updated++
	}

	ctx.JSON(http.StatusOK, gin.H{
		"updated": updated,
		"errors":  errList,
	})
}
