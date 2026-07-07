package api

import (
	"net/http"
	"strings"

	"github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/util"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type createUserRequest struct {
	Email          string  `json:"email" binding:"required,email"`
	Password       string  `json:"password" binding:"required,min=6,max=72"`
	Role           string  `json:"role" binding:"required,oneof=hod admin lecturer class_rep student bursar_dept bursar_class"`
	FullName       string  `json:"full_name" binding:"required,min=2,max=255"`
	Phone          *string `json:"phone" binding:"omitempty,max=20"`
	AvatarUrl      *string `json:"avatar_url" binding:"omitempty,url"`
	CreatedByHodID string  `json:"created_by_hod_id" binding:"omitempty,uuid"`
}

func (server *Server) createUser(ctx *gin.Context) {
	var req createUserRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Sanitization
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.FullName = strings.TrimSpace(req.FullName)
	if req.Phone != nil {
		sanitizedPhone := strings.TrimSpace(*req.Phone)
		req.Phone = &sanitizedPhone
	}

	hashedPassword, err := util.HashPassword(req.Password)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	arg := db.CreateUserParams{
		Email:        req.Email,
		PasswordHash: hashedPassword,
		Role:         db.UserRole(req.Role),
		FullName:     req.FullName,
		Phone:        req.Phone,
		AvatarUrl:    req.AvatarUrl,
	}

	if req.CreatedByHodID != "" {
		hodID, err := uuid.Parse(req.CreatedByHodID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid created_by_hod_id, must be a valid UUID"})
			return
		}
		arg.CreatedByHodID = pgtype.UUID{Bytes: hodID, Valid: true}
	}

	user, err := server.store.CreateUser(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Clear the password hash before sending the response
	user.PasswordHash = ""

	ctx.JSON(http.StatusOK, user)
}

func (server *Server) getUser(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	user, err := server.store.GetUser(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	user.PasswordHash = ""
	ctx.JSON(http.StatusOK, user)
}

type listUsersRequest struct {
	PageID   int32 `form:"page_id" binding:"required,min=1"`
	PageSize int32 `form:"page_size" binding:"required,min=5,max=100"`
}

func (server *Server) listUsers(ctx *gin.Context) {
	var req listUsersRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.ListUsersParams{
		Limit:  req.PageSize,
		Offset: (req.PageID - 1) * req.PageSize,
	}

	users, err := server.store.ListUsers(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for i := range users {
		users[i].PasswordHash = ""
	}

	ctx.JSON(http.StatusOK, users)
}

type updateUserRequest struct {
	FullName         string  `json:"full_name" binding:"required,min=2,max=255"`
	Phone            *string `json:"phone" binding:"omitempty,max=20"`
	AvatarUrl        *string `json:"avatar_url" binding:"omitempty,url"`
	IsActive         bool    `json:"is_active"`
	EmailVerified    bool    `json:"email_verified"`
	TwoFactorEnabled bool    `json:"two_factor_enabled"`
}

func (server *Server) updateUser(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	var req updateUserRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.UpdateUserParams{
		ID:               id,
		FullName:         strings.TrimSpace(req.FullName),
		Phone:            req.Phone,
		AvatarUrl:        req.AvatarUrl,
		IsActive:         req.IsActive,
		EmailVerified:    req.EmailVerified,
		TwoFactorEnabled: req.TwoFactorEnabled,
	}

	if arg.Phone != nil {
		sanitizedPhone := strings.TrimSpace(*arg.Phone)
		arg.Phone = &sanitizedPhone
	}

	user, err := server.store.UpdateUser(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	user.PasswordHash = ""
	ctx.JSON(http.StatusOK, user)
}

func (server *Server) deleteUser(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	err = server.store.DeleteUser(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "user deleted"})
}

