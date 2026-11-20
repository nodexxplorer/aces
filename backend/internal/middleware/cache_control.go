package middleware

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

// CacheControl sets a private Cache-Control header on successful GET responses
// so the browser and any CDN can reuse a fresh response instead of hitting the
// server again. The cache is private (per-user) because every endpoint is behind
// authentication, and stale-while-revalidate allows the browser to show a cached
// response while refreshing in the background.
func CacheControl(maxAge time.Duration) gin.HandlerFunc {
	seconds := int(maxAge.Seconds())
	value := fmt.Sprintf("private, max-age=%d, stale-while-revalidate=%d", seconds, seconds*2)
	return func(c *gin.Context) {
		c.Next()
		// Only cache successful GET responses.
		if c.Request.Method == "GET" && c.Writer.Status() < 400 {
			c.Header("Cache-Control", value)
		}
	}
}
