package api

import (
	"net/http"
	"strconv"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
)

func (server *Server) getAnalyticsOverview(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	overview, err := queries.GetAnalyticsOverview(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": overview})
}

func (server *Server) getAnalyticsTrend(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	days := int32(30)
	if d := ctx.Query("days"); d != "" {
		if parsed, err := strconv.ParseInt(d, 10, 32); err == nil && parsed > 0 && parsed <= 365 {
			days = int32(parsed)
		}
	}

	trend, err := queries.GetAnalyticsTrend(ctx, days)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": trend})
}
