package api

import (
	"net/http"

	"github.com/aces/backend/internal/auth"
	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
)

// getUserID extracts the userID from gin context.
func getUserID(ctx *gin.Context) uuid.UUID {
	val, exists := ctx.Get("userID")
	if !exists {
		return uuid.Nil
	}
	switch v := val.(type) {
	case uuid.UUID:
		return v
	case string:
		if parsed, err := uuid.Parse(v); err == nil {
			return parsed
		}
	}
	return uuid.Nil
}

func decimalFromFloat64(f float64) decimal.Decimal {
	return decimal.NewFromFloat(f)
}

func pgUUIDToUUID(p pgtype.UUID) uuid.UUID {
	return uuid.UUID(p.Bytes)
}

func isStaffCaller(ctx *gin.Context) bool {
	claimsVal, exists := ctx.Get("claims")
	if !exists {
		return false
	}
	c, ok := claimsVal.(*auth.Claims)
	if !ok {
		return false
	}
	return c.HasAnyRole([]string{"hod", "admin", "delegated_admin"})
}

func requireOwnershipOrStaff(ctx *gin.Context, store db.Querier, recordStudentID uuid.UUID) bool {
	if isStaffCaller(ctx) {
		return true
	}
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return false
	}
	student, err := store.GetStudentByUserId(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return false
	}
	if student.ID != recordStudentID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "you can only access your own records"})
		return false
	}
	return true
}

func requireOwnershipOrStaffByStudentIDParam(ctx *gin.Context, store db.Querier) (uuid.UUID, bool) {
	if isStaffCaller(ctx) {
		userID := getUserID(ctx)
		return userID, true
	}
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return uuid.Nil, false
	}
	student, err := store.GetStudentByUserId(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return uuid.Nil, false
	}
	return student.ID, true
}
