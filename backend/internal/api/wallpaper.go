package api

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"

	"github.com/aces/backend/internal/service"
)

// maxWallpaperPrompt is the longest description accepted, in characters.
const maxWallpaperPrompt = 300

// generateWallpaper creates a sign-in wallpaper from a short description. The
// picture goes back to the caller; nothing is stored on the server.
func (s *Server) generateWallpaper(c *gin.Context) {
	var req struct {
		Prompt string `json:"prompt"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Describe the wallpaper you want."})
		return
	}
	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Describe the wallpaper you want."})
		return
	}
	if utf8.RuneCountInString(prompt) > maxWallpaperPrompt {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Keep the description to 300 characters or fewer."})
		return
	}

	out, err := s.wallpapers.Generate(c.Request.Context(), prompt)
	if err != nil {
		if errors.Is(err, service.ErrWallpaperNotConfigured) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Creating wallpapers is not set up on this server."})
			return
		}
		log.Printf("[wallpaper] generate failed: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "The wallpaper could not be created. Try a different description."})
		return
	}
	c.JSON(http.StatusOK, out)
}
