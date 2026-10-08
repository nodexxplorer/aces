package api

import (
	"fmt"
	"net/http"
	"regexp"
	"strconv"
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
	MiddleName          string `json:"middle_name"`
	MatricNumber        string `json:"matric_number"`
	Level               int32  `json:"level"`
	DateOfBirth         string `json:"date_of_birth" binding:"required"`
	AdmissionMode       string `json:"admission_mode" binding:"required,oneof=UTME Direct Entry"`
	YearAdmitted        string `json:"year_admitted"`
	EmergencyContact    string `json:"emergency_contact" binding:"required"`
	EmergencyContactNum string `json:"emergency_contact_phone" binding:"required"`
	HomeAddress         string `json:"home_address"`
	ProfilePhotoURL     string `json:"profile_photo_url"`
}

// ngPhonePattern accepts Nigerian mobile numbers: 11 digits starting 0
// (070/080/081/090/091 prefixes) or international +234 form.
var ngPhonePattern = regexp.MustCompile(`^(\+234[789][01]\d{8}|0[789][01]\d{8})$`)

// normalizeNgnPhone validates and normalizes a Nigerian phone number to the
// stored +234 form.
func normalizeNgnPhone(raw string) (string, bool) {
	cleaned := strings.ReplaceAll(strings.TrimSpace(raw), " ", "")
	cleaned = strings.ReplaceAll(cleaned, "-", "")
	if !ngPhonePattern.MatchString(cleaned) {
		return "", false
	}
	if strings.HasPrefix(cleaned, "0") {
		cleaned = "+234" + cleaned[1:]
	}
	return cleaned, true
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	matric := strings.ToUpper(strings.TrimSpace(req.MatricNumber))
	if status, msg := server.departmentMatricProblem(ctx, matric); status != 0 {
		ctx.JSON(status, gin.H{"error": msg})
		return
	}
	if q, ok := server.store.(*db.Queries); ok {
		if s, err := q.GetStudentByMatric(ctx, &matric); err == nil && s.UserID != userID {
			ctx.JSON(http.StatusConflict, gin.H{"error": "matric number already in use"})
			return
		}
	}
	if req.Level < 100 || req.Level > 500 || req.Level%100 != 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid level"})
		return
	}
	phoneNorm, ok := normalizeNgnPhone(req.Phone)
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid phone number"})
		return
	}
	ephoneNorm, ok := normalizeNgnPhone(req.EmergencyContactNum)
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid emergency contact phone number"})
		return
	}
	req.Phone = phoneNorm
	req.EmergencyContactNum = ephoneNorm

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
	middleNameVal := strings.TrimSpace(req.MiddleName)

	_, err = server.users.UpdatePartial(ctx, userID, service.UpdateUserPartialInput{
		Phone:      &phoneVal,
		AvatarURL:  &avatarVal,
		MiddleName: &middleNameVal,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	admissionMode := strings.TrimSpace(req.AdmissionMode)
	if admissionMode == "" {
		admissionMode = "UTME"
	}

	yearAdmittedStr := req.YearAdmitted
	if yearAdmittedStr == "" {
		if yy, err := strconv.Atoi(matric[:2]); err == nil {
			yearAdmittedStr = fmt.Sprintf("%d", 2000+yy)
		}
	}
	matricPtr := &matric
	levelStr := fmt.Sprintf("%d", req.Level)
	levelPtr := &levelStr

	// Use custom query to update student onboarding fields
	queries, ok := server.store.(*db.Queries)
	if ok {
		err = queries.UpdateStudentOnboardingFields(
			ctx, userID,
			matricPtr, levelPtr, &admissionMode, &yearAdmittedStr,
			&req.DateOfBirth, &req.EmergencyContact, &req.EmergencyContactNum,
			&req.HomeAddress, &avatarVal,
		)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}

		_ = queries.UpdateUserExtraFields(
			ctx, userID,
			&req.DateOfBirth,
			&req.EmergencyContact,
			&req.EmergencyContactNum,
			&req.HomeAddress,
		)
	} else {
		// Fallback to original method
		_, err = server.students.UpdateOnboarding(ctx, userID, &admissionMode, nil)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":             "onboarding completed successfully",
		"onboardingCompleted": true,
	})
}
