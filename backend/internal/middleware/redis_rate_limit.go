package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/aces/backend/internal/cache"
	"github.com/gin-gonic/gin"
)

type RedisRateLimiter struct {
	cache  *cache.RedisCache
	limit  int
	window time.Duration
}

func NewRedisRateLimiter(c *cache.RedisCache, limit int, window time.Duration) *RedisRateLimiter {
	return &RedisRateLimiter{cache: c, limit: limit, window: window}
}

func (rl *RedisRateLimiter) allow(ctx context.Context, key string) (bool, int, error) {
	exceeded, err := rl.cache.RateLimit(ctx, key, rl.limit, rl.window)
	if err != nil {
		return false, 0, err
	}
	return !exceeded, rl.limit, nil
}

func RedisRateLimit(c *cache.RedisCache, limit int, window time.Duration) gin.HandlerFunc {
	limiter := NewRedisRateLimiter(c, limit, window)
	return func(ctx *gin.Context) {
		key := fmt.Sprintf("rl:%s", ctx.ClientIP())
		allowed, max, err := limiter.allow(ctx.Request.Context(), key)
		if err != nil {
			ctx.Next()
			return
		}

		ctx.Header("X-RateLimit-Limit", fmt.Sprintf("%d", max))
		ctx.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", max-1))

		if !allowed {
			ctx.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retry_after": window.String(),
			})
			return
		}
		ctx.Next()
	}
}
