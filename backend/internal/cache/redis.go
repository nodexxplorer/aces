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

func NewRedisCache(address, password string) *RedisCache {
	rdb := redis.NewClient(&redis.Options{
		Addr:     address,
		Password: password,
		DB:       0, // Use default DB
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

// RateLimit checks if a key (e.g., IP, User ID) has exceeded the max allowed requests within a window
func (c *RedisCache) RateLimit(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	// A simple atomic increment and expire pattern
	pipe := c.client.TxPipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to execute rate limit pipeline: %w", err)
	}

	count, err := incr.Result()
	if err != nil {
		return false, fmt.Errorf("failed to get count: %w", err)
	}

	if count > int64(limit) {
		return true, nil // Limit exceeded
	}

	return false, nil
}
