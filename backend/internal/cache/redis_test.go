package cache

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"
)

func redisForTest(t *testing.T) *RedisCache {
	t.Helper()
	addr := os.Getenv("REDIS_TEST_ADDRESS")
	if addr == "" {
		t.Skip("set REDIS_TEST_ADDRESS (for example 127.0.0.1:6379) to run Redis tests")
	}
	c := NewRedisCache(addr, "")
	if err := c.Ping(context.Background()); err != nil {
		t.Fatalf("Redis at %s: %v", addr, err)
	}
	return c
}

func testKey(t *testing.T, name string) string {
	return fmt.Sprintf("test:%s:%d", name, time.Now().UnixNano())
}

func TestIncrementCountsAndStartsWindowOnce(t *testing.T) {
	c := redisForTest(t)
	ctx := context.Background()
	key := testKey(t, "window")
	t.Cleanup(func() { c.Delete(ctx, key) })

	for want := int64(1); want <= 3; want++ {
		n, err := c.Increment(ctx, key, 2*time.Second)
		if err != nil {
			t.Fatal(err)
		}
		if n != want {
			t.Fatalf("count = %d, want %d", n, want)
		}
		time.Sleep(300 * time.Millisecond)
	}

	// Three hits spread over about 0.9s. A window that is extended on every
	// hit would still have 1.1s to run; a fixed window has about 1.1s left too,
	// so check the TTL is shrinking, not reset to the full window.
	pttl := c.client.PTTL(ctx, key).Val()
	if pttl <= 0 || pttl > 1300*time.Millisecond {
		t.Fatalf("pttl = %v after 0.9s of a 2s window, want about 1.1s", pttl)
	}
}

func TestIncrementRestoresMissingExpiry(t *testing.T) {
	c := redisForTest(t)
	ctx := context.Background()
	key := testKey(t, "noexpiry")
	t.Cleanup(func() { c.Delete(ctx, key) })

	// A counter with no expiry, as an older server or a crash could leave.
	if err := c.client.Set(ctx, key, 5, 0).Err(); err != nil {
		t.Fatal(err)
	}
	n, err := c.Increment(ctx, key, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if n != 6 {
		t.Fatalf("count = %d, want 6", n)
	}
	if pttl := c.client.PTTL(ctx, key).Val(); pttl <= 0 {
		t.Fatalf("pttl = %v, want an expiry to be set", pttl)
	}
}

func TestRateLimitOverLimit(t *testing.T) {
	c := redisForTest(t)
	ctx := context.Background()
	key := testKey(t, "limit")
	t.Cleanup(func() { c.Delete(ctx, key) })

	for i := 1; i <= 2; i++ {
		exceeded, err := c.RateLimit(ctx, key, 2, time.Minute)
		if err != nil || exceeded {
			t.Fatalf("hit %d: exceeded=%v err=%v, want within limit", i, exceeded, err)
		}
	}
	exceeded, err := c.RateLimit(ctx, key, 2, time.Minute)
	if err != nil || !exceeded {
		t.Fatalf("hit 3: exceeded=%v err=%v, want over limit", exceeded, err)
	}
}
