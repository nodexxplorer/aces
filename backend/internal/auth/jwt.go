package auth

import (
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type TokenManager struct {
	secret          []byte
	accessDuration  time.Duration
	refreshDuration time.Duration
}

type TokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresAt    string `json:"expiresAt"`
}

type Claims struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
	Email  string `json:"email"`
	Roles  string `json:"roles,omitempty"`
	jwt.RegisteredClaims
}

func (c *Claims) HasRole(role string) bool {
	if c.Role == role {
		return true
	}
	if c.Roles != "" {
		for _, r := range strings.Split(c.Roles, ",") {
			if strings.TrimSpace(r) == role {
				return true
			}
		}
	}
	return false
}

func (c *Claims) HasAnyRole(roles []string) bool {
	for _, allowed := range roles {
		if c.HasRole(allowed) {
			return true
		}
	}
	return false
}

func NewTokenManager(secret string, accessDuration, refreshDuration time.Duration) *TokenManager {
	return &TokenManager{
		secret:          []byte(secret),
		accessDuration:  accessDuration,
		refreshDuration: refreshDuration,
	}
}

func (tm *TokenManager) GeneratePair(userID uuid.UUID, role, email string, allRoles []string) (*TokenPair, error) {
	accessToken, expiresAt, err := tm.generate(userID, role, email, allRoles, tm.accessDuration)
	if err != nil {
		return nil, fmt.Errorf("generate access token: %w", err)
	}

	refreshToken, _, err := tm.generate(userID, role, email, allRoles, tm.refreshDuration)
	if err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt.Format(time.RFC3339),
	}, nil
}

func (tm *TokenManager) generate(userID uuid.UUID, role, email string, allRoles []string, duration time.Duration) (string, time.Time, error) {
	expiresAt := time.Now().Add(duration)
	rolesStr := strings.Join(allRoles, ",")
	claims := &Claims{
		UserID: userID.String(),
		Role:   role,
		Email:  email,
		Roles:  rolesStr,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "aces-zone",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(tm.secret)
	if err != nil {
		return "", time.Time{}, err
	}

	return signed, expiresAt, nil
}

func (tm *TokenManager) Verify(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return tm.secret, nil
	})
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	return claims, nil
}
