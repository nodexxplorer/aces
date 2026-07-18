package auth

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestTokenManager(t *testing.T) {
	tm := NewTokenManager("test-secret-key-must-be-at-least-32-chars!!", 60*time.Minute, 7*24*60*time.Minute)

	userID := uuid.New()
	pair, err := tm.GeneratePair(userID, "student", "test@example.com", []string{"student"})
	if err != nil {
		t.Fatalf("GeneratePair failed: %v", err)
	}

	if pair.AccessToken == "" {
		t.Fatal("access token is empty")
	}
	if pair.RefreshToken == "" {
		t.Fatal("refresh token is empty")
	}
	if pair.ExpiresAt == "" {
		t.Fatal("expires at is empty")
	}

	claims, err := tm.Verify(pair.AccessToken)
	if err != nil {
		t.Fatalf("Verify access token failed: %v", err)
	}
	if claims.UserID != userID.String() {
		t.Errorf("expected user_id %s, got %s", userID.String(), claims.UserID)
	}
	if claims.Role != "student" {
		t.Errorf("expected role student, got %s", claims.Role)
	}
	if claims.Email != "test@example.com" {
		t.Errorf("expected email test@example.com, got %s", claims.Email)
	}

	claims, err = tm.Verify(pair.RefreshToken)
	if err != nil {
		t.Fatalf("Verify refresh token failed: %v", err)
	}
	if claims.UserID != userID.String() {
		t.Errorf("expected user_id %s, got %s", userID.String(), claims.UserID)
	}

	_, err = tm.Verify("invalid-token")
	if err == nil {
		t.Fatal("expected error for invalid token")
	}
}

func TestClaimsHasRole(t *testing.T) {
	tests := []struct {
		name     string
		role     string
		roles    string
		check    string
		expected bool
	}{
		{"primary role match", "admin", "", "admin", true},
		{"primary role mismatch", "student", "", "admin", false},
		{"additional role match", "student", "admin,delegated_admin", "admin", true},
		{"additional role mismatch", "student", "admin,delegated_admin", "hod", false},
		{"empty roles", "student", "", "student", true},
		{"empty roles mismatch", "student", "", "admin", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			claims := &Claims{Role: tt.role, Roles: tt.roles}
			if got := claims.HasRole(tt.check); got != tt.expected {
				t.Errorf("HasRole(%q) = %v, want %v", tt.check, got, tt.expected)
			}
		})
	}
}

func TestClaimsHasAnyRole(t *testing.T) {
	claims := &Claims{Role: "student", Roles: "class_rep,bursar_class"}

	if !claims.HasAnyRole([]string{"student"}) {
		t.Error("should have student role")
	}
	if !claims.HasAnyRole([]string{"admin", "class_rep"}) {
		t.Error("should have class_rep role from additional roles")
	}
	if claims.HasAnyRole([]string{"admin", "hod"}) {
		t.Error("should not have admin or hod roles")
	}
}
