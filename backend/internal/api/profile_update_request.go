package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type createProfileUpdateRequestReq struct {
	StudentID string  `json:"student_id" binding:"required,uuid"`
	FieldName string  `json:"field_name" binding:"required"`
	OldValue  *string `json:"old_value"`
	NewValue  string  `json:"new_value" binding:"required"`
}

func (server *Server) createProfileUpdateRequest(ctx *gin.Context) {
	var req createProfileUpdateRequestReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	// This route is student-only (see server.go), so the caller's own
	// students.id — never the body — is always the record owner.
	callerUserID := getUserID(ctx)
	student, err := server.store.GetStudentByUserId(ctx, callerUserID)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return
	}
	studentID := student.ID

	arg := db.CreateProfileUpdateRequestParams{
		StudentID: studentID,
		FieldName: req.FieldName,
		OldValue:  req.OldValue,
		NewValue:  req.NewValue,
		Status:    "pending",
	}

	request, err := server.store.CreateProfileUpdateRequest(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, request)
}

func (server *Server) getProfileUpdateRequest(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	request, err := server.store.GetProfileUpdateRequest(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	if !requireOwnershipOrStaff(ctx, server.store, request.StudentID) {
		return
	}

	ctx.JSON(http.StatusOK, request)
}

func (server *Server) listStudentProfileUpdateRequests(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student id"})
		return
	}

	if !requireOwnershipOrStaff(ctx, server.store, studentID) {
		return
	}

	requests, err := server.store.ListStudentProfileUpdateRequests(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, requests)
}

type listPendingProfileUpdateRequestsReq struct {
	PageID   int32 `form:"page_id" binding:"required,min=1"`
	PageSize int32 `form:"page_size" binding:"required,min=5,max=100"`
}

func (server *Server) listPendingProfileUpdateRequests(ctx *gin.Context) {
	var req listPendingProfileUpdateRequestsReq
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	arg := db.ListPendingProfileUpdateRequestsParams{
		Limit:  req.PageSize,
		Offset: (req.PageID - 1) * req.PageSize,
	}

	requests, err := server.store.ListPendingProfileUpdateRequests(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, requests)
}

type updateProfileUpdateRequestStatusReq struct {
	Status          string  `json:"status" binding:"required"`
	ApprovedAt      *string `json:"approved_at"`
	RejectionReason *string `json:"rejection_reason"`
}

func (server *Server) updateProfileUpdateRequestStatus(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req updateProfileUpdateRequestStatusReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	arg := db.UpdateProfileUpdateRequestStatusParams{
		ID:              id,
		Status:          req.Status,
		RejectionReason: req.RejectionReason,
	}

	// Always the caller's own ID, never client-supplied, so the audit trail
	// records who actually authenticated the request.
	arg.ApprovedBy = pgtype.UUID{Bytes: getUserID(ctx), Valid: true}

	if req.ApprovedAt != nil {
		approvedAt, err := time.Parse(time.RFC3339, *req.ApprovedAt)
		if err == nil {
			arg.ApprovedAt = pgtype.Timestamptz{Time: approvedAt, Valid: true}
		}
	}

	request, err := server.store.UpdateProfileUpdateRequestStatus(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Apply field change when request is approved
	if request.Status == "approved" {
		if student, sErr := server.store.GetStudent(ctx, request.StudentID); sErr == nil {
			if applyErr := applyProfileFieldUpdate(ctx, server.store, student.UserID, request.StudentID, request.FieldName, request.NewValue); applyErr != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to apply approved profile update"})
				return
			}
		}
	}

	// Notify the student about profile update request status change
	if student, sErr := server.store.GetStudent(ctx, request.StudentID); sErr == nil {
		eType := "profile_update_request"
		eID := request.ID
		title := "Profile Update Request Updated"
		msg := fmt.Sprintf("Your profile update request for %s has been updated to %s.", request.FieldName, request.Status)
		priority := "normal"
		if request.Status == "approved" {
			title = "Profile Update Approved"
			msg = fmt.Sprintf("Your request to update %s has been approved.", request.FieldName)
			priority = "high"
		} else if request.Status == "rejected" {
			title = "Profile Update Rejected"
			msg = fmt.Sprintf("Your request to update %s has been rejected.", request.FieldName)
			priority = "high"
		}
		server.notifyUser(
			ctx,
			student.UserID,
			"general",
			"system",
			priority,
			title,
			msg,
			"/profile",
			"View Profile",
			&eType,
			&eID,
		)
	}

	ctx.JSON(http.StatusOK, request)
}

func applyProfileFieldUpdate(ctx context.Context, store interface{}, userID, studentID uuid.UUID, fieldName, newValue string) error {
	q, ok := store.(*db.Queries)
	if !ok {
		return fmt.Errorf("invalid store")
	}

	switch strings.ToLower(fieldName) {
	case "first_name", "firstname":
		_, err := q.GetDB().Exec(ctx, "UPDATE users SET first_name = $1, updated_at = NOW() WHERE id = $2", newValue, userID)
		return err
	case "last_name", "lastname":
		_, err := q.GetDB().Exec(ctx, "UPDATE users SET last_name = $1, updated_at = NOW() WHERE id = $2", newValue, userID)
		return err
	case "middle_name", "middlename":
		_, err := q.GetDB().Exec(ctx, "UPDATE users SET middle_name = $1, updated_at = NOW() WHERE id = $2", newValue, userID)
		return err
	case "phone", "phone_number":
		_, err := q.GetDB().Exec(ctx, "UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2", newValue, userID)
		return err
	case "home_address", "homeaddress":
		_, err := q.GetDB().Exec(ctx, "UPDATE users SET home_address = $1, updated_at = NOW() WHERE id = $2", newValue, userID)
		return err
	case "date_of_birth", "dateofbirth":
		t, err := time.Parse("2006-01-02", newValue)
		if err != nil {
			t, err = time.Parse(time.RFC3339, newValue)
		}
		if err != nil {
			return err
		}
		_, err = q.GetDB().Exec(ctx, "UPDATE users SET date_of_birth = $1, updated_at = NOW() WHERE id = $2", t, userID)
		return err
	case "emergency_contact_name", "emergencycontactname":
		_, err := q.GetDB().Exec(ctx, "UPDATE users SET emergency_contact_name = $1, updated_at = NOW() WHERE id = $2", newValue, userID)
		return err
	case "emergency_contact_phone", "emergencycontactphone":
		_, err := q.GetDB().Exec(ctx, "UPDATE users SET emergency_contact_phone = $1, updated_at = NOW() WHERE id = $2", newValue, userID)
		return err
	case "matric_number", "matricnumber":
		_, err := q.GetDB().Exec(ctx, "UPDATE students SET matric_number = $1, updated_at = NOW() WHERE id = $2", newValue, studentID)
		return err
	case "level":
		lvl, err := strconv.Atoi(newValue)
		if err != nil {
			return err
		}
		_, err = q.GetDB().Exec(ctx, "UPDATE students SET level = $1, updated_at = NOW() WHERE id = $2", lvl, studentID)
		return err
	case "admission_mode", "admissionmode":
		_, err := q.GetDB().Exec(ctx, "UPDATE students SET admission_mode = $1, updated_at = NOW() WHERE id = $2", newValue, studentID)
		return err
	case "year_admitted", "yearadmitted":
		yr, err := strconv.Atoi(newValue)
		if err != nil {
			return err
		}
		_, err = q.GetDB().Exec(ctx, "UPDATE students SET year_admitted = $1, updated_at = NOW() WHERE id = $2", yr, studentID)
		return err
	default:
		return fmt.Errorf("unsupported profile field: %s", fieldName)
	}
}

func (server *Server) deleteProfileUpdateRequest(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := server.store.DeleteProfileUpdateRequest(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "deleted successfully"})
}
