package middleware

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/aces/backend/internal/cache"
	"github.com/gin-gonic/gin"
)

// redisForTest returns a client for the Redis at REDIS_TEST_ADDRESS, or skips
// the test when that variable is not set.
func redisForTest(t *testing.T) *cache.RedisCache {
	t.Helper()
	addr := os.Getenv("REDIS_TEST_ADDRESS")
	if addr == "" {
		t.Skip("set REDIS_TEST_ADDRESS (for example 127.0.0.1:6379) to run Redis rate-limit tests")
	}
	c := cache.NewRedisCache(addr, "")
	if err := c.Ping(context.Background()); err != nil {
		t.Fatalf("Redis at %s: %v", addr, err)
	}
	return c
}

// uniqueIP gives each test its own client address, so runs do not share counters.
func uniqueIP(t *testing.T) string {
	t.Helper()
	return fmt.Sprintf("198.51.100.%d", time.Now().UnixNano()%250+1)
}

func limitedEngine(h gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(h)
	r.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })
	return r
}

func hitFrom(r *gin.Engine, ip string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = ip + ":40000"
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestRedisRateLimitScopesDoNotShareCounts(t *testing.T) {
	c := redisForTest(t)
	ip := uniqueIP(t)

	// A route limit of 3 must allow 3 requests even though the global limit
	// (100) also counts every request from the same IP.
	r := gin.New()
	gin.SetMode(gin.TestMode)
	r.Use(RedisRateLimit(c, "global-"+ip, 100, time.Minute))
	r.GET("/", RedisRateLimit(c, "route-"+ip, 3, time.Minute), func(ctx *gin.Context) { ctx.Status(http.StatusOK) })

	for i := 1; i <= 3; i++ {
		if w := hitFrom(r, ip); w.Code != http.StatusOK {
			t.Fatalf("request %d: want 200 within the route limit of 3, got %d", i, w.Code)
		}
	}
	if w := hitFrom(r, ip); w.Code != http.StatusTooManyRequests {
		t.Fatalf("request 4: want 429 over the route limit, got %d", w.Code)
	}
}

func TestRedisRateLimitWindowIsFixed(t *testing.T) {
	c := redisForTest(t)
	ip := uniqueIP(t)
	r := limitedEngine(RedisRateLimit(c, "fixed-"+ip, 2, time.Second))

	if w := hitFrom(r, ip); w.Code != http.StatusOK {
		t.Fatalf("first request: got %d", w.Code)
	}
	time.Sleep(400 * time.Millisecond)
	if w := hitFrom(r, ip); w.Code != http.StatusOK {
		t.Fatalf("second request: got %d", w.Code)
	}
	// 1.3s after the first hit the first one-second window has ended. Hits
	// during the window must not have extended it, so this is a fresh window.
	time.Sleep(900 * time.Millisecond)
	if w := hitFrom(r, ip); w.Code != http.StatusOK {
		t.Fatalf("request after the window ended: want 200, got %d", w.Code)
	}
}

func TestRedisRateLimitHeaders(t *testing.T) {
	c := redisForTest(t)
	ip := uniqueIP(t)
	r := limitedEngine(RedisRateLimit(c, "headers-"+ip, 2, time.Minute))

	want := []string{"1", "0"}
	for i, remaining := range want {
		w := hitFrom(r, ip)
		if w.Code != http.StatusOK {
			t.Fatalf("request %d: got %d", i+1, w.Code)
		}
		if got := w.Header().Get("X-RateLimit-Limit"); got != "2" {
			t.Fatalf("X-RateLimit-Limit = %q, want 2", got)
		}
		if got := w.Header().Get("X-RateLimit-Remaining"); got != remaining {
			t.Fatalf("request %d: X-RateLimit-Remaining = %q, want %q", i+1, got, remaining)
		}
	}
	w := hitFrom(r, ip)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("over the limit: got %d", w.Code)
	}
	if got := w.Header().Get("X-RateLimit-Remaining"); got != "0" {
		t.Fatalf("over the limit: X-RateLimit-Remaining = %q, want 0", got)
	}
}

func TestRedisRateLimitLoopbackIsNotLimited(t *testing.T) {
	c := redisForTest(t)
	r := limitedEngine(RedisRateLimit(c, "loopback", 1, time.Minute))
	for i := 0; i < 5; i++ {
		if w := hitFrom(r, "127.0.0.1"); w.Code != http.StatusOK {
			t.Fatalf("loopback request %d: got %d, want 200 as with the in-memory limiter", i+1, w.Code)
		}
	}
}

// A Redis that cannot be reached must not block requests.
func TestRedisRateLimitFailsOpen(t *testing.T) {
	c := cache.NewRedisCache("127.0.0.1:1", "")
	r := limitedEngine(RedisRateLimit(c, "down", 1, time.Minute))
	for i := 0; i < 3; i++ {
		if w := hitFrom(r, "203.0.113.50"); w.Code != http.StatusOK {
			t.Fatalf("request %d with Redis down: got %d, want 200", i+1, w.Code)
		}
	}
}
