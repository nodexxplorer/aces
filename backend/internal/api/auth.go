package api

import (
	"errors"
	"net/http"
	"strings"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/util"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ─── Request types ────────────────────────────────────────────────────────────

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

// ─── Response types ───────────────────────────────────────────────────────────

type userResponse struct {
	ID        string  `json:"id"`
	Email     string  `json:"email"`
	FirstName string  `json:"firstName"`
	LastName  string  `json:"lastName"`
	Phone     *string `json:"phone,omitempty"`
	Avatar    *string `json:"avatar,omitempty"`
	Roles     []string `json:"roles"`
	ActiveRole string `json:"activeRole"`
	IsApproved bool   `json:"isApproved"`
	ApprovalStatus string `json:"approvalStatus"`
	CreatedAt  string `json:"createdAt"`
}

type authResponse struct {
	User   userResponse `json:"user"`
	Tokens authTokens   `json:"tokens"`
}

type authTokens struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresAt    string `json:"expiresAt"`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func toUserResponse(u db.User) userResponse {
	// Split full_name into first and last name
	parts := strings.SplitN(u.FullName, " ", 2)
	firstName := parts[0]
	lastName := ""
	if len(parts) > 1 {
		lastName = parts[1]
	}

	return userResponse{
		ID:             u.ID.String(),
		Email:          u.Email,
		FirstName:      firstName,
		LastName:       lastName,
		Phone:          u.Phone,
		Avatar:         u.AvatarUrl,
		Roles:          []string{string(u.Role)},
		ActiveRole:     string(u.Role),
		IsApproved:     u.IsActive,
		ApprovalStatus: "approved",
		CreatedAt:      u.CreatedAt.Time.Format(time.RFC3339),
	}
}

// generatePlaceholderTokens creates simple placeholder tokens.
// TODO: Replace with proper JWT token generation.
func generatePlaceholderTokens(userID string) authTokens {
	return authTokens{
		AccessToken:  "aces_" + userID,
		RefreshToken: "refresh_" + userID,
		ExpiresAt:    time.Now().Add(24 * time.Hour).Format(time.RFC3339),
	}
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

// studentSignup POST /auth/signup/student
func (server *Server) studentSignup(ctx *gin.Context) {
	var req studentSignupRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Sanitize
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	fullName := strings.TrimSpace(req.FirstName) + " " + strings.TrimSpace(req.LastName)

	// Check if user already exists
	_, err := server.store.GetUserByEmail(ctx, req.Email)
	if err == nil {
		ctx.JSON(http.StatusConflict, gin.H{"error": "a user with this email already exists"})
		return
	}

	// Hash password
	hashedPassword, err := util.HashPassword(req.Password)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	// Create user
	var phone *string
	if req.Phone != "" {
		p := strings.TrimSpace(req.Phone)
		phone = &p
	}

	user, err := server.store.CreateUser(ctx, db.CreateUserParams{
		Email:        req.Email,
		PasswordHash: hashedPassword,
		Role:         db.UserRoleStudent,
		FullName:     fullName,
		Phone:        phone,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user: " + err.Error()})
		return
	}

	// Create student record
	_, err = server.store.CreateStudent(ctx, db.CreateStudentParams{
		UserID:       user.ID,
		MatricNumber: strings.ToUpper(strings.TrimSpace(req.MatricNumber)),
		Level:        req.Level,
		EntryYear:    int32(time.Now().Year()),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create student record: " + err.Error()})
		return
	}

	resp := authResponse{
		User:   toUserResponse(user),
		Tokens: generatePlaceholderTokens(user.ID.String()),
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": resp})
}

// lecturerSignup POST /auth/signup/lecturer
func (server *Server) lecturerSignup(ctx *gin.Context) {
	var req lecturerSignupRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Sanitize
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	fullName := strings.TrimSpace(req.FirstName) + " " + strings.TrimSpace(req.LastName)

	// Check if user already exists
	_, err := server.store.GetUserByEmail(ctx, req.Email)
	if err == nil {
		ctx.JSON(http.StatusConflict, gin.H{"error": "a user with this email already exists"})
		return
	}

	// Hash password
	hashedPassword, err := util.HashPassword(req.Password)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	// Create user
	var phone *string
	if req.Phone != "" {
		p := strings.TrimSpace(req.Phone)
		phone = &p
	}

	user, err := server.store.CreateUser(ctx, db.CreateUserParams{
		Email:        req.Email,
		PasswordHash: hashedPassword,
		Role:         db.UserRoleLecturer,
		FullName:     fullName,
		Phone:        phone,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user: " + err.Error()})
		return
	}

	// Create staff record
	var specialization *string
	if req.Specialization != "" {
		s := strings.TrimSpace(req.Specialization)
		specialization = &s
	}

	_, err = server.store.CreateStaff(ctx, db.CreateStaffParams{
		UserID:         user.ID,
		StaffID:        strings.ToUpper(strings.TrimSpace(req.StaffId)),
		Department:     strings.TrimSpace(req.Department),
		Specialization: specialization,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create staff record: " + err.Error()})
		return
	}

	resp := authResponse{
		User:   toUserResponse(user),
		Tokens: generatePlaceholderTokens(user.ID.String()),
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": resp})
}

// login POST /auth/login
func (server *Server) login(ctx *gin.Context) {
	var req loginRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	identifier := strings.TrimSpace(req.Email)
	var user db.User
	var err error

	// 1. Try treating it as Email (lowercase)
	user, err = server.store.GetUserByEmail(ctx, strings.ToLower(identifier))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// 2. Try treating it as Matric Number (uppercase)
			student, errMatric := server.store.GetStudentByMatric(ctx, strings.ToUpper(identifier))
			if errMatric == nil {
				user, err = server.store.GetUser(ctx, student.UserID)
			} else {
				// 3. Try treating it as Staff ID (uppercase)
				staff, errStaff := server.store.GetStaffByStaffID(ctx, strings.ToUpper(identifier))
				if errStaff == nil {
					user, err = server.store.GetUser(ctx, staff.UserID)
				} else {
					ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email, matric number, staff ID or password"})
					return
				}
			}
		} else {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email, matric number, staff ID or password"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if !user.IsActive {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "account is deactivated"})
		return
	}

	if err := util.CheckPassword(req.Password, user.PasswordHash); err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email, matric number, staff ID or password"})
		return
	}

	resp := authResponse{
		User:   toUserResponse(user),
		Tokens: generatePlaceholderTokens(user.ID.String()),
	}

	ctx.JSON(http.StatusOK, gin.H{"data": resp})
}

// getMe GET /auth/me
func (server *Server) getMe(ctx *gin.Context) {
	// Extract user ID from the Authorization header token
	authHeader := ctx.GetHeader("Authorization")
	if authHeader == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
		return
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")
	// Our placeholder tokens are "aces_<uuid>"
	userID := strings.TrimPrefix(token, "aces_")

	if userID == "" || userID == token {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	id, err := parseUUID(userID)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	user, err := server.store.GetUser(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": toUserResponse(user)})
}

// logout POST /auth/logout
func (server *Server) logout(ctx *gin.Context) {
	// With placeholder tokens, just acknowledge
	ctx.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}

// parseUUID is a helper to parse UUID strings
func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}
