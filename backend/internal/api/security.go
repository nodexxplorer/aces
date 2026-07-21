package api

import (
	"net/http"
	"net/netip"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func (server *Server) getMyActiveSessions(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	q, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	sessions, err := q.ListUserSessions(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": sessions})
}

func (server *Server) revokeSession(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	sessionIDStr := ctx.Param("id")
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	q, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	err = q.DeleteActiveSession(ctx, db.DeleteActiveSessionParams{ID: sessionID, UserID: userID})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": "session revoked"})
}

func (server *Server) revokeAllSessions(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	q, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	err := q.DeleteUserSessions(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": "all sessions revoked"})
}

func (server *Server) checkAccountLockout(ctx *gin.Context, userID uuid.UUID) error {
	q, ok := server.store.(*db.Queries)
	if !ok {
		return nil
	}

	lockout, err := q.GetLockoutStatusByUser(ctx, userID)
	if err != nil {
		return nil
	}

	if lockout.IsLocked && lockout.UnlockAt.Valid && lockout.UnlockAt.Time.After(time.Now()) {
		return err
	}

	return nil
}

func (server *Server) recordFailedLoginAttempt(ctx *gin.Context, userID uuid.UUID, clientIP string) {
	q, ok := server.store.(*db.Queries)
	if !ok {
		return
	}

	_ = q.RecordFailedLogin(ctx, db.RecordFailedLoginParams{
		UserID:  userID,
		Column2: clientIP,
	})

	lockout, err := q.GetLockoutStatusByUser(ctx, userID)
	if err != nil {
		return
	}

	if lockout.FailedAttempts >= 5 {
		_ = q.LockAccount(ctx, userID)
	}
}

func (server *Server) resetFailedAttempts(ctx *gin.Context, userID uuid.UUID) {
	q, ok := server.store.(*db.Queries)
	if !ok {
		return
	}

	_ = q.ResetLockout(ctx, userID)
}

func (server *Server) createUserSession(ctx *gin.Context, userID uuid.UUID, token string, deviceInfo string, ipAddress string, userAgent string, expiresAt time.Time) {
	q, ok := server.store.(*db.Queries)
	if !ok {
		return
	}

	var parsedIP *netip.Addr
	if ipAddress != "" {
		if addr, err := netip.ParseAddr(ipAddress); err == nil {
			parsedIP = &addr
		}
	}

	var exp pgtype.Timestamptz
	_ = exp.Scan(expiresAt)
	_, _ = q.CreateActiveSession(ctx, db.CreateActiveSessionParams{
		UserID:       userID,
		SessionToken: token,
		DeviceInfo:   &deviceInfo,
		IpAddress:    parsedIP,
		UserAgent:    &userAgent,
		ExpiresAt:    exp,
	})
}
