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

// unpaidRequiredDues returns the names of any active department/class dues
// (dept_dues, class_dues — deliberately excluding materials/transcript_fee/
// other, which don't gate anything) for the student's level that they
// haven't completed payment on yet. An empty slice means they're clear.
// Course registration and course-form signing both refuse to proceed while
// this is non-empty.
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
		paid, err := store.CheckDuePaid(ctx, db.CheckDuePaidParams{StudentID: studentID, DueID: due.ID})
		if err != nil {
			return nil, err
		}
		if !paid {
			unpaid = append(unpaid, due.Name)
		}
	}
	return unpaid, nil
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
