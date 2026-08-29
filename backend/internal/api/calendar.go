package api

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/aces/backend/internal/utils"
	"github.com/gin-gonic/gin"
)

func generateCalendarFeedToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// getCalendarToken GET /calendar/token
// Returns the caller's calendar feed token, generating one on first call.
// The frontend builds the full subscribe URL from this (same pattern as
// downloadAttendancePDF in frontend/src/api/attendance.ts).
func (server *Server) getCalendarToken(ctx *gin.Context) {
	userID := getUserID(ctx)

	token, err := server.store.GetUserCalendarFeedToken(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if token == nil || *token == "" {
		newToken, err := generateCalendarFeedToken()
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate calendar token"})
			return
		}
		if err := server.store.SetUserCalendarFeedToken(ctx, userID, newToken); err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save calendar token"})
			return
		}
		token = &newToken
	}

	ctx.JSON(http.StatusOK, gin.H{"token": *token})
}

// regenerateCalendarToken POST /calendar/token/regenerate
// Issues a fresh token, immediately invalidating whatever URL was built
// from the old one — the only way to revoke a leaked calendar link.
func (server *Server) regenerateCalendarToken(ctx *gin.Context) {
	userID := getUserID(ctx)

	newToken, err := generateCalendarFeedToken()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate calendar token"})
		return
	}
	if err := server.store.SetUserCalendarFeedToken(ctx, userID, newToken); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save calendar token"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"token": newToken})
}

// getCalendarFeed GET /calendar/feed/:token
// Public — no auth. Calendar clients (Google/Apple/Outlook "subscribe by
// URL") fetch subscription URLs with no auth headers, so the token in the
// path is the only credential. Feeds the caller's study task due dates as
// one-off .ics events.
func (server *Server) getCalendarFeed(ctx *gin.Context) {
	token := ctx.Param("token")
	if token == "" {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	user, err := server.store.GetUserByCalendarFeedToken(ctx, token)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var events []utils.ICSEvent

	// Study tasks — personal, not level-scoped.
	tasks, terr := server.store.ListUserStudyTasks(ctx, user.ID)
	if terr == nil {
		for _, t := range tasks {
			if !t.DueDate.Valid {
				continue
			}
			desc := ""
			if t.Description != nil {
				desc = *t.Description
			}
			location := ""
			if t.CourseCode != nil {
				location = *t.CourseCode
			}
			events = append(events, utils.ICSEvent{
				UID:         "task-" + t.ID.String(),
				Title:       "Due: " + t.Title,
				Description: desc,
				Location:    location,
				Start:       t.DueDate.Time,
				End:         t.DueDate.Time.Add(30 * time.Minute),
			})
		}
	}

	ics := utils.GenerateICSFeed("ACES Zone — "+user.FullName, events)
	ctx.Header("Content-Disposition", `inline; filename="aces-zone.ics"`)
	ctx.Data(http.StatusOK, "text/calendar; charset=utf-8", ics)
}
