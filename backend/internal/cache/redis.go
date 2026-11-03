package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisCache struct {
	client *redis.Client
}

// Timeouts keep a slow or unreachable Redis from holding up requests. A rate
// limit check that times out fails open (see middleware.RedisRateLimit).
const (
	redisDialTimeout = 2 * time.Second
	redisIOTimeout   = 500 * time.Millisecond
)

func NewRedisCache(address, password string) *RedisCache {
	rdb := redis.NewClient(&redis.Options{
		Addr:         address,
		Password:     password,
		DB:           0, // Use default DB
		DialTimeout:  redisDialTimeout,
		ReadTimeout:  redisIOTimeout,
		WriteTimeout: redisIOTimeout,
		// No retries, neither for a command nor for a dial: a failed check is
		// allowed through at once (see middleware.RedisRateLimit), so waiting
		// on retries would only slow every request while Redis is down.
		MaxRetries:    -1,
		DialerRetries: 1,
	})

	return &RedisCache{client: rdb}
}

// Ping checks if Redis is responsive
func (c *RedisCache) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}

// Set stores a key-value pair in Redis with an optional expiration time
func (c *RedisCache) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return c.client.Set(ctx, key, value, expiration).Err()
}

// Get retrieves a value from Redis
func (c *RedisCache) Get(ctx context.Context, key string) (string, error) {
	val, err := c.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", fmt.Errorf("key does not exist: %s", key)
	}
	return val, err
}

// Delete removes a key from Redis
func (c *RedisCache) Delete(ctx context.Context, key string) error {
	return c.client.Del(ctx, key).Err()
}

// incrementWindowScript adds one to a counter and starts its window on the
// first hit. Later hits leave the expiry alone, so the window is fixed: a
// client is blocked for at most one window, not for as long as it keeps
// calling. Running it as one script keeps the increment and the expiry
// together, so a crash between them cannot leave a counter with no expiry.
var incrementWindowScript = redis.NewScript(`
local n = redis.call('INCR', KEYS[1])
if redis.call('PTTL', KEYS[1]) < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return n
`)

// Increment counts one hit on key in its current window and returns the count
// so far, this hit included.
func (c *RedisCache) Increment(ctx context.Context, key string, window time.Duration) (int64, error) {
	n, err := incrementWindowScript.Run(ctx, c.client, []string{key}, window.Milliseconds()).Int64()
	if err != nil {
		return 0, fmt.Errorf("rate limit check failed: %w", err)
	}
	return n, nil
}

// RateLimit counts a hit on key and reports whether it is over limit in the
// current window.
func (c *RedisCache) RateLimit(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	n, err := c.Increment(ctx, key, window)
	if err != nil {
		return false, err
	}
	return n > int64(limit), nil
}
