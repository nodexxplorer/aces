package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func (server *Server) getDashboardStats(ctx *gin.Context) {
	stats, err := server.analytics.GetDashboardStats(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get dashboard stats"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": stats})
}

func (server *Server) getRecentUsers(ctx *gin.Context) {
	limit := 5
	if l := ctx.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	users, err := server.analytics.GetRecentUsers(ctx, limit)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get recent users"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": users})
}

func (server *Server) getRecentActivity(ctx *gin.Context) {
	activity, err := server.analytics.GetRecentActivity(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get recent activity"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": activity})
}

func (server *Server) getPerformanceTrend(ctx *gin.Context) {
	trend, err := server.analytics.GetPerformanceTrend(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get performance trend"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": trend})
}
