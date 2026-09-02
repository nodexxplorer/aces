package api

import (
	"net/http"
	"strings"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/middleware"
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
}

type authResponse struct {
	User   userResponse `json:"user"`
	Tokens tokenPair    `json:"tokens"`
}

type tokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresAt    string `json:"expiresAt"`
	// CsrfToken is echoed here in addition to the aces_csrf_token cookie set
	// by setTokenCookies. The frontend and backend can live on unrelated
	// domains (e.g. Vercel + Render), where document.cookie can never read a
	// cookie set by a cross-origin response — so the frontend holds this
	// value in memory instead and echoes it back as X-CSRF-Token. See
	// middleware.CSRFProtect.
	CsrfToken string `json:"csrfToken,omitempty"`
}

// setTokenCookies sets the auth + CSRF cookies and returns the generated
// CSRF token so callers can also echo it into the JSON response body — see
// the CsrfToken field on tokenPair for why the body copy is needed.
func (server *Server) setTokenCookies(ctx *gin.Context, pair *tokenPair) string {
	secure := server.config.IsProduction() || ctx.GetHeader("X-Forwarded-Proto") == "https"

	// SameSite=None cookies are silently dropped by browsers unless Secure is
	// also set, which requires HTTPS. Local dev runs over plain HTTP, so fall
	// back to Lax there — it still works since frontend/backend share the
	// "localhost" site even on different ports.
	if secure {
		ctx.SetSameSite(http.SameSiteNoneMode)
	} else {
		ctx.SetSameSite(http.SameSiteLaxMode)
	}
	ctx.SetCookie("aces_access_token", pair.AccessToken, int(server.config.JWTAccessDuration.Seconds()), "/", "", secure, true)
	ctx.SetCookie("aces_refresh_token", pair.RefreshToken, int(server.config.JWTRefreshDuration.Seconds()), "/", "", secure, true)

	// Non-httpOnly by design — same-origin deployments can read this and
	// echo it back as the X-CSRF-Token header directly; see
	// middleware.CSRFProtect. Cross-origin deployments can't read it (see
	// tokenPair.CsrfToken), so it's also returned below for that case.
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

// mobileBlockedRoles are roles that must never authenticate through the
// mobile app — it's built for students and their delegated student duties
// (class_rep, bursar, etc.), not staff. roleNames arrives here as raw DB
// enum values (see the comment on generateAuthResponse for why the JWT
// deliberately isn't normalized), so this checks the raw forms too.
var mobileBlockedRoles = map[string]bool{
	"lecturer": true,
	"hod":      true,
	"admin":    true,
}

// isMobileClient reports whether the caller is the mobile app, which
// identifies itself with this header on every request (see
// mobile/src/api/client.ts) — the web app never sends it, so a lecturer/
// hod/admin can still sign in there as usual.
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
	// The JWT intentionally carries the raw DB enum role names ("bursar_dept",
	// "admin"), not the normalized display forms ("dept_bursar",
	// "delegated_admin") — every middleware.RequireRoles(...) gate in
	// server.go (34+ call sites) checks against the raw names exclusively, so
	// minting the token with normalized names would silently break every one
	// of those routes for bursar_dept/bursar_class/admin users. Where a
	// normalized form genuinely needs checking (e.g. isStaffRole in
	// payment.go), fix that check site to accept both forms instead of
	// changing what the token carries.
	pair, err := server.tokenManager.GeneratePair(u.ID, string(u.Role), u.Email, allRoles)
	if err != nil {
		return nil, err
	}

	// Tracked by refresh token, not access token — access tokens are
	// short-lived (60min default) and expire naturally; the refresh token is
	// the long-lived (7-day default) credential that "revoke session"/logout
	// actually needs to kill, since a stolen refresh token is what lets an
	// attacker keep minting fresh access tokens indefinitely.
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
		"Welcome to ACES Zone!",
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
		ctx.JSON(http.StatusForbidden, gin.H{"error": "The ACES Zone mobile app is for students and class representatives. Please sign up on the website instead."})
		return
	}

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
		"Welcome to ACES Zone!",
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
		ctx.JSON(http.StatusForbidden, gin.H{"error": "The ACES Zone mobile app is for students and class representatives. Please sign in on the website instead."})
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
		"You have successfully signed in to ACES Zone.",
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
	// Revoke the tracked session for this refresh token so it disappears
	// from "active sessions" and — more importantly — can no longer be used
	// to mint a fresh access token via refreshToken below.
	if q, ok := server.store.(*db.Queries); ok {
		if rt := server.getRefreshTokenFromRequest(ctx); rt != "" {
			if session, err := q.GetActiveSessionByToken(ctx, rt); err == nil {
				_ = q.DeleteActiveSession(ctx, db.DeleteActiveSessionParams{ID: session.ID, UserID: session.UserID})
			}
		}
	}
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

	// The refresh token is cryptographically valid, but a revoked session
	// (logout, "revoke session", "revoke all sessions") deletes its row here
	// — without this check, revocation was cosmetic and a copied refresh
	// token kept minting fresh access tokens until its own 7-day expiry.
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

	// A lecturer/hod/admin session that existed before this check was added
	// (or was somehow issued another way) shouldn't be able to keep itself
	// alive via refresh either — same rule as login.
	if isMobileClient(ctx) && hasBlockedMobileRole(roleNames) {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "The ACES Zone mobile app is for students and class representatives. Please sign in on the website instead."})
		return
	}

	// Raw DB enum role names, matching login — see the comment in
	// generateAuthResponse for why these must NOT be normalized here.
	pair, err := server.tokenManager.GeneratePair(user.ID, string(user.Role), user.Email, roleNames)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}

	// Rotate: the old refresh token's session row is replaced by one for the
	// newly-issued refresh token, so a revoked/used-up token can't be reused
	// and the active-sessions list doesn't accumulate a row per refresh.
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
