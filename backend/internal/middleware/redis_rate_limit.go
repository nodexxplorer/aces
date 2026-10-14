package middleware

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/aces/backend/internal/cache"
	"github.com/gin-gonic/gin"
)

// RedisRateLimit allows limit requests per client IP in each window. The count
// is kept in Redis, so every server instance shares it. scope names the limit
// ("global", "auth", ...): two limiters with different scopes never share a
// counter, even for the same IP.
//
// It behaves like RateLimit in other respects: loopback addresses are not
// limited, and a Redis failure lets the request through (the error is logged).
func RedisRateLimit(c *cache.RedisCache, scope string, limit int, window time.Duration) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ip := ctx.ClientIP()
		if ip == "127.0.0.1" || ip == "::1" {
			ctx.Next()
			return
		}

		key := fmt.Sprintf("rl:%s:%s", scope, ip)
		count, err := c.Increment(ctx.Request.Context(), key, window)
		if err != nil {
			log.Printf("[rate limit] %s: allowing request, Redis check failed: %v", scope, err)
			ctx.Next()
			return
		}

		remaining := int64(limit) - count
		if remaining < 0 {
			remaining = 0
		}
		ctx.Header("X-RateLimit-Limit", strconv.Itoa(limit))
		ctx.Header("X-RateLimit-Remaining", strconv.FormatInt(remaining, 10))

		if count > int64(limit) {
			ctx.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retry_after": window.String(),
			})
			return
		}
		ctx.Next()
	}
}
