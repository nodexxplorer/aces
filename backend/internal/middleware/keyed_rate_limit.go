package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/aces/backend/internal/cache"
	"github.com/gin-gonic/gin"
)

// KeyedRateLimit is used AFTER authentication for classroom traffic: students
// sharing campus NAT must not consume a single ten-check-in IP allowance.
// Redis shares counters across instances; a local limiter remains effective
// when Redis is absent or unavailable. Empty identities fail closed.
func KeyedRateLimit(redis *cache.RedisCache, scope string, limit int, window time.Duration, identity func(*gin.Context) string) gin.HandlerFunc {
	local := NewRateLimiter(limit, window)
	return func(ctx *gin.Context) {
		key := identity(ctx)
		if key == "" {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		allowed := false
		if redis != nil {
			count, err := redis.Increment(ctx.Request.Context(), fmt.Sprintf("rl:%s:%s", scope, key), window)
			if err == nil {
				allowed = count <= int64(limit)
			} else {
				allowed = local.allow(key)
			}
		} else {
			allowed = local.allow(key)
		}
		if !allowed {
			ctx.Header("Retry-After", fmt.Sprint(int(window.Seconds())))
			ctx.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "attendance request limit reached; retry shortly"})
			return
		}
		ctx.Next()
	}
}
