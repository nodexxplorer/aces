package util

import (
	"strings"
	"testing"
)

func TestHashPassword_ReturnsHash(t *testing.T) {
	hash, err := HashPassword("Password123!")
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}
	if hash == "" {
		t.Fatal("expected non-empty hash")
	}
	if hash == "Password123!" {
		t.Fatal("hash should not equal plaintext")
	}
	if !strings.HasPrefix(hash, "$2a$") && !strings.HasPrefix(hash, "$2b$") {
		t.Errorf("expected bcrypt hash prefix, got: %s", hash[:4])
	}
}

func TestHashPassword_DifferentHashesForSamePassword(t *testing.T) {
	h1, _ := HashPassword("Password123!")
	h2, _ := HashPassword("Password123!")
	if h1 == h2 {
		t.Error("bcrypt hashes of same password should differ (different salts)")
	}
}

func TestCheckPassword_CorrectPassword(t *testing.T) {
	hash, _ := HashPassword("Password123!")
	if err := CheckPassword("Password123!", hash); err != nil {
		t.Errorf("correct password should pass: %v", err)
	}
}

func TestCheckPassword_WrongPassword(t *testing.T) {
	hash, _ := HashPassword("Password123!")
	if err := CheckPassword("WrongPassword!", hash); err == nil {
		t.Error("wrong password should fail")
	}
}

func TestCheckPassword_EmptyPassword(t *testing.T) {
	hash, _ := HashPassword("Password123!")
	if err := CheckPassword("", hash); err == nil {
		t.Error("empty password should fail")
	}
}

func TestCheckPassword_InvalidHash(t *testing.T) {
	if err := CheckPassword("Password123!", "not-a-bcrypt-hash"); err == nil {
		t.Error("invalid hash should fail")
	}
}
