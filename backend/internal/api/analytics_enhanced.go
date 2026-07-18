package api

import (
	"net/http"

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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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

	trend, err := queries.GetAnalyticsTrend(ctx, 30)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": trend})
}
