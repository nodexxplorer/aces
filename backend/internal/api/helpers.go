package api

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/aces/backend/internal/auth"
	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
)

// getUserID extracts the userID from gin context.
// derefStrPtr returns *s or "" when nil — small convenience for the
// nullable text columns (full_name, matric_number, ...) that the generated
// models expose as *string.
func derefStrPtr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

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

// getStudentIDFromUser resolves the caller's student record ID from their JWT user ID.
func (server *Server) getStudentIDFromUser(ctx *gin.Context) (uuid.UUID, error) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		return uuid.Nil, fmt.Errorf("unauthorized")
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		return uuid.Nil, fmt.Errorf("database not available")
	}

	student, err := queries.GetStudentByUserIDFull(ctx, userID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("student record not found")
	}

	return student.ID, nil
}

// getUserRole extracts the caller's primary role from their JWT claims.
func getUserRole(ctx *gin.Context) string {
	claimsVal, exists := ctx.Get("claims")
	if !exists {
		return ""
	}
	claims, ok := claimsVal.(*auth.Claims)
	if !ok {
		return ""
	}
	return claims.Role
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

func unpaidRequiredDues(ctx context.Context, store db.Querier, studentID uuid.UUID, level int32) ([]string, error) {
	dues, err := store.ListDuesByLevel(ctx, &level)
	if err != nil {
		return nil, err
	}

	var unpaid []string
	for _, due := range dues {
		if !due.IsActive {
			continue
		}
		if due.Type != db.PaymentTypeDeptDues && due.Type != db.PaymentTypeClassDues {
			continue
		}
		paid, err := store.CheckDuePaid(ctx, db.CheckDuePaidParams{StudentID: studentID, DueID: pgtype.UUID{Bytes: due.ID, Valid: true}})
		if err != nil {
			return nil, err
		}
		if !paid {
			unpaid = append(unpaid, due.Name)
		}
	}
	return unpaid, nil
}


const finalYearLevel = int32(500)

func (server *Server) blockOnUnpaidDues(ctx *gin.Context, student db.Student, action string) bool {
	if student.Level >= finalYearLevel {
		if queries, ok := server.store.(*db.Queries); ok {
			if gr, err := queries.GetGraduationRequest(ctx, student.UserID); err == nil &&
				(gr.Status == "paid" || gr.Status == "cleared" || gr.Waived) {
				return false
			}
		}
		ctx.JSON(http.StatusForbidden, gin.H{
			"error":               "final-year students pay the graduation course-form signing fee instead of dues — settle it before " + action,
			"graduation_required": true,
		})
		return true
	}

	if unpaid, err := unpaidRequiredDues(ctx, server.store, student.ID, student.Level); err == nil && len(unpaid) > 0 {
		ctx.JSON(http.StatusForbidden, gin.H{
			"error":       "you must pay your outstanding dues before " + action,
			"unpaid_dues": unpaid,
		})
		return true
	}
	return false
}

func (server *Server) RequireStudentOnboarded(ctx *gin.Context) {
	userIDStr, exists := ctx.Get("userID")
	if !exists {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	roleNames, _ := server.roles.ListUserRolesByName(ctx, userID)
	if hasStaffRole(roleNames) {
		ctx.Next()
		return
	}
	user, err := server.store.GetUser(ctx, userID)
	if err != nil {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	if user.Role != db.UserRoleStudent {
		ctx.Next()
		return
	}

	q, ok := server.store.(*db.Queries)
	if !ok {
		ctx.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	student, err := q.GetStudentByUserId(ctx, userID)
	if err != nil {
		ctx.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "student profile not found"})
		return
	}
	if !student.OnboardingCompleted {
		ctx.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error":             "finish setting up your profile first",
			"onboarding_needed": true,
		})
		return
	}
	ctx.Next()
}

func (server *Server) notifyUser(
	ctx context.Context,
	userID uuid.UUID,
	notifType string,
	category string,
	priority string,
	title string,
	message string,
	actionURL string,
	actionLabel string,
	entityType *string,
	entityID *uuid.UUID,
) {
	if server.notificationsFull == nil || userID == uuid.Nil {
		return
	}
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, err := server.notificationsFull.CreateAndPush(
			bgCtx,
			userID,
			notifType,
			category,
			priority,
			title,
			message,
			actionURL,
			actionLabel,
			nil,
			entityType,
			entityID,
			nil,
		)
		if err != nil {
			log.Printf("[notification] failed to send notification (type=%s, user=%s): %v", notifType, userID, err)
		}
	}()
}
