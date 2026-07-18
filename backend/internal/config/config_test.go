package config

import (
	"os"
	"testing"
)

func TestLoad_Success(t *testing.T) {
	t.Setenv("DB_SOURCE", "postgresql://user:pass@localhost:5432/test")
	t.Setenv("JWT_SECRET", "this-is-a-long-enough-secret-for-testing-1234")
	t.Setenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
	t.Setenv("SMTP_MOCK", "true")

	cfg := Load()

	if cfg.DBSource == "" {
		t.Error("DBSource should not be empty")
	}
	if cfg.JWTSecret == "" {
		t.Error("JWTSecret should not be empty")
	}
	if len(cfg.JWTSecret) < 32 {
		t.Error("JWTSecret should be at least 32 chars")
	}
	if len(cfg.AllowedOrigins) != 2 {
		t.Errorf("expected 2 allowed origins, got %d", len(cfg.AllowedOrigins))
	}
	if !cfg.SMTPMock {
		t.Error("SMTPMock should be true")
	}
}

func TestIsProduction(t *testing.T) {
	cfg := &Config{Environment: "production"}
	if !cfg.IsProduction() {
		t.Error("expected IsProduction to return true")
	}

	cfg.Environment = "development"
	if cfg.IsProduction() {
		t.Error("expected IsProduction to return false")
	}
}

func TestGetEnv(t *testing.T) {
	os.Setenv("TEST_GET_ENV_KEY", "test-value")
	defer os.Unsetenv("TEST_GET_ENV_KEY")

	val := getEnv("TEST_GET_ENV_KEY", "default")
	if val != "test-value" {
		t.Errorf("expected test-value, got %s", val)
	}

	val = getEnv("NONEXISTENT_KEY", "default")
	if val != "default" {
		t.Errorf("expected default, got %s", val)
	}
}

func TestGetSlice(t *testing.T) {
	os.Setenv("TEST_SLICE_KEY", "a, b, c")
	defer os.Unsetenv("TEST_SLICE_KEY")

	result := getSlice("TEST_SLICE_KEY", []string{"default"})
	if len(result) != 3 {
		t.Errorf("expected 3 items, got %d", len(result))
	}
	if result[0] != "a" || result[1] != "b" || result[2] != "c" {
		t.Errorf("unexpected items: %v", result)
	}

	result = getSlice("NONEXISTENT_SLICE", []string{"default"})
	if len(result) != 1 || result[0] != "default" {
		t.Errorf("expected [default], got %v", result)
	}
}

func TestGetBool(t *testing.T) {
	os.Setenv("TEST_BOOL_KEY", "true")
	defer os.Unsetenv("TEST_BOOL_KEY")

	if !getBool("TEST_BOOL_KEY", false) {
		t.Error("expected true")
	}
	if getBool("NONEXISTENT_BOOL", false) {
		t.Error("expected false for nonexistent key")
	}
}

func TestGetInt(t *testing.T) {
	os.Setenv("TEST_INT_KEY", "42")
	defer os.Unsetenv("TEST_INT_KEY")

	if val := getInt("TEST_INT_KEY", 0); val != 42 {
		t.Errorf("expected 42, got %d", val)
	}
	if val := getInt("NONEXISTENT_INT", 10); val != 10 {
		t.Errorf("expected default 10, got %d", val)
	}
}
