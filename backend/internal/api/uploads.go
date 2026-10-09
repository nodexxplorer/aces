package api

import (
	"net/http"
	"os"

	"github.com/aces/backend/internal/uploads"
	"github.com/gin-gonic/gin"
)

// registerUploadRoutes serves stored files. A request must carry a link that
// SignUploadLinks issued for it, and the link must not have expired. Anything
// else gets the same 404 as a missing file, so a response never shows which
// files exist.
func (server *Server) registerUploadRoutes(router *gin.Engine) {
	router.GET(uploads.Route+"/*filepath", server.serveUpload)
	router.HEAD(uploads.Route+"/*filepath", server.serveUpload)
}

// serveUpload GET /uploads/*filepath
func (server *Server) serveUpload(ctx *gin.Context) {
	store := ctx.Param("filepath")
	if err := server.uploads.Verify(store, ctx.Query("exp"), ctx.Query("sig")); err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	if server.config == nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	full, err := uploads.FilePath(server.config.StorageLocalPath, store)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	if info, err := os.Stat(full); err != nil || info.IsDir() {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	// The browser must not sniff a stored file into another type, such as HTML.
	ctx.Header("X-Content-Type-Options", "nosniff")
	ctx.File(full)
}
