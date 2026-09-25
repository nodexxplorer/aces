package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	db "github.com/aces/backend/internal/db/sql"
)

// ── Session roll-over: HOD/admin-confirmed batch level promotion ──

type prepareRollOverRequest struct {
	SessionID string `json:"session_id" binding:"required"`
}

type flipPromotionRequest struct {
	Status string `json:"status" binding:"required"` // promote | carryover | held_back
	Reason string `json:"reason"`
}

// promotionStatusFor maps a flip request to a DB status + reason.
func promotionStatusFor(status string) (dbStatus, reason string, ok bool) { //nolint
	switch status {
	case "promote":
		return "proposed", "manual_advance", true
	case "carryover":
		return "proposed", "carryover", true
	case "held_back":
		return "held_back", "held_back", true
	}
	return "", "", false
}

// prepareLevelPromotion POST /session-rollover/prepare
// (hod, admin, delegated_admin) — generates/refreshes the promotion
// proposal set for a session based on the previous cycle.
func (server *Server) prepareLevelPromotion(ctx *gin.Context) {
	var req prepareRollOverRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}
	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	created, err := queries.GenerateLevelPromotionProposals(ctx, sessionID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "could not prepare roll-over"})
		return
	}

	total, err := queries.CountLevelPromotionProposals(ctx, sessionID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"created": created,
		"total":   total,
	})
}

// listLevelPromotions GET /session-rollover/:sessionId
// (hod, admin, delegated_admin) — per-level summary + full proposal list.
func (server *Server) listLevelPromotions(ctx *gin.Context) {
	sessionID, err := uuid.Parse(ctx.Param("sessionId"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	summary, err := queries.SummarizeLevelPromotions(ctx, sessionID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	proposals, err := queries.ListLevelPromotionProposals(ctx, sessionID, nil)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"summary":   summary,
		"proposals": proposals,
	})
}

// flipLevelPromotion PATCH /session-rollover/:sessionId/promotions/:id
// (hod, admin, delegated_admin) — move one student between promote /
// carryover / held_back before the batch is confirmed.
func (server *Server) flipLevelPromotion(ctx *gin.Context) {
	promotionID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid promotion id"})
		return
	}

	var req flipPromotionRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	dbStatus, reason, ok := promotionStatusFor(req.Status)
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "status must be promote, carryover or held_back"})
		return
	}

	queries, ok2 := server.store.(*db.Queries)
	if !ok2 {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	p, err := queries.SetLevelPromotionStatus(ctx, promotionID, dbStatus, reason)
	if err != nil {
		if err.Error() == "proposal not found or already confirmed" {
			ctx.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, p)
}

// confirmLevelPromotion POST /session-rollover/:sessionId/confirm
// (hod, admin, delegated_admin) — atomically applies the batch: bumps
// levels, rolls all active students into the new session, activates it,
// and notifies affected students.
func (server *Server) confirmLevelPromotion(ctx *gin.Context) {
	sessionID, err := uuid.Parse(ctx.Param("sessionId"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}
	confirmedBy := getUserID(ctx)

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	pool := server.dbPool
	if pool == nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Snapshot who is being promoted (for notifications) before applying.
	toConfirm, err := queries.ListLevelPromotionProposals(ctx, sessionID, nil)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	promotedUserIDs := make([]uuid.UUID, 0, len(toConfirm))
	for _, p := range toConfirm {
		if p.Status == "proposed" && p.ToLevel > p.FromLevel {
			promotedUserIDs = append(promotedUserIDs, p.UserID)
		}
	}

	// Transaction: apply batch atomically.
	tx, err := pool.Begin(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	defer tx.Rollback(ctx)

	txQueries := queries.WithTx(tx)
	promoted, rolled, err := txQueries.ApplyLevelPromotionBatch(ctx, sessionID, confirmedBy)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "could not apply roll-over"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Fire-and-forget notifications (outside the tx; failure is non-fatal).
	go server.notifyPromotions(promotedUserIDs, sessionID)

	ctx.JSON(http.StatusOK, gin.H{
		"promoted": promoted,
		"rolled":   rolled,
		"notified": len(promotedUserIDs),
	})
}

// notifyPromotions tells each promoted student their new level.
func (server *Server) notifyPromotions(userIDs []uuid.UUID, sessionID uuid.UUID) {
	ctx := context.Background()
	queries, ok := server.store.(*db.Queries)
	if !ok {
		return
	}
	sessionName, err := queries.GetSessionName(ctx, sessionID)
	if err != nil {
		sessionName = "the new session"
	}

	for _, uid := range userIDs {
		_, _ = queries.CreateNotificationFull(ctx, db.CreateNotificationFullParams{
			UserID:    uid,
			Type:      "system",
			Title:     "Level Promotion",
			Message:   fmt.Sprintf("Congratulations! You have been promoted to the next level for %s.", sessionName),
			Category:  "academic",
			Priority:  "normal",
			EmailSent: false,
		})
	}
}
