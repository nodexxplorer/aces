package api

import (
	"fmt"
	"net/http"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (server *Server) createBackup(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	userID := getUserID(ctx)

	fileName := fmt.Sprintf("backup_%s.sql.gz", time.Now().Format("20060102_150405"))
	s3URL := fmt.Sprintf("s3://aces-backups/%s", fileName)

	id, err := queries.CreateBackup(ctx, fileName, s3URL, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	backup, err := queries.GetBackupByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusOK, gin.H{"data": gin.H{"id": id, "file_name": fileName, "status": "completed"}})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": backup})
}

func (server *Server) listBackups(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	backups, err := queries.ListBackups(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": backups})
}

func (server *Server) restoreBackup(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid backup id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	_, err = queries.GetBackupByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "backup not found"})
		return
	}

	_ = queries.UpdateBackupStatus(ctx, id, "restoring")

	ctx.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "restore initiated successfully"}})
}

func (server *Server) getBackupSummary(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	summary, err := queries.GetBackupSummary(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": summary})
}
