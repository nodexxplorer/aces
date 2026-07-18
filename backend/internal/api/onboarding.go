package api

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type studentOnboardingRequest struct {
	Phone               string `json:"phone" binding:"required"`
	Bio                 string `json:"bio"`
	Avatar              string `json:"avatar"`
	FullName            string `json:"full_name" binding:"required,min=3"`
	DateOfBirth         string `json:"date_of_birth" binding:"required"`
	MatricNumber        string `json:"matric_number" binding:"required"`
	Level               string `json:"level" binding:"required,oneof=100 200 300 400 500"`
	AdmissionMode       string `json:"admission_mode" binding:"required,oneof=UTME Direct Entry"`
	YearAdmitted        string `json:"year_admitted" binding:"required"`
	EmergencyContact    string `json:"emergency_contact" binding:"required"`
	EmergencyContactNum string `json:"emergency_contact_phone" binding:"required"`
	HomeAddress         string `json:"home_address"`
	ProfilePhotoURL     string `json:"profile_photo_url"`
}

func (server *Server) getAuthUserID(ctx *gin.Context) (uuid.UUID, error) {
	userIDStr, exists := ctx.Get("userID")
	if !exists {
		return uuid.Nil, http.ErrNoLocation
	}
	return uuid.Parse(userIDStr.(string))
}

func (server *Server) studentOnboarding(ctx *gin.Context) {
	userID, err := server.getAuthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req studentOnboardingRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate date of birth (must be 16+ years old)
	dob, err := time.Parse("2006-01-02", req.DateOfBirth)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid date of birth format, use YYYY-MM-DD"})
		return
	}
	if time.Since(dob).Hours() < 16*365.25*24 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "you must be at least 16 years old"})
		return
	}

	// Validate year admitted
	yearAdmitted := 0
	if req.YearAdmitted != "" {
		_, parseErr := fmt.Sscanf(req.YearAdmitted, "%d", &yearAdmitted)
		if parseErr != nil || yearAdmitted < 1900 || yearAdmitted > time.Now().Year() {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid year admitted"})
			return
		}
	}

	// Update user fields
	phoneVal := strings.TrimSpace(req.Phone)
	avatarVal := strings.TrimSpace(req.Avatar)
	if avatarVal == "" {
		avatarVal = strings.TrimSpace(req.ProfilePhotoURL)
	}
	fullNameVal := strings.TrimSpace(req.FullName)

	_, err = server.users.UpdatePartial(ctx, userID, service.UpdateUserPartialInput{
		Phone:     &phoneVal,
		AvatarURL: &avatarVal,
		FullName:  &fullNameVal,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user details: " + err.Error()})
		return
	}

	// Update student-specific onboarding fields
	admissionMode := strings.TrimSpace(req.AdmissionMode)
	if admissionMode == "" {
		admissionMode = "UTME"
	}

	matricNum := strings.TrimSpace(req.MatricNumber)
	levelStr := req.Level
	yearAdmittedStr := req.YearAdmitted

	// Use custom query to update student onboarding fields
	queries, ok := server.store.(*db.Queries)
	if ok {
		err = queries.UpdateStudentOnboardingFields(
			ctx, userID,
			&matricNum, &levelStr, &admissionMode, &yearAdmittedStr,
			&req.DateOfBirth, &req.EmergencyContact, &req.EmergencyContactNum,
			&req.HomeAddress, &avatarVal,
		)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update student onboarding details: " + err.Error()})
			return
		}
	} else {
		// Fallback to original method
		_, err = server.students.UpdateOnboarding(ctx, userID, &admissionMode, nil)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update student onboarding details: " + err.Error()})
			return
		}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":             "onboarding completed successfully",
		"onboardingCompleted": true,
	})
}
