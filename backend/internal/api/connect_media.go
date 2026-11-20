package api

import (
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aces/backend/internal/connectmedia"
	"github.com/aces/backend/internal/tenant"
	"github.com/aces/backend/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (server *Server) connectMedia() *connectmedia.Service {
	return &connectmedia.Service{Pool: server.dbPool, Root: server.config.StorageLocalPath}
}
func connectError(ctx *gin.Context, err error) {
	code := 500
	msg := "Connect media could not be processed"
	switch {
	case errors.Is(err, connectmedia.ErrInvalid):
		code = 400
		msg = err.Error()
	case errors.Is(err, connectmedia.ErrForbidden):
		code = 403
		msg = err.Error()
	case errors.Is(err, connectmedia.ErrConflict):
		code = 409
		msg = err.Error()
	case errors.Is(err, connectmedia.ErrQuota):
		code = 429
		msg = err.Error()
	case errors.Is(err, connectmedia.ErrUnavailable):
		code = 503
		msg = err.Error()
	default:
		log.Printf("[connect-media] %v", err)
	}
	ctx.JSON(code, gin.H{"error": msg})
}
func (server *Server) connectRecordingIntent(ctx *gin.Context) {
	var target connectmedia.Target
	if ctx.ShouldBindJSON(&target) != nil {
		connectError(ctx, connectmedia.ErrInvalid)
		return
	}
	id, err := server.connectMedia().Intent(ctx.Request.Context(), getUserID(ctx), target)
	if err != nil {
		connectError(ctx, err)
		return
	}
	ctx.JSON(200, gin.H{"data": gin.H{"id": id}})
}
func (server *Server) uploadConnectMedia(ctx *gin.Context) {
	// The general server uses 15s deadlines: allow slow mobile uploads and
	// bounded transcoding only on this authenticated, size-limited route.
	control := http.NewResponseController(ctx.Writer)
	_ = control.SetReadDeadline(time.Now().Add(90 * time.Second))
	_ = control.SetWriteDeadline(time.Now().Add(150 * time.Second))
	work, cancel := context.WithTimeout(ctx.Request.Context(), 140*time.Second)
	defer cancel()
	ctx.Request = ctx.Request.WithContext(work)

	// Bound both request and decoded input; multipart spill files must be removed.
	ctx.Request.Body = http.MaxBytesReader(ctx.Writer, ctx.Request.Body, connectmedia.MaxInput+(1<<20))
	if err := ctx.Request.ParseMultipartForm(1 << 20); err != nil {
		connectError(ctx, connectmedia.ErrInvalid)
		return
	}
	defer ctx.Request.MultipartForm.RemoveAll()
	targetID, e := uuid.Parse(ctx.PostForm("target_id"))
	nonce, e2 := uuid.Parse(ctx.PostForm("upload_nonce"))
	intent, _ := uuid.Parse(ctx.PostForm("recording_intent"))
	if e != nil || e2 != nil {
		connectError(ctx, connectmedia.ErrInvalid)
		return
	}
	if len(ctx.Request.MultipartForm.File) != 1 || len(ctx.Request.MultipartForm.File["file"]) != 1 {
		connectError(ctx, connectmedia.ErrInvalid)
		return
	}
	header := ctx.Request.MultipartForm.File["file"][0]
	if header.Size > connectmedia.MaxInput {
		connectError(ctx, connectmedia.ErrInvalid)
		return
	}
	file, err := header.Open()
	if err != nil {
		connectError(ctx, err)
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, connectmedia.MaxInput+1))
	if err != nil {
		connectError(ctx, err)
		return
	}
	a, err := server.connectMedia().Upload(ctx.Request.Context(), getUserID(ctx), connectmedia.Target{Kind: ctx.PostForm("target_kind"), ID: targetID}, ctx.PostForm("kind"), nonce, intent, data)
	if err != nil {
		connectError(ctx, err)
		return
	}
	ctx.JSON(200, gin.H{"data": a})
}
func (server *Server) getConnectMedia(ctx *gin.Context) {
	if action := ctx.Param("action"); action != "" && action != "content" {
		ctx.Status(404)
		return
	}
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.Status(404)
		return
	}
	a, path, err := server.connectMedia().Access(ctx.Request.Context(), getUserID(ctx), id)
	if err != nil {
		ctx.Status(404)
		return
	}
	if ctx.Param("action") != "content" {
		ctx.JSON(200, gin.H{"data": a})
		return
	}
	if info, e := os.Lstat(path); e != nil || !info.Mode().IsRegular() {
		ctx.Status(404)
		return
	}
	ctx.Header("X-Content-Type-Options", "nosniff")
	ctx.Header("Content-Type", a.Mime)
	ctx.Header("Content-Disposition", "inline")
	_ = http.NewResponseController(ctx.Writer).SetWriteDeadline(time.Now().Add(90 * time.Second))
	ctx.File(path)
}
func (server *Server) deleteConnectMedia(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		connectError(ctx, connectmedia.ErrInvalid)
		return
	}
	if err = server.connectMedia().Remove(ctx.Request.Context(), getUserID(ctx), id); err != nil {
		connectError(ctx, err)
		return
	}
	ctx.JSON(200, gin.H{"data": gin.H{"deleted": true}})
}
func (server *Server) sendConnectMessage(ctx *gin.Context) {
	ctx.Header("Cache-Control", "no-store")
	ctx.Request.Body = http.MaxBytesReader(ctx.Writer, ctx.Request.Body, 64<<10)
	var req connectmedia.SendRequest
	if ctx.ShouldBindJSON(&req) != nil {
		connectError(ctx, connectmedia.ErrInvalid)
		return
	}
	target := connectmedia.Target{Kind: "dm", ID: req.ReceiverID}
	if strings.HasPrefix(ctx.FullPath(), "/api/v1/groups/") {
		target.Kind = "group"
		var err error
		target.ID, err = uuid.Parse(ctx.Param("id"))
		if err != nil {
			connectError(ctx, connectmedia.ErrInvalid)
			return
		}
	}
	data, created, err := server.connectMedia().Send(ctx.Request.Context(), getUserID(ctx), target, req)
	if err != nil {
		connectError(ctx, err)
		return
	}
	if created && server.wsHub != nil {
		if target.Kind == "dm" {
			server.wsHub.SendToUser(target.ID, ws.TypeChat, data)
		} else {
			members, e := server.currentConnectMembers(ctx.Request.Context(), target.ID)
			if e == nil {
				for _, m := range members {
					server.wsHub.SendToUser(m, ws.TypeGroupChat, data)
				}
			}
		}
	}
	ctx.JSON(200, gin.H{"data": data})
}
func (server *Server) listConnectMessages(ctx *gin.Context) {
	ctx.Header("Cache-Control", "no-store")
	target := connectmedia.Target{Kind: "dm"}
	var err error
	target.ID, err = uuid.Parse(ctx.Param("id"))
	if err != nil {
		connectError(ctx, connectmedia.ErrInvalid)
		return
	}
	if strings.HasPrefix(ctx.FullPath(), "/api/v1/groups/") {
		target.Kind = "group"
	}
	data, err := server.connectMedia().List(ctx.Request.Context(), getUserID(ctx), target)
	if err != nil {
		connectError(ctx, err)
		return
	}
	ctx.JSON(200, gin.H{"data": data})
}

func (server *Server) currentConnectMembers(ctx context.Context, group uuid.UUID) ([]uuid.UUID, error) {
	t, ok := tenant.IDFrom(ctx)
	if !ok {
		return nil, connectmedia.ErrForbidden
	}
	rows, err := server.dbPool.Query(ctx, `SELECT gm.user_id FROM group_members gm JOIN users u ON u.tenant_id=gm.tenant_id AND u.id=gm.user_id WHERE gm.tenant_id=$1 AND gm.group_id=$2 AND u.is_active AND u.is_approved AND u.deleted_at IS NULL`, t, group)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := []uuid.UUID{}
	for rows.Next() {
		var id uuid.UUID
		if err = rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
