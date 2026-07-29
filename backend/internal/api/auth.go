package api

import (
	"context"
	"net/http"
	"strings"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type studentSignupRequest struct {
	Email        string `json:"email" binding:"required,email"`
	Password     string `json:"password" binding:"required,min=6,max=72"`
	FirstName    string `json:"firstName" binding:"required"`
	LastName     string `json:"lastName" binding:"required"`
	Phone        string `json:"phone"`
	MatricNumber string `json:"matricNumber" binding:"required"`
	Level        int32  `json:"level" binding:"required"`
	Department   string `json:"department"`
}

type lecturerSignupRequest struct {
	Email          string `json:"email" binding:"required,email"`
	Password       string `json:"password" binding:"required,min=6,max=72"`
	FirstName      string `json:"firstName" binding:"required"`
	LastName       string `json:"lastName" binding:"required"`
	Phone          string `json:"phone"`
	StaffId        string `json:"staffId" binding:"required"`
	Department     string `json:"department" binding:"required"`
	Specialization string `json:"specialization"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type userResponse struct {
	ID                  string   `json:"id"`
	Email               string   `json:"email"`
	FirstName           string   `json:"firstName"`
	LastName            string   `json:"lastName"`
	FullName            string   `json:"fullName"`
	MiddleName          *string  `json:"middleName,omitempty"`
	Phone               *string  `json:"phone,omitempty"`
	Avatar              *string  `json:"avatar,omitempty"`
	Roles               []string `json:"roles"`
	ActiveRole          string   `json:"activeRole"`
	Role                string   `json:"role"`
	IsApproved          bool     `json:"isApproved"`
	IsActive            bool     `json:"isActive"`
	ApprovalStatus      string   `json:"approvalStatus"`
	OnboardingCompleted bool     `json:"onboardingCompleted"`
	CreatedAt           string   `json:"createdAt"`
	UpdatedAt           string   `json:"updatedAt,omitempty"`
	MatricNumber     *string `json:"matricNumber,omitempty"`
	Level            *int    `json:"level,omitempty"`
	EntryYear        *int32  `json:"entryYear,omitempty"`
	AdmissionMode    *string `json:"admissionMode,omitempty"`
	YearAdmitted     *int32  `json:"yearAdmitted,omitempty"`
	CGPA             *int64  `json:"cgpa,omitempty"`
	AcademicStanding *string `json:"academicStanding,omitempty"`
	DateOfBirth          *string `json:"dateOfBirth,omitempty"`
	EmergencyContactName *string `json:"emergencyContactName,omitempty"`
	EmergencyContactPhone *string `json:"emergencyContactPhone,omitempty"`
	HomeAddress          *string `json:"homeAddress,omitempty"`
	AllRoles          []string `json:"allRoles,omitempty"`
}

type authResponse struct {
	User   userResponse `json:"user"`
	Tokens tokenPair    `json:"tokens"`
}

type tokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresAt    string `json:"expiresAt"`
}

func (server *Server) setTokenCookies(ctx *gin.Context, pair *tokenPair) {
	secure := server.config.IsProduction()

	ctx.SetSameSite(http.SameSiteLaxMode)
	ctx.SetCookie("aces_access_token", pair.AccessToken, int(server.config.JWTAccessDuration.Seconds()), "/", "", secure, true)
	ctx.SetCookie("aces_refresh_token", pair.RefreshToken, int(server.config.JWTRefreshDuration.Seconds()), "/", "", secure, true)
}

func (server *Server) clearTokenCookies(ctx *gin.Context) {
	secure := server.config.IsProduction()
	ctx.SetSameSite(http.SameSiteLaxMode)
	ctx.SetCookie("aces_access_token", "", -1, "/", "", secure, true)
	ctx.SetCookie("aces_refresh_token", "", -1, "/", "", secure, true)
}

func (server *Server) getTokenFromRequest(ctx *gin.Context) string {
	if token, err := ctx.Cookie("aces_access_token"); err == nil && token != "" {
		return token
	}
	authHeader := ctx.GetHeader("Authorization")
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
			return parts[1]
		}
	}
	return ""
}

func (server *Server) getRefreshTokenFromRequest(ctx *gin.Context) string {
	if token, err := ctx.Cookie("aces_refresh_token"); err == nil && token != "" {
		return token
	}
	return ""
}

func normalizeRoleName(role string) string {
	if role == "admin" {
		return "delegated_admin"
	} else if role == "bursar_dept" {
		return "dept_bursar"
	} else if role == "bursar_class" {
		return "class_bursar"
	}
	return role
}

func toUserResponse(u db.User, onboardingCompleted bool) userResponse {
	firstName := u.FirstName
	lastName := u.LastName

	// Construct display name: "Last, First Middle"
	var displayName string
	if lastName != "" {
		displayName = lastName + ", " + firstName
	} else {
		displayName = firstName
	}
	if u.MiddleName != nil && *u.MiddleName != "" {
		displayName += " " + *u.MiddleName
	}

	role := normalizeRoleName(string(u.Role))

	approvalStatus := "pending"
	if u.IsApproved {
		approvalStatus = "approved"
	}

	createdAt := ""
	if u.CreatedAt.Valid {
		createdAt = u.CreatedAt.Time.Format(time.RFC3339)
	}

	updatedAt := ""
	if u.UpdatedAt.Valid {
		updatedAt = u.UpdatedAt.Time.Format(time.RFC3339)
	}

	return userResponse{
		ID:                  u.ID.String(),
		Email:               u.Email,
		FirstName:           firstName,
		LastName:            lastName,
		FullName:            displayName,
		MiddleName:          u.MiddleName,
		Phone:               u.Phone,
		Avatar:              u.AvatarUrl,
		Roles:               []string{role},
		ActiveRole:          role,
		Role:                role,
		IsApproved:          u.IsApproved,
		IsActive:            u.IsActive,
		ApprovalStatus:      approvalStatus,
		OnboardingCompleted: onboardingCompleted,
		CreatedAt:           createdAt,
		UpdatedAt:           updatedAt,
	}
}

func (server *Server) generateAuthResponse(u db.User, onboardingCompleted bool, allRoles []string) (*authResponse, error) {
	if len(allRoles) == 0 {
		allRoles = []string{string(u.Role)}
	}
	pair, err := server.tokenManager.GeneratePair(u.ID, string(u.Role), u.Email, allRoles)
	if err != nil {
		return nil, err
	}
	resp := toUserResponse(u, onboardingCompleted)
	normalized := make([]string, len(allRoles))
	for i, r := range allRoles {
		normalized[i] = normalizeRoleName(r)
	}
	// Ensure base role is present
	hasBase := false
	for _, r := range normalized {
		if r == resp.Role {
			hasBase = true
			break
		}
	}
	if !hasBase {
		normalized = append([]string{resp.Role}, normalized...)
	}
	resp.Roles = normalized
	resp.AllRoles = normalized

	return &authResponse{
		User: resp,
		Tokens: tokenPair{
			AccessToken:  pair.AccessToken,
			RefreshToken: pair.RefreshToken,
			ExpiresAt:    pair.ExpiresAt,
		},
	}, nil
}

func (server *Server) studentSignup(ctx *gin.Context) {
	var req studentSignupRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	result, err := server.auth.StudentSignup(ctx, req.Email, req.Password, req.FirstName, req.LastName, req.Phone, req.MatricNumber, req.Level)
	if err != nil {
		if err.Error() == "a user with this email already exists" {
			ctx.JSON(http.StatusConflict, gin.H{"error": "internal server error"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	resp, err := server.generateAuthResponse(result.User, false, []string{string(result.User.Role)})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}

	server.setTokenCookies(ctx, &resp.Tokens)
	_ = result.Student
	ctx.JSON(http.StatusCreated, gin.H{"data": resp})
}

func (server *Server) lecturerSignup(ctx *gin.Context) {
	var req lecturerSignupRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	result, err := server.auth.LecturerSignup(ctx, req.Email, req.Password, req.FirstName, req.LastName, req.Phone, req.StaffId, req.Department, req.Specialization)
	if err != nil {
		if err.Error() == "a user with this email already exists" {
			ctx.JSON(http.StatusConflict, gin.H{"error": "internal server error"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	resp, err := server.generateAuthResponse(result.User, true, []string{string(result.User.Role)})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}

	server.setTokenCookies(ctx, &resp.Tokens)
	_ = result.Staff
	ctx.JSON(http.StatusCreated, gin.H{"data": resp})
}

func (server *Server) login(ctx *gin.Context) {
	var req loginRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	identifier := strings.TrimSpace(req.Email)

	// Pre-login: resolve user ID to check lockout status.
	var preloadedUser *db.User
	if q, ok := server.store.(*db.Queries); ok {
		normalized := strings.ToLower(identifier)
		if u, err := q.GetUserByEmail(ctx, normalized); err == nil {
			preloadedUser = &u
		} else if s, err := q.GetStudentByMatric(ctx, strings.ToUpper(identifier)); err == nil {
			if u2, err := q.GetUser(ctx, s.UserID); err == nil {
				preloadedUser = &u2
			}
		} else if st, err := q.GetStaffByStaffID(ctx, strings.ToUpper(identifier)); err == nil {
			if u2, err := q.GetUser(ctx, st.UserID); err == nil {
				preloadedUser = &u2
			}
		}
	}

	// Check lockout before attempting authentication.
	if preloadedUser != nil {
		if lockErr := server.checkAccountLockout(ctx, preloadedUser.ID); lockErr != nil {
			ctx.JSON(http.StatusTooManyRequests, gin.H{"error": "account is temporarily locked due to too many failed attempts"})
			return
		}
	}

	user, onboardingCompleted, err := server.auth.Login(ctx, identifier, req.Password)
	if err != nil {
		// Record failed attempt for the resolved user.
		if preloadedUser != nil {
			clientIP := ctx.ClientIP()
			server.recordFailedLoginAttempt(ctx, preloadedUser.ID, clientIP)
		}
		status := http.StatusUnauthorized
		if err.Error() == "account is deactivated" {
			status = http.StatusForbidden
		}
		ctx.JSON(status, gin.H{"error": "internal server error"})
		return
	}

	// Successful login: reset any accumulated failed attempts.
	server.resetFailedAttempts(ctx, user.ID)

	roleNames, _ := server.roles.ListUserRolesByName(ctx, user.ID)
	if len(roleNames) == 0 {
		roleNames = []string{string(user.Role)}
	}

	resp, err := server.generateAuthResponse(*user, onboardingCompleted, roleNames)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}

	server.setTokenCookies(ctx, &resp.Tokens)

	// Fire-and-forget: notify the user of successful login
	go func() {
		_, _ = server.notificationsFull.CreateAndPush(
			context.Background(),
			user.ID,
			"AUTH_LOGIN_SUCCESS",
			"auth",
			"low",
			"Login Successful",
			"You have successfully signed in to ACES Zone.",
			"/dashboard",
			"Go to Dashboard",
			nil, nil, nil, nil,
		)
	}()

	ctx.JSON(http.StatusOK, gin.H{"data": resp})
}

func (server *Server) getMe(ctx *gin.Context) {
	userIDStr, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	id, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	user, err := server.auth.GetUserByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "internal server error"})
		return
	}

	onboardingCompleted := server.auth.IsOnboardingCompleted(ctx, *user)
	resp := toUserResponse(*user, onboardingCompleted)

	student, err := server.store.GetStudentByUserId(ctx, id)
	if err == nil {
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

	q, _ := server.store.(*db.Queries)
	if q != nil {
		extraFields, eErr := q.GetUserExtraFields(ctx, id)
		if eErr == nil {
			resp.DateOfBirth = extraFields.DateOfBirth
			resp.EmergencyContactName = extraFields.EmergencyContactName
			resp.EmergencyContactPhone = extraFields.EmergencyContactPhone
			resp.HomeAddress = extraFields.HomeAddress
		}
	}

	roleNames, err := server.roles.ListUserRolesByName(ctx, id)
	if err == nil && len(roleNames) > 0 {
		normalized := make([]string, len(roleNames))
		for i, r := range roleNames {
			normalized[i] = normalizeRoleName(r)
		}
		// Ensure base role is present
		hasBase := false
		for _, r := range normalized {
			if r == resp.Role {
				hasBase = true
				break
			}
		}
		if !hasBase {
			normalized = append([]string{resp.Role}, normalized...)
		}
		resp.Roles = normalized
		resp.AllRoles = normalized
	} else {
		resp.Roles = []string{resp.Role}
		resp.AllRoles = []string{resp.Role}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": resp})
}

func (server *Server) logout(ctx *gin.Context) {
	server.clearTokenCookies(ctx)
	ctx.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}

func (server *Server) refreshToken(ctx *gin.Context) {
	var req refreshRequest
	// Ignore binding errors since the refresh token may come from cookies
	_ = ctx.ShouldBindJSON(&req)

	refreshToken := req.RefreshToken
	if refreshToken == "" {
		refreshToken = server.getRefreshTokenFromRequest(ctx)
	}
	if refreshToken == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "refresh token required"})
		return
	}

	claims, err := server.tokenManager.Verify(refreshToken)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired refresh token"})
		return
	}

	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	user, err := server.auth.RefreshToken(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "internal server error"})
		return
	}

	roleNames, _ := server.roles.ListUserRolesByName(ctx, user.ID)
	if len(roleNames) == 0 {
		roleNames = []string{string(user.Role)}
	}

	pair, err := server.tokenManager.GeneratePair(user.ID, string(user.Role), user.Email, roleNames)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}

	tokenResp := tokenPair{
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
		ExpiresAt:    pair.ExpiresAt,
	}
	server.setTokenCookies(ctx, &tokenResp)
	ctx.JSON(http.StatusOK, gin.H{"data": tokenResp})
}
