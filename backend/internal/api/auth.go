package api

import (
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/aces/backend/internal/auth"
	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/middleware"
	"github.com/aces/backend/internal/service"
	"github.com/aces/backend/internal/tenant"
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
	Tenant       string `json:"tenant"`
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
	Tenant         string `json:"tenant"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
	// Tenant is the department slug. Omitted means the default department.
	Tenant string `json:"tenant"`
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type userResponse struct {
	ID                    string   `json:"id"`
	Email                 string   `json:"email"`
	FirstName             string   `json:"firstName"`
	LastName              string   `json:"lastName"`
	FullName              string   `json:"fullName"`
	MiddleName            *string  `json:"middleName,omitempty"`
	Phone                 *string  `json:"phone,omitempty"`
	Avatar                *string  `json:"avatar,omitempty"`
	Roles                 []string `json:"roles"`
	ActiveRole            string   `json:"activeRole"`
	Role                  string   `json:"role"`
	IsApproved            bool     `json:"isApproved"`
	IsActive              bool     `json:"isActive"`
	ApprovalStatus        string   `json:"approvalStatus"`
	OnboardingCompleted   bool     `json:"onboardingCompleted"`
	CreatedAt             string   `json:"createdAt"`
	UpdatedAt             string   `json:"updatedAt,omitempty"`
	MatricNumber          *string  `json:"matricNumber,omitempty"`
	Level                 *int     `json:"level,omitempty"`
	EntryYear             *int32   `json:"entryYear,omitempty"`
	AdmissionMode         *string  `json:"admissionMode,omitempty"`
	YearAdmitted          *int32   `json:"yearAdmitted,omitempty"`
	CGPA                  *float64 `json:"cgpa,omitempty"`
	AcademicStanding      *string  `json:"academicStanding,omitempty"`
	DateOfBirth           *string  `json:"dateOfBirth,omitempty"`
	EmergencyContactName  *string  `json:"emergencyContactName,omitempty"`
	EmergencyContactPhone *string  `json:"emergencyContactPhone,omitempty"`
	HomeAddress           *string  `json:"homeAddress,omitempty"`
	AllRoles              []string `json:"allRoles,omitempty"`
	// Tenant is the user's department, so the dashboard can show its branding.
	Tenant *tenantResponse `json:"tenant,omitempty"`
}

type authResponse struct {
	User   userResponse    `json:"user"`
	Tokens tokenPair       `json:"tokens"`
	Tenant *tenantResponse `json:"tenant,omitempty"`
}

type tokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresAt    string `json:"expiresAt"`
	
	CsrfToken string `json:"csrfToken,omitempty"`
}

func (server *Server) setTokenCookies(ctx *gin.Context, pair *tokenPair) string {
	secure := server.config.IsProduction() || ctx.GetHeader("X-Forwarded-Proto") == "https"

	if secure {
		ctx.SetSameSite(http.SameSiteNoneMode)
	} else {
		ctx.SetSameSite(http.SameSiteLaxMode)
	}
	ctx.SetCookie("aces_access_token", pair.AccessToken, int(server.config.JWTAccessDuration.Seconds()), "/", "", secure, true)
	ctx.SetCookie("aces_refresh_token", pair.RefreshToken, int(server.config.JWTRefreshDuration.Seconds()), "/", "", secure, true)

	csrfToken, err := middleware.GenerateCSRFToken()
	if err != nil {
		return ""
	}
	ctx.SetCookie(middleware.CSRFCookieName, csrfToken, int(server.config.JWTRefreshDuration.Seconds()), "/", "", secure, false)
	return csrfToken
}

func (server *Server) clearTokenCookies(ctx *gin.Context) {
	secure := server.config.IsProduction() || ctx.GetHeader("X-Forwarded-Proto") == "https"
	if secure {
		ctx.SetSameSite(http.SameSiteNoneMode)
	} else {
		ctx.SetSameSite(http.SameSiteLaxMode)
	}
	ctx.SetCookie("aces_access_token", "", -1, "/", "", secure, true)
	ctx.SetCookie("aces_refresh_token", "", -1, "/", "", secure, true)
	ctx.SetCookie(middleware.CSRFCookieName, "", -1, "/", "", secure, false)
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

var mobileBlockedRoles = map[string]bool{
	"lecturer": true,
	"hod":      true,
	"admin":    true,
}

func isMobileClient(ctx *gin.Context) bool {
	return ctx.GetHeader("X-Client-Platform") == "mobile"
}

func hasBlockedMobileRole(roleNames []string) bool {
	for _, r := range roleNames {
		if mobileBlockedRoles[r] {
			return true
		}
	}
	return false
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

func (server *Server) generateAuthResponse(ctx *gin.Context, u db.User, onboardingCompleted bool, allRoles []string) (*authResponse, error) {
	if len(allRoles) == 0 {
		allRoles = []string{string(u.Role)}
	}
	t, ok := tenant.From(ctx.Request.Context())
	if !ok {
		return nil, errors.New("no department bound to the request")
	}
	pair, err := server.tokenManager.GeneratePair(u.ID, auth.Tenant{ID: t.ID, Slug: t.Slug}, string(u.Role), u.Email, allRoles)
	if err != nil {
		return nil, err
	}

	server.createUserSession(ctx, u.ID, pair.RefreshToken, "", ctx.ClientIP(), ctx.GetHeader("User-Agent"), time.Now().Add(server.config.JWTRefreshDuration))

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
	resp.Tenant = toTenantResponse(t)

	return &authResponse{
		User: resp,
		Tokens: tokenPair{
			AccessToken:  pair.AccessToken,
			RefreshToken: pair.RefreshToken,
			ExpiresAt:    pair.ExpiresAt,
		},
		Tenant: toTenantResponse(t),
	}, nil
}

func (server *Server) studentSignup(ctx *gin.Context) {
	var req studentSignupRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}
	if !server.bindTenant(ctx, req.Tenant) {
		return
	}

	// The matric number must belong to the department being signed up to.
	// Mobile clients send no department, so they are checked against the
	// default one.
	if status, msg := server.departmentMatricProblem(ctx, strings.ToUpper(strings.TrimSpace(req.MatricNumber))); status != 0 {
		ctx.JSON(status, gin.H{"error": msg})
		return
	}

	result, err := server.auth.StudentSignup(ctx, req.Email, req.Password, req.FirstName, req.LastName, req.Phone, req.MatricNumber, req.Level)
	if err != nil {
		if errors.Is(err, service.ErrEmailTaken) || errors.Is(err, service.ErrMatricTaken) {
			ctx.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	resp, err := server.generateAuthResponse(ctx, result.User, false, []string{string(result.User.Role)})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}

	resp.Tokens.CsrfToken = server.setTokenCookies(ctx, &resp.Tokens)
	_ = result.Student

	// Welcome notification for new student
	server.notifyUser(
		ctx,
		result.User.ID,
		"general",
		"system",
		"normal",
		"Welcome to "+brandName(ctx)+"!",
		"Your student account has been created. Your account is pending approval.",
		"/dashboard",
		"Go to Dashboard",
		nil,
		nil,
	)

	ctx.JSON(http.StatusCreated, gin.H{"data": resp})
}

func (server *Server) lecturerSignup(ctx *gin.Context) {
	if isMobileClient(ctx) {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "The Admin Pack mobile app is for students and class representatives. Please sign up on the website instead."})
		return
	}

	var req lecturerSignupRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}
	if !server.bindTenant(ctx, req.Tenant) {
		return
	}

	result, err := server.auth.LecturerSignup(ctx, req.Email, req.Password, req.FirstName, req.LastName, req.Phone, req.StaffId, req.Department, req.Specialization)
	if err != nil {
		if errors.Is(err, service.ErrEmailTaken) || errors.Is(err, service.ErrMatricTaken) {
			ctx.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	resp, err := server.generateAuthResponse(ctx, result.User, true, []string{string(result.User.Role)})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}

	resp.Tokens.CsrfToken = server.setTokenCookies(ctx, &resp.Tokens)
	_ = result.Staff

	// Welcome notification for new lecturer
	server.notifyUser(
		ctx,
		result.User.ID,
		"general",
		"system",
		"normal",
		"Welcome to "+brandName(ctx)+"!",
		"Your lecturer account has been created. Your account is pending approval.",
		"/dashboard",
		"Go to Dashboard",
		nil,
		nil,
	)

	ctx.JSON(http.StatusCreated, gin.H{"data": resp})
}

func (server *Server) login(ctx *gin.Context) {
	var req loginRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}
	// Accounts are per department: the same email can exist in several.
	if !server.bindTenant(ctx, req.Tenant) {
		return
	}

	identifier := strings.TrimSpace(req.Email)

	// Pre-login: resolve user ID to check lockout status.
	var preloadedUser *db.User
	if q, ok := server.store.(*db.Queries); ok {
		normalized := strings.ToLower(identifier)
		if u, err := q.GetUserByEmail(ctx, normalized); err == nil {
			preloadedUser = &u
		} else if s, err := q.GetStudentByMatric(ctx, strPtr(strings.ToUpper(identifier))); err == nil {
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
		message := "invalid email or password"
		if err.Error() == "account is deactivated" {
			status = http.StatusForbidden
			message = "account is deactivated"
		}
		ctx.JSON(status, gin.H{"error": message})
		return
	}

	// Successful login: reset any accumulated failed attempts.
	server.resetFailedAttempts(ctx, user.ID)

	roleNames, _ := server.roles.ListUserRolesByName(ctx, user.ID)
	if len(roleNames) == 0 {
		roleNames = []string{string(user.Role)}
	}

	if isMobileClient(ctx) && hasBlockedMobileRole(roleNames) {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "The Admin Pack mobile app is for students and class representatives. Please sign in on the website instead."})
		return
	}

	resp, err := server.generateAuthResponse(ctx, *user, onboardingCompleted, roleNames)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}

	resp.Tokens.CsrfToken = server.setTokenCookies(ctx, &resp.Tokens)

	// Fire-and-forget: notify the user of successful login
	server.notifyUser(
		ctx,
		user.ID,
		"general",
		"auth",
		"low",
		"Login Successful",
		"You have successfully signed in to "+brandName(ctx)+".",
		"/dashboard",
		"Go to Dashboard",
		nil,
		nil,
	)

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
	if t, ok := tenant.From(ctx.Request.Context()); ok {
		resp.Tenant = toTenantResponse(t)
	}

	student, err := server.store.GetStudentByUserId(ctx, id)
	if err == nil {
		level := int(student.Level)
		resp.Level = &level
		resp.MatricNumber = student.MatricNumber
		resp.EntryYear = student.EntryYear
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
	
	if q, ok := server.store.(*db.Queries); ok {
		if rt := server.getRefreshTokenFromRequest(ctx); rt != "" {
			if session, err := q.GetActiveSessionByToken(ctx, rt); err == nil {
				_ = q.DeleteActiveSession(ctx, db.DeleteActiveSessionParams{ID: session.ID, UserID: session.UserID})
			}
			
			if userID, uerr := uuid.Parse(ctx.GetString("userID")); uerr == nil {
				if mrt, gerr := q.GetModoolsRefreshToken(ctx, userID); gerr == nil && mrt != "" {
					go server.revokeModoolsToken(mrt)
				}
			}
		}
	}
	server.clearTokenCookies(ctx)
	ctx.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}

func (server *Server) revokeModoolsToken(refreshToken string) {
	clientID := strings.TrimSpace(os.Getenv("MODOOLS_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("MODOOLS_CLIENT_SECRET"))
	issuer := strings.TrimSpace(os.Getenv("MODOOLS_ISSUER"))
	if clientID == "" || issuer == "" {
		return
	}
	revokeURL := strings.TrimSuffix(issuer, "/") + "/oauth2/revoke"
	form := url.Values{"token": {refreshToken}, "client_id": {clientID}}
	if clientSecret != "" {
		form.Set("client_secret", clientSecret)
	}
	req, err := http.NewRequest(http.MethodPost, revokeURL, strings.NewReader(form.Encode()))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("[modools] revoke request failed (non-fatal): %v", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		log.Printf("[modools] revoke returned %d (non-fatal)", resp.StatusCode)
	}
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
	if !server.bindTenantFromClaims(ctx, claims) {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired refresh token"})
		return
	}

	q, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	session, err := q.GetActiveSessionByToken(ctx, refreshToken)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "session revoked or expired"})
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

	if isMobileClient(ctx) && hasBlockedMobileRole(roleNames) {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "The Admin Pack mobile app is for students and class representatives. Please sign in on the website instead."})
		return
	}

	t, _ := tenant.From(ctx.Request.Context())
	pair, err := server.tokenManager.GeneratePair(user.ID, auth.Tenant{ID: t.ID, Slug: t.Slug}, string(user.Role), user.Email, roleNames)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}

	_ = q.DeleteActiveSession(ctx, db.DeleteActiveSessionParams{ID: session.ID, UserID: session.UserID})
	server.createUserSession(ctx, user.ID, pair.RefreshToken, "", ctx.ClientIP(), ctx.GetHeader("User-Agent"), time.Now().Add(server.config.JWTRefreshDuration))

	tokenResp := tokenPair{
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
		ExpiresAt:    pair.ExpiresAt,
	}
	tokenResp.CsrfToken = server.setTokenCookies(ctx, &tokenResp)
	ctx.JSON(http.StatusOK, gin.H{"data": tokenResp})
}
