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
