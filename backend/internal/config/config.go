package config

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

func init() {
	loadDotEnv()
}

func loadDotEnv() {
	f, err := os.Open(".env")
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.Index(line, "=")
		if idx < 1 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		value := strings.TrimSpace(line[idx+1:])
		if len(value) >= 2 && value[0] == '"' && value[len(value)-1] == '"' {
			value = value[1 : len(value)-1]
		}
		if os.Getenv(key) == "" {
			os.Setenv(key, value)
		}
	}
}

type Config struct {
	DBSource           string
	ServerAddress      string
	JWTSecret          string
	JWTAccessDuration  time.Duration
	JWTRefreshDuration time.Duration
	AllowedOrigins     []string
	PaystackSecretKey  string
	PaystackPublicKey  string
	StorageLocalPath   string
	RedisAddress       string
	RedisPassword      string
	SMTPHost           string
	SMTPPort           int
	SMTPUsername       string
	SMTPPassword       string
	SMTPFrom           string
	SMTPMock           bool
	Environment        string
}

func (c *Config) IsProduction() bool {
	return c.Environment == "production"
}

func Load() *Config {
	dbSource := getEnv("DB_SOURCE", "")
	jwtSecret := getEnv("JWT_SECRET", "")

	if dbSource == "" {
		log.Fatal("DB_SOURCE environment variable is required. See .env.example for reference.")
	}
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required. See .env.example for reference.")
	}
	if len(jwtSecret) < 32 {
		log.Fatal("JWT_SECRET must be at least 32 characters for security.")
	}

	return &Config{
		DBSource:           dbSource,
		ServerAddress:      getEnv("SERVER_ADDRESS", "0.0.0.0:8080"),
		JWTSecret:          jwtSecret,
		JWTAccessDuration:  getDuration("JWT_ACCESS_MINUTES", 60),
		JWTRefreshDuration: getDuration("JWT_REFRESH_DAYS", 7*24*60),
		AllowedOrigins:     getSlice("ALLOWED_ORIGINS", []string{"http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://localhost:5175", "http://127.0.0.1:5175"}),
		PaystackSecretKey:  getEnv("PAYSTACK_SECRET_KEY", ""),
		PaystackPublicKey:  getEnv("PAYSTACK_PUBLIC_KEY", ""),
		StorageLocalPath:   getEnv("STORAGE_LOCAL_PATH", "./uploads"),
		RedisAddress:       getEnv("REDIS_ADDRESS", "localhost:6379"),
		RedisPassword:      getEnv("REDIS_PASSWORD", ""),
		SMTPHost:           getEnv("SMTP_HOST", "localhost"),
		SMTPPort:           getInt("SMTP_PORT", 1025),
		SMTPUsername:       getEnv("SMTP_USERNAME", ""),
		SMTPPassword:       getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:           getEnv("SMTP_FROM", "no-reply@aces.zone"),
		SMTPMock:           getBool("SMTP_MOCK", true),
		Environment:        getEnv("ENVIRONMENT", "development"),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getDuration(key string, defaultMinutes int) time.Duration {
	if val := os.Getenv(key); val != "" {
		if mins, err := strconv.Atoi(val); err == nil {
			return time.Duration(mins) * time.Minute
		}
	}
	return time.Duration(defaultMinutes) * time.Minute
}

func getSlice(key string, fallback []string) []string {
	if val := os.Getenv(key); val != "" {
		parts := strings.Split(val, ",")
		result := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				result = append(result, p)
			}
		}
		if len(result) > 0 {
			return result
		}
	}
	return fallback
}

func (c *Config) DSN() string {
	return fmt.Sprintf("%s", c.DBSource)
}

func getInt(key string, fallback int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return fallback
}

func getBool(key string, fallback bool) bool {
	if val := os.Getenv(key); val != "" {
		if b, err := strconv.ParseBool(val); err == nil {
			return b
		}
	}
	return fallback
}
